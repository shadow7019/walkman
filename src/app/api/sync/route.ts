import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncCatalog, globalSeed, sweepArtists, spotifySync, type SweepProgress, type SpotifySyncProgress } from '@/lib/catalog'
import { SPOTIFY_AUTO_PLAYLISTS, SPOTIFY_FLAGSHIP } from '@/lib/spotify'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Prevent concurrent seeds (background + manual at once)
const g = globalThis as unknown as {
  __walkmanSeeding?: boolean
  __artistSweep?: SweepProgress
  __spotifySeeding?: boolean
  __spotifySync?: SpotifySyncProgress
}

// GET /api/sync — last sync runs + counts + live sweep progress (artists & Spotify)
export async function GET() {
  const logs = await db.syncLog.findMany({ orderBy: { syncedAt: 'desc' }, take: 25 })
  const total = await db.track.count()
  const artists = await db.track.groupBy({ by: ['artist'], _count: { _all: true } })
  const last = logs[0]?.syncedAt ?? null
  const sweepLogs = await db.syncLog.findMany({ where: { source: 'artist-sweep' }, select: { scope: true } })
  return NextResponse.json({
    logs,
    total,
    artistCount: artists.length,
    lastSyncedAt: last,
    seeding: !!g.__walkmanSeeding || !!g.__spotifySeeding,
    artistSweep: g.__artistSweep ?? { running: false, done: sweepLogs.length, total: 0, added: 0, current: '' },
    sweptArtists: sweepLogs.length,
    spotifySync: g.__spotifySync ?? { running: false, done: 0, total: 0, added: 0, current: '' },
    spotifyPlaylists: SPOTIFY_AUTO_PLAYLISTS.length,
  })
}

// POST /api/sync — auto-add new songs now.
//   { mode: 'refresh' }  (default) — trending + genre charts + Spotify flagship charts (fast)
//   { mode: 'global' }   — sweep the whole world matrix (every language/genre), runs in background
//   { mode: 'artists' }  — pull every major band/artist's songs (resumable), runs in background
//   { mode: 'spotify' }  — sync every official Spotify chart/editorial playlist (resumable), background
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const mode = ['global', 'artists', 'spotify'].includes(body.mode) ? body.mode : 'refresh'

  if (g.__walkmanSeeding || g.__spotifySeeding) {
    return NextResponse.json({ ok: true, started: false, message: 'A catalog sweep is already running' })
  }

  if (mode === 'global') {
    g.__walkmanSeeding = true
    g.__artistSweep = { running: false, done: 0, total: 0, added: 0, current: 'Global world matrix…' }
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

  if (mode === 'artists') {
    g.__walkmanSeeding = true
    g.__artistSweep = { running: true, done: 0, total: 0, added: 0, current: 'Starting…' }
    void (async () => {
      try {
        await sweepArtists((p) => { g.__artistSweep = p })
      } catch (e) {
        console.error('artist sweep failed', e)
      } finally {
        g.__walkmanSeeding = false
      }
    })()
    return NextResponse.json({ ok: true, started: true, message: 'Artist & band sweep started' })
  }

  if (mode === 'spotify') {
    g.__spotifySeeding = true
    g.__spotifySync = { running: true, done: 0, total: 0, added: 0, current: 'Starting…' }
    void (async () => {
      try {
        await spotifySync((p) => { g.__spotifySync = p })
      } catch (e) {
        console.error('spotify sync failed', e)
      } finally {
        g.__spotifySeeding = false
      }
    })()
    return NextResponse.json({ ok: true, started: true, message: 'Spotify charts sync started' })
  }

  // refresh (default) — fast catalog refresh; Spotify flagship charts sync in
  // the background so "Sync now" always pulls Spotify's newest hits too.
  const trendingLimit = Math.min(Number(body.trendingLimit) || 50, 100)
  const perGenreLimit = Math.min(Number(body.perGenreLimit) || 20, 50)
  const result = await syncCatalog({ trendingLimit, perGenreLimit })

  if (!g.__spotifySeeding) {
    g.__spotifySeeding = true
    g.__spotifySync = { running: true, done: 0, total: 0, added: 0, current: 'Spotify charts…' }
    void (async () => {
      try {
        await spotifySync((p) => { g.__spotifySync = p }, SPOTIFY_FLAGSHIP)
      } catch (e) {
        console.error('spotify flagship sync failed', e)
      } finally {
        g.__spotifySeeding = false
      }
    })()
  }

  return NextResponse.json({
    ok: true,
    added: result.added,
    updated: result.updated,
    total: await db.track.count(),
    logs: result.logs,
  })
}
