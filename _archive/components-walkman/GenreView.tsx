"use client";

// Genre page — all tracks of one Audius genre bucket, best surface first.

import { ArrowLeft, Play } from "lucide-react";
import { useUiStore } from "@/lib/ui-store";
import { useGenres, useTracks } from "@/lib/api";
import { usePlayerStore } from "@/lib/player";
import { TrackRow } from "./TrackRow";
import { CoverArt } from "./CoverArt";
import { Skeleton } from "@/components/ui/skeleton";

export function GenreView({ name }: { name: string }) {
  const back = useUiStore((s) => s.back);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const { data: tracks, isLoading } = useTracks("", name, true, "trending");
  const { data: genres } = useGenres();

  const list = tracks ?? [];
  const cover = genres?.find((g) => g.name === name)?.cover ?? list[0]?.cover ?? null;

  return (
    <div className="pb-10 pt-2">
      <div className="px-2 md:px-4">
        <button
          onClick={back}
          className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/5 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </button>

        {/* hero */}
        <div className="relative overflow-hidden rounded-xl border border-white/10">
          <div className="absolute inset-0" aria-hidden="true">
            {cover ? <CoverArt src={cover} alt="" sizes="(max-width: 768px) 100vw, 900px" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/75 to-black/40" />
          </div>
          <div className="relative flex min-h-[190px] flex-col justify-end gap-2 p-5 md:min-h-[230px] md:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Genre</p>
            <h1 className="break-words text-3xl font-black tracking-tight md:text-5xl">{name}</h1>
            <p className="text-sm text-zinc-300">
              {isLoading ? "Loading the network…" : `${list.length} real songs · streamed at 320 kbps HQ`}
            </p>
            <div className="pt-2">
              <button
                onClick={() => playQueue(list, 0, name)}
                disabled={!list.length}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-6 text-sm font-bold text-black shadow-xl transition-transform hover:scale-105 hover:bg-amber-300 disabled:opacity-40 disabled:hover:scale-100"
                aria-label={`Play all ${name} songs`}
              >
                <Play className="size-4 fill-black" aria-hidden="true" /> Play all
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 px-2 md:px-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-white/15 py-16 text-center">
            <p className="text-lg font-bold">Nothing in {name} yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Hit “Sync new songs” in the sidebar to pull fresh tracks from the network into this genre.
            </p>
          </div>
        ) : (
          <div className="thin-scrollbar max-h-[60vh] overflow-y-auto rounded-lg">
            {list.map((t) => (
              <TrackRow key={t.id} track={t} contextTracks={list} contextLabel={name} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
