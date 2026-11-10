'use client'

// Reusable cards: track card, playlist card, mix card, genre tile.
import { Play, Pause, ListMusic } from 'lucide-react'
import { Cover } from '@/components/cover'
import { usePlayer } from '@/stores/player'
import { useUI } from '@/stores/ui'
import type { Track, PlaylistSummary, GenreInfo } from '@/types'
import { fmtNum } from '@/types'
import { cn } from '@/lib/utils'

export function TrackCard({ track, list, contextTitle }: { track: Track; list: Track[]; contextTitle: string }) {
  const { playQueue, queue, queueIndex, isPlaying, playPause } = usePlayer()
  const isCurrent = queue[queueIndex]?.id === track.id
  return (
    <button
      role="listitem"
      className="group w-40 shrink-0 rounded-lg p-3 text-left transition-colors hover:bg-white/5 sm:w-44"
      onClick={() => {
        if (isCurrent) { playPause(); return }
        playQueue(list, list.findIndex((t) => t.id === track.id), contextTitle)
      }}
      aria-label={`Play ${track.title} by ${track.artist}`}
    >
      <div className="relative mb-2">
        <Cover src={track.cover} alt={`${track.title} cover`} className="aspect-square w-full shadow-lg" />
        <span className={cn(
          'absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#1db954] text-black shadow-xl transition-all',
          isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0'
        )}>
          {isCurrent && isPlaying ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current translate-x-[1px]" aria-hidden />}
        </span>
      </div>
      <div className="truncate text-sm font-medium">{track.title}</div>
      <div className="truncate text-xs text-muted-foreground">
        {track.artist}{track.hasFull ? ' · HI-FI' : ''}
      </div>
    </button>
  )
}

export function MixCard({ title, subtitle, tracks }: { title: string; subtitle: string; tracks: Track[] }) {
  const { playQueue } = usePlayer()
  const covers = tracks.slice(0, 4)
  return (
    <button
      role="listitem"
      className="group w-40 shrink-0 rounded-lg p-3 text-left transition-colors hover:bg-white/5 sm:w-44"
      onClick={() => tracks.length && playQueue(tracks, 0, title)}
      aria-label={`Play ${title}`}
      disabled={!tracks.length}
    >
      <div className="relative mb-2 grid aspect-square w-full grid-cols-2 gap-px overflow-hidden rounded-md bg-white/5 shadow-lg">
        {covers.map((t, i) => (
          <Cover
            key={t.id}
            src={t.cover}
            alt=""
            // a lone cover must fill the whole tile, not half of the 2x2 grid
            className={cn('h-full w-full', covers.length < 4 && i === 0 && covers.length !== 2 && 'col-span-2 row-span-2', covers.length === 2 && i === 0 && 'col-span-2 row-span-1')}
            rounded="rounded-none"
          />
        ))}
        {covers.length === 0 && <div className="col-span-2 flex items-center justify-center text-muted-foreground"><ListMusic className="h-8 w-8" aria-hidden /></div>}
        <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#1db954] text-black opacity-0 shadow-xl transition-all group-hover:opacity-100">
          <Play className="h-4 w-4 fill-current" aria-hidden />
        </span>
      </div>
      <div className="truncate text-sm font-medium">{title}</div>
      <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
    </button>
  )
}

export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  const { navigate } = useUI()
  return (
    <button
      role="listitem"
      className="group w-40 shrink-0 rounded-lg p-3 text-left transition-colors hover:bg-white/5 sm:w-44"
      onClick={() => navigate({ name: 'playlist', id: playlist.id })}
      aria-label={`Open playlist ${playlist.name}`}
    >
      <div className="relative mb-2">
        {playlist.covers.length > 0 ? (
          <Cover src={playlist.covers[0]} alt={`${playlist.name} cover`} className="aspect-square w-full shadow-lg" />
        ) : (
          <div className={cn('flex aspect-square w-full items-center justify-center rounded-md bg-gradient-to-br shadow-lg', playlist.gradient)}>
            <ListMusic className="h-8 w-8 text-white/80" aria-hidden />
          </div>
        )}
      </div>
      <div className="truncate text-sm font-medium">{playlist.name}</div>
      <div className="truncate text-xs text-muted-foreground">
        {playlist.importedFrom ? `${playlist.importedFrom} · ` : ''}{playlist.trackCount} songs
      </div>
    </button>
  )
}

