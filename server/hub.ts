import TcpReader from "./tcp";
import type { Hub } from "./types/hub";
import type { Listener, ServerEvent } from "./types/server_event";

const hubs = new Map<string, Hub>();
const IDLE_CLOSE_MS = 5000;

function emit(hub: Hub, ev: ServerEvent) {
  for (const l of hub.listeners) l(ev);
}

/** One TCP connection per 3DS, shared by every browser tab that asks for it. */
export function subscribe(ip: string, listener: Listener): () => void {
  let hub = hubs.get(ip);
  if (!hub) {
    const created: Hub = {
      listeners: new Set(),
      state: "connecting",
      reader: new TcpReader(
        ip,
        (frame) => emit(created, { type: "frame", frame }),
        (state) => {
          created.state = state;
          emit(created, { type: "status", state, ip });
        },
      ),
    };
    hubs.set(ip, created);
    created.reader.connect();
    hub = created;
  }
  if (hub.idleTimer) clearTimeout(hub.idleTimer);
  hub.idleTimer = undefined;
  hub.listeners.add(listener);
  listener({ type: "status", state: hub.state, ip });

  const h = hub;
  return () => {
    h.listeners.delete(listener);
    if (h.listeners.size === 0) {
      h.idleTimer = setTimeout(() => {
        h.reader.stop();
        hubs.delete(ip);
      }, IDLE_CLOSE_MS);
    }
  };
}
