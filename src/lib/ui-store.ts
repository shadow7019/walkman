"use client";

// UI navigation + dialog state for the single-page Walkman app.

import { create } from "zustand";
import type { Track } from "./types";

export type View =
  | { type: "home" }
  | { type: "search" }
  | { type: "library" }
  | { type: "liked" }
  | { type: "playlist"; id: string }
  | { type: "genre"; name: string };

interface UiState {
  view: View;
  past: View[];
  future: View[];
  importOpen: boolean;
  newPlaylistOpen: boolean;
  editPlaylistId: string | null;
  pendingTrack: Track | null;
  navigate: (view: View) => void;
  back: () => void;
  forward: () => void;
  setImportOpen: (open: boolean) => void;
  setNewPlaylistOpen: (open: boolean) => void;
  setEditPlaylist: (id: string | null) => void;
  setPendingTrack: (track: Track | null) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  view: { type: "home" },
  past: [],
  future: [],
  importOpen: false,
  newPlaylistOpen: false,
  editPlaylistId: null,
  pendingTrack: null,

  navigate: (view) => {
    const { view: current, past } = get();
    set({ view, past: [...past, current], future: [], importOpen: false, newPlaylistOpen: false });
  },

  back: () => {
    const { past, future, view } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ view: prev, past: past.slice(0, -1), future: [view, ...future] });
  },

  forward: () => {
    const { past, future, view } = get();
    if (!future.length) return;
    const nextView = future[0];
    set({ view: nextView, future: future.slice(1), past: [...past, view] });
  },

  setImportOpen: (open) => set({ importOpen: open }),
  setNewPlaylistOpen: (open) => set({ newPlaylistOpen: open }),
  setEditPlaylist: (id) => set({ editPlaylistId: id }),
  setPendingTrack: (track) => set({ pendingTrack: track }),
}));
