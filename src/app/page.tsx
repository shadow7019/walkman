'use client'

// Walkman — single-page app shell.
// Layout: sidebar | main (topbar + view) | right rail; player bar sticky at bottom.
import { useEffect } from 'react'
import { useUI, hydrateRecentSearches } from '@/stores/ui'
import { useLibrary } from '@/stores/library'
import { usePins } from '@/stores/pins'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { startAutoSync } from '@/hooks/use-auto-sync'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/topbar'
import { PlayerBar } from '@/components/shell/player-bar'
import { RightRail } from '@/components/shell/right-rail'
import { FullscreenPlayer } from '@/components/shell/fullscreen-player'
import { ViewRouter } from '@/components/shell/view-router'
import { MobileNav } from '@/components/shell/mobile-nav'
import { PwaRegister } from '@/components/shell/pwa-register'
import { Toasts, AddToPlaylistDialog, KeyboardShortcuts, SleepTimerBadge } from '@/components/shell/overlays'

export default function Page() {
  useAudioEngine()

  useEffect(() => {
    hydrateRecentSearches()
    useLibrary.getState().loadAll()
    usePins.getState().hydrate()
    startAutoSync() // poll the industry catalog for new songs while the app is open
    // deep link support (PWA app shortcuts / shared links): /?view=settings etc.
    const v = new URLSearchParams(window.location.search).get('view')
    const simple = ['home', 'search', 'explore', 'liked', 'history', 'replay', 'import', 'settings', 'rooms'] as const
    if (v && (simple as readonly string[]).includes(v)) {
      useUI.getState().navigate({ name: v } as never)
    }
  }, [])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <KeyboardShortcuts />
      <SleepTimerBadge />
      <PwaRegister />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col" aria-label="Walkman main">
          <TopBar />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-6">
            <ViewRouter />
          </div>
        </main>
        <RightRail />
      </div>
      {/* mini player sits directly above the mobile tab bar (Spotify ordering) */}
      <PlayerBar />
      <MobileNav />
      <FullscreenPlayer />
      <Toasts />
      <AddToPlaylistDialog />
    </div>
  )
}
