"use client";

import { FileInput, Heart, Music2 } from "lucide-react";
import { useUiStore } from "@/lib/ui-store";
import { useLikes, usePlaylists } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaylistCoverArt } from "./MediaCard";
import { TrackRow } from "./TrackRow";

export function LibraryView() {
  const navigate = useUiStore((s) => s.navigate);
  const setImportOpen = useUiStore((s) => s.setImportOpen);
  const { data: playlists, isLoading } = usePlaylists();
  const { data: likes } = useLikes();

  return (
    <div className="pt-2">
      <div className="mb-4 flex items-center justify-between px-1">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Your Library</h1>
        <Button variant="outline" size="sm" className="rounded-full border-white/15 bg-white/5 hover:bg-white/10" onClick={() => setImportOpen(true)}>
          <FileInput className="size-4" /> Import
        </Button>
      </div>

      <Tabs defaultValue="playlists">
        <TabsList className="mb-6 bg-white/5">
          <TabsTrigger value="playlists" className="rounded-full px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-black">Playlists</TabsTrigger>
          <TabsTrigger value="songs" className="rounded-full px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-black">Songs</TabsTrigger>
        </TabsList>

        <TabsContent value="playlists">
          <button
            onClick={() => setImportOpen(true)}
            className="mb-6 flex w-full items-center gap-4 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-transparent p-4 text-left transition-colors hover:border-amber-400/60 hover:from-amber-400/15 md:p-5"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-black">
              <FileInput className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Bring your playlists from any app</span>
              <span className="block truncate text-sm text-muted-foreground">
                Paste a list from Spotify, Apple Music, YouTube Music, Gaana, JioSaavn — Walkman matches it to the free hi-fi catalog.
              </span>
            </span>
          </button>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : (playlists ?? []).length === 0 ? (
            <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-white/15 py-16 text-center">
              <Music2 className="size-8 text-muted-foreground" />
              <p className="font-semibold">No playlists yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">Create one from scratch, or import a playlist you already have somewhere else.</p>
              <div className="flex gap-2 pt-1">
                <Button className="rounded-full bg-amber-400 font-semibold text-black hover:bg-amber-300" onClick={() => setImportOpen(true)}>
                  <FileInput className="size-4" /> Import playlist
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {(playlists ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate({ type: "playlist", id: p.id })}
                  className="group rounded-lg bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.08]"
                  aria-label={`Open playlist ${p.name}`}
                >
                  <span className="relative mb-3 block aspect-square overflow-hidden rounded-md">
                    <PlaylistCoverArt covers={p.covers} gradient={p.gradient} className="size-full" />
                  </span>
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.importedFrom ? <span className="text-amber-400/90">Imported · </span> : null}
                    {p.trackCount} songs
                  </span>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="songs">
          <div className="mb-6 flex items-center gap-4 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-700/10 p-5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-700">
              <Heart className="size-7 fill-white text-white" />
            </span>
            <div>
              <p className="font-bold">Liked Songs</p>
              <p className="text-sm text-muted-foreground">{likes?.likedTrackIds.length ?? 0} songs you have hearted</p>
              <Button size="sm" className="mt-2 rounded-full bg-white font-semibold text-black hover:bg-white/90" onClick={() => navigate({ type: "liked" })}>
                Open
              </Button>
            </div>
          </div>

          <h2 className="mb-2 px-1 text-lg font-bold">All liked songs</h2>
          {likes && likes.tracks.length > 0 ? (
            <div>
              {likes.tracks.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i} contextTracks={likes.tracks} contextLabel="Liked Songs" showAlbum />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/15 px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing hearted yet — tap the heart on any track to save it here.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
