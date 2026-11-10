// One-time genre hygiene pass for the expanded industry catalog.
// Run with: bun scripts/rebucket.ts
//  · removes non-music rows (podcasts / audiobooks / spoken word)
//  · folds junk genre labels into clean buckets
//  · re-buckets the desi scene (Bollywood / devotional) from Audius search seeds

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APP_NAME = "Walkman";

async function audiusSearch(query: string, limit = 60) {
  const host = "https://discoveryprovider.audius.co";
  const res = await fetch(
    `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=${APP_NAME}`,
    { signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json" } }
  );
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: Array<{ id: string }> };
  return (j.data ?? []).map((t) => t.id).filter(Boolean);
}

const FOLD: Array<[string[], string]> = [
  [["Podcasts", "Audiobooks", "Spoken Word", "Kids"], "DELETE"],
  [["Jersey Club", "Moombahton", "Footwork", "Breakcore", "Chiptune", "Edit Pack", "Dance"], "Electronic"],
  [["Spanishdrill", "Spanish Drill"], "Hip-Hop"],
  [["Half Time"], "Dubstep"],
  [["Uptempo"], "Hardstyle"],
  [["Melodic Psy Tech"], "Trance"],
  [["Afro Beat"], "World"],
  [["_140", "Sn_somegenre", "Various", "Edit", "Ai Generated", "Sn_Somegenre"], "Other"],
];

async function main() {
  console.log("— removing non-music rows —");
  const del = await db.track.deleteMany({
    where: { genre: { in: ["Podcasts", "Audiobooks", "Spoken Word"] } },
  });
  console.log(`  deleted ${del.count}`);

  console.log("— folding junk genres —");
  for (const [names, target] of FOLD) {
    if (target === "DELETE") continue;
    const r = await db.track.updateMany({ where: { genre: { in: names } }, data: { genre: target } });
    if (r.count) console.log(`  ${names.join(", ")} → ${target} (${r.count})`);
  }

  console.log("— re-bucketing the desi scene from search seeds —");
  const desiSeeds: Array<[string, string]> = [
    ["bollywood", "Bollywood"],
    ["hindi songs", "Bollywood"],
    ["punjabi songs", "Bollywood"],
    ["bhangra", "Bollywood"],
    ["bhajan", "Devotional & Gospel"],
    ["kirtan", "Devotional & Gospel"],
    ["qawwali", "Devotional & Gospel"],
    ["sufi songs", "Devotional & Gospel"],
  ];
  for (const [seed, bucket] of desiSeeds) {
    const ids = await audiusSearch(seed);
    if (!ids.length) {
      console.log(`  "${seed}" → no results`);
      continue;
    }
    const r = await db.track.updateMany({ where: { audiusId: { in: ids } }, data: { genre: bucket } });
    console.log(`  "${seed}" → ${bucket} (${r.count} rows)`);
  }

  const total = await db.track.count();
  const grouped = await db.track.groupBy({ by: ["genre"], _count: { genre: true } });
  console.log(`— done · ${total} tracks · ${grouped.length} genres —`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
