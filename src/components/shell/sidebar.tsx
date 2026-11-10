'use client'

import Image from 'next/image'
import { Home, Search, Compass, Heart, Clock, BarChart3, Download, ListMusic, Settings, Users, Plus, Pin } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { useLibrary } from '@/stores/library'
import { usePins } from '@/stores/pins'
import { cn } from '@/lib/utils'
import { Cover } from '@/components/cover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Sidebar() {
  const { view, navigate } = useUI()
  const { playlists, createPlaylist } = useLibrary()
  const { pinnedIds, isPinned, togglePin } = usePins()

  const isActive = (name: string) => view.name === name

  // pinned playlists first (in pin order), then the rest in their current order
  const pinRank = (id: string) => {
    const i = pinnedIds.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const sortedPlaylists = [...playlists].sort((a, b) => pinRank(a.id) - pinRank(b.id))

  const navItems = [
    { icon: Home, label: 'Home', name: 'home' },
    { icon: Search, label: 'Search', name: 'search' },
    { icon: Compass, label: 'Explore', name: 'explore' },
  ] as const

  const libraryItems = [
    { icon: Heart, label: 'Liked Songs', name: 'liked', accent: 'text-rose-400' },
    { icon: Clock, label: 'History', name: 'history' },
    { icon: BarChart3, label: 'Replay', name: 'replay' },
    { icon: Download, label: 'Import', name: 'import' },
    { icon: Users, label: 'Rooms', name: 'rooms' },
    { icon: Settings, label: 'Settings', name: 'settings' },
  ] as const

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-2 p-2 md:flex" aria-label="Main navigation">
      <div className="rounded-xl border border-border/50 bg-black/30 p-3">
        <button
          className="mb-3 flex w-full items-center gap-2 px-2 py-1"
          onClick={() => navigate({ name: 'home' })}
          aria-label="Walkman home"
        >
          <Image
            src="/logo.png"
            alt="Walkman logo"
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-lg shadow-lg shadow-black/50"
          />
          <span className="text-lg font-bold tracking-tight">Walkman</span>
          <span className="ml-auto rounded-full border border-[#1db954]/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1ed760]">Free</span>
        </button>
        <nav className="flex flex-col gap-0.5" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate({ name: item.name })}
              aria-current={isActive(item.name) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-white/5',
                isActive(item.name) ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/50 bg-black/30">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Library</span>
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            aria-label="Create playlist"
            onClick={async () => {
              const p = await createPlaylist(`My Playlist #${playlists.length + 1}`)
              if (p) { useUI.getState().navigate({ name: 'playlist', id: p.id }); useUI.getState().toast(`Created "${p.name}"`) }
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {libraryItems.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate({ name: item.name })}
              aria-current={isActive(item.name) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-white/5',
                isActive(item.name) ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', 'accent' in item && item.accent)} aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
        <div className="mx-4 my-2 border-t border-border/40" />
        <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
          <div className="flex flex-col gap-0.5" role="list" aria-label="Playlists">
            {sortedPlaylists.map((p) => {
              const pinned = isPinned(p.id)
              return (
                <div
                  key={p.id}
                  role="listitem"
                  className="group flex items-center rounded-lg transition-colors hover:bg-white/5"
                >
                  <button
                    onClick={() => navigate({ name: 'playlist', id: p.id })}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                      view.name === 'playlist' && view.id === p.id ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {p.covers.length > 0 ? (
                      <Cover src={p.covers[0]} alt={`${p.name} cover`} className="h-9 w-9 rounded" />
                    ) : (
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gradient-to-br', p.gradient)}>
                        <ListMusic className="h-4 w-4 text-white/80" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-[#1ed760]" aria-hidden />}
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.importedFrom ? `From ${p.importedFrom} · ` : ''}{p.trackCount} songs
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(p.id) }}
                    className={cn(
                      'mr-1 shrink-0 rounded p-1 transition-opacity',
                      pinned ? 'text-[#1ed760] opacity-100' : 'text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100'
                    )}
                    aria-label={pinned ? `Unpin ${p.name}` : `Pin ${p.name}`}
                  >
                    <Pin className={cn('h-3.5 w-3.5', pinned && 'fill-current')} aria-hidden />
                  </button>
                </div>
              )
            })}
            {playlists.length === 0 && (
              <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
                Playlists you create or import appear here.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}
