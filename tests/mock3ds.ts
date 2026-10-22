import * as net from "net";
import * as fs from "fs";
import * as path from "path";

const PORT = 65534;
// Use the project root to find golden_bytes.json reliably
const GOLDEN_BYTES_PATH = path.resolve(__dirname, "golden_bytes.json");

function main() {
  if (!fs.existsSync(GOLDEN_BYTES_PATH)) {
    console.error(`[Error] Could not find golden_bytes.json at: ${GOLDEN_BYTES_PATH}`);
    console.error(`Current directory is: ${process.cwd()}`);
    return;
  }

  console.log(`[Info] Loading golden bytes from: ${GOLDEN_BYTES_PATH}`);
  const goldenBytes = JSON.parse(fs.readFileSync(GOLDEN_BYTES_PATH, "utf-8"));
  console.log(`[Info] Loaded ${goldenBytes.cases.length} golden cases.`);

  const server = net.createServer((socket) => {
    console.log(`[Mock] Client connected from ${socket.remoteAddress}`);

    let currentCaseIndex = 0;

    const sendNextFrame = () => {
      if (currentCaseIndex >= goldenBytes.cases.length) {
        console.log("[Mock] Finished sending all golden cases.");
        socket.end();
        return;
      }

      const caseData = goldenBytes.cases[currentCaseIndex];
      
      // Send some "garbage" bytes to test the scan-forward/resync logic 
      // mentioned in the plan.
      const garbage = Buffer.from("garbage_bytes_prefix_");
      socket.write(garbage);

      // Send the actual frame
      const frameBuffer = Buffer.from(caseData.hex, "hex");
      socket.write(frameBuffer);
      
      console.log(`[Mock] Sent case ${currentCaseIndex + 1}/${goldenBytes.cases.length}: ${caseData.name} (${caseData.hex.substring(0, 10)}...)`);
      
      currentCaseIndex++;
      setTimeout(sendNextFrame, 500); // Send one frame every 500ms
    };

    console.log("[Mock] Starting sequence in 1 second...");
    setTimeout(sendNextFrame, 1000);
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[Mock] Mock 3DS server listening on 127.0.0.1:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("[Mock] Server Error:", err);
  });
}

main();

