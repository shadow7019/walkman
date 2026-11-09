'use client'

// Toasts + "Add to playlist" dialog + keyboard shortcuts wiring.
import { useEffect, useState } from 'react'
import { CheckCircle2, X, ListPlus } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { useLibrary } from '@/stores/library'
import { usePlayer } from '@/stores/player'
import { api } from '@/lib/client-api'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function Toasts() {
  const { toasts, dismissToast } = useUI()
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-full border border-emerald-500/30 bg-zinc-900/95 px-4 py-2 text-sm shadow-2xl backdrop-blur transition-all"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <span className="truncate">{t.text}</span>
        </button>
      ))}
    </div>
  )
}

export function AddToPlaylistDialog() {
  const { addTrackDialogFor, closeAddToPlaylist, toast } = useUI()
  const { playlists, refreshPlaylists, createPlaylist } = useLibrary()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  // reset the input whenever the dialog closes (no effect needed)
  const close = () => { setName(''); closeAddToPlaylist() }

  const create = async () => {
    if (!addTrackDialogFor || !name.trim()) return
    setBusy(true)
    const p = await createPlaylist(name.trim())
    if (p) {
      await api.addToPlaylist(p.id, addTrackDialogFor).catch(() => {})
      toast(`Added to "${p.name}"`)
      await refreshPlaylists()
    }
    setBusy(false)
    close()
  }

  return (
    <Dialog open={!!addTrackDialogFor} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListPlus className="h-4 w-4" aria-hidden /> Add to playlist</DialogTitle>
          <DialogDescription>Pick a playlist or create a new one.</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {playlists.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
              onClick={async () => {
                if (!addTrackDialogFor) return
                const res = await api.addToPlaylist(p.id, addTrackDialogFor).catch(() => null)
                if (res) toast(`Added to ${p.name}`)
                else toast(`Already in ${p.name}`)
                refreshPlaylists()
                close()
              }}
            >
              {p.name}
              <span className="text-xs text-muted-foreground">{p.trackCount}</span>
            </button>
          ))}
          {playlists.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No playlists yet.</p>}
        </div>
        <DialogFooter className="flex-row gap-2">
          <Input
            placeholder="New playlist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            aria-label="New playlist name"
          />
          <Button onClick={create} disabled={!name.trim() || busy}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Global keyboard shortcuts (ByTune-style; never hijack typing)
export function KeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const player = usePlayer.getState()
      const ui = useUI.getState()
      switch (e.key) {
        case ' ':
          e.preventDefault()
          player.playPause()
          break
        case 'ArrowLeft':
          if (e.shiftKey) player.prev()
          else player.seek(Math.max(0, player.position - 5))
          break
        case 'ArrowRight':
          if (e.shiftKey) player.next()
          else player.seek(Math.min(player.duration, player.position + 5))
          break
        case 'ArrowUp':
          e.preventDefault()
          player.setVolume(Math.min(1, player.volume + 0.05))
          break
        case 'ArrowDown':
          e.preventDefault()
          player.setVolume(Math.max(0, player.volume - 0.05))
          break
        case 'm': case 'M':
          player.toggleMute()
          break
        case 's': case 'S':
          player.toggleShuffle()
          break
        case 'r': case 'R':
          player.cycleRepeat()
          break
        case 'q': case 'Q':
          ui.toggleQueue()
          break
        case 'l': case 'L':
          ui.toggleLyrics()
          break
        case 'n': case 'N':
          if (!ui.fullscreen) ui.setFullscreen(true)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

export function SleepTimerBadge() {
  const sleepAt = usePlayer((s) => s.sleepAt)
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!sleepAt) return
    const iv = setInterval(() => setLeft(Math.max(0, Math.round((sleepAt - Date.now()) / 1000))), 500)
    return () => clearInterval(iv)
  }, [sleepAt])
  if (!sleepAt || left <= 0) return null
  return (
    <div className={cn('pointer-events-none fixed left-3 top-16 z-50 rounded-full border border-emerald-500/40 bg-black/70 px-2.5 py-1 text-[10px] font-medium text-emerald-400 backdrop-blur')}>
      Sleep in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </div>
  )
}
