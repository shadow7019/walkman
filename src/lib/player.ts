"use client";

// Walkman audio engine + playback state.
// A single module-level HTMLAudioElement is driven by this zustand store,
// so any component can control playback without prop drilling.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QualityId, Track } from "./types";

export type RepeatMode = "off" | "context" | "track";

let audioEl: HTMLAudioElement | null = null;
let engineInitialized = false;
let lastRecordedTrackId: string | null = null;

function getAudioEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
  }
  return audioEl;
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function streamUrl(id: string, quality: QualityId): string {
  return `/api/stream/${id}?q=${quality}`;
}

function recordPlay(trackId: string): void {
  if (lastRecordedTrackId === trackId) return;
  lastRecordedTrackId = trackId;
  void fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackId }),
  }).catch(() => undefined);
}

function updateMediaSession(track: Track): void {
  try {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    // Artwork may be a remote CDN URL or an app-relative path — MediaSession needs absolute URLs.
    let artwork = track.cover;
    try {
      artwork = new URL(track.cover, window.location.origin).href;
    } catch {
      // keep the raw cover string if URL resolution fails
    }
    const type = track.cover.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: [{ src: artwork, sizes: "640x640", type }],
    });
  } catch {
    // MediaSession unsupported — ignore
  }
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[]; // current play order
  sourceQueue: Track[]; // original context order (restored when shuffle turns off)
  index: number;
  contextLabel: string;
  isPlaying: boolean;
  isBuffering: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  quality: QualityId;
  queueOpen: boolean;

  playQueue: (tracks: Track[], startIndex: number, label: string) => void;
  playIndex: (i: number) => void;
  togglePlay: () => void;
  next: (manual?: boolean) => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setQuality: (q: QualityId) => void;
  toggleQueueOpen: () => void;
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (i: number) => void;
  clearUpNext: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => {
      function loadIndex(i: number, autoplay: boolean): void {
        const { queue, quality } = get();
        if (!queue.length) return;
        const clamped = clamp(i, 0, queue.length - 1);
        const track = queue[clamped];
        const el = getAudioEl();
        if (!el || !track) return;
        set({ index: clamped, currentTrack: track, progress: 0, duration: track.durationSec });
        el.src = streamUrl(track.id, quality);
        if (autoplay) {
          set({ isBuffering: true });
          void el.play().catch(() => set({ isPlaying: false, isBuffering: false }));
        }
        recordPlay(track.id);
        updateMediaSession(track);
      }

      return {
        currentTrack: null,
        queue: [],
        sourceQueue: [],
        index: 0,
        contextLabel: "",
        isPlaying: false,
        isBuffering: false,
        progress: 0,
        duration: 0,
        volume: 0.8,
        muted: false,
        shuffle: false,
        repeat: "off",
        quality: "high",
        queueOpen: false,

        playQueue: (tracks, startIndex, label) => {
          if (!tracks.length) return;
          const state = get();
          let queue = tracks;
          let index = clamp(startIndex, 0, tracks.length - 1);
          if (state.shuffle) {
            const current = tracks[index];
            const rest = tracks.filter((_, i) => i !== index);
            queue = [current, ...shuffleArray(rest)];
            index = 0;
          }
          set({ queue, sourceQueue: tracks, index, contextLabel: label });
          loadIndex(index, true);
        },

        playIndex: (i) => loadIndex(i, true),

        togglePlay: () => {
          const el = getAudioEl();
          const { currentTrack, index } = get();
          if (!el || !currentTrack) return;
          if (el.paused) {
            if (!el.src) {
              loadIndex(index, true);
              return;
            }
            void el.play().catch(() => set({ isPlaying: false }));
          } else {
            el.pause();
          }
        },

        next: (manual = true) => {
          const { queue, index, repeat } = get();
          if (!queue.length) return;
          if (repeat === "track" && !manual) {
            loadIndex(index, true);
            return;
          }
          let i = index + 1;
          if (i >= queue.length) {
            if (manual || repeat === "context") {
              i = 0;
            } else {
              const el = getAudioEl();
              if (el) {
                el.pause();
                el.currentTime = 0;
              }
              set({ isPlaying: false, progress: 0 });
              return;
            }
          }
          loadIndex(i, true);
        },

        prev: () => {
          const { queue, index, progress } = get();
          if (!queue.length) return;
          const el = getAudioEl();
          if (progress > 3 && el) {
            el.currentTime = 0;
            set({ progress: 0 });
            return;
          }
          const i = index - 1 < 0 ? queue.length - 1 : index - 1;
          loadIndex(i, true);
        },

        seek: (sec) => {
          const el = getAudioEl();
          if (!el) return;
          const { duration } = get();
          const target = clamp(sec, 0, Number.isFinite(duration) && duration > 0 ? duration - 0.25 : sec);
          el.currentTime = target;
          set({ progress: target });
        },

        setVolume: (v) => {
          const el = getAudioEl();
          const vol = clamp(v, 0, 1);
          if (el) {
            el.volume = vol;
            el.muted = false;
          }
          set({ volume: vol, muted: false });
        },

        toggleMute: () => {
          const el = getAudioEl();
          const { muted, volume } = get();
          if (el) el.muted = !muted;
          set({ muted: !muted, volume: !muted && volume === 0 ? 0.5 : volume });
        },

        toggleShuffle: () => {
          const { shuffle, queue, index, sourceQueue } = get();
          const current = queue[index];
          if (!shuffle) {
            const rest = queue.filter((_, i) => i !== index);
            set({ shuffle: true, queue: current ? [current, ...shuffleArray(rest)] : shuffleArray(queue), index: current ? 0 : 0 });
          } else {
            const q = sourceQueue.length ? sourceQueue : queue;
            const i = current ? q.findIndex((t) => t.id === current.id) : 0;
            set({ shuffle: false, queue: q, index: Math.max(0, i) });
          }
        },

        cycleRepeat: () => {
          const { repeat } = get();
          set({ repeat: repeat === "off" ? "context" : repeat === "context" ? "track" : "off" });
        },

        setQuality: (q) => {
          set({ quality: q });
          const { currentTrack, isPlaying, progress } = get();
          const el = getAudioEl();
          if (currentTrack && el && el.src) {
            el.src = streamUrl(currentTrack.id, q);
            el.currentTime = progress;
            if (isPlaying) {
              set({ isBuffering: true });
              void el.play().catch(() => set({ isPlaying: false, isBuffering: false }));
            }
          }
        },

        toggleQueueOpen: () => set((s) => ({ queueOpen: !s.queueOpen })),

        addToQueue: (track) => {
          const { queue, index, currentTrack } = get();
          if (!currentTrack) {
            get().playQueue([track], 0, "Queue");
            return;
          }
          set({ queue: [...queue, track] });
        },

        playNextInQueue: (track) => {
          const { queue, index, currentTrack } = get();
          if (!currentTrack) {
            get().playQueue([track], 0, "Queue");
            return;
          }
          const q = [...queue];
          q.splice(index + 1, 0, track);
          set({ queue: q });
        },

        removeFromQueue: (i) => {
          const { queue, index } = get();
          if (i <= index) return;
          set({ queue: queue.filter((_, idx) => idx !== i) });
        },

        clearUpNext: () => {
          const { queue, index } = get();
          set({ queue: queue.slice(0, index + 1) });
        },
      };
    },
    {
      name: "walkman-player",
      partialize: (s) => ({
        volume: s.volume,
        quality: s.quality,
        shuffle: s.shuffle,
        repeat: s.repeat,
      }),
    }
  )
);

/** Wire the audio element listeners + MediaSession. Call once from the PlayerBar effect. */
export function initAudioEngine(): void {
  const el = getAudioEl();
  if (!el || engineInitialized) return;
  engineInitialized = true;
  const s = () => usePlayerStore.setState;

  el.volume = usePlayerStore.getState().volume;
  el.addEventListener("timeupdate", () => s()({ progress: el.currentTime }));
  el.addEventListener("durationchange", () => {
    if (Number.isFinite(el.duration) && el.duration > 0) s()({ duration: el.duration });
  });
  el.addEventListener("play", () => s()({ isPlaying: true }));
  el.addEventListener("pause", () => s()({ isPlaying: false }));
  el.addEventListener("waiting", () => s()({ isBuffering: true }));
  el.addEventListener("playing", () => s()({ isBuffering: false, isPlaying: true }));
  el.addEventListener("ended", () => usePlayerStore.getState().next(false));
  el.addEventListener("error", () => s()({ isPlaying: false, isBuffering: false }));

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => usePlayerStore.getState().togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => usePlayerStore.getState().togglePlay());
      navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().prev());
      navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().next());
    } catch {
      // ignore
    }
  }
}
