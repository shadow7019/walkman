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

// GET /api/likes
export async function GET() {
  const rows = await db.like.findMany({
    include: { track: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    likedTrackIds: rows.map((r) => r.trackId),
    tracks: rows.map((r) => trackDTO(r.track)),
  });
}

// POST /api/likes — toggle like for { trackId }
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

  const existing = await db.like.findUnique({ where: { trackId } });
  if (existing) {
    await db.like.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }
  await db.like.create({ data: { trackId } });
  return NextResponse.json({ liked: true });
}
