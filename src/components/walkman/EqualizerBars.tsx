"use client";

/** Three animated bars indicating the currently playing track. */
export function EqualizerBars({ className }: { className?: string }) {
  return (
    <span className={`flex h-3.5 items-end gap-[2.5px] ${className ?? ""}`} aria-label="Playing">
      <span className="eq-bar w-[3px] rounded-sm bg-amber-400" style={{ animationDelay: "0ms" }} />
      <span className="eq-bar w-[3px] rounded-sm bg-amber-400" style={{ animationDelay: "180ms" }} />
      <span className="eq-bar w-[3px] rounded-sm bg-amber-400" style={{ animationDelay: "360ms" }} />
    </span>
  );
}
