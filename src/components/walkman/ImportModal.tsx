"use client";

import { useEffect, useState } from "react";
import { Check, FileInput, Loader2, Music, SearchX, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ImportPreview, Track } from "@/lib/types";
import { useCreatePlaylist, useImportPreview } from "@/lib/api";
import { useUiStore } from "@/lib/ui-store";
import { CoverArt } from "./CoverArt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SAMPLE_JSON = `{
  "name": "Road Trip 2025",
  "items": [
    { "track": { "name": "Midnight Cassette", "artists": [{ "name": "Neon Harbour" }] } },
    { "track": { "name": "Paper Skies", "artists": [{ "name": "Aria Vale" }] } },
    { "track": { "name": "Golden Hour Radio", "artists": [{ "name": "The Midnight Tapes" }] } },
    { "track": { "name": "Blinding Lights", "artists": [{ "name": "The Weeknd" }] } },
    { "track": { "name": "Night Bus Home", "artists": [{ "name": "Lo-Fi District" }] } },
    { "track": { "name": "Echo Parade", "artists": [{ "name": "Echo Parade" }] } }
  ]
}`;

const SAMPLE_TEXT = `1. Neon Harbour - Midnight Cassette
2. Cassette Club - Velvet Static
3. Lo-Fi District - Rain on the Window
4. Solar Kin – Solar Bloom
5. Aria Vale by Paper Skies
6. Aqua Manatee - Tidal Static (3:41)`;

const FORMAT_LABELS: Record<string, string> = {
  json: "JSON export",
  csv: "CSV file",
  text: "pasted list",
};

const NO_MATCH = "__none__";

function confidenceBadge(confidence: number): { label: string; className: string } {
  if (confidence >= 0.8) return { label: `${Math.round(confidence * 100)}% match`, className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" };
  return { label: `${Math.round(confidence * 100)}% match`, className: "border-amber-400/50 bg-amber-400/10 text-amber-400" };
}

export function ImportModal() {
  const importOpen = useUiStore((s) => s.importOpen);
  const setImportOpen = useUiStore((s) => s.setImportOpen);
  const navigate = useUiStore((s) => s.navigate);

  const importPreview = useImportPreview();
  const createPlaylist = useCreatePlaylist();

  const [step, setStep] = useState<"input" | "preview">("input");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selections, setSelections] = useState<(string | null)[]>([]);
  const [included, setIncluded] = useState<boolean[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!importOpen) {
      const t = setTimeout(() => {
        setStep("input");
        setText("");
        setPreview(null);
        setSelections([]);
        setIncluded([]);
        setName("");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [importOpen]);

  async function runPreview() {
    if (!text.trim()) return;
    try {
      const result = await importPreview.mutateAsync(text);
      if (!result.entries.length) {
        toast.info("Couldn't find any tracks in that text. Try one track per line, like “Artist - Title”.");
        return;
      }
      setPreview(result);
      setSelections(result.entries.map((e) => e.bestMatch?.id ?? null));
      setIncluded(result.entries.map((e) => Boolean(e.bestMatch)));
      setName(result.playlistNameHint ?? "");
      setStep("preview");
      if (result.stats.matched < result.stats.total) {
        toast.info(`Auto-matched ${result.stats.matched} of ${result.stats.total} tracks — review the rest below.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function create() {
    if (!preview) return;
    const trackIds = preview.entries.map((_, i) => (included[i] ? selections[i] : null)).filter((id): id is string => Boolean(id));
    if (!trackIds.length) {
      toast.info("Pick at least one track to include.");
      return;
    }
    try {
      const { playlist } = await createPlaylist.mutateAsync({
        name: name.trim() || "My Imported Playlist",
        description: `Imported from another music app (${FORMAT_LABELS[preview.format] ?? preview.format}) — ${preview.stats.total} tracks scanned.`,
        importedFrom: FORMAT_LABELS[preview.format] ?? preview.format,
        trackIds,
      });
      toast.success(`Imported ${trackIds.length} of ${preview.stats.total} tracks into “${playlist.name}”`);
      setImportOpen(false);
      navigate({ type: "playlist", id: playlist.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create playlist");
    }
  }

  const chosenCount = preview ? preview.entries.reduce((acc, _, i) => acc + (included[i] && selections[i] ? 1 : 0), 0) : 0;
  const busy = importPreview.isPending || createPlaylist.isPending;

  return (
    <Dialog open={importOpen} onOpenChange={setImportOpen}>
      <DialogContent className="max-h-[90dvh] overflow-hidden bg-zinc-950 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-white/10 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-400 text-black">
              <FileInput className="size-4" />
            </span>
            Import a playlist
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Works with Spotify, Apple Music, YouTube Music, Gaana, JioSaavn — any app that lets you copy a track list.
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4 max-h-[70dvh]">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/5 px-3 py-1 text-muted-foreground">Plain text lines</span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-muted-foreground">Spotify / JSON export</span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-muted-foreground">CSV / TSV</span>
              <span className="rounded-full bg-amber-400/10 px-3 py-1 font-semibold text-amber-400">Auto-detected</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste your playlist here, one track per line:\n\nNeon Harbour - Midnight Cassette\nAria Vale - Paper Skies\nThe Weeknd - Blinding Lights (3:20)\n\n…or paste a JSON / CSV export.`}
              className="thin-scrollbar h-56 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-400/60 focus:outline-none"
              aria-label="Playlist text to import"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full border-white/15 bg-white/5" onClick={() => setText(SAMPLE_JSON)}>
                <Sparkles className="size-3.5" /> Try a Spotify JSON sample
              </Button>
              <Button variant="outline" size="sm" className="rounded-full border-white/15 bg-white/5" onClick={() => setText(SAMPLE_TEXT)}>
                <Music className="size-3.5" /> Try a text list sample
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Walkman scans your list and matches each track against its free hi-fi catalog. Anything it can&apos;t match, you can swap manually in the next step.
            </p>
          </div>
        ) : preview ? (
          <div className="flex max-h-[70dvh] flex-col">
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-6 py-3">
              <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-400">
                {FORMAT_LABELS[preview.format] ?? preview.format}
              </Badge>
              <p className="text-sm font-semibold">
                Matched {preview.stats.matched} of {preview.stats.total} tracks
              </p>
              <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground" onClick={() => setStep("input")}>
                Edit source text
              </Button>
            </div>

            <div className="thin-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
              {preview.entries.map((entry, i) => {
                const selectedId = selections[i];
                const selectedTrack: Track | null = selectedId
                  ? preview.entries.flatMap((e) => [e.bestMatch, ...e.suggestions]).find((t) => t?.id === selectedId) ?? null
                  : null;
                const badge = selectedId && entry.bestMatch?.id === selectedId && !entry.swapped ? confidenceBadge(entry.confidence) : null;
                return (
                  <div
                    key={`${i}-${entry.raw.slice(0, 24)}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-2.5 transition-opacity",
                      !included[i] && "opacity-45"
                    )}
                  >
                    <Checkbox
                      checked={included[i]}
                      onCheckedChange={(v) => setIncluded((arr) => arr.map((x, j) => (j === i ? Boolean(v) : x)))}
                      className="shrink-0"
                      aria-label={`Include ${entry.title}`}
                    />
                    <span className="relative size-9 shrink-0 overflow-hidden rounded border border-white/10">
                      {selectedTrack ? (
                        <CoverArt src={selectedTrack.cover} alt="" sizes="72px" />
                      ) : (
                        <span className="flex size-full items-center justify-center bg-white/5">
                          <SearchX className="size-4 text-muted-foreground" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={entry.raw}>
                        {selectedTrack ? selectedTrack.title : entry.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {selectedTrack ? selectedTrack.artist : entry.artist ? `${entry.artist} — no match on Walkman` : "No match on Walkman"}
                      </span>
                    </span>
                    {badge ? (
                      <span className={cn("hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline-block", badge.className)}>
                        {badge.label}
                      </span>
                    ) : null}
                    {entry.source === "audius" ? (
                      <span
                        title="Added to your catalog"
                        className="hidden shrink-0 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 sm:inline-block"
                      >
                        matched on network
                      </span>
                    ) : null}
                    <Select
                      value={selectedId ?? NO_MATCH}
                      onValueChange={(v) => {
                        setSelections((arr) => arr.map((x, j) => (j === i ? (v === NO_MATCH ? null : v) : x)));
                        setIncluded((arr) => arr.map((x, j) => (j === i ? v !== NO_MATCH : x)));
                      }}
                    >
                      <SelectTrigger size="sm" className="w-[150px] shrink-0 border-white/10 bg-white/5 text-xs" aria-label={`Match for ${entry.title}`}>
                        <SelectValue placeholder="No match" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value={NO_MATCH} className="text-muted-foreground">
                          Not on Walkman
                        </SelectItem>
                        {entry.suggestions.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title} — {t.artist}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={preview.playlistNameHint ? preview.playlistNameHint : "My Imported Playlist"}
                className="flex-1 rounded-full border-white/10 bg-white/5"
                aria-label="New playlist name"
                maxLength={80}
              />
              <Button
                onClick={create}
                disabled={busy || chosenCount === 0}
                className="rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300"
              >
                {createPlaylist.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                Create playlist ({chosenCount})
              </Button>
            </div>
          </div>
        ) : null}

        {step === "input" ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 text-emerald-400" /> Nothing leaves your browser — matching runs on this server.
            </p>
            <Button onClick={runPreview} disabled={!text.trim() || importPreview.isPending} className="rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300">
              {importPreview.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Find matches
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
