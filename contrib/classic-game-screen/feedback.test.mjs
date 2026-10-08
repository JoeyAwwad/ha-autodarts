// Feedback on every dart: effects, celebrations and the caller, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

// A card whose sounds and calls are recorded instead of played.
function spied(hassStates, config) {
  const m = mount(hassStates, config);
  m.sounds = []; m.lines = [];
  m.el._sfx.play = (name) => m.sounds.push(name);
  m.el._caller.say = (...lines) => m.lines.push(...lines.map((l) => l[0]));
  m.update = (s) => { m.el.hass = { ...m.el._hass, states: s }; };
  return m;
}
const x01 = (visit, attrs = {}, extra = {}) => {
  const s = states(visit, { extra });
  Object.assign(s[`sensor.${P}_practice_remaining_score`].attributes, attrs);
  return s;
};

test("loading a game in progress replays nothing", () => {
  const { sounds, lines, $ } = spied(x01(["T20", "T20"]));
  assert.deepEqual(sounds, []); assert.deepEqual(lines, []);
  assert.equal($(".fx-layer").children.length, 0);
});

test("every new dart flashes big, with its own sound", () => {
  const m = spied(x01([]));
  m.update(x01(["T1"]));
  assert.match(m.$(".hitfx.triple").textContent, /T1[\s\S]*Treble/);
  m.update(x01(["T1", "BULL"]));
  assert.match(m.$(".hitfx.bull").textContent, /50[\s\S]*Bullseye/);
  m.update(x01(["T1", "BULL", "MISS"])); // 53: no ton celebration over the flash
  assert.ok(m.$(".hitfx.miss"));
  assert.deepEqual(m.sounds, ["triple", "bull", "miss"]);
  assert.equal(m.$$(".hitfx").length, 1, "one flash at a time");
});

test("a corrected dart does not flash again", () => {
  const m = spied(x01(["S20"]));
  m.update(x01(["T20"]));
  assert.deepEqual(m.sounds, []);
});

test("180 gets the celebration and the call", () => {
  const m = spied(x01(["T20", "T20"]));
  m.update(x01(["T20", "T20", "T20"]));
  assert.match(m.$(".celebrate.max").textContent, /180/);
  assert.ok(m.sounds.includes("180")); assert.deepEqual(m.lines, ["180"]);
});

test("the caller calls the score of a visit, and a ton plus is celebrated", () => {
  const m = spied(x01(["T20", "S20"]));
  m.update(x01(["T20", "S20", "S20"]));
  assert.deepEqual(m.lines, ["score_100"]);
  assert.ok(m.$(".celebrate.ton"));
  const n = spied(x01(["S1", "S5"]));
  n.update(x01(["S1", "S5", "S20"]));
  assert.deepEqual(n.lines, ["score_26"]); assert.equal(n.$(".celebrate"), null);
});

test("a bust is shown and called once", () => {
  const m = spied(x01(["T20"]));
  m.update(x01(["T20", "T20"], { bust: true }));
  m.update(x01(["T20", "T20"], { bust: true }));
  assert.equal(m.lines.filter((l) => l === "bust").length, 1);
  assert.ok(m.$(".celebrate.bust"));
});

test("game shot: confetti, fanfare and the call with the winner's name", () => {
  const m = spied(x01(["T20"]));
  m.update(x01(["T20", "D20"], { winner: 1, legs_to_win: 3 }));
  assert.ok(m.$(".confetti i"));
  assert.ok(m.sounds.includes("win"));
  // A finish of 100 or more is called after the game shot.
  assert.deepEqual(m.lines, ["game_shot_match", "name_a", "checkout", "score_100"]);
});

test("a finish under 100 is only the game shot", () => {
  const m = spied(x01(["S20"]));
  m.update(x01(["S20", "D20"], { winner: 1 }));
  assert.deepEqual(m.lines, ["game_shot", "name_a"]);
});

test("a new thrower on a finish hears what they require", () => {
  const checkout = (state) => ({ [`sensor.${P}_practice_checkout`]: { state, attributes: {}, last_updated: state } });
  const m = spied(x01([], { player: 1 }, checkout("T20 D20")));
  const s = x01([], { player: 2 }, checkout("T20 D20"));
  s[`sensor.${P}_practice_remaining_score`].attributes.scores[1].remaining = 100;
  m.update(s);
  assert.deepEqual(m.lines, ["name_b", "you_require", "score_100"]);
});

test("Wild Mouse: closing Doubles is called, three in a bed celebrated", () => {
  const m = spied(states([], { game: "off" }));
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  m.el._setup.bed = true;
  m.$('[data-act="start"]').click();
  m.lines.length = 0;
  const w = m.el._wm;
  w.dart("D1"); w.dart("D2"); m.el._render();
  w.dart("D3"); m.el._render();
  assert.ok(m.lines.includes("doubles_closed"));
  assert.ok(m.sounds.includes("closed"));
  w.next(); w.dart("S5"); w.dart("S5"); m.el._render(); w.dart("S5"); m.el._render();
  assert.ok(m.lines.includes("three_in_a_bed"));
});

test("starting a game calls Game on", () => {
  const m = spied(states([], { game: "off" }));
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  m.$('[data-act="start"]').click();
  assert.deepEqual(m.lines, ["game_on"]);
});

test("the mute button silences effects and caller, and brings them back", () => {
  const m = spied(x01([]));
  m.$('[data-act="mute"]').click();
  assert.equal(m.el._soundOn, false); assert.equal(m.el._callerOn, false);
  m.update(x01(["T20"]));
  assert.deepEqual(m.sounds, []);
  m.$('[data-act="mute"]').click();
  assert.equal(m.el._soundOn, true); assert.equal(m.el._callerOn, true);
});

test("sound: false and caller: false in the config start silent", () => {
  const m = spied(x01([]), { sound: false, caller: false });
  m.update(x01(["T20", "T20", "T20"]));
  assert.deepEqual(m.sounds, []); assert.deepEqual(m.lines, []);
});

test("numbers are called the way a caller says them", () => {
  const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8") + "\nthis.numberWords = numberWords;", ctx);
  const w = ctx.numberWords;
  assert.equal(w(0), "zero"); assert.equal(w(26), "twenty-six"); assert.equal(w(100), "one hundred");
  assert.equal(w(140), "one hundred and forty"); assert.equal(w(180), "one hundred and eighty"); assert.equal(w(121), "one hundred and twenty-one");
});
