'use client'

// Settings: playback (autoplay, crossfade, speed, skip silence), 10-band equalizer,
// quality tiers, catalog sync, sleep timer, keyboard shortcuts.
import { useEffect, useState } from 'react'
import { usePlayer } from '@/stores/player'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/client-api'
import { EQ_BANDS, EQ_PRESETS, EQ_MIN, EQ_MAX } from '@/lib/audio-graph'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Database, Keyboard, Timer, SlidersHorizontal } from 'lucide-react'

interface SyncStatus {
  logs: { id: string; source: string; scope: string; fetched: number; added: number; updated: number; syncedAt: string }[]
  total: number
  lastSyncedAt: string | null
}

export function SettingsView() {
  const player = usePlayer()
  const { toast } = useUI()
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [genres, setGenres] = useState<{ total: number; fullLength: number } | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    api.syncStatus().then(setSync).catch(() => {})
    api.genres().then((g) => setGenres({ total: g.total, fullLength: g.fullLength })).catch(() => {})
  }, [])

  const runSync = async () => {
    setSyncing(true)
    try {
      const r = await api.runSync()
      toast(`Catalog updated: +${r.added} new songs (${r.total} total)`)
      const s = await api.syncStatus()
      setSync(s)
      setGenres((g) => (g ? { ...g, total: r.total } : g))
    } catch {
      toast('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Tune Walkman to how you listen.</p>
      </div>

      {/* Playback */}
      <section aria-label="Playback settings" className="rounded-xl border border-border/50 bg-black/30 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Playback
        </h2>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Endless AutoPlay</p>
              <p className="text-xs text-muted-foreground">When the queue ends, similar songs keep playing (song radio).</p>
            </div>
            <Switch checked={player.autoplay} onCheckedChange={player.setAutoplay} aria-label="Toggle autoplay" />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Crossfade</p>
                <p className="text-xs text-muted-foreground">Blend the end of songs into the next. 0 = off.</p>
              </div>
              <span className="text-sm tabular-nums text-emerald-400">{player.crossfadeSec}s</span>
            </div>
            <Slider
              className="mt-3"
              value={[player.crossfadeSec]}
              max={12}
              step={1}
              onValueChange={(v) => player.setCrossfade(v[0] ?? 0)}
              aria-label="Crossfade seconds"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Playback speed</p>
              <p className="text-xs text-muted-foreground">Pitch-preserving tempo control.</p>
            </div>
            <Select value={String(player.speed)} onValueChange={(v) => player.setSpeed(Number(v))}>
              <SelectTrigger className="w-28" aria-label="Playback speed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}×</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Skip silence</p>
              <p className="text-xs text-muted-foreground">Jumps over long quiet stretches (2.5s+) automatically. Uses the live audio signal.</p>
            </div>
            <Switch checked={player.skipSilence} onCheckedChange={player.setSkipSilence} aria-label="Toggle skip silence" />
          </div>
        </div>
      </section>

      {/* Quality */}
      <section aria-label="Sound quality" className="rounded-xl border border-border/50 bg-black/30 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sound quality</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Streaming quality</p>
            <p className="text-xs text-muted-foreground">
              Best available per song: full-length 320 kbps streams, or 256 kbps AAC.
            </p>
          </div>
          <Select value={player.quality} onValueChange={(v) => { player.setQuality(v as 'auto' | 'full' | 'saver'); toast(`Quality: ${v}`) }}>
            <SelectTrigger className="w-44" aria-label="Streaming quality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (best available)</SelectItem>
              <SelectItem value="full">HI-FI (full-length only)</SelectItem>
              <SelectItem value="saver">Data saver (previews)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {genres && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
              {genres.fullLength.toLocaleString()} HI-FI full-length
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              {genres.total.toLocaleString()} total tracks
            </Badge>
          </div>
        )}
      </section>

      {/* Equalizer */}
      <section aria-label="Equalizer settings" className="rounded-xl border border-border/50 bg-black/30 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Equalizer
        </h2>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">10-band equalizer</p>
              <p className="text-xs text-muted-foreground">Shape the sound. Works on the live audio signal.</p>
            </div>
            <Switch checked={player.eqEnabled} onCheckedChange={player.setEqEnabled} aria-label="Toggle equalizer" />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Preset</p>
              <p className="text-xs text-muted-foreground">Start from a curve, then fine-tune any band.</p>
            </div>
            <Select value={player.eqPreset} onValueChange={player.setEqPreset} disabled={!player.eqEnabled}>
              <SelectTrigger className="w-40" aria-label="Equalizer preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(EQ_PRESETS).map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
                <SelectItem value="Custom" disabled>Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className={`grid gap-x-8 gap-y-3 sm:grid-cols-2 transition-opacity ${player.eqEnabled ? '' : 'pointer-events-none opacity-50'}`}
          >
            {EQ_BANDS.map((freq, i) => {
              const gain = player.eqGains[i] ?? 0
              return (
                <div key={freq} className="flex items-center gap-3">
                  <span className="w-12 text-xs tabular-nums text-muted-foreground">
                    {freq < 1000 ? String(freq) : `${freq / 1000}k`}
                  </span>
                  <Slider
                    className="flex-1"
                    min={EQ_MIN}
                    max={EQ_MAX}
                    step={1}
                    value={[gain]}
                    onValueChange={(v) => player.setEqBand(i, v[0] ?? 0)}
                    aria-label={`${freq < 1000 ? freq : `${freq / 1000}k`} hertz band`}
                  />
                  <span className="w-10 text-right text-xs tabular-nums">
                    {gain > 0 ? `+${gain} dB` : `${gain} dB`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Presets: 10 presets from Bass Boost to Treble Boost. Your curve is saved automatically.
        </p>
      </section>

      {/* Catalog sync */}
      <section aria-label="Catalog sync" className="rounded-xl border border-border/50 bg-black/30 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Database className="h-4 w-4" aria-hidden /> Catalog sync
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Walkman auto-adds new songs from the industry catalog (Audius + iTunes) every few hours. You can sync now too.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runSync} disabled={syncing} className="gap-2 bg-emerald-500 text-black hover:bg-emerald-400">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          {sync && (
            <p className="text-xs text-muted-foreground">
              {sync.total.toLocaleString()} tracks · last synced{' '}
              {sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : 'never'}
            </p>
          )}
        </div>
        {sync && sync.logs.length > 0 && (
          <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-border/40">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-black/80 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Scope</th>
                  <th className="px-3 py-2 text-right font-medium">Fetched</th>
                  <th className="px-3 py-2 text-right font-medium">Added</th>
                  <th className="px-3 py-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {sync.logs.slice(0, 15).map((l) => (
                  <tr key={l.id} className="border-t border-border/30">
                    <td className="px-3 py-1.5">{l.source}</td>
                    <td className="px-3 py-1.5">{l.scope}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{l.fetched}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-emerald-400">+{l.added}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">
                      {new Date(l.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sleep timer */}
      <section aria-label="Sleep timer" className="rounded-xl border border-border/50 bg-black/30 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Timer className="h-4 w-4" aria-hidden /> Sleep timer
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {[5, 10, 15, 30, 45, 60].map((m) => (
            <Button
              key={m}
              size="sm"
              variant="outline"
              onClick={() => { player.startSleepTimer(m); toast(`Music stops in ${m} minutes`) }}
            >
              {m} min
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => { player.startSleepTimer(0); toast('Sleep timer off') }}>
            Off
          </Button>
          {player.sleepAt && (
            <span className="text-xs text-emerald-400">Stops at {new Date(player.sleepAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Volume fades out gently over the last 20 seconds.</p>
      </section>

      {/* Shortcuts */}
      <section aria-label="Keyboard shortcuts" className="rounded-xl border border-border/50 bg-black/30 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Keyboard className="h-4 w-4" aria-hidden /> Keyboard shortcuts
        </h2>
        <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ['Space', 'Play / pause'],
            ['← / →', 'Seek 5s'],
            ['Shift + ← / →', 'Previous / next track'],
            ['↑ / ↓', 'Volume'],
            ['M', 'Mute'],
            ['S', 'Shuffle'],
            ['R', 'Repeat'],
            ['Q', 'Queue panel'],
            ['L', 'Lyrics panel'],
            ['N', 'Fullscreen player'],
            ['/', 'Focus search'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 border-b border-border/30 py-1.5 last:border-0">
              <span className="text-muted-foreground">{v}</span>
              <kbd className="rounded border border-border bg-black/50 px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
