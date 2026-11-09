"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useUiStore } from "@/lib/ui-store";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { PlayerBar } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";
import { ImportModal } from "./ImportModal";
import { NewPlaylistDialog } from "./NewPlaylistDialog";
import { EditPlaylistDialog } from "./EditPlaylistDialog";
import { HomeView } from "./HomeView";
import { SearchView } from "./SearchView";
import { LibraryView } from "./LibraryView";
import { PlaylistView } from "./PlaylistView";

export function WalkmanApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 20_000,
          },
        },
      })
  );

  const view = useUiStore((s) => s.view);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [view]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-foreground">
        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <Sidebar />
          <main
            ref={mainRef}
            className="thin-scrollbar relative min-w-0 flex-1 overflow-y-auto rounded-lg bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950"
            aria-label="Walkman content"
          >
            <TopBar />
            <div className="px-2 pb-12 md:px-5">
              {view.type === "home" && <HomeView />}
              {view.type === "search" && <SearchView />}
              {view.type === "library" && <LibraryView />}
              {view.type === "liked" && <PlaylistView />}
              {view.type === "playlist" && <PlaylistView playlistId={view.id} />}
            </div>
          </main>
        </div>
        <PlayerBar />
        <MobileNav />
        <QueuePanel />
        <ImportModal />
        <NewPlaylistDialog />
        <EditPlaylistDialog />
        <Toaster position="top-center" theme="dark" richColors closeButton />
      </div>
    </QueryClientProvider>
  );
}
