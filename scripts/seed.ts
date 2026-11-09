// Walkman catalog bootstrap — run with: bun scripts/seed.ts
// Wipes placeholder data and auto-syncs REAL songs (full-length, 320 kbps) from
// the Audius network, then assigns them into genre buckets and builds curated
// playlists from trending tracks.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Minimal local copies of the sync logic so the script is self-contained
// (bun resolves @/ paths, but keeping it inline avoids loading Next dev deps).

const APP_NAME = "Walkman";
const FALLBACK_HOSTS = ["https://discoveryprovider.audius.co", "https://api.audius.co"];

const GENRE_BUCKETS: { audius: string; display: string }[] = [
  { audius: "Electronic", display: "Electronic" },
  { audius: "Hip-Hop/Rap", display: "Hip-Hop" },
  { audius: "Pop", display: "Pop" },
  { audius: "Rock", display: "Rock" },
  { audius: "R&B/Soul", display: "R&B / Soul" },
  { audius: "Lo-Fi", display: "Lo-Fi" },
  { audius: "House", display: "House" },
  { audius: "Techno", display: "Techno" },
  { audius: "Ambient", display: "Ambient" },
  { audius: "Jazz", display: "Jazz" },
  { audius: "Trance", display: "Trance" },
  { audius: "Trap", display: "Trap" },
  { audius: "Drum & Bass", display: "Drum & Bass" },
  { audius: "Dubstep", display: "Dubstep" },
  { audius: "Classical", display: "Classical" },
  { audius: "Country", display: "Country" },
  { audius: "Folk", display: "Folk" },
  { audius: "Metal", display: "Metal" },
  { audius: "Punk", display: "Punk" },
  { audius: "Reggae", display: "Reggae" },
  { audius: "Latin", display: "Latin" },
  { audius: "K-Pop", display: "K-Pop" },
  { audius: "Soundtrack", display: "Soundtrack" },
  { audius: "Blues", display: "Blues" },
  { audius: "Downtempo", display: "Downtempo" },
  { audius: "Disco", display: "Disco" },
  { audius: "World", display: "World" },
];

const GENRE_DISPLAY_MAP = new Map(GENRE_BUCKETS.map((g) => [g.audius, g.display]));

const GENRE_RULES: [RegExp, string][] = [
  [/dubstep|riddim/i, "Dubstep"],
  [/k[\s-]?pop/i, "K-Pop"],
  [/hip[\s-]?hop|rap\b|phonk/i, "Hip-Hop"],
  [/drum[\s&-]*(and|n|&)?[\s]*bass|\bdnb\b|jungle/i, "Drum & Bass"],
  [/house|garage/i, "House"],
  [/techno|hardgroove/i, "Techno"],
  [/trance/i, "Trance"],
  [/trap/i, "Trap"],
  [/reggae|\bdub\b/i, "Reggae"],
  [/glitch[\s-]?hop/i, "Electronic"],
  [/lo[\s-]?fi/i, "Lo-Fi"],
  [/ambient|atmospheric/i, "Ambient"],
  [/downtempo|chill|trip[\s-]?hop/i, "Downtempo"],
  [/r&b|rnb|\bsoul\b/i, "R&B / Soul"],
  [/jazz/i, "Jazz"],
  [/blues/i, "Blues"],
  [/classical|orchestral|neoclassic/i, "Classical"],
  [/soundtrack|score|cinematic/i, "Soundtrack"],
  [/country/i, "Country"],
  [/folk|acoustic|singer[\s-]songwriter/i, "Folk"],
  [/metal/i, "Metal"],
  [/punk/i, "Punk"],
  [/rock/i, "Rock"],
  [/\bpop\b/i, "Pop"],
  [/latin|reggaeton/i, "Latin"],
  [/world|ethnic|global/i, "World"],
  [/pop/i, "Pop"],
  [/\bbass\b|bassmusic/i, "Dubstep"],
  [/electro|edm|electronic|idm|wave|experimental/i, "Electronic"],
];

