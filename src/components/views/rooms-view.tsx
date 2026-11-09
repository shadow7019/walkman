'use client'

// Rooms — listen together with friends, synced in real time (ByTune feature).
// Socket.io mini-service on XTransformPort=3003; relative URL only.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Users, Plus, LogIn, Copy, LogOut, Play, Pause, SkipForward, Trash2, Wifi, WifiOff } from 'lucide-react'
import { usePlayer, onEngineEvent } from '@/stores/player'
import { useUI } from '@/stores/ui'
import { Cover } from '@/components/cover'
import { TrackList } from '@/components/track-list'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { fmtTime } from '@/types'
import { cn } from '@/lib/utils'

interface RoomTrack {
  trackId: string
  title: string
  artist: string
  cover: string
  durationMs: number
}

interface RoomState {
  code: string
  hostId: string
  playing: boolean
  positionSec: number
  updatedAt: number
  hostControls: boolean
  queue: RoomTrack[]
  members: number
  name?: string
}

type Phase = 'idle' | 'connecting' | 'in-room'

export function RoomsView() {
  const { toast } = useUI()
  const player = usePlayer()
  const [phase, setPhase] = useState<Phase>('idle')
  const [connError, setConnError] = useState('')
  const [room, setRoom] = useState<RoomState | null>(null)
  const [myId, setMyId] = useState('')
  const [roomName, setRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [position, setPosition] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isHost = !!room && myId === room.hostId
  const canControl = !room?.hostControls || isHost

  const connect = useCallback((): Promise<Socket> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.connected) { resolve(socketRef.current); return }
      const socket = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 8000,
      })
      socketRef.current = socket
      socket.on('connect', () => { setMyId(socket.id ?? ''); resolve(socket) })
      socket.on('connect_error', (e: Error) => {
        setConnError(`Could not reach the Rooms service (${e.message}). It may be restarting — try again.`)
        setPhase('idle')
        reject(e)
      })
      socket.on('room:state', (s: RoomState) => {
        setRoom(s)
      })
      socket.on('room:closed', () => {
        toast('The room was closed by the host')
        leaveCleanup()
      })
      socket.on('room:error', (e: { message: string }) => {
        toast(e.message)
      })
    })
  }, [toast])

  const leaveCleanup = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setRoom(null)
    setPhase('idle')
    player.internal.setPlaying(false)
  }, [player])

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  // suppress the main engine while in a room (room audio is local here)
  useEffect(() => {
    if (phase !== 'in-room') return
    const off = onEngineEvent((e) => {
      if (e.type === 'load' || e.type === 'resume') {
        try { window.dispatchEvent(new CustomEvent('walkman:room-override')) } catch {}
      }
    })
    return off
  }, [phase])

  const createRoom = async () => {
    setPhase('connecting')
    setConnError('')
    try {
      const socket = await connect()
      socket.emit('room:create', { name: roomName || 'Listening Room' }, (ack: { ok: boolean; code?: string; room?: RoomState; error?: string }) => {
        if (ack.ok && ack.room) {
          setRoom(ack.room)
          setPhase('in-room')
          toast(`Room created — code ${ack.room.code}`)
        } else {
          setConnError(ack.error ?? 'Could not create room')
          setPhase('idle')
        }
      })
    } catch { /* connect_error handled */ }
  }

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) { setConnError('Enter the 6-character room code'); return }
    setPhase('connecting')
    setConnError('')
    try {
      const socket = await connect()
      socket.emit('room:join', { code }, (ack: { ok: boolean; room?: RoomState; error?: string }) => {
        if (ack.ok && ack.room) {
          setRoom(ack.room)
          setPhase('in-room')
          toast(`Joined room ${ack.room.code}`)
        } else {
          setConnError(ack.error ?? 'Room not found')
          setPhase('idle')
        }
      })
    } catch { /* connect_error handled */ }
  }

  const leave = () => {
    socketRef.current?.disconnect()
    socketRef.current = null
    leaveCleanup()
  }

  const copyCode = () => {
    if (!room) return
    navigator.clipboard?.writeText(room.code).then(
      () => toast('Room code copied'),
      () => toast(`Room code: ${room.code}`)
    )
  }

  // ---- local room audio element synced to server state ----
  const currentTrack = room?.queue[0] ?? null

  // server-side authoritative clock
  const serverPosition = useMemo(() => {
    if (!room) return 0
    return room.playing ? room.positionSec + (Date.now() - room.updatedAt) / 1000 : room.positionSec
  }, [room])

  useEffect(() => {
    if (phase !== 'in-room' || !room) return
    if (!syncEnabled) return
    // create audio element lazily
    if (!audioRef.current) {
      const el = new Audio()
      el.volume = 0.9
      audioRef.current = el
    }
    const el = audioRef.current
    const src = currentTrack ? `/api/stream/${currentTrack.trackId}` : ''
    if (src && !el.src.endsWith(src)) {
      el.src = src
      el.currentTime = serverPosition
      if (room.playing) el.play().catch(() => {})
    }
    if (room.playing && el.paused) el.play().catch(() => {})
    if (!room.playing && !el.paused) el.pause()
    // drift correction
    const drift = Math.abs(el.currentTime - serverPosition)
    if (drift > 1.5 && isFinite(el.duration)) {
      el.currentTime = Math.min(serverPosition, el.duration || serverPosition)
    }
    const tick = setInterval(() => {
      setPosition(audioRef.current?.currentTime ?? 0)
    }, 500)
    return () => clearInterval(tick)
  }, [room, phase, currentTrack, serverPosition, syncEnabled])

  // report position to server when playing as host
  useEffect(() => {
    if (!isHost || !audioRef.current || !room) return
    const iv = setInterval(() => {
      const el = audioRef.current
      if (el && !el.paused) {
        socketRef.current?.emit('room:sync', { positionSec: el.currentTime, playing: true })
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [isHost, room])

  const ctlPlay = () => {
    if (!canControl || !room) return
    socketRef.current?.emit('room:play', { positionSec: audioRef.current?.currentTime ?? serverPosition })
  }
  const ctlPause = () => {
    if (!canControl || !room) return
    socketRef.current?.emit('room:pause')
  }
  const ctlNext = () => {
    if (!canControl || !room) return
    socketRef.current?.emit('room:skip')
  }
  const ctlSeek = (sec: number) => {
    if (!canControl || !room) return
    if (audioRef.current) audioRef.current.currentTime = sec
    socketRef.current?.emit('room:seek', { positionSec: sec })
  }
  const addCurrentToRoom = () => {
    const cur = player.queue[player.queueIndex]
    if (!cur || !room) { toast('Play something first, then add it to the room queue'); return }
    socketRef.current?.emit('room:queue:add', {
      track: { trackId: cur.id, title: cur.title, artist: cur.artist, cover: cur.cover, durationMs: cur.durationMs },
    })
    toast(`Added "${cur.title}" to the room queue`)
  }

  // ---------------- render ----------------
  if (phase !== 'in-room' || !room) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listen together with friends — everyone hears the same song at the same moment. Share the code, and anyone can play, skip or queue.
          </p>
        </div>

        {connError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {connError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-black/30 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <Plus className="h-5 w-5 text-emerald-400" aria-hidden />
            </div>
            <h2 className="font-semibold">Start a room</h2>
            <p className="mt-1 text-xs text-muted-foreground">Up to 10 people. You control the shared queue.</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="room-name">Room name</Label>
                <Input id="room-name" placeholder="Friday night vibes" value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={40} />
              </div>
              <Button onClick={createRoom} disabled={phase === 'connecting'} className="w-full gap-2 bg-emerald-500 text-black hover:bg-emerald-400">
                <Users className="h-4 w-4" aria-hidden /> {phase === 'connecting' ? 'Connecting…' : 'Create room'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-black/30 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <LogIn className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="font-semibold">Join a room</h2>
            <p className="mt-1 text-xs text-muted-foreground">Enter the 6-character code from a friend.</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="join-code">Room code</Label>
                <Input
                  id="join-code"
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="font-mono text-lg tracking-[0.3em]"
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                />
              </div>
              <Button onClick={joinRoom} disabled={phase === 'connecting'} variant="outline" className="w-full gap-2">
                <LogIn className="h-4 w-4" aria-hidden /> {phase === 'connecting' ? 'Joining…' : 'Join room'}
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: add the song you're playing on the main player to the room queue with one tap once you're in.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      {/* room header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Wifi className="h-3.5 w-3.5" aria-hidden /> Live room {isHost && '· you are the host'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{room.name ?? 'Listening Room'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyCode}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2"
            aria-label={`Copy room code ${room.code}`}
          >
            <span className="font-mono text-2xl font-bold tracking-[0.25em] text-emerald-300">{room.code}</span>
            <Copy className="h-4 w-4 text-emerald-400" aria-hidden />
          </button>
          <Button variant="outline" size="sm" className="gap-2" onClick={leave}>
            <LogOut className="h-4 w-4" aria-hidden /> Leave
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden /> {room.members} listening</span>
        <span className="flex items-center gap-2">
          <Switch checked={room.hostControls} onCheckedChange={(v) => canControl || isHost ? socketRef.current?.emit('room:hostControls', { enabled: v }) : undefined} disabled={!isHost} aria-label="Only host controls music" id="host-ctl" />
          <Label htmlFor="host-ctl" className="text-xs">Only the host controls the music</Label>
        </span>
        <span className="flex items-center gap-2">
          <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} aria-label="Sync playback" id="sync-ctl" />
          <Label htmlFor="sync-ctl" className="text-xs">Sync my playback</Label>
        </span>
      </div>

      {/* synced transport */}
      {currentTrack && (
        <div className="rounded-xl border border-border/50 bg-black/30 p-4">
          <div className="flex items-center gap-4">
            <Cover src={currentTrack.cover} alt="" className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{currentTrack.title}</p>
              <p className="truncate text-xs text-muted-foreground">{currentTrack.artist}</p>
            </div>
            {canControl && (
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" aria-label="Play" onClick={ctlPlay} className={cn(room.playing && 'hidden')}>
                  <Play className="h-5 w-5 fill-current" aria-hidden />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Pause" onClick={ctlPause} className={cn(!room.playing && 'hidden')}>
                  <Pause className="h-5 w-5 fill-current" aria-hidden />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Skip" onClick={ctlNext}>
                  <SkipForward className="h-5 w-5 fill-current" aria-hidden />
                </Button>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">{fmtTime(position * 1000)}</span>
            <Slider
              value={[Math.round(canControl ? (audioRef.current?.currentTime ?? position) : serverPosition)]}
              max={Math.max(Math.round(currentTrack.durationMs / 1000), 1)}
              step={1}
              onValueChange={(v) => ctlSeek(v[0] ?? 0)}
              disabled={!canControl}
              aria-label="Room seek"
            />
            <span className="w-10 text-[10px] tabular-nums text-muted-foreground">{fmtTime(currentTrack.durationMs)}</span>
          </div>
        </div>
      )}

      {/* shared queue */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shared queue ({room.queue.length})</h2>
          <Button size="sm" variant="outline" className="gap-2" onClick={addCurrentToRoom}>
            <Plus className="h-4 w-4" aria-hidden /> Add what I'm playing
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-xl border border-border/50 bg-black/30">
          <TrackList
            tracks={room.queue.map((q) => ({
              id: q.trackId, title: q.title, artist: q.artist, album: '', genre: '', rawGenre: '',
              mood: '', year: 0, durationMs: q.durationMs, cover: q.cover, source: 'room', sourceId: '',
              hasFull: true, qualityTier: 'HI-FI', bitrateKbps: 320, explicit: false,
              playCount: 0, favoriteCount: 0, permalink: '',
            }))}
            contextTitle={`Room ${room.code}`}
            showAlbum={false}
          />
        </div>
        {isHost && room.queue.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 gap-2 text-muted-foreground"
            onClick={() => socketRef.current?.emit('room:queue:clear')}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear queue
          </Button>
        )}
      </div>
    </div>
  )
}
