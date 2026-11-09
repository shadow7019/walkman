import { NextRequest, NextResponse } from "next/server";
import { scoreSearchQuery } from "@/lib/fuzzy";
import { db } from "@/lib/db";
import { trackDTO } from "@/lib/serialize";
import type { Track } from "@/lib/types";

// GET /api/tracks?q=&genre=&ids=id1,id2
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const idsParam = searchParams.get("ids");
  const genreParam = searchParams.get("genre");
  const qParam = searchParams.get("q") ?? "";

  // ids mode: return the requested tracks re-ordered to match the ids order
  if (idsParam !== null) {
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const rows = await db.track.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const tracks = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [trackDTO(row)] : [];
    });
    return NextResponse.json({ tracks });
  }

  const rows = await db.track.findMany({ orderBy: [{ trackNo: "asc" }] });
  let tracks: Track[] = rows.map(trackDTO);

  // genre filter: case-insensitive exact match
  const genre = genreParam?.trim().toLowerCase() ?? "";
  if (genre) {
    tracks = tracks.filter((t) => t.genre.toLowerCase() === genre);
  }

  // fuzzy free-text search
  const q = qParam.trim();
  if (q) {
    tracks = tracks
      .map((t) => ({ track: t, score: scoreSearchQuery(q, t) }))
      .filter((entry) => entry.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((entry) => entry.track);
  }

  return NextResponse.json({ tracks });
}
