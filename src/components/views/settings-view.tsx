'use client'

// Settings: playback (autoplay, crossfade, speed, skip silence), 10-band equalizer,
// quality tiers, catalog sync, sleep timer, keyboard shortcuts.
import { useEffect, useState } from 'react'
import { usePlayer } from '@/stores/player'
import { useUI } from '@/stores/ui'
import { api, type ArtistSweep, type SpotifySync, type DeepSweep, type FullSweep, type IndianRap } from '@/lib/client-api'
import { EQ_BANDS, EQ_PRESETS, EQ_MIN, EQ_MAX } from '@/lib/audio-graph'
import { isBackgroundPlayEnabled, setBackgroundPlayEnabled, hasAndroidBridge } from '@/lib/android-bridge'
import { isAutoSyncEnabled, setAutoSyncEnabled } from '@/hooks/use-auto-sync'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, RefreshCw, Database, Keyboard, Timer, SlidersHorizontal, Users, Music2, Disc3, Zap, Flame, Smartphone, Download } from 'lucide-react'

interface SyncStatus {
  logs: { id: string; source: string; scope: string; fetched: number; added: number; updated: number; syncedAt: string }[]
  total: number
  artistCount?: number
  lastSyncedAt: string | null
  artistSweep?: ArtistSweep
  sweptArtists?: number
  spotifySync?: SpotifySync
  spotifyPlaylists?: number
  deepSweep?: DeepSweep
  deepCrawledArtists?: number
  thinArtists?: number
  indianRap?: IndianRap
  indianRapArtists?: number
  fullSweep?: FullSweep
  fullLength?: number
  previewCount?: number
}

