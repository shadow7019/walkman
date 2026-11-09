import { NextRequest, NextResponse } from 'next/server'
import { fetchLyrics } from '@/lib/lrclib'

export const dynamic = 'force-dynamic'

// GET /api/lyrics?title=&artist=&durationSec=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const title = sp.get('title') ?? ''
  const artist = sp.get('artist') ?? ''
  const durationSec = Number(sp.get('durationSec')) || undefined
  if (!title || !artist) return NextResponse.json({ error: 'title and artist required' }, { status: 400 })
  const cleanedArtist = artist.replace(/\s*[,&]\s*.*$/, (m) => (m.length > 40 ? '' : m))
  const result = await fetchLyrics(title.replace(/\(.*?\)/g, '').trim(), cleanedArtist, durationSec)
  return NextResponse.json(result)
}
