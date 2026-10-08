// Tonight's Top List and the attract screen between games (#8).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.K = { sessionTable };", ctx);
const { sessionTable } = ctx.K;

function start(game, players = ["Joey", "Sam"], m = mount(states([], { game: "off" }))) {
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = players;
  m.el._act("new");
  m.$(`[data-act="game"][data-value="${game}"]`).click();
  m.$('[data-act="start"]').click();
  return m;
}
const win = (m, i = 0) => { m.el._wm.winLeg(i); m.el._render(); };
const games = (m) => m.el._session().games;

test("points: 3, 2 and 1 for the first three; a shared win is 3 each and the next is third", () => {
  const t = sessionTable([
    { names: ["A", "B", "C", "D"], winners: ["A"] },
    { names: ["B", "A", "C"], winners: ["B", "A"] },
  ]);
  const pts = Object.fromEntries(t.map((r) => [r.name, r.pts]));
  assert.deepEqual(pts, { A: 6, B: 5, C: 2, D: 0 });
  assert.equal(t[0].name, "A");
  assert.equal(t[0].wins, 2);
});

test("a finished game counts once, however often the game shot screen is drawn", () => {
  const m = start("x01_party");
  win(m, 1);
  m.el._render(); m.el._render();
  assert.equal(games(m).length, 1);
  assert.deepEqual([...games(m)[0].names], ["Sam", "Joey"]);
  assert.deepEqual([...games(m)[0].winners], ["Sam"]);
});

test("undo on the game shot screen takes the game off the Top List again", () => {
  const m = start("x01_party");
  m.el._wm.dart("T20"); m.el._render();
  win(m, 0);
  assert.equal(games(m).length, 1);
  m.el._act("undo");
  assert.equal(games(m).length, 0);
  win(m, 1);
  assert.equal(games(m).length, 1);
  assert.equal(games(m)[0].winners[0], "Sam");
});

test("a reload on the game shot screen does not count the game twice", () => {
  const m = start("x01_party");
  win(m, 0);
  const again = document.createElement("autodarts-classic-card");
  again.setConfig({ board_url: "http://board:3180" });
  document.body.appendChild(again);
  again.hass = { states: states([], { game: "off" }), devices: {}, callService: async () => {} };
  assert.equal(again._session().games.length, 1);
});

test("a rematch with the same result counts as a new game; solo games do not count", () => {
  const m = start("x01_party");
  win(m, 0);
  m.el._act("rematch");
  win(m, 0);
  assert.equal(games(m).length, 2);
  const solo = start("snakes", ["Joey"]);
  win(solo, 0);
  assert.equal(games(solo).length, 0);
});

test("the lobby shows tonight's Top List, and New session clears it after a second tap", () => {
  const m = start("x01_party");
  win(m, 0);
  m.el._act("new");
  assert.match(m.$(".toplist").textContent, /Joey[\s\S]*3[\s\S]*Sam[\s\S]*2/);
  m.$('[data-act="new-session"]').click();
  assert.ok(m.$(".toplist"), "one tap only asks");
  m.$('[data-act="new-session"]').click();
  assert.equal(m.$(".toplist"), null);
});

test("an old session is forgotten after the gap", () => {
  const m = start("x01_party");
  win(m, 0);
  m.el._sess.last = Date.now() - 7 * 3600e3;
  assert.equal(m.el._session().games.length, 0);
});

test("the attract screen comes after the quiet minutes in the lobby and goes on any key", () => {
  const m = mount(states([], { game: "off" }));
  m.el._active = Date.now() - 10 * 60e3;
  m.el._idleTick();
  const layer = m.$(".idle-layer");
  assert.ok(layer.classList.contains("open"));
  assert.match(layer.textContent, /Tonight's Top List/);
  assert.match(layer.textContent, /Throw a dart or tap the screen to play/);
  window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "x" }));
  assert.equal(layer.classList.contains("open"), false);
});

test("the attract screen never covers a game being played, and idle: 0 turns it off", () => {
  const m = start("x01_party");
  m.el._active = 0;
  m.el._idleTick();
  assert.equal(m.$(".idle-layer").classList.contains("open"), false);
  const off = mount(states([], { game: "off" }), { idle: 0 });
  off.el._active = 0;
  off.el._idleTick();
  assert.equal(off.$(".idle-layer").classList.contains("open"), false);
});

test("the attract screen shows the board's records and the moment pictures, and a tap wakes it", () => {
  const s = states([], { game: "off" });
  s[`sensor.${P}_personal_best`] = { state: "2026-09-28T10:00:00+00:00", attributes: { highest_visit: 140, highest_checkout: 121, record: "highest_visit", value: 140, name: "Joey" }, last_updated: "1" };
  const m = mount(s, { moments: { 180: "/local/darts/180.jpg" } });
  m.el._active = 0;
  m.el._idleTick();
  assert.match(m.$(".idle-layer").textContent, /Highest visit\s*140[\s\S]*Highest checkout\s*121/);
  m.el._slideAt = 0; m.el._renderIdle();
  assert.ok(m.$(".idle-moment img"));
  m.$(".idle-layer").click();
  assert.equal(m.$(".idle-layer").classList.contains("open"), false);
});
