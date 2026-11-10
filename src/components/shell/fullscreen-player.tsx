'use client'

// Fullscreen Now Playing: big artwork, ambient glow, real Web Audio visualizer,
// EQ quick panel, lyrics, queue.
import { useEffect, useRef, useState } from 'react'
import {
  X, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, ChevronDown, ListMusic, SlidersHorizontal,
} from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useLibrary } from '@/stores/library'
import { useUI } from '@/stores/ui'
import { Cover } from '@/components/cover'
import { EqBars } from '@/components/track-list'
import { fmtTime } from '@/types'
import { cn } from '@/lib/utils'
import { getFrequencyData, EQ_BANDS, EQ_PRESETS, EQ_MIN, EQ_MAX } from '@/lib/audio-graph'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Real audio visualizer: maps the 256-bin FFT from the Web Audio analyser down
// to BAR_COUNT bars using a power curve for logarithmic-ish grouping and skips
// the top ~15% of bins (usually empty). Falls back to a low idle baseline when
// paused or before the audio graph exists.
const BAR_COUNT = 56

function Visualizer({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const levelsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.08))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let dpr = 1
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      const data = playing ? getFrequencyData() : null
      const usable = data ? Math.floor(data.length * 0.85) : 0
      const levels = levelsRef.current
      const gap = 3
      const barW = Math.max(2, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // emerald gradient, deep at the base -> bright at the tips
      const grad = ctx.createLinearGradient(0, height, 0, 0)
      grad.addColorStop(0, 'rgba(52, 211, 153, 0.35)')
      grad.addColorStop(1, 'rgba(52, 211, 153, 0.85)')
      ctx.fillStyle = grad

      for (let i = 0; i < BAR_COUNT; i++) {
        let target = 0.08
        if (data) {
          // power-curve bin grouping: low bars span 1 bin, high bars span many
          const lo = Math.floor(Math.pow(i / BAR_COUNT, 1.7) * usable)
          const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / BAR_COUNT, 1.7) * usable))
          let sum = 0
          let n = 0
          for (let b = lo; b < hi && b < usable; b++) {
            sum += data[b]
            n++
          }
          const avg = n > 0 ? sum / n / 255 : 0
          // gentle upward tilt so weak highs still read visually
          const tilted = Math.min(1, avg * (0.8 + 0.5 * (i / BAR_COUNT)))
          target = 0.08 + Math.pow(tilted, 0.9) * 0.92
        }
        const cur = levels[i]
        // fast attack, slower release for organic motion
        levels[i] = target > cur ? cur + (target - cur) * 0.45 : cur + (target - cur) * 0.16

        const h = Math.max(2, levels[i] * height)
        const x = i * (barW + gap)
        const y = height - h
        const r = Math.min(barW / 2, 2, h / 2)

        ctx.beginPath()
        ctx.moveTo(x, height)
        ctx.lineTo(x, y + r)
        ctx.arcTo(x, y, x + r, y, r)
        ctx.lineTo(x + barW - r, y)
        ctx.arcTo(x + barW, y, x + barW, y + r, r)
        ctx.lineTo(x + barW, height)
        ctx.closePath()
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [playing])

  return <canvas ref={canvasRef} aria-hidden className="block h-14 w-full opacity-75" />
}

// 31 -> "31", 1000 -> "1k", 16000 -> "16k"
function bandLabel(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : `${hz}`
}

function bandDb(db: number): string {
  return db > 0 ? `+${db}` : `${db}`
}

// Compact ByTune-style EQ quick panel. Gains flow through the player store;
// the audio engine applies them, the UI stays a single source of truth.
function EqQuickPanel() {
  const { eqEnabled, eqPreset, eqGains, setEqEnabled, setEqBand, setEqPreset } = usePlayer()

  return (
    <div className="absolute left-1/2 top-full z-30 mt-3 w-[340px] max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-xl border border-border/60 bg-black/80 p-4 text-left shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Equalizer</p>
          <p className="text-[10px] text-muted-foreground">10-band · {EQ_MIN} to +{EQ_MAX} dB</p>
        </div>
        <Switch checked={eqEnabled} onCheckedChange={setEqEnabled} aria-label="Enable equalizer" />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Select value={eqPreset} onValueChange={setEqPreset}>
          <SelectTrigger size="sm" aria-label="Equalizer preset" className="flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="text-xs">
            {Object.keys(EQ_PRESETS).map((name) => (
              <SelectItem key={name} value={name} className="text-xs">
                {name}
              </SelectItem>
            ))}
            <SelectItem value="Custom" disabled className="text-xs">
              Custom
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setEqPreset('Flat')}
        >
          Reset
        </Button>
      </div>

      <div className={cn('mt-3 flex flex-col gap-2', !eqEnabled && 'pointer-events-none opacity-50')}>
        {EQ_BANDS.map((hz, i) => (
          <div key={hz} className="flex items-center gap-2">
            <span className="w-10 text-[10px] tabular-nums text-muted-foreground">{bandLabel(hz)}</span>
            <Slider
              aria-label={`${hz} Hz gain`}
              className="flex-1"
              min={EQ_MIN}
              max={EQ_MAX}
              step={1}
              value={[eqGains[i] ?? 0]}
              onValueChange={(v) => setEqBand(i, v[0] ?? 0)}
            />
            <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{bandDb(eqGains[i] ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FullscreenPlayer() {
  const {
    queue, queueIndex, isPlaying, position, duration, shuffle, repeat,
    playPause, next, prev, seek, toggleShuffle, cycleRepeat, playTrackAt,
    eqEnabled,
  } = usePlayer()
  const { likedIds, toggleLike } = useLibrary()
  const { fullscreen, setFullscreen, navigate } = useUI()
  const [eqOpen, setEqOpen] = useState(false)
  const track = queue[queueIndex]

  // keyboard: N closes fullscreen; esc closes (esc closes the EQ panel first)
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (eqOpen) {
          setEqOpen(false)
          return
        }
        setFullscreen(false)
        return
      }
      if (e.key.toLowerCase() === 'n' && !(document.activeElement as HTMLElement)?.matches?.('input,textarea')) {
        setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, eqOpen, setFullscreen])

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
          onClick={() => navigate({ name: 'artist', artistName: track.artist })}
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
          <div className="absolute inset-x-0 -bottom-2 flex justify-center"><Visualizer playing={isPlaying} /></div>
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

        <div className="relative flex items-center gap-3">
          <button
            aria-label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
            className={cn('flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10', liked && 'text-emerald-400')}
            onClick={() => toggleLike(track.id)}
          >
            <Heart className={cn('h-3.5 w-3.5', liked && 'fill-emerald-400')} aria-hidden /> {liked ? 'Liked' : 'Like'}
          </button>
          <button
            type="button"
            aria-label="Toggle equalizer"
            aria-expanded={eqOpen}
            onClick={() => setEqOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs hover:bg-white/10',
              (eqOpen || eqEnabled) && 'border-emerald-400/40 text-emerald-400',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> EQ
          </button>
          {eqOpen && <EqQuickPanel />}
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
