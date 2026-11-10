'use client'

// Top bar: brand mark (mobile), back/forward, live search with suggestions, sync indicator.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Search, ArrowLeft, RefreshCw, X } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { usePlayer } from '@/stores/player'
import { api } from '@/lib/client-api'
import type { Track } from '@/types'
import { Cover } from '@/components/cover'
import { cn } from '@/lib/utils'
import { fmtTime } from '@/types'

export function TopBar() {
  const { view, navigate, back, canBack, searchQuery, setSearchQuery, addRecentSearch } = useUI()
  const { playQueue, playPause, isPlaying, queue, queueIndex } = usePlayer()
  const [focused, setFocused] = useState(false)
  const [suggest, setSuggest] = useState<Track[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // live suggestions (debounced, local-first)
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q || !focused) return
    const t = setTimeout(async () => {
      try {
        const { tracks } = await api.tracks({ q, limit: 6, sort: 'plays' })
        setSuggest(tracks)
      } catch { setSuggest([]) }
    }, 180)
    return () => clearTimeout(t)
  }, [searchQuery, focused])

  // '/' focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
      if ((e.key === '/' || (e.key === 'f' && (e.ctrlKey || e.metaKey))) && !typing) {
        e.preventDefault()
        navigate({ name: 'search' })
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const submitSearch = () => {
    if (!searchQuery.trim()) return
    addRecentSearch(searchQuery.trim())
    setFocused(false)
    navigate({ name: 'search' })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-background/80 px-4 backdrop-blur-xl">
      {/* brand mark — mobile only (sidebar is hidden on small screens) */}
      <button
        onClick={() => navigate({ name: 'home' })}
        aria-label="Walkman home"
        className="shrink-0 md:hidden"
      >
        <Image src="/logo.png" alt="Walkman logo" width={28} height={28} className="h-7 w-7 rounded-lg shadow-md shadow-black/50" priority />
      </button>

      <button
        onClick={() => canBack() && back()}
        aria-label="Go back"
        className={cn('rounded-full bg-black/40 p-2 transition-opacity hover:bg-black/60', !canBack() && 'pointer-events-none opacity-30')}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </button>

      <div ref={boxRef} className="relative max-w-xl flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            role="searchbox"
            aria-label="Search songs, artists, albums"
            placeholder="What do you want to listen to?"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (view.name !== 'search') navigate({ name: 'search' }) }}
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
            className="h-9 w-full rounded-full border border-border/60 bg-muted/50 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30 focus:bg-muted"
          />
          {searchQuery && (
            <button aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setSearchQuery(''); inputRef.current?.focus() }}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {focused && searchQuery.trim() && suggest.length > 0 && (
          <div className="absolute inset-x-0 top-11 z-40 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl" role="listbox" aria-label="Search suggestions">
            {suggest.map((t, i) => (
              <button
                key={t.id}
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  setFocused(false)
                  if (queue[queueIndex]?.id === t.id) { playPause(); return }
                  playQueue(suggest, i, `Search: ${searchQuery}`)
                }}
              >
                <Cover src={t.cover} alt="" className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{fmtTime(t.durationMs)}</span>
              </button>
            ))}
            <button className="w-full border-t border-border/40 px-3 py-2 text-center text-xs text-muted-foreground hover:text-foreground" onClick={submitSearch}>
              See all results for “{searchQuery.trim()}”
            </button>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <SyncIndicator />
      </div>
    </header>
  )
}

// Small catalog auto-sync status pill
function SyncIndicator() {
  const [syncing, setSyncing] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const { toast } = useUI()

  useEffect(() => {
    api.syncStatus().then((s) => setTotal(s.total)).catch(() => {})
    const iv = setInterval(() => api.syncStatus().then((s) => setTotal(s.total)).catch(() => {}), 60000)
    return () => clearInterval(iv)
  }, [])

  return (
    <button
      onClick={async () => {
        if (syncing) return
        setSyncing(true)
        toast('Syncing new songs from the industry catalog…')
        try {
          const r = await api.runSync()
          toast(`Catalog updated: +${r.added} new songs (${r.total} total)`)
          setTotal(r.total)
        } catch {
          toast('Sync failed — will retry automatically')
        } finally {
          setSyncing(false)
        }
      }}
      className={cn(
        'flex h-9 items-center gap-2 rounded-full border border-border/60 bg-black/30 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground',
        syncing && 'animate-pulse text-emerald-400'
      )}
      aria-label="Sync new songs now"
      title="Auto-add new songs from the industry catalog"
    >
      <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden />
      <span className="hidden sm:inline">{syncing ? 'Syncing…' : total !== null ? `${total.toLocaleString()} tracks` : 'Catalog'}</span>
    </button>
  )
}
