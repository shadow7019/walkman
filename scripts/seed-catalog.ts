// Initial catalog seed: pull real industry songs into the DB
import { syncCatalog } from '../src/lib/catalog'

async function main() {
  console.log('[seed] starting catalog sync...')
  const { added, updated } = await syncCatalog({ trendingLimit: 60, perGenreLimit: 25 })
  console.log(`[seed] done: added=${added} updated=${updated}`)
  process.exit(0)
}
main().catch((e) => {
  console.error('[seed] failed:', e)
  process.exit(1)
})
