"use client";

import type { ReactNode } from "react";

interface SectionRowProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  children: ReactNode;
}

export function SectionRow({ title, subtitle, onSeeAll, seeAllLabel = "Show all", children }: SectionRowProps) {
  return (
    <section className="mb-8" aria-label={title}>
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {onSeeAll ? (
          <button onClick={onSeeAll} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground">
            {seeAllLabel}
          </button>
        ) : null}
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 md:gap-4">{children}</div>
    </section>
  );
}
