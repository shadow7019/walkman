import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncCatalog, globalSeed } from '@/lib/catalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Prevent concurrent global seeds (background + manual at once)
const g = globalThis as unknown as { __walkmanSeeding?: boolean }

// GET /api/sync — last sync runs + counts
export async function GET() {
  const logs = await db.syncLog.findMany({ orderBy: { syncedAt: 'desc' }, take: 25 })
  const total = await db.track.count()
  const last = logs[0]?.syncedAt ?? null
  return NextResponse.json({ logs, total, lastSyncedAt: last, seeding: !!g.__walkmanSeeding })
}

// POST /api/sync — auto-add new songs now.
//   { mode: 'refresh' } (default) — trending + genre charts (fast)
//   { mode: 'global' }  — sweep the whole world matrix (every language/genre), runs in background
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const mode = body.mode === 'global' ? 'global' : 'refresh'

  if (mode === 'global') {
    if (g.__walkmanSeeding) {
      return NextResponse.json({ ok: true, started: false, message: 'A global sweep is already running' })
    }
    g.__walkmanSeeding = true
    // run in the background so the request returns immediately
    void (async () => {
      try {
        await globalSeed()
      } catch (e) {
        console.error('global seed failed', e)
      } finally {
        g.__walkmanSeeding = false
      }
    })()
    return NextResponse.json({ ok: true, started: true, message: 'Global catalog sweep started' })
  }

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
