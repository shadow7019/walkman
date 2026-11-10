// Playlist import engine — "import any playlist from any app".
// Supports: public Spotify links, plain text lists, CSV exports (Exportify / TuneMyMusic).
import { db } from '@/lib/db'
import { norm } from '@/lib/normalize'
import { searchTracks, type AudiusTrack } from '@/lib/audius'
import { itunesSearch } from '@/lib/itunes'
import { fetchSpotifyPlaylistData } from '@/lib/spotify'

export interface ParsedSong {
  title: string
  artist: string
  originalLine?: string
}

export interface MatchResult {
  song: ParsedSong
  trackId: string | null
  via: string | null // db | audius | itunes
}

// ---------- Parsing ----------

export function parseSpotifyUrl(input: string): string | null {
  const s = input.trim()
  const m =
    s.match(/spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]{22})/) ||
    s.match(/spotify:playlist:([A-Za-z0-9]{22})/)
  if (m) return m[1]
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s
  return null
}

export interface SpotifyFetchResult {
  songs: ParsedSong[]
  name: string
  description: string
}

export async function fetchSpotifyPlaylist(playlistId: string): Promise<SpotifyFetchResult> {
  const data = await fetchSpotifyPlaylistData(playlistId)
  const songs: ParsedSong[] = data.tracks.map((t) => ({
    title: cleanTitle(t.title),
    artist: cleanArtist(t.artist),
    originalLine: `${t.artist} - ${t.title}`,
  }))
  return { songs, name: data.name, description: data.description }
}

export function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\((?:feat|ft|with)[^)]*\)/gi, '')
    .replace(/\s*-\s*(?:feat|ft)\..*$/i, '')
    .trim()
}

export function cleanArtist(raw: string): string {
  return raw.split(/[,&]/)[0].trim() || raw.trim()
}

// Text list: "Artist - Title" per line (ByTune style), or "Title,Artist" loose lines
export function parseTextList(text: string, mode: 'artist-first' | 'title-first' = 'artist-first'): ParsedSong[] {
  const songs: ParsedSong[] = []
  for (const line of text.split('\n')) {
    const l = line.trim().replace(/^\d+[.)]\s*/, '')
    if (!l || /^(artist|title|track|#)/i.test(l)) continue
    const parts = l.split(/\s+[-–—]\s+/)
    if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
      const artist = mode === 'artist-first' ? parts[0] : parts[parts.length - 1]
      const title = mode === 'artist-first' ? parts.slice(1).join(' - ') : parts.slice(0, -1).join(' - ')
      songs.push({ title: cleanTitle(title), artist: cleanArtist(artist), originalLine: l })
    } else if (l.includes(',')) {
      const [title, artist] = l.split(',')
      songs.push({ title: cleanTitle(title.trim()), artist: cleanArtist(artist?.trim() || ''), originalLine: l })
    } else {
      songs.push({ title: cleanTitle(l), artist: '', originalLine: l })
    }
  }
  return songs
}

// CSV: Exportify ("Track Name","Artist Name(s)") or TuneMyMusic ("Title","Artist")
export function parseCSV(text: string): ParsedSong[] {
  const lines = text.split('\n').filter((l) => l.trim())
  if (!lines.length) return []
  const splitCsv = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ
      } else if (ch === ',' && !inQ) { out.push(cur); cur = '' } else cur += ch
    }
    out.push(cur)
    return out.map((s) => s.trim().replace(/^"|"$/g, ''))
  }
  const header = splitCsv(lines[0]).map((h) => h.toLowerCase())
  const findCol = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)))
  let titleCol = findCol(['track name', 'title', 'song', 'name'])
  let artistCol = findCol(['artist'])
  if (titleCol < 0) { titleCol = 0; artistCol = 1 } // assume positional fallback
  if (artistCol < 0) artistCol = titleCol === 0 ? 1 : 0
  const songs: ParsedSong[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line)
    const title = cells[titleCol]?.trim()
    const artist = cells[artistCol]?.trim() ?? ''
    if (!title) continue
    songs.push({ title: cleanTitle(title), artist: cleanArtist(artist), originalLine: line })
  }
  return songs
}

// ---------- Matching ----------

function matchScore(song: ParsedSong, title: string, artist: string): number {
  const nt = norm(title)
  const na = norm(artist)
  const st = norm(song.title)
  const sa = norm(song.artist)
  if (nt === st && (!sa || na === sa)) return 100
  if (nt === st && sa && (na.includes(sa) || sa.includes(na))) return 92
  if (nt === st) return 70
  if (nt.includes(st) && st.length > 4 && (na === sa || !sa)) return 55
  return 0
}

export async function matchSong(song: ParsedSong): Promise<MatchResult> {
  const query = `${song.title} ${song.artist}`.trim()
  if (!query) return { song, trackId: null, via: null }

  // 1) local DB
  const local = await db.track.findMany({
    where: {
      OR: [
        { title: { contains: song.title.slice(0, 30) } },
        ...(song.artist ? [{ artist: { contains: song.artist.slice(0, 30) } }] : []),
      ],
    },
    take: 30,
  })
  let best: { id: string; score: number } | null = null
  for (const t of local) {
    const score = matchScore(song, t.title, t.artist)
    if (score > (best?.score ?? 0)) best = { id: t.id, score }
  }
  if (best && best.score >= 70) return { song, trackId: best.id, via: 'db' }

  // 2) Audius (full-length)
  try {
    const au: AudiusTrack[] = await searchTracks(query, 8)
    for (const t of au) {
      const score = matchScore(song, t.title, t.user?.name ?? '')
      if (score >= 70) {
        const { audiusToUpsert, upsertTrack } = await import('@/lib/catalog')
        const up = await upsertTrack(audiusToUpsert(t))
        void up
        const row = await db.track.findUnique({ where: { source_sourceId: { source: 'audius', sourceId: t.id } } })
        if (row) return { song, trackId: row.id, via: 'audius' }
      }
    }
  } catch { /* fall through */ }

  // 3) iTunes (industry catalog + preview) — also permanently extends the library
  try {
    const it = await itunesSearch({ term: query, limit: 8 })
    for (const t of it) {
      const score = matchScore(song, t.trackName, t.artistName)
      if (score >= 70) {
        const { itunesToUpsert, upsertTrack } = await import('@/lib/catalog')
        await upsertTrack(itunesToUpsert(t))
        const row = await db.track.findUnique({ where: { source_sourceId: { source: 'itunes', sourceId: String(t.trackId) } } })
        if (row) return { song, trackId: row.id, via: 'itunes' }
      }
    }
  } catch { /* fall through */ }

  if (best && best.score >= 55) return { song, trackId: best.id, via: 'db' }
  return { song, trackId: null, via: null }
}

export async function matchAll(songs: ParsedSong[], concurrency = 3): Promise<MatchResult[]> {
  const results: MatchResult[] = []
  let idx = 0
  async function worker() {
    while (idx < songs.length) {
      const i = idx++
      results[i] = await matchSong(songs[i]).catch(() => ({ song: songs[i], trackId: null, via: null }))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, songs.length) }, worker))
  return results
}
