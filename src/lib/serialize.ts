// Shared track serializer — DB row → client shape
export interface TrackDTO {
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
}

type DbTrack = {
  id: string; title: string; artist: string; album: string; genre: string; rawGenre: string
  mood: string; language: string; country: string; year: number; durationMs: number; cover: string
  source: string; sourceId: string
  hasFull: boolean; qualityTier: string; bitrateKbps: number; explicit: boolean
  playCount: number; favoriteCount: number; permalink: string
}

export function trackDTO(t: DbTrack): TrackDTO {
  return {
    id: t.id, title: t.title, artist: t.artist, album: t.album, genre: t.genre,
    rawGenre: t.rawGenre, mood: t.mood, language: t.language, country: t.country,
    year: t.year, durationMs: t.durationMs,
    cover: t.cover, source: t.source, sourceId: t.sourceId, hasFull: t.hasFull,
    qualityTier: t.qualityTier, bitrateKbps: t.bitrateKbps, explicit: t.explicit,
    playCount: t.playCount, favoriteCount: t.favoriteCount, permalink: t.permalink, trackNo: t.trackNo,
  }
}

/** Playlist rows ordered by their stored position. */
export function orderedTracks(
  playlist: { tracks: { trackId: string; position: number }[] | undefined },
): { trackId: string; position: number }[] {
  return [...(playlist?.tracks ?? [])].sort((a, b) => a.position - b.position)
}
