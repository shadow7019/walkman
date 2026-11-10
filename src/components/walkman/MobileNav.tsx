"use client";

import { FileInput, Home, Library, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/ui-store";

export function MobileNav() {
  const view = useUiStore((s) => s.view);
  const navigate = useUiStore((s) => s.navigate);
  const setImportOpen = useUiStore((s) => s.setImportOpen);

  const items = [
    { key: "home", label: "Home", icon: Home, active: view.type === "home", onClick: () => navigate({ type: "home" }) },
    { key: "search", label: "Search", icon: Search, active: view.type === "search", onClick: () => navigate({ type: "search" }) },
    { key: "library", label: "Library", icon: Library, active: view.type === "library" || view.type === "playlist" || view.type === "liked", onClick: () => navigate({ type: "library" }) },
    { key: "import", label: "Import", icon: FileInput, active: false, onClick: () => setImportOpen(true) },
  ] as const;

  return (
    <nav
      className="flex items-stretch justify-around border-t border-white/10 bg-zinc-950 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={item.onClick}
          className={cn(
            "flex min-h-[52px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
            item.active ? "text-amber-400" : "text-muted-foreground active:text-foreground"
          )}
          aria-current={item.active ? "page" : undefined}
        >
          <item.icon className="size-5" aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
