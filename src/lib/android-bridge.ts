'use client'

// Bridge between the Walkman web app and the Android APK shell.
// The APK injects `window.WalkmanAndroid` (JavascriptInterface). When present,
// the web app reports playback state so the native foreground service can keep
// audio alive with the screen off and show a media notification.
// Also hosts the "background playback" preference (persisted).

declare global {
  interface Window {
    WalkmanAndroid?: {
      onPlaying: (title: string, artist: string, album: string, durationSec: number) => void
      onPaused: () => void
    }
  }
}

const BG_KEY = 'walkman:backgroundPlay'

export function isBackgroundPlayEnabled(): boolean {
  try {
    return localStorage.getItem(BG_KEY) !== '0' // default: on
  } catch {
    return true
  }
}

export function setBackgroundPlayEnabled(v: boolean) {
  try {
    localStorage.setItem(BG_KEY, v ? '1' : '0')
  } catch { /* ignore */ }
}

export function hasAndroidBridge(): boolean {
  return typeof window !== 'undefined' && !!window.WalkmanAndroid
}

/** Report "playing" to the APK foreground service (no-op elsewhere). */
export function androidPlaying(title: string, artist: string, album: string, durationSec: number) {
  if (!isBackgroundPlayEnabled()) return
  try {
    window.WalkmanAndroid?.onPlaying(title, artist, album, durationSec)
  } catch { /* ignore */ }
}

/** Report "paused/stopped" so the APK foreground service can step down. */
export function androidPaused() {
  try {
    window.WalkmanAndroid?.onPaused()
  } catch { /* ignore */ }
}
