import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderedTracks } from "@/lib/serialize";

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

async function getPlaylistWithTracks(id: string) {
  return db.playlist.findUnique({
    where: { id },
    include: { tracks: { include: { track: true } } },
  });
}

// POST /api/playlists/[id]/tracks — append a track
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
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

  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }
  const track = await db.track.findUnique({ where: { id: trackId } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const existing = await db.playlistTrack.findUnique({
    where: { playlistId_trackId: { playlistId: id, trackId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Track is already in this playlist" }, { status: 409 });
  }

  const last = await db.playlistTrack.findFirst({
    where: { playlistId: id },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? -1) + 1;
  await db.playlistTrack.create({ data: { playlistId: id, trackId, position } });

  const trackCount = await db.playlistTrack.count({ where: { playlistId: id } });
  return NextResponse.json({ ok: true, trackCount });
}

// DELETE /api/playlists/[id]/tracks?trackId=... — remove a track, then re-pack positions
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const trackId = req.nextUrl.searchParams.get("trackId");
  if (!trackId) {
    return NextResponse.json({ error: "trackId query parameter is required" }, { status: 400 });
  }
  const playlist = await db.playlist.findUnique({ where: { id } });
  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  const row = await db.playlistTrack.findUnique({
    where: { playlistId_trackId: { playlistId: id, trackId } },
  });
  if (!row) {
    return NextResponse.json({ error: "Track is not in this playlist" }, { status: 404 });
  }
  await db.playlistTrack.delete({ where: { id: row.id } });

  // re-pack remaining rows so positions are contiguous 0..n-1
  const remaining = await db.playlistTrack.findMany({
    where: { playlistId: id },
    orderBy: { position: "asc" },
  });
  if (remaining.length > 0) {
    await db.$transaction(
      remaining.map((r, index) =>
        db.playlistTrack.update({ where: { id: r.id }, data: { position: index } })
      )
    );
  }
  return NextResponse.json({ ok: true, trackCount: remaining.length });
}

// PATCH /api/playlists/[id]/tracks — reorder (trackIds must be a permutation of current order)
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
  const raw = body.trackIds;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "trackIds must be an array of strings" }, { status: 400 });
  }
  const arr: unknown[] = raw;
  if (arr.some((v) => typeof v !== "string")) {
    return NextResponse.json({ error: "trackIds must be an array of strings" }, { status: 400 });
  }
  const trackIds = arr as string[];

  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  const current = orderedTracks(playlist).map((pt) => pt.trackId);
  const sortedGiven = [...trackIds].sort();
  const sortedCurrent = [...current].sort();
  const isPermutation =
    sortedGiven.length === sortedCurrent.length &&
    sortedGiven.every((v, i) => v === sortedCurrent[i]);
  if (!isPermutation) {
    return NextResponse.json(
      { error: "trackIds must be a permutation of the playlist tracks" },
      { status: 400 }
    );
  }

  const rowIdByTrackId = new Map(playlist.tracks.map((pt) => [pt.trackId, pt.id]));
  const updates = trackIds.flatMap((tid, index) => {
    const rowId = rowIdByTrackId.get(tid);
    return rowId === undefined
      ? []
      : [db.playlistTrack.update({ where: { id: rowId }, data: { position: index } })];
  });
  if (updates.length > 0) {
    await db.$transaction(updates);
  }
  return NextResponse.json({ ok: true });
}
