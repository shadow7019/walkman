// LRCLIB client — free synced lyrics (no API key)
// Docs: https://lrclib.net/docs
export interface LyricLine {
  time: number // seconds
  text: string
}

export interface LyricsResult {
  plain: string | null
  synced: LyricLine[] | null
  source: string
}

// Parse LRC-format lyrics: [mm:ss.xx] text
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  const re = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g
  for (const raw of lrc.split('\n')) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    let firstTime = -1
    while ((m = re.exec(raw))) {
      const min = parseInt(m[1], 10)
      const sec = parseFloat(m[2].replace(':', '.'))
      const t = min * 60 + sec
      if (firstTime < 0) firstTime = t
      lines.push({ time: t, text: raw.slice(m.index + m[0].length).trim() })
    }
    // no timestamp → plain line attached to previous time
    if (firstTime < 0 && lines.length > 0 && raw.trim()) {
      lines.push({ time: lines[lines.length - 1].time, text: raw.trim() })
    }
  }
  return lines.filter((l) => l.text).sort((a, b) => a.time - b.time)
}

export async function fetchLyrics(title: string, artist: string, durationSec?: number): Promise<LyricsResult> {
  const headers = { 'User-Agent': 'Walkman v1.0 (https://walkman.app)' }
  const urls: string[] = []
  if (durationSec && durationSec > 0) {
    urls.push(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}&duration=${Math.round(durationSec)}`
    )
  }
  urls.push(`https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`)
  urls.push(`https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`)

  for (const u of urls) {
    try {
      const r = await fetch(u, { headers, signal: AbortSignal.timeout(10000) })
      if (!r.ok) continue
      const j = await r.json()
      const best: Record<string, unknown> | null = Array.isArray(j) ? pickBest(j, durationSec) : j
      if (!best) continue
      const synced = (best.syncedLyrics as string) || ''
      const plain = (best.plainLyrics as string) || ''
      if (synced || plain) {
        const lines = synced ? parseLrc(synced) : null
        if ((lines && lines.length > 0) || plain) {
          return {
            plain: plain || null,
            synced: lines && lines.length > 0 ? lines : null,
            source: 'LRCLIB',
          }
        }
      }
    } catch { /* try next */ }
  }
  return { plain: null, synced: null, source: '' }
}

function pickBest(list: Record<string, unknown>[], durationSec?: number): Record<string, unknown> | null {
  if (!list.length) return null
  let best = list[0]
  let bestScore = -1
  for (const c of list) {
    let score = 0
    if (c.syncedLyrics) score += 10
    if (durationSec && Math.abs(Number(c.duration) - durationSec) < 4) score += 8
    if (c.instrumental === false) score += 1
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}
