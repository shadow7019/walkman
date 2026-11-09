'use client'

import { useState } from 'react'
import { Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Artwork with graceful gradient fallback when no cover is available
export function Cover({ src, alt, className, rounded = 'rounded-md' }: {
  src?: string | null
  alt: string
  className?: string
  rounded?: string
}) {
  const [err, setErr] = useState(false)
  const show = src && !err
  return (
    <div className={cn('relative overflow-hidden bg-muted shrink-0', rounded, className)}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setErr(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600/60 to-teal-900/80">
          <Music2 className="h-1/3 w-1/3 text-white/70" aria-hidden />
        </div>
      )}
    </div>
  )
}
