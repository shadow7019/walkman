// Walkman Rooms — listen-together service (socket.io)
// Up to 10 people per room, shared queue of up to 100 songs, drift-corrected sync.
import { Server } from 'socket.io'

interface RoomTrack {
  trackId: string
  title: string
  artist: string
  cover: string
  durationMs: number
}

interface Room {
  code: string
  name: string
  hostId: string
  members: Set<string>
  playing: boolean
  positionSec: number
  updatedAt: number
  hostControls: boolean
  queue: RoomTrack[]
}

const rooms = new Map<string, Room>()

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function makeCode(): string {
  for (let i = 0; i < 50; i++) {
    let code = ''
    for (let j = 0; j < 6; j++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    if (!rooms.has(code)) return code
  }
  return `W${Date.now().toString(36).toUpperCase().slice(-5)}`
}

function publicRoom(room: Room) {
  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    playing: room.playing,
    positionSec: room.positionSec,
    updatedAt: room.updatedAt,
    hostControls: room.hostControls,
    queue: room.queue,
    members: room.members.size,
  }
}

const io = new Server({
  cors: { origin: '*' },
})

io.on('connection', (socket) => {
  let joinedCode: string | null = null

  const broadcast = (code: string) => {
    const room = rooms.get(code)
    if (!room) return
    io.to(code).emit('room:state', publicRoom(room))
  }

  socket.on('room:create', (msg: { name?: string }, ack?: (r: unknown) => void) => {
    // leave any existing room
    if (joinedCode) leaveRoom(joinedCode, socket)
    const code = makeCode()
    const room: Room = {
      code,
      name: (msg?.name ?? 'Listening Room').toString().slice(0, 40),
      hostId: socket.id ?? '',
      members: new Set([socket.id ?? '']),
      playing: false,
      positionSec: 0,
      updatedAt: Date.now(),
      hostControls: false,
      queue: [],
    }
    rooms.set(code, room)
    socket.join(code)
    joinedCode = code
    ack?.({ ok: true, code, room: publicRoom(room) })
  })

  socket.on('room:join', (msg: { code?: string }, ack?: (r: unknown) => void) => {
    const code = (msg?.code ?? '').toString().trim().toUpperCase()
    const room = rooms.get(code)
    if (!room) {
      ack?.({ ok: false, error: 'Room not found — check the code' })
      return
    }
    if (room.members.size >= 10 && !room.members.has(socket.id ?? '')) {
      ack?.({ ok: false, error: 'Room is full (10 people max)' })
      return
    }
    if (joinedCode) leaveRoom(joinedCode, socket)
    room.members.add(socket.id ?? '')
    socket.join(code)
    joinedCode = code
    ack?.({ ok: true, room: publicRoom(room) })
    broadcast(code)
  })

  // authoritative host sync
  socket.on('room:sync', (msg: { positionSec?: number; playing?: boolean }) => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room || room.hostId !== socket.id) return
    room.positionSec = typeof msg.positionSec === 'number' ? msg.positionSec : room.positionSec
    room.playing = !!msg.playing
    room.updatedAt = Date.now()
    broadcast(joinedCode)
  })

  socket.on('room:play', (msg: { positionSec?: number }) => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room) return
    if (room.hostControls && room.hostId !== socket.id) return
    if (typeof msg?.positionSec === 'number') room.positionSec = msg.positionSec
    room.playing = true
    room.updatedAt = Date.now()
    broadcast(joinedCode)
  })

  socket.on('room:pause', () => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room) return
    if (room.hostControls && room.hostId !== socket.id) return
    const elapsed = room.playing ? (Date.now() - room.updatedAt) / 1000 : 0
    room.positionSec += elapsed
    room.playing = false
    room.updatedAt = Date.now()
    broadcast(joinedCode)
  })

  socket.on('room:seek', (msg: { positionSec?: number }) => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room) return
    if (room.hostControls && room.hostId !== socket.id) return
    room.positionSec = Math.max(0, typeof msg?.positionSec === 'number' ? msg.positionSec : 0)
    room.updatedAt = Date.now()
    broadcast(joinedCode)
  })

  socket.on('room:skip', () => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room) return
    if (room.hostControls && room.hostId !== socket.id) return
    room.queue.shift()
    room.positionSec = 0
    room.playing = room.queue.length > 0
    room.updatedAt = Date.now()
    broadcast(joinedCode)
  })

  socket.on('room:queue:add', (msg: { track?: RoomTrack }) => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    const t = msg?.track
    if (!room || !t || !t.trackId) return
    if (room.queue.length >= 100) {
      socket.emit('room:error', { message: 'Queue is full (100 songs max)' })
      return
    }
    room.queue.push({
      trackId: String(t.trackId).slice(0, 64),
      title: String(t.title ?? 'Unknown').slice(0, 120),
      artist: String(t.artist ?? '').slice(0, 120),
      cover: String(t.cover ?? '').slice(0, 500),
      durationMs: Number(t.durationMs) || 0,
    })
    room.updatedAt = Date.now()
    broadcast(joinedCode)
  })

  socket.on('room:queue:remove', (msg: { index?: number }) => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room) return
    const idx = Number(msg?.index)
    if (Number.isInteger(idx) && idx >= 1 && idx < room.queue.length) {
      room.queue.splice(idx, 1)
      room.updatedAt = Date.now()
      broadcast(joinedCode)
    }
  })

  socket.on('room:queue:clear', () => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room || room.hostId !== socket.id) return
    room.queue = []
    room.playing = false
    room.positionSec = 0
    room.updatedAt = Date.now()
    broadcast(joinedCode)
  })

  socket.on('room:hostControls', (msg: { enabled?: boolean }) => {
    if (!joinedCode) return
    const room = rooms.get(joinedCode)
    if (!room || room.hostId !== socket.id) return
    room.hostControls = !!msg?.enabled
    broadcast(joinedCode)
  })

  function leaveRoom(code: string, s: typeof socket) {
    const room = rooms.get(code)
    if (!room) return
    room.members.delete(s.id ?? '')
    s.leave(code)
    if (room.members.size === 0) {
      rooms.delete(code)
    } else {
      // reassign host if host left
      if (room.hostId === s.id) {
        room.hostId = [...room.members][0] ?? ''
        room.playing = false
      }
      io.to(code).emit('room:state', publicRoom(room))
    }
    if (joinedCode === code) joinedCode = null
  }

  socket.on('disconnect', () => {
    if (joinedCode) leaveRoom(joinedCode, socket)
  })
})

const PORT = 3003
io.listen(PORT)
console.log(`[room-service] listening on :${PORT}`)
