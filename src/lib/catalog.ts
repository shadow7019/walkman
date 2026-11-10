// Catalog engine — merge industry tracks from multiple public sources into the DB.
// Acts as the "infinite catalog": any search/explore fan-out permanently extends the library.
//
// Language coverage: a GLOBAL_SEED matrix sweeps ~50 music scenes across
// storefronts (IN, KR, JP, TW, HK, MX, BR, FR, DE, IT, …) so the library fills
// with real songs in every language and genre. 100% real catalog data — no mocks.
import { db } from '@/lib/db'
import { canonicalGenre, canonicalMood } from '@/lib/genre'
import { trending, underground, byGenre, searchTracks, artworkUrl, type AudiusTrack } from '@/lib/audius'
import { itunesSearch, artwork600, type iTunesTrack } from '@/lib/itunes'
import { ARTIST_ROSTER, type ArtistEntry } from '@/lib/artists'
import {
  SPOTIFY_AUTO_PLAYLISTS,
  SPOTIFY_FLAGSHIP,
  fetchSpotifyPlaylistData,
  type SpotifyAutoPlaylist,
  type SpotifySyncProgress,
} from '@/lib/spotify'

export interface CatalogUpsert {
  title: string
  artist: string
  album?: string
  genre?: string
  rawGenre?: string
  mood?: string
  language?: string
  country?: string
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

// Guess a song's language from its script when no explicit language is known.
export function detectLanguage(text: string): string {
  const t = text || ''
  if (/[\u3040-\u30ff]/.test(t)) return 'Japanese' // kana
  if (/[\uac00-\ud7af]/.test(t)) return 'Korean' // hangul
  if (/[\u0900-\u097f]/.test(t)) return 'Hindi' // devanagari
  if (/[\u0e00-\u0e7f]/.test(t)) return 'Thai'
  if (/[\u0600-\u06ff]/.test(t)) return 'Arabic'
  if (/[\u0590-\u05ff]/.test(t)) return 'Hebrew'
  if (/[\u0400-\u04ff]/.test(t)) return 'Russian' // cyrillic
  if (/[\u4e00-\u9fff]/.test(t)) return 'Mandarin' // han (approx.)
  if (/[\u0370-\u03ff]/.test(t)) return 'Greek'
  if (/[ăâđêôơưăáàảãạấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(t)) return 'Vietnamese'
  return ''
}

// Upsert by (source, sourceId); skip near-duplicates already in DB
export async function upsertTrack(t: CatalogUpsert): Promise<'added' | 'updated' | 'skipped'> {
  if (!t.title || !t.artist) return 'skipped'
  const genre = t.genre || canonicalGenre(t.rawGenre || t.title)
  const language = t.language || detectLanguage(`${t.title} ${t.artist}`) || 'Unknown'
  const existing = await db.track.findUnique({
    where: { source_sourceId: { source: t.source, sourceId: t.sourceId } },
  })
  if (existing) {
    // upgrade record if we now know more (e.g. full stream, language)
    const patch: Record<string, unknown> = {}
    if (t.streamUrl && !existing.streamUrl) { patch.streamUrl = t.streamUrl; patch.hasFull = true }
    if (t.previewUrl && !existing.previewUrl) patch.previewUrl = t.previewUrl
    if (t.cover && !existing.cover) patch.cover = t.cover
    if (t.playCount && t.playCount > existing.playCount) patch.playCount = t.playCount
    if (language !== 'Unknown' && (existing.language === 'Unknown' || existing.language === 'English') && language !== 'English') patch.language = language
    if (t.country && !existing.country) patch.country = t.country
    if (Object.keys(patch).length) await db.track.update({ where: { id: existing.id }, data: patch })
    return 'updated'
  }
  // cross-source dedupe: same normalized title+artist already present?
  const similar = await findSimilar(norm(t.title), norm(t.artist))
  if (similar) {
    // prefer keeping the row that has a full stream; enrich the other with the new source's url
    const patch: Record<string, unknown> = {}
    if (t.hasFull && !similar.hasFull) {
      patch.streamUrl = t.streamUrl || ''
      patch.hasFull = true
      patch.bitrateKbps = Math.max(similar.bitrateKbps, t.bitrateKbps || 0)
      patch.qualityTier = 'HI-FI'
      patch.source = 'audius'
      patch.sourceId = t.sourceId
    } else if (!similar.hasFull && t.previewUrl && !similar.previewUrl) {
      patch.previewUrl = t.previewUrl
    }
    if (language !== 'Unknown' && (similar.language === 'Unknown' || similar.language === 'English') && language !== 'English') patch.language = language
    if (t.country && !similar.country) patch.country = t.country
    if (t.cover && !similar.cover) patch.cover = t.cover
    if (Object.keys(patch).length) await db.track.update({ where: { id: similar.id }, data: patch })
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
      language,
      country: t.country || '',
      year: t.year ?? new Date().getFullYear(),
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

export function itunesToUpsert(t: iTunesTrack, language?: string, country?: string, genre?: string): CatalogUpsert {
  const d = t.releaseDate ? new Date(t.releaseDate) : null
  return {
    title: t.trackName,
    artist: t.artistName,
    album: t.collectionName || '',
    genre,
    rawGenre: t.primaryGenreName || '',
    language,
    country,
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

// --- The global seed matrix: every language, every genre ---
// Each entry sweeps one music scene via the iTunes storefront that speaks it.
export interface SeedEntry {
  term: string
  country?: string
  language: string
  genre?: string
  attribute?: string
  limit?: number
}

export const GLOBAL_SEED: SeedEntry[] = [
  // ── English — every major genre (US storefront) ──
  { term: 'pop', language: 'English', genre: 'Pop', attribute: 'genreTerm', limit: 60 },
  { term: 'rock', language: 'English', genre: 'Rock', attribute: 'genreTerm', limit: 60 },
  { term: 'hip hop', language: 'English', genre: 'Hip-Hop', attribute: 'genreTerm', limit: 60 },
  { term: 'electronic', language: 'English', genre: 'Electronic', attribute: 'genreTerm', limit: 60 },
  { term: 'r&b soul', language: 'English', genre: 'R&B', attribute: 'genreTerm', limit: 50 },
  { term: 'jazz', language: 'English', genre: 'Jazz', attribute: 'genreTerm', limit: 50 },
  { term: 'classical', language: 'English', genre: 'Classical', attribute: 'genreTerm', limit: 50 },
  { term: 'country', language: 'English', genre: 'Country', attribute: 'genreTerm', limit: 50 },
  { term: 'metal', language: 'English', genre: 'Metal', attribute: 'genreTerm', limit: 50 },
  { term: 'reggae', language: 'English', genre: 'Reggae', attribute: 'genreTerm', limit: 40 },
  { term: 'folk acoustic', language: 'English', genre: 'Folk', limit: 40 },
  { term: 'blues', language: 'English', genre: 'Blues', attribute: 'genreTerm', limit: 40 },
  { term: 'indie alternative', language: 'English', genre: 'Indie', limit: 50 },
  { term: 'soul funk', language: 'English', genre: 'Funk', limit: 40 },
  { term: 'soundtrack', language: 'English', genre: 'Soundtrack', attribute: 'genreTerm', limit: 40 },
  // ── South Asia ──
  { term: 'bollywood', country: 'IN', language: 'Hindi', genre: 'Bollywood', limit: 60 },
  { term: 'punjabi hits', country: 'IN', language: 'Punjabi', genre: 'Pop', limit: 50 },
  { term: 'tamil hits', country: 'IN', language: 'Tamil', genre: 'Pop', limit: 50 },
  { term: 'telugu hits', country: 'IN', language: 'Telugu', genre: 'Pop', limit: 50 },
  // ── East Asia ──
  { term: 'k-pop', country: 'KR', language: 'Korean', genre: 'K-Pop', limit: 60 },
  { term: 'j-pop', country: 'JP', language: 'Japanese', genre: 'Pop', limit: 60 },
  { term: 'anime', country: 'JP', language: 'Japanese', genre: 'Anime', limit: 50 },
  { term: 'mandopop', country: 'TW', language: 'Mandarin', genre: 'Pop', limit: 50 },
  { term: 'cantopop', country: 'HK', language: 'Cantonese', genre: 'Pop', limit: 40 },
  // ── Latin world ──
  { term: 'reggaeton', country: 'MX', language: 'Spanish', genre: 'Latin', limit: 60 },
  { term: 'banda mexicana', country: 'MX', language: 'Spanish', genre: 'Latin', limit: 40 },
  { term: 'flamenco', country: 'ES', language: 'Spanish', genre: 'Folk', limit: 40 },
  { term: 'pop español', country: 'ES', language: 'Spanish', genre: 'Pop', limit: 40 },
  { term: 'sertanejo', country: 'BR', language: 'Portuguese', genre: 'Pop', limit: 50 },
  { term: 'bossa nova', country: 'BR', language: 'Portuguese', genre: 'Jazz', limit: 40 },
  // ── Europe ──
  { term: 'chanson française', country: 'FR', language: 'French', genre: 'Pop', limit: 50 },
  { term: 'rap français', country: 'FR', language: 'French', genre: 'Hip-Hop', limit: 50 },
  { term: 'deutschrap', country: 'DE', language: 'German', genre: 'Hip-Hop', limit: 50 },
  { term: 'deutscher pop', country: 'DE', language: 'German', genre: 'Pop', limit: 40 },
  { term: 'pop italiana', country: 'IT', language: 'Italian', genre: 'Pop', limit: 50 },
  { term: 'nederlandstalig', country: 'NL', language: 'Dutch', genre: 'Pop', limit: 40 },
  { term: 'polski pop', country: 'PL', language: 'Polish', genre: 'Pop', limit: 40 },
  { term: 'svensk pop', country: 'SE', language: 'Swedish', genre: 'Pop', limit: 40 },
  { term: 'greek pop', country: 'GR', language: 'Greek', genre: 'Pop', limit: 40 },
  { term: 'türkçe pop', country: 'TR', language: 'Turkish', genre: 'Pop', limit: 50 },
  { term: 'russian pop', country: 'RU', language: 'Russian', genre: 'Pop', limit: 50 },
  { term: 'ukrainian pop', country: 'UA', language: 'Ukrainian', genre: 'Pop', limit: 40 },
  { term: 'magyar pop', country: 'HU', language: 'Hungarian', genre: 'Pop', limit: 40 },
  { term: 'muzica romaneasca', country: 'RO', language: 'Romanian', genre: 'Pop', limit: 40 },
  { term: 'irish folk', country: 'IE', language: 'Irish', genre: 'Folk', limit: 40 },
  { term: 'fado', country: 'PT', language: 'Portuguese', genre: 'Folk', limit: 40 },
  // ── Africa & Middle East ──
  { term: 'afrobeats', country: 'NG', language: 'English', genre: 'Afrobeats', limit: 60 },
  { term: 'amapiano', country: 'ZA', language: 'Zulu', genre: 'Afrobeats', limit: 50 },
  { term: 'bongo flava', country: 'TZ', language: 'Swahili', genre: 'Afrobeats', limit: 40 },
  { term: 'arabic pop', country: 'EG', language: 'Arabic', genre: 'Pop', limit: 50 },
  { term: 'israeli pop', country: 'IL', language: 'Hebrew', genre: 'Pop', limit: 40 },
  { term: 'persian pop', language: 'Persian', genre: 'Pop', limit: 40 },
  // ── Southeast Asia ──
  { term: 'v-pop', country: 'VN', language: 'Vietnamese', genre: 'Pop', limit: 40 },
  { term: 'thai pop', country: 'TH', language: 'Thai', genre: 'Pop', limit: 40 },
  { term: 'indonesian pop', country: 'ID', language: 'Indonesian', genre: 'Pop', limit: 40 },
  { term: 'opm', country: 'PH', language: 'Filipino', genre: 'Pop', limit: 40 },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Sweep the whole matrix. Resumable + gentle on rate limits.
export async function globalSeed(onProgress?: (done: number, total: number, added: number) => void): Promise<{ added: number; scanned: number }> {
  let added = 0
  const total = GLOBAL_SEED.length
  for (let i = 0; i < total; i++) {
    const e = GLOBAL_SEED[i]
    try {
      const results = await itunesSearch({ term: e.term, country: e.country, attribute: e.attribute, limit: e.limit ?? 50 })
      for (const t of results) {
        const r = await upsertTrack(itunesToUpsert(t, e.language, e.country ?? 'US'))
        if (r === 'added') added++
      }
      await db.syncLog.create({ data: { source: 'itunes', scope: `${e.language}:${e.term}`, fetched: results.length, added, updated: 0 } }).catch(() => {})
    } catch {
      // rate-limited or transient — back off a little, keep going
      await sleep(2500)
    }
    onProgress?.(i + 1, total, added)
    await sleep(350) // stay under Apple's rate limit
  }
  return { added, scanned: total }
}

// --- Artist sweep: pull every major band/artist's songs into the library ---

// Strip accents + lowercase for fuzzy artist-name matching
const fold = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Keep only tracks actually by the requested act (term search also matches song titles)
function byThisArtist(artistName: string, results: iTunesTrack[]): iTunesTrack[] {
  const tokens = fold(artistName).split(/[^a-z0-9]+/).filter((t) => t.length > 1)
  if (!tokens.length) return results
  return results.filter((t) => {
    const an = fold(t.artistName)
    return tokens.every((tok) => an.includes(tok))
  })
}

export interface SweepProgress {
  running: boolean
  done: number
  total: number
  added: number
  current: string
}

// Sweep the whole artist roster. Resumable: completed artists are logged in
// SyncLog (source='artist-sweep') and skipped on re-runs. Fast-dedupes via an
// in-memory set of existing (title|artist) keys to avoid per-row LIKE scans.
export async function sweepArtists(onProgress?: (p: SweepProgress) => void, roster: ArtistEntry[] = ARTIST_ROSTER): Promise<{ added: number; scanned: number; skippedArtists: number }> {
  let added = 0
  let skippedArtists = 0
  const total = roster.length

  // resume: skip acts already swept in a previous run
  const doneScopes = new Set(
    (await db.syncLog.findMany({ where: { source: 'artist-sweep' }, select: { scope: true } })).map((l) => l.scope),
  )

  // preload known (title|artist) keys once — O(1) dedupe for every row
  const existingRows = await db.track.findMany({ select: { title: true, artist: true } })
  const keys = new Set<string>()
  for (const r of existingRows) keys.add(`${norm(r.title)}|${norm(r.artist)}`)

  for (let i = 0; i < total; i++) {
    const a = roster[i]
    if (doneScopes.has(a.name)) {
      skippedArtists++
      onProgress?.({ running: true, done: i + 1, total, added, current: a.name })
      continue
    }
    try {
      const raw = await itunesSearch({ term: a.name, country: a.country, limit: a.limit })
      const results = byThisArtist(a.name, raw)
      let artistAdded = 0
      for (const t of results) {
        const key = `${norm(t.trackName)}|${norm(t.artistName)}`
        if (keys.has(key)) continue
        keys.add(key)
        const r = await upsertTrack(itunesToUpsert(t, a.language, a.country, a.genre))
        if (r === 'added') artistAdded++
      }
      added += artistAdded
      await db.syncLog.create({ data: { source: 'artist-sweep', scope: a.name, fetched: results.length, added: artistAdded, updated: 0, detail: a.genre } })
      onProgress?.({ running: true, done: i + 1, total, added, current: a.name })
    } catch {
      // rate-limited or transient — back off; do NOT mark done so the next run retries
      await sleep(2500)
      continue
    }
    await sleep(350) // stay under Apple's rate limit
  }
  onProgress?.({ running: false, done: total, total, added, current: '' })
  return { added, scanned: total, skippedArtists }
}

// --- Spotify auto-add: official charts & editorial playlists → real library tracks ---

export type { SpotifySyncProgress }

// Try to find the exact song in the iTunes industry catalog (cover art, 256 kbps
// preview, year, genre). Accepts only confident matches.
async function itunesMatchTrack(title: string, artist: string): Promise<iTunesTrack | null> {
  const query = `${title} ${artist}`.trim()
  try {
    const results = await itunesSearch({ term: query, limit: 5 })
    const nt = norm(title)
    const na = norm(artist)
    for (const t of results) {
      if (norm(t.trackName) === nt && (!na || norm(t.artistName).includes(na) || na.includes(norm(t.artistName)))) return t
    }
    // second pass: exact title + matching lead artist word
    for (const t of results) {
      if (norm(t.trackName) === nt) return t
    }
  } catch { /* transient */ }
  return null
}

// Sweep Spotify playlists into the library. Resumable: a playlist swept in the
// last 4h is skipped (charts refresh daily) unless `force`.
export async function spotifySync(
  onProgress?: (p: SpotifySyncProgress) => void,
  playlists: SpotifyAutoPlaylist[] = SPOTIFY_AUTO_PLAYLISTS,
  opts: { force?: boolean } = {},
): Promise<{ added: number; scanned: number; skippedPlaylists: number }> {
  let added = 0
  let skippedPlaylists = 0
  const total = playlists.length

  // resume: playlists swept very recently are skipped unless forced
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
  const recent = opts.force ? new Set<string>() : new Set(
    (
      await db.syncLog.findMany({
        where: { source: 'spotify-sync', syncedAt: { gte: fourHoursAgo } },
        select: { scope: true },
      })
    ).map((l) => l.scope),
  )

  // preload known (title|artist) keys — O(1) dedupe, skips unneeded iTunes calls
  const existingRows = await db.track.findMany({ select: { title: true, artist: true } })
  const keys = new Set<string>()
  for (const r of existingRows) keys.add(`${norm(r.title)}|${norm(r.artist)}`)

  for (let i = 0; i < total; i++) {
    const pl = playlists[i]
    if (recent.has(pl.id) || recent.has(pl.label)) {
      skippedPlaylists++
      onProgress?.({ running: true, done: i + 1, total, added, current: pl.label })
      continue
    }
    try {
      const data = await fetchSpotifyPlaylistData(pl.id)
      let playlistAdded = 0
      for (const e of data.tracks) {
        const key = `${norm(e.title)}|${norm(e.artist)}`
        if (keys.has(key)) continue
        // 1) prefer the iTunes industry row: cover art, year, 256 kbps preview
        const match = await itunesMatchTrack(e.title, e.artist)
        if (match) {
          keys.add(`${norm(match.trackName)}|${norm(match.artistName)}`)
          const r = await upsertTrack(itunesToUpsert(match, pl.language, pl.country, pl.genre))
          if (r === 'added') playlistAdded++
          continue
        }
        // 2) fallback: add the Spotify row itself (title/artist/preview are real)
        if (!e.previewUrl && !e.artist) continue
        keys.add(key)
        const r = await upsertTrack({
          title: e.title,
          artist: e.artist || 'Unknown Artist',
          genre: pl.genre,
          language: pl.language,
          country: pl.country,
          durationMs: e.durationMs,
          source: 'spotify',
          sourceId: e.trackId,
          streamUrl: e.previewUrl,
          hasFull: false,
          qualityTier: 'HQ',
          bitrateKbps: 96,
        })
        if (r === 'added') playlistAdded++
      }
      added += playlistAdded
      await db.syncLog.create({ data: { source: 'spotify-sync', scope: pl.id, fetched: data.tracks.length, added: playlistAdded, updated: 0, detail: pl.label } })
      onProgress?.({ running: true, done: i + 1, total, added, current: pl.label })
    } catch {
      // transient / playlist unavailable — back off, retry next run
      await sleep(2500)
      continue
    }
    await sleep(600)
  }
  onProgress?.({ running: false, done: total, total, added, current: '' })
  return { added, scanned: total, skippedPlaylists }
}

// --- Fan-out: extend the catalog from all sources at once ---

export async function fanOutSearch(query: string, limitPerSource = 15): Promise<number> {
  let added = 0
  const jobs: Promise<'added' | 'updated' | 'skipped'>[][] = []
  try {
    const [au, it, itArtist] = await Promise.allSettled([
      searchTracks(query, limitPerSource),
      itunesSearch({ term: query, limit: limitPerSource }),
      itunesSearch({ term: query, attribute: 'artistTerm', limit: limitPerSource }), // band/artist name match
    ])
    if (au.status === 'fulfilled') jobs.push(au.value.map((t) => upsertTrack(audiusToUpsert(t))))
    if (it.status === 'fulfilled') jobs.push(it.value.map((t) => upsertTrack(itunesToUpsert(t))))
    if (itArtist.status === 'fulfilled') jobs.push(itArtist.value.map((t) => upsertTrack(itunesToUpsert(t))))
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
    upserts.push(...it.map((t) => itunesToUpsert(t)))
  } catch { /* best effort */ }
  for (const u of upserts) {
    const r = await upsertTrack(u)
    if (r === 'added') added++
  }
  return added
}

// --- Auto-sync: keep adding new songs over time (refresh mode) ---

export async function syncCatalog(opts: { trendingLimit?: number; perGenreLimit?: number; genres?: string[]; spotify?: boolean } = {}): Promise<{ added: number; updated: number; logs: { source: string; scope: string; fetched: number; added: number; updated: number }[] }> {
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
    try { await runScope('itunes', g, (await itunesSearch({ term: g, attribute: 'genreTerm', limit: perGenreLimit })).map((t) => itunesToUpsert(t))) } catch {}
  }

  // Spotify auto-add: flagship charts (Top Songs Global, Today's Top Hits,
  // New Music Friday, Viva Latino) — the freshest hits, every sync
  if (opts.spotify) {
    const sp = await spotifySync(undefined, SPOTIFY_FLAGSHIP)
    logs.push({ source: 'spotify', scope: 'flagship-charts', fetched: sp.scanned, added: sp.added, updated: 0 })
    added += sp.added
  }

  return { added, updated, logs }
}
