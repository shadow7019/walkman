// Next.js instrumentation — runs once when the server boots.
// Kicks off the Walkman catalog bootstrap (global sweep on fresh DB,
// refresh when stale, then a periodic auto-sync every 6 hours).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  setTimeout(() => {
    void (async () => {
      try {
        const { ensureCatalog } = await import('@/lib/bootstrap')
        await ensureCatalog()
      } catch (e) {
        console.error('[walkman] instrumentation bootstrap failed:', e)
      }
    })()
  }, 2000)
}
