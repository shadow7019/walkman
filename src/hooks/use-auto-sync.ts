'use client'

// Auto-add new songs: while Walkman is open, poll the industry catalog for
// brand-new releases every 30 minutes (plus one catch-up shortly after app
// start). The toggle is persisted in localStorage and takes effect live —
// the interval checks the flag on every tick. The server additionally runs
// its own 6-hour sweep cycle independent of any open client.

import { api } from '@/lib/client-api'

const KEY = 'walkman:autoSync'
const FIRST_RUN_DELAY_MS = 15_000
const INTERVAL_MS = 30 * 60 * 1000

export function isAutoSyncEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0' // default: on
  } catch {
    return true
  }
}

export function setAutoSyncEnabled(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch { /* ignore */ }
}

let started = false

/** Idempotently start the auto-sync loop (called once from the app shell). */
export function startAutoSync() {
  if (started || typeof window === 'undefined') return
  started = true

  const run = () => {
    if (!isAutoSyncEnabled()) return
    api.runSync().catch(() => { /* offline / transient — next tick retries */ })
  }

  setTimeout(run, FIRST_RUN_DELAY_MS)
  setInterval(run, INTERVAL_MS)
}
