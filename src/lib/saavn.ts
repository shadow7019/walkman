// JioSaavn full-song provider — official 320 kbps full-length streams.
// Uses JioSaavn's public web API (search.getResults) and decrypts the media
// URL with the well-known public key. Tracks are matched with STRICT artist
// verification so covers/nightcores never replace the official song.
import crypto from 'node:crypto'
// Pure-JS DES fallback: Node ≥17 ships OpenSSL 3 which disables DES-ECB
// (legacy provider) — des.js keeps decryption working everywhere.
import { DES } from 'des.js'

export interface SaavnSong {
  id: string
  title: string
  artist: string
  album: string
  durationSec: number
  language: string
  year?: number
  fullUrl320: string
  image: string
}

interface SaavnRawSong {
  id?: string
  title?: string
  subtitle?: string
  image?: string
  more_info?: {
    encrypted_media_url?: string
    duration?: string
    album?: string
    primary_artists?: string
    artistMap?: { primary_artists?: { name?: string }[]; artists?: { name?: string }[] }
    release_date?: string
    language?: string
  }
}

// JioSaavn's public DES-ECB key for media URLs (公开信息, used by every
// open-source JioSaavn client).
const SAAVN_KEY = '38346591'

function decryptUrl(encrypted: string): string {
  const data = Buffer.from(encrypted, 'base64')
  // 1) native OpenSSL path (works under Bun / legacy-enabled Node)
  try {
    const d = crypto.createDecipheriv('des-ecb', Buffer.from(SAAVN_KEY), null)
    d.setAutoPadding(true)
    return Buffer.concat([d.update(data), d.final()]).toString('utf8')
  } catch { /* OpenSSL 3: des-ecb unsupported — fall through to pure JS */ }
  // 2) pure-JS DES-ECB (PKCS#7 padding) — no OpenSSL involved
  const engine = DES.create({ type: 'decrypt', key: Buffer.from(SAAVN_KEY, 'utf8') })
  const out = Buffer.concat([Buffer.from(engine.update(data)), Buffer.from(engine.final?.() ?? [])])
  if (out.length === 0) throw new Error('des decrypt failed')
  // PKCS#7 unpad
  const pad = out[out.length - 1]
  const trimmed = pad >= 1 && pad <= 8 && out.length >= pad ? out.subarray(0, out.length - pad) : out
  return trimmed.toString('utf8')
}

// Upgrade the decrypted base URL (default _96[.mp4]) to the best quality.
export function saavnFullUrl(encrypted: string, quality: '320' | '160' | '96' = '320'): string {
  const base = decryptUrl(encrypted)
  return base.replace(/_(?:96|160|320)(\.mp4)?$/, `_${quality}$1`)
}

const foldName = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function tokens(name: string): string[] {
  return foldName(name).split(/[^a-z0-9]+/).filter((t) => t.length > 1)
}

const stripFeat = (s: string) => (s || '').replace(/\s*[([]?(?:feat|ft|with)\.?\s+[^)\]]*[)\]]?/gi, '').trim()

// Strict title + artist verification. Returns true only for the official act.
export function saavnMatchScore(title: string, artist: string, song: { title: string; artist: string }): number {
  const nt = foldName(stripFeat(title)).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  const st = foldName(stripFeat(song.title)).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  if (!nt || !st) return 0
  const titleOk = nt === st || (nt.length > 4 && st.length > 4 && (nt.includes(st) || st.includes(nt)))
  if (!titleOk) return 0
  const at = tokens(artist)
  const sa = foldName(song.artist)
  const allTokensIn = at.every((t) => sa.includes(t))
  if (at.length && allTokensIn) return 95
  if (!at.length) return 60
  return 0
}

async function saavnApi(call: string, params: Record<string, string>): Promise<SaavnRawSong[]> {
  const p = new URLSearchParams({ __call: call, _format: 'json', _marker: '0', api_version: '4', ctx: 'web6dot0', ...params })
  const r = await fetch(`https://www.jiosaavn.com/api.php?${p}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
    signal: AbortSignal.timeout(12000),
  })
  if (!r.ok) throw new Error(`saavn ${r.status}`)
  const j = (await r.json()) as { results?: SaavnRawSong[] }
  return j.results ?? []
}

function toSong(raw: SaavnRawSong): SaavnSong | null {
  const mi = raw.more_info
  if (!mi?.encrypted_media_url) return null
  const artist =
    (mi.artistMap?.primary_artists ?? []).map((a) => a.name).filter(Boolean).join(', ') ||
    mi.primary_artists ||
    (mi.artistMap?.artists ?? []).map((a) => a.name).filter(Boolean).join(', ') ||
    raw.subtitle ||
    ''
  const year = mi.release_date ? Number(mi.release_date.slice(0, 4)) : undefined
  return {
    id: raw.id ?? '',
    title: (raw.title ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
    artist,
    album: (mi.album ?? '').replace(/&quot;/g, '"'),
    durationSec: Math.round(Number(mi.duration ?? 0)),
    language: mi.language ?? '',
    year: Number.isFinite(year) ? year : undefined,
    fullUrl320: saavnFullUrl(mi.encrypted_media_url, '320'),
    image: (raw.image ?? '').replace('150x150', '500x500'),
  }
}

// Search JioSaavn for a song and return the best STRICT match (official artist only).
export async function matchSaavnTrack(title: string, artist: string): Promise<SaavnSong | null> {
  if (!title) return null
  const query = `${stripFeat(title)} ${stripFeat(artist)}`.trim()
  let results: SaavnRawSong[]
  try {
    results = await saavnApi('search.getResults', { q: query, n: '8' })
  } catch {
    return null
  }
  let best: { song: SaavnSong; score: number } | null = null
  for (const raw of results) {
    const song = toSong(raw)
    if (!song || !song.fullUrl320) continue
    const score = saavnMatchScore(title, artist, song)
    if (score > (best?.score ?? 0)) best = { song, score }
  }
  return best ? best.song : null
}

// General search — every result that decrypts to a real 320 kbps stream.
// Used for scene fan-outs ("Desi Hip Hop", city cyphers, label compilations…).
export async function saavnSearchSongs(query: string, limit = 30): Promise<SaavnSong[]> {
  if (!query) return []
  let results: SaavnRawSong[]
  try {
    results = await saavnApi('search.getResults', { q: query, n: String(Math.min(limit, 50)) })
  } catch {
    return []
  }
  const out: SaavnSong[] = []
  for (const raw of results) {
    const song = toSong(raw)
    if (song?.fullUrl320) out.push(song)
  }
  return out
}

// Every song JioSaavn indexes for one artist (their search index doubles as the
// artist's top-catalog). Strict token verification keeps soundalikes out.
export async function saavnArtistSongs(artist: string, limit = 40): Promise<SaavnSong[]> {
  if (!artist) return []
  const at = tokens(artist)
  let results: SaavnRawSong[]
  try {
    results = await saavnApi('search.getResults', { q: artist, n: String(Math.min(limit, 50)) })
  } catch {
    return []
  }
  const out: SaavnSong[] = []
  for (const raw of results) {
    const song = toSong(raw)
    if (!song?.fullUrl320 || !song.artist) continue
    const sa = foldName(song.artist)
    const credited = at.length > 0 && at.every((t) => sa.includes(t))
    if (credited) out.push(song)
  }
  return out
}
