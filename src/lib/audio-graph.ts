'use client'

// Walkman Web Audio graph — ByTune-style sound stack:
//   both <audio> elements -> preGain -> 10-band EQ -> analyser -> destination
// The analyser powers the real fullscreen visualizer and skip-silence detection.
// Created lazily on first playback (inside a user gesture) so autoplay policies
// and browser restrictions are satisfied.

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
export const EQ_MIN = -12
export const EQ_MAX = 12

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  Vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  Acoustic: [3, 2, 1, 1, 1, 2, 2, 3, 2, 1],
  Electronic: [5, 4, 1, 0, -1, 1, 2, 4, 5, 5],
  'Hip-Hop': [6, 5, 3, 2, -1, -1, 1, 2, 3, 4],
  Rock: [5, 4, 2, 1, -1, -1, 1, 3, 4, 5],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2, 4, 6, 7],
}

interface AudioGraph {
  ctx: AudioContext
  filters: BiquadFilterNode[]
  analyser: AnalyserNode
  sources: Set<HTMLMediaElement>
}

let graph: AudioGraph | null = null
let freqData: Uint8Array<ArrayBuffer> | null = null
let timeData: Float32Array<ArrayBuffer> | null = null

function buildGraph(): AudioGraph | null {
  try {
    const w = window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctor = w.AudioContext || w.webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()

    const filters = EQ_BANDS.map((freq, i) => {
      const f = ctx.createBiquadFilter()
      f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
      f.frequency.value = freq
      f.Q.value = 1.1
      f.gain.value = 0
      return f
    })
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.82

    // chain filters in order, then analyser
    let node: AudioNode = filters[0]
    for (let i = 1; i < filters.length; i++) {
      node.connect(filters[i])
      node = filters[i]
    }
    filters[filters.length - 1].connect(analyser)
    analyser.connect(ctx.destination)

    freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
    timeData = new Float32Array(new ArrayBuffer(analyser.fftSize * 4))
    return { ctx, filters, analyser, sources: new Set() }
  } catch {
    return null
  }
}

function route(el: HTMLMediaElement, g: AudioGraph) {
  if (g.sources.has(el)) return
  try {
    const src = g.ctx.createMediaElementSource(el)
    src.connect(g.filters[0])
    g.sources.add(el)
  } catch {
    // element already bound to another context — leave direct playback
  }
}

/**
 * Ensure both audio elements are routed through the EQ/analyser graph.
 * Call inside a user gesture (first load/play). Safe to call repeatedly.
 */
export function ensureAudioGraph(...elements: HTMLMediaElement[]): AudioGraph | null {
  if (typeof window === 'undefined') return null
  if (!graph) graph = buildGraph()
  if (!graph) return null
  for (const el of elements) route(el, graph)
  if (graph.ctx.state === 'suspended') void graph.ctx.resume().catch(() => {})
  return graph
}

/** Apply EQ gains (dB per band). Disabled = all flat. */
export function applyEq(gains: number[], enabled: boolean) {
  if (!graph) return
  graph.filters.forEach((f, i) => {
    const g = enabled ? (gains[i] ?? 0) : 0
    try { f.gain.setTargetAtTime(g, graph!.ctx.currentTime, 0.05) } catch { /* ignore */ }
  })
}

/** Suspend-free resume attempt — call on any play intent. */
export function resumeAudioGraph() {
  if (graph && graph.ctx.state === 'suspended') void graph.ctx.resume().catch(() => {})
}

/** Frequency magnitudes 0-255 for the visualizer. Returns null if no graph. */
export function getFrequencyData(): Uint8Array | null {
  if (!graph || !freqData) return null
  graph.analyser.getByteFrequencyData(freqData)
  return freqData
}

/** RMS level 0..1 of the current audio signal (for skip-silence). */
export function getRmsLevel(): number {
  if (!graph || !timeData || graph.sources.size === 0) return -1
  graph.analyser.getFloatTimeDomainData(timeData)
  let sum = 0
  for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i]
  return Math.sqrt(sum / timeData.length)
}

export function closeAudioGraph() {
  if (graph) {
    try { void graph.ctx.close() } catch { /* ignore */ }
    graph = null
  }
}
