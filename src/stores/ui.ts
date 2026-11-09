'use client'

// UI navigation + shell state for the single-page Walkman app.
import { create } from 'zustand'
import type { View } from '@/types'

export type RightPanel = 'none' | 'queue' | 'lyrics'

interface Toast { id: number; text: string }

interface UIState {
  view: View
  history: View[]
  rightPanel: RightPanel
  fullscreen: boolean
  searchQuery: string
  recentSearches: string[]
  toasts: Toast[]
  addTrackDialogFor: string | null // trackId for "add to playlist" dialog
  navigate: (v: View) => void
  back: () => void
  canBack: () => boolean
  setRightPanel: (p: RightPanel) => void
  toggleQueue: () => void
  toggleLyrics: () => void
  setFullscreen: (b: boolean) => void
  setSearchQuery: (q: string) => void
  addRecentSearch: (q: string) => void
  clearRecentSearches: () => void
  toast: (text: string) => void
  dismissToast: (id: number) => void
  openAddToPlaylist: (trackId: string) => void
  closeAddToPlaylist: () => void
}

let toastId = 0

export const useUI = create<UIState>((set, get) => ({
  view: { name: 'home' },
  history: [],
  rightPanel: 'none',
  fullscreen: false,
  searchQuery: '',
  recentSearches: [],
  toasts: [],
  addTrackDialogFor: null,

  navigate: (v) => {
    const { view, history } = get()
    // don't navigate if same
    if (JSON.stringify(view) === JSON.stringify(v)) return
    set({ view: v, history: [...history.slice(-20), view] })
    if (v.name === 'search') window.scrollTo({ top: 0 })
  },

  back: () => {
    const { history } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    set({ view: prev, history: history.slice(0, -1) })
  },

  canBack: () => get().history.length > 0,

  setRightPanel: (p) => set({ rightPanel: p }),
  toggleQueue: () => set({ rightPanel: get().rightPanel === 'queue' ? 'none' : 'queue' }),
  toggleLyrics: () => set({ rightPanel: get().rightPanel === 'lyrics' ? 'none' : 'lyrics' }),
  setFullscreen: (b) => set({ fullscreen: b }),

  setSearchQuery: (q) => set({ searchQuery: q }),
  addRecentSearch: (q) => {
    if (!q.trim()) return
    try {
      const cur: string[] = JSON.parse(localStorage.getItem('walkman:searches') ?? '[]')
      const next = [q, ...cur.filter((c) => c !== q)].slice(0, 8)
      localStorage.setItem('walkman:searches', JSON.stringify(next))
      set({ recentSearches: next })
    } catch { /* ignore */ }
  },
  clearRecentSearches: () => {
    try {
      localStorage.setItem('walkman:searches', '[]')
      set({ recentSearches: [] })
    } catch { /* ignore */ }
  },

  toast: (text) => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, text }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  openAddToPlaylist: (trackId) => set({ addTrackDialogFor: trackId }),
  closeAddToPlaylist: () => set({ addTrackDialogFor: null }),
}))

// hydrate recent searches from localStorage
export function hydrateRecentSearches() {
  try {
    const cur: string[] = JSON.parse(localStorage.getItem('walkman:searches') ?? '[]')
    useUI.setState({ recentSearches: cur })
  } catch { /* ignore */ }
}
