"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Check,
  ChevronDown,
  Heart,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { initAudioEngine, usePlayerStore } from "@/lib/player";
import { formatDuration, QUALITY_OPTIONS } from "@/lib/types";
import { useLikes, useToggleLike } from "@/lib/api";
import { CoverArt } from "./CoverArt";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const subscribeNever = () => () => undefined;

export function PlayerBar() {
  // false during SSR, true on the client — safe way to gate persisted UI without setState-in-effect
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const quality = usePlayerStore((s) => s.quality);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);

  const { data: likes } = useLikes();
  const toggleLike = useToggleLike();
  const [dragValue, setDragValue] = useState<number | null>(null);

  useEffect(() => {
    initAudioEngine();
  }, []);

  // Global keyboard shortcuts: Space play/pause, ←/→ seek ±10s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest('button, a, [role="button"], [role="slider"]'))) {
        return;
      }
      const store = usePlayerStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        store.togglePlay();
      } else if (e.code === "ArrowRight") {
        store.seek(store.progress + 10);
      } else if (e.code === "ArrowLeft") {
        store.seek(store.progress - 10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const liked = currentTrack ? (likes?.likedTrackIds.includes(currentTrack.id) ?? false) : false;
  const total = duration || currentTrack?.durationSec || 1;
  const shownProgress = dragValue ?? progress;
  const pct = Math.min(100, (shownProgress / Math.max(1, total)) * 100);
  const qualityOption = QUALITY_OPTIONS.find((q) => q.id === quality) ?? QUALITY_OPTIONS[2];
  const RepeatIcon = repeat === "track" ? Repeat1 : Repeat;

  return (
    <footer className="shrink-0 border-t border-white/10 bg-zinc-950" aria-label="Player">
      {/* mobile progress line */}
      <div className="h-0.5 w-full bg-white/10 md:hidden">
        <div className="h-full bg-amber-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-2 px-3 md:h-20 md:gap-4 md:px-4">
        {/* left: now playing */}
        <div className="flex min-w-0 items-center gap-3 md:w-[30%]">
          {currentTrack ? (
            <>
              <span className="relative size-11 shrink-0 overflow-hidden rounded-md md:size-14">
                <CoverArt src={currentTrack.cover} alt={`${currentTrack.album} cover`} sizes="80px" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{currentTrack.title}</p>
                <p className="truncate text-xs text-muted-foreground">{currentTrack.artist}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "hidden size-8 shrink-0 rounded-full sm:flex",
                  liked ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => currentTrack && toggleLike.mutate({ trackId: currentTrack.id, track: currentTrack })}
                aria-label={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
              >
                <Heart className={cn("size-4", liked && "fill-amber-400")} />
              </Button>
            </>
          ) : (
            <>
              <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5 md:size-14">
                <ListMusic className="size-5 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-muted-foreground">Nothing playing</p>
                <p className="truncate text-xs text-muted-foreground">Pick a track to start the tape</p>
              </div>
            </>
          )}
        </div>

        {/* center: controls + seekbar (desktop) */}
        <div className="hidden min-w-0 flex-1 flex-col items-center gap-1 md:flex">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8 rounded-full", shuffle ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground")}
              onClick={() => usePlayerStore.getState().toggleShuffle()}
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
            >
              <Shuffle className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => usePlayerStore.getState().prev()} aria-label="Previous track">
              <SkipBack className="size-5 fill-current" />
            </Button>
            <button
              onClick={() => usePlayerStore.getState().togglePlay()}
              disabled={!currentTrack}
              className="flex size-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-40"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <Loader2 className="size-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-5 fill-black" />
              ) : (
                <Play className="size-5 fill-black pl-0.5" />
              )}
            </button>
            <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => usePlayerStore.getState().next()} aria-label="Next track">
              <SkipForward className="size-5 fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8 rounded-full", repeat !== "off" ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground")}
              onClick={() => usePlayerStore.getState().cycleRepeat()}
              aria-label={`Repeat mode: ${repeat}`}
              aria-pressed={repeat !== "off"}
            >
              <RepeatIcon className="size-4" />
            </Button>
          </div>

          <div className="flex w-full max-w-xl items-center gap-2">
            <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{formatDuration(shownProgress)}</span>
            <Slider
              value={[Math.min(shownProgress, total)]}
              max={Math.max(1, total)}
              step={1}
              onValueChange={(v) => setDragValue(v[0] ?? 0)}
              onValueCommit={(v) => {
                usePlayerStore.getState().seek(v[0] ?? 0);
                setDragValue(null);
              }}
              className="player-slider flex-1"
              aria-label="Seek"
            />
            <span className="w-10 text-[11px] tabular-nums text-muted-foreground">{formatDuration(total)}</span>
          </div>
        </div>

        {/* right: quality, queue, volume */}
        <div className="flex items-center justify-end gap-1 md:w-[30%] md:gap-2">
          {/* mobile play button */}
          <button
            onClick={() => usePlayerStore.getState().togglePlay()}
            disabled={!currentTrack}
            className="flex size-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-40 md:hidden"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isBuffering ? (
              <Loader2 className="size-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="size-5 fill-black" />
            ) : (
              <Play className="size-5 fill-black pl-0.5" />
            )}
          </button>

          {mounted ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
                  aria-label={`Streaming quality: ${qualityOption.label}`}
                  title={`Streaming quality: ${qualityOption.label}`}
                >
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-black tracking-wide",
                      quality === "lossless" ? "bg-amber-400 text-black" : "bg-white/10 text-foreground"
                    )}
                  >
                    {qualityOption.badge}
                  </span>
                  <ChevronDown className="hidden size-3.5 sm:block" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Streaming quality</p>
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      usePlayerStore.getState().setQuality(q.id);
                      toast.success(`Streaming quality set to ${q.label}`);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5",
                      q.id === quality && "bg-white/[0.07]"
                    )}
                    role="radio"
                    aria-checked={q.id === quality}
                  >
                    <span className="flex-1">
                      <span className={cn("block text-sm font-semibold", q.id === quality && "text-amber-400")}>{q.label}</span>
                      <span className="block text-xs text-muted-foreground">{q.detail}</span>
                    </span>
                    {q.id === quality ? <Check className="size-4 text-amber-400" /> : null}
                  </button>
                ))}
                <p className="px-2 pt-2 text-[11px] leading-snug text-muted-foreground">
                  Walkman streams over HTTP Range requests — jump anywhere in a track instantly, at up to lossless fidelity.
                </p>
              </PopoverContent>
            </Popover>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8 rounded-full", queueOpen ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground")}
            onClick={() => usePlayerStore.getState().toggleQueueOpen()}
            aria-label="Toggle queue"
            aria-pressed={queueOpen}
          >
            <ListMusic className="size-4" />
          </Button>

          <div className="hidden items-center gap-1.5 md:flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => usePlayerStore.getState().toggleMute()}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <VolumeX className="size-4" /> : volume < 0.5 ? <Volume1 className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            {mounted ? (
              <Slider
                value={[muted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={(v) => usePlayerStore.getState().setVolume(v[0] ?? 0)}
                className="player-slider w-24"
                aria-label="Volume"
              />
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
