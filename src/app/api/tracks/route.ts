import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/tracks?genre=&mood=&source=&hasFull=&q=&sort=&limit=&offset=&ids=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const genre = sp.get('genre')
  const mood = sp.get('mood')
  const source = sp.get('source')
  const hasFull = sp.get('hasFull')
  const q = sp.get('q')
  const ids = sp.get('ids')
  const sort = sp.get('sort') ?? 'recent' // recent | plays | title | artist | random
  const limit = Math.min(parseInt(sp.get('limit') ?? '50', 10), 200)
  const offset = parseInt(sp.get('offset') ?? '0', 10)

  const where: Record<string, unknown> = {}
  if (genre) where.genre = { in: genre.split(',') }
  if (mood) where.mood = mood
  if (source) where.source = source
  if (hasFull === '1') where.hasFull = true
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { artist: { contains: q } },
      { album: { contains: q } },
    ]
  }
  if (ids) {
    const idList = ids.split(',').filter(Boolean)
    const rows = await db.track.findMany({ where: { id: { in: idList } } })
    // preserve caller's order
    const byId = new Map(rows.map((r) => [r.id, r]))
    return NextResponse.json({ tracks: idList.map((i) => byId.get(i)).filter(Boolean).map((t) => trackDTO(t!)) })
  }

  let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }
  if (sort === 'plays') orderBy = { playCount: 'desc' }
  if (sort === 'title') orderBy = { title: 'asc' }
  if (sort === 'artist') orderBy = { artist: 'asc' }

  const [rows, total] = await Promise.all([
    sort === 'random'
      ? db.track.findMany({ where, take: limit })
      : db.track.findMany({ where, orderBy, take: limit, skip: offset }),
    db.track.count({ where }),
  ])

  let tracks = rows.map(trackDTO)
  if (sort === 'random') tracks = tracks.sort(() => Math.random() - 0.5)
  return NextResponse.json({ tracks, total })
}
