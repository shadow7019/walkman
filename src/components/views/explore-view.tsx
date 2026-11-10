'use client'

// Explore: moods, trending, new releases, underground, genre grid.
// Genre / Mood / Artist collection pages.
import { useCallback, useEffect, useState } from 'react'
import { Play, Shuffle, ArrowLeft } from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/client-api'
import { TrackList } from '@/components/track-list'
import { SectionRow } from '@/components/track-list'
import { TrackCard, GenreTile, LanguageTile, SectionHeader } from '@/components/views/cards'
import { SkeletonRow } from '@/components/views/home-view'
import { GENRE_COLORS } from '@/lib/genre'
import type { ExploreData, Track } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function ExploreView() {
  const { navigate } = useUI()
  const [data, setData] = useState<ExploreData | null>(null)
  const [genres, setGenres] = useState<{ name: string; color: string; count: number }[]>([])
  const [languages, setLanguages] = useState<{ name: string; count: number; cover: string }[]>([])

  useEffect(() => {
    Promise.allSettled([api.explore(), api.genres(), api.languages()]).then(([e, g, l]) => {
      if (e.status === 'fulfilled') setData(e.value)
      if (g.status === 'fulfilled') setGenres(g.value.genres.filter((x) => x.count > 0))
      if (l.status === 'fulfilled') setLanguages(l.value.languages.filter((x) => x.count > 0))
    })
  }, [])

  if (!data) {
    return (
      <div className="space-y-8 pb-4">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-4">
      {data.moods.length > 0 && (
        <section aria-label="Moods">
          <SectionHeader title="Moods" subtitle="Pick a vibe" />
          <div className="flex flex-wrap gap-2">
            {data.moods.map((m) => (
              <button
                key={m.name}
                onClick={() => navigate({ name: 'mood', mood: m.name })}
                className="rounded-full border border-border/60 bg-black/30 px-4 py-2 text-sm transition-colors hover:bg-white/10"
              >
                {m.name} <span className="text-xs text-muted-foreground">{m.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.trending.length > 0 && (
        <section aria-label="Trending">
          <SectionHeader title="Trending" subtitle="What listeners love right now — full-length HI-FI" />
          <SectionRow ariaLabel="Trending tracks">
            {data.trending.map((t) => (
              <TrackCard key={t.id} track={t} list={data.trending} contextTitle="Trending" />
            ))}
          </SectionRow>
        </section>
      )}

      {data.newReleases.length > 0 && (
        <section aria-label="New releases">
          <SectionHeader title="New releases" subtitle="Auto-added to your catalog" />
          <SectionRow ariaLabel="New releases">
            {data.newReleases.map((t) => (
              <TrackCard key={t.id} track={t} list={data.newReleases} contextTitle="New releases" />
            ))}
          </SectionRow>
        </section>
      )}

      {data.underground.length > 0 && (
        <section aria-label="Underground">
          <SectionHeader title="Underground gems" subtitle="Independent artists worth discovering" />
          <SectionRow ariaLabel="Underground">
            {data.underground.map((t) => (
              <TrackCard key={t.id} track={t} list={data.underground} contextTitle="Underground gems" />
            ))}
          </SectionRow>
        </section>
      )}

      {languages.length > 0 && (
        <section aria-label="Around the world">
          <SectionHeader title="Around the world" subtitle="Every language, real songs from every scene" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {languages.slice(0, 18).map((l) => <LanguageTile key={l.name} language={l} />)}
          </div>
        </section>
      )}

      <section aria-label="All genres">
        <SectionHeader title="Genres" subtitle="Every corner of the music industry" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {genres.map((g) => <GenreTile key={g.name} genre={g} />)}
        </div>
      </section>
    </div>
  )
}

// ---------- shared collection page pieces ----------

function CollectionHero({ title, subtitle, gradient, tracks, contextTitle, badge }: {
  title: string
  subtitle?: string
  gradient: string
  tracks: Track[]
  contextTitle: string
  badge?: string
}) {
  const { playQueue } = usePlayer()
  const canPlay = tracks.length > 0
  return (
    <div className="relative -mx-4 -mt-2 mb-6 overflow-hidden px-4 pt-10 pb-6 md:-mx-6 md:px-6">
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', gradient)} aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 to-transparent" aria-hidden />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          {badge && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">{badge}</p>}
          <h1 className="text-3xl font-black tracking-tight drop-shadow-md sm:text-4xl lg:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{tracks.length} songs</p>
          <div className="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              className="gap-2 bg-emerald-500 text-black hover:bg-emerald-400"
              disabled={!canPlay}
              onClick={() => playQueue(tracks, 0, contextTitle)}
              aria-label={`Play ${title}`}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden /> Play
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-white/20"
              disabled={!canPlay}
              onClick={() => {
                const sh = [...tracks].sort(() => Math.random() - 0.5)
                playQueue(sh, 0, contextTitle)
              }}
              aria-label={`Shuffle ${title}`}
            >
              <Shuffle className="h-4 w-4" aria-hidden /> Shuffle
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BackButton() {
  const { back, canBack } = useUI()
  return (
    <button
      onClick={() => canBack() && back()}
      className={cn('mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground', !canBack() && 'invisible')}
      aria-label="Go back"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
    </button>
  )
}

export function GenreView({ genre }: { genre: string }) {
  const [data, setData] = useState<{ genre: string; tracks: Track[]; extending: boolean } | null>(null)

  // derive per-genre state so switching genres never shows stale tracks
  const tracks = data && data.genre === genre ? data.tracks : null
  const extending = !!data && data.genre === genre && data.extending

  useEffect(() => {
    let alive = true
    api.tracks({ genre, limit: 100, sort: 'plays' })
      .catch(() => ({ tracks: [] as Track[] }))
      .then(async (r) => {
        if (!alive) return
        setData({ genre, tracks: r.tracks, extending: false })
        if (r.tracks.length < 10) {
          // too few locally — extend the catalog from industry sources, then refetch
          setData({ genre, tracks: r.tracks, extending: true })
          await api.search(genre).catch(() => {})
          const r2 = await api.tracks({ genre, limit: 100, sort: 'plays' }).catch(() => ({ tracks: [] as Track[] }))
          if (!alive) return
          setData({ genre, tracks: r2.tracks, extending: false })
        }
      })
    return () => { alive = false }
  }, [genre])

  if (!tracks) return <div className="py-8"><SkeletonRow /></div>

  return (
    <div className="pb-4">
      <BackButton />
      <CollectionHero
        title={genre}
        subtitle={extending ? 'Exploring the industry catalog for more…' : 'The best of the genre from across the industry'}
        gradient={GENRE_COLORS[genre] ?? 'from-emerald-500 to-teal-700'}
        tracks={tracks}
        contextTitle={`${genre} genre`}
        badge="Genre"
      />
      <TrackList tracks={tracks} contextTitle={`${genre} genre`} />
    </div>
  )
}

export function LanguageView({ language }: { language: string }) {
  const [tracks, setTracks] = useState<Track[] | null>(null)

  useEffect(() => {
    let alive = true
    api.tracks({ language, limit: 100, sort: 'plays' })
      .then((r) => { if (alive) setTracks(r.tracks) })
      .catch(() => { if (alive) setTracks([]) })
    return () => { alive = false }
  }, [language])

  if (!tracks) return <div className="py-8"><SkeletonRow /></div>

  return (
    <div className="pb-4">
      <BackButton />
      <CollectionHero
        title={language}
        subtitle="Real songs in this language, from across the industry"
        gradient="from-emerald-500 to-teal-800"
        tracks={tracks}
        contextTitle={`${language} music`}
        badge="Language"
      />
      <TrackList tracks={tracks} contextTitle={`${language} music`} />
    </div>
  )
}

export function MoodView({ mood }: { mood: string }) {
  const [tracks, setTracks] = useState<Track[] | null>(null)
  useEffect(() => {
    api.tracks({ mood, limit: 100, sort: 'plays' }).then((r) => setTracks(r.tracks)).catch(() => setTracks([]))
  }, [mood])
  if (!tracks) return <div className="py-8"><SkeletonRow /></div>
  return (
    <div className="pb-4">
      <BackButton />
      <CollectionHero
        title={mood}
        subtitle="Songs matching this vibe"
        gradient="from-teal-500 to-emerald-800"
        tracks={tracks}
        contextTitle={`${mood} mood`}
        badge="Mood"
      />
      <TrackList tracks={tracks} contextTitle={`${mood} mood`} />
    </div>
  )
}

export function ArtistView({ artistName }: { artistName: string }) {
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const [related, setRelated] = useState<Track[]>([])

  useEffect(() => {
    api.tracks({ q: artistName, limit: 80, sort: 'plays' }).then((r) => {
      const q = artistName.toLowerCase()
      const own = r.tracks.filter((t) => {
        const a = t.artist.toLowerCase()
        return a === q || a.includes(q) || q.includes(a)
      })
      setTracks(own)
      // related: same genres as the artist's most common genre
      const genres = new Map<string, number>()
      for (const t of own) genres.set(t.genre, (genres.get(t.genre) ?? 0) + 1)
      const topGenre = [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      if (topGenre) {
        api.tracks({ genre: topGenre, limit: 24, sort: 'plays' }).then((r2) => {
          setRelated(r2.tracks.filter((t) => t.artist.toLowerCase() !== q).slice(0, 12))
        }).catch(() => {})
      }
    }).catch(() => setTracks([]))
  }, [artistName])

  if (!tracks) return <div className="py-8"><SkeletonRow /></div>

  const popular = [...tracks].sort((a, b) => (b.hasFull ? 1 : 0) - (a.hasFull ? 1 : 0) || b.playCount - a.playCount)

  return (
    <div className="pb-4">
      <BackButton />
      <CollectionHero
        title={artistName}
        subtitle="Artist"
        gradient="from-zinc-500 to-zinc-800"
        tracks={popular}
        contextTitle={artistName}
        badge="Artist"
      />
      <SectionHeader title="Popular" />
      <TrackList tracks={popular.slice(0, 30)} contextTitle={artistName} showAlbum />
      {related.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Fans also like" />
          <SectionRow ariaLabel="Related artists">
            {related.map((t) => (
              <TrackCard key={t.id} track={t} list={related} contextTitle={`Related to ${artistName}`} />
            ))}
          </SectionRow>
        </div>
      )}
    </div>
  )
}
