'use client'

// Mobile bottom navigation: icon + label tab bar pinned to the very bottom
// (below the mini player), Spotify-style ordering. Touch targets >= 44px,
// safe-area aware for notched devices and standalone PWA/APK usage.
import { Home, Search, Compass, Heart, Users, ListMusic, Settings } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { useLibrary } from '@/stores/library'
import { cn } from '@/lib/utils'

const TABS = [
  { icon: Home, label: 'Home', view: 'home' },
  { icon: Search, label: 'Search', view: 'search' },
  { icon: Compass, label: 'Explore', view: 'explore' },
  { icon: Heart, label: 'Liked', view: 'liked' },
  { icon: Users, label: 'Rooms', view: 'rooms' },
  { icon: Settings, label: 'Settings', view: 'settings' },
] as const

export function MobileNav() {
  const { view, navigate } = useUI()
  const { playlists } = useLibrary()

  const items = TABS.map((t) =>
    // surface the newest playlist quickly: swap Rooms for Library when one exists
    t.view === 'rooms' && playlists.length > 0
      ? { icon: ListMusic, label: 'Library', view: 'playlist' as const, id: playlists[0].id }
      : t,
  )

  const isActive = (tab: (typeof items)[number]) => {
    if (tab.view === 'playlist') return view.name === 'playlist' || view.name === 'history' || view.name === 'replay'
    return view.name === tab.view
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="flex shrink-0 items-stretch justify-around border-t border-border/50 bg-black/70 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 backdrop-blur-xl md:hidden"
    >
      {items.map((tab) => {
        const active = isActive(tab)
        return (
          <button
            key={tab.label}
            onClick={() =>
              tab.view === 'playlist'
                ? navigate({ name: 'playlist', id: (tab as { id?: string }).id ?? '' })
                : navigate({ name: tab.view } as never)
            }
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-[48px] flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 transition-colors active:bg-white/10',
              active ? 'text-[#1ed760]' : 'text-muted-foreground active:text-foreground',
            )}
          >
            <tab.icon className="h-5 w-5" aria-hidden strokeWidth={active ? 2.4 : 2} />
            <span className={cn('text-[10px] leading-tight', active && 'font-semibold')}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
