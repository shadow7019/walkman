import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseSpotifyUrl, parseTextList, parseCSV,
  fetchSpotifyPlaylist, matchAll, type ParsedSong,
} from '@/lib/import'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/import
// { mode: 'spotify', url } | { mode: 'text', text, order? } | { mode: 'csv', text } | { mode: 'auto', text }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const mode: string = body.mode ?? 'auto'
  let songs: ParsedSong[] = []
  let source = 'Text list'
  let name = 'Imported Playlist'

  try {
    if (mode === 'spotify' || (mode === 'auto' && parseSpotifyUrl(body.url ?? body.text ?? ''))) {
      const id = parseSpotifyUrl(body.url ?? body.text ?? '')
      if (!id) return NextResponse.json({ error: 'Could not find a Spotify playlist ID in that link' }, { status: 400 })
      const fetched = await fetchSpotifyPlaylist(id)
      songs = fetched.songs
      name = fetched.name || 'Imported Spotify Playlist'
      source = 'Spotify'
    } else if (mode === 'csv' || (mode === 'auto' && /^\s*(track name|title|song)/i.test(body.text ?? ''))) {
      songs = parseCSV(body.text ?? '')
      source = 'CSV'
      name = body.name ?? 'Imported CSV Playlist'
    } else {
      const text = (body.text ?? '').toString()
      if (!text.trim()) return NextResponse.json({ error: 'Nothing to import' }, { status: 400 })
      songs = parseTextList(text, body.order === 'title-first' ? 'title-first' : 'artist-first')
      source = 'Text list'
      name = body.name ?? 'Imported Playlist'
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to read playlist' }, { status: 400 })
  }

  // cap huge playlists for the matching pass
  const cap = 150
  const capped = songs.slice(0, cap)
  const skipped = Math.max(0, songs.length - cap)
  if (!capped.length) return NextResponse.json({ error: 'No songs found in that input' }, { status: 400 })

  const matches = await matchAll(capped)
  const matched = matches.filter((m) => m.trackId)
  const notFound = matches.filter((m) => !m.trackId).map((m) => m.song.originalLine || `${m.song.artist} - ${m.song.title}`)

  const playlist = await db.playlist.create({
    data: {
      name: String(name).slice(0, 80),
      description: `Imported from ${source} · ${matched.length}/${capped.length} matched`,
      importedFrom: source,
      tracks: {
        create: matched.map((m, i) => ({ trackId: m.trackId!, position: i })),
      },
    },
  })

  return NextResponse.json({
    ok: true,
    playlistId: playlist.id,
    name: playlist.name,
    total: capped.length,
    matched: matched.length,
    notFound,
    skippedOverflow: skipped,
  })
}
