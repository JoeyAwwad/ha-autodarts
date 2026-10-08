// A tour of every game on the real game screen: drives the demo (demo/demo.sh) with a
// headless Edge or Chrome over the DevTools protocol, starts each game from the New game
// screen, throws darts through the dart simulator and saves screenshots.
//
//   node contrib/classic-game-screen/tools/ui-tour.mjs [out-dir] [WxH ...] [--only=game,game]
//
// Needs the demo running and Edge or Chrome installed (BROWSER=path to pick one).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const out = args.find((a) => !a.startsWith("--") && !/^\d+x\d+$/.test(a)) || path.join(os.tmpdir(), "darts-ui-tour");
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split("x").map(Number));
if (!sizes.length) sizes.push([1920, 1080], [1280, 720]);
const SCREEN = process.env.SCREEN_URL || "http://localhost:18125/darts-classic/game";
const SIM = process.env.SIM_URL || "http://localhost:18126";
const BROWSERS = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -- darts, as the simulator throws them -------------------------------------------------------
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function dart(name) {
  if (name === "Bull") return { name: "Bull", number: 25, multiplier: 2, bed: "Double", x: 0.01, y: 0.01 };
  if (name === "25") return { name: "25", number: 25, multiplier: 1, bed: "Single", x: 0.02, y: 0.06 };
  if (name === "Miss") return { name: "Miss", number: 0, multiplier: 0, bed: "Miss", x: 1.1, y: 0.3 };
  const ring = name[0], n = Number(name.slice(1)), a = (ORDER.indexOf(n) * 18 * Math.PI) / 180;
  const r = { T: 0.605, D: 0.975, S: 0.8, I: 0.35 }[ring];
  const multiplier = { T: 3, D: 2, S: 1, I: 1 }[ring];
  const bed = { T: "Triple", D: "Double", S: "SingleOuter", I: "SingleInner" }[ring];
  return { name: `${ring === "I" ? "S" : ring}${n}`, number: n, multiplier, bed, x: r * Math.sin(a), y: r * Math.cos(a) };
}
async function sim(route, body) {
  // A request that is never answered fails after 20 s instead of stalling the tour.
  const res = await fetch(`${SIM}/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  return res.json();
}
async function visit(darts, pause = 900) {
  for (const d of darts) { await sim("throw", dart(d)); await sleep(pause); }
}
async function takeout() { await sim("takeout"); await sleep(1600); }

// -- the browser ----------------------------------------------------------------------------------
async function browser(w, h) {
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  if (!exe) throw new Error("No Edge or Chrome found; set BROWSER");
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "darts-tour-"));
  const proc = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${w},${h}`,
    "--autoplay-policy=no-user-gesture-required", "--mute-audio", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const waiting = new Map();
  ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    const my = id, timer = setTimeout(() => { waiting.delete(my); reject(new Error(`The browser did not answer ${method} in 60 s`)); }, 60000);
    waiting.set(my, (m) => { clearTimeout(timer); resolve(m); });
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const run = async (expr) => {
    const m = await send("Runtime.evaluate", { expression: `(async () => { ${FIND} ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || "page error");
    return m.result?.result?.value;
  };
  const shot = async (file) => {
    const m = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(file, Buffer.from(m.result.data, "base64"));
  };
  return { send, run, shot, close: () => { ws.close(); proc.kill(); } };
}
// Finds the card through Home Assistant's shadow roots.
const FIND = `
  const deep = (root, sel) => { const hit = root.querySelector(sel); if (hit) return hit;
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) { const f = deep(el.shadowRoot, sel); if (f) return f; } return null; };
  const card = deep(document, "autodarts-classic-card");`;

// -- the games ------------------------------------------------------------------------------------
const TWO = ["Joey", "Sam"], ONE = ["Joey"];
const GAMES = [
  ["501", TWO, [["T20", "T20", "S20"], ["S5", "T19", "S1"]]],
  ["cricket", TWO, [["T20", "S19", "D18"], ["T20", "S20", "T17"]]],
  ["cut_throat", TWO, [["T20", "T19", "S18"], ["T20", "S20", "S16"]]],
  ["tactics", TWO, [["T20", "S12", "D10"], ["T11", "S20", "T19"]]],
  ["wild_mouse", TWO, [["T20", "D5", "T19"], ["S18", "D18", "Bull"]]],
  ["killer", ["Joey", "Sam", "Alex"], [["S7"], ["S12"], ["S3"], ["D7", "D12", "S1"]]],
  ["shanghai", TWO, [["S1", "D1", "T1"], ["S1", "S5", "S1"]]],
  ["halve_it", TWO, [["S15", "D15", "S1"], ["S2", "S3", "S4"]]],
  ["golf", TWO, [["D1"], ["T1", "S1"]]],
  ["baseball", TWO, [["T1", "S1", "D1"], ["S1", "S2", "S3"]]],
  ["count_up", TWO, [["T20", "T20", "S20"], ["S5", "S1", "T19"]]],
  ["around_the_clock", ONE, [["S1", "S2", "S3"], ["S4", "Miss", "S5"]]],
  ["doubles", ONE, [["D1", "D2", "Miss"], ["D3", "D4", "D5"]]],
  ["checkout", ONE, [["T20", "S20", "D20"], ["Miss", "S1", "S1"]]],
  ["bobs_27", ONE, [["D1", "Miss", "Miss"], ["D2", "D2", "Miss"]]],
  ["checkout_121", ONE, [["T20", "S20", "S1"], ["S20", "Bull", "Miss"]]],
  ["catch_40", ONE, [["T20", "Miss", "Miss"], ["S1", "S1", "S1"]]],
  ["jdc_challenge", ONE, [["S10", "D10", "T10"], ["S11", "S11", "Miss"]]],
  ["singles", ONE, [["S1", "D1", "T1"], ["S2", "Miss", "S2"]]],
  // The games the card scores itself.
  ["x01_party", ["Joey", "Sam", "Alex", "Mia", "Tom"], [["T20", "T20", "S20"], ["S5", "T19", "S1"]]],
  ["mickey_mouse", TWO, [["T20", "S12", "D13"], ["T14", "S20", "Bull"]]],
  ["cricket_light", TWO, [["T20", "S19", "D18"], ["T17", "S16", "S15"]]],
  ["cricket_party", ["Joey", "Sam", "Alex", "Mia", "Tom", "Ben"], [["T20", "S19", "D18"], ["T20", "S20", "T17"]]],
  ["cut_throat_party", ["Joey", "Sam", "Alex", "Mia", "Tom"], [["T20", "T19", "S18"], ["T20", "S20", "S16"]]],
  ["gotcha", TWO, [["T20", "T20", "S20"], ["T20", "T20", "S20"]]],
  ["lives", TWO, [["T20", "S5", "S1"], ["S5", "S5", "S1"]]],
  ["hi_lo", TWO, [["T20", "S5", "S1"], ["S5", "S5", "S1"]]],
  ["chase_dragon", TWO, [["T10", "T11", "S1"], ["T10", "T12", "Miss"]]],
  ["football", TWO, [["25", "D20", "D16"], ["S1", "Bull", "D5"]]],
  ["snooker", TWO, [["S1", "S20", "S2"], ["S3", "S16", "Miss"]]],
  ["random_checkout", ONE, [["T20", "S20", "D20"], ["S5", "S1", "Miss"]]],
  ["atc_doubles", ONE, [["D1", "D2", "Miss"], ["D3", "S4", "D4"]]],
  ["atc_trebles", ONE, [["T1", "T2", "Miss"], ["T3", "S4", "T4"]]],
  ["atc_lite", ONE, [["S20", "S2", "S3"], ["S4", "Miss", "S5"]]],
  ["hare_hounds", TWO, [["S13", "S6", "Miss"], ["S20", "S1", "S18"]]],
  ["doubles_ladder", ONE, [["D1", "D2", "Miss"], ["Miss", "Miss", "Miss"]]],
  ["snakes", ["Joey", "Sam", "Alex"], [["T1", "I20", "Bull"], ["D1", "25", "S5"], ["T5", "T5", "I3"]]],
  ["derby", ["Joey", "Sam", "Alex"], [["T20", "S1", "D3"], ["S5", "T12", "S1"], ["S9", "D14", "S20"]]],
  ["tower", TWO, [["T20", "T20", "S20"], ["S5", "T19", "S1"]]],
  ["limbo", TWO, [["S10", "S10", "S10"], ["S10", "S5", "S5"]]],
  ["bull_hunt", TWO, [["25", "Bull", "T20"], ["I20", "S1", "D16"]]],
  ["killer_venue", ["Joey", "Sam", "Alex"], [["T20", "S1", "D3"], ["S5", "T12", "S1"], ["S9", "D14", "S20"]]],
  ["fight", ["Joey", "Sam", "Alex"], [["T20", "S1", "D3"], ["S5", "T12", "S1"], ["S9", "D14", "S20"]]],
  ["conqueror", ["Joey", "Sam", "Alex"], [["T20", "S1", "Bull"], ["S5", "T12", "S1"], ["S9", "D14", "S20"]]],
  ["targets", TWO, [["T20", "S5", "Bull"], ["S19", "D16", "25"]]],
  ["moon_landing", TWO, [["T20", "T20", "S20"], ["S5", "T19", "S1"]]],
  ["beer_tap", TWO, [["T20", "T20", "S20"], ["S5", "T19", "S1"]]],
  ["shanghai_party", ["Joey", "Sam", "Alex"], [["S1", "D1", "S20"], ["T1", "S1", "S5"], ["S1", "S18", "Miss"]]],
  ["scram", TWO, [["S20", "S19", "Bull"], ["T20", "S19", "S5"]]],
];

async function tour([w, h]) {
  const dir = path.join(out, `${w}x${h}`);
  fs.mkdirSync(dir, { recursive: true });
  const b = await browser(w, h);
  await b.send("Page.navigate", { url: SCREEN });
  // Home Assistant may load the dashboard twice (a new frontend version, a reconnect): wait
  // for the card, and again before every game, instead of trusting a fixed pause.
  const ready = async () => {
    for (let i = 0; i < 90; i++) {
      if (await b.run("return !!card && !!card._stage;").catch(() => false)) return;
      await sleep(1000);
    }
    throw new Error(`The game screen did not load at ${SCREEN}`);
  };
  await sleep(4000);
  await ready();
  await b.run(`card._sfx.play = () => {}; card._caller.say = () => {}; card._lobby = true; card._render(); return true;`);
  await b.shot(path.join(dir, "00-lobby.png"));
  // The attract screen, with a made-up session (not saved) for its Top List.
  await b.run(`card._sess = { started: Date.now(), last: Date.now(), lastKey: null, games: [
    { names: ["Joey", "Sam", "Alex"], winners: ["Joey"], game: "501" }, { names: ["Sam", "Joey"], winners: ["Sam"], game: "cricket" },
    { names: ["Alex", "Joey", "Sam"], winners: ["Alex"], game: "snakes" }, { names: ["Joey", "Alex"], winners: ["Joey"], game: "derby" }] };
    card._active = 0; card._idleTick(); return true;`);
  await sleep(1500);
  await b.shot(path.join(dir, "00-idle.png"));
  // The trophies of that night, the teams in the lobby and the page for your own voice.
  await b.run("card._idleOff(); card._act('trophies'); return true;");
  await sleep(800);
  await b.shot(path.join(dir, "01-trophies.png"));
  await b.run(`card._trophies = false; card._sess = null; card._setup.players = ["Joey", "Sam", "Alex", "Mia"]; card._setup.teams = "pairs"; card._setup.game = "x01_party"; card._render(); return true;`);
  await sleep(600);
  await b.shot(path.join(dir, "02-teams-lobby.png"));
  await b.run(`card._setup.teams = "off"; card._openVoice(); return true;`);
  await sleep(600);
  await b.shot(path.join(dir, "03-voice.png"));
  await b.run("card._closeVoice(); card._render(); return true;");
  for (const [game, players, visits] of GAMES) {
    if (only.length && !only.includes(game)) continue;
    process.stdout.write(`${w}x${h} ${game} `);
    await takeout();
    await ready();
    await b.run(`card._wm = null; card._saveWm(); card._setup.players = ${JSON.stringify(players)}; card._setup.game = ${JSON.stringify(game)};
      card._setup.legs = 1; await card._start(); return true;`);
    await sleep(2500);
    await b.shot(path.join(dir, `${game}-0-start.png`));
    let step = 1;
    for (const v of visits) {
      await visit(v);
      await sleep(1200);
      await b.shot(path.join(dir, `${game}-${step}-visit.png`));
      await takeout();
      step += 1;
    }
    await sleep(800);
    await b.shot(path.join(dir, `${game}-${step}-after.png`));
    // The game shot screen of the card's own games: player 1 wins.
    if (await b.run("if (!card._wm || card._wm.winner != null) return false; if (card._wm.winLeg) card._wm.winLeg(0); else card._wm.winner = card._wm.legWinner = 0; card._render(); return true;")) {
      await sleep(1800);
      await b.shot(path.join(dir, `${game}-${step + 1}-result.png`));
    }
    // End the game: the card's own games end locally, the integration's through the select.
    await b.run(`if (card._wm) { card._wm = null; card._saveWm(); } else { await card._call("select", "select_option", { entity_id: card._id("select", "practice_game"), option: "off" }); }
      card._lobby = true; card._render(); return true;`);
    await sleep(1500);
    console.log("ok");
  }
  b.close();
}

for (const s of sizes) await tour(s);
console.log(`Screenshots in ${out}`);
