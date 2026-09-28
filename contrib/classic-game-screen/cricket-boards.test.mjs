// Machine-style cricket boards and Wild Mouse's automatic next player, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

// A Wild Mouse game for two, the effects and caller kept quiet.
function wildMouse(extra = {}) {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = ["A", "B"];
  Object.assign(m.el._setup, extra);
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  m.$('[data-act="start"]').click();
  m.w = m.el._wm;
  m.v = (...d) => { d.forEach((x) => m.w.dart(x)); m.w.next(); m.el._render(); };
  m.row = (key) => m.$$(".crow[data-row]").find((r) => r.dataset.row === String(key));
  return m;
}

test("aim hints: Score where the thrower closed and others are open, Close where others closed", () => {
  const m = wildMouse();
  m.v("T20");        // A closes 20
  m.v("T19");        // B closes 19
  // A to throw: 20 is A's to score on, 19 is B's to score on unless A closes it
  assert.ok(m.row(20).classList.contains("hint-score")); assert.match(m.row(20).textContent, /Score/);
  assert.ok(m.row(19).classList.contains("hint-close")); assert.match(m.row(19).textContent, /Close/);
  assert.equal(m.row(18).className.includes("hint-"), false);
});

test("the integration's cricket gets the hints too", () => {
  const s = states([], { game: "cricket" });
  s[`sensor.${P}_practice_remaining_score`].attributes = {
    game: "cricket", player: 1, visit: [], numbers: [20, 19, 18, 17, 16, 15, 25],
    scores: [{ player: 1, name: "A", points: 0, marks: [3, 0, 0, 0, 0, 0, 0] }, { player: 2, name: "B", points: 0, marks: [0, 3, 0, 0, 0, 0, 0] }],
  };
  const { $$ } = mount(s);
  const row = (k) => $$(".crow[data-row]").find((r) => r.dataset.row === String(k));
  assert.ok(row(20).classList.contains("hint-score")); assert.ok(row(19).classList.contains("hint-close"));
});

test("a dart on a target everybody closed gets a shield", () => {
  const m = wildMouse();
  m.v("T20"); m.v("T20"); // both closed 20
  m.w.dart("S20"); m.el._render();
  assert.ok(m.row(20).classList.contains("shielded")); assert.ok(m.row(20).querySelector(".shield"));
});

test("the integration's cricket shows the shield from the board's marks", () => {
  const mk = (visit, player = 1) => {
    const s = states(visit, { game: "cricket" });
    s[`sensor.${P}_practice_remaining_score`].attributes = {
      game: "cricket", player, visit, numbers: [20, 19, 18, 17, 16, 15, 25],
      scores: [{ player: 1, name: "A", points: 0, marks: [3, 0, 0, 0, 0, 0, 0] }, { player: 2, name: "B", points: 0, marks: [3, 0, 0, 0, 0, 0, 0] }],
    };
    return s;
  };
  const m = mount(mk([]));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el.hass = { ...m.el._hass, states: mk(["S20"]) };
  assert.ok(m.$$(".crow[data-row]").find((r) => r.dataset.row === "20").classList.contains("shielded"));
});

test("points just scored float up from the card", () => {
  const m = wildMouse();
  m.v("T20"); m.v("S1");
  m.w.dart("S20"); m.el._render(); // A scores 20 on the closed 20
  assert.equal(m.$(".player .pts-badge")?.textContent, "+20");
});

test("Wild Mouse moves on by itself after the third dart when asked to", async () => {
  const m = wildMouse({ autoNext: 0.05 });
  ["S1", "S2", "S3"].forEach((d) => m.w.dart(d)); m.el._render();
  assert.match(m.$(".player.active .turn-tag").textContent, /Next player in/);
  assert.equal(m.w.current, 0);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(m.w.current, 1, "B is up");
  m.el.remove();
});

test("without auto next the thrower is asked to pull the darts, and nothing moves", async () => {
  const m = wildMouse({ autoNext: 0 });
  ["S1", "S2", "S3"].forEach((d) => m.w.dart(d)); m.el._render();
  assert.match(m.$(".player.active .turn-tag").textContent, /Pull your darts/);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(m.w.current, 0);
});

test("the auto-next option is on the New game screen for Wild Mouse", () => {
  const m = mount(states([], { game: "off" }));
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  m.$('[data-act="auto_next"][data-value="5"]').click();
  assert.equal(m.el._setup.autoNext, 5);
  assert.ok(m.$('[data-act="auto_next"][data-value="5"].on'));
});
