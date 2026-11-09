import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { audiusHost } from '@/lib/audius'

export const dynamic = 'force-dynamic'

// GET /api/stream/[id]?q=auto|full|saver — resolve the best audio for a track.
// HI-FI full-length stream (Audius 320kbps) when available; 256kbps AAC preview
// otherwise, or immediately in data-saver mode.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const q = req.nextUrl.searchParams.get('q') ?? 'auto'
  const track = await db.track.findUnique({ where: { id } })
  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  let target: string | null = null
  const wantSaver = q === 'saver'
  const wantFull = q === 'full'

  if (wantSaver && track.previewUrl) {
    target = track.previewUrl
  } else if (track.source === 'audius' && track.sourceId) {
    const host = await audiusHost()
    target = `${host}/v1/tracks/${track.sourceId}/stream?app_name=Walkman`
  } else if (track.previewUrl) {
    target = track.previewUrl
  } else if (track.streamUrl) {
    target = track.streamUrl
  }
  if (!target) return NextResponse.json({ error: 'No playable audio for this track' }, { status: 404 })

  // bump playCount (lightweight stat)
  db.track.update({ where: { id }, data: { playCount: { increment: 1 } } }).catch(() => {})
  return NextResponse.redirect(target, 302)
}
