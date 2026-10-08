"""A dart simulator for the game screen demo: click the board and the simulated Autodarts
board reports the dart, with its position, like a real board does.

Serves a page on port 8080 and forwards to the board double's control API, so the page
needs no cross-origin requests.
"""

from __future__ import annotations

import os

import aiohttp
from aiohttp import web

BOARD = os.environ.get("BOARD", "http://board-mock:3180")
throws: list[dict] = []


async def publish(state: dict) -> None:
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{BOARD}/control/state", json=state) as response:
            response.raise_for_status()


async def throw(request: web.Request) -> web.Response:
    dart = await request.json()
    if len(throws) >= 3:
        return web.json_response(
            {"throws": throws, "note": "Three darts are in: pull them first"}
        )
    segment = {key: dart[key] for key in ("name", "number", "multiplier", "bed")}
    entry = {
        "segment": segment,
        "coords": {"x": float(dart.get("x", 0)), "y": float(dart.get("y", 0))},
    }
    if dart.get("bouncer"):
        entry["bouncer"] = True
    throws.append(entry)
    await publish({"status": "Throw", "event": "Throw detected", "throws": throws})
    return web.json_response({"throws": throws})


async def takeout(request: web.Request) -> web.Response:
    throws.clear()
    await publish({"status": "Takeout in progress", "event": "Takeout started"})
    await publish({"status": "Throw", "event": "Takeout finished", "throws": []})
    return web.json_response({"throws": throws})


async def state(request: web.Request) -> web.Response:
    return web.json_response({"throws": throws})


