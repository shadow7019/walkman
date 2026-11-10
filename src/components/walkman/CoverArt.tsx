"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverArtProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  sizes?: string; // kept for API compatibility (next/image legacy); unused with plain <img>
  priority?: boolean; // eager-load above-the-fold art
}

/**
 * Album artwork with a warm gradient fallback when the image is missing.
 * Uses a plain <img> so arbitrary remote CDN URLs (Audius creator nodes) work
 * without next/image remotePatterns configuration.
 */
export function CoverArt({ src, alt, className, iconClassName, priority }: CoverArtProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-amber-500/70 via-orange-600/60 to-orange-900/70",
          className
        )}
        aria-label={alt}
        role="img"
      >
        <Music2 className={cn("size-1/3 text-white/70", iconClassName)} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("absolute inset-0 size-full object-cover", className)}
      onError={() => setError(true)}
    />
  );
}
