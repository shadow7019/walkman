'use client'

// Registers the Walkman service worker (PWA install support + static caching).
// No-ops when unsupported or when running inside the Android WebView wrapper
// (which signals itself via the `walkman-app` user-agent marker).
import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (/WalkmanApp/i.test(navigator.userAgent)) return
    const t = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }, 1200)
    return () => clearTimeout(t)
  }, [])
  return null
}
