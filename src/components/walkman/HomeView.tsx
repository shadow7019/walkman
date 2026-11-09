"use client";

import { useMemo } from "react";
import { Heart, FileInput, Play } from "lucide-react";
import { useUiStore } from "@/lib/ui-store";
import { useHistory, useLikes, usePlaylists, useTracks } from "@/lib/api";
import { SectionRow } from "./SectionRow";
import { PlaylistCoverArt, PlayFab, TrackCard, GenreTile } from "./MediaCard";
import { CoverArt } from "./CoverArt";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaylistSummary } from "@/lib/types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night listening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function PlaylistCard({ playlist, onClick }: { playlist: PlaylistSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-[160px] shrink-0 rounded-lg bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.08] md:w-[180px]"
      aria-label={`Open playlist ${playlist.name}`}
    >
      <span className="relative mb-3 block aspect-square overflow-hidden rounded-md">
        <PlaylistCoverArt covers={playlist.covers} gradient={playlist.gradient} className="size-full" />
        <span className="absolute bottom-2 right-2">
          <PlayFab playing={false} label={`Open ${playlist.name}`} onClick={(e) => { e.stopPropagation(); onClick(); }} />
        </span>
      </span>
      <span className="block truncate text-sm font-semibold">{playlist.name}</span>
      <span className="block truncate text-xs text-muted-foreground">
        {playlist.importedFrom ? <span className="text-amber-400/90">Imported · </span> : null}
        {playlist.trackCount} songs
      </span>
    </button>
  );
}

export function HomeView() {
  const navigate = useUiStore((s) => s.navigate);
  const setImportOpen = useUiStore((s) => s.setImportOpen);

  const { data: playlists, isLoading: loadingPlaylists } = usePlaylists();
  const { data: allTracks, isLoading: loadingTracks } = useTracks();
  const { data: history } = useHistory(10);
  const { data: likes } = useLikes();

  const trending = useMemo(() => {
    if (!allTracks) return [];
    const arr = [...allTracks];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 10);
  }, [allTracks]);

  const genres = useMemo(() => {
    if (!allTracks) return [];
    const seen = new Map<string, string>();
    for (const t of allTracks) if (!seen.has(t.genre)) seen.set(t.genre, t.cover);
    return Array.from(seen.entries()).map(([genre, cover]) => ({ genre, cover }));
  }, [allTracks]);

  const madeForYou = (playlists ?? []).slice(0, 8);

  return (
    <div>
      <h1 className="px-1 pb-4 pt-2 text-2xl font-black tracking-tight md:text-3xl">{greeting()}</h1>

      {/* brand banner */}
      <div className="relative mb-6 h-44 overflow-hidden rounded-xl border border-white/10 md:h-52">
        <CoverArt src="/covers/walkman-hero.jpg" alt="Walkman hero" className="object-cover" sizes="(max-width: 768px) 100vw, 1200px" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center gap-2 p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Free · Lossless · Yours</p>
          <h2 className="max-w-md text-2xl font-black tracking-tight md:text-3xl">Every playlist you love, now on Walkman.</h2>
          <p className="hidden max-w-md text-sm text-zinc-300 sm:block">
            Paste a track list from Spotify, Apple Music or YouTube Music — we rebuild it here in hi-fi, for free.
          </p>
          <div className="pt-1">
            <Button onClick={() => setImportOpen(true)} className="w-fit rounded-full bg-amber-400 font-semibold text-black hover:bg-amber-300">
              <FileInput className="size-4" /> Import a playlist
            </Button>
          </div>
        </div>
      </div>

      {/* quick access tiles */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          onClick={() => navigate({ type: "liked" })}
          className="group relative flex min-h-[64px] items-center gap-4 overflow-hidden rounded-md bg-white/[0.07] pr-4 text-left transition-colors hover:bg-white/[0.12] md:min-h-[80px]"
        >
          <span className="flex size-16 shrink-0 items-center justify-center bg-gradient-to-br from-rose-500 to-orange-700 md:size-20">
            <Heart className="size-6 fill-white text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold md:text-base">Liked Songs</span>
            <span className="block truncate text-xs text-muted-foreground">{likes?.likedTrackIds.length ?? 0} songs</span>
          </span>
          <span className="absolute right-4 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-6 fill-amber-400 text-amber-400" />
          </span>
        </button>

        {loadingPlaylists && !playlists
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md md:h-20" />)
          : madeForYou.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate({ type: "playlist", id: p.id })}
                className="group relative flex min-h-[64px] items-center gap-4 overflow-hidden rounded-md bg-white/[0.07] pr-4 text-left transition-colors hover:bg-white/[0.12] md:min-h-[80px]"
              >
                <span className="size-16 shrink-0 md:size-20">
                  <PlaylistCoverArt covers={p.covers} gradient={p.gradient} className="size-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold md:text-base">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.importedFrom ? "Imported playlist" : "Playlist"}</span>
                </span>
              </button>
            ))}
      </div>

      <SectionRow title="Made for you" subtitle="Curated mixes that follow your tape collection">
        {loadingPlaylists && !playlists
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-[160px] shrink-0 rounded-lg md:w-[180px]" />)
          : madeForYou.map((p) => <PlaylistCard key={p.id} playlist={p} onClick={() => navigate({ type: "playlist", id: p.id })} />)}
        {!loadingPlaylists && !madeForYou.length ? (
          <p className="py-6 text-sm text-muted-foreground">Create your first playlist to see it here.</p>
        ) : null}
      </SectionRow>

      <SectionRow title="Trending on Walkman" subtitle="What listeners are rewinding right now">
        {loadingTracks && !allTracks
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-[160px] shrink-0 rounded-lg md:w-[180px]" />)
          : trending.map((t) => <TrackCard key={t.id} track={t} contextTracks={trending} contextLabel="Trending on Walkman" />)}
      </SectionRow>

      {history && history.length > 0 ? (
        <SectionRow title="Recently played" onSeeAll={() => navigate({ type: "library" })}>
          {history.map((t) => (
            <TrackCard key={t.id} track={t} contextTracks={history} contextLabel="Recently played" />
          ))}
        </SectionRow>
      ) : null}

      <SectionRow title="Browse by mood" subtitle="Jump into a sound">
        {genres.map(({ genre, cover }) => (
          <div key={genre} className="w-[160px] shrink-0 md:w-[180px]">
            <GenreTile genre={genre} cover={cover} onClick={() => navigate({ type: "search" })} />
          </div>
        ))}
      </SectionRow>
    </div>
  );
}
