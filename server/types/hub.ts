import TcpReader from "../tcp";
import type { LinkState } from "./link_state";
import type { Listener } from "./server_event";

export interface Hub {
  reader: TcpReader;
  listeners: Set<Listener>;
  state: LinkState;
  idleTimer?: ReturnType<typeof setTimeout>;
}