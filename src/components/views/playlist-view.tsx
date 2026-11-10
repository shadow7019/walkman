'use client'

// Playlist detail (rename/delete/export/remove), Liked Songs, History.
import { useEffect, useState } from 'react'
import { Play, Shuffle, Pencil, Trash2, Download, MoreHorizontal, Heart, Clock, Pin } from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useLibrary } from '@/stores/library'
import { usePins } from '@/stores/pins'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/client-api'
import { TrackList } from '@/components/track-list'
import { SkeletonRow } from '@/components/views/home-view'
import type { Track } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface PlaylistDetail {
  id: string
  name: string
  description: string
  gradient: string
  importedFrom: string
  isSystem: boolean
}

export function PlaylistView({ id }: { id: string }) {
  const { playQueue } = usePlayer()
  const { refreshPlaylists } = useLibrary()
  const { navigate, toast } = useUI()
  const { isPinned, togglePin } = usePins()
  const pinned = isPinned(id)
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // idempotent hydration of persisted pins (safe no-op if already hydrated)
  useEffect(() => { usePins.getState().hydrate() }, [])

  // Reload helper — only invoked from event handlers (React Compiler memoizes automatically).
  const load = async () => {
    try {
      const r = await api.playlist(id)
      setPlaylist(r.playlist)
      setTracks(r.tracks)
      setName(r.playlist.name)
      setDescription(r.playlist.description)
    } catch {
      toast('Playlist not found')
      navigate({ name: 'home' })
    }
  }

  useEffect(() => {
    let alive = true
    api.playlist(id)
      .then((r) => {
        if (!alive) return
        setPlaylist(r.playlist)
        setTracks(r.tracks)
        setName(r.playlist.name)
        setDescription(r.playlist.description)
      })
      .catch(() => {
        if (!alive) return
        toast('Playlist not found')
        navigate({ name: 'home' })
      })
    return () => { alive = false }
  }, [id, toast, navigate])

  const removeTrack = async (trackId: string) => {
    await api.removeFromPlaylist(id, trackId).catch(() => {})
    await load()
    refreshPlaylists()
    toast('Removed from playlist')
  }

  const exportPlaylist = (format: 'm3u8' | 'json') => {
    if (!tracks || !playlist) return
    let content = ''
    if (format === 'json') {
      content = JSON.stringify({
        name: playlist.name,
        description: playlist.description,
        exportedBy: 'Walkman',
        tracks: tracks.map((t) => ({ title: t.title, artist: t.artist, album: t.album, durationMs: t.durationMs, permalink: t.permalink })),
      }, null, 2)
    } else {
      content = '#EXTM3U\n'
      for (const t of tracks) {
        content += `#EXTINF:${Math.round(t.durationMs / 1000)},${t.artist} - ${t.title}\n`
        content += `${t.permalink || `${t.artist} - ${t.title}`}\n`
      }
    }
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'audio/x-mpegurl' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${playlist.name.replace(/[^a-z0-9 _-]/gi, '')}.${format === 'json' ? 'json' : 'm3u8'}`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Exported as .${format}`)
  }

  if (!playlist || !tracks) {
    return (
      <div className="py-8">
        <SkeletonRow />
      </div>
    )
  }

  const totalMs = tracks.reduce((a, t) => a + t.durationMs, 0)

  return (
    <div className="pb-4">
      <div className="relative -mx-4 -mt-2 mb-6 overflow-hidden px-4 pt-10 pb-6 md:-mx-6 md:px-6">
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', playlist.gradient)} aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 to-transparent" aria-hidden />
        <div className="relative">
          {playlist.importedFrom && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#1ed760]">Imported from {playlist.importedFrom}</p>
          )}
          <h1 className="text-3xl font-black tracking-tight drop-shadow-md sm:text-4xl lg:text-5xl">{playlist.name}</h1>
          {playlist.description && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{playlist.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {tracks.length} songs {totalMs > 0 && `· ${Math.round(totalMs / 60000)} min`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
              disabled={!tracks.length}
              onClick={() => playQueue(tracks, 0, playlist.name)}
              aria-label={`Play ${playlist.name}`}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden /> Play
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-white/20"
              disabled={!tracks.length}
              onClick={() => {
                const sh = [...tracks].sort(() => Math.random() - 0.5)
                playQueue(sh, 0, playlist.name)
              }}
              aria-label={`Shuffle ${playlist.name}`}
            >
              <Shuffle className="h-4 w-4" aria-hidden /> Shuffle
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn('gap-2 border-white/20 px-3', pinned && 'text-[#1ed760]')}
              onClick={() => togglePin(id)}
              aria-label={pinned ? `Unpin ${playlist.name}` : `Pin ${playlist.name}`}
            >
              <Pin className={cn('h-4 w-4', pinned && 'fill-current')} aria-hidden /> {pinned ? 'Unpin' : 'Pin'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-2" aria-label="Playlist options">
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden /> Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPlaylist('m3u8')}>
                  <Download className="mr-2 h-4 w-4" aria-hidden /> Export .m3u8
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPlaylist('json')}>
                  <Download className="mr-2 h-4 w-4" aria-hidden /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-400" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete playlist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <TrackList
        tracks={tracks}
        contextTitle={playlist.name}
        showAlbum
        onPlayIndex={(i) => playQueue(tracks, i, playlist.name)}
        onRemoveRow={removeTrack}
 />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>Rename your playlist or update its description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-name">Name</Label>
              <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-desc">Description</Label>
              <Input id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await api.renamePlaylist(id, name.trim() || playlist.name, description).catch(() => {})
                setRenameOpen(false)
                await load()
                refreshPlaylists()
                toast('Playlist updated')
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{playlist.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The playlist will be removed, but the songs stay in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={async () => {
                await api.deletePlaylist(id).catch(() => {})
                await refreshPlaylists()
                navigate({ name: 'home' })
                toast('Playlist deleted')
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// small helper rendering nothing — placeholder for per-row remove integration
export function LikedView() {
  const { playQueue } = usePlayer()
  const { liked, refreshLiked } = useLibrary()
  useEffect(() => { refreshLiked() }, [refreshLiked])
  const totalMs = liked.reduce((a, t) => a + t.durationMs, 0)
  return (
    <div className="pb-4">
      <CollectionHeroStatic
        title="Liked Songs"
        icon={<Heart className="h-8 w-8 fill-white text-white" aria-hidden />}
        gradient="from-rose-500 to-red-800"
        count={liked.length}
        minutes={Math.round(totalMs / 60000)}
        onPlay={() => playQueue(liked, 0, 'Liked Songs')}
        onShuffle={() => playQueue([...liked].sort(() => Math.random() - 0.5), 0, 'Liked Songs')}
        disabled={!liked.length}
      />
      <TrackList tracks={liked} contextTitle="Liked Songs" onPlayIndex={(i) => playQueue(liked, i, 'Liked Songs')} />
    </div>
  )
}

export function HistoryView() {
  const { playQueue } = usePlayer()
  const { history, refreshHistory } = useLibrary()
  useEffect(() => { refreshHistory() }, [refreshHistory])
  return (
    <div className="pb-4">
      <CollectionHeroStatic
        title="Listening History"
        icon={<Clock className="h-8 w-8 text-white" aria-hidden />}
        gradient="from-zinc-500 to-zinc-800"
        count={history.length}
        minutes={0}
        onPlay={() => playQueue(history, 0, 'History')}
        onShuffle={() => playQueue([...history].sort(() => Math.random() - 0.5), 0, 'History')}
        disabled={!history.length}
      />
      <TrackList tracks={history} contextTitle="History" onPlayIndex={(i) => playQueue(history, i, 'History')} />
    </div>
  )
}

function CollectionHeroStatic({ title, icon, gradient, count, minutes, onPlay, onShuffle, disabled }: {
  title: string
  icon: React.ReactNode
  gradient: string
  count: number
  minutes: number
  onPlay: () => void
  onShuffle: () => void
  disabled?: boolean
}) {
  return (
    <div className="relative -mx-4 -mt-2 mb-6 overflow-hidden px-4 pt-10 pb-6 md:-mx-6 md:px-6">
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', gradient)} aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 to-transparent" aria-hidden />
      <div className="relative flex items-end gap-6">
        <div className={cn('flex h-36 w-36 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-2xl sm:h-44 sm:w-44', gradient)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {count} songs{minutes > 0 && ` · ${minutes} min`}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]" disabled={disabled} onClick={onPlay} aria-label={`Play ${title}`}>
              <Play className="h-4 w-4 fill-current" aria-hidden /> Play
            </Button>
            <Button size="sm" variant="outline" className="gap-2 border-white/20" disabled={disabled} onClick={onShuffle} aria-label={`Shuffle ${title}`}>
              <Shuffle className="h-4 w-4" aria-hidden /> Shuffle
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