export function SettingsView() {
  const player = usePlayer()
  const { toast } = useUI()
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [genres, setGenres] = useState<{ total: number; fullLength: number } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [spotifySyncing, setSpotifySyncing] = useState(false)
  const [deepSyncing, setDeepSyncing] = useState(false)
  const [fullSyncing, setFullSyncing] = useState(false)
  const [indianRapSyncing, setIndianRapSyncing] = useState(false)
  const [bgPlay, setBgPlay] = useState(true)
  const [autoAdd, setAutoAdd] = useState(true)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    setBgPlay(isBackgroundPlayEnabled())
    setAutoAdd(isAutoSyncEnabled())
    setIsAndroid(hasAndroidBridge())
  }, [])

  useEffect(() => {
    api.syncStatus().then(setSync).catch(() => {})
    api.genres().then((g) => setGenres({ total: g.total, fullLength: g.fullLength })).catch(() => {})
  }, [])

  // live-poll while any sweep runs
  const sweep = sync?.artistSweep
  const spSync = sync?.spotifySync
  const deepSweep = sync?.deepSweep
  const fullSweep = sync?.fullSweep
  const iRap = sync?.indianRap
  useEffect(() => {
    if (!sweep?.running && !spSync?.running && !deepSweep?.running && !fullSweep?.running && !iRap?.running) return
    const t = setInterval(() => {
      api.syncStatus().then(setSync).catch(() => {})
    }, 2500)
    return () => clearInterval(t)
  }, [sweep?.running, spSync?.running, deepSweep?.running, fullSweep?.running, iRap?.running])

  const syncIndianRap = async () => {
    setIndianRapSyncing(true)
    try {
      await api.indianRap()
      toast('Importing the Desi Hip-Hop scene — full-length 320 kbps streams incoming')
      const s = await api.syncStatus()
      setSync(s)
    } catch {
      toast('Could not start the Indian rap sync — try again')
    } finally {
      setIndianRapSyncing(false)
    }
  }

  const runFullSongs = async () => {
    setFullSyncing(true)
    try {
      await api.fullSongs()
      toast('Converting every preview to a full-length 320 kbps song')
      const s = await api.syncStatus()
      setSync(s)
    } catch {
      toast('Could not start the full-song sweep — try again')
    } finally {
      setFullSyncing(false)
    }
  }

  const completeDiscographies = async () => {
    setDeepSyncing(true)
    try {
      await api.deepArtists()
      toast('Completing every artist’s discography — all albums, all songs')
      const s = await api.syncStatus()
      setSync(s)
    } catch {
      toast('Could not start the discography sweep — try again')
    } finally {
      setDeepSyncing(false)
    }
  }

  const syncSpotifyCharts = async () => {
    setSpotifySyncing(true)
    try {
      await api.syncSpotify()
      toast('Syncing Spotify\u2019s official charts — new hits land in the library as it runs')
      const s = await api.syncStatus()
      setSync(s)
    } catch {
      toast('Could not start the Spotify sync — try again')
    } finally {
      setSpotifySyncing(false)
    }
  }

  const expandArtists = async () => {
    setExpanding(true)
    try {
      await api.expandArtists()
      toast('Sweeping the world\'s bands & artists — the library fills as it runs')
      const s = await api.syncStatus()
      setSync(s)
    } catch {
      toast('Could not start the sweep — try again')
    } finally {
      setExpanding(false)
    }
  }

  const runSync = async () => {
    setSyncing(true)
    try {
      const r = await api.runSync()
      if (typeof r.added === 'number' && typeof r.total === 'number') {
        toast(`Catalog updated: +${r.added} new songs (${r.total} total)`)
        setGenres((g) => (g ? { ...g, total: r.total as number } : g))
      } else {
        toast(r.message || 'A catalog sweep is already running — new songs are still landing automatically')
      }
      const s = await api.syncStatus()
      setSync(s)
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
              <span className="text-sm tabular-nums text-[#1ed760]">{player.crossfadeSec}s</span>
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

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Background playback</p>
              <p className="text-xs text-muted-foreground">
                {isAndroid
                  ? 'Music keeps playing when you turn the screen off or switch apps, with controls on the lock screen.'
                  : 'Music keeps playing when the screen turns off. Fully active in the Walkman Android app; enabled here too.'}
              </p>
            </div>
            <Switch
              checked={bgPlay}
              onCheckedChange={(v) => { setBgPlay(v); setBackgroundPlayEnabled(v); toast(v ? 'Background playback on' : 'Background playback off — music stops in background') }}
              aria-label="Toggle background playback"
            />
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
            <Badge variant="outline" className="border-[#1db954]/50 text-[#1ed760]">
              {(genres.fullLength ?? 0).toLocaleString()} HI-FI full-length
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              {(genres.total ?? 0).toLocaleString()} total tracks
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
          Walkman auto-adds new songs from the industry catalog (Audius + iTunes + Spotify charts) every few hours. You can sync now too.
        </p>
        <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-[#1db954]/30 bg-[#1db954]/5 p-4">
          <div>
            <p className="text-sm font-medium">Auto-add new songs</p>
            <p className="text-xs text-muted-foreground">
              Checks for brand-new releases every 30 minutes while Walkman is open — the server also sweeps on its own every 6 hours.
            </p>
          </div>
          <Switch
            checked={autoAdd}
            onCheckedChange={(v) => { setAutoAdd(v); setAutoSyncEnabled(v); toast(v ? 'Auto-add on — new songs land automatically' : 'Auto-add off') }}
            aria-label="Toggle auto-add new songs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runSync} disabled={syncing} className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          {sync && (
            <p className="text-xs text-muted-foreground">
              {sync.total.toLocaleString()} tracks · {sync.artistCount?.toLocaleString() ?? '—'} artists · last synced{' '}
              {sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : 'never'}
            </p>
          )}
        </div>

        {/* Spotify auto-add — official charts & editorial playlists */}
        <div className="mt-5 rounded-lg border border-[#1db954]/30 bg-[#1db954]/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={syncSpotifyCharts}
              disabled={spotifySyncing || !!spSync?.running}
              className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
            >
              {spSync?.running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Music2 className="h-4 w-4" aria-hidden />}
              {spSync?.running ? 'Syncing Spotify…' : 'Sync Spotify charts'}
            </Button>
            {sync?.spotifyPlaylists ? (
              <p className="text-xs text-muted-foreground">{sync.spotifyPlaylists} official playlists tracked</p>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Auto-adds Spotify’s official charts &amp; editorial playlists — Top Songs Global, Today’s Top Hits, RapCaviar, Viva Latino, K-Pop ON!, mint, New Music Friday and more. Charts refresh daily, so every sync brings the newest hits.
          </p>
          {spSync?.running && spSync.total > 0 && (
            <div className="mt-3 space-y-1.5">
              <Progress value={(spSync.done / spSync.total) * 100} className="h-2" aria-label="Spotify sync progress" />
              <p className="text-xs text-[#1ed760]" aria-live="polite">
                {spSync.done}/{spSync.total} playlists · +{spSync.added.toLocaleString()} songs{sync ? ` · ${sync.total.toLocaleString()} total` : ''}
                {spSync.current ? ` · now: ${spSync.current}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Indian rap / Desi Hip-Hop scene — full-length streams */}
        <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={syncIndianRap}
              disabled={indianRapSyncing || !!iRap?.running}
              className="gap-2 bg-amber-500 text-black hover:bg-amber-400"
            >
              {iRap?.running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Flame className="h-4 w-4" aria-hidden />}
              {iRap?.running ? 'Importing Indian rap…' : 'Import the Indian rap scene'}
            </Button>
            {sync && typeof sync.indianRapArtists === 'number' && sync.indianRapArtists > 0 && (
              <p className="text-xs text-muted-foreground">
                {sync.indianRapArtists} acts synced · +{(sync.indianRap?.added ?? 0).toLocaleString()} songs
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The full Desi Hip-Hop scene — DIVINE, Seedhe Maut, KR$NA, MC Stan, Emiway Bantai, Hanumankind, Brodha V, Sidhu Moose Wala, Karan Aujla, Raja Kumari and more — as <strong>official full-length 320 kbps JioSaavn streams</strong>, plus complete iTunes India discographies.
          </p>
          {iRap?.running && iRap.total > 0 && (
            <div className="mt-3 space-y-1.5">
              <Progress value={(iRap.done / iRap.total) * 100} className="h-2" aria-label="Indian rap sync progress" />
              <p className="text-xs text-amber-400" aria-live="polite">
                {iRap.done}/{iRap.total} acts · +{iRap.added.toLocaleString()} songs{sync ? ` · ${sync.total.toLocaleString()} total` : ''}
                {iRap.current ? ` · now: ${iRap.current}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Full-song conversion — no more 30-second previews */}
        <div className="mt-5 rounded-lg border border-[#1db954]/30 bg-[#1db954]/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runFullSongs}
              disabled={fullSyncing || !!fullSweep?.running}
              className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
            >
              {fullSweep?.running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
              {fullSweep?.running ? 'Converting to full songs…' : 'Convert all previews to full songs'}
            </Button>
            {sync && typeof sync.fullLength === 'number' && typeof sync.previewCount === 'number' && (
              <p className="text-xs text-muted-foreground">
                <span className="text-[#1ed760]">{sync.fullLength.toLocaleString()} full-length</span> · {sync.previewCount.toLocaleString()} previews left
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Upgrades every 30-second preview to a full-length 320 kbps stream — official JioSaavn masters and Audius full tracks. Also happens automatically the moment you play a song.
          </p>
          {fullSweep?.running && fullSweep.total > 0 && (
            <div className="mt-3 space-y-1.5">
              <Progress value={(fullSweep.done / fullSweep.total) * 100} className="h-2" aria-label="Full-song sweep progress" />
              <p className="text-xs text-[#1ed760]" aria-live="polite">
                {fullSweep.done.toLocaleString()}/{fullSweep.total.toLocaleString()} checked · {fullSweep.added.toLocaleString()} upgraded to full
                {fullSweep.current ? ` · now: ${fullSweep.current}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Discography completion — every album, every song for under-covered artists */}
        <div className="mt-5 rounded-lg border border-[#1db954]/30 bg-[#1db954]/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={completeDiscographies}
              disabled={deepSyncing || !!deepSweep?.running}
              className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
            >
              {deepSweep?.running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Disc3 className="h-4 w-4" aria-hidden />}
              {deepSweep?.running ? 'Completing discographies…' : 'Complete all artist discographies'}
            </Button>
            {sync && typeof sync.thinArtists === 'number' && (
              <p className="text-xs text-muted-foreground">
                {sync.thinArtists.toLocaleString()} artists need more songs
                {sync.deepCrawledArtists ? ` · ${sync.deepCrawledArtists.toLocaleString()} discographies completed` : ''}
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Walks every artist’s full album list and pulls <strong>every song on every album</strong> — no more one-song artists. Runs thinnest artists first and resumes where it left off.
          </p>
          {deepSweep?.running && deepSweep.total > 0 && (
            <div className="mt-3 space-y-1.5">
              <Progress value={(deepSweep.done / deepSweep.total) * 100} className="h-2" aria-label="Discography sweep progress" />
              <p className="text-xs text-[#1ed760]" aria-live="polite">
                {deepSweep.done}/{deepSweep.total} artists · +{deepSweep.added.toLocaleString()} songs{sync ? ` · ${sync.total.toLocaleString()} total` : ''}
                {deepSweep.current ? ` · now: ${deepSweep.current}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Artist & band expansion — every major act, every genre */}
        <div className="mt-5 rounded-lg border border-[#1db954]/30 bg-[#1db954]/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={expandArtists}
              disabled={expanding || !!sweep?.running}
              className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
            >
              {sweep?.running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />}
              {sweep?.running ? 'Sweeping…' : 'Add all bands & artists'}
            </Button>
            {sync && typeof sync.sweptArtists === 'number' && sync.sweptArtists > 0 && !sweep?.running && (
              <p className="text-xs text-muted-foreground">{sync.sweptArtists.toLocaleString()} artists swept so far</p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pulls songs from ~900 legendary bands & artists — Rock, Metal, Pop, Hip-Hop, K-Pop, J-Pop, Bollywood, Latin, Afrobeats, Classical and 20+ more scenes. Resumes where it left off.
          </p>
          {sweep?.running && sweep.total > 0 && (
            <div className="mt-3 space-y-1.5">
              <Progress value={(sweep.done / sweep.total) * 100} className="h-2" aria-label="Artist sweep progress" />
              <p className="text-xs text-[#1ed760]" aria-live="polite">
                {sweep.done}/{sweep.total} artists · +{sweep.added.toLocaleString()} songs{sync ? ` · ${sync.total.toLocaleString()} total` : ''}
                {sweep.current ? ` · now: ${sweep.current}` : ''}
              </p>
            </div>
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
                    <td className="px-3 py-1.5 text-right tabular-nums text-[#1ed760]">+{l.added}</td>
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
            <span className="text-xs text-[#1ed760]">Stops at {new Date(player.sleepAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Volume fades out gently over the last 20 seconds.</p>
      </section>

      {/* Android app */}
      <section aria-label="Android app" className="rounded-xl border border-border/50 bg-black/30 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Smartphone className="h-4 w-4" aria-hidden /> Android app
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
            onClick={() => {
              const a = document.createElement('a')
              // versioned URL — CDN caches can never pin an old build to it
              a.href = '/walkman-1.3.0.apk'
              a.download = 'walkman-1.3.0.apk'
              document.body.appendChild(a)
              a.click()
              a.remove()
              toast('Downloading the Walkman APK v1.3.0…')
            }}
          >
            <Download className="h-4 w-4" aria-hidden /> Download APK
          </Button>
          <p className="text-xs text-muted-foreground">
            Install on your phone: open this link on the device, allow “install unknown apps” for your browser, then install. The app connects to this server automatically and keeps music playing with the screen off.
          </p>
        </div>
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
