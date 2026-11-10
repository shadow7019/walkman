import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

// GET /api/explore — rows for Explore: moods, trending (full-length), new releases, featured genres
export async function GET() {
  const [moods, trending, newReleases, undergroundFull] = await Promise.all([
    db.track.groupBy({ by: ['mood'], _count: { mood: true }, where: { mood: { not: '' } } }),
    db.track.findMany({ where: { hasFull: true }, orderBy: { playCount: 'desc' }, take: 20 }),
    db.track.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.track.findMany({ where: { source: 'audius' }, orderBy: { favoriteCount: 'desc' }, take: 20 }),
  ])
  const playlists = await db.playlist.findMany({ orderBy: { updatedAt: 'desc' }, take: 6 })
  return NextResponse.json({
    moods: moods.map((m) => ({ name: m.mood, count: m._count.mood })).sort((a, b) => b.count - a.count),
    trending: trending.map(trackDTO),
    newReleases: newReleases.map(trackDTO),
    underground: undergroundFull.map(trackDTO),
    playlists: playlists.map((p) => ({ id: p.id, name: p.name, description: p.description, gradient: p.gradient, importedFrom: p.importedFrom })),
  })
}
