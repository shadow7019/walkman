import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { playlistDetail, playlistSummary } from "@/lib/serialize";

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

// GET /api/playlists
export async function GET() {
  const playlists = await db.playlist.findMany({
    include: { tracks: { include: { track: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ playlists: playlists.map(playlistSummary) });
}

// POST /api/playlists
export async function POST(req: NextRequest) {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = asObject(parsed.body);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawName = body.name;
  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    return NextResponse.json(
      { error: "name is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const data: {
    name: string;
    description?: string | null;
    gradient?: string;
    importedFrom?: string | null;
  } = { name: rawName.trim() };

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      return NextResponse.json({ error: "description must be a string or null" }, { status: 400 });
    }
    data.description = body.description;
  }
  if (body.gradient !== undefined) {
    if (typeof body.gradient !== "string") {
      return NextResponse.json({ error: "gradient must be a string" }, { status: 400 });
    }
    data.gradient = body.gradient;
  }
  if (body.importedFrom !== undefined) {
    if (body.importedFrom !== null && typeof body.importedFrom !== "string") {
      return NextResponse.json({ error: "importedFrom must be a string or null" }, { status: 400 });
    }
    data.importedFrom = body.importedFrom;
  }

  let trackIds: string[] = [];
  if (body.trackIds !== undefined) {
    if (!Array.isArray(body.trackIds)) {
      return NextResponse.json({ error: "trackIds must be an array of strings" }, { status: 400 });
    }
    const arr: unknown[] = body.trackIds;
    if (arr.some((v) => typeof v !== "string")) {
      return NextResponse.json({ error: "trackIds must be an array of strings" }, { status: 400 });
    }
    // dedupe (playlistId+trackId is unique) while preserving first-occurrence order
    trackIds = [...new Set(arr as string[])].filter((id) => id.length > 0);
  }

  const created = await db.playlist.create({ data });

  if (trackIds.length > 0) {
    const found = await db.track.findMany({ where: { id: { in: trackIds } } });
    const byId = new Map(found.map((t) => [t.id, t]));
    const rows: { playlistId: string; trackId: string; position: number }[] = [];
    let position = 0;
    for (const id of trackIds) {
      if (byId.has(id)) {
        rows.push({ playlistId: created.id, trackId: id, position });
        position += 1;
      }
    }
    if (rows.length > 0) {
      await db.playlistTrack.createMany({ data: rows });
    }
  }

  const full = await db.playlist.findUnique({
    where: { id: created.id },
    include: { tracks: { include: { track: true } } },
  });
  if (!full) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }
  return NextResponse.json({ playlist: playlistDetail(full) }, { status: 201 });
}