async def page(request: web.Request) -> web.Response:
    return web.Response(text=PAGE, content_type="text/html")


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dart simulator</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #07080c; color: #fff; font: 16px system-ui, sans-serif; display: grid; grid-template-columns: minmax(0, 1fr) 340px; min-height: 100vh; }
  @media (max-width: 900px) { body { grid-template-columns: 1fr; } }
  #board { width: min(92vh, 100%); max-width: 900px; margin: auto; display: block; cursor: crosshair; }
  aside { padding: 20px; background: #12141d; display: flex; flex-direction: column; gap: 12px; }
  h1 { margin: 0; font-size: 1.3rem; }
  p { margin: 0; opacity: 0.75; line-height: 1.4; }
  .visit { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .visit div { background: #1e2130; border-radius: 10px; padding: 14px 0; text-align: center; font-size: 1.6rem; font-weight: 800; min-height: 1.2em; }
  button { font: inherit; font-weight: 700; color: #fff; background: #262a3b; border: 1px solid #353a52; border-radius: 10px; padding: 12px; cursor: pointer; }
  button:hover { background: #31364c; }
  button.primary { background: #fff; color: #0b0d14; }
  .quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .note { color: #fcd34d; min-height: 1.3em; }
  .bed:hover { filter: brightness(1.35); }
</style></head><body>
<svg id="board" viewBox="-1.25 -1.25 2.5 2.5"></svg>
<aside>
  <h1>Dart simulator</h1>
  <p>Click where the dart lands. The simulated Autodarts board reports it to Home Assistant and the game screen, with its position, like your real board.</p>
  <div class="visit" id="visit"><div></div><div></div><div></div></div>
  <button class="primary" id="takeout">Pull the darts (takeout)</button>
  <div class="quick">
    <button data-q="T20">T20</button><button data-q="T19">T19</button><button data-q="Bull">Bull</button><button data-q="25">25</button>
    <button data-q="D20">D20</button><button data-q="D16">D16</button><button data-q="S20">S20</button><button data-q="S1">S1</button>
  </div>
  <div class="quick" style="grid-template-columns: 1fr 1fr 1fr">
    <button id="miss">Off the board</button><button id="bounce">Bounce out</button><button id="random">Random</button>
  </div>
  <button id="t180">Throw a 180 (T20 ×3)</button>
  <p class="note" id="note"></p>
  <p>Open the game screen at <b>http://localhost:18125/darts-classic/game</b>.</p>
</aside>
<script>
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const R = { bull: 6.35 / 170, outer: 15.9 / 170, tin: 99 / 170, tout: 107 / 170, din: 162 / 170 };
const svg = document.getElementById("board");
const pol = (r, deg) => { const a = deg * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
const wedge = (r1, r2, a1, a2) => { const [x1, y1] = pol(r2, a1), [x2, y2] = pol(r2, a2), [x3, y3] = pol(r1, a2), [x4, y4] = pol(r1, a1);
  return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`; };
let html = '<circle r="1.24" fill="#101014"/>';
ORDER.forEach((n, i) => {
  const a1 = -99 + i * 18, a2 = a1 + 18, dark = i % 2 === 0, s = dark ? "#1b1b1f" : "#efe3c2", c = dark ? "#d13b3b" : "#1f9d55";
  html += `<path class="bed" d="${wedge(R.outer, R.tin, a1, a2)}" fill="${s}"/><path class="bed" d="${wedge(R.tin, R.tout, a1, a2)}" fill="${c}"/>`;
  html += `<path class="bed" d="${wedge(R.tout, R.din, a1, a2)}" fill="${s}"/><path class="bed" d="${wedge(R.din, 1, a1, a2)}" fill="${c}"/>`;
  const [tx, ty] = pol(1.13, -90 + i * 18);
  html += `<text x="${tx}" y="${ty}" fill="#fff" font-size="0.12" font-weight="700" text-anchor="middle" dominant-baseline="central">${n}</text>`;
});
html += `<circle class="bed" r="${R.outer}" fill="#1f9d55"/><circle class="bed" r="${R.bull}" fill="#d13b3b"/><g id="marks"></g>`;
svg.innerHTML = html;

// Where a click lands on the board, as Autodarts reports it (y pointing up).
function dartAt(x, y) {
  const r = Math.hypot(x, y);
  const deg = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360; // 0 at the top, clockwise
  const n = ORDER[Math.floor(((deg + 9) % 360) / 18)];
  if (r <= R.bull) return { name: "Bull", number: 25, multiplier: 2, bed: "Double" };
  if (r <= R.outer) return { name: "25", number: 25, multiplier: 1, bed: "Single" };
  if (r > 1) return { name: "Miss", number: 0, multiplier: 0, bed: "Miss" };
  if (r >= R.din) return { name: `D${n}`, number: n, multiplier: 2, bed: "Double" };
  if (r >= R.tin && r <= R.tout) return { name: `T${n}`, number: n, multiplier: 3, bed: "Triple" };
  return { name: `S${n}`, number: n, multiplier: 1, bed: r < R.tin ? "SingleInner" : "SingleOuter" };
}
// A spot in the middle of a named bed, for the quick buttons.
function spot(name) {
  if (name === "Bull") return [0.01, 0.01];
  if (name === "25") return [0.02, 0.06];
  const n = Number(name.slice(1)), i = ORDER.indexOf(n), r = { T: (R.tin + R.tout) / 2, D: (R.din + 1) / 2, S: 0.8 }[name[0]];
  const deg = i * 18 + (Math.random() - 0.5) * 10, a = deg * Math.PI / 180;
  return [r * Math.sin(a), r * Math.cos(a)];
}
async function send(dart, x, y, extra = {}) {
  const res = await fetch("throw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...dart, x, y, ...extra }) });
  show(await res.json());
}
function show(s) {
  const cells = document.querySelectorAll("#visit div");
  cells.forEach((c, i) => { const t = s.throws[i]; c.textContent = t ? (t.bouncer ? "Bounce" : t.segment.name) : ""; });
  document.getElementById("marks").innerHTML = s.throws.map((t, i) => `<g transform="translate(${t.coords.x} ${-t.coords.y})"><circle r="0.045" fill="#22d3ee" stroke="#000" stroke-width="0.01"/><text y="0.004" font-size="0.05" font-weight="800" text-anchor="middle" dominant-baseline="central">${i + 1}</text></g>`).join("");
  document.getElementById("note").textContent = s.note || "";
}
svg.addEventListener("click", (ev) => {
  const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  const x = q.x, y = -q.y;
  send(dartAt(x, y), x, y);
});
document.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { const [x, y] = spot(b.dataset.q); send(dartAt(x, y), x, y); }));
document.getElementById("miss").onclick = () => send({ name: "Miss", number: 0, multiplier: 0, bed: "Miss" }, 1.1, 0.3);
document.getElementById("bounce").onclick = () => send({ name: "Miss", number: 0, multiplier: 0, bed: "Miss" }, 0, 0.6, { bouncer: true });
document.getElementById("random").onclick = () => { const a = Math.random() * Math.PI * 2, r = Math.random() * 1.05; const x = r * Math.sin(a), y = r * Math.cos(a); send(dartAt(x, y), x, y); };
document.getElementById("t180").onclick = async () => { for (let i = 0; i < 3; i++) { const [x, y] = spot("T20"); await send(dartAt(x, y), x, y); await new Promise((r) => setTimeout(r, 700)); } };
document.getElementById("takeout").onclick = async () => show(await (await fetch("takeout", { method: "POST" })).json());
fetch("state").then((r) => r.json()).then(show);
</script></body></html>"""


def main() -> None:
    app = web.Application()
    app.add_routes(
        [
            web.get("/", page),
            web.get("/state", state),
            web.post("/throw", throw),
            web.post("/takeout", takeout),
        ]
    )
    web.run_app(app, host="0.0.0.0", port=8080, print=None)


if __name__ == "__main__":
    main()
