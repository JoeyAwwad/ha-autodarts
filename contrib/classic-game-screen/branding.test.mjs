// Branding and moment pictures, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

const MOMENTS = { "180": "/local/darts/180.jpg", bull: "/local/darts/bullseye.jpg", t20: "/local/darts/triple20.jpg",
  treble: "/local/darts/treble.jpg", bounce_out: "/local/darts/bounce-out.jpg", miss: "/local/darts/out-of-board.jpg",
  game_shot: "/local/darts/game-shot.jpg", bust: "javascript:alert(1)" };
const x01 = (visit, attrs = {}) => {
  const s = states(visit);
  Object.assign(s[`sensor.${P}_practice_remaining_score`].attributes, attrs);
  return s;
};
function card(visit = [], config = { moments: MOMENTS }) {
  const m = mount(x01(visit), config);
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.update = (v, attrs) => { m.el.hass = { ...m.el._hass, states: x01(v, attrs) }; };
  m.moment = () => m.$(".fx-layer .moment img")?.getAttribute("src");
  return m;
}

test("a T20 shows its picture instead of the flash", () => {
  const m = card([]);
  m.update(["T20"]);
  assert.equal(m.moment(), "/local/darts/triple20.jpg");
  assert.equal(m.$(".hitfx"), null);
});

test("another treble falls back to the treble picture, a single keeps the flash", () => {
  const m = card([]);
  m.update(["T19"]);
  assert.equal(m.moment(), "/local/darts/treble.jpg");
  m.update(["T19", "S5"]);
  assert.ok(m.$(".hitfx.single"));
});

test("bullseye, and a miss off the board", () => {
  const m = card([]);
  m.update(["BULL"]);
  assert.equal(m.moment(), "/local/darts/bullseye.jpg");
  m.update(["BULL", "MISS"]);
  assert.equal(m.moment(), "/local/darts/out-of-board.jpg");
});

test("a miss right after the board flagged a bouncer is a bounce out", () => {
  const m = card([]);
  m.el._bouncedAt = Date.now();
  m.update(["MISS"]);
  assert.equal(m.moment(), "/local/darts/bounce-out.jpg");
});

test("the board's event socket marks bouncers", () => {
  const m = card([]);
  m.el._boardThrows = 0;
  const ws = { onmessage: null };
  m.el._ws = null;
  globalThis.WebSocket = class { constructor() { Object.assign(this, ws); m.sock = this; } close() {} };
  m.el._closeEvents(); m.el._connectEvents();
  m.sock.onmessage({ data: JSON.stringify({ type: "state", data: { status: "Throw", throws: [{ segment: { name: "M" }, bouncer: true }] } }) });
  assert.ok(Date.now() - m.el._bouncedAt < 1000);
  globalThis.WebSocket = class { close() {} };
});

test("180 and game shot pictures; an unsafe picture is ignored", () => {
  const m = card(["T20", "T20"]);
  m.update(["T20", "T20", "T20"]);
  assert.equal(m.moment(), "/local/darts/180.jpg");
  const n = card(["T20"]);
  n.update(["T20", "T20"], { bust: true });
  assert.equal(n.moment(), undefined, "no javascript: picture");
  assert.ok(n.$(".celebrate.bust"), "the built-in bust instead");
  const w = card(["T20"]);
  w.update(["T20", "D20"], { winner: 1 });
  assert.equal(w.moment(), "/local/darts/game-shot.jpg");
  assert.ok(w.$(".confetti"));
});

test("without moments nothing changes", () => {
  const m = card([], {});
  m.update(["T20"]);
  assert.ok(m.$(".hitfx.triple")); assert.equal(m.moment(), undefined);
});

test("logo in the lobby and on the game screen, hero banner in the lobby", () => {
  const cfg = { logo: "/local/darts/logo.png", hero: "/local/darts/hero.jpg", hero_position: "center 30%;background:red" };
  const lobby = mount(states([], { game: "off" }), cfg);
  assert.equal(lobby.$(".logo-head").getAttribute("src"), "/local/darts/logo.png");
  const hero = lobby.$(".hero.wide");
  assert.match(hero.getAttribute("style"), /url\('\/local\/darts\/hero\.jpg'\)/);
  assert.doesNotMatch(hero.getAttribute("style"), /background:red/, "position is cleaned");
  const game = mount(states(["S20"]), cfg);
  assert.equal(game.$(".boardwrap .logo-mark").getAttribute("src"), "/local/darts/logo.png");
  const bad = mount(states(["S20"]), { logo: "javascript:alert(1)" });
  assert.equal(bad.$(".logo-mark"), null);
});

test("the red theme is offered", () => {
  const { $ } = mount(states([], { game: "off" }));
  $('[data-act="theme"][data-value="red"]').click();
  assert.equal($(".stage").dataset.theme, "red");
});
