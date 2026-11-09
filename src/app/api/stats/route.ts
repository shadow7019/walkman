import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/stats?period=week|month|year|all — Replay listening statistics
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period') ?? 'month'
  const now = new Date()
  let since = new Date(0)
  if (period === 'week') since = new Date(now.getTime() - 7 * 86400000)
  if (period === 'month') since = new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'year') since = new Date(now.getFullYear(), 0, 1)

  const where = { playedAt: { gte: since } }
  const [events, totalEvents] = await Promise.all([
    db.playHistory.findMany({ where, include: { track: true }, orderBy: { playedAt: 'asc' } }),
    db.playHistory.count({ where }),
  ])

  const msTotal = events.reduce((a, e) => a + e.msPlayed, 0)
  const uniqueTracks = new Set(events.map((e) => e.trackId)).size

  // top songs / artists / albums
  const songCount = new Map<string, { count: number; ms: number; track: typeof events[number]['track'] }>()
  const artistCount = new Map<string, { count: number; ms: number }>()
  const albumCount = new Map<string, { count: number; ms: number }>()
  const hourBuckets = new Array(24).fill(0) as number[]
  const dayBuckets: { day: string; ms: number; plays: number }[] = []
  const dayMap = new Map<string, { ms: number; plays: number }>()

  for (const e of events) {
    const s = songCount.get(e.trackId) ?? { count: 0, ms: 0, track: e.track }
    s.count++; s.ms += e.msPlayed; songCount.set(e.trackId, s)
    const a = artistCount.get(e.track.artist) ?? { count: 0, ms: 0 }
    a.count++; a.ms += e.msPlayed; artistCount.set(e.track.artist, a)
    const al = albumCount.get(e.track.album || e.track.title) ?? { count: 0, ms: 0 }
    al.count++; al.ms += e.msPlayed; albumCount.set(e.track.album || e.track.title, al)
    hourBuckets[e.hour] += e.msPlayed
    const day = e.playedAt.toISOString().slice(0, 10)
    const d = dayMap.get(day) ?? { ms: 0, plays: 0 }
    d.ms += e.msPlayed; d.plays++; dayMap.set(day, d)
  }

  // listening streak (consecutive days with ≥1 completed-ish listen)
  const days = [...dayMap.keys()].sort()
  let streak = 0
  if (days.length) {
    streak = 1
    for (let i = days.length - 1; i > 0; i--) {
      const diff = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000
      if (diff <= 1.5) streak++
      else break
    }
  }

  const day28: { day: string; ms: number; plays: number }[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
    const v = dayMap.get(d)
    day28.push({ day: d, ms: v?.ms ?? 0, plays: v?.plays ?? 0 })
  }

  const topBy = <K, V extends { count: number; ms: number }>(m: Map<K, V>, n: number) =>
    [...m.entries()].sort((x, y) => y[1].ms - x[1].ms || y[1].count - x[1].count).slice(0, n)

  return NextResponse.json({
    period,
    minutes: Math.round(msTotal / 60000),
    plays: totalEvents,
    uniqueTracks,
    streak,
    topSongs: topBy(songCount, 10).map(([_, v]) => ({ track: trackDTO(v.track), plays: v.count, ms: v.ms })),
    topArtists: topBy(artistCount, 10).map(([name, v]) => ({ name, plays: v.count, ms: v.ms })),
    topAlbums: topBy(albumCount, 5).map(([name, v]) => ({ name, plays: v.count, ms: v.ms })),
    hourOfDay: hourBuckets,
    activity: day28,
  })
}
