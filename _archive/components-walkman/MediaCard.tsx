"use client";

import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/types";
import { usePlayerStore } from "@/lib/player";
import { CoverArt } from "./CoverArt";

/* ---------------- Playlist card ---------------- */

export function PlaylistCoverArt({ covers, gradient, className }: { covers: string[]; gradient: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", gradient, className)}>
      {covers.length >= 4 ? (
        <div className="grid size-full grid-cols-2 grid-rows-2">
          {covers.slice(0, 4).map((c, i) => (
            <span key={`${c}-${i}`} className="relative">
              <CoverArt src={c} alt="" sizes="180px" />
            </span>
          ))}
        </div>
      ) : covers.length > 0 ? (
        <CoverArt src={covers[0]} alt="" className="opacity-80" sizes="240px" />
      ) : null}
    </div>
  );
}

/* ---------------- Generic hover FAB ---------------- */

export function PlayFab({ playing, onClick, className, label }: { playing?: boolean; onClick: (e: React.MouseEvent) => void; className?: string; label: string }) {
  // rendered as a span: the surrounding card is the real accessible <button>,
  // and a nested <button> would be invalid HTML (hydration error)
  return (
    <span
      onClick={onClick}
      aria-hidden="true"
      title={label}
      className={cn(
        "flex size-11 translate-y-1 items-center justify-center rounded-full bg-amber-400 text-black opacity-0 shadow-xl transition-all duration-200 hover:scale-105 hover:bg-amber-300 group-hover:translate-y-0 group-hover:opacity-100",
        playing && "translate-y-0 opacity-100",
        className
      )}
    >
      {playing ? <Pause className="size-5 fill-black" /> : <Play className="size-5 fill-black pl-0.5" />}
    </span>
  );
}

/* ---------------- Track card (horizontal sections) ---------------- */

export function TrackCard({ track, contextTracks, contextLabel }: { track: Track; contextTracks: Track[]; contextLabel: string }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const isCurrent = currentTrack?.id === track.id;

  function play(e: React.MouseEvent) {
    e.stopPropagation();
    const start = contextTracks.findIndex((t) => t.id === track.id);
    playQueue(contextTracks, start >= 0 ? start : 0, contextLabel);
  }

  return (
    <button
      onClick={play}
      className="group w-[160px] shrink-0 rounded-lg bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.08] md:w-[180px]"
      aria-label={`Play ${track.title} by ${track.artist}`}
    >
      <span className="relative mb-3 block aspect-square overflow-hidden rounded-md">
        <CoverArt src={track.cover} alt={`${track.album} cover`} sizes="200px" />
        <span className="absolute bottom-2 right-2">
          <PlayFab playing={Boolean(isCurrent && isPlaying)} onClick={play} label={`Play ${track.title}`} />
        </span>
      </span>
      <span className="block truncate text-sm font-semibold">{track.title}</span>
      <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
    </button>
  );
}

/* ---------------- Genre tile ---------------- */

const GENRE_GRADIENTS: Record<string, string> = {
  Synthwave: "from-amber-400 to-rose-600",
  "Lo-Fi": "from-teal-400 to-emerald-700",
  "Dream Pop": "from-pink-400 to-rose-600",
  "Indie Electronic": "from-orange-400 to-red-600",
  Electronic: "from-lime-400 to-teal-600",
  "Retro Soul": "from-yellow-400 to-orange-600",
  "Alt Rock": "from-stone-400 to-stone-700",
  Pop: "from-fuchsia-400 to-pink-600",
  Indie: "from-emerald-400 to-teal-700",
  "Hip-Hop": "from-orange-400 to-red-700",
  Rock: "from-red-400 to-stone-700",
  Alternative: "from-rose-400 to-zinc-700",
  "R&B / Soul": "from-purple-400 to-fuchsia-700",
  House: "from-cyan-400 to-teal-700",
  "Tech House": "from-teal-400 to-cyan-700",
  "Deep House": "from-sky-400 to-blue-800",
  Techno: "from-zinc-400 to-zinc-800",
  Trance: "from-violet-400 to-purple-800",
  Trap: "from-amber-400 to-yellow-700",
  "Drum & Bass": "from-lime-400 to-green-700",
  Dubstep: "from-green-400 to-emerald-800",
  "Future Bass": "from-pink-400 to-purple-600",
  Hardstyle: "from-red-400 to-orange-700",
  "UK Garage": "from-teal-300 to-indigo-700",
  Electro: "from-yellow-400 to-lime-700",
  Vaporwave: "from-pink-300 to-cyan-500",
  Hyperpop: "from-fuchsia-300 to-red-500",
  Ambient: "from-slate-400 to-slate-700",
  Downtempo: "from-stone-400 to-neutral-700",
  Classical: "from-amber-200 to-amber-700",
  Soundtrack: "from-slate-500 to-zinc-900",
  Jazz: "from-amber-300 to-yellow-800",
  Blues: "from-blue-400 to-slate-800",
  Folk: "from-orange-300 to-amber-800",
  Country: "from-yellow-300 to-orange-800",
  Metal: "from-gray-500 to-black",
  Punk: "from-red-400 to-rose-800",
  Reggae: "from-green-400 to-yellow-600",
  Dancehall: "from-lime-300 to-yellow-700",
  Disco: "from-fuchsia-400 to-amber-500",
  Funk: "from-orange-300 to-pink-700",
  "Devotional & Gospel": "from-amber-200 to-orange-500",
  Latin: "from-rose-400 to-red-700",
  "K-Pop": "from-pink-300 to-violet-600",
  "J-Pop": "from-rose-300 to-sky-600",
  World: "from-emerald-300 to-orange-600",
  Bollywood: "from-orange-400 to-fuchsia-600",
  "Easy Listening": "from-amber-200 to-teal-600",
  Comedy: "from-yellow-300 to-lime-600",
};

export function GenreTile({ genre, cover, count, onClick }: { genre: string; cover?: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-28 overflow-hidden rounded-lg bg-gradient-to-br p-4 text-left transition-transform hover:scale-[1.02] md:h-32",
        GENRE_GRADIENTS[genre] ?? "from-amber-400 to-orange-600"
      )}
    >
      <span className="relative z-10 text-base font-extrabold text-black drop-shadow-sm md:text-lg">{genre}</span>
      {typeof count === "number" ? (
        <span className="relative z-10 mt-1 block w-fit rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold text-white/90">
          {count} songs
        </span>
      ) : null}
      {cover ? (
        <span className="absolute -bottom-2 -right-3 block size-20 rotate-[18deg] overflow-hidden rounded shadow-2xl md:size-24">
          <CoverArt src={cover} alt="" sizes="120px" />
        </span>
      ) : null}
    </button>
  );
}
