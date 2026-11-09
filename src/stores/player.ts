'use client'

// Walkman playback engine state — one module-level dual-element audio engine
// is driven by this zustand store (crossfade, autoplay, sleep timer, speed,
// 10-band EQ, skip silence).
import { create } from 'zustand'
import type { Track } from '@/types'
import { EQ_BANDS, EQ_PRESETS } from '@/lib/audio-graph'

type Repeat = 'off' | 'all' | 'one'

interface PlayerState {
  queue: Track[]
  queueIndex: number
  contextTitle: string
  isPlaying: boolean
  position: number // seconds
  duration: number // seconds
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: Repeat
  speed: number
  crossfadeSec: number
  autoplay: boolean
  sleepAt: number | null // epoch ms
  quality: 'auto' | 'full' | 'saver' // Spotufi-style quality tiers
  eqEnabled: boolean
  eqPreset: string
  eqGains: number[] // dB per band, matches EQ_BANDS
  skipSilence: boolean
  restored: boolean
  // actions
  playQueue: (tracks: Track[], index: number, contextTitle?: string) => void
  playNext: (track: Track) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  reorderQueue: (from: number, to: number) => void
  playTrackAt: (index: number) => void
  playPause: () => void
  next: () => void
  prev: () => void
  seek: (sec: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setSpeed: (s: number) => void
  setCrossfade: (sec: number) => void
  setAutoplay: (b: boolean) => void
  startSleepTimer: (min: number) => void
  setQuality: (q: 'auto' | 'full' | 'saver') => void
  setEqEnabled: (b: boolean) => void
  setEqBand: (bandIndex: number, db: number) => void
  setEqPreset: (name: string) => void
  setSkipSilence: (b: boolean) => void
  resumeSession: () => boolean // restore persisted queue (paused)
  // internal — driven by use-audio-engine
  internal: {
    setPosition: (pos: number, dur: number) => void
    setPlaying: (p: boolean) => void
    current: () => Track | null
  }
}

// queue version bumps on every structural change → engine effect triggers
let queueVersion = 0
export const bumpQueueVersion = () => ++queueVersion

// events the engine subscribes to (avoid stale closures)
type EngineEvent =
  | { type: 'load'; track: Track; autoplay: boolean }
  | { type: 'pause' } | { type: 'resume' }
  | { type: 'seek'; sec: number }
  | { type: 'volume'; v: number }
  | { type: 'speed'; s: number }
type EngineListener = (e: EngineEvent) => void
const engineListeners = new Set<EngineListener>()
export function onEngineEvent(l: EngineListener) {
  engineListeners.add(l)
  return () => { engineListeners.delete(l) }
}
function emit(e: EngineEvent) {
  for (const l of engineListeners) l(e)
}

export const usePlayer = create<PlayerState>((set, get) => {
  const persist = () => {
    try {
      const s = get()
      localStorage.setItem('walkman:player', JSON.stringify({
        volume: s.volume, muted: s.muted, shuffle: s.shuffle, repeat: s.repeat,
        speed: s.speed, crossfadeSec: s.crossfadeSec, autoplay: s.autoplay, quality: s.quality,
        eqEnabled: s.eqEnabled, eqPreset: s.eqPreset, eqGains: s.eqGains, skipSilence: s.skipSilence,
        queue: s.queue.slice(0, 100), queueIndex: s.queueIndex, contextTitle: s.contextTitle,
        position: s.position,
      }))
    } catch { /* ignore */ }
  }

  const loadTrack = (index: number, autoplay = true) => {
    const { queue } = get()
    if (index < 0 || index >= queue.length) return false
    set({ queueIndex: index, position: 0, duration: queue[index].durationMs / 1000 || 0 })
    emit({ type: 'load', track: queue[index], autoplay })
    persist()
    return true
  }

  const advance = async (userInitiated: boolean) => {
    const s = get()
    if (s.repeat === 'one' && !userInitiated) {
      loadTrack(s.queueIndex)
      return
    }
    let nextIdx = s.queueIndex + 1
    if (nextIdx >= s.queue.length) {
      if (s.repeat === 'all' && s.queue.length) {
        loadTrack(0)
        return
      }
      // endless autoplay via radio
      if (s.autoplay && s.queue.length) {
        const last = s.queue[s.queue.length - 1]
        try {
          const r = await fetch('/api/radio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seedTrackId: last.id }) })
          const j = await r.json()
          const fresh: Track[] = (j.tracks ?? []).filter((t: Track) => !s.queue.some((q) => q.id === t.id)).slice(0, 15)
          if (fresh.length) {
            set({ queue: [...s.queue, ...fresh] })
            loadTrack(s.queue.length)
            bumpQueueVersion()
            return
          }
        } catch { /* fall through */ }
      }
      set({ isPlaying: false })
      emit({ type: 'pause' })
      persist()
      return
    }
    loadTrack(nextIdx)
  }

  return {
    queue: [],
    queueIndex: 0,
    contextTitle: '',
    isPlaying: false,
    position: 0,
    duration: 0,
    volume: 0.9,
    muted: false,
    shuffle: false,
    repeat: 'off',
    speed: 1,
    crossfadeSec: 0,
    autoplay: true,
    sleepAt: null,
    quality: 'auto',
    eqEnabled: false,
    eqPreset: 'Flat',
    eqGains: [...EQ_PRESETS.Flat],
    skipSilence: false,
    restored: false,

    playQueue: (tracks, index, contextTitle = '') => {
      if (!tracks.length) return
      queueVersion++
      set({ queue: tracks, queueIndex: index, contextTitle, isPlaying: true })
      emit({ type: 'load', track: tracks[index], autoplay: true })
      persist()
    },

    playNext: (track) => {
      const { queue, queueIndex } = get()
      if (queue[queueIndex + 1]?.id === track.id) return
      const nextQueue = [...queue]
      // avoid duplicates in queue
      const dupIdx = nextQueue.findIndex((q, i) => q.id === track.id && i !== queueIndex)
      if (dupIdx >= 0) nextQueue.splice(dupIdx, 1)
      nextQueue.splice(queueIndex + 1, 0, track)
      queueVersion++
      set({ queue: nextQueue })
      persist()
    },

    addToQueue: (track) => {
      const { queue } = get()
      if (queue.some((q) => q.id === track.id)) return
      queueVersion++
      set({ queue: [...queue, track] })
      persist()
    },

    removeFromQueue: (index) => {
      const { queue, queueIndex } = get()
      if (index === queueIndex) return
      const nextQueue = queue.filter((_, i) => i !== index)
      queueVersion++
      set({
        queue: nextQueue,
        queueIndex: index < queueIndex ? queueIndex - 1 : queueIndex,
      })
      if (!nextQueue.length) { set({ isPlaying: false }); emit({ type: 'pause' }) }
      persist()
    },

    reorderQueue: (from, to) => {
      const { queue, queueIndex } = get()
      if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return
      const nextQueue = [...queue]
      const [moved] = nextQueue.splice(from, 1)
      nextQueue.splice(to, 0, moved)
      let nextIndex = queueIndex
      if (from === queueIndex) nextIndex = to
      else {
        if (from < queueIndex && to >= queueIndex) nextIndex = queueIndex - 1
        if (from > queueIndex && to <= queueIndex) nextIndex = queueIndex + 1
      }
      queueVersion++
      set({ queue: nextQueue, queueIndex: nextIndex })
      persist()
    },

    playTrackAt: (index) => {
      set({ isPlaying: true })
      loadTrack(index)
    },

    playPause: () => {
      const { isPlaying } = get()
      if (!get().queue.length) return
      set({ isPlaying: !isPlaying })
      emit(isPlaying ? { type: 'pause' } : { type: 'resume' })
      persist()
    },

    next: () => { advance(true) },

    prev: () => {
      const { queueIndex, position } = get()
      if (position > 3) { emit({ type: 'seek', sec: 0 }); set({ position: 0 }); return }
      if (queueIndex > 0) {
        set({ isPlaying: true })
        loadTrack(queueIndex - 1)
      } else emit({ type: 'seek', sec: 0 })
    },

    seek: (sec) => {
      set({ position: sec })
      emit({ type: 'seek', sec })
    },

    setVolume: (v) => { set({ volume: v, muted: false }); emit({ type: 'volume', v }); persist() },
    toggleMute: () => { const m = !get().muted; set({ muted: m }); emit({ type: 'volume', v: m ? 0 : get().volume }); persist() },
    toggleShuffle: () => {
      const { shuffle, queue, queueIndex } = get()
      if (!shuffle) {
        const rest = queue.slice(queueIndex + 1).sort(() => Math.random() - 0.5)
        const nextQueue = [...queue.slice(0, queueIndex + 1), ...rest]
        queueVersion++
        set({ shuffle: true, queue: nextQueue })
      } else set({ shuffle: false })
      persist()
    },
    cycleRepeat: () => {
      const order: Repeat[] = ['off', 'all', 'one']
      const cur = order.indexOf(get().repeat)
      set({ repeat: order[(cur + 1) % 3] })
      persist()
    },
    setSpeed: (s) => { set({ speed: s }); emit({ type: 'speed', s }); persist() },
    setCrossfade: (sec) => { set({ crossfadeSec: sec }); persist() },
    setAutoplay: (b) => { set({ autoplay: b }); persist() },
    startSleepTimer: (min) => {
      if (!min) { set({ sleepAt: null }); return }
      set({ sleepAt: Date.now() + min * 60000 })
    },
    setQuality: (q) => { set({ quality: q }); persist() },
    setEqEnabled: (b) => { set({ eqEnabled: b }); persist() },
    setEqBand: (bandIndex, db) => {
      const gains = [...get().eqGains]
      gains[bandIndex] = Math.max(-12, Math.min(12, db))
      const preset = gains.every((g, i) => g === (EQ_PRESETS[get().eqPreset]?.[i] ?? 0)) ? get().eqPreset : 'Custom'
      set({ eqGains: gains, eqPreset: preset })
      persist()
    },
    setEqPreset: (name) => {
      const gains = EQ_PRESETS[name] ? [...EQ_PRESETS[name]] : [...get().eqGains]
      set({ eqPreset: name, eqGains: gains })
      persist()
    },
    setSkipSilence: (b) => { set({ skipSilence: b }); persist() },
    resumeSession: () => {
      try {
        const saved = JSON.parse(localStorage.getItem('walkman:player') ?? '{}')
        if (Array.isArray(saved.queue) && saved.queue.length > 0 && typeof saved.queueIndex === 'number') {
          set({
            queue: saved.queue as Track[],
            queueIndex: Math.min(saved.queueIndex, saved.queue.length - 1),
            contextTitle: saved.contextTitle ?? 'Restored session',
            position: typeof saved.position === 'number' ? saved.position : 0,
            duration: (saved.queue[Math.min(saved.queueIndex, saved.queue.length - 1)]?.durationMs ?? 0) / 1000,
            isPlaying: false,
            restored: true,
          })
          return true
        }
      } catch { /* ignore */ }
      return false
    },

    internal: {
      setPosition: (pos, dur) => set({ position: pos, duration: dur || get().duration }),
      setPlaying: (p) => set({ isPlaying: p }),
      current: () => get().queue[get().queueIndex] ?? null,
    },
  }
})
