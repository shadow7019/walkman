import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { db } from "@/lib/db";
import { resolveAudiusStream } from "@/lib/audius";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const track = await db.track.findUnique({ where: { id } });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  // Remote tracks (Audius network): resolve a signed CDN URL and 302 the player to it.
  if (track.source === "audius" && track.audiusId) {
    const cdnUrl = await resolveAudiusStream(track.audiusId);
    if (cdnUrl) {
      return NextResponse.redirect(cdnUrl, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({ error: "Stream unavailable" }, { status: 502 });
  }

  // Local tracks: serve from /public with Range support.
  const filePath = path.join(process.cwd(), "public", track.audioFile);
  if (!existsSync(filePath)) return NextResponse.json({ error: "Audio file missing" }, { status: 404 });
  const total = statSync(filePath).size;
  const range = req.headers.get("range");

  const baseHeaders: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (Number.isNaN(start) || start < 0) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const headers = new Headers(baseHeaders);
      headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
      headers.set("Content-Length", String(end - start + 1));
      const stream = createReadStream(filePath, { start, end });
      return new NextResponse(Readable.toWeb(stream) as unknown as BodyInit, { status: 206, headers });
    }
  }
  const headers = new Headers(baseHeaders);
  headers.set("Content-Length", String(total));
  const stream = createReadStream(filePath);
  return new NextResponse(Readable.toWeb(stream) as unknown as BodyInit, { status: 200, headers });
}
