import type { Frame } from "./frame";
import type { LinkState } from "../tcp";
export type ServerEvent =
  | { type: "frame"; frame: Frame }
  | { type: "status"; state: LinkState; ip: string };

export type Listener = (ev: ServerEvent) => void;