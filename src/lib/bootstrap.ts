// Bootstrap the catalog on server start + keep it fresh automatically.
// - fresh DB (< 400 tracks): run the full global sweep (every language & genre)
// - otherwise: refresh sync (trending/new) when the last run is stale (> 6h)
// - periodic refresh every 6h → "auto add all the new songs"
import { db } from '@/lib/db'

const g = globalThis as unknown as {
  __walkmanBootstrapped?: boolean
  __walkmanFreshTimer?: ReturnType<typeof setInterval>
}

const SIX_HOURS = 6 * 60 * 60 * 1000

export async function ensureCatalog(): Promise<void> {
  if (g.__walkmanBootstrapped) return
  g.__walkmanBootstrapped = true

  try {
    const total = await db.track.count()
    const last = await db.syncLog.findFirst({ orderBy: { syncedAt: 'desc' } })
    const stale = !last || Date.now() - last.syncedAt.getTime() > SIX_HOURS

    if (total < 400) {
      const { globalSeed } = await import('@/lib/catalog')
      console.log(`[walkman] catalog empty (${total} tracks) — starting global sweep (every language & genre)`)
      const r = await globalSeed((done, t, added) => {
        if (done % 10 === 0) console.log(`[walkman] seed progress ${done}/${t} (+${added})`)
      })
      console.log(`[walkman] global sweep finished: +${r.added} tracks`)
    }

    if (stale) {
      const { syncCatalog } = await import('@/lib/catalog')
      console.log('[walkman] refreshing catalog (auto-add new songs)')
      const r = await syncCatalog({ trendingLimit: 60, perGenreLimit: 20 })
      console.log(`[walkman] refresh done: +${r.added} added, ${r.updated} updated`)
    }
  } catch (e) {
    console.error('[walkman] ensureCatalog failed:', e)
  }

  // periodic auto-sync every 6 hours
  if (!g.__walkmanFreshTimer) {
    g.__walkmanFreshTimer = setInterval(() => {
      void (async () => {
        try {
          const { syncCatalog } = await import('@/lib/catalog')
          const r = await syncCatalog({ trendingLimit: 60, perGenreLimit: 20 })
          console.log(`[walkman] periodic sync: +${r.added} added, ${r.updated} updated`)
        } catch (e) {
          console.error('[walkman] periodic sync failed:', e)
        }
      })()
    }, SIX_HOURS)
    g.__walkmanFreshTimer.unref?.()
  }
}
