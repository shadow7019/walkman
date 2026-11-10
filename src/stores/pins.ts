'use client'

// Pinned playlists state — a tiny persisted set of playlist ids shown at the
// top of the sidebar. Mirrors the localStorage style of `stores/player.ts`.
import { create } from 'zustand'

const PINS_KEY = 'walkman:pins'
const MAX_PINS = 10

interface PinsState {
  pinnedIds: string[]
  isPinned: (id: string) => boolean
  togglePin: (id: string) => void
  hydrate: () => void
}

function persist(ids: string[]) {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(ids))
  } catch { /* ignore */ }
}

export const usePins = create<PinsState>((set, get) => ({
  pinnedIds: [],

  isPinned: (id) => get().pinnedIds.includes(id),

  togglePin: (id) => {
    const current = get().pinnedIds
    if (current.includes(id)) {
      const next = current.filter((p) => p !== id)
      set({ pinnedIds: next })
      persist(next)
      return
    }
    // cap at 10 pinned playlists — silently ignore beyond
    if (current.length >= MAX_PINS) return
    const next = [...current, id]
    set({ pinnedIds: next })
    persist(next)
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem(PINS_KEY)
      if (!raw) return
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((v): v is string => typeof v === 'string')
        if (get().pinnedIds.length === 0 && ids.length) set({ pinnedIds: ids })
      }
    } catch { /* ignore invalid */ }
  },
}))
