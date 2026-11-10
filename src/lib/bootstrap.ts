// Bootstrap the catalog on server start + keep it fresh automatically.
// - fresh DB (< 400 tracks): run the full global sweep (every language & genre)
// - otherwise: refresh sync (trending/new + Spotify charts) when stale (> 6h)
// - periodic refresh every 6h → "auto add all the new songs" (Audius, iTunes, Spotify)
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
      const { syncCatalog, spotifySync } = await import('@/lib/catalog')
      const { SPOTIFY_AUTO_PLAYLISTS } = await import('@/lib/spotify')
      console.log('[walkman] refreshing catalog (auto-add new songs)')
      const r = await syncCatalog({ trendingLimit: 60, perGenreLimit: 20 })
      console.log(`[walkman] refresh done: +${r.added} added, ${r.updated} updated`)
      // Spotify auto-add — pull the freshest charts & editorial playlists
      void spotifySync(undefined, SPOTIFY_AUTO_PLAYLISTS)
        .then((sp) => console.log(`[walkman] spotify auto-add: +${sp.added} songs`))
        .catch((e) => console.error('[walkman] spotify auto-add failed:', e))
      // Full-song conversion — keep turning previews into full-length streams
      void (await import('@/lib/catalog')).fullSongsSweep()
        .then((fs) => console.log(`[walkman] full-song sweep: ${fs.converted}/${fs.scanned} converted`))
        .catch((e) => console.error('[walkman] full-song sweep failed:', e))
      // Discography completion — every thin artist (≤3 songs) gets ALL albums & songs
      void (await import('@/lib/catalog')).deepArtistsSync()
        .then((d) => console.log(`[walkman] discography sweep: +${d.added} songs across ${d.scanned} artists`))
        .catch((e) => console.error('[walkman] discography sweep failed:', e))
    }
  } catch (e) {
    console.error('[walkman] ensureCatalog failed:', e)
  }

  // periodic auto-sync every 6 hours
  if (!g.__walkmanFreshTimer) {
    g.__walkmanFreshTimer = setInterval(() => {
      void (async () => {
        try {
          const { syncCatalog, spotifySync } = await import('@/lib/catalog')
          const { SPOTIFY_AUTO_PLAYLISTS } = await import('@/lib/spotify')
          const r = await syncCatalog({ trendingLimit: 60, perGenreLimit: 20 })
          console.log(`[walkman] periodic sync: +${r.added} added, ${r.updated} updated`)
          // Spotify auto-add every cycle — charts refresh daily
          await spotifySync(undefined, SPOTIFY_AUTO_PLAYLISTS)
            .then((sp) => console.log(`[walkman] periodic spotify sync: +${sp.added} songs`))
            .catch((e) => console.error('[walkman] periodic spotify sync failed:', e))
          // resume the full-song conversion sweep every cycle
          await (await import('@/lib/catalog')).fullSongsSweep()
            .then((fs) => console.log(`[walkman] periodic full-song sweep: ${fs.converted}/${fs.scanned} converted`))
            .catch((e) => console.error('[walkman] periodic full-song sweep failed:', e))
          // resume discography completion every cycle — thinnest artists first
          void (await import('@/lib/catalog')).deepArtistsSync()
            .then((d) => console.log(`[walkman] periodic discography sweep: +${d.added} songs`))
            .catch((e) => console.error('[walkman] periodic discography sweep failed:', e))
          // refresh the Desi Hip-Hop scene daily (24h resume logic inside)
          void (await import('@/lib/catalog')).indianRapSync()
            .then((d) => console.log(`[walkman] indian rap sync: +${d.added} songs`))
            .catch((e) => console.error('[walkman] indian rap sync failed:', e))
        } catch (e) {
          console.error('[walkman] periodic sync failed:', e)
        }
      })()
    }, SIX_HOURS)
    g.__walkmanFreshTimer.unref?.()
  }
}
