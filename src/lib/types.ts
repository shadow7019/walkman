// Shared types between server and client for Walkman

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number;
  durationSec: number;
  cover: string;
  audioFile: string;
  qualityTier: string;
  bitrateKbps: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  gradient: string;
  importedFrom: string | null;
  trackCount: number;
  covers: string[]; // up to 4 track covers for mosaic
}

export interface PlaylistDetail extends Omit<PlaylistSummary, "trackCount" | "covers"> {
  createdAt: string;
  updatedAt: string;
  trackCount: number;
  covers: string[];
  totalDurationSec: number;
  tracks: Track[];
}

export type ImportFormat = "json" | "csv" | "text";

export interface ParsedEntry {
  raw: string;
  title: string;
  artist?: string;
}

export interface ImportEntry {
  raw: string;
  title: string;
  artist?: string;
  bestMatch: Track | null;
  confidence: number;
  suggestions: Track[];
  swapped: boolean; // true if artist/title order was swapped for the best match
}

export interface ImportPreview {
  format: ImportFormat;
  playlistNameHint: string | null;
  entries: ImportEntry[];
  stats: { total: number; matched: number };
}

export type QualityId = "low" | "normal" | "high" | "lossless";

export interface QualityOption {
  id: QualityId;
  label: string;
  detail: string;
  badge: string;
}

export const QUALITY_OPTIONS: QualityOption[] = [
  { id: "low", label: "Data saver", detail: "96 kbps AAC — light on bandwidth", badge: "96" },
  { id: "normal", label: "Normal", detail: "160 kbps AAC — balanced quality", badge: "160" },
  { id: "high", label: "High", detail: "320 kbps MP3 — crisp detail", badge: "320" },
  { id: "lossless", label: "Lossless", detail: "16-bit / 44.1 kHz FLAC-class — maximum fidelity", badge: "MAX" },
];

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTotalDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0 min";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${Math.max(1, m)} min`;
}
