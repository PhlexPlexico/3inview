// On Linux a double-clicked executable runs with no terminal, so there is nowhere to see logs or
// press Ctrl-C and the process has to be killed by PID. When that happens in a compiled release,
// open a terminal emulator running this same executable and exit; closing that window (or Ctrl-C)
// then stops the server.
//
// Skipped when: not Linux, already in a terminal, not a compiled executable (bun run dev),
// already relaunched (INVIEW_IN_TERMINAL), or opted out (--no-terminal / INVIEW_NO_TERMINAL=1).

// [command, flag(s) that precede the program to run]
const TERMINALS: [string, string[]][] = [
  ["x-terminal-emulator", ["-e"]],   // Debian/Ubuntu "alternatives", honours the user's default
  ["ptyxis", ["--"]],                // default on Fedora and recent Ubuntu
  ["gnome-terminal", ["--"]],
  ["konsole", ["-e"]],
  ["xfce4-terminal", ["-x"]],
  ["kitty", []],
  ["alacritty", ["-e"]],
  ["xterm", ["-e"]],
];

const compiled = !/(^|[\\/])bun(\.exe)?$/.test(process.execPath);

export function relaunchInTerminalIfNeeded(): void {
  if (process.platform !== "linux" || !compiled) return;
  if (process.stdout.isTTY || process.stdin.isTTY) return;
  if (process.env.INVIEW_IN_TERMINAL || process.env.INVIEW_NO_TERMINAL === "1") return;
  if (process.argv.includes("--no-terminal")) return;

  const self = process.execPath;
  // Keep the window open if the server dies, so the error can be read.
  const script =
    'INVIEW_IN_TERMINAL=1 "$0" "$@"; s=$?; if [ "$s" -ne 0 ]; then echo; echo "3inview stopped (exit code $s). Press Enter to close."; read _; fi';
  for (const [cmd, flags] of TERMINALS) {
    const path = Bun.which(cmd);
    if (!path) continue;
    try {
      const child = Bun.spawn([path, ...flags, "sh", "-c", script, self, ...process.argv.slice(2)], {
        stdin: "ignore", stdout: "ignore", stderr: "ignore",
        env: { ...process.env, INVIEW_IN_TERMINAL: "1" },
      });
      child.unref();
      process.exit(0);
    } catch {
      // try the next one
    }
  }
  console.log("No terminal emulator found, running without a console (stop it with `pkill 3inview`).");
}
