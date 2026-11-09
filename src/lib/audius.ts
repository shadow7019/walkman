// Server-side Audius network client + catalog sync.
// Audius is a free, open music network — real artists, real full-length tracks,
// streamed at 320 kbps HQ. No API key required.

import { db } from "@/lib/db";
import type { Track as TrackRow } from "@prisma/client";

const APP_NAME = "Walkman";
const FALLBACK_HOSTS = ["https://discoveryprovider.audius.co", "https://api.audius.co"];

/* ---------------- host resolution ---------------- */

let hostPromise: Promise<string> | null = null;

export async function getAudiusHost(): Promise<string> {
  if (!hostPromise) {
    hostPromise = (async () => {
      try {
        const res = await fetch("https://api.audius.co", { signal: AbortSignal.timeout(6000) });
        const j = (await res.json()) as { data?: string[] };
        const hosts = (j.data ?? []).filter((h) => typeof h === "string" && h.startsWith("http"));
        if (hosts.length) return hosts[0].replace(/\/$/, "");
      } catch {
        // fall through to static fallback
      }
      return FALLBACK_HOSTS[0];
    })().catch(() => FALLBACK_HOSTS[0]);
  }
  return hostPromise;
}

/* ---------------- types ---------------- */

export interface AudiusArtwork {
  "150x150"?: string;
  "480x480"?: string;
  "1000x1000"?: string;
}

export interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string | null;
  mood?: string | null;
  tags?: string | null;
  description?: string | null;
  artwork?: AudiusArtwork | null;
  user?: {
    name?: string | null;
    handle?: string | null;
    profile_picture?: { "150x150"?: string; "480x480"?: string } | null;
  } | null;
  release_date?: string | null;
  created_at?: string;
  play_count?: number;
  favorite_count?: number;
  repost_count?: number;
  permalink?: string;
  is_streamable?: boolean;
  stream_conditions?: unknown; // premium/gated tracks require auth — not playable for us
  is_delete?: boolean;
}

/* ---------------- genre configuration ---------------- */

export interface GenreBucket {
  audius: string; // exact Audius genre string for trending queries
  display: string; // display name stored on tracks
}

