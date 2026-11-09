import { NextRequest, NextResponse } from "next/server";
import { scoreMatch } from "@/lib/fuzzy";
import { db } from "@/lib/db";
import { trackDTO } from "@/lib/serialize";
import { parseImportText } from "@/lib/import-parser";
import type { ImportEntry, ImportPreview, Track } from "@/lib/types";

const MAX_TEXT_LENGTH = 100_000;
const SUGGESTION_THRESHOLD = 0.15;
const MATCH_THRESHOLD = 0.55;
const SUGGESTION_LIMIT = 5;

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

// POST /api/import — parse pasted playlist text and match entries against the catalog
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
    };
  });

  const matched = results.filter((e) => e.bestMatch !== null).length;
  const payload: ImportPreview = {
    format,
    playlistNameHint: nameHint,
    entries: results,
    stats: { total: results.length, matched },
  };
  return NextResponse.json(payload);
}
