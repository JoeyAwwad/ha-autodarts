// The board games' layout on the screen, read from the oche: the game's own board gets the
// space, the visit total only where it means something, icons that every screen can draw.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { states, mount } from "./dom-helpers.mjs";

function start(game, players = ["Robin", "Sam"]) {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = players;
  m.$(`[data-act="game"][data-value="${game}"]`).click();
  m.$('[data-act="start"]').click();
  return m;
}
const stage = (m) => m.$(".stage");

test("a game with its own board switches the screen to the board layout, and back", () => {
  const m = start("snakes");
  assert.ok(stage(m).classList.contains("board-mode"));
  m.el._wm = null; m.el._saveWm();
  m.el.hass = { ...m.el._hass, states: states([], { game: "501" }) };
  assert.equal(stage(m).classList.contains("board-mode"), false);
});

test("games without a board of their own keep the normal layout", () => {
  const m = start("x01_party");
  assert.equal(stage(m).classList.contains("board-mode"), false);
});

test("Snakes & Ladders draws all 50 squares with their numbers, a token per player and the roll key", () => {
  const m = start("snakes", ["Robin", "Sam", "Alex"]);
  const cells = m.$$(".slgrid .slc");
  assert.equal(cells.length, 50);
  assert.deepEqual(cells.map((c) => Number(c.textContent)).sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(m.$$(".sltok").length, 3);
  assert.equal(m.$$(".sltok.start").length, 3);
  assert.match(m.$(".slkey").textContent, /6\s*Bull[\s\S]*1\s*Double/);
  // Every snake has a head on its top square, every ladder foot and snake head is marked.
  assert.equal(m.$$(".slhead").length, 5);
  assert.equal(m.$$(".slc.up").length, 5);
  assert.equal(m.$$(".slc.down").length, 5);
});

test("Snakes & Ladders lights the thrower's square and moves the token there", () => {
  const m = start("snakes");
  m.el._wm.dart("T1"); m.el._render(); // a treble moves 3
  const lit = m.$$(".slc.cur");
  assert.equal(lit.length, 1);
  assert.equal(lit[0].textContent, "3");
  const tok = m.$(".sltok.cur");
  assert.ok(tok && !tok.classList.contains("start"));
});

test("squares in the grid sit where the board snakes: 1 bottom left, 11 above 10, 50 top right", () => {
  const m = start("snakes");
  const at = (n) => m.$$(".slc").find((c) => c.textContent === String(n)).getAttribute("style");
  assert.match(at(1), /grid-column:1;grid-row:5/);
  assert.match(at(10), /grid-column:10;grid-row:5/);
  assert.match(at(11), /grid-column:10;grid-row:4/);
  assert.match(at(41), /grid-column:1;grid-row:1/);
  assert.match(at(50), /grid-column:10;grid-row:1/);
});

test("games that do not score points hide the visit total; points games keep it", () => {
  for (const game of ["snakes", "chase_dragon", "derby", "atc_lite", "killer_venue", "conqueror", "doubles_ladder"]) {
    const m = start(game);
    assert.equal(m.$(".turn .total"), null, game);
    assert.ok(m.$(".turn.no-total"), game);
  }
  for (const game of ["tower", "gotcha", "beer_tap"]) {
    const m = start(game);
    assert.ok(m.$(".turn .total"), game);
  }
});

test("target strips wrap into rows for few players and stay on one row for many", () => {
  const rows = (m) => Number(/--rows:(\d+)/.exec(m.$(".gpanel.seqs").getAttribute("style"))[1]);
  const cols = (m) => Number(/--cols:(\d+)/.exec(m.$(".gpanel.seqs").getAttribute("style"))[1]);
  const solo = start("atc_lite", ["Robin"]);
  assert.ok(rows(solo) >= 3);
  assert.ok(rows(solo) * cols(solo) >= 21);
  const many = start("atc_lite", ["A", "B", "C", "D", "E", "F", "G", "H"]);
  assert.equal(rows(many), 1);
  assert.equal(cols(many), 21);
  // Every target is still there, in order.
  assert.deepEqual(solo.$$(".seq-cells i").map((i) => i.textContent).slice(0, 3), ["1", "2", "3"]);
  assert.equal(solo.$$(".seq-cells i").at(-1).textContent, "Bull");
});

test("the buttons draw their icons instead of emoji or symbols a kiosk font may lack", () => {
  const m = start("snakes");
  const html = m.el.shadowRoot.innerHTML;
  for (const glyph of ["⛶", "⏭", "🔊", "🔇"]) assert.equal(html.includes(glyph), false, glyph);
  assert.ok(m.$('[data-act="full"] svg.uic'));
  assert.ok(m.$('[data-act="mute"] svg.uic'));
  assert.ok(m.$('[data-act="next"] svg.uic'));
});
