import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCatalog, deepSyncCatalog, getLastSyncAt, getSyncState, type SyncMode } from "@/lib/audius";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // deep industry sweeps can run for a few minutes

// GET /api/sync — catalog status (totals + last auto-sync time + live progress)
export async function GET() {
  const [total, genreCount, lastSyncAt, live] = await Promise.all([
    db.track.count(),
    db.track.groupBy({ by: ["genre"], _count: { genre: true } }),
    getLastSyncAt(),
    Promise.resolve(getSyncState()),
  ]);
  return NextResponse.json({
    total,
    genreCount: genreCount.length,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    running: live.running,
    mode: live.mode,
    addedThisRun: live.added,
    fetchedThisRun: live.fetched,
  });
}

// POST /api/sync — pull new music from the Audius network now.
// Body { mode: "deep" } runs the full industry sweep (44 genres + 160 search
// seeds); default "quick" refreshes today's charts for every genre.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode: SyncMode = body.mode === "deep" ? "deep" : "quick";
  try {
    const stats = mode === "deep" ? await deepSyncCatalog() : await syncCatalog();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[api/sync] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}
