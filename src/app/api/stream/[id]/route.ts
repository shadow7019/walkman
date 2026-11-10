import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { audiusHost } from '@/lib/audius'
import { enrichTrackFull } from '@/lib/catalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tracks we recently failed to upgrade — retried after 10 minutes, so
// transient API hiccups never permanently downgrade a song to preview.
const g = globalThis as unknown as { __noFullSongs?: Map<string, number> }
// hot-reload safe: an older build may have left a different structure here
if (!(g.__noFullSongs instanceof Map)) g.__noFullSongs = new Map()
const noFull = g.__noFullSongs
const TTL_MS = 10 * 60 * 1000
function recentlyFailed(id: string): boolean {
  const at = noFull.get(id)
  if (!at) return false
  if (Date.now() - at > TTL_MS) {
    noFull.delete(id)
    return false
  }
  return true
}

// GET /api/stream/[id]?q=auto|full|saver — resolve the best audio for a track.
// Always tries to serve a FULL-length stream: tracks without one are lazily
// upgraded on play (Audius + JioSaavn in parallel, persisted), then we fall
// back to the 256 kbps AAC preview only if no full source exists.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const q = req.nextUrl.searchParams.get('q') ?? 'auto'
  const track = await db.track.findUnique({ where: { id } })
  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  const wantSaver = q === 'saver'
  const wantFull = q === 'full' || q === 'auto'

  let target: string | null = null

  // full-length first (unless data-saver mode)
  if (wantFull && track.hasFull && track.streamUrl) {
    if (track.source === 'audius') {
      const host = await audiusHost()
      target = `${host}/v1/tracks/${track.sourceId}/stream?app_name=Walkman`
    } else {
      target = track.streamUrl
    }
  }

  // lazy enrichment: upgrade a preview to a full song right now (persisted)
  if (!target && wantFull && !wantSaver && !recentlyFailed(id)) {
    const result = await enrichTrackFull(id).catch(() => 'none' as const)
    if (result === 'full') {
      const fresh = await db.track.findUnique({ where: { id }, select: { streamUrl: true, source: true, sourceId: true } })
      if (fresh?.streamUrl) {
        target = fresh.source === 'audius' && fresh.sourceId
          ? `${await audiusHost()}/v1/tracks/${fresh.sourceId}/stream?app_name=Walkman`
          : fresh.streamUrl
      }
    } else if (result === 'none') {
      noFull.set(id, Date.now()) // retryable after TTL
    }
  }

  if (!target && wantSaver && track.previewUrl) target = track.previewUrl
  if (!target && track.previewUrl) target = track.previewUrl
  if (!target && track.streamUrl) target = track.streamUrl
  if (!target) return NextResponse.json({ error: 'No playable audio for this track' }, { status: 404 })

  // bump playCount (lightweight stat)
  db.track.update({ where: { id }, data: { playCount: { increment: 1 } } }).catch(() => {})
  return NextResponse.redirect(target, 302)
}
