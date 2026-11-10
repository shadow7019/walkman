'use client'

// Library state: playlists, liked songs, history — shared across views.
import { create } from 'zustand'
import { api } from '@/lib/client-api'
import type { Track, PlaylistSummary } from '@/types'

interface LibraryState {
  playlists: PlaylistSummary[]
  likedIds: Set<string>
  liked: Track[]
  history: Track[]
  loaded: boolean
  loadAll: () => Promise<void>
  refreshPlaylists: () => Promise<void>
  refreshLiked: () => Promise<void>
  refreshHistory: () => Promise<void>
  toggleLike: (trackId: string) => Promise<void>
  isLiked: (trackId: string) => boolean
  createPlaylist: (name: string) => Promise<{ id: string; name: string } | null>
}

export const useLibrary = create<LibraryState>((set, get) => ({
  playlists: [],
  likedIds: new Set(),
  liked: [],
  history: [],
  loaded: false,

  loadAll: async () => {
    await Promise.allSettled([get().refreshPlaylists(), get().refreshLiked(), get().refreshHistory()])
    set({ loaded: true })
  },

  refreshPlaylists: async () => {
    try {
      const { playlists } = await api.playlists()
      set({ playlists })
    } catch { /* ignore */ }
  },

  refreshLiked: async () => {
    try {
      const { tracks } = await api.liked()
      set({ liked: tracks, likedIds: new Set(tracks.map((t) => t.id)) })
    } catch { /* ignore */ }
  },

  refreshHistory: async () => {
    try {
      const { tracks } = await api.history()
      set({ history: tracks })
    } catch { /* ignore */ }
  },

  toggleLike: async (trackId) => {
    const { likedIds, liked } = get()
    const wasLiked = likedIds.has(trackId)
    // optimistic
    if (wasLiked) {
      const next = new Set(likedIds); next.delete(trackId)
      set({ likedIds: next, liked: liked.filter((t) => t.id !== trackId) })
    } else {
      const next = new Set(likedIds); next.add(trackId)
      set({ likedIds: next })
    }
    try {
      await api.toggleLike(trackId)
      await get().refreshLiked()
    } catch {
      // revert
      if (wasLiked) {
        const next = new Set(get().likedIds); next.add(trackId)
        set({ likedIds: next })
      } else {
        const next = new Set(get().likedIds); next.delete(trackId)
        set({ likedIds: next })
      }
    }
  },

  isLiked: (trackId) => get().likedIds.has(trackId),

  createPlaylist: async (name) => {
    try {
      const { playlist } = await api.createPlaylist(name)
      await get().refreshPlaylists()
      return playlist
    } catch { return null }
  },
}))
