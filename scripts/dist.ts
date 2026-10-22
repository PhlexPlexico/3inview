// Builds the page and one self-contained executable per platform into dist/.
//   bun run dist                 all targets
//   bun run dist linux-x64       just one (names below)
// Executables are named 3inview-<name>[.exe]; the release workflow archives them.
import { $ } from "bun";
import { mkdirSync, rmSync } from "node:fs";

const TARGETS: Record<string, { target: string; file: string }> = {
  "linux-x64":   { target: "bun-linux-x64",    file: "3inview-linux-x64" },
  "linux-arm64": { target: "bun-linux-arm64",  file: "3inview-linux-arm64" },
  "windows-x64": { target: "bun-windows-x64",  file: "3inview-windows-x64.exe" },
  "macos-arm64": { target: "bun-darwin-arm64", file: "3inview-macos-arm64" },
  "macos-x64":   { target: "bun-darwin-x64",   file: "3inview-macos-x64" },
};

const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !(w in TARGETS));
if (unknown.length) {
  console.error(`unknown target(s): ${unknown.join(", ")}\nknown: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

// The executables embed public/main.js, so it has to be fresh.
await $`bun run build:web`;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const name of wanted.length ? wanted : Object.keys(TARGETS)) {
  const t = TARGETS[name]!;
  console.log(`\n== ${name}`);
  await $`bun build --compile --target=${t.target} index.ts --outfile dist/${t.file}`;
}
