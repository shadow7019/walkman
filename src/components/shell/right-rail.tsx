'use client'

// Right rail: Now Playing queue (drag to reorder) + synced lyrics panel (click-to-seek).
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ListMusic, GripVertical, Trash2 } from 'lucide-react'
import { usePlayer } from '@/stores/player'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/client-api'
import { Cover } from '@/components/cover'
import { EqBars } from '@/components/track-list'
import { fmtTime, type LyricsResult } from '@/types'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

export function RightRail() {
  const { rightPanel, setRightPanel } = useUI()
  if (rightPanel === 'none') return null
  return (
    <aside
      className="relative z-20 hidden w-[340px] shrink-0 border-l border-border/50 bg-black/40 backdrop-blur-xl lg:block"
      aria-label={rightPanel === 'queue' ? 'Play queue' : 'Lyrics'}
    >
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {rightPanel === 'queue' ? <ListMusic className="h-4 w-4" aria-hidden /> : null}
          {rightPanel === 'queue' ? 'Queue' : 'Lyrics'}
        </h2>
        <button aria-label="Close panel" className="rounded-full p-1.5 hover:bg-white/10" onClick={() => setRightPanel('none')}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {rightPanel === 'queue' ? <QueuePanel /> : <LyricsPanel />}
    </aside>
  )
}

function QueuePanel() {
  const { queue, queueIndex, isPlaying, playTrackAt, removeFromQueue, reorderQueue, contextTitle } = usePlayer()

  // HTML5 drag & drop reorder
  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const upcoming = queue.map((t, i) => ({ t, i }))

  return (
    <ScrollArea className="h-[calc(100%-49px)]">
      <div className="px-3 py-3">
        {contextTitle && <p className="mb-2 px-1 text-xs text-muted-foreground">Playing from {contextTitle}</p>}
        <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Now playing</p>
        {queue[queueIndex] && (
          <QueueRow
            t={queue[queueIndex]}
            index={queueIndex}
            active
            isPlaying={isPlaying}
            onPlay={() => playTrackAt(queueIndex)}
          />
        )}
        <p className="mb-1 mt-4 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next up</p>
        <div role="list" aria-label="Up next">
          {upcoming.filter(({ i }) => i !== queueIndex).map(({ t, i }) => (
            <div
              key={`${t.id}-${i}`}
              draggable
              onDragStart={() => { dragFrom.current = i }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
              onDragEnd={() => {
                if (dragFrom.current !== null && dragOver !== null && dragFrom.current !== dragOver) {
                  reorderQueue(dragFrom.current, dragOver)
                }
                dragFrom.current = null
                setDragOver(null)
              }}
              role="listitem"
              className={cn(dragOver === i && 'ring-1 ring-emerald-400/60 rounded-lg')}
            >
              <QueueRow
                t={t}
                index={i}
                active={false}
                isPlaying={false}
                draggableHandle
                onPlay={() => playTrackAt(i)}
                onRemove={() => removeFromQueue(i)}
              />
            </div>
          ))}
          {queue.length <= 1 && (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              Queue is empty — add songs from any list, or let AutoPlay keep the music going.
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}

function QueueRow({ t, index, active, isPlaying, onPlay, onRemove, draggableHandle }: {
  t: ReturnType<typeof usePlayer.getState>['queue'][number]
  index: number
  active: boolean
  isPlaying: boolean
  onPlay: () => void
  onRemove?: () => void
  draggableHandle?: boolean
}) {
  return (
    <div className={cn('group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5', active && 'bg-white/[0.06]')}>
      {draggableHandle && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden />}
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onPlay} aria-label={`Play ${t.title}`}>
        <div className="relative shrink-0">
          <Cover src={t.cover} alt="" className="h-9 w-9" />
          {active && isPlaying && <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50"><EqBars /></div>}
        </div>
        <div className="min-w-0">
          <div className={cn('truncate text-sm', active && 'text-emerald-400')}>{t.title}</div>
          <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
        </div>
      </button>
      <span className="text-[10px] tabular-nums text-muted-foreground">{fmtTime(t.durationMs)}</span>
      {onRemove && (
        <button aria-label={`Remove ${t.title} from queue`} className="rounded-full p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <span className="sr-only">Position {index + 1}</span>
    </div>
  )
}

function LyricsPanel() {
  const { queue, queueIndex, position, seek } = usePlayer()
  const track = queue[queueIndex]
  const [data, setData] = useState<LyricsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const activeLineRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!track) { setData(null); return }
    let cancel = false
    setLoading(true)
    setData(null)
    api.lyrics(track.title, track.artist, track.durationMs / 1000)
      .then((r) => { if (!cancel) setData(r) })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [track?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeIdx = useMemo(() => {
    if (!data?.synced) return -1
    const lines = data.synced
    let lo = 0, hi = lines.length - 1, res = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (lines[mid].time <= position) { res = mid; lo = mid + 1 } else hi = mid - 1
    }
    return res
  }, [data, position])

  // auto-scroll active line into view
  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIdx])

  if (!track) return <p className="p-6 text-sm text-muted-foreground">Play a song to see its lyrics.</p>

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-white/10" style={{ width: `${60 + ((i * 13) % 40)}%` }} />
        ))}
      </div>
    )
  }

  if (!data || (!data.synced && !data.plain)) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <p>No lyrics found for “{track.title}”.</p>
        <p className="mt-2 text-xs">Lyrics are fetched live from LRCLIB — millions of songs covered.</p>
      </div>
    )
  }

  if (data.synced) {
    return (
      <ScrollArea className="h-[calc(100%-49px)]">
        <div className="px-6 py-6">
          {data.synced.map((line, i) => (
            <button
              key={i}
              ref={i === activeIdx ? activeLineRef : undefined}
              onClick={() => seek(line.time)}
              aria-label={`Seek to ${fmtTime(line.time * 1000)}`}
              className={cn(
                'block w-full py-1.5 text-left text-lg font-medium leading-snug transition-all duration-200',
                i === activeIdx
                  ? 'scale-[1.02] text-foreground'
                  : 'text-muted-foreground/60 hover:text-muted-foreground'
              )}
            >
              {line.text || '♪'}
            </button>
          ))}
          <p className="mt-6 text-[10px] text-muted-foreground">Synced lyrics · {data.source}</p>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-[calc(100%-49px)]">
      <div className="whitespace-pre-wrap px-6 py-6 text-[15px] leading-relaxed text-muted-foreground">
        {data.plain}
        <p className="mt-6 text-[10px]">Lyrics · {data.source}</p>
      </div>
    </ScrollArea>
  )
}
