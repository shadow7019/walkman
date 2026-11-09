"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePlaylist, useUpdatePlaylist } from "@/lib/api";
import { useUiStore } from "@/lib/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EditFormProps {
  initial: { name: string; description: string };
  pending: boolean;
  onSave: (values: { name: string; description: string }) => void;
}

function EditForm({ initial, pending, onSave }: EditFormProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);

  return (
    <>
      <div className="space-y-3 py-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Playlist name"
          maxLength={80}
          className="rounded-full border-white/10 bg-white/5"
          aria-label="Playlist name"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave({ name, description });
          }}
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add an optional description"
          maxLength={300}
          rows={3}
          className="resize-none rounded-lg border-white/10 bg-white/5"
          aria-label="Playlist description"
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onSave({ name, description })} disabled={pending} className="rounded-full border-white/15">
          Cancel
        </Button>
        <Button onClick={() => onSave({ name, description })} disabled={pending} className="rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditPlaylistDialog() {
  const editId = useUiStore((s) => s.editPlaylistId);
  const setEditPlaylist = useUiStore((s) => s.setEditPlaylist);
  const { data: playlist, isLoading } = usePlaylist(editId);
  const update = useUpdatePlaylist();

  async function save(values: { name: string; description: string }) {
    if (!editId) return;
    try {
      await update.mutateAsync({
        id: editId,
        name: values.name.trim() || playlist?.name || "Untitled",
        description: values.description.trim() ? values.description.trim() : null,
      });
      toast.success("Playlist updated");
      setEditPlaylist(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update playlist");
    }
  }

  return (
    <Dialog open={editId !== null} onOpenChange={(o) => !o && setEditPlaylist(null)}>
      <DialogContent className="bg-zinc-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black tracking-tight">
            <Pencil className="size-5 text-amber-400" /> Edit details
          </DialogTitle>
          <DialogDescription>Change the name and description of your playlist.</DialogDescription>
        </DialogHeader>
        {playlist ? (
          <EditForm key={playlist.id} initial={{ name: playlist.name, description: playlist.description ?? "" }} pending={update.isPending} onSave={save} />
        ) : (
          <div className="grid place-items-center py-10">
            {isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Playlist unavailable.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
