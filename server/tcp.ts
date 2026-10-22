import { decode } from "./decode";
import * as net from "net";
import type { Frame } from "./types/frame";

class TcpReader {
  private socket: any;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(private host: string, private onFrame?: (frame: Frame) => void) {}

  connect() {
    this.socket = net.createConnection({
      host: this.host,
      port: 65534,
      enableUpgrade: true,
    });

    this.socket.on("connect", () => {
      console.log("Connected to 3DS!");
    });

    this.socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });

    this.socket.on("disconnect", () => {
      console.log("3DS has disconnected.");
    });
  }

  private processBuffer() {
    while (this.buffer.length >= 32) {
      let foundIndex = -1;
      for (let i = 0; i <= this.buffer.length - 32; i++) {
        if (this.buffer[i] === 0x49 && this.buffer[i + 1] === 0x33) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex === -1) {
        break;
      }

      if (foundIndex > 0) {
        this.buffer = this.buffer.slice(foundIndex);
      }

      if (this.buffer.length < 32) break;

      const frameBuffer = this.buffer.slice(0, 32);
      try {
        const frame = decode(frameBuffer);
        if (this.onFrame) {
          this.onFrame(frame);
        }
      } catch (e) {
        console.error("Decode error:", e);
      }

      this.buffer = this.buffer.slice(32);
    }
  }
}

export default TcpReader;