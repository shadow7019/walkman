'use client'

// Search: recent searches, browse-all genre tiles, live results with
// top-result hero + songs + artist chips; auto-extends the industry catalog.
import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Search, X, Clock, PlusCircle, Loader2 } from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/client-api'
import { Cover } from '@/components/cover'
import { TrackList, SectionRow } from '@/components/track-list'
import { GenreTile, SectionHeader } from '@/components/views/cards'
import { SkeletonRow } from '@/components/views/home-view'
import type { Track, GenreInfo } from '@/types'
import { fmtTime } from '@/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function SearchView() {
  const { searchQuery, setSearchQuery, recentSearches, addRecentSearch, clearRecentSearches, navigate } = useUI()
  const { playQueue, playPause, queue, queueIndex, isPlaying } = usePlayer()
  const [results, setResults] = useState<Track[]>([])
  const [extended, setExtended] = useState(0)
  const [loading, setLoading] = useState(false)
  const [genres, setGenres] = useState<GenreInfo[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.genres().then((g) => setGenres(g.genres.filter((x) => x.count > 0))).catch(() => {})
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = searchQuery.trim()
    if (!q) { setResults([]); setExtended(0); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.search(q)
        setResults(r.tracks)
        setExtended(r.extended)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  const top = results[0]
  const songs = results.slice(0, 10)
  const more = results.slice(10, 26)
  const artists = [...new Set(results.map((t) => t.artist))].slice(0, 10)

  // Empty state: recent searches + browse all
  if (!searchQuery.trim()) {
    return (
      <div className="space-y-8 pb-4">
        {recentSearches.length > 0 && (
          <section aria-label="Recent searches">
            <SectionHeader
              title="Recent searches"
              action={
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={clearRecentSearches}>
                  Clear
                </button>
              }
            />
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((q) => (
                <button
                  key={q}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-black/30 px-3 py-1.5 text-sm hover:bg-white/5"
                  onClick={() => setSearchQuery(q)}
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}
        <section aria-label="Browse all">
          <SectionHeader title="Browse all" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {genres.map((g) => <GenreTile key={g.name} genre={g} />)}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          Results for <span className="text-emerald-400">“{searchQuery.trim()}”</span>
        </h1>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Searching" />}
          {extended > 0 && !loading && (
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
              <PlusCircle className="mr-1 h-3 w-3" aria-hidden /> +{extended} added to catalog
            </Badge>
          )}
          <button aria-label="Clear search" className="rounded-full p-2 hover:bg-white/10" onClick={() => setSearchQuery('')}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {!loading && results.length === 0 && (
        <div className="py-16 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden />
          <p className="text-sm text-muted-foreground">
            No matches for “{searchQuery.trim()}”.
            <br />Try a different spelling — the industry catalog extends on every search.
          </p>
        </div>
      )}

      {loading && results.length === 0 && (
        <div className="space-y-6">
          <SkeletonRow />
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-white/5" />)}</div>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Top result hero + songs */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {top && (
              <section aria-label="Top result">
                <SectionHeader title="Top result" />
                <button
                  className="group relative flex h-full w-full flex-col justify-between gap-4 rounded-xl border border-border/50 bg-black/30 p-5 text-left transition-colors hover:bg-white/5"
                  onClick={() => {
                    if (queue[queueIndex]?.id === top.id) { playPause(); return }
                    playQueue([top, ...more], 0, `Search: ${searchQuery.trim()}`)
                    addRecentSearch(searchQuery.trim())
                  }}
                >
                  <Cover src={top.cover} alt={`${top.title} cover`} className="h-24 w-24 shadow-xl" rounded="rounded-lg" />
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-bold">{top.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Song · <span className="hover:underline">{top.artist}</span>
                      {top.hasFull && <span className="ml-2 rounded border border-emerald-500/50 px-1 text-[10px] font-semibold text-emerald-400">HI-FI</span>}
                    </div>
                  </div>
                  <span className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black opacity-0 shadow-xl transition-all group-hover:opacity-100">
                    {queue[queueIndex]?.id === top.id && isPlaying ? <Pause className="h-5 w-5 fill-current" aria-hidden /> : <Play className="h-5 w-5 fill-current translate-x-[1px]" aria-hidden />}
                  </span>
                </button>
              </section>
            )}
            <section aria-label="Songs">
              <SectionHeader title="Songs" />
              <TrackList tracks={songs} contextTitle={`Search: ${searchQuery.trim()}`} showAlbum={false} />
            </section>
          </div>

          {artists.length > 1 && (
            <section aria-label="Artists">
              <SectionHeader title="Artists" />
              <SectionRow ariaLabel="Artists">
                {artists.map((a) => {
                  const cover = results.find((t) => t.artist === a)?.cover
                  return (
                    <button
                      key={a}
                      role="listitem"
                      className="w-32 shrink-0 rounded-lg p-3 text-center transition-colors hover:bg-white/5"
                      onClick={() => navigate({ name: 'artist', artistName: a })}
                    >
                      <Cover src={cover} alt="" className="mx-auto mb-2 h-24 w-24" rounded="rounded-full" />
                      <div className="truncate text-sm font-medium">{a}</div>
                      <div className="text-xs text-muted-foreground">Artist</div>
                    </button>
                  )
                })}
              </SectionRow>
            </section>
          )}

          {more.length > 0 && (
            <section aria-label="More results">
              <SectionHeader title="More" subtitle="Everything else the catalog found" />
              <TrackList tracks={more} contextTitle={`Search: ${searchQuery.trim()}`} showAlbum />
            </section>
          )}
        </>
      )}
    </div>
  )
}
