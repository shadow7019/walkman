// Server-side Audius network client + catalog sync.
// Audius is a free, open music network — real artists, real full-length tracks,
// streamed at 320 kbps HQ. No API key required.
//
// "All the music in the music industry" mode: a deep harvester that sweeps
//  · trending charts for 44 genre buckets (week + month windows, paginated)
//  · global trending + underground charts (paginated)
//  · 160+ artist / mood / scene search seeds (Bollywood, amapiano, psytrance…)
// and saves everything incrementally so the catalog grows live while syncing.

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

// 44 curated genre buckets spanning the whole industry — every trending query
// per bucket guarantees real songs land in each genre.
export const GENRE_BUCKETS: GenreBucket[] = [
  { audius: "Electronic", display: "Electronic" },
  { audius: "Hip-Hop/Rap", display: "Hip-Hop" },
  { audius: "Pop", display: "Pop" },
  { audius: "Rock", display: "Rock" },
  { audius: "Alternative", display: "Alternative" },
  { audius: "R&B/Soul", display: "R&B / Soul" },
  { audius: "Lo-Fi", display: "Lo-Fi" },
  { audius: "House", display: "House" },
  { audius: "Tech House", display: "Tech House" },
  { audius: "Deep House", display: "Deep House" },
  { audius: "Progressive House", display: "House" },
  { audius: "Techno", display: "Techno" },
  { audius: "Trance", display: "Trance" },
  { audius: "Trap", display: "Trap" },
  { audius: "Drum & Bass", display: "Drum & Bass" },
  { audius: "Dubstep", display: "Dubstep" },
  { audius: "Future Bass", display: "Future Bass" },
  { audius: "Hardstyle", display: "Hardstyle" },
  { audius: "UK Garage", display: "UK Garage" },
  { audius: "Electro", display: "Electro" },
  { audius: "Vaporwave", display: "Vaporwave" },
  { audius: "Hyperpop", display: "Hyperpop" },
  { audius: "Ambient", display: "Ambient" },
  { audius: "Downtempo", display: "Downtempo" },
  { audius: "Classical", display: "Classical" },
  { audius: "Soundtrack", display: "Soundtrack" },
  { audius: "Jazz", display: "Jazz" },
  { audius: "Blues", display: "Blues" },
  { audius: "Folk", display: "Folk" },
  { audius: "Country", display: "Country" },
  { audius: "Metal", display: "Metal" },
  { audius: "Punk", display: "Punk" },
  { audius: "Reggae", display: "Reggae" },
  { audius: "Dancehall", display: "Dancehall" },
  { audius: "Disco", display: "Disco" },
  { audius: "Funk", display: "Funk" },
  { audius: "Gospel", display: "Devotional & Gospel" },
  { audius: "Devotional", display: "Devotional & Gospel" },
  { audius: "Latin", display: "Latin" },
  { audius: "K-Pop", display: "K-Pop" },
  { audius: "J-Pop", display: "J-Pop" },
  { audius: "World", display: "World" },
  { audius: "Bollywood", display: "Bollywood" },
  { audius: "Easy Listening", display: "Easy Listening" },
  { audius: "Comedy", display: "Comedy" },
];

const GENRE_DISPLAY_MAP = new Map<string, string>(GENRE_BUCKETS.map((g) => [g.audius, g.display]));

