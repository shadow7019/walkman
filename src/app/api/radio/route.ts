import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'
import { searchTracks } from '@/lib/audius'
import { itunesSearch } from '@/lib/itunes'
import { audiusToUpsert, itunesToUpsert, upsertTrack } from '@/lib/catalog'
import { canonicalGenre } from '@/lib/genre'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/radio { seedTrackId } — song radio: similar tracks (same genre/artist, then mood, then external)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const seed = await db.track.findUnique({ where: { id: body.seedTrackId } })
  if (!seed) return NextResponse.json({ error: 'Seed not found' }, { status: 404 })

  const queue: typeof seed[] = [seed]
  const seen = new Set([seed.id])

  // same genre, full-length preferred, then same artist, then same mood
  const byGenre = await db.track.findMany({
    where: { genre: seed.genre, id: { not: seed.id } },
    orderBy: [{ hasFull: 'desc' }, { playCount: 'desc' }],
    take: 30,
  })
  const byArtist = await db.track.findMany({
    where: { artist: seed.artist, id: { not: seed.id } },
    take: 10,
  })
  const byMood = seed.mood
    ? await db.track.findMany({ where: { mood: seed.mood, id: { not: seed.id } }, take: 10 })
    : []

  for (const t of [...byArtist, ...byGenre, ...byMood]) {
    if (!seen.has(t.id)) { seen.add(t.id); queue.push(t) }
    if (queue.length >= 30) break
  }

  // top up from external sources if thin
  if (queue.length < 15) {
    try {
      const au = await searchTracks(`${seed.artist} ${seed.title}`, 10).catch(() => [])
      for (const t of au) {
        await upsertTrack(audiusToUpsert(t))
        const row = await db.track.findUnique({ where: { source_sourceId: { source: 'audius', sourceId: t.id } } })
        if (row && !seen.has(row.id)) { seen.add(row.id); queue.push(row) }
        if (queue.length >= 25) break
      }
    } catch { /* best effort */ }
  }
  if (queue.length < 15) {
    try {
      const it = await itunesSearch({ term: canonicalGenre(seed.genre), attribute: 'genreTerm', limit: 15 })
      for (const t of it) {
        await upsertTrack(itunesToUpsert(t))
        const row = await db.track.findUnique({ where: { source_sourceId: { source: 'itunes', sourceId: String(t.trackId) } } })
        if (row && !seen.has(row.id)) { seen.add(row.id); queue.push(row) }
        if (queue.length >= 25) break
      }
    } catch { /* best effort */ }
  }

  return NextResponse.json({ seed: trackDTO(seed), tracks: queue.map(trackDTO) })
}
