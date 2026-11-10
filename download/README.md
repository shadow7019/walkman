# Walkman downloads

## walkman-1.3.0.apk (versionCode 4)
Android app shell for Walkman. Served at:
- https://walkman.space-z.ai/walkman-1.3.0.apk  (versioned URL, cache-safe)
- https://walkman.space-z.ai/walkman.apk        (convenience alias — CDN caches
  may keep serving an older build here; prefer the versioned URL)

What is new in 1.3.0:
- Background playback — a native foreground service (`PlaybackService`) keeps
  music playing when the screen is off, with a media notification (play /
  pause / next / previous) and lock-screen controls.
- Talks to the web app through the `WalkmanAndroid` JavascriptInterface bridge;
  the Settings tab exposes the "Background playback" toggle.
- Server defaults to https://walkman.space-z.ai (changeable in-app).
- Signed with the project keystore; install requires "allow unknown apps".

The app UI (Settings, Explore, auto-add new songs, equalizer, sync status)
is loaded live from the server, so older APK versions also receive those
features without reinstalling — only background playback needs 1.3.0+.