// Keyword rules that fold messy user tags ("Afro House", "Edm Trap", "Basspop"…)
// into clean genre buckets. Order matters — first match wins.
const GENRE_RULES: Array<[RegExp, string]> = [
  // — junk / non-music tags first (anchored) —
  [/^(various|edit|edit[\s-]?pack|ai[\s-]?generated|untitled|unknown|sn[_-][\w-]*|_?\d+)$/i, "Other"],
  [/^dance$/i, "Electronic"],
  [/jersey[\s-]?club|moombahton|footwork|\bjuke\b|breakcore|chiptune|8[\s-]?bit/i, "Electronic"],
  [/(spanish[\s-]?)?drill$/i, "Hip-Hop"],
  [/half[\s-]?time/i, "Dubstep"],
  [/^uptempo$/i, "Hardstyle"],
  [/melodic[\s-]?psy|psy[\s-]?tech/i, "Trance"],
  [/afro[\s-]?beat|afro[\s-]?fusion/i, "World"],
  [/bollywood|tollywood|bhangra|\bdesi\b/i, "Bollywood"],
  // — broad buckets —
  [/dubstep|riddim/i, "Dubstep"],
  [/k[\s-]?pop/i, "K-Pop"],
  [/j[\s-]?pop/i, "J-Pop"],
  [/hyperpop/i, "Hyperpop"],
  [/hip[\s-]?hop|rap\b|phonk/i, "Hip-Hop"],
  [/drum[\s&-]*(and|n|&)?[\s]*bass|\bdnb\b|jungle/i, "Drum & Bass"],
  [/uk[\s-]?garage|future[\s-]?garage|2[\s-]?step/i, "UK Garage"],
  [/tech[\s-]?house/i, "Tech House"],
  [/deep[\s-]?house/i, "Deep House"],
  [/progressive[\s-]?house/i, "House"],
  [/afro[\s-]?house|brazilian[\s-]?bass|bass[\s-]?house/i, "House"],
  [/house|garage/i, "House"],
  [/techno|hardgroove/i, "Techno"],
  [/psytrance|goa[\s-]?trance|full[\s-]?on|dark[\s-]?psy|prog[\s-]?psy/i, "Trance"],
  [/trance/i, "Trance"],
  [/future[\s-]?bass/i, "Future Bass"],
  [/trap/i, "Trap"],
  [/hardstyle|hard[\s-]?dance|happy[\s-]?hardcore|frenchcore|gabber/i, "Hardstyle"],
  [/vaporwave|synthwave|retrowave|outrun|dreampunk/i, "Vaporwave"],
  [/dancehall|\bragga\b/i, "Dancehall"],
  [/reggae|\bdub\b/i, "Reggae"],
  [/bollywood|film[i]?[\s-]?song|\bhindi\b/i, "Bollywood"],
  [/glitch[\s-]?hop/i, "Electronic"],
  [/lo[\s-]?fi/i, "Lo-Fi"],
  [/ambient|atmospheric/i, "Ambient"],
  [/downtempo|chill|trip[\s-]?hop/i, "Downtempo"],
  [/r&b|rnb|\bsoul\b/i, "R&B / Soul"],
  [/jazz/i, "Jazz"],
  [/blues/i, "Blues"],
  [/gospel|worship|christian|devotional|bhajan|kirtan|mantra|qawwali|shabad|sufi/i, "Devotional & Gospel"],
  [/classical|orchestral|neoclassic|carnatic|hindustani/i, "Classical"],
  [/soundtrack|score|cinematic/i, "Soundtrack"],
  [/country/i, "Country"],
  [/folk|acoustic|singer[\s-]songwriter/i, "Folk"],
  [/metal/i, "Metal"],
  [/punk/i, "Punk"],
  [/indie[\s-]?dance/i, "House"],
  [/indie/i, "Indie"],
  [/rock/i, "Rock"],
  [/\bfunk\b|boogie/i, "Funk"],
  [/\bpop\b/i, "Pop"],
  [/latin|reggaeton|salsa|bachata|cumbia|merengue/i, "Latin"],
  [/afrobeat|amapiano|\bafro\b|world|ethnic|global/i, "World"],
  [/easy[\s-]?listening|bossa|lounge/i, "Easy Listening"],
  [/comedy|parody/i, "Comedy"],
  [/\belectro\b/i, "Electro"],
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

async function audiusGet<T>(path: string, params: Query = {}, timeoutMs = 20_000): Promise<T> {
  const host = await getAudiusHost();
  const usp = new URLSearchParams({ app_name: APP_NAME });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  const res = await fetch(`${host}${path}?${usp.toString()}`, {
    signal: AbortSignal.timeout(timeoutMs),
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
const MAX_DURATION_SEC = 1200; // keep 20-min classical movements / EPs, skip hour-long radio mixes

export function isPlayable(t: AudiusTrack): boolean {
  if (t.is_delete === true) return false;
  if (t.is_streamable === false) return false;
  if (t.stream_conditions) return false; // gated/premium tracks can't stream anonymously
  const tag = (t.genre ?? "").toLowerCase();
  if (/podcast|audiobook|spoken[\s-]?word|radio[\s-]?show/.test(tag)) return false; // not music
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

// Regional music often lives in the `tags` field ("electronic,bollywood,remix")
// rather than `genre` — the desi scene especially. Tags beat generic buckets.
const DESI_TAG_RE = /bollywood|tollywood|bhangra|\bdesi\b|\bhindi\b|\bpunjabi\b|bhajan|kirtan|qawwali|\bsufi\b|\bsitar\b|\btabla\b|\bindia\b|\bindian\b/i;

function resolveGenre(t: AudiusTrack): string {
  const tags = t.tags ?? "";
  if (DESI_TAG_RE.test(tags)) return "Bollywood";
  return normalizeGenre(t.genre);
}

export function audiusTrackToData(t: AudiusTrack, trackNo: number) {
  return {
    title: (t.title ?? "Untitled").trim().slice(0, 200),
    artist: (t.user?.name || t.user?.handle || "Unknown Artist").trim().slice(0, 120),
    album: "Single",
    genre: resolveGenre(t),
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

/**
 * Full upsert used by quick refreshes: adds new tracks and refreshes
 * metadata/play-counts for the ones we already have.
 */
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

/**
 * Bulk create-only upsert used by the deep industry harvest: skips tracks we
 * already have and inserts the rest with a single createMany per chunk —
 * thousands of tracks per minute instead of dozens.
 */
export async function bulkCreateAudiusTracks(list: AudiusTrack[]): Promise<UpsertResult> {
  const playable = list.filter(isPlayable).filter((t) => t.id && t.title);
  if (!playable.length) return { added: 0, updated: 0, considered: 0 };

  const audiusIds = playable.map((t) => t.id);
  const existing = await db.track.findMany({
    where: { audiusId: { in: audiusIds } },
    select: { audiusId: true },
  });
  const existingSet = new Set(existing.map((e) => e.audiusId));

  let maxTrackNo = (await db.track.aggregate({ _max: { trackNo: true } }))._max.trackNo ?? 0;
  const fresh = playable.filter((t) => !existingSet.has(t.id));
  if (!fresh.length) return { added: 0, updated: 0, considered: playable.length };

  const rows = fresh.map((t) => {
    maxTrackNo += 1;
    return audiusTrackToData(t, maxTrackNo);
  });

  const CHUNK = 100; // stay well under SQLite's parameter limit
  let added = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.track
      .createMany({ data: rows.slice(i, i + CHUNK) })
      .then(() => {
        added += Math.min(CHUNK, rows.length - i);
      })
      .catch(async (err: unknown) => {
        // rare duplicate race — fall back to row-by-row for this chunk
        const msg = err instanceof Error ? err.message : String(err);
        if (!/Unique constraint/i.test(msg)) console.error("[audius] createMany chunk failed:", msg);
        for (const row of rows.slice(i, i + CHUNK)) {
          await db.track
            .create({ data: row })
            .then(() => {
              added += 1;
            })
            .catch(() => undefined);
        }
      });
  }

  return { added, updated: 0, considered: playable.length };
}

/* ---------------- live sync state (for UI progress) ---------------- */

export type SyncMode = "quick" | "deep";

interface LiveSyncState {
  running: boolean;
  mode: SyncMode | null;
  fetched: number; // unique candidates examined this run
  added: number; // tracks saved this run
  updated: number;
  startedAt: number | null;
}

const liveState: LiveSyncState = { running: false, mode: null, fetched: 0, added: 0, updated: 0, startedAt: null };

export function getSyncState(): {
  running: boolean;
  mode: SyncMode | null;
  fetched: number;
  added: number;
  updated: number;
} {
  return {
    running: liveState.running,
    mode: liveState.mode,
    fetched: liveState.fetched,
    added: liveState.added,
    updated: liveState.updated,
  };
}

/* ---------------- catalog sync engine ---------------- */

export interface GenreSyncStat {
  scope: string;
  group: string;
  fetched: number;
  ok: boolean;
}

export interface SyncStats {
  mode: SyncMode;
  fetched: number;
  added: number;
  updated: number;
  total: number;
  genres: GenreSyncStat[];
  syncedAt: string;
}

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // background quick-refresh every 6 hours
const DEEP_CATALOG_TARGET = 4000; // below this size, keep deep-harvesting in the background
const DEEP_RETRY_AFTER_MS = 12 * 60 * 60 * 1000; // even if small, re-deep at most every 12 h
const DEEP_BLOCKING_MS = 45_000; // first page load may wait up to 45 s for the deep harvest

let syncRunning: Promise<SyncStats> | null = null;
let lastSyncAtMem = 0;
let lastDeepAtMem = 0;

interface SyncTask {
  scope: string; // genre display name, "Trending (all)", "Underground" or "search:<seed>"
  group: string; // SyncLog grouping: genre name | charts | search
  run: () => Promise<AudiusTrack[]>;
}

async function fetchTrending(params: Query): Promise<AudiusTrack[]> {
  const r = await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/trending", params);
  return r.data ?? [];
}

async function fetchUnderground(params: Query): Promise<AudiusTrack[]> {
  const r = await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/trending/underground", params);
  return r.data ?? [];
}

async function fetchSearch(query: string, limit: number): Promise<AudiusTrack[]> {
  const r = await audiusGet<{ data?: AudiusTrack[] }>("/v1/tracks/search", { query, limit });
  return r.data ?? [];
}

/**
 * 160+ search seeds sweeping legendary artists (their indie/tribute scene on
 * Audius), decades, moods, scenes and regional music — this is what pulls the
 * long tail of the industry into the catalog, not just today's charts.
 */
const SEARCH_SEEDS: string[] = [
  // — legendary voices & iconic catalogs (indie covers, tributes, homage)
  "Michael Jackson", "Queen", "The Beatles", "Led Zeppelin", "Pink Floyd", "Nirvana", "Metallica",
  "Linkin Park", "AC/DC", "Guns N Roses", "Bon Jovi", "Iron Maiden", "Black Sabbath", "Slipknot",
  "System of a Down", "Rammstein", "Green Day", "Blink-182", "Paramore", "Fall Out Boy",
  "My Chemical Romance", "Twenty One Pilots", "Panic at the Disco", "Radiohead", "Muse",
  "Red Hot Chili Peppers", "Foo Fighters", "Arctic Monkeys", "The Strokes", "Imagine Dragons",
  "Coldplay", "Fleetwood Mac", "ABBA", "Bee Gees", "Earth Wind and Fire", "James Brown",
  "Stevie Wonder", "Marvin Gaye", "Aretha Franklin", "Ray Charles", "Whitney Houston",
  "Mariah Carey", "Beyonce", "Usher", "Chris Brown", "Alicia Keys", "John Legend", "Frank Sinatra",
  "Louis Armstrong", "Ella Fitzgerald", "Miles Davis", "John Coltrane", "BB King", "Bob Marley",
  "Johnny Cash", "Dolly Parton", "Elvis Presley", "Bob Dylan", "Simon and Garfunkel",
  "Leonard Cohen", "Joni Mitchell", "Norah Jones", "Amy Winehouse", "Lana Del Rey", "Lorde",
  "Hozier", "Sam Smith", "Lewis Capaldi", "Adele", "Ed Sheeran", "Shawn Mendes", "Camila Cabello",
  "Billie Eilish", "Ariana Grande", "Dua Lipa", "Lady Gaga", "Katy Perry", "Taylor Swift",
  "Rihanna", "The Weeknd", "Drake", "Kendrick Lamar", "Eminem", "Tupac", "Notorious BIG",
  "Jay-Z", "Kanye West", "Snoop Dogg", "Travis Scott", "Post Malone", "Lil Nas X", "NF",
  "Wu-Tang Clan", "SZA", "Frank Ocean", "Tyler the Creator", "Daft Punk", "Avicii",
  "Calvin Harris", "David Guetta", "Martin Garrix", "Alan Walker", "Kygo", "Skrillex",
  "Marshmello", "Tiesto", "Armin van Buuren", "Zedd", "Diplo", "Major Lazer", "Sean Paul",
  "Pitbull", "Shakira", "Enrique Iglesias", "J Balvin", "Bad Bunny", "BTS", "BLACKPINK",
  "TWICE", "Stray Kids", "NewJeans", "Hans Zimmer", "Ludovico Einaudi", "Two Steps From Hell",
  "Beethoven", "Mozart", "Bach", "Chopin", "Vivaldi", "Debussy", "Erik Satie", "Tchaikovsky",
  // — moods, decades & scenes
  "lofi beats", "chillhop", "synthwave", "cyberpunk", "drift phonk", "workout motivation",
  "epic soundtrack", "piano cover", "acoustic cover", "guitar instrumental", "jazz cafe",
  "swing jazz", "blues rock", "ambient sleep", "meditation", "gaming music", "chiptune",
  "8-bit", "anime", "sunday morning", "summer vibes", "rainy night", "road trip", "heartbreak",
  // — regional & global scenes
  "bollywood", "hindi songs", "punjabi songs", "bhangra", "indian classical", "sitar",
  "tabla fusion", "bhajan", "kirtan", "sufi qawwali", "tamil songs", "telugu songs",
  "carnatic fusion", "hindustani", "afrobeat", "amapiano", "reggaeton", "salsa", "bachata",
  "cumbia", "kizomba", "mandopop", "cantopop", "arabic pop", "turkish pop", "bossa nova",
  "fado", "klezmer", "celtic", "nordic folk", "flamenco", "tango", "highlife", "gqom",
];

/** Shared harvest engine — workers pull tasks, dedupe globally, save incrementally. */
async function harvest(
  mode: SyncMode,
  tasks: SyncTask[],
  concurrency: number
): Promise<SyncStats> {
  const seen = new Set<string>();
  let cursor = 0;
  let fetched = 0;
  let added = 0;
  let updated = 0;
  const genreStats: GenreSyncStat[] = [];
  const logGroups = new Map<string, number>(); // group → fetched

  liveState.running = true;
  liveState.mode = mode;
  liveState.fetched = 0;
  liveState.added = 0;
  liveState.updated = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        const tracks = await task.run();
        const unique = tracks.filter((t) => {
          if (!t?.id) return false;
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        fetched += unique.length;
        logGroups.set(task.group, (logGroups.get(task.group) ?? 0) + unique.length);

        // save incrementally so the catalog grows while the harvest runs
        const res =
          mode === "deep" ? await bulkCreateAudiusTracks(unique) : await upsertAudiusTracks(unique);
        added += res.added;
        updated += res.updated;

        liveState.fetched = fetched;
        liveState.added = added;
        liveState.updated = updated;
        genreStats.push({ scope: task.scope, group: task.group, fetched: unique.length, ok: true });
      } catch (err) {
        console.error(`[audius] sync task "${task.scope}" failed:`, err instanceof Error ? err.message : err);
        genreStats.push({ scope: task.scope, group: task.group, fetched: 0, ok: false });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  liveState.running = false;
  liveState.mode = null;
  return { mode, fetched, added, updated, total: 0, genres: genreStats, syncedAt: new Date().toISOString() };
}

function buildQuickTasks(): SyncTask[] {
  return [
    { scope: "Trending (all)", group: "charts", run: () => fetchTrending({ time: "month", limit: 100 }) },
    { scope: "Underground", group: "charts", run: () => fetchUnderground({ limit: 60 }) },
    ...GENRE_BUCKETS.map((g) => ({
      scope: g.display,
      group: g.display,
      run: () => fetchTrending({ genre: g.audius, time: "week", limit: 30 }),
    })),
  ];
}

function buildDeepTasks(): SyncTask[] {
  const tasks: SyncTask[] = [
    // global charts, paginated
    { scope: "Trending (all) · month p1", group: "charts", run: () => fetchTrending({ time: "month", limit: 100 }) },
    { scope: "Trending (all) · month p2", group: "charts", run: () => fetchTrending({ time: "month", limit: 100, offset: 100 }) },
    { scope: "Trending (all) · year", group: "charts", run: () => fetchTrending({ time: "year", limit: 100 }) },
    { scope: "Underground · p1", group: "charts", run: () => fetchUnderground({ limit: 100 }) },
    { scope: "Underground · p2", group: "charts", run: () => fetchUnderground({ limit: 100, offset: 100 }) },
  ];

  // 44 genre buckets × (week: 2 pages + month: 1 page)
  for (const g of GENRE_BUCKETS) {
    tasks.push(
      { scope: `${g.display} · week p1`, group: g.display, run: () => fetchTrending({ genre: g.audius, time: "week", limit: 100 }) },
      { scope: `${g.display} · week p2`, group: g.display, run: () => fetchTrending({ genre: g.audius, time: "week", limit: 100, offset: 100 }) },
      { scope: `${g.display} · month`, group: g.display, run: () => fetchTrending({ genre: g.audius, time: "month", limit: 100 }) }
    );
  }

  // 160+ artist / mood / scene search seeds
  for (const seed of SEARCH_SEEDS) {
    tasks.push({
      scope: `search:${seed}`,
      group: "search",
      run: () => fetchSearch(seed, 60),
    });
  }

  return tasks;
}

async function finalizeStats(mode: SyncStats["mode"], stats: SyncStats): Promise<SyncStats> {
  const now = new Date();
  if (mode === "deep") lastDeepAtMem = now.getTime();
  lastSyncAtMem = now.getTime();

  stats.total = await db.track.count();
  stats.syncedAt = now.toISOString();

  // compact SyncLog rows — one per group instead of one per task
  const groups = new Map<string, number>();
  for (const g of stats.genres) groups.set(g.group, (groups.get(g.group) ?? 0) + g.fetched);
  await db.syncLog
    .createMany({
      data: [
        {
          scope: mode === "deep" ? "deep" : "all",
          fetched: stats.fetched,
          added: stats.added,
          updated: stats.updated,
          syncedAt: now,
        },
        ...[...groups.entries()].map(([scope, fetched]) => ({ scope, fetched, added: 0, updated: 0, syncedAt: now })),
      ],
    })
    .catch(() => undefined);

  console.log(`[audius] ${mode} sync complete: +${stats.added} new, ~${stats.updated} updated, ${stats.total} total tracks`);
  return stats;
}

/**
 * Quick refresh — today's charts for every genre. Keeps the catalog fresh
 * (auto-add new songs) without re-running the full industry sweep.
 * Safe to call concurrently — running syncs are shared.
 */
export async function syncCatalog(): Promise<SyncStats> {
  if (syncRunning) return syncRunning;
  syncRunning = (async () => {
    const stats = await harvest("quick", buildQuickTasks(), 8);
    return finalizeStats("quick", stats);
  })().finally(() => {
    syncRunning = null;
  });
  return syncRunning;
}

/**
 * Deep industry sweep — charts across 44 genres (paginated) + 160 search seeds.
 * Saves incrementally, so results stream into the catalog while it runs.
 */
export async function deepSyncCatalog(): Promise<SyncStats> {
  if (syncRunning) return syncRunning;
  syncRunning = (async () => {
    const stats = await harvest("deep", buildDeepTasks(), 10);
    return finalizeStats("deep", stats);
  })().finally(() => {
    syncRunning = null;
  });
  return syncRunning;
}

export async function getLastSyncAt(): Promise<Date | null> {
  if (lastSyncAtMem) return new Date(lastSyncAtMem);
  const log = await db.syncLog.findFirst({
    where: { scope: { in: ["all", "deep"] } },
    orderBy: { syncedAt: "desc" },
  });
  return log?.syncedAt ?? null;
}

async function getLastDeepAt(): Promise<number> {
  if (lastDeepAtMem) return lastDeepAtMem;
  const log = await db.syncLog.findFirst({ where: { scope: "deep" }, orderBy: { syncedAt: "desc" } });
  lastDeepAtMem = log?.syncedAt?.getTime() ?? 0;
  return lastDeepAtMem;
}

/**
 * Called by read routes. Keeps the catalog growing automatically:
 *  · empty catalog → deep industry sweep (first page load may block briefly)
 *  · below target size → deep sweep in the background (max once per 12 h)
 *  · stale charts → quick refresh in the background
 */
export async function ensureFreshCatalog(blockingTimeoutMs = DEEP_BLOCKING_MS): Promise<void> {
  const count = await db.track.count();

  if (count === 0) {
    const promise = deepSyncCatalog();
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), blockingTimeoutMs));
    await Promise.race([promise, timeout]).catch(() => undefined);
    return;
  }

  if (count < DEEP_CATALOG_TARGET) {
    const lastDeep = await getLastDeepAt();
    if (Date.now() - lastDeep > DEEP_RETRY_AFTER_MS) {
      lastDeepAtMem = Date.now(); // prevent re-triggering on every read while it runs
      void deepSyncCatalog().catch(() => undefined);
    }
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
