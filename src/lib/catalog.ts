// Catalog engine — merge industry tracks from multiple public sources into the DB.
// Acts as the "infinite catalog": any search/explore fan-out permanently extends the library.
import { db } from '@/lib/db'
import { canonicalGenre, canonicalMood } from '@/lib/genre'
import { trending, underground, byGenre, latest, searchTracks, artworkUrl, type AudiusTrack } from '@/lib/audius'
import { itunesSearch, artwork600, type iTunesTrack } from '@/lib/itunes'

export interface CatalogUpsert {
  title: string
  artist: string
  album?: string
  genre?: string
  rawGenre?: string
  mood?: string
  year?: number
  durationMs?: number
  cover?: string
  source: string
  sourceId: string
  streamUrl?: string
  previewUrl?: string
  hasFull?: boolean
  qualityTier?: string
  bitrateKbps?: number
  explicit?: boolean
  playCount?: number
  favoriteCount?: number
  permalink?: string
  releaseDate?: Date | null
}

const norm = (s: string) => (s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

// Upsert by (source, sourceId); skip near-duplicates already in DB
export async function upsertTrack(t: CatalogUpsert): Promise<'added' | 'updated' | 'skipped'> {
  if (!t.title || !t.artist) return 'skipped'
  const genre = t.genre || canonicalGenre(t.rawGenre || t.title)
  const existing = await db.track.findUnique({
    where: { source_sourceId: { source: t.source, sourceId: t.sourceId } },
  })
  if (existing) {
    // upgrade record if we now know more (e.g. full stream)
    const patch: Record<string, unknown> = {}
    if (t.streamUrl && !existing.streamUrl) { patch.streamUrl = t.streamUrl; patch.hasFull = true }
    if (t.previewUrl && !existing.previewUrl) patch.previewUrl = t.previewUrl
    if (t.cover && !existing.cover) patch.cover = t.cover
    if (t.playCount && t.playCount > existing.playCount) patch.playCount = t.playCount
    if (Object.keys(patch).length) await db.track.update({ where: { id: existing.id }, data: patch })
    return 'updated'
  }
  // cross-source dedupe: same normalized title+artist already present?
  const similar = await findSimilar(norm(t.title), norm(t.artist))
  if (similar) {
    // prefer keeping the row that has a full stream; enrich the other with the new source's url
    if (t.hasFull && !similar.hasFull) {
      await db.track.update({
        where: { id: similar.id },
        data: { streamUrl: t.streamUrl || '', hasFull: true, bitrateKbps: Math.max(similar.bitrateKbps, t.bitrateKbps || 0), qualityTier: 'HI-FI', source: 'audius', sourceId: t.sourceId },
      })
    } else if (!similar.hasFull && t.previewUrl && !similar.previewUrl) {
      await db.track.update({ where: { id: similar.id }, data: { previewUrl: t.previewUrl } })
    }
    return 'skipped'
  }
  await db.track.create({
    data: {
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      genre,
      rawGenre: t.rawGenre || '',
      mood: canonicalMood(t.mood || ''),
      year: t.year ?? 2024,
      durationMs: t.durationMs ?? 0,
      cover: t.cover || '',
      source: t.source,
      sourceId: t.sourceId,
      streamUrl: t.streamUrl || '',
      previewUrl: t.previewUrl || '',
      hasFull: !!t.hasFull,
      qualityTier: t.qualityTier || 'HQ',
      bitrateKbps: t.bitrateKbps || 256,
      explicit: !!t.explicit,
      playCount: t.playCount ?? 0,
      favoriteCount: t.favoriteCount ?? 0,
      permalink: t.permalink || '',
      releaseDate: t.releaseDate ?? null,
    },
  })
  return 'added'
}

async function findSimilar(titleNorm: string, artistNorm: string) {
  const candidates = await db.track.findMany({
    where: {
      OR: [{ title: { contains: titleNorm.slice(0, 24) } }],
    },
    take: 12,
  })
  return candidates.find((c) => norm(c.title) === titleNorm && norm(c.artist) === artistNorm) ?? null
}

// --- Adapters from source payloads to CatalogUpsert ---

export function audiusToUpsert(t: AudiusTrack): CatalogUpsert {
  const title = t.title.replace(/\s*[-–]\s*(Official\s+)?(Music\s+)?Video$/i, '').trim()
  return {
    title,
    artist: t.user?.name || t.user?.handle || 'Unknown Artist',
    album: '',
    rawGenre: t.genre || '',
    mood: t.mood || '',
    durationMs: (t.duration || 0) * 1000,
    cover: artworkUrl(t),
    source: 'audius',
    sourceId: t.id,
    streamUrl: `https://discoveryprovider.audius.co/v1/tracks/${t.id}/stream?app_name=Walkman`,
    hasFull: true,
    qualityTier: 'HI-FI',
    bitrateKbps: 320,
    playCount: t.play_count || 0,
    favoriteCount: t.favorite_count || 0,
    permalink: t.permalink ? `https://audius.co${t.permalink}` : '',
    releaseDate: t.release_date ? new Date(t.release_date) : null,
    year: t.release_date ? new Date(t.release_date).getFullYear() : undefined,
  }
}

export function itunesToUpsert(t: iTunesTrack): CatalogUpsert {
  const d = t.releaseDate ? new Date(t.releaseDate) : null
  return {
    title: t.trackName,
    artist: t.artistName,
    album: t.collectionName || '',
    rawGenre: t.primaryGenreName || '',
    durationMs: t.trackTimeMillis || 0,
    cover: artwork600(t),
    source: 'itunes',
    sourceId: String(t.trackId),
    previewUrl: t.previewUrl || '',
    hasFull: false,
    qualityTier: 'HQ',
    bitrateKbps: 256,
    explicit: t.trackExplicitness === 'explicit',
    permalink: t.trackViewUrl || '',
    releaseDate: d,
    year: d ? d.getFullYear() : undefined,
  }
}

// --- Fan-out: extend the catalog from all sources at once ---

export async function fanOutSearch(query: string, limitPerSource = 15): Promise<number> {
  let added = 0
  const jobs: Promise<'added' | 'updated' | 'skipped'>[][] = []
  try {
    const [au, it] = await Promise.allSettled([
      searchTracks(query, limitPerSource),
      itunesSearch({ term: query, limit: limitPerSource }),
    ])
    if (au.status === 'fulfilled') jobs.push(au.value.map((t) => upsertTrack(audiusToUpsert(t))))
    if (it.status === 'fulfilled') jobs.push(it.value.map((t) => upsertTrack(itunesToUpsert(t))))
  } catch { /* best effort */ }
  const results = (await Promise.allSettled(jobs.flat())).filter((r) => r.status === 'fulfilled' && r.value === 'added')
  added = results.length
  return added
}

export async function fanOutGenre(genre: string, limitPerSource = 30): Promise<number> {
  let added = 0
  const upserts: CatalogUpsert[] = []
  try {
    const au = await byGenre(genre === 'Hip-Hop' ? 'Hip-Hop/Rap' : genre, limitPerSource)
    upserts.push(...au.map(audiusToUpsert))
  } catch { /* best effort */ }
  try {
    const it = await itunesSearch({ term: genre, attribute: 'genreTerm', limit: limitPerSource })
    upserts.push(...it.map(itunesToUpsert))
  } catch { /* best effort */ }
  for (const u of upserts) {
    const r = await upsertTrack(u)
    if (r === 'added') added++
  }
  return added
}

// --- Auto-sync: keep adding new songs over time ---

export async function syncCatalog(opts: { trendingLimit?: number; perGenreLimit?: number; genres?: string[] } = {}): Promise<{ added: number; updated: number; logs: { source: string; scope: string; fetched: number; added: number; updated: number }[] }> {
  const trendingLimit = opts.trendingLimit ?? 50
  const perGenreLimit = opts.perGenreLimit ?? 20
  const genres = opts.genres ?? ['Electronic', 'Hip-Hop/Rap', 'Pop', 'R&B/Soul', 'Rock', 'Jazz', 'House', 'Techno', 'Lo-Fi', 'Classical', 'Ambient', 'Metal', 'Latin', 'Country', 'Folk', 'Dubstep']
  const logs: { source: string; scope: string; fetched: number; added: number; updated: number }[] = []
  let added = 0
  let updated = 0

  async function runScope(source: string, scope: string, items: CatalogUpsert[]) {
    let a = 0
    let u = 0
    for (const item of items) {
      const r = await upsertTrack(item)
      if (r === 'added') a++
      else if (r === 'updated') u++
    }
    logs.push({ source, scope, fetched: items.length, added: a, updated: u })
    added += a
    updated += u
    await db.syncLog.create({ data: { source, scope, fetched: items.length, added: a, updated: u } })
  }

  // Audius: trending (this week = "new songs auto-added"), underground
  try { await runScope('audius', 'trending', (await trending(undefined, trendingLimit)).map(audiusToUpsert)) } catch {}
  try { await runScope('audius', 'underground', (await underground(30)).map(audiusToUpsert)) } catch {}

  // Audius per-genre + iTunes per-genre fan-out
  for (const g of genres) {
    try { await runScope('audius', g, (await byGenre(g, perGenreLimit)).map(audiusToUpsert)) } catch {}
  }
  for (const g of ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Country', 'Latin', 'K-Pop', 'Metal', 'Lo-Fi']) {
    try { await runScope('itunes', g, (await itunesSearch({ term: g, attribute: 'genreTerm', limit: perGenreLimit })).map(itunesToUpsert)) } catch {}
  }
  return { added, updated, logs }
}
