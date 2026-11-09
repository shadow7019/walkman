// Audius public API client — free full-length streaming (320kbps)
// Docs: https://docs.audius.org/developers/api/
const APP = 'Walkman'
let hostPromise: Promise<string> | null = null

export async function audiusHost(): Promise<string> {
  if (!hostPromise) {
    hostPromise = (async () => {
      try {
        const r = await fetch('https://api.audius.co', { signal: AbortSignal.timeout(6000) })
        const j = await r.json()
        const hosts: string[] = j?.data ?? []
        if (hosts.length) return hosts[0]
      } catch { /* fall through */ }
      return 'https://discoveryprovider.audius.co'
    })()
  }
  return hostPromise
}

async function api<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const host = await audiusHost()
  const url = new URL(`/v1${path}`, host)
  url.searchParams.set('app_name', APP)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`audius ${r.status}`)
  const j = await r.json()
  return (j?.data ?? []) as T[]
}

export interface AudiusTrack {
  id: string
  title: string
  duration: number // seconds
  genre: string | null
  mood: string | null
  release_date: string | null
  play_count: number
  favorite_count: number
  permalink: string
  user: { name: string; handle: string }
  artwork?: { '150x150'?: string; '480x480'?: string; '1000x1000'?: string }
}

export function artworkUrl(t: AudiusTrack): string {
  const a = t.artwork
  return a?.['1000x1000'] ?? a?.['480x480'] ?? a?.['150x150'] ?? ''
}

export async function trending(genre?: string, limit = 40, time: 'week' | 'month' = 'week'): Promise<AudiusTrack[]> {
  const p: Record<string, string | number> = { limit, time }
  if (genre) p.genre = genre
  return api<AudiusTrack>('/tracks/trending', p)
}

export async function underground(limit = 40): Promise<AudiusTrack[]> {
  return api<AudiusTrack>('/tracks/trending/underground', { limit })
}

// Full-catalog /tracks browsing is unreliable on public nodes — build genre feeds
// from trending(week) + trending(month) + search instead.
export async function byGenre(genre: string, limit = 40): Promise<AudiusTrack[]> {
  const [week, month, searched] = await Promise.allSettled([
    trending(genre, limit, 'week'),
    trending(genre, limit, 'month'),
    searchTracks(genre, Math.ceil(limit / 2)),
  ])
  const merged: AudiusTrack[] = []
  const seen = new Set<string>()
  for (const r of [week, month, searched]) {
    if (r.status === 'fulfilled') {
      for (const t of r.value) {
        if (!seen.has(t.id)) { seen.add(t.id); merged.push(t) }
      }
    }
  }
  return merged
}

export async function latest(limit = 40): Promise<AudiusTrack[]> {
  return underground(limit)
}

export async function searchTracks(query: string, limit = 20): Promise<AudiusTrack[]> {
  return api<AudiusTrack>('/tracks/search', { query, limit })
}

// Full-length 320kbps stream — 302s to the actual audio
export function streamUrl(trackId: string): string {
  return `https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=${APP}`
}

// Audius genre labels → canonical
export const AUDIUS_GENRES = [
  'Electronic', 'Rock', 'Metal', 'Hip-Hop/Rap', 'R&B/Soul', 'Jazz',
  'Classical', 'Country', 'Folk', 'Ambient', 'Reggae', 'Latin',
  'Pop', 'Lo-Fi', 'Dubstep', 'Techno', 'House', 'Deep House', 'Disco',
  'Electro', 'Drum & Bass', 'Trap', 'Soundtrack', 'World',
]
