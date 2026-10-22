# Plan: Node.js overlay app for 3Input

A local Node.js app that reads the 3Input stream from the 3DS and shows the inputs in a web overlay (for example as an OBS Browser Source).

## Shape of the app

```
3DS --TCP :65534--> Node (decoder + HTTP + WebSocket/SSE) --> overlay page (OBS Browser Source or any browser)
```

One process does everything: it reads the 3DS stream, serves the overlay files, and pushes decoded frames to the page. Browsers cannot open raw TCP sockets, which is why the Node bridge is needed.

### Suggested layout

```
3input-overlay/
  server/   tcp.js (connect, reassemble, reconnect)   decode.js (bytes -> object)   http.js (static + stream)
  public/   index.html  overlay.js  skins/<name>/{skin.svg, skin.json}  style.css
  test/     decode.test.js  mock3ds.js  fixtures/*.bin
```

## Steps

1. **Decoder first, with tests.** `decode.js` turns a 32-byte `Buffer` into an object. Test it with golden packets (for example from `viewer/threeinput.py`'s test data). Node's built-in `node:test` is enough.
2. **TCP reader.** Connect to the 3DS and append incoming chunks to a buffer. Peel off 32 bytes at a time. If the first two bytes are not `'I' '3'`, scan forward for the next magic (the Python viewer does this). Reconnect with backoff, because the 3DS drops the connection when it sleeps.
3. **Mock 3DS.** A tiny script that listens on a port and sends scripted packets, including awkward chunking. Develop the whole app against it.
4. **Server.** Serve `public/` over HTTP. Add one stream endpoint: WebSocket (needs the small `ws` package) or Server-Sent Events (no dependency, one-way, which is all that is needed). Share a single 3DS connection between all browser tabs. Send "connected / waiting / error" status events too.
5. **Overlay page.**
   - An SVG skin where each button is an element with an ID. A button bit toggles a CSS class.
   - Sticks translate the circle pad and C-stick elements by (x, y), scaled from about +-156.
   - A touch panel shows a dot at the touch point.
   - A corner badge shows the IR, C-stick and Wi-Fi status text.
   - Render on `requestAnimationFrame` using only the newest frame.
6. **Options in the URL.** `?ip=...&skin=...&scale=...&bg=transparent`. Remember the last IP in `localStorage`. The same URL then works as an OBS Browser Source.
7. **Packaging.** `npm start` for developers, and a single-file executable (Node's SEA feature, or `pkg`) for everyone else.

## Things to get right

- **Version check.** Read `version` (byte 2) before decoding. Refuse anything but `4` with a clear on-screen message, since the layout may change in later versions.
- **HOME is a pulse** (about 100 ms). Do not treat it as held.
- **Y axis direction is unverified.** Add a "flip Y" option for each stick until it is confirmed.
- **Security.** Bind to `127.0.0.1`, and only let the server connect to private-range IPs on port 65534. Otherwise it is an open proxy.
- **Do not queue frames.** If the page falls behind, drop old frames and keep the latest.
- **Hosting.** The bridge must run on the user's own network. A public server cannot reach `192.168.x.x`, and an HTTPS page cannot open insecure connections to a LAN address.

## Reading the bytes (protocol version 4, 32 bytes, all little endian)

The authoritative layout is `source/protocol.h`.

| Offset | Type | Field | `Buffer` call |
|---|---|---|---|
| 0 | u8[2] | magic `'I'` `'3'` | `buf[0] === 0x49 && buf[1] === 0x33` |
| 2 | u8 | version | `buf[2]` |
| 3 | u8 | frame counter | `buf[3]` |
| 4 | u32 | buttons | `buf.readUInt32LE(4)` |
| 8 / 10 | s16 | circle pad X / Y | `buf.readInt16LE(8)` / `(10)` |
| 12 / 14 | s16 | touch X / Y (pixels) | `buf.readInt16LE(12)` / `(14)` |
| 16 / 18 | s16 | C-stick X / Y | `buf.readInt16LE(16)` / `(18)` |
| 20 | u8 | `ir_status` | `buf[20]` |
| 21 | u8 | `cs_status` | `buf[21]` |
| 22 | u8 | `wifi_status` | `buf[22]` |
| 23 | u8 | `wifi_recoveries` | `buf[23]` |
| 24 | u32 | `ir_error` | `buf.readUInt32LE(24)` |
| 28 | u32 | `cs_error` | `buf.readUInt32LE(28)` |

### Button bits

Test a bit with `(buttons >>> n) & 1`, because bit 31 breaks a plain `&` in JavaScript (the result goes negative).

| Bit | Button | Bit | Button |
|---|---|---|---|
| 0 | A | 11 | Y |
| 1 | B | 14 | ZL |
| 2 | Select | 15 | ZR |
| 3 | Start | 16 | HOME (about 100 ms pulse per press) |
| 4 | D-pad Right | 24 | C-stick Right |
| 5 | D-pad Left | 25 | C-stick Left |
| 6 | D-pad Up | 26 | C-stick Up |
| 7 | D-pad Down | 27 | C-stick Down |
| 8 | R | 28 | Circle pad Right |
| 9 | L | 29 | Circle pad Left |
| 10 | X | 30 | Circle pad Up |
|  |  | 31 | Circle pad Down |

### Decoder sketch

```js
const FRAME = 32;

function decode(buf) {
  if (buf[0] !== 0x49 || buf[1] !== 0x33) throw new Error('bad magic');
  if (buf[2] !== 4) throw new Error('unsupported protocol version ' + buf[2]);
  return {
    seq: buf[3],
    buttons: buf.readUInt32LE(4),
    cp: [buf.readInt16LE(8), buf.readInt16LE(10)],
    tp: [buf.readInt16LE(12), buf.readInt16LE(14)],
    cs: [buf.readInt16LE(16), buf.readInt16LE(18)],
    ir: buf[20], csStatus: buf[21], wifi: buf[22], wifiRecoveries: buf[23],
    irError: buf.readUInt32LE(24), csError: buf.readUInt32LE(28),
  };
}

const pressed = (buttons, bit) => ((buttons >>> bit) & 1) === 1;
```

TCP is a stream, so always accumulate chunks and cut at 32-byte boundaries before calling `decode`.

## Decisions to settle first

1. **WebSocket vs SSE.** Start with SSE for zero dependencies. Switch only if the page needs to send commands back to the server.
2. **Skin format.** One SVG plus a small JSON that maps button names to element IDs lets people add skins without touching code.
3. **Where the IP is entered.** In the page UI, or as a command-line argument. Support both.
4. **OBS only, or also a desktop wrapper?** A Tauri or Electron window around the same page works with capture tools that have no browser source.
