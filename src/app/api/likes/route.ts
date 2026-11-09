import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/likes — liked songs
export async function GET() {
  const likes = await db.like.findMany({
    orderBy: { createdAt: 'desc' },
    include: { track: true },
    take: 500,
  })
  return NextResponse.json({ tracks: likes.map((l) => trackDTO(l.track)) })
}

// POST /api/likes { trackId } — toggle
export async function POST(req: NextRequest) {
  const { trackId } = await req.json().catch(() => ({}))
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 })
  const existing = await db.like.findUnique({ where: { trackId } })
  if (existing) {
    await db.like.delete({ where: { trackId } })
    return NextResponse.json({ liked: false })
  }
  await db.like.create({ data: { trackId } })
  return NextResponse.json({ liked: true })
}
