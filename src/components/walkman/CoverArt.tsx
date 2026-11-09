"use client";

import Image from "next/image";
import { useState } from "react";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverArtProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  sizes?: string;
  priority?: boolean;
}

/** Album artwork with a warm gradient fallback when the image is missing. */
export function CoverArt({ src, alt, className, iconClassName, sizes = "(max-width: 768px) 120px, 240px", priority }: CoverArtProps) {
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
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setError(true)}
    />
  );
}
