// Universal playlist text parser.
// Accepts pasted track lists from virtually any music app:
//  - Plain text lines: "Artist - Title", "Title - Artist", "1. Artist – Title (3:45)" ...
//  - JSON exports (Spotify "Export your playlist" JSON, custom JSON dumps)
//  - CSV / TSV exports with or without headers
import type { ImportFormat, ParsedEntry } from "./types";

const MAX_ENTRIES = 250;

function cleanLine(line: string): string {
  let s = line.trim();
  if (!s) return "";
  // markdown bullets / tracklist markers
  s = s.replace(/^[-*•·>\s]+/, "");
  // leading numbering: "1.", "01)", "12 -", "03 –"
  s = s.replace(/^\d{1,3}\s*[.)\]:]\s*/, "");
  s = s.replace(/^\d{1,3}\s*[-–—]\s+/, "");
  // trailing durations: "(3:45)" "- 3:45" "| 3:45" "3:45"
  s = s.replace(/[\s\-–|]+\d{1,2}:\d{2}(\.\d+)?\s*$/, "");
  s = s.replace(/\s*[([]\s*\d{1,2}:\d{2}(\.\d+)?\s*[)\]]\s*$/, "");
  // surrounding quotes
  s = s.replace(/^["'“”«]+|["'“”»]+$/g, "");
  return s.trim();
}

function looksLikeDuration(s: string): boolean {
  return /^\d{1,2}:\d{2}(\.\d+)?$/.test(s.trim());
}

function parseText(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const rawLine of text.split(/\r?\n|\u2028/)) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (looksLikeDuration(line)) continue;
    // skip obvious section headers like "Side A" / "Disc 1" / "Tracklist"
    if (/^(track\s*list|tracklist|side\s*[ab1-9]|disc\s*\d+|playlist|songs?)[:\s]*$/i.test(line)) continue;

    let title = line;
    let artist: string | undefined;

    // split on common separators (em/en dash, " - ", " | ", " — ", " by ")
    const dashRe = /\s+[-–—|]\s+/;
    const m = line.match(dashRe);
    if (m && m.index !== undefined) {
      const left = line.slice(0, m.index).trim();
      const right = line.slice(m.index + m[0].length).trim();
      if (left && right && !looksLikeDuration(left) && !looksLikeDuration(right)) {
        // Convention is "Artist - Title"; but some lists are "Title - Artist".
        // We keep both orders; the matcher will try the swap too.
        title = right;
        artist = left;
      }
    } else {
      const byRe = /\s+by\s+/i;
      const b = line.match(byRe);
      if (b && b.index !== undefined) {
        const left = line.slice(0, b.index).trim();
        const right = line.slice(b.index + b[0].length).trim();
        if (left && right) {
          title = left;
          artist = right;
        }
      }
    }
    // strip embedded "(feat. X)" into artist if artist missing
    if (!artist) {
      const feat = title.match(/\s*[\(\[]\s*(?:feat\.?|featuring|ft\.?)\s+([^\)\]]+)[\)\]]\s*/i);
      if (feat) {
        artist = feat[1].trim();
        title = title.replace(feat[0], "").trim();
      }
    }
    entries.push({ raw: rawLine.trim(), title, artist: artist || undefined });
    if (entries.length >= MAX_ENTRIES) break;
  }
  return entries;
}

function coerceArtist(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v)) {
    const names = v
      .map((a) => {
        if (typeof a === "string") return a;
        if (a && typeof a === "object") {
          const o = a as Record<string, unknown>;
          if (typeof o.name === "string") return o.name;
        }
        return "";
      })
      .filter(Boolean);
    return names.length ? names.join(", ") : undefined;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
  }
  return undefined;
}

const CONTAINER_KEYS = ["items", "tracks", "songs", "results", "data", "audios", "videos", "music", "playlist", "playlists", "album", "albums"];

