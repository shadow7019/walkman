// Spotify catalog sync — reads Spotify's official charts & editorial playlists
// through the public, no-auth embed endpoint and turns every song into a real,
// playable library track (metadata + Spotify's own MP3 preview + iTunes match
// for cover art / 256 kbps AAC previews).
//
// This is how "Spotify auto-add" works: every catalog sync pulls the freshest
// edition of these playlists so the library keeps up with Spotify's charts.
export interface SpotifyTrackEntry {
  trackId: string
  title: string
  artist: string
  durationMs: number
  previewUrl: string
}

export interface SpotifyPlaylistData {
  id: string
  name: string
  description: string
  tracks: SpotifyTrackEntry[]
}

export interface SpotifyAutoPlaylist {
  id: string
  label: string
  genre: string
  language: string
  country?: string
}

// Official Spotify charts + editorial playlists (verified live against the
// embed endpoint). Charts refresh daily, so every sync brings brand-new songs.
export const SPOTIFY_AUTO_PLAYLISTS: SpotifyAutoPlaylist[] = [
  { id: '37i9dQZEVXbNG2KDcFcKOF', label: 'Top Songs - Global', genre: 'Pop', language: 'English' },
  { id: '37i9dQZF1DXcBWIGoYBM5M', label: "Today's Top Hits", genre: 'Pop', language: 'English' },
  { id: '37i9dQZF1DX4JAvHpjipBk', label: 'New Music Friday', genre: 'Pop', language: 'English' },
  { id: '37i9dQZF1DX0XUsuxWHRQd', label: 'RapCaviar', genre: 'Hip-Hop', language: 'English' },
  { id: '37i9dQZF1DX4dyzvuaRJ0n', label: 'mint', genre: 'Electronic', language: 'English' },
  { id: '37i9dQZF1DX76Wlfdnj7AP', label: 'Beast Mode', genre: 'Electronic', language: 'English' },
  { id: '37i9dQZF1DWXRqgorJj26U', label: 'Rock Classics', genre: 'Rock', language: 'English' },
  { id: '37i9dQZF1DX1lVhptIYRda', label: 'Hot Country', genre: 'Country', language: 'English' },
  { id: '37i9dQZF1DX10zKzsJ2jva', label: 'Viva Latino', genre: 'Latin', language: 'Spanish' },
  { id: '37i9dQZF1DX9tPFwDMOaN1', label: 'K-Pop ON!', genre: 'K-Pop', language: 'Korean', country: 'KR' },
  { id: '37i9dQZEVXbKqiTGXuCOsB', label: 'Top Songs - Japan', genre: 'J-Pop', language: 'Japanese', country: 'JP' },
  { id: '37i9dQZF1DX4o1oenSJRJd', label: 'All Out 2000s', genre: 'Pop', language: 'English' },
  { id: '37i9dQZF1DWTJ7xPn4vNaz', label: 'All Out 70s', genre: 'Rock', language: 'English' },
  { id: '37i9dQZF1DX4sWSpwq3LiO', label: 'Peaceful Piano', genre: 'Classical', language: 'Instrumental' },
  { id: '37i9dQZF1DWWMOmoXKqHTD', label: 'Songs to Sing in the Car', genre: 'Pop', language: 'English' },
  { id: '37i9dQZF1DXbYM3nMM0oPk', label: 'Mega Hit Mix', genre: 'Pop', language: 'English' },
]

// Flagships used by the automatic (refresh) sync — fast, highest-signal charts.
export const SPOTIFY_FLAGSHIP: SpotifyAutoPlaylist[] = [
  SPOTIFY_AUTO_PLAYLISTS[0], // Top Songs - Global
  SPOTIFY_AUTO_PLAYLISTS[1], // Today's Top Hits
  SPOTIFY_AUTO_PLAYLISTS[2], // New Music Friday
  SPOTIFY_AUTO_PLAYLISTS[8], // Viva Latino
]

interface RawEmbedTrack {
  uri?: string
  title?: string
  name?: string // older embed schema
  subtitle?: string
  artist?: string // older embed schema
  duration?: number
  audioPreview?: { url?: string } | null
}

interface EmbedEntity {
  name?: string
  description?: string
  trackList?: RawEmbedTrack[]
}

// The embed page schema has changed over time; accept both `title/subtitle`
// and `name/artist` variants so imports and syncs never go blind.
export function extractSpotifyTracks(entity: EmbedEntity | undefined | null): SpotifyTrackEntry[] {
  const out: SpotifyTrackEntry[] = []
  for (const t of entity?.trackList ?? []) {
    const title = (t.title ?? t.name ?? '').trim()
    const artistRaw = (t.subtitle ?? t.artist ?? '').trim()
    if (!title) continue
    const uri = t.uri ?? ''
    const trackId = uri.startsWith('spotify:track:') ? uri.split(':')[2] : uri
    out.push({
      trackId,
      title,
      artist: artistRaw.split(/[,&]/)[0].trim() || artistRaw,
      durationMs: typeof t.duration === 'number' ? t.duration : 0,
      previewUrl: t.audioPreview?.url ?? '',
    })
  }
  return out
}

// Fetch a public Spotify playlist (charts, editorial, user playlists) with no
// auth via the embed page's embedded JSON.
export async function fetchSpotifyPlaylistData(playlistId: string): Promise<SpotifyPlaylistData> {
  const r = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(`Spotify returned ${r.status}`)
  const html = await r.text()
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/)
  if (!m) throw new Error('Could not read Spotify playlist data')
  const data = JSON.parse(m[1]) as {
    props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } }
  }
  const entity = data?.props?.pageProps?.state?.data?.entity
  const tracks = extractSpotifyTracks(entity)
  if (!tracks.length) throw new Error('Spotify playlist has no readable tracks')
  return {
    id: playlistId,
    name: entity?.name || 'Spotify Playlist',
    description: entity?.description || '',
    tracks,
  }
}
