import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { audiusHost } from '@/lib/audius'

export const dynamic = 'force-dynamic'

// GET /api/download/[id] — proxy the audio file so the browser can save it (no CORS issues)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const track = await db.track.findUnique({ where: { id } })
  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  let target: string | null = null
  if (track.source === 'audius' && track.sourceId) {
    const host = await audiusHost()
    target = `${host}/v1/tracks/${track.sourceId}/stream?app_name=Walkman`
  } else if (track.previewUrl) {
    target = track.previewUrl
  }
  if (!target) return NextResponse.json({ error: 'Not downloadable' }, { status: 404 })

  const upstream = await fetch(target, { signal: AbortSignal.timeout(30000) })
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Upstream failed' }, { status: 502 })
  }
  const safeName = `${track.artist} - ${track.title}`.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 80)
  const ext = track.source === 'audius' ? 'mp3' : 'm4a'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': track.source === 'audius' ? 'audio/mpeg' : 'audio/mp4',
      'Content-Disposition': `attachment; filename="${safeName}.${ext}"`,
    },
  })
}
