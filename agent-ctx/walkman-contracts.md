# Walkman — Frontend Contracts (for view subagents)

Walkman is a free Spotify-style music app (Next.js 16 App Router, TS, Tailwind 4, shadcn/ui). Single route `/` with client-side view switching. Dark theme, emerald accent (#34d399). **NO indigo/blue colors.**

## Stores (all exist — do NOT modify)

### `usePlayer` from `@/stores/player`
State: `queue: Track[]`, `queueIndex`, `contextTitle: string`, `isPlaying`, `position: number` (sec), `duration` (sec), `volume 0-1`, `muted`, `shuffle`, `repeat: 'off'|'all'|'one'`, `speed`, `crossfadeSec`, `autoplay`, `sleepAt: number|null`.
Actions: `playQueue(tracks: Track[], index: number, contextTitle?: string)` — **start playback of a list**; `playNext(t)`, `addToQueue(t)`, `playTrackAt(i)`, `playPause()`, `next()`, `prev()`, `seek(sec)`, `setVolume(v)`, `toggleMute()`, `toggleShuffle()`, `cycleRepeat()`, `setSpeed(s)`, `startSleepTimer(min|0)`.
Current track = `queue[queueIndex]`.

### `useLibrary` from `@/stores/library`
State: `playlists: PlaylistSummary[]`, `liked: Track[]`, `likedIds: Set<string>`, `history: Track[]`.
Actions: `loadAll()`, `refreshPlaylists()`, `refreshLiked()`, `refreshHistory()`, `toggleLike(trackId)`, `isLiked(id)`, `createPlaylist(name) => {id,name}|null`.

### `useUI` from `@/stores/ui`
State: `view: View`, `rightPanel: 'none'|'queue'|'lyrics'`, `fullscreen`, `searchQuery`, `recentSearches: string[]`, `toasts`, `addTrackDialogFor`.
Actions: `navigate({name:'home'} etc)`, `back()`, `setRightPanel`, `toggleQueue()`, `toggleLyrics()`, `setFullscreen(b)`, `setSearchQuery(q)`, `addRecentSearch(q)`, `toast(text)`.

## API client: `api` from `@/lib/client-api`
- `api.tracks({genre?, mood?, q?, sort?: 'recent'|'plays'|'title'|'artist'|'random', limit?, offset?, hasFull?: '1', source?}) => {tracks: Track[], total}`
- `api.search(q, extend=true) => {tracks, extended, local}` — searches DB + auto-extends catalog from industry sources
- `api.genres() => {genres: GenreInfo[], total, fullLength}` — GenreInfo `{name,color,count}`
- `api.explore() => {moods:{name,count}[], trending, newReleases, underground, playlists}`
- `api.playlists()`, `api.playlist(id) => {playlist:{id,name,description,gradient,importedFrom,isSystem}, tracks}`, `api.createPlaylist(name)`, `api.renamePlaylist(id,name,desc?)`, `api.deletePlaylist(id)`, `api.addToPlaylist(id,trackId)`, `api.removeFromPlaylist(id,trackId)`
- `api.liked()`, `api.toggleLike(id)`, `api.history()`, `api.recordPlay(...)`
- `api.stats(period:'week'|'month'|'year'|'all') => ReplayStats` — `{minutes, plays, uniqueTracks, streak, topSongs:{track,plays,ms}[], topArtists:{name,plays,ms}[], topAlbums:{name,plays,ms}[], hourOfDay: number[24] (ms), activity:{day,ms,plays}[28]}`
- `api.syncStatus() => {logs, total, lastSyncedAt}`, `api.runSync() => {added, updated, total}`
- `api.radio(seedTrackId) => {seed, tracks}`
- `api.importSpotify(url)`, `api.importText(text, order)`, `api.importCSV(text) => ImportResult {ok, playlistId, name, total, matched, notFound:string[], skippedOverflow, error?}`
- `api.downloadUrl(trackId)` — direct <a href> download.

## Shared components (exist — reuse, do NOT modify)
- `Cover` from `@/components/cover` — `<Cover src alt className rounded? />` artwork w/ fallback.
- `TrackList` from `@/components/track-list` — `<TrackList tracks={Track[]} contextTitle="..." showAlbum? showIndex? onPlayIndex?(i) />` — full row UI (play/like/menu/download/radio). Use for ALL track tables.
- `SectionRow` from `@/components/track-list` — horizontal scroll wrapper for cards: `<SectionRow ariaLabel="...">{cards}</SectionRow>`.
- `EqBars` from `@/components/track-list` — playing indicator.
- shadcn/ui available in `@/components/ui/*`: button, slider, dialog, tabs, dropdown-menu, input, textarea, switch, select, badge, progress, scroll-area, skeleton, separator, etc.

## Types (`@/types`)
`Track {id,title,artist,album,genre,rawGenre,mood,year,durationMs,cover,source,sourceId,hasFull,qualityTier,bitrateKbps,explicit,playCount,favoriteCount,permalink}`
Helpers: `fmtTime(ms)`, `fmtMinutes(ms)`, `fmtNum(n)`.
`View = {name:'home'|'search'|'explore'|'genre'(genre)|'mood'(mood)|'playlist'(id)|'liked'|'history'|'replay'|'import'|'settings'|'rooms'|'artist'(artistName)}`

## View components to CREATE (exact exports & files)

### Subagent A files:
1. `src/components/views/home-view.tsx` → `export function HomeView()`
   - Greeting by time of day. Rows: **Jump back in** (`library.history` top 12), **New for you** (`api.tracks({sort:'recent',limit:14})` — auto-added new songs), **Trending — full-length** (`api.tracks({hasFull:'1', sort:'plays', limit:14})`), genre chips linking to genre view, playlists row.
   - Quick-pick grid (6 tiles: Liked Songs, a few genres, one playlist) Spotify-style.
   - Card: cover (Cover component) + title + subtitle; whole card clickable; play button overlay on hover calling `playQueue(rowTracks, idx, rowTitle)`.
2. `src/components/views/search-view.tsx` → `export function SearchView()`
   - Reads `searchQuery` from useUI. Empty state: recent searches (click to re-search) + "Browse all" genre tiles (`api.genres()`, color gradient tiles).
   - Results: debounced `api.search(q)`; show top-result hero card (biggest track: big cover, play button) + "Songs" TrackList (10) + rest grid. Show "Extended catalog: +N songs added" badge when `extended>0`. Also artist chips row (unique artists of results → navigate artist view).
3. `src/components/views/explore-view.tsx` → exports `ExploreView`, `GenreView({genre}: {genre:string})`, `MoodView({mood}: {mood:string})`, `ArtistView({artistName}: {artistName:string})`
   - ExploreView: mood chips row (api.explore().moods → navigate mood), trending row (full-length), new releases row, underground row, genre grid with gradient tiles (GENRE_COLORS-like classes already in GenreInfo.color e.g. "from-pink-500 to-rose-600" — apply `bg-gradient-to-br ${color}`).
   - GenreView: hero header with gradient by genre, play-all button (`playQueue(tracks,0,genre)`), TrackList of genre tracks (`api.tracks({genre, limit:100, sort:'plays'})`), auto-trigger one background fetch `fetch('/api/sync')`? NO — instead if tracks.length < 10 show "Exploring the industry catalog…" and call `api.search(genre)` once to extend, then refetch.
   - MoodView: same pattern with `api.tracks({mood})`.
   - ArtistView: `api.tracks({q: artistName, limit:60})` filtered client-side to exact-ish artist matches (`t.artist.toLowerCase().includes(artistName.toLowerCase())` OR `artistName.includes(t.artist)`), hero with name, Play, TrackList "Popular".

### Subagent B files:
1. `src/components/views/playlist-view.tsx` → exports `PlaylistView({id}: {id:string})`, `LikedView()`, `HistoryView()`
   - PlaylistView: fetch `api.playlist(id)`; hero (gradient `playlist.gradient`, name, description, trackCount, importedFrom badge); Play button → `playQueue(tracks,0,name)`; Shuffle → play random index; editable name (inline dialog via shadcn Dialog); delete playlist (confirm) → `api.deletePlaylist` then `navigate({name:'home'})` + `refreshPlaylists()`; remove-track per-row menu (small X button overlay on hover row that calls removeFromPlaylist then reload); export menu: "Export .m3u8" and "Export JSON" (generate blob client-side and download).
   - LikedView: hero "Liked Songs" + count + play/shuffle (library.liked), TrackList(library.liked).
   - HistoryView: TrackList(library.history), contextTitle "History".
2. `src/components/views/replay-view.tsx` → `export function ReplayView()`
   - Tabs: This month / Last month? NO — periods: 'month' (This month), 'year', 'all' (All time), 'week' (This week). `api.stats(period)`.
   - Stat tiles: Minutes listened, Plays, Unique songs, Streak (days).
   - Top songs list (1-10 with covers, plays count), top artists row, top albums row.
   - Hour-of-day bar chart (24 bars; height = hourOfDay[i] relative; label peak hour).
   - Activity chart last 28 days (small bars). Build with plain divs (no chart lib needed).
3. `src/components/views/import-view.tsx` → `export function ImportView()`
   - Three tabs (shadcn Tabs): **Spotify link** (input + button → `api.importSpotify`), **Text list** (textarea, "Artist - Title" per line, order toggle artist-first/title-first → `api.importText`), **CSV** (textarea or file input reading text → `api.importCSV`).
   - While importing: progress state ("Matching 24/100 songs…"). Result card: matched/total, list of notFound lines, "Open playlist" button → navigate playlist view + refreshPlaylists.
   - Info note: "Imports work with public Spotify playlists, Exportify/TuneMyMusic CSV exports, and any 'Artist - Title' text list — no sign-in needed."
4. `src/components/views/settings-view.tsx` → `export function SettingsView()`
   - Sections: **Playback** (Autoplay switch `autoplay`, Crossfade slider 0-12s `crossfadeSec` + setCrossfade, speed select), **Sound quality** info card (explains HI-FI 320 kbps full-length streams + HQ 256 kbps previews, badge counts from `api.genres()` fullLength/total), **Catalog sync** (status from `api.syncStatus()` — total tracks, last synced, log table (source, scope, fetched, added), big "Sync now" button → `api.runSync()` + toast), **Sleep timer** quick buttons, **Keyboard shortcuts** table (Space, ←/→, Shift+←/→, ↑/↓, M, S, R, Q, L, N, /).
5. `src/components/views/rooms-view.tsx` → `export function RoomsView()`
   - Listen-together rooms via socket.io at path `/` with query `XTransformPort=3003` (socket.io client `io('/?XTransformPort=3003')` — import `io` from 'socket.io-client' (already in package.json dependencies; check first, if missing use fetch polling to `/api/rooms`? NO — socket.io-client IS listed). Use relative URL exactly `io('/?XTransformPort=3003')`, NEVER a port in the path itself.
   - Protocol: emit `room:create {name}` → ack `{code}`; emit `room:join {code}` → ack `{ok, room}`; emit `room:state` (server pushes `{playing, position, updatedAt, queue:[{trackId,title,artist,cover,durationMs}], hostControls}`); emit `room:play/pause/seek {position}`; emit `room:queue:add {track}`; emit `room:queue:remove {index}`; leave on unmount (`socket.disconnect()`).
   - Client plays: track from queue via `/api/stream/{trackId}`; sync drift correction: if |localPos - serverPos| > 1.5s → seek. If hostControls && !isHost → hide controls.
   - UI: create room card, join with 6-char code input, in-room view: shared queue (TrackList-like simple list w/ covers + remove for host), play/pause/skip synced, share code display, member count.
   - Keep the sync logic simple and robust; show connection status.

## Style rules
- Dark theme only (default). Emerald accent (text-emerald-400, bg-emerald-500 etc). NO indigo/blue.
- Cards: `rounded-xl border border-border/50 bg-black/30` containers; rows use SectionRow; consistent p-4/p-6, gap-4/6.
- Long lists inside fixed-height panels: `max-h-96 overflow-y-auto`.
- Every interactive element: aria-label where ambiguous, 44px touch targets where tappable.
- Loading: skeleton pulse divs. Errors: inline text + retry button. Empty: helpful empty states.
- NO emojis in UI.
- Use `Cover` for ALL artwork. Never raw <img> for covers.
- Play actions must call `playQueue(tracks, index, contextTitle)`.

## Verification
After writing files run `bun run lint` from /home/z/my-project and fix ALL errors in YOUR files. Do not modify any other existing files except your own view files listed above.
