"use client";

// TanStack Query data layer for Walkman.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImportPreview, PlaylistDetail, PlaylistSummary, Track } from "./types";

export const qk = {
  tracks: (q: string, genre: string) => ["tracks", q, genre] as const,
  playlists: ["playlists"] as const,
  playlist: (id: string) => ["playlist", id] as const,
  likes: ["likes"] as const,
  history: ["history"] as const,
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

export function useTracks(q = "", genre = "", enabled = true) {
  return useQuery({
    queryKey: qk.tracks(q, genre),
    queryFn: async () => {
      const params = new URLSearchParams({ q, genre });
      const d = await getJSON<{ tracks: Track[] }>(`/api/tracks?${params.toString()}`);
      return d.tracks;
    },
    enabled,
    staleTime: 60_000,
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
