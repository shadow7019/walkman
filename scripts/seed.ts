// Walkman seed script — run with: bun scripts/seed.ts
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import path from "path";

const db = new PrismaClient();

const durationsPath = path.join(process.cwd(), "data", "durations.json");
const fallbackDurations: Record<string, number> = {
  "SoundHelix-Song-1.mp3": 373,
  "SoundHelix-Song-2.mp3": 426,
  "SoundHelix-Song-3.mp3": 344,
  "SoundHelix-Song-4.mp3": 303,
  "SoundHelix-Song-5.mp3": 354,
  "SoundHelix-Song-6.mp3": 280,
  "SoundHelix-Song-7.mp3": 421,
  "SoundHelix-Song-8.mp3": 325,
  "SoundHelix-Song-9.mp3": 389,
  "SoundHelix-Song-10.mp3": 527,
  "SoundHelix-Song-11.mp3": 551,
  "SoundHelix-Song-12.mp3": 514,
  "SoundHelix-Song-13.mp3": 470,
  "SoundHelix-Song-14.mp3": 516,
  "SoundHelix-Song-15.mp3": 438,
  "SoundHelix-Song-16.mp3": 483,
};

const durations = existsSync(durationsPath)
  ? { ...fallbackDurations, ...(JSON.parse(readFileSync(durationsPath, "utf8")) as Record<string, number>) }
  : fallbackDurations;

interface SeedTrack {
  file: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number;
  cover: string;
}

const SEED_TRACKS: SeedTrack[] = [
  { file: "SoundHelix-Song-1.mp3", title: "Midnight Cassette", artist: "Neon Harbour", album: "Chrome City", genre: "Synthwave", year: 2024, cover: "/covers/chrome-city.jpg" },
  { file: "SoundHelix-Song-2.mp3", title: "Chrome Horizon", artist: "Neon Harbour", album: "Chrome City", genre: "Synthwave", year: 2024, cover: "/covers/chrome-city.jpg" },
  { file: "SoundHelix-Song-3.mp3", title: "Velvet Static", artist: "Cassette Club", album: "Analog Heart", genre: "Indie Electronic", year: 2023, cover: "/covers/analog-heart.jpg" },
  { file: "SoundHelix-Song-4.mp3", title: "Heart on Hold", artist: "Cassette Club", album: "Analog Heart", genre: "Indie Electronic", year: 2023, cover: "/covers/analog-heart.jpg" },
  { file: "SoundHelix-Song-5.mp3", title: "Golden Hour Radio", artist: "The Midnight Tapes", album: "Rewind Season", genre: "Retro Soul", year: 2022, cover: "/covers/rewind-season.jpg" },
  { file: "SoundHelix-Song-6.mp3", title: "Slow Dance, Fast Forward", artist: "The Midnight Tapes", album: "Rewind Season", genre: "Retro Soul", year: 2022, cover: "/covers/rewind-season.jpg" },
  { file: "SoundHelix-Song-7.mp3", title: "Paper Skies", artist: "Aria Vale", album: "Paper Skies", genre: "Dream Pop", year: 2024, cover: "/covers/paper-skies.jpg" },
  { file: "SoundHelix-Song-8.mp3", title: "Gravity Feels Light", artist: "Aria Vale", album: "Paper Skies", genre: "Dream Pop", year: 2024, cover: "/covers/paper-skies.jpg" },
  { file: "SoundHelix-Song-9.mp3", title: "Night Bus Home", artist: "Lo-Fi District", album: "Night Bus Home", genre: "Lo-Fi", year: 2023, cover: "/covers/night-bus-home.jpg" },
  { file: "SoundHelix-Song-10.mp3", title: "Rain on the Window", artist: "Lo-Fi District", album: "Night Bus Home", genre: "Lo-Fi", year: 2023, cover: "/covers/night-bus-home.jpg" },
  { file: "SoundHelix-Song-11.mp3", title: "Solar Bloom", artist: "Solar Kin", album: "Solar Bloom", genre: "Electronic", year: 2024, cover: "/covers/solar-bloom.jpg" },
  { file: "SoundHelix-Song-12.mp3", title: "Circle of Light", artist: "Solar Kin", album: "Solar Bloom", genre: "Electronic", year: 2024, cover: "/covers/solar-bloom.jpg" },
  { file: "SoundHelix-Song-13.mp3", title: "Echo Parade", artist: "Echo Parade", album: "Echo Parade", genre: "Alt Rock", year: 2022, cover: "/covers/echo-parade.jpg" },
  { file: "SoundHelix-Song-14.mp3", title: "Wires & Wonders", artist: "Echo Parade", album: "Echo Parade", genre: "Alt Rock", year: 2022, cover: "/covers/echo-parade.jpg" },
  { file: "SoundHelix-Song-15.mp3", title: "Static Bloom", artist: "Mira Sound", album: "Static Bloom", genre: "Pop", year: 2025, cover: "/covers/static-bloom.jpg" },
  { file: "SoundHelix-Song-16.mp3", title: "Copper Wires", artist: "Neon Harbour", album: "Copper Wires", genre: "Synthwave", year: 2025, cover: "/covers/copper-wires.jpg" },
];

