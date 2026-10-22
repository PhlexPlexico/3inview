import type { Frame } from "./frame";
import type { LinkState } from "./link_state";
export type ServerEvent =
  | { type: "frame"; frame: Frame }
  | { type: "status"; state: LinkState; ip: string };

export type Listener = (ev: ServerEvent) => void;