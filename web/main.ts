import type { Frame } from "../server/types/frame";

// URL options: ?ip=<3ds ip>  &scale=1  &bg=00ff00  &screen=00ff00  &shell=222  &debug=0
const queryParams = new URLSearchParams(location.search);
let ip3DS = queryParams.get("ip") ?? "";
const scale = Number(queryParams.get("scale") ?? "1") || 1;
// Colours may be given with or without '#' (a raw '#' in a URL starts the fragment and is never sent).
const colour = (v: string | null): string | undefined =>
  v ? (/^[0-9a-f]{3,8}$/i.test(v) ? `#${v}` : v) : undefined;

const bg = colour(queryParams.get("bg"));
if (bg)
  document.body.style.background = bg;

// ?screen=00ff00 paints the touch screen (handy as a chroma key); ?shell=222 recolours the console body.
const screenColour = colour(queryParams.get("screen"));
if (screenColour)
  document.documentElement.style.setProperty("--screen", screenColour);

const shellColour = colour(queryParams.get("shell"));
if (shellColour)
  document.documentElement.style.setProperty("--shell", shellColour);

const hudElement = document.getElementById("hud")!;
if (queryParams.get("debug") === "0")
  hudElement.classList.add("hidden");
const conn = document.getElementById("conn")!;
const info = document.getElementById("info")!;
const stage = document.getElementById("stage")!;
stage.style.transform = `scale(${scale})`;

const IR = ["pending", "UNPATCHED IR module", "passive", "holding ir:rst", "yielded", "ir:rst failed"];
const CS = ["pending", "mapped", "no ir:rst", "GetHandles failed", "no shared mem", "map failed"];
const WIFI = ["not reported", "starting", "holding", "reconnecting", "gave up", "ac failed"];

const CPAD_TRAVEL = 14;     // px the circle pad nub may travel
const CSTICK_TRAVEL = 8;    // the C-stick is a small nub
const PAD_MAX = 156;        // circle pad / c-stick range
const TOUCH_BOX = { x: 190, y: 62 };  // bottom screen origin in the SVG (1 px per touch px)

let bitEls: { el: Element; bits: number[] }[] = [];
let cpadNub: SVGGElement, cstickNub: SVGGElement, touchDot: SVGCircleElement;

let latestFrameWindow: Frame | undefined;
let frames = 0;
let fps = 0;
let lastSeq = -1;
let dropped = 0;

async function loadSkin() {
  const res = await fetch("/skins/3ds/skin.svg");
  stage.innerHTML = await res.text();
  bitEls = [...stage.querySelectorAll("[data-bits]")].map((el) => ({
    el,
    bits: el.getAttribute("data-bits")!.split(/\s+/).map(Number),
  }));
  cpadNub = stage.querySelector("#cpad-nub")!;
  cstickNub = stage.querySelector("#cstick-nub")!;
  touchDot = stage.querySelector("#touch")!;
}

const pressed = (buttons: number, bit: number) => ((buttons >>> bit) & 1) === 1;

function moveNub(svgEl: SVGGElement, x: number, y: number, travel: number) {
  let newX = x / PAD_MAX;
  let newY = -y / PAD_MAX; // y increases downward so we need to flip
  const len = Math.hypot(newX, newY);
  if (len > 1) { newX /= len; newY /= len; }
  svgEl.setAttribute("transform", `translate(${(newX * travel).toFixed(1)} ${(newY * travel).toFixed(1)})`);
}

function draw() {
  requestAnimationFrame(draw);
  const curFrame = latestFrameWindow;
  if (!curFrame || !bitEls.length) return;
  for (const { el, bits } of bitEls) el.classList.toggle("pressed", bits.some((b) => pressed(curFrame.buttons, b)));
  moveNub(cpadNub, curFrame.cp[0], curFrame.cp[1], CPAD_TRAVEL);
  moveNub(cstickNub, curFrame.cs[0], curFrame.cs[1], CSTICK_TRAVEL);
  const touching = curFrame.tp[0] !== 0 || curFrame.tp[1] !== 0;
  touchDot.setAttribute("visibility", touching ? "visible" : "hidden");
  if (touching) {
    touchDot.setAttribute("cx", String(TOUCH_BOX.x + curFrame.tp[0]));
    touchDot.setAttribute("cy", String(TOUCH_BOX.y + curFrame.tp[1]));
  }
  info.textContent =
    `\nseq ${curFrame.seq}  ${fps} fps  dropped ${dropped}` +
    `\ncp ${curFrame.cp}  cs ${curFrame.cs}  tp ${curFrame.tp}` +
    `\nIR   ${IR[curFrame.ir] ?? curFrame.ir} (0x${curFrame.irError.toString(16)})` +
    `\nCS   ${CS[curFrame.csStatus] ?? curFrame.csStatus} (0x${curFrame.csError.toString(16)})` +
    `\nWIFI ${WIFI[curFrame.wifi] ?? curFrame.wifi} (${curFrame.wifiRecoveries})`;
}

function connect() {
  const eventSrc3Ds = new EventSource(`/events?ip=${encodeURIComponent(ip3DS)}`);
  eventSrc3Ds.addEventListener("status", (e) => {
    const ev = JSON.parse((e as MessageEvent).data);
    conn.textContent = ev.state === "connected" ? `3DS ${ip3DS}: connected`
      : ev.state === "connecting" ? `3DS ${ip3DS}: connecting...` : `3DS ${ip3DS}: waiting for the 3DS`;
    if (ev.state !== "connected") info.textContent = "";
  });
  eventSrc3Ds.addEventListener("frame", (e) => {
    const curFrame: Frame = JSON.parse((e as MessageEvent).data).frame;
    if (lastSeq >= 0) dropped += (curFrame.seq - lastSeq - 1 + 256) % 256;
    lastSeq = curFrame.seq;
    latestFrameWindow = curFrame;
    frames++;
  });
  eventSrc3Ds.onerror = () => { conn.textContent = "lost the overlay server, retrying..."; };
}

// --- IP box: shown when the URL has no ?ip= ---------------------------------------------------
const IP_KEY = "3inview.ip";
const ipBox = document.getElementById("ipbox") as HTMLFormElement;
const ipInput = document.getElementById("ipinput") as HTMLInputElement;
const ipErr = document.getElementById("iperr")!;

const validIPv4 = (v: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(v) && v.split(".").every((n) => Number(n) <= 255);
// localStorage can be unavailable (blocked, private window, some embedded browsers).
const loadIp = () => { try { return localStorage.getItem(IP_KEY) ?? ""; } catch { return ""; } };
const saveIp = (v: string) => { try { localStorage.setItem(IP_KEY, v); } catch { /* ignore */ } };

function showIpBox() {
  conn.textContent = "enter the IP address of your 3DS";
  ipInput.value = loadIp();
  ipBox.hidden = false;
  ipInput.focus();
  ipInput.select();
}

ipBox.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = ipInput.value.trim();
  if (!validIPv4(v)) { ipErr.textContent = "that is not an IPv4 address, e.g. 192.168.1.50"; return; }
  ipErr.textContent = "";
  saveIp(v);
  ipBox.hidden = true;
  ip3DS = v;
  // Keep the address in the URL so a refresh, bookmark or OBS source keeps working.
  queryParams.set("ip", v);
  history.replaceState(null, "", `${location.pathname}?${queryParams.toString()}`);
  connect();
});

setInterval(() => { fps = frames; frames = 0; }, 1000);
await loadSkin();
requestAnimationFrame(draw);
if (ip3DS) connect(); else showIpBox();
