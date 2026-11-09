import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { playlistDetail } from "@/lib/serialize";

type JsonObject = Record<string, unknown>;
type Ctx = { params: Promise<{ id: string }> };

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

// GET /api/playlists/[id]
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const playlist = await db.playlist.findUnique({
    where: { id },
    include: { tracks: { include: { track: true } } },
  });
  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }
  return NextResponse.json({ playlist: playlistDetail(playlist) });
}

// PATCH /api/playlists/[id]
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = asObject(parsed.body);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: { name?: string; description?: string | null; gradient?: string } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.description !== undefined) {
    // description may be null to clear it
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

  const existing = await db.playlist.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  const updated = await db.playlist.update({
    where: { id },
    data,
    include: { tracks: { include: { track: true } } },
  });
  return NextResponse.json({ playlist: playlistDetail(updated) });
}

// DELETE /api/playlists/[id] — cascade removes PlaylistTrack rows
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await db.playlist.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }
  await db.playlist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
