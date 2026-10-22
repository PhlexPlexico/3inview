// Files the overlay page needs. Importing them with `type: "file"` makes `bun build --compile`
// carry them inside the executable, so a release binary does not need a public/ folder next to it.
// Add any new file the page loads (another skin, ...) here too.
import indexHtml from "../public/index.html" with { type: "file" };
import mainJs from "../public/main.js" with { type: "file" };
import skinSvg from "../public/skins/3ds/skin.svg" with { type: "file" };

export const ASSETS: Record<string, { path: string; type: string }> = {
  "/": { path: indexHtml, type: "text/html; charset=utf-8" },
  "/index.html": { path: indexHtml, type: "text/html; charset=utf-8" },
  "/main.js": { path: mainJs, type: "text/javascript; charset=utf-8" },
  "/skins/3ds/skin.svg": { path: skinSvg, type: "image/svg+xml" },
};