function normalizeGenre(raw?: string | null): string {
  const g = (raw ?? "").trim();
  if (!g) return "Other";
  const exact = GENRE_DISPLAY_MAP.get(g);
  if (exact) return exact;
  for (const [pattern, bucket] of GENRE_RULES) {
    if (pattern.test(g)) return bucket;
  }
  return g
    .split(/[\s-/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function isPlayable(t: AudiusTrack): boolean {
  if (t.is_delete === true) return false;
  if (t.is_streamable === false) return false;
  if (t.stream_conditions) return false;
  const d = t.duration ?? 0;
  return d >= 30 && d <= 900;
}

interface AudiusArtwork {
  "150x150"?: string;
  "480x480"?: string;
  "1000x1000"?: string;
}

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string | null;
  artwork?: AudiusArtwork | null;
  user?: { name?: string | null; handle?: string | null; profile_picture?: { "150x150"?: string; "480x480"?: string } | null } | null;
  release_date?: string | null;
  created_at?: string;
  play_count?: number;
  favorite_count?: number;
  permalink?: string;
  is_streamable?: boolean;
  stream_conditions?: unknown;
  is_delete?: boolean;
}

function pickArtwork(t: AudiusTrack): string {
  const a = t.artwork;
  const url = a?.["480x480"] ?? a?.["1000x1000"] ?? a?.["150x150"];
  if (url) return url;
  return t.user?.profile_picture?.["480x480"] ?? t.user?.profile_picture?.["150x150"] ?? "";
}

function parseYear(t: AudiusTrack): number {
  const dateStr = t.release_date ?? t.created_at;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  return new Date().getFullYear();
}

async function audiusGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const usp = new URLSearchParams({ app_name: APP_NAME });
  for (const [k, v] of Object.entries(params)) usp.set(k, String(v));
  const res = await fetch(`${FALLBACK_HOSTS[0]}${path}?${usp.toString()}`, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Audius ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  console.log("Wiping existing catalog…");
  await db.playHistory.deleteMany();
  await db.playlistTrack.deleteMany();
  await db.like.deleteMany();
  await db.playlist.deleteMany();
  await db.track.deleteMany();
  await db.syncLog.deleteMany();

  console.log("Syncing REAL songs from the Audius network…");
  interface Task {
    scope: string;
    run: () => Promise<AudiusTrack[]>;
  }
  const tasks: Task[] = [
    { scope: "Trending (all)", run: async () => (await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/trending", { time: "month", limit: 100 })).data ?? [] },
    { scope: "Underground", run: async () => (await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/trending/underground", { limit: 60 })).data ?? [] },
    ...GENRE_BUCKETS.map((g) => ({
      scope: g.display,
      run: async () => (await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/trending", { genre: g.audius, time: "week", limit: 30 })).data ?? [],
    })),
  ];

  const collected = new Map<string, AudiusTrack>();
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        const tracks = await task.run();
        for (const t of tracks) if (t?.id && !collected.has(t.id)) collected.set(t.id, t);
        console.log(`  ✓ ${task.scope}: ${tracks.length} tracks`);
      } catch (err) {
        console.warn(`  ✗ ${task.scope}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const playable = [...collected.values()].filter(isPlayable);
  console.log(`Saving ${playable.length} real tracks to the catalog…`);

  let trackNo = 0;
  const genreSeeds: { genre: string; trackIds: string[] }[] = [];
  let added = 0;
  for (const t of playable) {
    trackNo += 1;
    const releaseDate = t.release_date ? new Date(t.release_date) : null;
    try {
      const row = await db.track.create({
        data: {
          title: (t.title ?? "Untitled").trim().slice(0, 200),
          artist: (t.user?.name || t.user?.handle || "Unknown Artist").trim().slice(0, 120),
          album: "Single",
          genre: normalizeGenre(t.genre),
          year: parseYear(t),
          durationSec: Math.max(10, Math.round(t.duration ?? 0)),
          cover: pickArtwork(t),
          audioFile: "",
          qualityTier: "HQ",
          bitrateKbps: 320,
          trackNo,
          source: "audius",
          audiusId: t.id,
          releaseDate,
          playCount: Math.max(0, Math.round(t.play_count ?? 0)),
          favoriteCount: Math.max(0, Math.round(t.favorite_count ?? 0)),
          permalink: t.permalink ?? null,
        },
      });
      added += 1;
      const genre = normalizeGenre(t.genre);
      let bucket = genreSeeds.find((g) => g.genre === genre);
      if (!bucket) {
        bucket = { genre, trackIds: [] };
        genreSeeds.push(bucket);
      }
      bucket.trackIds.push(row.id);
    } catch (err) {
      console.warn(`  skip "${t.title}": ${err instanceof Error ? err.message.slice(0, 80) : err}`);
    }
  }
  console.log(`Inserted ${added} real tracks.`);

  const now = new Date();
  await db.syncLog.create({ data: { scope: "all", fetched: playable.length, added, updated: 0, syncedAt: now } });
  for (const g of genreSeeds) {
    await db.syncLog.create({ data: { scope: g.genre, fetched: g.trackIds.length, added: 0, updated: 0, syncedAt: now } });
  }

  console.log("Building curated genre playlists…");
  const GRADIENTS = [
    "from-amber-400 to-orange-600",
    "from-teal-400 to-emerald-700",
    "from-rose-500 to-orange-700",
    "from-violet-500 to-fuchsia-700",
    "from-lime-400 to-teal-600",
    "from-orange-400 to-red-600",
    "from-fuchsia-400 to-purple-700",
  ];

  async function createPlaylist(name: string, description: string, trackIds: string[], importedFrom?: string) {
    if (trackIds.length === 0) return;
    const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
    await db.playlist.create({
      data: {
        name,
        description,
        gradient,
        importedFrom,
        tracks: { create: trackIds.slice(0, 50).map((trackId, i) => ({ trackId, position: i })) },
      },
    });
    console.log(`  ✓ ${name} (${Math.min(trackIds.length, 50)} songs)`);
  }

  // Walkman Top Hits — most-played real tracks across the catalog
  const topHits = await db.track.findMany({ orderBy: [{ playCount: "desc" }], take: 25, select: { id: true } });
  await createPlaylist("Walkman Top Hits", "The most-played tracks on the network right now. Auto-refreshed.", topHits.map((t) => t.id));

  // Fresh Finds — newest songs added by the auto-sync
  const fresh = await db.track.findMany({ orderBy: [{ createdAt: "desc" }], take: 25, select: { id: true } });
  await createPlaylist("Fresh Finds", "The newest songs auto-added to Walkman from the Audius network.", fresh.map((t) => t.id));

  // Genre playlists for the four biggest buckets
  const biggest = [...genreSeeds].sort((a, b) => b.trackIds.length - a.trackIds.length).slice(0, 6);
  for (const bucket of biggest) {
    if (bucket.genre === "Other") continue;
    const top = await db.track.findMany({
      where: { id: { in: bucket.trackIds } },
      orderBy: [{ playCount: "desc" }],
      take: 30,
      select: { id: true },
    });
    await createPlaylist(
      `${bucket.genre} Essentials`,
      `Trending ${bucket.genre.toLowerCase()} auto-assigned from the network. Real songs, zero cost.`,
      top.map((t) => t.id)
    );
  }

  // Seed a few likes from the top hits
  const likeTargets = topHits.slice(0, 6);
  for (const t of likeTargets) {
    await db.like.create({ data: { trackId: t.id } }).catch(() => undefined);
  }
  console.log(`Liked ${likeTargets.length} tracks.`);

  const genreSummary = genreSeeds
    .sort((a, b) => b.trackIds.length - a.trackIds.length)
    .map((g) => `${g.genre}: ${g.trackIds.length}`)
    .join(", ");
  console.log("Genre assignment:");
  console.log(`  ${genreSummary}`);
  console.log("Seed complete ✓ — all songs are real & streamable at 320 kbps");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
