import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const GRADIENTS = [
  'from-emerald-500 to-teal-700', 'from-rose-500 to-red-700', 'from-amber-500 to-orange-700',
  'from-violet-500 to-purple-800', 'from-cyan-500 to-blue-700', 'from-lime-500 to-green-700',
  'from-fuchsia-500 to-pink-700', 'from-orange-500 to-amber-800',
]

// GET /api/playlists — list all
export async function GET() {
  const playlists = await db.playlist.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { tracks: { orderBy: { position: 'asc' }, include: { track: { select: { cover: true, genre: true } } } } },
  })
  return NextResponse.json({
    playlists: playlists.map((p) => ({
      id: p.id, name: p.name, description: p.description, gradient: p.gradient,
      importedFrom: p.importedFrom, isSystem: p.isSystem,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
      trackCount: p.tracks.length,
      covers: p.tracks.slice(0, 4).map((t) => t.track.cover),
      genres: [...new Set(p.tracks.slice(0, 20).map((t) => t.track.genre))].slice(0, 3),
    })),
  })
}

// POST /api/playlists { name, description? } — create
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = (body.name ?? 'New Playlist').toString().slice(0, 80)
  const description = (body.description ?? '').toString().slice(0, 300)
  const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)]
  const p = await db.playlist.create({ data: { name, description, gradient } })
  return NextResponse.json({ playlist: p })
}
