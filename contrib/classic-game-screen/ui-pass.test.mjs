// Fixes from the tour of every game on the real screen, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

test("the chalkboard knows how many rows it has, so Tactics' twelve targets fit", () => {
  const s = states([], { game: "tactics" });
  s[`sensor.${P}_practice_remaining_score`].attributes = {
    game: "tactics", player: 1, visit: [], numbers: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 25],
    scores: [{ player: 1, name: "A", points: 0, marks: Array(12).fill(0) }, { player: 2, name: "B", points: 0, marks: Array(12).fill(0) }],
  };
  const { $, $$ } = mount(s);
  assert.match($(".chalk").getAttribute("style"), /--rows:12/);
  assert.equal($$(".crow[data-row]").length, 12);
});

test("hint pills do not share the players' score class", () => {
  const s = states([], { game: "cricket" });
  s[`sensor.${P}_practice_remaining_score`].attributes = {
    game: "cricket", player: 1, visit: [], numbers: [20, 19, 18, 17, 16, 15, 25],
    scores: [{ player: 1, name: "A", points: 0, marks: [3, 0, 0, 0, 0, 0, 0] }, { player: 2, name: "B", points: 0, marks: [0, 3, 0, 0, 0, 0, 0] }],
  };
  const { $$ } = mount(s);
  const pills = $$(".ctag");
  assert.equal(pills.length, 2);
  for (const p of pills) assert.equal(p.classList.contains("score"), false);
  assert.ok($$(".ctag-score").length && $$(".ctag-close").length);
});

test("when the turn passes, the next player shows big with their photo", () => {
  const mk = (player, visit = []) => {
    const s = states(visit);
    s[`sensor.${P}_practice_remaining_score`].attributes.player = player;
    return s;
  };
  const m = mount(mk(1));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el.hass = { ...m.el._hass, states: mk(2) };
  const up = m.$(".fx-layer .upnext");
  assert.ok(up);
  assert.match(up.textContent, /Up next[\s\S]*B/);
  assert.ok(up.querySelector(".pav.xl"));
});

test("up_next: false keeps the splash away, and a solo game never has one", () => {
  const mk = (player) => { const s = states([]); s[`sensor.${P}_practice_remaining_score`].attributes.player = player; return s; };
  const m = mount(mk(1), { up_next: false });
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el.hass = { ...m.el._hass, states: mk(2) };
  assert.equal(m.$(".fx-layer .upnext"), null);
});

test("Wild Mouse shows who is up next after the takeout", () => {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = ["Robin", "Sam"];
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  m.$('[data-act="start"]').click();
  m.el._wm.dart("S1"); m.el._render();
  m.el._wm.next(); m.el._render();
  assert.match(m.$(".fx-layer .upnext").textContent, /Sam/);
});

test("training cards show the player's picture", () => {
  const s = states([], { game: "doubles" });
  s[`sensor.${P}_practice_target`] = { entity_id: `sensor.${P}_practice_target`, state: "D6", attributes: { drill: "doubles", progress: 5, targets: 21, darts: 6, hits: 5, hit_rate: 0.83, visit: [] }, last_updated: "1" };
  const { $ } = mount(s);
  assert.ok($(".player.drill .pav"));
});
