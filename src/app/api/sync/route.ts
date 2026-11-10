import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncCatalog, globalSeed, sweepArtists, spotifySync, deepArtistsSync, deepCrawlArtist, fullSongsSweep, type SweepProgress, type SpotifySyncProgress, type DeepSweepProgress, type FullSweepProgress } from '@/lib/catalog'
import { SPOTIFY_AUTO_PLAYLISTS, SPOTIFY_FLAGSHIP } from '@/lib/spotify'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Prevent concurrent seeds (background + manual at once)
const g = globalThis as unknown as {
  __walkmanSeeding?: boolean
  __artistSweep?: SweepProgress
  __spotifySeeding?: boolean
  __spotifySync?: SpotifySyncProgress
  __deepSweeping?: boolean
  __deepSweep?: DeepSweepProgress
  __fullSweeping?: boolean
  __fullSweep?: FullSweepProgress
}

async function thinArtistCount(): Promise<number> {
  const groups = await db.track.groupBy({ by: ['artist'], _count: { _all: true } })
  return groups.filter((gr) => gr._count._all <= 3).length
}

// GET /api/sync — last sync runs + counts + live sweep progress (artists, Spotify, discographies)
export async function GET() {
  const logs = await db.syncLog.findMany({ orderBy: { syncedAt: 'desc' }, take: 25 })
  const total = await db.track.count()
  const artists = await db.track.groupBy({ by: ['artist'], _count: { _all: true } })
  const last = logs[0]?.syncedAt ?? null
  const sweepLogs = await db.syncLog.findMany({ where: { source: 'artist-sweep' }, select: { scope: true } })
  const deepLogs = await db.syncLog.count({ where: { source: 'artist-deep' } })
  const fullLength = await db.track.count({ where: { hasFull: true } })
  const previewCount = await db.track.count({ where: { hasFull: false } })
  return NextResponse.json({
    logs,
    total,
    artistCount: artists.length,
    lastSyncedAt: last,
    seeding: !!g.__walkmanSeeding || !!g.__spotifySeeding || !!g.__deepSweeping || !!g.__fullSweeping,
    artistSweep: g.__artistSweep ?? { running: false, done: sweepLogs.length, total: 0, added: 0, current: '' },
    sweptArtists: sweepLogs.length,
    spotifySync: g.__spotifySync ?? { running: false, done: 0, total: 0, added: 0, current: '' },
    spotifyPlaylists: SPOTIFY_AUTO_PLAYLISTS.length,
    deepSweep: g.__deepSweep ?? { running: false, done: deepLogs, total: 0, added: 0, current: '' },
    deepCrawledArtists: deepLogs,
    thinArtists: await thinArtistCount(),
    fullSweep: g.__fullSweep ?? { running: false, done: 0, total: previewCount, added: 0, current: '' },
    fullLength,
    previewCount,
  })
}

// POST /api/sync — auto-add new songs now.
//   { mode: 'refresh' }        (default) — trending + genre charts + Spotify flagship charts (fast)
//   { mode: 'global' }         — sweep the whole world matrix (every language/genre), background
//   { mode: 'artists' }        — pull every major band/artist's songs (resumable), background
//   { mode: 'spotify' }        — sync every official Spotify chart/editorial playlist (resumable), background
//   { mode: 'artist-deep', artist } — complete ONE artist's discography (every album, every song)
//   { mode: 'deep-artists' }   — complete discographies for every under-covered artist (resumable), background
//   { mode: 'fullsongs' }      — convert all 30s previews to full-length 320 kbps streams (resumable), background
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const mode = ['global', 'artists', 'spotify', 'artist-deep', 'deep-artists', 'fullsongs'].includes(body.mode)
    ? body.mode
    : 'refresh'

  // full-song sweep talks to JioSaavn/Audius — safe to run alongside the
  // iTunes-driven sweeps; everything else is mutually exclusive.
  if (mode === 'fullsongs') {
    if (g.__fullSweeping) {
      return NextResponse.json({ ok: true, started: false, message: 'Full-song conversion is already running' })
    }
    g.__fullSweeping = true
    g.__fullSweep = { running: true, done: 0, total: 0, added: 0, current: 'Starting…' }
    void (async () => {
      try {
        await fullSongsSweep((p) => { g.__fullSweep = p })
      } catch (e) {
        console.error('full songs sweep failed', e)
      } finally {
        g.__fullSweeping = false
      }
    })()
    return NextResponse.json({ ok: true, started: true, message: 'Full-song conversion sweep started' })
  }

  if (g.__walkmanSeeding || g.__spotifySeeding || g.__deepSweeping) {
    return NextResponse.json({ ok: true, started: false, message: 'A catalog sweep is already running' })
  }

  if (mode === 'artist-deep') {
    const artist = String(body.artist ?? '').trim()
    if (!artist) return NextResponse.json({ ok: false, error: 'artist name required' }, { status: 400 })
    g.__deepSweeping = true
    g.__deepSweep = { running: true, done: 0, total: 1, added: 0, current: artist }
    void (async () => {
      try {
        const added = await deepCrawlArtist(artist)
        g.__deepSweep = { running: false, done: 1, total: 1, added, current: '' }
      } catch (e) {
        console.error('artist deep crawl failed', e)
        g.__deepSweep = { running: false, done: 0, total: 1, added: 0, current: '' }
      } finally {
        g.__deepSweeping = false
      }
    })()
    return NextResponse.json({ ok: true, started: true, message: `Completing ${artist}'s discography` })
  }

  if (mode === 'deep-artists') {
    g.__deepSweeping = true
    g.__deepSweep = { running: true, done: 0, total: 0, added: 0, current: 'Starting…' }
    void (async () => {
      try {
        await deepArtistsSync((p) => { g.__deepSweep = p })
      } catch (e) {
        console.error('deep artists sweep failed', e)
      } finally {
        g.__deepSweeping = false
      }
    })()
    return NextResponse.json({ ok: true, started: true, message: 'Discography completion sweep started' })
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
