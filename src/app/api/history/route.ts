import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackDTO } from "@/lib/serialize";

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

// GET /api/history?limit=20 — most recent plays, deduped by trackId
export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  let limit = 20;
  if (limitParam !== null) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(parsed)) limit = parsed;
  }
  limit = Math.min(50, Math.max(1, limit));

  const rows = await db.playHistory.findMany({
    include: { track: true },
    orderBy: { playedAt: "desc" },
    take: 200,
  });

  const seen = new Set<string>();
  const deduped: typeof rows = [];
  for (const row of rows) {
    if (seen.has(row.trackId)) continue;
    seen.add(row.trackId);
    deduped.push(row);
  }

  return NextResponse.json({ tracks: deduped.slice(0, limit).map((r) => trackDTO(r.track)) });
}

// POST /api/history — record a play for { trackId }
export async function POST(req: NextRequest) {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = asObject(parsed.body);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const trackId = body.trackId;
  if (typeof trackId !== "string" || trackId.trim().length === 0) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  const track = await db.track.findUnique({ where: { id: trackId } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  await db.playHistory.create({ data: { trackId } });
  return NextResponse.json({ ok: true });
}
