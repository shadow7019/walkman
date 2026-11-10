// Shared client types for Walkman
export interface Track {
  id: string
  title: string
  artist: string
  album: string
  genre: string
  rawGenre: string
  mood: string
  language: string
  country: string
  year: number
  durationMs: number
  cover: string
  source: string
  sourceId: string
  hasFull: boolean
  qualityTier: string
  bitrateKbps: number
  explicit: boolean
  playCount: number
  favoriteCount: number
  permalink: string
  trackNo?: number
}

export interface PlaylistSummary {
  id: string
  name: string
  description: string
  gradient: string
  importedFrom: string
  isSystem: boolean
  trackCount: number
  covers: string[]
  genres: string[]
  createdAt?: string
  updatedAt?: string
}

export interface GenreInfo {
  name: string
  color: string
  count: number
}

export interface LanguageInfo {
  name: string
  count: number
  cover: string
}

export interface ExploreData {
  moods: { name: string; count: number }[]
  trending: Track[]
  newReleases: Track[]
  underground: Track[]
  playlists: PlaylistSummary[]
}

export interface LyricsLine {
  time: number
  text: string
}

export interface LyricsResult {
  plain: string | null
  synced: LyricsLine[] | null
  source: string
}

export interface ReplayStats {
  period: string
  minutes: number
  plays: number
  uniqueTracks: number
  streak: number
  topSongs: { track: Track; plays: number; ms: number }[]
  topArtists: { name: string; plays: number; ms: number }[]
  topAlbums: { name: string; plays: number; ms: number }[]
  hourOfDay: number[]
  activity: { day: string; ms: number; plays: number }[]
}

export interface ImportResult {
  ok: boolean
  playlistId: string
  name: string
  total: number
  matched: number
  notFound: string[]
  skippedOverflow: number
  error?: string
}

export type View =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'explore' }
  | { name: 'genre'; genre: string }
  | { name: 'language'; language: string }
  | { name: 'mood'; mood: string }
  | { name: 'playlist'; id: string }
  | { name: 'liked' }
  | { name: 'history' }
  | { name: 'replay' }
  | { name: 'import' }
  | { name: 'settings' }
  | { name: 'rooms' }
  | { name: 'artist'; artistName: string }

export function fmtTime(ms: number): string {
  if (!ms || ms <= 0) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function fmtMinutes(ms: number): string {
  const min = Math.floor(ms / 60000)
  if (min < 1) return `${Math.round(ms / 1000)}s`
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} hr ${min % 60} min`
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n ?? 0)
}
