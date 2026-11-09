import type { Playlist, PlaylistTrack, Track as TrackRow } from "@prisma/client";
import type { PlaylistDetail, PlaylistSummary, Track } from "./types";

export function trackDTO(t: TrackRow): Track {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    genre: t.genre,
    year: t.year,
    durationSec: t.durationSec,
    cover: t.cover,
    audioFile: t.audioFile,
    qualityTier: t.qualityTier,
    bitrateKbps: t.bitrateKbps,
  };
}

export type PlaylistWithTracks = Playlist & { tracks: (PlaylistTrack & { track: TrackRow })[] };

export function orderedTracks(p: PlaylistWithTracks): (PlaylistTrack & { track: TrackRow })[] {
  return [...p.tracks].sort((a, b) => a.position - b.position);
}

export function playlistSummary(p: PlaylistWithTracks): PlaylistSummary {
  const ordered = orderedTracks(p);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    gradient: p.gradient,
    importedFrom: p.importedFrom,
    trackCount: ordered.length,
    covers: ordered.slice(0, 4).map((pt) => pt.track.cover),
  };
}

export function playlistDetail(p: PlaylistWithTracks): PlaylistDetail {
  const ordered = orderedTracks(p);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    gradient: p.gradient,
    importedFrom: p.importedFrom,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    trackCount: ordered.length,
    covers: ordered.slice(0, 4).map((pt) => pt.track.cover),
    totalDurationSec: ordered.reduce((acc, pt) => acc + pt.track.durationSec, 0),
    tracks: ordered.map((pt) => trackDTO(pt.track)),
  };
}
