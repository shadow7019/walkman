'use client'

// Fullscreen Now Playing: big artwork, ambient glow, visualizer, lyrics, queue.
import { useEffect, useRef, useState } from 'react'
import {
  X, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, ChevronDown, ListMusic,
} from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useLibrary } from '@/stores/library'
import { useUI } from '@/stores/ui'
import { Cover } from '@/components/cover'
import { EqBars } from '@/components/track-list'
import { fmtTime } from '@/types'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'

// Simulated audio visualizer bars (smooth, beat-ish motion)
function Visualizer({ playing }: { playing: boolean }) {
  const bars = 48
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const el = ref.current
      if (el) {
        const t = (now - start) / 1000
        const spans = el.children
        for (let i = 0; i < spans.length; i++) {
          const n = i / bars
          const wave =
            Math.sin(t * 2.2 + i * 0.55) * 0.5 +
            Math.sin(t * 1.1 + i * 0.21) * 0.35 +
            Math.sin(t * 3.7 + i * 0.83) * 0.15
          const h = playing ? 12 + Math.abs(wave) * 68 * (0.35 + 0.65 * Math.sin(n * Math.PI)) : 8
          ;(spans[i] as HTMLElement).style.height = `${h}%`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, bars])

  return (
    <div ref={ref} className="flex h-14 items-end justify-center gap-1 opacity-70" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="w-1.5 rounded-t bg-gradient-to-t from-emerald-500/40 to-emerald-300/80 transition-[height] duration-75" style={{ height: '10%' }} />
      ))}
    </div>
  )
}

export function FullscreenPlayer() {
  const {
    queue, queueIndex, isPlaying, position, duration, shuffle, repeat,
    playPause, next, prev, seek, toggleShuffle, cycleRepeat, playTrackAt,
  } = usePlayer()
  const { likedIds, toggleLike } = useLibrary()
  const { fullscreen, setFullscreen, navigate } = useUI()
  const track = queue[queueIndex]

  // keyboard: N closes fullscreen; esc closes
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key.toLowerCase() === 'n' && !(document.activeElement as HTMLElement)?.matches?.('input,textarea'))) {
        setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, setFullscreen])

  if (!fullscreen || !track) return null
  const liked = likedIds.has(track.id)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-zinc-950"
      role="dialog"
      aria-label="Full screen player"
    >
      {/* ambient glow from cover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 blur-3xl"
        style={{
          background: `radial-gradient(60% 60% at 50% 40%, ${dominantGlow(track.id)} 0%, transparent 100%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/50" />

      <div className="relative flex items-center justify-between p-6">
        <button
          onClick={() => navigate({ name: 'artist', name: track.artist })}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {track.artist}
        </button>
        <button aria-label="Close full screen" className="rounded-full p-2 hover:bg-white/10" onClick={() => setFullscreen(false)}>
          <ChevronDown className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 pb-10">
        <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg">
          <Cover src={track.cover} alt={`${track.title} artwork`} className="aspect-square w-full shadow-2xl" rounded="rounded-xl" />
          {isPlaying && <div className="absolute inset-x-0 -bottom-2 flex justify-center"><Visualizer playing={isPlaying} /></div>}
        </div>

        <div className="w-full max-w-xl text-center">
          <h1 className="truncate text-3xl font-bold tracking-tight md:text-4xl">{track.title}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{track.artist}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {track.genre}{track.year ? ` · ${track.year}` : ''} · {track.hasFull ? `${track.bitrateKbps} kbps full-length` : 'preview'}
          </p>
        </div>

        {/* progress */}
        <div className="w-full max-w-xl">
          <Slider
            aria-label="Seek"
            value={[Math.round(position)]}
            max={Math.max(Math.round(duration), 1)}
            step={1}
            onValueChange={(v) => seek(v[0] ?? 0)}
            className="w-full"
          />
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{fmtTime(position * 1000)}</span>
            <span>{fmtTime(duration * 1000)}</span>
          </div>
        </div>

        {/* transport */}
        <div className="flex items-center gap-6">
          <button aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'} className={cn('rounded-full p-2', shuffle ? 'text-emerald-400' : 'text-muted-foreground')} onClick={toggleShuffle}>
            <Shuffle className="h-5 w-5" aria-hidden />
          </button>
          <button aria-label="Previous" onClick={prev} className="text-foreground hover:scale-105">
            <SkipBack className="h-8 w-8 fill-current" aria-hidden />
          </button>
          <button
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={playPause}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="h-7 w-7 fill-current" aria-hidden /> : <Play className="h-7 w-7 fill-current translate-x-[2px]" aria-hidden />}
          </button>
          <button aria-label="Next" onClick={next} className="text-foreground hover:scale-105">
            <SkipForward className="h-8 w-8 fill-current" aria-hidden />
          </button>
          <button aria-label={`Repeat ${repeat}`} className={cn('rounded-full p-2', repeat !== 'off' ? 'text-emerald-400' : 'text-muted-foreground')} onClick={cycleRepeat}>
            {repeat === 'one' ? <Repeat1 className="h-5 w-5" aria-hidden /> : <Repeat className="h-5 w-5" aria-hidden />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            aria-label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
            className={cn('flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10', liked && 'text-emerald-400')}
            onClick={() => toggleLike(track.id)}
          >
            <Heart className={cn('h-3.5 w-3.5', liked && 'fill-emerald-400')} aria-hidden /> {liked ? 'Liked' : 'Like'}
          </button>
        </div>

        {/* up next strip */}
        <div className="w-full max-w-2xl">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListMusic className="h-3.5 w-3.5" aria-hidden /> Up next
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {queue.slice(queueIndex + 1, queueIndex + 8).map((t, i) => (
              <button
                key={`${t.id}-${i}`}
                className="flex w-36 shrink-0 flex-col items-start gap-1.5 rounded-lg p-2 text-left hover:bg-white/5"
                onClick={() => playTrackAt(queueIndex + 1 + i)}
              >
                <Cover src={t.cover} alt="" className="h-24 w-full" />
                <span className="w-full truncate text-xs font-medium">{t.title}</span>
                <span className="w-full truncate text-[10px] text-muted-foreground">{t.artist}</span>
              </button>
            ))}
            {queue.length - queueIndex - 1 === 0 && (
              <p className="py-6 text-xs text-muted-foreground">AutoPlay will keep the music going when the queue ends.</p>
            )}
          </div>
        </div>
        {isPlaying && <EqBars />}
      </div>

      <button aria-label="Close" className="absolute right-6 top-6 rounded-full bg-white/5 p-2 hover:bg-white/10" onClick={() => setFullscreen(false)}>
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

// deterministic hue from track id for ambient glow
function dominantGlow(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return `hsl(${h} 60% 40% / 0.55)`
}
