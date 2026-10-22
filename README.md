# 3inview

A Node.js application that bridges 3DS system input data to a web overlay via SSE (Server-Sent Events).

## Project Overview
The system connects to a 3DS console as a TCP client (on port 65534) to receive raw input data. This data is decoded into human-readable button states and served to a web frontend in real-time, allowing for an interactive overlay experience.

## Run it
```bash
bun install
bun run start                 # builds the page, serves http://127.0.0.1:3000
```
Open `http://127.0.0.1:3000/?ip=<3ds ip>` in a browser, or use that URL as an OBS Browser Source.
Without a 3DS: `bun run mock` in another terminal, then use `?ip=127.0.0.1`.

URL options: `ip`, `scale` (default 1), `bg` (background colour, default transparent), `debug=0` (hide the status box),
`flipY=1` / `flipCsY=1` (flip circle pad / C-stick vertical direction; the correct orientation is not confirmed on hardware).

## Layout
- `server/` decoder, `TcpReader` (reconnects, resyncs), `hub.ts` (one 3DS connection shared by all tabs), IP guard
- `index.ts` Hono server: `/events?ip=` (SSE) and the static page
- `web/main.ts` overlay script (bundled to `public/main.js`), `public/skins/3ds/skin.svg` the 3DS skin
- `tests/` golden-packet tests, `mock-live.ts` animated fake 3DS

## Still to do
- Tune the skin (it is a quick draft)
- Settings UI instead of URL parameters; more skins (an Old 3DS has no C-stick, ZL or ZR)
- Tests for `TcpReader` (split frames, resync, reconnect) and the hub
- Package: single executable, then Tauri
