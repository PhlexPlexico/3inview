// server/test-tcp.ts
import TcpReader from "../server/tcp";
import { getPressedButtons } from "../server/types/frame";

const reader = new TcpReader("127.0.0.1", (frame) => {
  const buttons = getPressedButtons(frame.buttons);
  console.log(`[Frame ${frame.seq}] Buttons: ${buttons.join(", ")} | CP: ${frame.cp} | CS: ${frame.cs}`);
});

reader.connect();