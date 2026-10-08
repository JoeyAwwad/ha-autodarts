// Heat on the board, grouping, the score chart and the moments gallery (#10), and the X01
// calls of Party X01.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.K = { groupingMm };", ctx);
const { groupingMm } = ctx.K;

const dart = (name, x, y) => ({ segment: { name }, coords: { x, y } });
const send = (m, throws) => m.el._ws.onmessage({ data: JSON.stringify({ type: "state", data: { status: "Throw", throws } }) });
function start(game, players = ["Joey", "Sam"], config = {}, setup = {}) {
  const m = mount(states([], { game: "off" }), config);
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  Object.assign(m.el._setup, { players, ...setup });
  m.$(`[data-act="game"][data-value="${game}"]`).click();
  m.$('[data-act="start"]').click();
  m.el._fxArmed = true;
  return m;
}
const visit3 = (m, darts) => { const t = []; for (const d of darts) { t.push(d); send(m, [...t]); } send(m, []); };

test("grouping: the mean distance of a visit's darts from their middle, in millimetres", () => {
  assert.equal(groupingMm([[0, 0, 0], [0.1, 0, 0]]), Math.round(0.05 * 170));
  assert.equal(groupingMm([[0, 0, 0]]), null, "one dart is no group");
  assert.equal(groupingMm([[0, 0, 0], [0.2, 0, 0], [0.5, 0.5, 1]]), 17, "visits with one dart do not count");
});

test("the thrower's earlier darts glow on the drawn board; heat: false turns it off", () => {
  const m = start("x01_party");
  visit3(m, [dart("T20", 0, 0.6), dart("T20", 0.01, 0.61), dart("S20", 0.02, 0.8)]); // Joey
  visit3(m, [dart("S5", -0.2, 0.7)]); // Sam
  assert.equal(m.el._stats().spots.Joey.length, 3);
  assert.equal(m.el._stats().spots.Sam.length, 1);
  assert.equal(m.$$(".virtual .heat").length, 3, "Joey's three darts under his next visit");
  const off = start("x01_party", ["Joey", "Sam"], { heat: false });
  visit3(off, [dart("T20", 0, 0.6)]); visit3(off, [dart("S5", -0.2, 0.7)]);
  assert.equal(off.$$(".virtual .heat").length, 0);
});

test("the game shot screen shows each player's darts and grouping, and Party X01's score chart", () => {
  const m = start("x01_party", ["Joey", "Sam"], {}, { start: 301 });
  visit3(m, [dart("T20", 0, 0.6), dart("T20", 0.01, 0.6), dart("T20", 0.02, 0.61)]); // 121
  visit3(m, [dart("S1", 0.3, 0.9)]);
  visit3(m, [dart("T20", 0, 0.6), dart("T19", -0.2, -0.57), dart("D2", 0.9, 0.3)]); // 121 - 60 - 57 - 4 = 0
  assert.equal(m.el._wm.winner, 0);
  const rows = m.$$(".res-row");
  assert.ok(rows[0].querySelector(".mini-board"));
  assert.match(rows[0].textContent, /\d+ mm\s*grouping/);
  assert.ok(m.$(".score-chart polyline"));
  assert.match(m.$(".chart-key").textContent, /Joey[\s\S]*Sam/);
});

test("the integration's X01 chart follows the remaining, and an undo takes a visit back", () => {
  const mk = (rem) => {
    const s = states([], { game: "501" });
    s[`sensor.${P}_practice_remaining_score`].attributes.scores = [{ player: 1, name: "A", remaining: rem[0] }, { player: 2, name: "B", remaining: rem[1] }];
    return s;
  };
  const m = mount(mk([501, 501]));
  for (const r of [[441, 501], [441, 401], [381, 401], [441, 401], [300, 401]]) m.el.hass = { ...m.el._hass, states: mk(r) };
  assert.deepEqual(m.el._stats().trail.A, [501, 441, 300]);
  assert.deepEqual(m.el._stats().trail.B, [501, 401]);
});

test("Party X01 gets the X01 calls: a 180 is celebrated and kept for the gallery", () => {
  const m = start("x01_party");
  const said = [];
  m.el._caller.say = (...l) => said.push(l.map((x) => x[1] || x).join(" "));
  m.el._announce = (...l) => said.push(l.map((x) => x[1]).join(" "));
  visit3(m, [dart("T20", 0, 0.6), dart("T20", 0.01, 0.6), dart("T20", 0.02, 0.61)]);
  assert.ok(said.some((l) => /One hundred and eighty/.test(l)), said.join(" | "));
  const kept = JSON.parse(localStorage.getItem("autodarts-classic:moments") || "[]");
  assert.equal(kept.at(-1).kind, "180");
  assert.equal(kept.at(-1).name, "Joey");
  assert.equal(kept.at(-1).darts.length, 3);
});

test("the attract screen shows the moments gallery", () => {
  const m = start("x01_party");
  visit3(m, [dart("T20", 0, 0.6), dart("T20", 0.01, 0.6), dart("T20", 0.02, 0.61)]);
  m.el._act("end"); m.el._act("end");
  m.el._active = 0; m.el._idleTick();
  const figs = m.el._idleSlides().join("");
  assert.match(figs, /Joey · 180/);
});

test("the darts of the leg survive a reload of the page", () => {
  const m = start("x01_party");
  visit3(m, [dart("T20", 0, 0.6), dart("T20", 0.01, 0.61), dart("S20", 0.02, 0.8)]);
  const again = document.createElement("autodarts-classic-card");
  again.setConfig({ board_url: "http://board:3180" });
  document.body.appendChild(again);
  again.hass = { states: states([], { game: "off" }), devices: {}, callService: async () => {} };
  assert.equal(again._wm.kind, "x01_party", "the game comes back");
  assert.equal(again._stats().spots.Joey.length, 3, "and so do its darts");
});
