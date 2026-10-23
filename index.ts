import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { subscribe } from "./server/hub";
import { isPrivateIPv4 } from "./server/net-util";
import { ASSETS } from "./server/assets";
import { relaunchInTerminalIfNeeded } from "./server/terminal";

relaunchInTerminalIfNeeded();

const app = new Hono();

app.get("/events", (c) => {
  const ip = c.req.query("ip") ?? "";
  if (!isPrivateIPv4(ip)) return c.text("ip must be a private IPv4 address", 400);

  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribe(ip, (ev) => {
      if (!stream.aborted) void stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
    });
    stream.onAbort(unsubscribe);
    // Keep the connection open; the comment-style ping stops proxies/browsers timing it out.
    while (!stream.aborted) {
      await stream.sleep(15000);
      if (!stream.aborted) await stream.writeSSE({ event: "ping", data: "" });
    }
  });
});

app.get("/*", (c) => {
  const a = ASSETS[c.req.path];
  return a ? new Response(Bun.file(a.path), { headers: { "content-type": a.type } }) : c.notFound();
});

const port = Number(process.env.PORT ?? 3000);
Bun.serve({ port, hostname: "127.0.0.1", idleTimeout: 0, fetch: app.fetch });
console.log(`3inview on http://127.0.0.1:${port}/?ip=<3ds ip>`);
