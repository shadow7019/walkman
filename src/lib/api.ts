"use client";

// TanStack Query data layer for Walkman.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GenreInfo, ImportPreview, PlaylistDetail, PlaylistSummary, SyncStatsResponse, Track } from "./types";

export type TrackSort = "catalog" | "trending" | "newest";

export interface SyncStatus {
  total: number;
  genreCount: number;
  lastSyncAt: string | null;
}

export const qk = {
  tracks: (q: string, genre: string, sort: TrackSort = "catalog", limit?: number) =>
    ["tracks", q, genre, sort, limit ?? null] as const,
  playlists: ["playlists"] as const,
  playlist: (id: string) => ["playlist", id] as const,
  likes: ["likes"] as const,
  history: ["history"] as const,
  genres: ["genres"] as const,
  syncStatus: ["syncStatus"] as const,
};

export interface LikesData {
  likedTrackIds: string[];
  tracks: Track[];
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

async function sendJSON<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

/* ---------------- queries ---------------- */

export function useTracks(q = "", genre = "", enabled = true, sort: TrackSort = "catalog", limit?: number) {
  return useQuery({
    queryKey: qk.tracks(q, genre, sort, limit),
    queryFn: async () => {
      const params = new URLSearchParams({ q, genre, sort });
      if (limit && limit > 0) params.set("limit", String(limit));
      const d = await getJSON<{ tracks: Track[] }>(`/api/tracks?${params.toString()}`);
      return d.tracks;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: qk.genres,
    queryFn: async () => (await getJSON<{ genres: GenreInfo[] }>("/api/genres")).genres,
    staleTime: 5 * 60_000,
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: qk.syncStatus,
    queryFn: () => getJSON<SyncStatus>("/api/sync"),
    staleTime: 30_000,
  });
}

export function usePlaylists() {
  return useQuery({
    queryKey: qk.playlists,
    queryFn: async () => (await getJSON<{ playlists: PlaylistSummary[] }>("/api/playlists")).playlists,
  });
}

export function usePlaylist(id: string | null) {
  return useQuery({
    queryKey: qk.playlist(id ?? ""),
    queryFn: async () => (await getJSON<{ playlist: PlaylistDetail }>(`/api/playlists/${id}`)).playlist,
    enabled: Boolean(id),
  });
}

export function useLikes() {
  return useQuery({
    queryKey: qk.likes,
    queryFn: async () => await getJSON<LikesData>("/api/likes"),
    staleTime: 15_000,
  });
}

export function useHistory(limit = 12) {
  return useQuery({
    queryKey: qk.history,
    queryFn: async () => (await getJSON<{ tracks: Track[] }>(`/api/history?limit=${limit}`)).tracks,
  });
}

/* ---------------- mutations ---------------- */

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ trackId }: { trackId: string; track?: Track }) =>
      sendJSON<{ liked: boolean }>("/api/likes", { trackId }),
    onMutate: async ({ trackId, track }) => {
      await qc.cancelQueries({ queryKey: qk.likes });
      const prev = qc.getQueryData<LikesData>(qk.likes);
      if (prev) {
        const isLiked = prev.likedTrackIds.includes(trackId);
        qc.setQueryData<LikesData>(qk.likes, {
          likedTrackIds: isLiked ? prev.likedTrackIds.filter((id) => id !== trackId) : [...prev.likedTrackIds, trackId],
          tracks: isLiked
            ? prev.tracks.filter((t) => t.id !== trackId)
            : track
              ? [track, ...prev.tracks.filter((t) => t.id !== trackId)]
              : prev.tracks,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.likes, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.likes });
    },
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      description?: string | null;
      gradient?: string;
      importedFrom?: string;
      trackIds?: string[];
    }) => sendJSON<{ playlist: PlaylistDetail }>("/api/playlists", vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.playlists });
    },
  });
}

export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; description?: string | null; gradient?: string }) =>
      sendJSON<{ playlist: PlaylistDetail }>(`/api/playlists/${id}`, patch, "PATCH"),
    onSuccess: (data) => {
      qc.setQueryData(qk.playlist(data.playlist.id), data.playlist);
      void qc.invalidateQueries({ queryKey: qk.playlists });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendJSON<{ ok: boolean }>(`/api/playlists/${id}`, undefined, "DELETE"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.playlists });
    },
  });
}

export function useAddTrackToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
      sendJSON<{ ok: boolean; trackCount: number }>(`/api/playlists/${playlistId}/tracks`, { trackId }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.playlist(vars.playlistId) });
      void qc.invalidateQueries({ queryKey: qk.playlists });
    },
  });
}

export function useRemoveTrackFromPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
      sendJSON<{ ok: boolean; trackCount: number }>(
        `/api/playlists/${playlistId}/tracks?trackId=${encodeURIComponent(trackId)}`,
        undefined,
        "DELETE"
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.playlist(vars.playlistId) });
      void qc.invalidateQueries({ queryKey: qk.playlists });
    },
  });
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (text: string) => sendJSON<ImportPreview>("/api/import", { text }),
  });
}

export function useSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sendJSON<SyncStatsResponse>("/api/sync", undefined),
    onSuccess: () => {
      // prefix match refetches every tracks query (any q/genre/sort/limit combination)
      void qc.invalidateQueries({ queryKey: ["tracks"] });
      void qc.invalidateQueries({ queryKey: qk.genres });
      void qc.invalidateQueries({ queryKey: qk.playlists });
      void qc.invalidateQueries({ queryKey: qk.likes });
      void qc.invalidateQueries({ queryKey: qk.syncStatus });
    },
  });
}
