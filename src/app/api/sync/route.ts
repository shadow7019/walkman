import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCatalog, getLastSyncAt } from "@/lib/audius";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sync — catalog status (totals + last auto-sync time)
export async function GET() {
  const [total, genreCount, lastSyncAt] = await Promise.all([
    db.track.count(),
    db.track.groupBy({ by: ["genre"], _count: { genre: true } }),
    getLastSyncAt(),
  ]);
  return NextResponse.json({
    total,
    genreCount: genreCount.length,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
  });
}

// POST /api/sync — pull the newest trending songs from the Audius network now
export async function POST() {
  try {
    const stats = await syncCatalog();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[api/sync] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}
