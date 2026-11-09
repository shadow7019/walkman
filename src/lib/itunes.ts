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

interface SearchResponse {
  resultCount: number
  results: iTunesTrack[]
}

export async function itunesSearch(opts: {
  term: string
  limit?: number
  entity?: 'song' | 'album' | 'musicArtist'
  attribute?: string
  genre?: boolean
}): Promise<iTunesTrack[]> {
  const p = new URLSearchParams({
    term: opts.term,
    media: 'music',
    entity: opts.entity ?? 'song',
    limit: String(opts.limit ?? 25),
  })
  if (opts.attribute) p.set('attribute', opts.attribute)
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
