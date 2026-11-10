import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/languages — every language in the catalog with counts + sample covers
export async function GET() {
  const grouped = await db.track.groupBy({ by: ['language'], _count: { language: true } })
  const sorted = grouped
    .map((g) => ({ name: g.language, count: g._count.language }))
    .sort((a, b) => b.count - a.count)

  // one representative cover per language (few quick lookups, SQLite is local)
  const withCovers = await Promise.all(
    sorted.slice(0, 40).map(async (l) => {
      const sample = await db.track.findFirst({
        where: { language: l.name, cover: { not: '' } },
        orderBy: { playCount: 'desc' },
        select: { cover: true },
      })
      return { ...l, cover: sample?.cover ?? '' }
    })
  )

  const total = await db.track.count()
  return NextResponse.json({ languages: withCovers, total, languageCount: sorted.length })
}
