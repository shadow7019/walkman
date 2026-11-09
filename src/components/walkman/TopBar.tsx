"use client";

import { ChevronLeft, ChevronRight, FileInput } from "lucide-react";
import { useUiStore } from "@/lib/ui-store";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const canBack = useUiStore((s) => s.past.length > 0);
  const canForward = useUiStore((s) => s.future.length > 0);
  const back = useUiStore((s) => s.back);
  const forward = useUiStore((s) => s.forward);
  const setImportOpen = useUiStore((s) => s.setImportOpen);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 rounded-t-lg bg-zinc-950/80 px-3 py-2.5 backdrop-blur-md md:px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={back}
        disabled={!canBack}
        className="size-8 rounded-full bg-black/40 text-foreground"
        aria-label="Go back"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={forward}
        disabled={!canForward}
        className="size-8 rounded-full bg-black/40 text-foreground"
        aria-label="Go forward"
      >
        <ChevronRight className="size-5" />
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          onClick={() => setImportOpen(true)}
          className="rounded-full bg-amber-400 font-semibold text-black hover:bg-amber-300"
          size="sm"
          title="Import a playlist from any music app"
        >
          <FileInput className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Import playlist</span>
          <span className="sm:hidden">Import</span>
        </Button>
      </div>
    </header>
  );
}
