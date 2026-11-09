"use client";

import { Heart, Home, Plus, RefreshCw, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/ui-store";
import { useLikes, usePlaylists, useSyncNow, useSyncStatus } from "@/lib/api";
import { CassetteLogo } from "./CassetteLogo";
import { Button } from "@/components/ui/button";
import { FileInput } from "lucide-react";
import type { View } from "@/lib/ui-store";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
        active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}

export function Sidebar() {
  const view = useUiStore((s) => s.view);
  const navigate = useUiStore((s) => s.navigate);
  const setNewPlaylistOpen = useUiStore((s) => s.setNewPlaylistOpen);
  const setImportOpen = useUiStore((s) => s.setImportOpen);
  const { data: playlists } = usePlaylists();
  const { data: likes } = useLikes();
  const syncNow = useSyncNow();
  const { data: syncStatus } = useSyncStatus();
  const harvesting = syncNow.isPending || Boolean(syncStatus?.running);

  async function handleSync() {
    if (harvesting) return; // a harvest is already running — just watch the progress line
    try {
      const stats = await syncNow.mutateAsync("deep");
      toast.success(`+${stats.added} new songs · ${stats.total} in catalog`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not harvest new music");
    }
  }

  function formatCount(n: number): string {
    return n.toLocaleString("en-US");
  }

  const isActive = (t: View["type"]): boolean => {
    if (t === "library") return view.type === "library" || view.type === "playlist" || view.type === "liked";
    return view.type === t;
  };

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-2 md:flex lg:w-72" aria-label="Walkman navigation">
      <button
        onClick={() => navigate({ type: "home" })}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-amber-400 hover:bg-white/5"
      >
        <CassetteLogo className="size-9 shrink-0" />
        <span>
          <span className="block text-lg font-black italic leading-none tracking-tighter">Walkman</span>
          <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">free hi-fi streaming</span>
        </span>
      </button>

      <nav className="rounded-lg bg-white/[0.04] p-2" aria-label="Main">
        <NavItem icon={Home} label="Home" active={isActive("home")} onClick={() => navigate({ type: "home" })} />
        <NavItem icon={Search} label="Search" active={isActive("search")} onClick={() => navigate({ type: "search" })} />
      </nav>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-white/[0.04]">
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <span className="text-sm font-semibold text-muted-foreground">Your Library</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setNewPlaylistOpen(true)}
              aria-label="Create playlist"
              title="Create playlist"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-amber-400"
              onClick={() => setImportOpen(true)}
              aria-label="Import playlist"
              title="Import playlist from any app"
            >
              <FileInput className="size-4" />
            </Button>
          </div>
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          <button
            onClick={() => navigate({ type: "liked" })}
            className={cn(
              "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors",
              view.type === "liked" ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded bg-gradient-to-br from-rose-500 to-orange-700">
              <Heart className="size-5 fill-white text-white" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">Liked Songs</span>
              <span className="block truncate text-xs text-muted-foreground">Playlist · {likes?.likedTrackIds.length ?? 0} songs</span>
            </span>
          </button>

          {(playlists ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => navigate({ type: "playlist", id: p.id })}
              className={cn(
                "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors",
                view.type === "playlist" && view.id === p.id ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              <span className={cn("relative size-11 shrink-0 overflow-hidden rounded bg-gradient-to-br", p.gradient)}>
                {p.covers[0] ? (
                  <img src={p.covers[0]} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.importedFrom ? <span className="text-amber-400/90">Imported · </span> : null}
                  Playlist · {p.trackCount} songs
                </span>
              </span>
            </button>
          ))}

          {!playlists?.length && !likes ? null : null}
        </div>
      </div>

      <div className="space-y-1 px-1 pb-1">
        <button
          onClick={handleSync}
          disabled={harvesting}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-white/5 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-60 disabled:hover:bg-white/5"
          aria-label="Add all new music from the Audius network"
        >
          <RefreshCw className={cn("size-4", harvesting && "animate-spin")} aria-hidden="true" />
          {harvesting ? "Harvesting music…" : "Add all new music"}
        </button>
        {harvesting && syncStatus ? (
          <p className="text-center text-[10px] tabular-nums text-amber-400" role="status" aria-live="polite">
            sweeping the industry · +{formatCount(syncStatus.addedThisRun)} songs
          </p>
        ) : syncStatus?.lastSyncAt ? (
          <p className="text-center text-[10px] text-muted-foreground">
            {formatCount(syncStatus.total)} songs · updated {relativeTime(syncStatus.lastSyncAt)}
          </p>
        ) : null}
        <div className="flex items-center gap-2 px-3 pt-1 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          320 kbps HQ streaming · 100% free
        </div>
      </div>
    </aside>
  );
}
