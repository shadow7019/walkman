// Fuzzy matching utilities used by search and the playlist importer.
// Pure functions so they can run on the server (API routes) or be unit-tested.

const FEAT_RE = /\s*[\(\[\{]?\s*(?:feat\.?|featuring|ft\.?|with)\s+[\w\s&.,'-]*[\)\]\}]?\s*$/i;

/** Normalize a music-related string for comparison. */
export function normText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(FEAT_RE, "") // strip trailing "feat. X"
    .replace(/\(.*?(remaster|version|edit|mix|live|radio| deluxe|extended).*?\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Sørensen–Dice coefficient over character bigrams. */
export function bigramDice(a: string, b: string): number {
  const sa = normText(a);
  const sb = normText(b);
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  if (sa.length < 2 || sb.length < 2) {
    return sa === sb ? 1 : 0;
  }
  const grams = new Map<string, number>();
  for (let i = 0; i < sa.length - 1; i++) {
    const g = sa.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < sb.length - 1; i++) {
    const g = sb.slice(i, i + 2);
    const c = grams.get(g) ?? 0;
    if (c > 0) {
      grams.set(g, c - 1);
      hits++;
    }
  }
  return (2 * hits) / (sa.length - 1 + (sb.length - 1));
}

export function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normText(a).split(" ").filter(Boolean));
  const tb = new Set(normText(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

export interface ScoreableTrack {
  title: string;
  artist: string;
  album: string;
  genre: string;
}

/**
 * Score how well a parsed entry {title, artist} matches a catalog track.
 * 1.0 = perfect. Combines title similarity (weighted high) with artist similarity.
 * When artist is missing we only rely on the title but demand a stronger title score.
 */
export function scoreMatch(
  title: string,
  artist: string | undefined,
  track: ScoreableTrack
): number {
  const tDice = bigramDice(title, track.title);
  const tToken = tokenOverlap(title, track.title);
  const titleScore = Math.max(tDice, tToken);

  const nt = normText(title);
  const ntt = normText(track.title);
  if (nt && ntt) {
    // substring bonuses — "midnight cassette" should nail "Midnight Cassette"
    if (ntt === nt) return artist && artist.trim() ? 1 : 0.94;
    if (ntt.includes(nt) || nt.includes(ntt)) {
      const bonus = 0.18 * (Math.min(nt.length, ntt.length) / Math.max(nt.length, ntt.length));
      if (!artist || !artist.trim()) return Math.min(0.92, titleScore + bonus + 0.1);
    }
  }

  let score: number;
  if (artist && artist.trim()) {
    const artistScore = Math.max(bigramDice(artist, track.artist), tokenOverlap(artist, track.artist));
    score = titleScore * 0.62 + artistScore * 0.38;
  } else {
    score = Math.min(0.9, titleScore * 0.95);
  }
  return score;
}

/** Score a free-text search query against a track (title/artist/album/genre). */
export function scoreSearchQuery(query: string, track: ScoreableTrack): number {
  const q = normText(query);
  if (!q) return 0;
  const fields: Array<[string, number]> = [
    [track.title, 1],
    [track.artist, 0.9],
    [track.album, 0.6],
    [track.genre, 0.4],
  ];
  let best = 0;
  for (const [field, weight] of fields) {
    const nf = normText(field);
    let s = 0;
    if (nf === q) s = 1;
    else if (nf.startsWith(q)) s = 0.92;
    else if (nf.includes(q)) s = 0.85;
    else {
      const d = bigramDice(query, field);
      if (d > 0.5) s = d * 0.75;
    }
    best = Math.max(best, s * weight);
  }
  // combined "title artist" query, e.g. "neon harbour midnight"
  if (best < 0.5) {
    const combined = normText(`${track.title} ${track.artist}`);
    if (combined.includes(q)) best = Math.max(best, 0.8);
  }
  return best;
}
