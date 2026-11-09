import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { GENRES, GENRE_COLORS } from '@/lib/genre'

export const dynamic = 'force-dynamic'

export async function GET() {
  const grouped = await db.track.groupBy({ by: ['genre'], _count: { genre: true } })
  const counts = new Map(grouped.map((g) => [g.genre, g._count.genre]))
  const genres = GENRES.map((g) => ({
    name: g,
    color: GENRE_COLORS[g] ?? 'from-neutral-500 to-neutral-800',
    count: counts.get(g) ?? 0,
  })).sort((a, b) => b.count - a.count)
  const total = await db.track.count()
  const fullLength = await db.track.count({ where: { hasFull: true } })
  return NextResponse.json({ genres, total, fullLength })
}
