import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureFreshCatalog } from "@/lib/audius";
import type { GenreInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/genres — genre buckets with track counts + a representative cover
export async function GET() {
  void ensureFreshCatalog().catch(() => undefined);

  const grouped = await db.track.groupBy({ by: ["genre"], _count: { genre: true } });

  const genres: GenreInfo[] = await Promise.all(
    grouped.map(async (g) => {
      const sample = await db.track.findFirst({
        where: { genre: g.genre, cover: { not: "" } },
        orderBy: [{ playCount: "desc" }],
        select: { cover: true },
      });
      return { name: g.genre, count: g._count.genre, cover: sample?.cover ?? "" };
    })
  );

  genres.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return NextResponse.json({ genres });
}
