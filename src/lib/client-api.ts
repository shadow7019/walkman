// Typed API client (browser side)
import type {
  Track, PlaylistSummary, GenreInfo, ExploreData,
  LyricsResult, ReplayStats, ImportResult,
} from '@/types'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Request failed (${r.status})`)
  }
  return r.json() as Promise<T>
}

export const api = {
  // catalog
  tracks: (params: Record<string, string | number> = {}) =>
    json<{ tracks: Track[]; total: number }>(`/api/tracks?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`),
  track: (id: string) => json<{ track: Track }>(`/api/tracks/${id}`),
  search: (q: string, extend = true) =>
    json<{ tracks: Track[]; extended: number; local: number }>(`/api/search?q=${encodeURIComponent(q)}&extend=${extend ? 1 : 0}`),
  genres: () => json<{ genres: GenreInfo[]; total: number; fullLength: number }>('/api/genres'),
  explore: () => json<ExploreData>('/api/explore'),

  // playlists
  playlists: () => json<{ playlists: PlaylistSummary[] }>('/api/playlists'),
  playlist: (id: string) => json<{ playlist: { id: string; name: string; description: string; gradient: string; importedFrom: string; isSystem: boolean }; tracks: Track[] }>(`/api/playlists/${id}`),
  createPlaylist: (name: string) =>
    json<{ playlist: { id: string; name: string } }>('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  renamePlaylist: (id: string, name: string, description?: string) =>
    json<{ ok: boolean }>(`/api/playlists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) }),
  deletePlaylist: (id: string) => json<{ ok: boolean }>(`/api/playlists/${id}`, { method: 'DELETE' }),
  addToPlaylist: (id: string, trackId: string) =>
    json<{ ok: boolean }>(`/api/playlists/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId }) }),
  removeFromPlaylist: (id: string, trackId: string) =>
    json<{ ok: boolean }>(`/api/playlists/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeTrackId: trackId }) }),

  // likes / history
  liked: () => json<{ tracks: Track[] }>('/api/likes'),
  toggleLike: (trackId: string) =>
    json<{ liked: boolean }>('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId }) }),
  history: () => json<{ tracks: Track[] }>('/api/history'),
  recordPlay: (trackId: string, msPlayed: number, completed: boolean) =>
    json<{ ok: boolean }>('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId, msPlayed, completed }) }).catch(() => ({ ok: false })),

  // stats
  stats: (period: string) => json<ReplayStats>(`/api/stats?period=${period}`),

  // sync
  syncStatus: () => json<{ logs: { id: string; source: string; scope: string; fetched: number; added: number; updated: number; syncedAt: string }[]; total: number; lastSyncedAt: string | null }>('/api/sync'),
  runSync: () =>
    json<{ ok: boolean; added: number; updated: number; total: number }>('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }),

  // lyrics / radio / import
  lyrics: (title: string, artist: string, durationSec?: number) =>
    json<LyricsResult>(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}${durationSec ? `&durationSec=${Math.round(durationSec)}` : ''}`),
  radio: (seedTrackId: string) =>
    json<{ seed: Track; tracks: Track[] }>('/api/radio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seedTrackId }) }),
  importSpotify: (url: string) =>
    json<ImportResult>('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'spotify', url }) }),
  importText: (text: string, order: 'artist-first' | 'title-first' = 'artist-first') =>
    json<ImportResult>('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'text', text, order }) }),
  importCSV: (text: string) =>
    json<ImportResult>('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'csv', text }) }),

  streamUrl: (id: string) => `/api/stream/${id}`,
  downloadUrl: (id: string) => `/api/download/${id}`,
}
