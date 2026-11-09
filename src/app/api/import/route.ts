import { NextRequest, NextResponse } from "next/server";
import { scoreMatch } from "@/lib/fuzzy";
import { db } from "@/lib/db";
import { trackDTO } from "@/lib/serialize";
import { parseImportText } from "@/lib/import-parser";
import { searchAudius, importAudiusTrack, audiusToDTO, type AudiusTrack } from "@/lib/audius";
import type { ImportEntry, ImportPreview, Track } from "@/lib/types";

const MAX_TEXT_LENGTH = 100_000;
const SUGGESTION_THRESHOLD = 0.15;
const MATCH_THRESHOLD = 0.55;
const SUGGESTION_LIMIT = 5;
const LIVE_MATCH_THRESHOLD = 0.5; // slightly looser for network candidates
const MAX_LIVE_LOOKUPS = 40; // bound network work per request
const LIVE_CONCURRENCY = 6;

type JsonObject = Record<string, unknown>;

function asObject(v: unknown): JsonObject | null {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) return v as JsonObject;
  return null;
}

async function readJsonBody(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false };
  }
}

/** Find the best Audius network candidate for a parsed entry. */
async function bestAudiusCandidate(
  title: string,
  artist: string | undefined,
  query: string
): Promise<{ track: AudiusTrack; score: number } | null> {
  const candidates = await searchAudius(query, 10);
  let best: { track: AudiusTrack; score: number } | null = null;
  for (const candidate of candidates) {
    const dto = audiusToDTO(candidate);
    const forward = scoreMatch(title, artist, dto);
    const swapped = artist ? scoreMatch(artist, title, dto) : -1;
    const score = Math.max(forward, swapped);
    if (!best || score > best.score) best = { track: candidate, score };
  }
  return best && best.score >= LIVE_MATCH_THRESHOLD ? best : null;
}

// POST /api/import — parse pasted playlist text, match against the catalog, and
// pull unmatched songs from the Audius network so every entry becomes playable.
export async function POST(req: NextRequest) {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = asObject(parsed.body);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const text = body.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required and must be a non-empty string" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text is too large" }, { status: 400 });
  }
  const enrich = body.enrich !== false;

  const { format, entries, nameHint } = parseImportText(text);
  const catalog = (await db.track.findMany({ orderBy: [{ trackNo: "asc" }] })).map(trackDTO);

  const results: ImportEntry[] = entries.map((entry) => {
    const artist = entry.artist;
    const hasArtist = artist !== undefined && artist.trim().length > 0;

    const forwardScores = catalog.map((track) => scoreMatch(entry.title, artist, track));
    const swappedScores = hasArtist
      ? catalog.map((track) => scoreMatch(artist ?? "", entry.title, track))
      : catalog.map(() => -1);

    const forwardBest = catalog.length > 0 ? Math.max(...forwardScores) : 0;
    const swappedBest = hasArtist && catalog.length > 0 ? Math.max(...swappedScores) : -1;

    const useSwapped = swappedBest > forwardBest;
    const scores = useSwapped ? swappedScores : forwardScores;
    const best = useSwapped ? swappedBest : forwardBest;

    const ranked = catalog
      .map((track, index) => ({ track, score: scores[index] }))
      .sort((a, b) => b.score - a.score);
    const suggestions = ranked
      .filter((r) => r.score > SUGGESTION_THRESHOLD)
      .slice(0, SUGGESTION_LIMIT)
      .map((r) => r.track);

    const bestMatch: Track | null =
      ranked.length > 0 && ranked[0].score >= MATCH_THRESHOLD ? ranked[0].track : null;

    return {
      raw: entry.raw,
      title: entry.title,
      artist: entry.artist,
      bestMatch,
      confidence: Math.round(best * 100) / 100,
      suggestions,
      swapped: useSwapped,
      source: bestMatch ? ("catalog" as const) : undefined,
    };
  });

  // Live enrichment: entries with no confident local match get searched on Audius.
  if (enrich) {
    const unmatched = results.filter((e) => e.bestMatch === null).slice(0, MAX_LIVE_LOOKUPS);
    let cursor = 0;

    async function worker(): Promise<void> {
      while (cursor < unmatched.length) {
        const entry = unmatched[cursor++];
        const query = entry.artist ? `${entry.artist} ${entry.title}` : entry.title;
        try {
          const best = await bestAudiusCandidate(entry.title, entry.artist, query);
          if (best) {
            const saved = await importAudiusTrack(best.track);
            if (saved) {
              entry.bestMatch = trackDTO(saved);
              entry.confidence = Math.round(best.score * 100) / 100;
              entry.source = "audius";
            }
          }
        } catch (err) {
          console.error("[api/import] live match failed:", err instanceof Error ? err.message : err);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(LIVE_CONCURRENCY, unmatched.length) }, () => worker()));
  }

  const matched = results.filter((e) => e.bestMatch !== null).length;
  const fromNetwork = results.filter((e) => e.source === "audius").length;
  const payload: ImportPreview = {
    format,
    playlistNameHint: nameHint,
    entries: results,
    stats: { total: results.length, matched },
  };
  void fromNetwork;
  return NextResponse.json(payload);
}
