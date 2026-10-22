import TcpReader from "../tcp";
import type { LinkState } from "../tcp";
import type { Listener } from "./server_event";

export interface Hub {
  reader: TcpReader;
  listeners: Set<Listener>;
  state: LinkState;
  idleTimer?: ReturnType<typeof setTimeout>;
}