import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncCatalog } from '@/lib/catalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/sync — last sync runs + counts
export async function GET() {
  const logs = await db.syncLog.findMany({ orderBy: { syncedAt: 'desc' }, take: 25 })
  const total = await db.track.count()
  const last = logs[0]?.syncedAt ?? null
  return NextResponse.json({ logs, total, lastSyncedAt: last })
}

// POST /api/sync — run auto-add-new-songs sync now (Audius trending/latest + iTunes genre charts)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const trendingLimit = Math.min(Number(body.trendingLimit) || 50, 100)
  const perGenreLimit = Math.min(Number(body.perGenreLimit) || 20, 50)
  const result = await syncCatalog({ trendingLimit, perGenreLimit })
  return NextResponse.json({
    ok: true,
    added: result.added,
    updated: result.updated,
    total: await db.track.count(),
    logs: result.logs,
  })
}