// Curated genre buckets — every trending query per bucket guarantees songs in each genre.
export const GENRE_BUCKETS: GenreBucket[] = [
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

const GENRE_DISPLAY_MAP = new Map<string, string>(GENRE_BUCKETS.map((g) => [g.audius, g.display]));

// Keyword rules that fold messy user tags ("Afro House", "Edm Trap", "Basspop"…)
// into clean genre buckets. Order matters — first match wins.
const GENRE_RULES: Array<[RegExp, string]> = [
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

function titleCase(s: string): string {
  return s
    .split(/[\s-/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Map a raw Audius genre tag to a display genre bucket. */
export function normalizeGenre(raw?: string | null): string {
  const g = (raw ?? "").trim();
  if (!g) return "Other";
  const exact = GENRE_DISPLAY_MAP.get(g);
  if (exact) return exact;
  for (const [pattern, bucket] of GENRE_RULES) {
    if (pattern.test(g)) return bucket;
  }
  return titleCase(g);
}

/* ---------------- fetch helpers ---------------- */

type Query = Record<string, string | number | undefined>;

async function audiusGet<T>(path: string, params: Query = {}): Promise<T> {
  const host = await getAudiusHost();
  const usp = new URLSearchParams({ app_name: APP_NAME });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  const res = await fetch(`${host}${path}?${usp.toString()}`, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Audius ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/* ---------------- stream URL resolution ---------------- */

const streamUrlCache = new Map<string, { url: string; at: number }>();
const STREAM_URL_TTL = 20 * 60 * 1000; // signed CDN links — refresh every 20 min

/** Resolve a signed CDN URL for a track's full-length audio. */
export async function resolveAudiusStream(audiusId: string): Promise<string | null> {
  const cached = streamUrlCache.get(audiusId);
  if (cached && Date.now() - cached.at < STREAM_URL_TTL) return cached.url;

  const host = await getAudiusHost();
  const streamEndpoint = `${host}/v1/tracks/${encodeURIComponent(audiusId)}/stream?app_name=${APP_NAME}`;
  try {
    const res = await fetch(streamEndpoint, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    const location = res.headers.get("location");
    if (location) {
      streamUrlCache.set(audiusId, { url: location, at: Date.now() });
      return location;
    }
    if (res.ok) return streamEndpoint; // direct stream (no redirect) — proxy through endpoint URL
    return null;
  } catch {
    return null;
  }
}

/* ---------------- playable filter + mapping ---------------- */

const MIN_DURATION_SEC = 30;
const MAX_DURATION_SEC = 900; // skip hour-long radio mixes — keep it song-like

export function isPlayable(t: AudiusTrack): boolean {
  if (t.is_delete === true) return false;
  if (t.is_streamable === false) return false;
  if (t.stream_conditions) return false; // gated/premium tracks can't stream anonymously
  const d = t.duration ?? 0;
  return d >= MIN_DURATION_SEC && d <= MAX_DURATION_SEC;
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

export function audiusTrackToData(t: AudiusTrack, trackNo: number) {
  return {
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
    releaseDate: t.release_date ? new Date(t.release_date) : null,
    playCount: Math.max(0, Math.round(t.play_count ?? 0)),
    favoriteCount: Math.max(0, Math.round(t.favorite_count ?? 0)),
    permalink: t.permalink ?? null,
  };
}

export type AudiusTrackData = ReturnType<typeof audiusTrackToData>;

/** Build a client-facing pseudo-DTO for matching against Audius search candidates. */
export function audiusToDTO(t: AudiusTrack) {
  return {
    id: `audius:${t.id}`,
    title: (t.title ?? "").trim(),
    artist: (t.user?.name || t.user?.handle || "").trim(),
    album: "Single",
    genre: normalizeGenre(t.genre),
    year: parseYear(t),
    durationSec: Math.round(t.duration ?? 0),
    cover: pickArtwork(t),
    audioFile: "",
    qualityTier: "HQ",
    bitrateKbps: 320,
    source: "audius" as const,
    playCount: t.play_count ?? 0,
    favoriteCount: t.favorite_count ?? 0,
  };
}

/* ---------------- upsert ---------------- */

export interface UpsertResult {
  added: number;
  updated: number;
  considered: number;
}

export async function upsertAudiusTracks(list: AudiusTrack[]): Promise<UpsertResult> {
  const playable = list.filter(isPlayable).filter((t) => t.id && t.title);
  if (!playable.length) return { added: 0, updated: 0, considered: 0 };

  const audiusIds = playable.map((t) => t.id);
  const existing = await db.track.findMany({
    where: { audiusId: { in: audiusIds } },
    select: { audiusId: true },
  });
  const existingSet = new Set(existing.map((e) => e.audiusId));

  let maxTrackNo = (await db.track.aggregate({ _max: { trackNo: true } }))._max.trackNo ?? 0;
  let added = 0;
  let updated = 0;

  for (const t of playable) {
    maxTrackNo += 1;
    const data = audiusTrackToData(t, maxTrackNo);
    try {
      if (existingSet.has(t.id)) {
        await db.track.update({
          where: { audiusId: t.id },
          data: {
            title: data.title,
            artist: data.artist,
            genre: data.genre,
            year: data.year,
            durationSec: data.durationSec,
            cover: data.cover || undefined,
            playCount: data.playCount,
            favoriteCount: data.favoriteCount,
            releaseDate: data.releaseDate,
            permalink: data.permalink,
          },
        });
        updated += 1;
      } else {
        await db.track.create({ data });
        added += 1;
      }
    } catch (err) {
      // unique-violation races (parallel syncs) — recover by updating instead
      const msg = err instanceof Error ? err.message : String(err);
      if (/Unique constraint/i.test(msg)) {
        await db.track
          .update({ where: { audiusId: t.id }, data: { playCount: data.playCount, favoriteCount: data.favoriteCount } })
          .catch(() => undefined);
        updated += 1;
      } else {
        console.error(`[audius] failed to save track "${data.title}":`, msg);
      }
    }
  }

  return { added, updated, considered: playable.length };
}

/* ---------------- catalog sync ---------------- */

export interface GenreSyncStat {
  scope: string;
  fetched: number;
  ok: boolean;
}

export interface SyncStats {
  fetched: number;
  added: number;
  updated: number;
  total: number;
  genres: GenreSyncStat[];
  syncedAt: string;
}

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // background-refresh every 6 hours
let syncRunning: Promise<SyncStats> | null = null;
let lastSyncAtMem = 0;

async function fetchTrending(params: Query): Promise<AudiusTrack[]> {
  const r = await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/trending", params);
  return r.data ?? [];
}

/**
 * Auto-sync the catalog with real songs from the Audius network:
 * trending tracks for every genre bucket + overall trending + underground picks.
 * Safe to call concurrently — running syncs are shared.
 */
export async function syncCatalog(): Promise<SyncStats> {
  if (syncRunning) return syncRunning;
  syncRunning = runSync().finally(() => {
    syncRunning = null;
  });
  return syncRunning;
}

async function runSync(): Promise<SyncStats> {
  interface SyncTask {
    scope: string;
    run: () => Promise<AudiusTrack[]>;
  }

  const tasks: SyncTask[] = [
    // overall trending + underground first — keeps catalog fresh even if per-genre queries fail
    { scope: "Trending (all)", run: () => fetchTrending({ time: "month", limit: 100 }) },
    { scope: "Underground", run: () => audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/trending/underground", { limit: 60 }).then((r) => r.data ?? []) },
    ...GENRE_BUCKETS.map((g) => ({
      scope: g.display,
      run: () => fetchTrending({ genre: g.audius, time: "week", limit: 30 }),
    })),
  ];

  const collected = new Map<string, AudiusTrack>();
  const genreStats: GenreSyncStat[] = [];

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        const tracks = await task.run();
        for (const t of tracks) if (t?.id && !collected.has(t.id)) collected.set(t.id, t);
        genreStats.push({ scope: task.scope, fetched: tracks.length, ok: true });
      } catch (err) {
        console.error(`[audius] sync task "${task.scope}" failed:`, err instanceof Error ? err.message : err);
        genreStats.push({ scope: task.scope, fetched: 0, ok: false });
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const { added, updated } = await upsertAudiusTracks([...collected.values()]);
  const total = await db.track.count();
  const now = new Date();
  lastSyncAtMem = now.getTime();

  await db.syncLog
    .createMany({
      data: [
        { scope: "all", fetched: collected.size, added, updated, syncedAt: now },
        ...genreStats.map((g) => ({ scope: g.scope, fetched: g.fetched, added: 0, updated: 0, syncedAt: now })),
      ],
    })
    .catch(() => undefined);

  console.log(`[audius] sync complete: +${added} new, ~${updated} updated, ${total} total tracks`);

  return {
    fetched: collected.size,
    added,
    updated,
    total,
    genres: genreStats,
    syncedAt: now.toISOString(),
  };
}

export async function getLastSyncAt(): Promise<Date | null> {
  if (lastSyncAtMem) return new Date(lastSyncAtMem);
  const log = await db.syncLog.findFirst({ where: { scope: "all" }, orderBy: { syncedAt: "desc" } });
  return log?.syncedAt ?? null;
}

/**
 * Called by read routes. If the catalog is empty, syncs before responding
 * (bounded so a slow network never hangs the request); otherwise triggers a
 * background refresh when the last sync is stale.
 */
export async function ensureFreshCatalog(blockingTimeoutMs = 25_000): Promise<void> {
  const count = await db.track.count();
  if (count === 0) {
    const promise = syncCatalog();
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), blockingTimeoutMs));
    await Promise.race([promise, timeout]).catch(() => undefined);
    return;
  }

  let last = lastSyncAtMem;
  if (!last) {
    last = (await getLastSyncAt())?.getTime() ?? 0;
    lastSyncAtMem = last;
  }
  if (Date.now() - last < STALE_AFTER_MS) return;

  // stale — refresh in the background, never block the read
  lastSyncAtMem = Date.now();
  void syncCatalog().catch(() => undefined);
}

/* ---------------- search (used by universal playlist import) ---------------- */

export async function searchAudius(query: string, limit = 10): Promise<AudiusTrack[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const r = await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/search", { query: q, limit });
    return (r.data ?? []).filter(isPlayable);
  } catch (err) {
    console.error(`[audius] search failed for "${q}":`, err instanceof Error ? err.message : err);
    return [];
  }
}

/** Persist a chosen Audius candidate into the local catalog. */
export async function importAudiusTrack(t: AudiusTrack): Promise<TrackRow | null> {
  if (!isPlayable(t) || !t.id) return null;
  const existing = await db.track.findUnique({ where: { audiusId: t.id } });
  if (existing) return existing;
  const trackNo = ((await db.track.aggregate({ _max: { trackNo: true } }))._max.trackNo ?? 0) + 1;
  const data = audiusTrackToData(t, trackNo);
  return db.track.create({ data });
}

export type { TrackRow };
