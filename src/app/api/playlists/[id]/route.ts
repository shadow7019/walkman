import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/playlists/[id] — detail with tracks
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const p = await db.playlist.findUnique({
    where: { id },
    include: { tracks: { orderBy: { position: 'asc' }, include: { track: true } } },
  })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    playlist: {
      id: p.id, name: p.name, description: p.description, gradient: p.gradient,
      importedFrom: p.importedFrom, isSystem: p.isSystem, createdAt: p.createdAt, updatedAt: p.updatedAt,
    },
    tracks: p.tracks.map((pt) => trackDTO(pt.track)),
  })
}

// PATCH /api/playlists/[id] { name?, description? }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const data: Record<string, string> = {}
  if (body.name !== undefined) data.name = String(body.name).slice(0, 80) || 'Untitled'
  if (body.description !== undefined) data.description = String(body.description).slice(0, 300)
  const p = await db.playlist.update({ where: { id }, data })
  return NextResponse.json({ playlist: p })
}

// DELETE /api/playlists/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.playlist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// POST /api/playlists/[id] { trackId } — add track
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const trackId = body.trackId as string
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })
  const last = await db.playlistTrack.findFirst({ where: { playlistId: id }, orderBy: { position: 'desc' } })
  const pt = await db.playlistTrack.create({
    data: { playlistId: id, trackId, position: (last?.position ?? -1) + 1 },
  }).catch(() => null)
  if (!pt) return NextResponse.json({ ok: false, error: 'Already in playlist' }, { status: 409 })
  await db.playlist.update({ where: { id }, data: { updatedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

// PUT /api/playlists/[id] { removeTrackId } or { order: [entryIds] }
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  if (body.removeTrackId) {
    await db.playlistTrack.deleteMany({ where: { playlistId: id, trackId: body.removeTrackId } })
  }
  if (Array.isArray(body.order)) {
    await Promise.all(
      (body.order as string[]).map((entryId, i) =>
        db.playlistTrack.updateMany({ where: { id: entryId }, data: { position: i } })
      )
    )
  }
  await db.playlist.update({ where: { id }, data: { updatedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
