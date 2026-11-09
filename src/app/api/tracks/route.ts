import { NextRequest, NextResponse } from "next/server";
import { scoreSearchQuery } from "@/lib/fuzzy";
import { db } from "@/lib/db";
import { trackDTO } from "@/lib/serialize";
import { ensureFreshCatalog } from "@/lib/audius";
import type { Track } from "@/lib/types";

// GET /api/tracks?q=&genre=&sort=catalog|trending|newest&limit=&ids=id1,id2
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const idsParam = searchParams.get("ids");
  const genreParam = searchParams.get("genre");
  const qParam = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "catalog";
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : null;

  // auto-add new songs: deep-sweep when the catalog is small, refresh stale charts in background
  void ensureFreshCatalog().catch(() => undefined);

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

  const orderBy =
    sort === "trending"
      ? [{ playCount: "desc" as const }, { favoriteCount: "desc" as const }, { trackNo: "asc" as const }]
      : sort === "newest"
        ? [{ createdAt: "desc" as const }, { trackNo: "asc" as const }]
        : [{ trackNo: "asc" as const }];

  const q = qParam.trim();
  const genreExact = genreParam?.trim() ?? "";

  // free-text search needs the whole candidate pool; otherwise filter + limit in SQL
  const where = !q && genreExact ? { genre: genreExact } : undefined;
  const take = !q && limit !== null ? limit : undefined;
  let rows = await db.track.findMany({ where, orderBy, take });

  // safety net: exact genre match found nothing → fall back to case-insensitive scan
  if (!q && genreExact && rows.length === 0) {
    rows = await db.track.findMany({ orderBy });
    rows = rows.filter((t) => t.genre.toLowerCase() === genreExact.toLowerCase());
    if (limit !== null) rows = rows.slice(0, limit);
  }

  let tracks: Track[];

  if (q) {
    // fuzzy free-text search — score raw rows, map only the winners to DTOs
    tracks = rows
      .filter((t) => !genreExact || t.genre.toLowerCase() === genreExact.toLowerCase())
      .map((t) => ({ row: t, score: scoreSearchQuery(q, t) }))
      .filter((entry) => entry.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((entry) => trackDTO(entry.row));
  } else {
    tracks = rows.map(trackDTO);
  }

  return NextResponse.json({ tracks });
}
