'use client'

// Replay — listening statistics: minutes, plays, streak, top songs/artists/albums,
// hour-of-day and 28-day activity charts (ByTune feature).
import { useEffect, useState } from 'react'
import { usePlayer } from '@/stores/player'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/client-api'
import { TrackList } from '@/components/track-list'
import { SectionHeader, StatTile } from '@/components/views/cards'
import { SkeletonRow } from '@/components/views/home-view'
import { Cover } from '@/components/cover'
import type { ReplayStats } from '@/types'
import { fmtMinutes } from '@/types'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
] as const

export function ReplayView() {
  const { playQueue } = usePlayer()
  const { navigate } = useUI()
  const [period, setPeriod] = useState<string>('month')
  const [stats, setStats] = useState<ReplayStats | null>(null)
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)
  const loading = loadedPeriod !== period

  useEffect(() => {
    let alive = true
    api.stats(period)
      .then((s) => { if (alive) { setStats(s); setLoadedPeriod(period) } })
      .catch(() => { if (alive) setLoadedPeriod(period) })
    return () => { alive = false }
  }, [period])

  if (loading && !stats) return <div className="py-8"><SkeletonRow /></div>
  if (!stats) return <p className="py-10 text-sm text-muted-foreground">Could not load stats. Try again later.</p>

  const empty = stats.plays === 0
  const maxHour = Math.max(...stats.hourOfDay, 1)
  const peakHour = stats.hourOfDay.indexOf(Math.max(...stats.hourOfDay))
  const maxDay = Math.max(...stats.activity.map((d) => d.ms), 1)

  return (
    <div className="space-y-8 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Replay</h1>
          <p className="text-sm text-muted-foreground">Your listening, counted.</p>
        </div>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {empty ? (
        <div className="rounded-xl border border-border/50 bg-black/30 p-10 text-center">
          <p className="text-sm font-medium">No listening recorded for this period.</p>
          <p className="mt-1 text-xs text-muted-foreground">Play some songs (30s or more) and your stats will appear here.</p>
          <button className="mt-4 rounded-full bg-[#1db954] px-4 py-2 text-sm font-semibold text-black hover:bg-[#1ed760]" onClick={() => navigate({ name: 'home' })}>
            Find something to play
          </button>
        </div>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Minutes listened" value={stats.minutes.toLocaleString()} accent />
            <StatTile label="Plays" value={stats.plays.toLocaleString()} />
            <StatTile label="Unique songs" value={stats.uniqueTracks.toLocaleString()} />
            <StatTile label="Listening streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
          </section>

          <section aria-label="Top songs">
            <SectionHeader title="Top songs" subtitle={periodLabel(period)} />
            <TrackList
              tracks={stats.topSongs.map((s) => s.track)}
              contextTitle={`Top songs — ${periodLabel(period)}`}
              showAlbum={false}
              onPlayIndex={(i) => playQueue(stats.topSongs.map((s) => s.track), i, 'Top songs')}
            />
          </section>

          <section aria-label="Top artists">
            <SectionHeader title="Top artists" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {stats.topArtists.slice(0, 10).map((a, i) => (
                <button
                  key={a.name}
                  className="rounded-xl border border-border/50 bg-black/30 p-4 text-left transition-colors hover:bg-white/5"
                  onClick={() => navigate({ name: 'artist', artistName: a.name })}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-[#1ed760]/80 tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{fmtMinutes(a.ms)} · {a.plays} plays</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {stats.topAlbums.length > 0 && (
            <section aria-label="Top albums">
              <SectionHeader title="Top albums" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {stats.topAlbums.map((al) => (
                  <div key={al.name} className="rounded-xl border border-border/50 bg-black/30 p-4">
                    <div className="truncate text-sm font-semibold">{al.name}</div>
                    <div className="text-xs text-muted-foreground">{al.plays} plays · {fmtMinutes(al.ms)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-label="When you listen" className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border/50 bg-black/30 p-5">
              <h3 className="text-sm font-semibold">Hour of day</h3>
              <p className="text-xs text-muted-foreground">You listen most around {peakHour}:00</p>
              <div className="mt-4 flex h-28 items-end gap-1" aria-hidden>
                {stats.hourOfDay.map((ms, h) => (
                  <div
                    key={h}
                    title={`${h}:00 — ${fmtMinutes(ms)}`}
                    className={cn('flex-1 rounded-t bg-gradient-to-t from-emerald-700/60 to-emerald-400', h === peakHour && 'from-emerald-400 to-emerald-200')}
                    style={{ height: `${Math.max((ms / maxHour) * 100, 2)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-black/30 p-5">
              <h3 className="text-sm font-semibold">Last 28 days</h3>
              <p className="text-xs text-muted-foreground">Minutes listened per day</p>
              <div className="mt-4 flex h-28 items-end gap-[3px]" aria-hidden>
                {stats.activity.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day} — ${fmtMinutes(d.ms)} (${d.plays} plays)`}
                    className={cn('flex-1 rounded-t bg-gradient-to-t from-emerald-800/60 to-emerald-500', d.ms === 0 && 'bg-white/10 from-white/10 to-white/10')}
                    style={{ height: `${Math.max((d.ms / maxDay) * 100, 3)}%` }}
                  />
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function periodLabel(p: string) {
  return PERIODS.find((x) => x.value === p)?.label ?? p
}

// TopSongs with covers variant (kept minimal)
export function TopSongCard({ track }: { track: ReplayStats['topSongs'][number]['track'] }) {
  return (
    <div className="flex items-center gap-3">
      <Cover src={track.cover} alt="" className="h-10 w-10" />
      <div className="min-w-0">
        <div className="truncate text-sm">{track.title}</div>
        <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
      </div>
    </div>
  )
}
