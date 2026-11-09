# Task 3 — Frontend integration for real Audius catalog

Agent: frontend-integration (Z.ai Code)
Date: task session, backend already live (814+ real Audius tracks)

## Summary
Wired the Walkman frontend to the real-song backend: remote-safe cover rendering, genre browsing pages, network trending/fresh sections, and a manual "Sync new songs" control. No backend files touched.

## Files created
- `src/components/walkman/GenreView.tsx` — new genre page: back button, rounded-xl hero card (genre cover as background art via CoverArt + dark gradient overlay), title + "{N} real songs · streamed at 320 kbps HQ" subtitle, amber "Play all" pill (`playQueue(tracks, 0, name)`), TrackRow list in `max-h-[60vh] overflow-y-auto thin-scrollbar`, skeleton loading (h-14) and empty state. Tracks fetched with `useTracks("", name, true, "trending")`; hero cover from `useGenres()` lookup with first-track fallback.

## Files modified
- `src/components/walkman/CoverArt.tsx` — replaced `next/image` with plain `<img>` (remote Audius CDN URLs need no remotePatterns); kept identical component API (`sizes` kept for compat, `priority` now maps to `loading` eager/lazy); added `referrerPolicy="no-referrer"`, `decoding="async"`, `loading="lazy"` default; fallback gradient + Music2 on `!src`/`onError` unchanged; positioning now `absolute inset-0 size-full object-cover` merged with caller className (compatible with relative parents + `size-full` callers).
- `src/lib/player.ts` — `updateMediaSession` now builds absolute artwork URL via `new URL(track.cover, window.location.origin).href` inside try/catch; type uses `track.cover.toLowerCase().endsWith(".png")`.
- `src/lib/api.ts` — added `qk.genres`, `qk.syncStatus`; exported `TrackSort`, `SyncStatus`; `useTracks(q, genre, enabled, sort = "catalog", limit?)` appends `sort`/`limit` to query string and query key; added `useGenres()` (staleTime 5 min), `useSyncStatus()`, `useSyncNow()` (POST /api/sync; invalidates `["tracks"]` prefix + genres/playlists/likes/syncStatus).
- `src/lib/ui-store.ts` — `View` union extended with `{ type: "genre"; name: string }`.
- `src/components/walkman/WalkmanApp.tsx` — imports + renders `<GenreView name={view.name} />` for `view.type === "genre"`.
- `src/components/walkman/HomeView.tsx` — Trending now uses `useTracks("", "", true, "trending", 12)` with subtitle "Real plays from the Audius network — auto-synced"; new "Fresh finds" SectionRow (`useTracks(..., "newest", 12)`, subtitle "New songs auto-added to your catalog"); "Browse by mood" now uses `useGenres()` (top 10 by count) with count chips, clicking navigates to `{ type: "genre", name }`; hero copy → "Free · 320 kbps HQ · Real artists" + h2/description mentioning daily auto-added songs and import; removed old shuffle/derived-genre logic and the all-catalog fetch.
- `src/components/walkman/SearchView.tsx` — "Browse all" tiles now from `useGenres()` (name/cover/count passed), removed local genre derivation + `useTracks()` all-catalog call; tile click still `setGenre(g.name)`.
- `src/components/walkman/Sidebar.tsx` — added "Sync new songs" full-width pill button above the footer status line (RefreshCw icon, `animate-spin` while pending, min-h-[44px], aria-label); success toast `+{added} new songs · {total} in catalog`, error toast on failure; tiny "updated {relative time}" line when `syncStatus.lastSyncAt` exists (manual formatting helper); footer text → "320 kbps HQ streaming · 100% free".
- `src/components/walkman/MediaCard.tsx` — `GenreTile` gained optional `count?: number` rendered as a small `{count} songs` chip (`bg-black/30`, white text) under the genre name; other exports untouched.
- `src/components/walkman/ImportModal.tsx` — entries with `entry.source === "audius"` now show a tiny amber chip "matched on network" (title "Added to your catalog") next to the confidence badge; hidden below `sm` like the confidence badge; everything else identical.

## Verification
- `bun run lint` → clean (0 errors, 0 warnings; removed an initially-added but unused eslint-disable directive).
- `curl /api/genres` → 200 with real genre names/counts/remote covers; `/api/tracks?sort=trending&limit=3` → 200.
- `dev.log` → "○ Compiling / ... GET / 200" with no compile errors.
- Browser verification intentionally left to the user (per task instructions).
