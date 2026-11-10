'use client'

// Home: greeting, quick picks, taste mixes (Made for you), jump back in,
// new-for-you (auto-added songs), trending full-length, genre chips, playlists.
import { useEffect, useState } from 'react'
import { Heart, Play } from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useLibrary } from '@/stores/library'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/client-api'
import { Cover } from '@/components/cover'
import { TrackCard, MixCard, PlaylistCard, GenreTile, LanguageTile, SectionHeader } from '@/components/views/cards'
import { SectionRow } from '@/components/track-list'
import type { Track, GenreInfo, ReplayStats } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface TasteData {
  topGenres: string[]
  topArtist: string | null
  mixes: { id: string; title: string; subtitle: string; tracks: Track[] }[]
  catalogSize: number
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late?'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomeView() {
  const { playPause } = usePlayer()
  const { history, playlists } = useLibrary()
  const { navigate } = useUI()

  const [newForYou, setNewForYou] = useState<Track[]>([])
  const [trending, setTrending] = useState<Track[]>([])
  const [genres, setGenres] = useState<GenreInfo[]>([])
  const [languages, setLanguages] = useState<{ name: string; count: number; cover: string }[]>([])
  const [taste, setTaste] = useState<TasteData | null>(null)
  const [stats, setStats] = useState<ReplayStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api.tracks({ sort: 'recent', limit: 14 }),
      api.tracks({ hasFull: '1', sort: 'plays', limit: 14 }),
      api.genres(),
      api.languages(),
      fetch('/api/taste').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api.stats('month'),
    ]).then(([n, t, g, l, ta, st]) => {
      if (!alive) return
      if (n.status === 'fulfilled') setNewForYou(n.value.tracks)
      if (t.status === 'fulfilled') setTrending(t.value.tracks)
      if (g.status === 'fulfilled') setGenres(g.value.genres.filter((x) => x.count > 0).slice(0, 8))
      if (l.status === 'fulfilled') setLanguages(l.value.languages.filter((x) => x.count > 0))
      if (ta.status === 'fulfilled') setTaste(ta.value as TasteData | null)
      if (st.status === 'fulfilled') setStats(st.value)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  // quick picks: liked + top genres + first playlist
  const quickPicks: { label: string; gradient: string; onClick: () => void; icon?: string; covers?: string[] }[] = [
    { label: 'Liked Songs', gradient: 'from-rose-500 to-red-700', icon: 'heart', onClick: () => navigate({ name: 'liked' }) },
    ...genres.slice(0, 3).map((g) => ({
      label: g.name,
      gradient: g.color,
      onClick: () => navigate({ name: 'genre', genre: g.name }),
    })),
    ...(playlists[0] ? [{
      label: playlists[0].name,
      gradient: playlists[0].gradient,
      covers: playlists[0].covers,
      onClick: () => navigate({ name: 'playlist', id: playlists[0].id }),
    }] : []),
    { label: 'Explore', gradient: 'from-emerald-500 to-teal-700', onClick: () => navigate({ name: 'explore' }) },
  ].slice(0, 6)

  return (
    <div className="space-y-8 pb-4">
      <section aria-label="Greeting and quick picks">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting()}</h1>
          {stats && stats.minutes > 0 && (
            <button
              onClick={() => navigate({ name: 'replay' })}
              className="rounded-full border border-[#1db954]/40 px-3 py-1 text-xs text-[#1ed760] hover:bg-[#1db954]/10"
            >
              You listened {stats.minutes.toLocaleString()} min this month — Replay
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3">
          {quickPicks.map((q) => (
            <button
              key={q.label}
              onClick={q.onClick}
              className="group flex items-center gap-2 overflow-hidden rounded-lg bg-white/5 pr-3 text-left transition-colors hover:bg-white/10 sm:gap-3 sm:pr-4"
            >
              {q.icon === 'heart' ? (
                <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center bg-gradient-to-br sm:h-16 sm:w-16', q.gradient)}>
                  <Heart className="h-5 w-5 fill-white text-white sm:h-6 sm:w-6" aria-hidden />
                </div>
              ) : q.covers?.length ? (
                <Cover src={q.covers[0]} alt="" className="h-12 w-12 shrink-0 sm:h-16 sm:w-16" rounded="rounded-none" />
              ) : (
                <div className={cn('h-12 w-12 shrink-0 bg-gradient-to-br sm:h-16 sm:w-16', q.gradient)} aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">{q.label}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1db954] text-black opacity-0 shadow-lg transition-all group-hover:opacity-100 sm:h-9 sm:w-9">
                <Play className="h-4 w-4 fill-current" aria-hidden />
              </span>
            </button>
          ))}
        </div>
      </section>

      {taste && taste.mixes.length > 0 && (
        <section aria-label="Made for you">
          <SectionHeader
            title="Made for you"
            subtitle={taste.topGenres.length ? `Because you listen to ${taste.topGenres.slice(0, 2).join(' & ')}` : 'Personal mixes from your taste profile'}
          />
          <SectionRow ariaLabel="Personal mixes">
            {taste.mixes.map((m) => (
              <MixCard key={m.id} title={m.title} subtitle={m.subtitle} tracks={m.tracks} />
            ))}
          </SectionRow>
        </section>
      )}

      {history.length > 0 && (
        <section aria-label="Jump back in">
          <SectionHeader title="Jump back in" />
          <SectionRow ariaLabel="Recently played">
            {history.slice(0, 12).map((t) => (
              <TrackCard key={t.id} track={t} list={history.slice(0, 12)} contextTitle="Jump back in" />
            ))}
          </SectionRow>
        </section>
      )}

      <section aria-label="New for you">
        <SectionHeader title="New for you" subtitle="Auto-added from the industry catalog" />
        {loading ? (
          <SkeletonRow />
        ) : newForYou.length > 0 ? (
          <SectionRow ariaLabel="New songs">
            {newForYou.map((t) => (
              <TrackCard key={t.id} track={t} list={newForYou} contextTitle="New for you" />
            ))}
          </SectionRow>
        ) : (
          <p className="text-sm text-muted-foreground">Syncing new songs — check back shortly.</p>
        )}
      </section>

      {trending.length > 0 && (
        <section aria-label="Trending full-length">
          <SectionHeader title="Trending now" subtitle="Full-length, highest quality" />
          <SectionRow ariaLabel="Trending">
            {trending.map((t) => (
              <TrackCard key={t.id} track={t} list={trending} contextTitle="Trending now" />
            ))}
          </SectionRow>
        </section>
      )}

      {languages.length > 0 && (
        <section aria-label="Around the world">
          <SectionHeader
            title="Around the world"
            subtitle="Real songs in every language"
            action={<Button variant="ghost" size="sm" onClick={() => navigate({ name: 'explore' })}>See all</Button>}
          />
          <SectionRow ariaLabel="Languages">
            {languages.map((l) => <LanguageTile key={l.name} language={l} size="sm" />)}
          </SectionRow>
        </section>
      )}

      {genres.length > 0 && (
        <section aria-label="Your genres">
          <SectionHeader title="Browse genres" action={<Button variant="ghost" size="sm" onClick={() => navigate({ name: 'explore' })}>See all</Button>} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {genres.map((g) => <GenreTile key={g.name} genre={g} />)}
          </div>
        </section>
      )}

      {playlists.length > 0 && (
        <section aria-label="Your playlists">
          <SectionHeader title="Your playlists" />
          <SectionRow ariaLabel="Playlists">
            {playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
          </SectionRow>
        </section>
      )}
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="w-40 shrink-0 sm:w-44">
          <div className="aspect-square w-full animate-pulse rounded-md bg-white/10" />
          <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  )
}
