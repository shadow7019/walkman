import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'
import { fanOutSearch } from '@/lib/catalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/search?q=&type=suggest|full&extend=1
// Local DB search first; optionally fan out to industry sources (iTunes + Audius)
// to permanently extend the catalog — "all the music in the industry".
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const extend = sp.get('extend') !== '0'
  const type = sp.get('type') ?? 'full'
  if (!q) return NextResponse.json({ tracks: [], extended: 0 })

  const local = await db.track.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { artist: { contains: q } },
        { album: { contains: q } },
      ],
    },
    orderBy: { playCount: 'desc' },
    take: 40,
  })

  let extended = 0
  let results = local.map(trackDTO)
  if (extend && type !== 'suggest' && local.length < 12) {
    extended = await fanOutSearch(q, 15)
    if (extended > 0) {
      const merged = await db.track.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
            { album: { contains: q } },
          ],
        },
        orderBy: [{ hasFull: 'desc' }, { playCount: 'desc' }],
        take: 60,
      })
      results = merged.map(trackDTO)
    }
  }
  return NextResponse.json({ tracks: results, extended, local: local.length })
}
