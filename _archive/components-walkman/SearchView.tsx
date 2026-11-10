"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Play, Search, X } from "lucide-react";
import { useGenres, useTracks } from "@/lib/api";
import { usePlayerStore } from "@/lib/player";
import { TrackRow } from "./TrackRow";
import { SectionRow } from "./SectionRow";
import { GenreTile } from "./MediaCard";
import { CoverArt } from "./CoverArt";
import { PlayFab } from "./MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchView() {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const deferredQ = useDeferredValue(q);
  const { data: tracks, isLoading, isFetched } = useTracks(deferredQ, genre, Boolean(deferredQ.trim() || genre));
  const { data: genresData } = useGenres();
  const playQueue = usePlayerStore((s) => s.playQueue);

  const results = tracks ?? [];
  const genres = genresData ?? [];

  const albums = useMemo(() => {
    const map = new Map<string, typeof results>();
    for (const t of results) {
      if (!map.has(t.album)) map.set(t.album, []);
      map.get(t.album)?.push(t);
    }
    return Array.from(map.entries()).slice(0, 10);
  }, [results]);

  const topResult = results[0];
  const songRows = results.slice(0, 8);
  const hasQuery = Boolean(deferredQ.trim() || genre);
  const noResults = hasQuery && isFetched && !isLoading && results.length === 0;

  return (
    <div className="pt-2">
      <div className="relative mb-6 max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value) setGenre("");
          }}
          placeholder="What do you want to listen to?"
          className="h-12 rounded-full border-0 bg-white/10 pl-12 pr-12 text-base focus-visible:ring-amber-400/60"
          aria-label="Search songs, artists, albums"
          autoFocus
        />
        {q ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {genre && !deferredQ ? (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setGenre("")}
            className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-300"
          >
            {genre} <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {!hasQuery ? (
        <div>
          <h2 className="mb-4 px-1 text-xl font-bold tracking-tight">Browse all</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {genres.map((g) => (
              <GenreTile key={g.name} genre={g.name} cover={g.cover} count={g.count} onClick={() => setGenre(g.name)} />
            ))}
            {!genres.length
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg md:h-32" />)
              : null}
          </div>
        </div>
      ) : noResults ? (
        <div className="py-16 text-center">
          <p className="text-lg font-bold">No results found for “{deferredQ || genre}”</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different spelling, or import this song&apos;s playlist from your other app.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          {topResult ? (
            <div>
              <h2 className="mb-3 px-1 text-xl font-bold tracking-tight">Top result</h2>
              <button
                onClick={() => playQueue(results, 0, `Search: ${deferredQ || genre}`)}
                className="group relative flex w-full flex-col gap-4 rounded-lg bg-white/[0.04] p-5 text-left transition-colors hover:bg-white/[0.09]"
                aria-label={`Play ${topResult.title} by ${topResult.artist}`}
              >
                <span className="relative size-28 overflow-hidden rounded-md shadow-2xl md:size-32">
                  <CoverArt src={topResult.cover} alt={`${topResult.album} cover`} sizes="160px" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-2xl font-black tracking-tight md:text-3xl">{topResult.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {topResult.artist} · {topResult.album} · {topResult.genre}
                  </span>
                </span>
                <span className="absolute bottom-5 right-5">
                  <PlayFab
                    playing={false}
                    label={`Play ${topResult.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playQueue(results, 0, `Search: ${deferredQ || genre}`);
                    }}
                  />
                </span>
              </button>
            </div>
          ) : null}

          <div className="min-w-0">
            <h2 className="mb-3 px-1 text-xl font-bold tracking-tight">Songs</h2>
            <div>
              {songRows.map((t) => (
                <TrackRow key={t.id} track={t} contextTracks={results} contextLabel={`Search: ${deferredQ || genre}`} showAlbum={false} />
              ))}
            </div>

            {albums.length > 1 ? (
              <div className="mt-6">
                <SectionRow title="Albums">
                  {albums.map(([album, albumTracks]) => (
                    <button
                      key={album}
                      onClick={() => playQueue(albumTracks, 0, album)}
                      className="group w-[160px] shrink-0 rounded-lg bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.08] md:w-[180px]"
                      aria-label={`Play album ${album}`}
                    >
                      <span className="relative mb-3 block aspect-square overflow-hidden rounded-md">
                        <CoverArt src={albumTracks[0]?.cover} alt={`${album} cover`} sizes="200px" />
                        <span className="absolute bottom-2 right-2">
                          <PlayFab
                            playing={false}
                            label={`Play ${album}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              playQueue(albumTracks, 0, album);
                            }}
                          />
                        </span>
                      </span>
                      <span className="block truncate text-sm font-semibold">{album}</span>
                      <span className="block truncate text-xs text-muted-foreground">{albumTracks[0]?.year} · {albumTracks[0]?.artist}</span>
                    </button>
                  ))}
                </SectionRow>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {!hasQuery && !genres.length ? (
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Play className="mb-2 size-8 opacity-40" />
          <p className="text-sm">Loading the catalog…</p>
        </div>
      ) : null}
    </div>
  );
}
