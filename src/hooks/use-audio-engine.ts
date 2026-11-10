'use client'

// Walkman audio engine: two <audio> elements for equal-power crossfade,
// Web Audio graph (10-band EQ + analyser), playback history (Replay),
// MediaSession integration, sleep timer, opt-in skip silence.
import { useEffect, useRef } from 'react'
import { usePlayer, onEngineEvent } from '@/stores/player'
import { api } from '@/lib/client-api'
import { applyEq, ensureAudioGraph, getRmsLevel, resumeAudioGraph } from '@/lib/audio-graph'
import { androidPlaying, androidPaused } from '@/lib/android-bridge'
import type { Track } from '@/types'

export function useAudioEngine() {
  const aRef = useRef<HTMLAudioElement | null>(null)
  const bRef = useRef<HTMLAudioElement | null>(null)
  const activeRef = useRef<'a' | 'b'>('a')
  const startedAtRef = useRef<{ id: string; at: number; reported: boolean }>({ id: '', at: 0, reported: false })
  const fadingRef = useRef(false)

  useEffect(() => {
    const a = new Audio()
    const b = new Audio()
    a.preload = 'auto'; b.preload = 'auto'
    a.crossOrigin = 'anonymous'; b.crossOrigin = 'anonymous'
    aRef.current = a; bRef.current = b
    a.volume = 0.9; b.volume = 0

    const active = () => (activeRef.current === 'a' ? a : b)
    const inactive = () => (activeRef.current === 'a' ? b : a)

    const reportHistory = (completed: boolean) => {
      const st = startedAtRef.current
      if (!st.id || st.reported) return
      st.reported = true
      const msPlayed = Date.now() - st.at
      const cur = usePlayer.getState()
      const track = cur.queue[cur.queueIndex]
      const fullMs = track?.durationMs ?? 0
      const isCompleted = completed || (fullMs > 0 && msPlayed > fullMs * 0.8)
      api.recordPlay(st.id, Math.min(msPlayed, fullMs || msPlayed), isCompleted)
    }

    const beginTrack = (track: Track, autoplay: boolean, startAt?: number) => {
      const old = inactive()
      const cur = active()
      try { old.pause() } catch {}
      old.removeAttribute('src')
      cur.setAttribute('data-track-id', track.id)
      const q = usePlayer.getState().quality
      cur.src = `/api/stream/${track.id}?q=${q}`
      cur.playbackRate = usePlayer.getState().speed
      const vol = usePlayer.getState().muted ? 0 : usePlayer.getState().volume
      cur.volume = vol
      // route through the Web Audio graph (EQ + analyser) inside this gesture
      const g = ensureAudioGraph(a, b)
      if (g) {
        const s = usePlayer.getState()
        applyEq(s.eqGains, s.eqEnabled)
      }
      if (startAt && startAt > 0) {
        cur.currentTime = startAt // works once metadata loads; browsers clamp
        const seekOnMeta = () => {
          try { cur.currentTime = startAt } catch {}
          cur.removeEventListener('loadedmetadata', seekOnMeta)
        }
        cur.addEventListener('loadedmetadata', seekOnMeta)
      }
      if (autoplay) cur.play().catch(() => {})
      startedAtRef.current = { id: track.id, at: Date.now(), reported: false }

      // Android APK: keep audio alive with the screen off via the native
      // foreground service (no-op in regular browsers)
      androidPlaying(track.title, track.artist, track.album || 'Walkman', (track.durationMs || 0) / 1000)

      // MediaSession (media keys + OS overlay + lock-screen controls)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album || 'Walkman',
          artwork: track.cover ? [{ src: track.cover, sizes: '512x512', type: 'image/jpeg' }] : [],
        })
        const st = usePlayer.getState()
        navigator.mediaSession.setActionHandler('play', () => st.playPause())
        navigator.mediaSession.setActionHandler('pause', () => st.playPause())
        navigator.mediaSession.setActionHandler('previoustrack', () => st.prev())
        navigator.mediaSession.setActionHandler('nexttrack', () => st.next())
        navigator.mediaSession.setActionHandler('seekbackward', (d) => st.seek(Math.max(0, usePlayer.getState().position - (d?.seekOffset ?? 10))))
        navigator.mediaSession.setActionHandler('seekforward', (d) => st.seek(Math.min(usePlayer.getState().duration, usePlayer.getState().position + (d?.seekOffset ?? 10))))
        navigator.mediaSession.setActionHandler('seekto', (d) => { if (d.seekTime != null) st.seek(d.seekTime) })
      }
    }

    const crossfadeTo = (track: Track) => {
      const s = usePlayer.getState()
      const fadeSec = Math.min(s.crossfadeSec, 12)
      const out = active()
      activeRef.current = activeRef.current === 'a' ? 'b' : 'a'
      const inc = active()
      fadingRef.current = true
      beginTrack(track, true)
      if (fadeSec <= 0) {
        try { out.pause() } catch {}
        out.volume = 0
        fadingRef.current = false
        return
      }
      const start = performance.now()
      const outStartVol = out.volume
      const step = (now: number) => {
        const t = Math.min((now - start) / (fadeSec * 1000), 1)
        const vol = usePlayer.getState().muted ? 0 : usePlayer.getState().volume
        inc.volume = vol * t
        out.volume = outStartVol * (1 - t)
        if (t < 1) requestAnimationFrame(step)
        else {
          try { out.pause() } catch {}
          out.volume = 0
          fadingRef.current = false
        }
      }
      requestAnimationFrame(step)
    }

    // store event subscription
    const off = onEngineEvent((e) => {
      const s = usePlayer.getState()
      if (e.type === 'load') {
        const cf = s.crossfadeSec > 0 && s.isPlaying
        if (cf) crossfadeTo(e.track)
        else beginTrack(e.track, e.autoplay)
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
      } else if (e.type === 'pause') {
        active().pause()
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
        androidPaused()
      } else if (e.type === 'resume') {
        resumeAudioGraph()
        if (!active().src) {
          const cur = s.queue[s.queueIndex]
          if (cur) beginTrack(cur, true, s.position)
        } else active().play().catch(() => {})
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
        const cur = s.queue[s.queueIndex]
        if (cur) androidPlaying(cur.title, cur.artist, cur.album || 'Walkman', (cur.durationMs || 0) / 1000)
      } else if (e.type === 'seek') {
        if (active().src && isFinite(active().duration)) {
          active().currentTime = Math.min(e.sec, active().duration || e.sec)
        }
      } else if (e.type === 'volume') {
        if (!fadingRef.current) active().volume = e.v
      } else if (e.type === 'speed') {
        a.playbackRate = e.s; b.playbackRate = e.s
      }
    })

    // element events
    const onTime = () => {
      const el = active()
      if (el && el.src && !el.paused) {
        usePlayer.getState().internal.setPosition(el.currentTime, el.duration || 0)
        // lock-screen scrubber (Android WebView / Chrome media controls)
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
          try {
            navigator.mediaSession.setPositionState({
              duration: isFinite(el.duration) ? el.duration : 0,
              playbackRate: el.playbackRate || 1,
              position: Math.min(el.currentTime, isFinite(el.duration) ? el.duration : el.currentTime),
            })
          } catch { /* transient state mismatch — next tick retries */ }
        }
        // report history after 30s
        const st = startedAtRef.current
        if (!st.reported && Date.now() - st.at > 30000) reportHistory(false)
      }
    }
    const onEnded = () => {
      reportHistory(true)
      usePlayer.getState().next()
    }
    const onError = () => {
      const el = active()
      if (el?.src) {
        // skip broken track
        setTimeout(() => usePlayer.getState().next(), 500)
      }
    }

    a.addEventListener('timeupdate', onTime)
    b.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnded)
    b.addEventListener('ended', onEnded)
    a.addEventListener('error', onError)
    b.addEventListener('error', onError)

    // restore persisted settings + session (Spotufi-style session restore)
    try {
      const saved = JSON.parse(localStorage.getItem('walkman:player') ?? '{}')
      const s = usePlayer.getState()
      if (typeof saved.volume === 'number') { s.setVolume(saved.volume); a.volume = saved.volume; b.volume = 0 }
      if (typeof saved.speed === 'number') s.setSpeed(saved.speed)
      if (typeof saved.crossfadeSec === 'number') s.setCrossfade(saved.crossfadeSec)
      if (typeof saved.autoplay === 'boolean') s.setAutoplay(saved.autoplay)
      if (typeof saved.quality === 'string' && ['auto', 'full', 'saver'].includes(saved.quality)) s.setQuality(saved.quality)
      if (typeof saved.eqEnabled === 'boolean') s.setEqEnabled(saved.eqEnabled)
      if (typeof saved.eqPreset === 'string') s.setEqPreset(saved.eqPreset)
      if (Array.isArray(saved.eqGains) && saved.eqGains.length === 10) usePlayer.setState({ eqGains: saved.eqGains.map(Number) })
      if (typeof saved.skipSilence === 'boolean') s.setSkipSilence(saved.skipSilence)
      if (typeof saved.shuffle === 'boolean') usePlayer.setState({ shuffle: saved.shuffle })
      if (['off', 'all', 'one'].includes(saved.repeat)) usePlayer.setState({ repeat: saved.repeat })
      // queue restore (paused at saved position)
      s.resumeSession()
    } catch { /* ignore */ }

    // sleep timer check with gentle fade-out over final 20s
    const sleepTick = setInterval(() => {
      const s = usePlayer.getState()
      if (!s.sleepAt) return
      const remain = s.sleepAt - Date.now()
      if (remain <= 0) {
        usePlayer.setState({ sleepAt: null })
        if (s.isPlaying) s.playPause()
        s.setVolume(s.volume) // restore volume level
      } else if (remain < 20000 && s.isPlaying) {
        const fade = remain / 20000
        const base = s.muted ? 0 : s.volume
        const cur = activeRef.current === 'a' ? a : b
        cur.volume = Math.max(0.001, base * fade)
      }
    }, 1000)

    // EQ store watcher — apply gains whenever EQ state changes
    let lastEqKey = ''
    const eqTick = setInterval(() => {
      const s = usePlayer.getState()
      const key = `${s.eqEnabled}|${s.eqGains.join(',')}`
      if (key !== lastEqKey) {
        lastEqKey = key
        applyEq(s.eqGains, s.eqEnabled)
      }
    }, 500)

    // skip silence (ByTune-style, opt-in): when the live signal stays below
    // ~-46 dBFS for over 2.5s, jump the playhead over the silent stretch.
    let silentMs = 0
    const silenceTick = setInterval(() => {
      const s = usePlayer.getState()
      if (!s.skipSilence || !s.isPlaying) { silentMs = 0; return }
      const el = activeRef.current === 'a' ? a : b
      if (!el || !el.src || el.paused || el.ended) { silentMs = 0; return }
      const rms = getRmsLevel()
      if (rms < 0 || rms > 0.005) { silentMs = 0; return }
      silentMs += 250
      if (silentMs >= 2500 && isFinite(el.duration)) {
        const jumpSec = Math.min(silentMs / 1000, Math.max(el.duration - el.currentTime - 1, 0))
        if (jumpSec > 0.5) {
          el.currentTime = el.currentTime + jumpSec
          usePlayer.getState().internal.setPosition(el.currentTime, el.duration)
        }
        silentMs = 0
      }
    }, 250)

    return () => {
      off()
      clearInterval(sleepTick)
      clearInterval(eqTick)
      clearInterval(silenceTick)
      a.pause(); b.pause()
      androidPaused()
      a.removeEventListener('timeupdate', onTime)
      b.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnded)
      b.removeEventListener('ended', onEnded)
      a.removeEventListener('error', onError)
      b.removeEventListener('error', onError)
    }
  }, [])

  return { aRef, bRef }
}
