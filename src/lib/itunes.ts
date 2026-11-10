// iTunes Search API client — the industry catalog: metadata + 256kbps AAC previews
// Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/

export interface iTunesTrack {
  trackId: number
  trackName: string
  artistName: string
  collectionName: string
  primaryGenreName: string
  releaseDate: string
  trackTimeMillis: number
  previewUrl: string
  artworkUrl100: string
  artworkUrl600?: string
  trackViewUrl: string
  trackExplicitness: string
  collectionId: number
}

export interface iTunesAlbum {
  collectionId: number
  collectionName: string
  artistName: string
  primaryGenreName: string
  releaseDate: string
  trackCount: number
  artworkUrl100: string
  collectionViewUrl?: string
  collectionExplicitness?: string
}

interface SearchResponse {
  resultCount: number
  results: iTunesTrack[]
}

interface AlbumResponse {
  resultCount: number
  results: (iTunesAlbum & { wrapperType?: string; kind?: string })[]
}

export async function itunesSearch(opts: {
  term: string
  limit?: number
  entity?: 'song' | 'album' | 'musicArtist'
  attribute?: string
  country?: string // storefront, e.g. 'US', 'IN', 'KR', 'BR' — unlocks every language
  genre?: boolean
}): Promise<iTunesTrack[]> {
  const p = new URLSearchParams({
    term: opts.term,
    media: 'music',
    entity: opts.entity ?? 'song',
    limit: String(opts.limit ?? 25),
  })
  if (opts.attribute) p.set('attribute', opts.attribute)
  if (opts.country) p.set('country', opts.country)
  const r = await fetch(`https://itunes.apple.com/search?${p}`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`itunes ${r.status}`)
  const j: SearchResponse = await r.json()
  return j.results.filter((t) => t.trackName && t.previewUrl)
}

export function artwork600(t: iTunesTrack): string {
  return t.artworkUrl100?.replace('100x100bb', '600x600bb') ?? ''
}

// Every album for an artist (entity=album). With attribute=artistTerm the term
// must be the artist's name — returns their full discography (max 200).
export async function itunesAlbumSearch(opts: {
  term: string
  limit?: number
  country?: string
  attribute?: string
}): Promise<iTunesAlbum[]> {
  const p = new URLSearchParams({
    term: opts.term,
    media: 'music',
    entity: 'album',
    limit: String(opts.limit ?? 200),
  })
  if (opts.attribute) p.set('attribute', opts.attribute)
  if (opts.country) p.set('country', opts.country)
  const r = await fetch(`https://itunes.apple.com/search?${p}`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`itunes albums ${r.status}`)
  const j: AlbumResponse = await r.json()
  return j.results.filter((a) => a.collectionId && a.collectionName)
}

// Every song on one album (lookup by collectionId) — the complete tracklist.
export async function itunesLookupSongs(collectionId: number, limit = 200): Promise<iTunesTrack[]> {
  const p = new URLSearchParams({
    id: String(collectionId),
    entity: 'song',
    limit: String(limit),
  })
  const r = await fetch(`https://itunes.apple.com/lookup?${p}`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`itunes lookup ${r.status}`)
  const j: SearchResponse = await r.json()
  return j.results
    .filter((t) => (t as unknown as { wrapperType?: string }).wrapperType === 'track' || !!t.previewUrl)
    .filter((t) => t.trackName && t.previewUrl)
}
