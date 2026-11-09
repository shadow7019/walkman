"use client";

import { useState } from "react";
import { Heart, ListPlus, ListStart, MoreHorizontal, Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/types";
import { formatDuration } from "@/lib/types";
import { usePlayerStore } from "@/lib/player";
import { useAddTrackToPlaylist, useLikes, usePlaylists, useToggleLike } from "@/lib/api";
import { useUiStore } from "@/lib/ui-store";
import { CoverArt } from "./CoverArt";
import { EqualizerBars } from "./EqualizerBars";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrackRowProps {
  track: Track;
  contextTracks: Track[];
  contextLabel: string;
  index?: number; // display index (0-based) when no cover column is desired
  showCover?: boolean;
  showAlbum?: boolean;
  queueIndex?: number; // when set (queue panel), clicking plays this queue position
  onRemove?: () => void;
  removeLabel?: string;
}

export function TrackRow({ track, contextTracks, contextLabel, index, showCover = true, showAlbum = true, queueIndex, onRemove, removeLabel = "Remove from this playlist" }: TrackRowProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const { data: likes } = useLikes();
  const toggleLike = useToggleLike();
  const { data: playlists } = usePlaylists();
  const addToPlaylist = useAddTrackToPlaylist();
  const setNewPlaylistOpen = useUiStore((s) => s.setNewPlaylistOpen);
  const setPendingTrack = useUiStore((s) => s.setPendingTrack);
  const [menuOpen, setMenuOpen] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const liked = likes?.likedTrackIds.includes(track.id) ?? false;

  function activate() {
    if (queueIndex !== undefined) {
      playIndex(queueIndex);
      return;
    }
    const start = contextTracks.findIndex((t) => t.id === track.id);
    playQueue(contextTracks, start >= 0 ? start : 0, contextLabel);
  }

  function onRowKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      activate();
    }
  }

  async function handleAddToPlaylist(playlistId: string, playlistName: string) {
    try {
      await addToPlaylist.mutateAsync({ playlistId, trackId: track.id });
      toast.success(`Added "${track.title}" to ${playlistName}`);
    } catch (err) {
      toast.info(err instanceof Error ? err.message : "Could not add track");
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onRowKeyDown}
      aria-label={`Play ${track.title} by ${track.artist}`}
      className={cn(
        "group grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/10 sm:px-3",
        showAlbum && "md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_auto]",
        isCurrent && "bg-white/[0.06]"
      )}
    >
      {/* index / cover */}
      <div className="relative size-10 shrink-0">
        {showCover ? (
          <>
            <span className="absolute inset-0 overflow-hidden rounded">
              <CoverArt src={track.cover} alt="" sizes="80px" />
            </span>
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded bg-black/50 transition-opacity",
                isCurrent && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              {isCurrent && isPlaying ? (
                <Pause className="size-4 fill-white text-white" aria-hidden="true" />
              ) : (
                <Play className="size-4 fill-white text-white" aria-hidden="true" />
              )}
            </span>
          </>
        ) : (
          <span className="flex size-10 items-center justify-center">
            {isCurrent && isPlaying ? (
              <EqualizerBars />
            ) : (
              <>
                <span className={cn("text-sm tabular-nums group-hover:hidden", isCurrent ? "text-amber-400" : "text-muted-foreground")}>
                  {(index ?? 0) + 1}
                </span>
                <Play className="hidden size-4 fill-white text-white group-hover:block" aria-hidden="true" />
              </>
            )}
          </span>
        )}
      </div>

      {/* title / artist */}
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", isCurrent && "text-amber-300")}>{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist}
          {showAlbum ? <span className="md:hidden"> · {track.album}</span> : null}
        </p>
      </div>

      {/* album (desktop) */}
      {showAlbum ? <p className="hidden truncate text-sm text-muted-foreground md:block">{track.album}</p> : null}

      {/* actions */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 rounded-full transition-opacity",
            liked ? "text-amber-400 opacity-100 hover:text-amber-300" : "text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
            menuOpen && "opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleLike.mutate({ trackId: track.id, track });
          }}
          aria-label={liked ? `Remove ${track.title} from Liked Songs` : `Add ${track.title} to Liked Songs`}
        >
          <Heart className={cn("size-4", liked && "fill-amber-400")} aria-hidden="true" />
        </Button>

        <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{formatDuration(track.durationSec)}</span>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
              aria-label={`More options for ${track.title}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => activate()}>
              <Play className="size-4" /> {isCurrent && isPlaying ? "Restart track" : "Play now"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => usePlayerStore.getState().playNextInQueue(track)}>
              <ListStart className="size-4" /> Play next
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { usePlayerStore.getState().addToQueue(track); toast.success(`Added "${track.title}" to queue`); }}>
              <ListPlus className="size-4" /> Add to queue
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                toggleLike.mutate({ trackId: track.id, track });
                toast.success(liked ? "Removed from Liked Songs" : "Added to Liked Songs");
              }}
            >
              <Heart className={cn("size-4", liked && "fill-amber-400")} /> {liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Plus className="size-4" /> Add to playlist
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="thin-scrollbar max-h-72 w-52 overflow-y-auto">
                {(playlists ?? []).map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => handleAddToPlaylist(p.id, p.name)}>
                    {p.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setPendingTrack(track);
                    setNewPlaylistOpen(true);
                  }}
                >
                  <Plus className="size-4" /> New playlist…
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {onRemove ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
                  <Trash2 className="size-4" /> {removeLabel}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
