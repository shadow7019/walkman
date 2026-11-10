"use client";

import { Clock3, Heart, MoreHorizontal, Pencil, Play, Search, Shuffle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUiStore } from "@/lib/ui-store";
import { useDeletePlaylist, useLikes, usePlaylist, useRemoveTrackFromPlaylist } from "@/lib/api";
import { usePlayerStore } from "@/lib/player";
import { formatTotalDuration } from "@/lib/types";
import type { Track } from "@/lib/types";
import { TrackRow } from "./TrackRow";
import { PlaylistCoverArt } from "./MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function LikedCover() {
  return (
    <span className="flex size-full items-center justify-center bg-gradient-to-br from-rose-500 to-orange-700">
      <Heart className="size-1/3 fill-white text-white" />
    </span>
  );
}

interface PlaylistHeaderProps {
  label: string;
  name: string;
  description?: string | null;
  meta: string;
  importedFrom?: string | null;
  cover: React.ReactNode;
  gradientClasses?: string;
  tracks: Track[];
  contextLabel: string;
  actions?: React.ReactNode;
}

function PlaylistHeader({ label, name, description, meta, importedFrom, cover, gradientClasses, tracks, contextLabel, actions }: PlaylistHeaderProps) {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const shuffleState = usePlayerStore((s) => s.shuffle);

  return (
    <div className="relative overflow-hidden px-4 pb-4 pt-2 md:px-6">
      {gradientClasses ? (
        <div className={`pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b opacity-25 blur-2xl ${gradientClasses}`} aria-hidden="true" />
      ) : null}
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:gap-6">
        <span className="relative size-36 shrink-0 overflow-hidden rounded-md shadow-2xl md:size-52">{cover}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <h1 className="mt-1 break-words text-3xl font-black tracking-tight md:text-5xl lg:text-6xl">{name}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {importedFrom ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                <Sparkles className="size-3" /> Imported from {importedFrom}
              </span>
            ) : null}
            {meta}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-3">
        <button
          onClick={() => tracks.length && playQueue(tracks, 0, contextLabel)}
          disabled={!tracks.length}
          className="flex size-14 items-center justify-center rounded-full bg-amber-400 text-black shadow-xl transition-transform hover:scale-105 disabled:opacity-40"
          aria-label={`Play ${name}`}
        >
          <Play className="size-6 fill-black pl-0.5" />
        </button>
        <Button
          variant="ghost"
          size="icon"
          className={`size-10 rounded-full ${shuffleState ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
          onClick={toggleShuffle}
          aria-label="Toggle shuffle"
          aria-pressed={shuffleState}
        >
          <Shuffle className="size-5" />
        </Button>
        {actions}
      </div>
    </div>
  );
}

function TrackTable({ tracks, contextLabel, playlistId }: { tracks: Track[]; contextLabel: string; playlistId?: string }) {
  const removeTrack = useRemoveTrackFromPlaylist();

  return (
    <div className="px-2 pb-10 md:px-4">
      <div className="hidden grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground md:grid">
        <span className="text-center">#</span>
        <span>Title</span>
        <span>Album</span>
        <span className="flex w-24 justify-end pr-9">
          <Clock3 className="size-3.5" />
        </span>
      </div>
      <div className="mt-2">
        {tracks.map((t, i) => (
          <TrackRow
            key={t.id}
            track={t}
            index={i}
            showCover={false}
            contextTracks={tracks}
            contextLabel={contextLabel}
            onRemove={
              playlistId
                ? async () => {
                    try {
                      await removeTrack.mutateAsync({ playlistId, trackId: t.id });
                      toast.success(`Removed "${t.title}"`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not remove track");
                    }
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export function PlaylistView({ playlistId }: { playlistId?: string }) {
  const navigate = useUiStore((s) => s.navigate);
  const setImportOpen = useUiStore((s) => s.setImportOpen);
  const setEditPlaylist = useUiStore((s) => s.setEditPlaylist);
  const isLikedView = !playlistId;

  const { data: playlist, isLoading, isError } = usePlaylist(isLikedView ? null : playlistId);
  const { data: likes } = useLikes();
  const deletePlaylist = useDeletePlaylist();

  if (isLikedView) {
    const tracks = likes?.tracks ?? [];
    return (
      <div>
        <PlaylistHeader
          label="Playlist"
          name="Liked Songs"
          description="Every track you have hearted on Walkman."
          meta={`${tracks.length} songs${tracks.length ? ` · ${formatTotalDuration(tracks.reduce((a, t) => a + t.durationSec, 0))}` : ""}`}
          cover={<LikedCover />}
          gradientClasses="from-rose-500 to-orange-700"
          tracks={tracks}
          contextLabel="Liked Songs"
        />
        {tracks.length === 0 ? (
          <div className="mx-2 grid place-items-center gap-3 rounded-xl border border-dashed border-white/15 py-16 text-center md:mx-4">
            <Heart className="size-8 text-muted-foreground" />
            <p className="font-semibold">Songs you like will appear here</p>
            <p className="max-w-sm text-sm text-muted-foreground">Tap the heart on any track to save it. Build your collection one tape at a time.</p>
            <Button className="mt-1 rounded-full bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => navigate({ type: "search" })}>
              <Search className="size-4" /> Find something to like
            </Button>
          </div>
        ) : (
          <TrackTable tracks={tracks} contextLabel="Liked Songs" />
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-2 md:p-4">
        <div className="flex gap-6">
          <Skeleton className="size-40 rounded-md md:size-52" />
          <div className="flex-1 space-y-3 py-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>
    );
  }

  if (isError || !playlist) {
    return (
      <div className="grid place-items-center gap-3 py-24 text-center">
        <p className="text-lg font-bold">Playlist not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted.</p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ type: "library" })}>
          Back to library
        </Button>
      </div>
    );
  }

  const tracks = playlist.tracks;

  return (
    <div>
      <PlaylistHeader
        label="Playlist"
        name={playlist.name}
        description={playlist.description}
        meta={`${playlist.trackCount} songs · ${formatTotalDuration(playlist.totalDurationSec)}`}
        importedFrom={playlist.importedFrom}
        cover={<PlaylistCoverArt covers={playlist.covers} gradient={playlist.gradient} className="size-full" />}
        gradientClasses={playlist.gradient}
        tracks={tracks}
        contextLabel={playlist.name}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground hover:text-foreground" aria-label="Playlist options">
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => setEditPlaylist(playlist.id)}>
                <Pencil className="size-4" /> Edit details
              </DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                    <Trash2 className="size-4" /> Delete playlist
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{playlist.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the playlist for good. Your liked songs and other playlists stay untouched.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          await deletePlaylist.mutateAsync(playlist.id);
                          toast.success(`Deleted “${playlist.name}”`);
                          navigate({ type: "library" });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not delete playlist");
                        }
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {tracks.length === 0 ? (
        <div className="mx-2 grid place-items-center gap-3 rounded-xl border border-dashed border-white/15 py-16 text-center md:mx-4">
          <p className="text-lg font-bold">Let&apos;s find something for your playlist</p>
          <p className="max-w-sm text-sm text-muted-foreground">Add songs from search, or import an existing playlist from another app and merge it here.</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button className="rounded-full bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => setImportOpen(true)}>
              <Sparkles className="size-4" /> Import into this playlist
            </Button>
            <Button variant="outline" className="rounded-full border-white/15" onClick={() => navigate({ type: "search" })}>
              <Search className="size-4" /> Search songs
            </Button>
          </div>
        </div>
      ) : (
        <TrackTable tracks={tracks} contextLabel={playlist.name} playlistId={playlist.id} />
      )}
    </div>
  );
}