function entryFromObject(obj: Record<string, unknown>): ParsedEntry | null {
  // Playlist containers like { name: "Road Trip", items: [...] } are NOT tracks
  if (CONTAINER_KEYS.some((k) => Array.isArray(obj[k]))) return null;
  // Spotify export shape: { track: { name, artists: [...] } }
  const track = obj.track;
  if (track && typeof track === "object") {
    const t = track as Record<string, unknown>;
    const title = (t.name ?? t.title) as unknown;
    if (typeof title === "string" && title.trim()) {
      return { raw: title, title: title.trim(), artist: coerceArtist(t.artists ?? t.artist) };
    }
  }
  // Track-like objects carry artist info; bare { name } containers do not.
  const hasArtistHint = "artist" in obj || "artists" in obj || "artistName" in obj || "artist_name" in obj || "channel" in obj;
  const title = obj.title ?? obj.song ?? obj.trackName ?? obj.track_name ?? (hasArtistHint ? obj.name : undefined);
  const artist = obj.artist ?? obj.artists ?? obj.artistName ?? obj.artist_name ?? obj.channel;
  if (typeof title === "string" && title.trim()) {
    return { raw: title, title: title.trim(), artist: coerceArtist(artist) };
  }
  // object keyed by title -> artist, e.g. { "Midnight Cassette": "Neon Harbour" }
  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj[keys[0]] === "string") {
    return { raw: keys[0], title: keys[0], artist: (obj[keys[0]] as string).trim() || undefined };
  }
  return null;
}

function walkJson(node: unknown, out: ParsedEntry[], hint: { name: string | null }) {
  if (out.length >= MAX_ENTRIES) return;
  if (typeof node === "string") {
    const line = cleanLine(node);
    if (line && !looksLikeDuration(line)) out.push({ raw: node, title: line });
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, out, hint);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (!hint.name) {
      const n = obj.name ?? obj.playlistName ?? obj.title;
      if (typeof n === "string" && n.trim() && !entryFromObject(obj)) hint.name = n.trim();
    }
    const entry = entryFromObject(obj);
    if (entry) {
      out.push(entry);
      return;
    }
    // recurse into likely containers
    const containers = ["items", "tracks", "playlist", "songs", "results", "data", "audios", "videos", "music"];
    for (const key of containers) {
      if (key in obj) walkJson(obj[key], out, hint);
    }
    if (out.length === 0) {
      for (const v of Object.values(obj)) walkJson(v, out, hint);
    }
  }
}

function parseJson(text: string): { entries: ParsedEntry[]; nameHint: string | null } {
  const out: ParsedEntry[] = [];
  const hint: { name: string | null } = { name: null };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { entries: [], nameHint: null };
  }
  walkJson(data, out, hint);
  return { entries: out.slice(0, MAX_ENTRIES), nameHint: hint.name };
}

function parseCsv(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delim = (text.split("\n")[0].match(/\t/) ? "\t" : (text.includes(";") && !text.includes(",")) ? ";" : ",");
  const splitRow = (row: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQ && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const rows = lines.map(splitRow).filter((r) => r.some((c) => c));
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const titleIdx = header.findIndex((h) => ["title", "track", "song", "songname", "trackname", "name"].includes(h));
  const artistIdx = header.findIndex((h) => ["artist", "artists", "artistname", "singer", "channel", "albumartist"].includes(h));
  const hasHeader = titleIdx !== -1;
  const tIdx = hasHeader ? titleIdx : 0;
  const aIdx = hasHeader ? artistIdx : artistIdx !== -1 ? artistIdx : 1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const entries: ParsedEntry[] = [];
  for (const row of dataRows) {
    if (row.length < 2 && !hasHeader) {
      const e = parseText(row[0] ?? "");
      entries.push(...e);
      continue;
    }
    const rawTitle = cleanLine(row[tIdx] ?? "");
    if (!rawTitle || looksLikeDuration(rawTitle)) continue;
    const rawArtist = row[aIdx] !== undefined ? cleanLine(row[aIdx]) : "";
    entries.push({ raw: row.join(" - "), title: rawTitle, artist: rawArtist || undefined });
    if (entries.length >= MAX_ENTRIES) break;
  }
  return entries;
}

export function detectFormat(text: string): ImportFormat {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      JSON.parse(t);
      return "json";
    } catch {
      /* fall through */
    }
  }
  const firstLines = t.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  const commaish = firstLines.filter((l) => /[\t;]/.test(l) || (l.split(",").length >= 2 && !/\s[-–—]\s/.test(l)));
  if (firstLines.length > 0 && commaish.length === firstLines.length) return "csv";
  return "text";
}

export function parseImportText(text: string): {
  format: ImportFormat;
  entries: ParsedEntry[];
  nameHint: string | null;
} {
  const format = detectFormat(text);
  if (format === "json") {
    const { entries, nameHint } = parseJson(text);
    if (entries.length) return { format, entries, nameHint };
    // broken json — fall back to line parsing
    return { format: "text", entries: parseText(text), nameHint: null };
  }
  if (format === "csv") {
    const entries = parseCsv(text);
    if (entries.length) return { format, entries, nameHint: null };
    return { format: "text", entries: parseText(text), nameHint: null };
  }
  return { format: "text", entries: parseText(text), nameHint: null };
}
