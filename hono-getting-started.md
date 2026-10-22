# Getting started: 3Input overlay with Hono (OBS Browser Source first)

A first-evening path for the Node.js/TypeScript overlay app described in
`nodejs-overlay-plan.md`. Each step ends with a check. Use Node 20+ (22 LTS is
a good choice) and pnpm.

Stack: **Hono** (server, SSE) + **Vite with TypeScript** (overlay page) + a shared
`protocol` package so the packet types are written once. Package with Tauri later.

## 1. Create the workspace

```bash
mkdir 3input-overlay && cd 3input-overlay
pnpm init
printf "packages:\n  - 'packages/*'\n" > pnpm-workspace.yaml
pnpm add -Dw typescript tsx vitest @types/node
mkdir -p packages/protocol/src packages/protocol/test packages/server/src
pnpm create vite packages/web --template vanilla-ts
```

Root `tsconfig.base.json`, which every package extends:

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "skipLibCheck": true, "noEmit": true
  }
}
```

`noUncheckedIndexedAccess` catches off-by-one reads on the byte buffer.

## 2. The shared `protocol` package (do this first)

`packages/protocol/package.json`:

```json
{ "name": "@3input/protocol", "private": true, "type": "module",
  "exports": "./src/index.ts" }
```

Pointing `exports` at the TypeScript source is fine here: `tsx`, Vite and
`esbuild` all read it directly, so there is no build step.

In `src/`, write:

- the `Frame` interface, the button bits and the status codes, mirroring
  `source/protocol.h` in the 3Input repository;
- `decode(buf: Buffer | Uint8Array): Frame`, using the offsets in
  `nodejs-overlay-plan.md` (protocol version 4, 32 bytes, little endian);
- a `ServerEvent` union for the messages the server sends to the page.

```ts
export interface Frame {
  seq: number;
  buttons: number;
  cp: readonly [x: number, y: number];
  tp: readonly [x: number, y: number];
  cs: readonly [x: number, y: number];
  irStatus: number; csStatus: number; wifi: number; wifiRecoveries: number;
  irError: number; csError: number;
}
export type ServerEvent =
  | { type: 'frame'; frame: Frame }
  | { type: 'status'; state: 'connecting' | 'connected' | 'waiting'; ip: string };
```

Then write `test/decode.test.ts` with a few golden packets. Build them in
Python with `struct.pack('<2sBBIhhhhhhBBBBII', ...)` and paste the bytes in.

**Check:** `pnpm vitest run` passes.

## 3. The server

```bash
cd packages/server && pnpm init   # name it @3input/server, "type": "module"
pnpm add hono @hono/node-server @3input/protocol@workspace:*
```

Add `"dev": "tsx watch src/index.ts"` to its scripts. `src/index.ts`, roughly:

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { streamSSE } from 'hono/streaming';
import { subscribe } from './hub.js';        // shares one TCP connection per IP
import { isPrivateIPv4 } from './net.js';

const app = new Hono();

app.get('/events', (c) => {
  const ip = c.req.query('ip') ?? '';
  if (!isPrivateIPv4(ip)) return c.text('bad ip', 400);   // never an open proxy
  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribe(ip, (ev) =>
      void stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) }));
    stream.onAbort(unsubscribe);
    await new Promise<void>((resolve) => stream.onAbort(resolve)); // keep it open
  });
});

app.use('/*', serveStatic({ root: '../web/dist' }));      // the built overlay

serve({ fetch: app.fetch, port: 3000, hostname: '127.0.0.1' });
```

`hub.ts` owns the `net.connect(65534, ip)` socket. It:

- appends incoming chunks to a buffer and cuts 32-byte frames;
- resyncs on the `'I3'` magic if the stream gets out of step;
- reconnects with backoff (the 3DS drops the connection when it sleeps);
- fans each decoded frame out to its subscribers.

Keep it separate from Hono so it can be tested on its own.

## 4. A fake 3DS to develop against

Write a small `mock3ds.ts` using `net.createServer` on port 65534. It should send
a scripted 32-byte frame about 60 times a second: cycle through the buttons, move
both sticks in a circle, and occasionally split a frame across two writes. Run
it with `pnpm tsx mock3ds.ts`.

**Check:** with the mock running, this prints `event: frame` lines:

```bash
curl -N "http://127.0.0.1:3000/events?ip=127.0.0.1"
```

The mock listens on localhost, so allow `127.0.0.1` in `isPrivateIPv4` while
developing.

## 5. The overlay page

In `packages/web`, add `"@3input/protocol": "workspace:*"` as a dependency and in
`src/main.ts`:

```ts
import type { ServerEvent } from '@3input/protocol';
const ip = new URLSearchParams(location.search).get('ip') ?? '';
const es = new EventSource(`/events?ip=${encodeURIComponent(ip)}`);
let latest: ServerEvent | undefined;
es.addEventListener('frame', (e) => { latest = JSON.parse((e as MessageEvent).data); });
requestAnimationFrame(function draw() { /* toggle SVG classes from `latest` */ requestAnimationFrame(draw); });
```

In `vite.config.ts`, add a dev proxy so the page can reach the server:

```ts
server: { proxy: { '/events': 'http://127.0.0.1:3000' } }
```

Run the server (`pnpm --filter @3input/server dev`) and Vite
(`pnpm --filter web dev`) in two terminals.

**Check:** the page shows live values from the mock.

## 6. OBS

Build the page with `pnpm --filter web build`, start the server, then in OBS add a
**Browser** source:

- URL: `http://127.0.0.1:3000/?ip=<3ds ip>`
- Width and height: your overlay size (for example 1000 x 560)
- Custom CSS: `body { background: transparent; }` so the overlay has no background

## Later: Tauri

Keep `web` a plain static Vite build and keep the server independent of it. Tauri
can then load `web/dist` and start the same server as a sidecar, with no rewrite.

## Notes

- Hono's API and the `@hono/node-server` helpers above are from memory. Check the
  current docs for `serveStatic` (the `root` path is relative to the working
  directory) and `streamSSE` if something does not match.
- The server must run on the same network as the 3DS. A public host cannot reach
  a private IP.
