"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAddTrackToPlaylist, useCreatePlaylist } from "@/lib/api";
import { useUiStore } from "@/lib/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const GRADIENT_CHOICES = [
  "from-amber-400 to-orange-600",
  "from-rose-500 to-orange-700",
  "from-teal-400 to-emerald-700",
  "from-violet-500 to-fuchsia-700",
  "from-lime-400 to-teal-600",
  "from-fuchsia-400 to-pink-600",
] as const;

export function NewPlaylistDialog() {
  const open = useUiStore((s) => s.newPlaylistOpen);
  const setOpen = useUiStore((s) => s.setNewPlaylistOpen);
  const navigate = useUiStore((s) => s.navigate);
  const pendingTrack = useUiStore((s) => s.pendingTrack);
  const setPendingTrack = useUiStore((s) => s.setPendingTrack);
  const createPlaylist = useCreatePlaylist();
  const addToPlaylist = useAddTrackToPlaylist();

  const [name, setName] = useState("");
  const [gradient, setGradient] = useState<string>(GRADIENT_CHOICES[0]);

  async function create() {
    try {
      const { playlist } = await createPlaylist.mutateAsync({
        name: name.trim() || "New Playlist",
        gradient,
        description: pendingTrack ? `Started with “${pendingTrack.title}”` : null,
      });
      if (pendingTrack) {
        try {
          await addToPlaylist.mutateAsync({ playlistId: playlist.id, trackId: pendingTrack.id });
          toast.success(`Added “${pendingTrack.title}” to ${playlist.name}`);
        } catch (err) {
          toast.info(err instanceof Error ? err.message : "Track already in playlist");
        }
        setPendingTrack(null);
      }
      toast.success(`Created “${playlist.name}”`);
      setOpen(false);
      setName("");
      setGradient(GRADIENT_CHOICES[0]);
      navigate({ type: "playlist", id: playlist.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create playlist");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPendingTrack(null); }}>
      <DialogContent className="bg-zinc-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black tracking-tight">
            <Plus className="size-5 text-amber-400" /> New playlist
          </DialogTitle>
          <DialogDescription>
            {pendingTrack ? `It will start with “${pendingTrack.title}”.` : "Give it a name and a cover color — you can add songs after."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            autoFocus
            maxLength={80}
            className="rounded-full border-white/10 bg-white/5"
            aria-label="Playlist name"
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover color</p>
            <div className="flex flex-wrap gap-2">
              {GRADIENT_CHOICES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGradient(g)}
                  aria-label={`Cover color ${g}`}
                  className={cn(
                    "size-10 rounded-md bg-gradient-to-br transition-all hover:scale-105",
                    g,
                    gradient === g ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950" : "opacity-70 hover:opacity-100"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={createPlaylist.isPending} className="rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300">
            {createPlaylist.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