const PLAYLISTS: Array<{
  name: string;
  description: string;
  gradient: string;
  titles: string[];
}> = [
  {
    name: "Neon Nights",
    description: "Synth-soaked drives after dark. Roll the windows down.",
    gradient: "from-amber-400 to-orange-600",
    titles: ["Midnight Cassette", "Chrome Horizon", "Copper Wires", "Solar Bloom", "Echo Parade"],
  },
  {
    name: "Deep Focus",
    description: "Soft loops and quiet textures for deep work sessions.",
    gradient: "from-teal-400 to-emerald-700",
    titles: ["Night Bus Home", "Rain on the Window", "Paper Skies", "Velvet Static", "Circle of Light"],
  },
  {
    name: "Golden Hour",
    description: "Warm light, warm sound. For the slow part of the day.",
    gradient: "from-rose-500 to-orange-700",
    titles: ["Golden Hour Radio", "Gravity Feels Light", "Static Bloom", "Heart on Hold", "Chrome Horizon"],
  },
  {
    name: "Rainy Day Rewind",
    description: "Nostalgic cuts for grey skies and long windows.",
    gradient: "from-violet-500 to-fuchsia-700",
    titles: ["Rain on the Window", "Velvet Static", "Slow Dance, Fast Forward", "Night Bus Home", "Wires & Wonders"],
  },
  {
    name: "Walkman Mix Vol. 1",
    description: "The all-tape, no-skips starter mix. A bit of everything.",
    gradient: "from-lime-400 to-teal-600",
    titles: [
      "Midnight Cassette",
      "Golden Hour Radio",
      "Night Bus Home",
      "Echo Parade",
      "Velvet Static",
      "Paper Skies",
      "Solar Bloom",
      "Static Bloom",
      "Chrome Horizon",
      "Slow Dance, Fast Forward",
      "Rain on the Window",
      "Wires & Wonders",
    ],
  },
];

const LIKED_TITLES = ["Midnight Cassette", "Golden Hour Radio", "Night Bus Home", "Paper Skies", "Solar Bloom", "Static Bloom"];

async function main() {
  console.log("Wiping existing data…");
  await db.playHistory.deleteMany();
  await db.playlistTrack.deleteMany();
  await db.like.deleteMany();
  await db.playlist.deleteMany();
  await db.track.deleteMany();

  console.log("Inserting tracks…");
  const audioDir = path.join(process.cwd(), "public", "audio");
  const inserted: { id: string; title: string }[] = [];
  let trackNo = 1;
  for (const t of SEED_TRACKS) {
    const filePath = path.join(audioDir, t.file);
    if (!existsSync(filePath)) {
      console.warn(`Skipping "${t.title}" — missing audio file ${t.file}`);
      continue;
    }
    const row = await db.track.create({
      data: {
        title: t.title,
        artist: t.artist,
        album: t.album,
        genre: t.genre,
        year: t.year,
        durationSec: durations[t.file] ?? 300,
        cover: t.cover,
        audioFile: `/audio/${t.file}`,
        qualityTier: "LOSSLESS",
        bitrateKbps: 320,
        trackNo: trackNo++,
      },
    });
    inserted.push({ id: row.id, title: row.title });
  }
  console.log(`Inserted ${inserted.length} tracks.`);

  console.log("Creating playlists…");
  for (const p of PLAYLISTS) {
    const trackIds = p.titles
      .map((title) => inserted.find((t) => t.title === title)?.id)
      .filter((id): id is string => Boolean(id));
    await db.playlist.create({
      data: {
        name: p.name,
        description: p.description,
        gradient: p.gradient,
        tracks: {
          create: trackIds.map((trackId, i) => ({ trackId, position: i })),
        },
      },
    });
  }

  console.log("Seeding likes & play history…");
  for (const title of LIKED_TITLES) {
    const t = inserted.find((x) => x.title === title);
    if (t) await db.like.create({ data: { trackId: t.id } });
  }

  const historyData: { trackId: string; playedAt: Date }[] = [];
  for (let i = 0; i < 48; i++) {
    const t = inserted[Math.floor(Math.random() * inserted.length)];
    if (!t) continue;
    const hoursAgo = Math.floor(Math.random() * 240); // spread over last 10 days
    historyData.push({ trackId: t.id, playedAt: new Date(Date.now() - hoursAgo * 3600_000 - Math.random() * 3600_000) });
  }
  historyData.sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  await db.playHistory.createMany({ data: historyData });

  console.log("Seed complete ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
