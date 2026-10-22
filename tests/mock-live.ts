// Endless animated fake 3DS on 127.0.0.1:65534, for trying the overlay without hardware.
//   bun tests/mock-live.ts      then open http://127.0.0.1:3000/?ip=127.0.0.1
import * as net from "net";

function frame(seq: number, t: number): Buffer {
  const b = Buffer.alloc(32);
  b[0] = 0x49; b[1] = 0x33; b[2] = 4; b[3] = seq & 255;
  const step = Math.floor(t / 400) % 20;                       // walk through the buttons
  const bits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 24, 25, 26, 27, 28];
  b.writeUInt32LE((1 << (bits[step] ?? 0)) >>> 0, 4);
  const a = t / 1000;
  b.writeInt16LE(Math.round(Math.cos(a) * 156), 8);  b.writeInt16LE(Math.round(Math.sin(a) * 156), 10);
  const touching = Math.floor(a / 3) % 2 === 0;
  b.writeInt16LE(touching ? Math.round(160 + Math.cos(a * 2) * 120) : 0, 12);
  b.writeInt16LE(touching ? Math.round(120 + Math.sin(a * 2) * 90) : 0, 14);
  b.writeInt16LE(Math.round(Math.cos(-a) * 120), 16); b.writeInt16LE(Math.round(Math.sin(-a) * 120), 18);
  b[20] = 2; b[21] = 1; b[22] = 2;
  return b;
}

net.createServer((s) => {
  console.log("[mock] client connected");
  let seq = 0;
  const t0 = Date.now();
  const timer = setInterval(() => s.write(frame(seq++, Date.now() - t0)), 1000 / 60);
  s.on("close", () => clearInterval(timer));
  s.on("error", () => clearInterval(timer));
}).listen(65534, "127.0.0.1", () => console.log("[mock] 3DS on 127.0.0.1:65534"));
