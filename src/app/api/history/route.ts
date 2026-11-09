import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/history — recent plays
export async function GET() {
  const events = await db.playHistory.findMany({
    orderBy: { playedAt: 'desc' },
    include: { track: true },
    take: 100,
  })
  // dedupe by track id, keep most recent
  const seen = new Set<string>()
  const tracks = events
    .filter((e) => (seen.has(e.trackId) ? false : seen.add(e.trackId)))
    .map((e) => trackDTO(e.track))
  return NextResponse.json({ tracks })
}

// POST /api/history { trackId, msPlayed, completed } — record a listen (≥30s counts)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { trackId, msPlayed = 0, completed = false } = body
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })
  if (msPlayed < 30000 && !completed) return NextResponse.json({ ok: false, reason: 'too short' })
  const hour = new Date().getHours()
  await db.playHistory.create({ data: { trackId, msPlayed, completed, hour } })
  await db.track.update({ where: { id: trackId }, data: { playCount: { increment: 1 } } })
  return NextResponse.json({ ok: true })
}