export function GenreTile({ genre, size = 'lg' }: { genre: GenreInfo; size?: 'lg' | 'sm' }) {
  const { navigate } = useUI()
  return (
    <button
      role="listitem"
      onClick={() => navigate({ name: 'genre', genre: genre.name })}
      className={cn(
        'relative overflow-hidden rounded-xl bg-gradient-to-br text-left shadow-lg transition-transform hover:scale-[1.02]',
        genre.color,
        size === 'lg' ? 'h-24 w-full p-4 sm:h-28' : 'h-20 w-full p-3'
      )}
      aria-label={`Browse ${genre.name}`}
    >
      <span className="text-base font-bold text-white drop-shadow-md sm:text-lg">{genre.name}</span>
      <span className="absolute bottom-3 left-4 text-xs text-white/80">{genre.count} songs</span>
      <span className="absolute -bottom-4 -right-3 h-20 w-20 rotate-25 rounded-lg bg-black/20 shadow-2xl" aria-hidden />
    </button>
  )
}

// deterministic gradient per language
const LANGUAGE_GRADIENTS = [
  'from-emerald-500 to-teal-800', 'from-rose-500 to-red-800', 'from-amber-400 to-orange-700',
  'from-fuchsia-500 to-purple-800', 'from-lime-500 to-green-800', 'from-cyan-500 to-teal-800',
  'from-orange-400 to-pink-600', 'from-violet-500 to-indigo-800', 'from-teal-400 to-cyan-800',
  'from-yellow-500 to-orange-700', 'from-purple-500 to-purple-900', 'from-green-500 to-emerald-800',
]
export function languageGradient(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return LANGUAGE_GRADIENTS[h % LANGUAGE_GRADIENTS.length]
}

export function LanguageTile({ language, size = 'lg' }: { language: { name: string; count: number; cover?: string }; size?: 'lg' | 'sm' }) {
  const { navigate } = useUI()
  return (
    <button
      role="listitem"
      onClick={() => navigate({ name: 'language', language: language.name })}
      className={cn(
        'relative flex items-center overflow-hidden rounded-xl bg-gradient-to-br text-left shadow-lg transition-transform hover:scale-[1.02]',
        languageGradient(language.name),
        size === 'lg' ? 'h-24 w-full p-4 sm:h-28' : 'h-16 w-40 shrink-0 p-3'
      )}
      aria-label={`Browse ${language.name} music`}
    >
      {language.cover && (
        <img src={language.cover} alt="" className="absolute -right-4 -top-4 h-20 w-20 rotate-12 rounded-md shadow-2xl" loading="lazy" />
      )}
      <div className="relative">
        <span className="flex items-center gap-1.5 text-base font-bold text-white drop-shadow-md sm:text-lg">
          {language.name}
        </span>
        <span className="mt-0.5 block text-xs text-white/85">{language.count} songs</span>
      </div>
    </button>
  )
}

export function ArtistChip({ name, onPlay }: { name: string; onPlay?: () => void }) {
  const { navigate } = useUI()
  return (
    <button
      role="listitem"
      className="w-32 shrink-0 rounded-lg p-3 text-center transition-colors hover:bg-white/5"
      onClick={() => navigate({ name: 'artist', artistName: name })}
      aria-label={`Open artist ${name}`}
    >
      <Cover src={null} alt="" className="mx-auto mb-2 h-24 w-24" rounded="rounded-full" />
      <div className="truncate text-sm font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">Artist</div>
      {onPlay && <span className="sr-only">Play</span>}
    </button>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-black/30 p-4">
      <div className={cn('text-2xl font-bold tabular-nums', accent && 'text-[#1ed760]')}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function CountBadge({ n }: { n: number }) {
  return <span className="text-xs text-muted-foreground">{fmtNum(n)} plays</span>
}
