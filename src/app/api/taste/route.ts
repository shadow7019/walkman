import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/taste — Spotufi-style taste profile: "Made for you" mixes built from listening history.
export async function GET() {
  const history = await db.playHistory.findMany({
    orderBy: { playedAt: 'desc' },
    include: { track: true },
    take: 400,
  })
  const total = await db.track.count()

  // genre + artist affinity
  const genreWeight = new Map<string, number>()
  const artistWeight = new Map<string, number>()
  const playedIds = new Set<string>()
  for (const e of history) {
    genreWeight.set(e.track.genre, (genreWeight.get(e.track.genre) ?? 0) + 1)
    artistWeight.set(e.track.artist, (artistWeight.get(e.track.artist) ?? 0) + 1)
    playedIds.add(e.trackId)
  }
  const topGenres = [...genreWeight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g)
  const topArtist = [...artistWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const mix = async (where: Record<string, unknown>, take = 20): Promise<ReturnType<typeof trackDTO>[]> => {
    const rows = await db.track.findMany({ where, orderBy: [{ hasFull: 'desc' }, { playCount: 'desc' }], take })
    return rows.map(trackDTO)
  }

  // 1. On Repeat — most played artist's tracks
  // 2. Genre mix of top genre
  // 3. Discovery — tracks in liked/played genres never played
  // 4. Time Capsule — older years (<= 2015)
  const [onRepeat, genreMix, discovery, timeCapsule] = await Promise.all([
    topArtist ? mix({ artist: topArtist, hasFull: true }, 20) : Promise.resolve([]),
    topGenres[0] ? mix({ genre: topGenres[0] }, 20) : mix({ hasFull: true }, 20),
    mix(playedIds.size
      ? { genre: { in: topGenres.length ? topGenres : ['Pop', 'Rock', 'Electronic'] }, id: { notIn: [...playedIds].slice(0, 500) } }
      : { hasFull: true }, 20),
    mix({ year: { lte: 2015 } }, 20),
  ])

  return NextResponse.json({
    topGenres,
    topArtist,
    mixes: [
      { id: 'on-repeat', title: `On Repeat — ${topArtist ?? 'Your favorites'}`, subtitle: 'Songs you keep coming back to', tracks: onRepeat },
      { id: 'genre-mix', title: `${topGenres[0] ?? 'Daily'} Mix`, subtitle: 'Your top genre, refreshed', tracks: genreMix },
      { id: 'discovery', title: 'Discovery Mix', subtitle: 'Fresh picks in genres you love', tracks: discovery },
      { id: 'time-capsule', title: 'Time Capsule', subtitle: 'Throwbacks from before 2015', tracks: timeCapsule },
    ].filter((m) => m.tracks.length > 0),
    catalogSize: total,
  })
}
