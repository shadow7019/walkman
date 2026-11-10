'use client'

// Persistent bottom player bar: transport, progress seek, volume, queue/lyrics toggles.
import { useCallback, useRef, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, ListMusic, MicVocal, Maximize2, Heart, Download, Timer, Gauge,
} from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useLibrary } from '@/stores/library'
import { useUI } from '@/stores/ui'
import { Cover } from '@/components/cover'
import { Slider } from '@/components/ui/slider'
import { fmtTime } from '@/types'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function PlayerBar() {
  const {
    queue, queueIndex, isPlaying, position, duration, volume, muted, shuffle, repeat,
    playPause, next, prev, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat,
    playTrackAt, removeFromQueue, startSleepTimer, sleepAt, speed, setSpeed,
  } = usePlayer()
  const { likedIds, toggleLike } = useLibrary()
  const { toggleQueue, toggleLyrics, rightPanel, setFullscreen, navigate, toast } = useUI()
  const track = queue[queueIndex]
  const [scrubbing, setScrubbing] = useState<number | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const onSeek = useCallback((clientX: number) => {
    if (!progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    seek(frac * duration)
  }, [duration, seek])

  const pos = scrubbing ?? position

  // mobile: hide the bar entirely when nothing is loaded — reclaim screen space
  return (
    <footer className={cn('relative z-40 mt-auto px-2 pb-2 md:border-t md:border-border/50 md:bg-black/60 md:px-0 md:pb-0 md:backdrop-blur-xl', !track && 'hidden md:block')}>
      {/* Spotify-style floating mini-player pill on mobile, flat bar on desktop */}
      <div className="overflow-hidden rounded-lg bg-muted shadow-lg shadow-black/40 md:rounded-none md:bg-transparent md:shadow-none">
      {/* mobile progress strip — tap to seek */}
      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(pos)}
        tabIndex={0}
        className="flex h-4 w-full items-center px-3 md:hidden"
        onClick={(e) => onSeek(e.clientX)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(Math.min(position + 5, duration))
          if (e.key === 'ArrowLeft') seek(Math.max(position - 5, 0))
        }}
      >
        <div className="relative h-1 w-full rounded-full bg-white/15">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#1ed760]" style={{ width: `${duration ? (pos / duration) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="mx-auto grid h-14 max-w-full grid-cols-[1fr_auto] items-center gap-1 px-2 md:h-[72px] md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] md:gap-4 md:px-4">
        {/* Track info */}
        <div className="flex min-w-0 items-center gap-3">
          {track ? (
            <>
              <button
                onClick={() => setFullscreen(true)}
                aria-label="Open full screen player"
                className="group relative shrink-0"
              >
                <Cover src={track.cover} alt={`${track.title} cover`} className="h-11 w-11 rounded-md md:h-12 md:w-12" />
                <div className="absolute inset-0 hidden items-center justify-center rounded-md bg-black/60 group-hover:flex">
                  <Maximize2 className="h-4 w-4 text-white" aria-hidden />
                </div>
              </button>
              <div className="min-w-0">
                <button className="block max-w-full truncate text-sm font-medium hover:underline" onClick={() => navigate({ name: 'search' })}>
                  {track.title}
                </button>
                <button
                  className="block max-w-full truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => navigate({ name: 'artist', artistName: track.artist })}
                >
                  {track.artist}
                </button>
              </div>
              <button
                aria-label={likedIds.has(track.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                className={cn('shrink-0 rounded-full p-2 hover:bg-white/10 active:bg-white/10', likedIds.has(track.id) ? 'text-[#1ed760]' : 'text-muted-foreground')}
                onClick={() => toggleLike(track.id)}
              >
                <Heart className={cn('h-4 w-4', likedIds.has(track.id) && 'fill-[#1ed760]')} aria-hidden />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-muted md:h-12 md:w-12">
                <Play className="h-4 w-4" aria-hidden />
              </div>
              <span className="hidden sm:inline">Pick a song to start listening</span>
            </div>
          )}
          {/* keeps the like button inside the info cell on mobile */}
        </div>

        {/* Transport */}
        <div className="flex touch-manipulation items-center justify-end gap-0.5 md:justify-center md:gap-1">
          <button
            aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
            aria-pressed={shuffle}
            className={cn('hidden rounded-full p-2 hover:bg-white/10 md:block', shuffle ? 'text-[#1ed760]' : 'text-muted-foreground')}
            onClick={toggleShuffle}
          >
            <Shuffle className="h-4 w-4" aria-hidden />
          </button>
          <button aria-label="Previous track" className="rounded-full p-2 text-muted-foreground hover:text-foreground" onClick={prev}>
            <SkipBack className="h-5 w-5 fill-current" aria-hidden />
          </button>
          <button
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
            onClick={playPause}
            disabled={!track}
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" aria-hidden /> : <Play className="h-5 w-5 fill-current translate-x-[1px]" aria-hidden />}
          </button>
          <button aria-label="Next track" className="rounded-full p-2 text-muted-foreground hover:text-foreground" onClick={next}>
            <SkipForward className="h-5 w-5 fill-current" aria-hidden />
          </button>
          <button
            aria-label={`Repeat: ${repeat}`}
            className={cn('hidden rounded-full p-2 hover:bg-white/10 md:block', repeat !== 'off' ? 'text-[#1ed760]' : 'text-muted-foreground')}
            onClick={cycleRepeat}
          >
            {repeat === 'one' ? <Repeat1 className="h-4 w-4" aria-hidden /> : <Repeat className="h-4 w-4" aria-hidden />}
          </button>
        </div>

        {/* Volume + panel toggles (desktop) */}
        <div className="hidden items-center justify-end gap-1.5 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Sleep timer" className={cn('rounded-full p-2 hover:bg-white/10', sleepAt ? 'text-[#1ed760]' : 'text-muted-foreground')}>
                <Timer className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sleep timer</DropdownMenuLabel>
              {[5, 10, 15, 30, 45, 60].map((m) => (
                <DropdownMenuItem key={m} onClick={() => { startSleepTimer(m); toast(`Music stops in ${m} minutes`) }}>
                  {m} minutes
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => startSleepTimer(0)}>Turn off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Playback speed" className={cn('rounded-full px-1.5 py-2 text-[11px] font-semibold hover:bg-white/10', speed !== 1 ? 'text-[#1ed760]' : 'text-muted-foreground')}>
                {speed}×
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Speed (pitch preserved)</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <DropdownMenuRadioItem key={s} value={String(s)}>{s}×</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            aria-label="Toggle lyrics panel"
            className={cn('rounded-full p-2 hover:bg-white/10', rightPanel === 'lyrics' ? 'text-[#1ed760]' : 'text-muted-foreground')}
            onClick={toggleLyrics}
          >
            <MicVocal className="h-4 w-4" aria-hidden />
          </button>
          <button
            aria-label="Toggle queue panel"
            className={cn('rounded-full p-2 hover:bg-white/10', rightPanel === 'queue' ? 'text-[#1ed760]' : 'text-muted-foreground')}
            onClick={toggleQueue}
          >
            <ListMusic className="h-4 w-4" aria-hidden />
          </button>

          <div className="flex items-center gap-1.5">
            <button aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-full p-2 text-muted-foreground hover:text-foreground" onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
            </button>
            <Slider
              aria-label="Volume"
              className="w-24"
              value={[muted ? 0 : Math.round(volume * 100)]}
              max={100}
              step={1}
              onValueChange={(v) => setVolume((v[0] ?? 0) / 100)}
            />
          </div>
        </div>
      </div>
      </div>

      {/* Desktop progress bar overlay */}
      <div
        ref={progressRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(pos)}
        tabIndex={0}
        className="group absolute inset-x-0 top-0 hidden h-4 -translate-y-1/2 cursor-pointer items-center md:flex"
        onClick={(e) => onSeek(e.clientX)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(Math.min(position + 5, duration))
          if (e.key === 'ArrowLeft') seek(Math.max(position - 5, 0))
        }}
      >
        <div className="relative h-1 w-full rounded-full bg-white/15 transition-colors group-hover:h-1.5">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#1ed760]" style={{ width: `${duration ? (pos / duration) * 100 : 0}%` }} />
          <span className="absolute -top-[3px] hidden h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#1ed760] group-hover:block" style={{ left: `${duration ? (pos / duration) * 100 : 0}%` }} />
        </div>
        <span className="pointer-events-none absolute right-2 -top-5 text-[10px] tabular-nums text-muted-foreground">{fmtTime(pos * 1000)} / {fmtTime(duration * 1000)}</span>
      </div>

      {/* queue reorder accessible list (sr-only summary) */}
      <div className="sr-only" aria-live="polite">
        {track ? `Now playing ${track.title} by ${track.artist}. ${queue.length - queueIndex - 1} tracks in queue.` : 'Nothing playing'}
      </div>
      {/* keep removeFromQueue referenced for a11y via queue panel */}
    </footer>
  )
}
