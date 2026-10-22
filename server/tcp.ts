import { decode } from "./decode";
import * as net from "net";
import type { Frame } from "./types/frame";
import type { LinkState } from "./types/link_state";

const BUFFER_FRAME = 32;
const PORT = 65534;
const MAX_BACKOFF_MS = 5000;

class TcpReader {
  private socket: net.Socket | undefined;
  private buffer: Buffer = Buffer.alloc(0);
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private backoff = 1000;
  private lastError = "";

  constructor(
    private host: string,
    private onFrame?: (frame: Frame) => void,
    private onState?: (state: LinkState) => void,
    private port: number = PORT,
  ) {}

  connect() {
    this.stopped = false;
    this.onState?.("connecting");
    const socket = net.createConnection({ host: this.host, port: this.port });
    this.socket = socket;
    socket.setNoDelay(true);

    socket.on("connect", () => {
      console.log(`Connected to 3DS ${this.host}`);
      this.lastError = "";
      this.backoff = 1000;
      this.buffer = Buffer.alloc(0);
      this.onState?.("connected");
    });

    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });

    // Without this an unreachable or sleeping 3DS throws and kills the process.
    // Logged once per distinct error, retries are silent so the console is not flooded.
    socket.on("error", (err) => {
      if (err.message !== this.lastError) {
        this.lastError = err.message;
        console.log(`3DS ${this.host}: ${err.message} (retrying every few seconds)`);
      }
    });

    socket.on("close", () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.onState?.("waiting");
      if (this.stopped) return;
      this.retryTimer = setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    });
  }

  stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const thisSocket = this.socket;
    this.socket = undefined;
    thisSocket?.destroy();
  }

  private processBuffer() {
    for (;;) {
      const idx = this.buffer.indexOf(Buffer.from([0x49, 0x33]));
      if (idx === -1) {
        // No magic anywhere: drop it all, but keep a trailing 'I' that may start one.
        this.buffer = this.buffer.length && this.buffer[this.buffer.length - 1] === 0x49
          ? this.buffer.subarray(this.buffer.length - 1)
          : Buffer.alloc(0);
        return;
      }
      if (idx > 0) this.buffer = this.buffer.subarray(idx);
      if (this.buffer.length < BUFFER_FRAME) return;

      try {
        const frame = decode(this.buffer.subarray(0, BUFFER_FRAME));
        this.onFrame?.(frame);
        this.buffer = this.buffer.subarray(BUFFER_FRAME);
      } catch (e) {
        // A false 'I3' inside other data: skip one byte and look again.
        console.error("Decode error:", (e as Error).message);
        this.buffer = this.buffer.subarray(1);
      }
    }
  }
}

export default TcpReader;
