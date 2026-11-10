// Artist-diversified selection for discovery feeds ("New for you", "New
// releases", "Underground gems"). Sync pipelines insert whole batches from one
// artist at a time, so a plain "ORDER BY createdAt DESC" row makes the feed
// show five near-identical cards. This helper over-fetches a pool and greedily
// keeps at most `perArtist` tracks per artist — a real variety every time.
export function diversifyByArtist<T extends { artist: string }>(pool: T[], take: number, perArtist = 2): T[] {
  if (pool.length <= take) return pool
  const seen = new Map<string, number>()
  const out: T[] = []
  // key on the PRIMARY credited artist — "Fat Joe, DJ Khaled & A…" and
  // "DJ Khaled & Lil Blurry" would otherwise count as different acts
  const key = (a: string) =>
    a.toLowerCase().trim().split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bwith\b/i)[0].trim()
  for (const row of pool) {
    const k = key(row.artist)
    const n = seen.get(k) ?? 0
    if (n >= perArtist) continue
    seen.set(k, n + 1)
    out.push(row)
    if (out.length >= take) break
  }
  // pool had too few unique artists — top up with the remaining rows in order
  if (out.length < take) {
    const picked = new Set(out)
    for (const row of pool) {
      if (out.length >= take) break
      if (!picked.has(row)) out.push(row)
    }
  }
  return out
}
