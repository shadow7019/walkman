'use client'

// Walkman — single-page app shell.
// Layout: sidebar | main (topbar + view) | right rail; player bar sticky at bottom.
import { useEffect } from 'react'
import { useUI, hydrateRecentSearches } from '@/stores/ui'
import { useLibrary } from '@/stores/library'
import { usePins } from '@/stores/pins'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/topbar'
import { PlayerBar } from '@/components/shell/player-bar'
import { RightRail } from '@/components/shell/right-rail'
import { FullscreenPlayer } from '@/components/shell/fullscreen-player'
import { ViewRouter } from '@/components/shell/view-router'
import { Toasts, AddToPlaylistDialog, KeyboardShortcuts, SleepTimerBadge } from '@/components/shell/overlays'

export default function Page() {
  useAudioEngine()

  useEffect(() => {
    hydrateRecentSearches()
    useLibrary.getState().loadAll()
    usePins.getState().hydrate()
  }, [])

  // bottom mobile nav state
  const { view, navigate } = useUI()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <KeyboardShortcuts />
      <SleepTimerBadge />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col" aria-label="Walkman main">
          <TopBar />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6">
            <ViewRouter />
          </div>
          {/* mobile bottom nav */}
          <nav className="flex h-14 items-center justify-around border-t border-border/50 bg-black/40 md:hidden" aria-label="Mobile navigation">
            {([
              ['home', 'Home'], ['search', 'Search'], ['explore', 'Explore'], ['liked', 'Liked'], ['rooms', 'Rooms'],
            ] as const).map(([name, label]) => (
              <button
                key={name}
                onClick={() => navigate({ name } as never)}
                aria-current={view.name === name ? 'page' : undefined}
                className={view.name === name ? 'text-emerald-400' : 'text-muted-foreground'}
              >
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </nav>
        </main>
        <RightRail />
      </div>
      <PlayerBar />
      <FullscreenPlayer />
      <Toasts />
      <AddToPlaylistDialog />
    </div>
  )
}
