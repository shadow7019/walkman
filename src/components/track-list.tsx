'use client'

// Shared track table used by every view: play, like, queue, playlist-add, download.
import { useMemo } from 'react'
import { Pause, Play, Heart, MoreHorizontal, ListPlus, ListStart, Download, Radio, ListMusic, Disc3, X } from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useLibrary } from '@/stores/library'
import { useUI } from '@/stores/ui'
import { Cover } from '@/components/cover'
import { fmtTime, type Track } from '@/types'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

export function TrackList({ tracks, contextTitle, showAlbum = true, showIndex = true, onPlayIndex, onRemoveRow }: {
  tracks: Track[]
  contextTitle: string
  showAlbum?: boolean
  showIndex?: boolean
  onPlayIndex?: (index: number) => void
  onRemoveRow?: (trackId: string) => void
}) {
  const { queue, queueIndex, isPlaying, playQueue, playPause, playTrackAt, playNext, addToQueue } = usePlayer()
  const { likedIds, toggleLike, playlists, refreshPlaylists } = useLibrary()
  const { toast, navigate, openAddToPlaylist } = useUI()

  const current = queue[queueIndex]

  const handlePlay = (index: number) => {
    if (onPlayIndex) { onPlayIndex(index); return }
    if (current?.id === tracks[index]?.id) { playPause(); return }
    playQueue(tracks, index, contextTitle)
  }

  const download = async (t: Track) => {
    toast(`Downloading "${t.title}"…`)
    const a = document.createElement('a')
    a.href = api_download(t.id)
    a.download = `${t.artist} - ${t.title}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="w-full" role="table" aria-label={`${contextTitle} tracks`}>
      <div className="hidden grid-cols-[16px_1fr_auto] gap-4 border-b border-border/60 px-4 pb-2 text-xs uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[16px_minmax(0,4fr)_minmax(0,3fr)_auto]"
        style={showAlbum ? undefined : { gridTemplateColumns: '16px minmax(0,4fr) auto' }}
        role="row"
      >
        <span aria-hidden>{showIndex ? '#' : ''}</span>
        <span>Title</span>
        {showAlbum && <span>Album</span>}
        <span className="text-right pr-10">Duration</span>
      </div>
      <div>
        {tracks.map((t, i) => {
          const isCurrent = current?.id === t.id
          const liked = likedIds.has(t.id)
          return (
            <div
              key={`${t.id}-${i}`}
              role="row"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePlay(i)
              }}
              onDoubleClick={() => handlePlay(i)}
              onClick={() => handlePlay(i)}
              className={cn(
                'group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-4 py-2 text-sm outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/5 md:grid-cols-[16px_minmax(0,4fr)_minmax(0,3fr)_auto]',
                isCurrent && 'bg-white/[0.07] hover:bg-white/[0.09]',
                !showAlbum && 'md:grid-cols-[16px_minmax(0,4fr)_auto]'
              )}
            >
              <span className="hidden w-4 text-center text-xs text-muted-foreground tabular-nums md:block">
                {isCurrent && isPlaying ? (
                  <EqBars />
                ) : (
                  <>
                    <span className="group-hover:hidden">{showIndex ? i + 1 : ''}</span>
                    <Play className="hidden h-3.5 w-3.5 fill-foreground group-hover:block" aria-hidden />
                  </>
                )}
              </span>

              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0">
                  <Cover src={t.cover} alt={`${t.title} cover`} className="h-10 w-10" />
                  {isCurrent && isPlaying && (
                    <div className="absolute inset-0 hidden items-center justify-center rounded-md bg-black/50 group-hover:flex">
                      <Pause className="h-4 w-4 fill-white text-white" aria-hidden />
                    </div>
                  )}
                  {isCurrent && !isPlaying && (
                    <div className="absolute inset-0 hidden items-center justify-center rounded-md bg-black/50 group-hover:flex">
                      <Play className="h-4 w-4 fill-white text-white" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className={cn('flex items-center gap-1.5 truncate font-medium', isCurrent && 'text-[#1ed760]')}>
                    <span className="truncate">{t.title}</span>
                    {t.explicit && (
                      <span className="rounded-sm bg-muted-foreground/30 px-1 text-[9px] font-bold uppercase leading-4 text-muted-foreground">E</span>
                    )}
                    {t.hasFull && (
                      <span className="hidden rounded-sm border border-[#1db954]/50 px-1 text-[9px] font-semibold uppercase leading-4 text-[#1ed760] sm:inline" title={`Full-length track — ${t.bitrateKbps} kbps`}>Full</span>
                    )}
                    {t.language && t.language !== 'Unknown' && (
                      <span className="hidden rounded-sm bg-white/10 px-1 text-[9px] font-medium leading-4 text-muted-foreground lg:inline" title={`Language: ${t.language}`}>{t.language}</span>
                    )}
                  </div>
                  <button
                    className="block max-w-full truncate text-left text-xs text-muted-foreground hover:text-foreground hover:underline"
                    onClick={(e) => { e.stopPropagation(); navigate({ name: 'artist', artistName: t.artist }) }}
                  >
                    {t.artist}
                  </button>
                </div>
              </div>

              {showAlbum && (
                <div className="hidden truncate text-xs text-muted-foreground md:block">{t.album}</div>
              )}

              <div className="flex items-center justify-end gap-1">
                {onRemoveRow && (
                  <button
                    aria-label={`Remove ${t.title} from list`}
                    className="hidden rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-red-400 md:block"
                    onClick={(e) => { e.stopPropagation(); onRemoveRow(t.id) }}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <button
                  aria-label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                  className={cn('rounded-full p-1.5 transition-colors hover:bg-white/10 md:opacity-0 md:group-hover:opacity-100', liked && 'text-[#1ed760] md:opacity-100')}
                  onClick={(e) => { e.stopPropagation(); toggleLike(t.id) }}
                >
                  <Heart className={cn('h-4 w-4', liked && 'fill-[#1ed760]')} aria-hidden />
                </button>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{fmtTime(t.durationMs)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button aria-label={`More options for ${t.title}`} className="rounded-full p-1.5 transition-colors hover:bg-white/10 md:opacity-0 md:group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => { playNext(t); toast(`Playing next: ${t.title}`) }}>
                      <ListStart className="mr-2 h-4 w-4" /> Play next
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { addToQueue(t); toast(`Added to queue: ${t.title}`) }}>
                      <ListPlus className="mr-2 h-4 w-4" /> Add to queue
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { navigate({ name: 'artist', artistName: t.artist }) }}>
                      <Disc3 className="mr-2 h-4 w-4" /> Go to artist
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ListMusic className="mr-2 h-4 w-4" /> Add to playlist
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                        {playlists.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">No playlists yet</div>
                        )}
                        {playlists.map((p) => (
                          <DropdownMenuItem key={p.id} onClick={async () => {
                            const res = await fetch(`/api/playlists/${p.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId: t.id }) })
                            if (res.ok) toast(`Added to ${p.name}`)
                            else toast(`Already in ${p.name}`)
                            refreshPlaylists()
                          }}>
                            {p.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openAddToPlaylist(t.id)}>
                          <ListPlus className="mr-2 h-4 w-4" /> New playlist…
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => {
                      fetch('/api/radio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seedTrackId: t.id }) })
                        .then((r) => r.json())
                        .then((j) => { playQueue(j.tracks, 0, `${t.title} Radio`); toast(`${t.title} Radio started`) })
                    }}>
                      <Radio className="mr-2 h-4 w-4" /> Start song radio
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => download(t)}>
                      <Download className="mr-2 h-4 w-4" /> Download
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
        {tracks.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No songs here yet.</div>
        )}
      </div>
    </div>
  )
}

function api_download(id: string) { return `/api/download/${id}` }

// tiny equalizer animation for the playing row
export function EqBars() {
  return (
    <span className="flex h-3.5 w-4 items-end justify-center gap-[2px] eq-bars" aria-label="Playing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-[3px] rounded-sm bg-[#1ed760]" style={{
          height: '60%',
          animationDelay: `${i * 180}ms`,
        }} />
      ))}
    </span>
  )
}

// Horizontal scrollable row of cards
export function SectionRow({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-2" role="list" aria-label={ariaLabel}>{children}</div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
