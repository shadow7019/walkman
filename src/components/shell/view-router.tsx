'use client'

// View router for the single-page Walkman app.
import { useUI } from '@/stores/ui'
import { HomeView } from '@/components/views/home-view'
import { SearchView } from '@/components/views/search-view'
import { ExploreView, GenreView, MoodView, ArtistView } from '@/components/views/explore-view'
import { PlaylistView, LikedView, HistoryView } from '@/components/views/playlist-view'
import { ReplayView } from '@/components/views/replay-view'
import { ImportView } from '@/components/views/import-view'
import { SettingsView } from '@/components/views/settings-view'
import { RoomsView } from '@/components/views/rooms-view'

export function ViewRouter() {
  const view = useUI((s) => s.view)
  switch (view.name) {
    case 'home': return <HomeView />
    case 'search': return <SearchView />
    case 'explore': return <ExploreView />
    case 'genre': return <GenreView genre={view.genre} />
    case 'mood': return <MoodView mood={view.mood} />
    case 'playlist': return <PlaylistView id={view.id} />
    case 'liked': return <LikedView />
    case 'history': return <HistoryView />
    case 'replay': return <ReplayView />
    case 'import': return <ImportView />
    case 'settings': return <SettingsView />
    case 'rooms': return <RoomsView />
    case 'artist': return <ArtistView artistName={view.artistName} />
    default: return <HomeView />
  }
}
