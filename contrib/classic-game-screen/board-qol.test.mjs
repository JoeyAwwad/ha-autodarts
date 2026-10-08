// Quality of life at the board: keys and remotes, rematch orders, the match intro, the
// checkout coach, the board-empty check and banter, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

const key = (k) => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
function wildMouse(names = ["Joey", "Sam"], config) {
  const m = mount(states([], { game: "off" }), config);
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = [...names];
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  m.$('[data-act="start"]').click();
  return m;
}

test("keys: N next player, U undo, 1–3 correct a dart, Escape closes the pad", () => {
  const m = wildMouse();
  const w = () => m.el._wm;
  w().dart("T20"); m.el._render();
  key("n");
  assert.equal(w().current, 1);
  key("u");
  assert.equal(w().current, 0);
  w().dart("S20"); m.el._render();
  key("1");
  assert.ok(m.$(".pad-layer.open"));
  key("t");
  assert.ok(m.$('[data-act="pad-ring"][data-value="T"].on'));
  key("Escape");
  assert.equal(m.$(".pad-layer.open"), null);
  m.el.remove();
});

test("TV remote keys: → and play/pause pass the turn, ← undoes", () => {
  const m = wildMouse();
  key("ArrowRight");
  assert.equal(m.el._wm.current, 1);
  key("ArrowLeft");
  assert.equal(m.el._wm.current, 0);
  key("MediaPlayPause");
  assert.equal(m.el._wm.current, 1);
  m.el.remove();
});

test("Enter starts from the lobby; keys: false turns them off; typing a name is not a key", () => {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = ["Joey", "Sam"]; m.el._setup.game = "wild_mouse"; m.el._render();
  key("Enter");
  assert.equal(m.el._wm?.kind, "wild_mouse");
  m.el.remove();
  const off = wildMouse(["Joey", "Sam"], { keys: false });
  key("n");
  assert.equal(off.el._wm.current, 0);
  off.el.remove();
});

test("rematch orders: next starts, loser starts, winner stays on", () => {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  const s = m.el._setup;
  s.game = "wild_mouse";
  s.players = ["A", "B", "C"]; s.rematch = "rotate"; m.el._lastRanking = ["B", "A", "C"];
  m.el._rematch();
  assert.deepEqual([...s.players], ["B", "C", "A"]);
  s.players = ["A", "B", "C"]; s.rematch = "loser"; m.el._lastRanking = ["B", "A", "C"];
  m.el._rematch();
  assert.deepEqual([...s.players], ["C", "A", "B"]);
  s.players = ["A", "B", "C", "D"]; s.rematch = "winner"; m.el._lastRanking = ["B", "A"];
  m.el._rematch();
  assert.deepEqual([...s.players], ["B", "C", "D", "A"], "the winner stays, the loser goes to the back");
  s.players = ["A", "B"]; s.rematch = "same"; m.el._lastRanking = ["B", "A"];
  m.el._rematch();
  assert.deepEqual([...s.players], ["A", "B"]);
  m.el.remove();
});

test("the result screen offers the rematch orders", () => {
  const m = wildMouse();
  m.el._wm.winner = 0; m.el._render();
  assert.equal(m.$$(".gs-order button").length, 4);
  m.$('.gs-order [data-value="loser"]').click();
  assert.equal(m.el._setup.rematch, "loser");
  m.el.remove();
});

test("the match intro shows the players before the first dart, with the head to head", () => {
  const extra = { [`sensor.${P}_player_profiles`]: { state: "2", last_updated: "1", attributes: { players: [{ name: "Joey", head_to_head: { Sam: { won: 5, lost: 3 } } }, { name: "Sam" }] } } };
  const m = mount(states([], { game: "off", extra }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = ["Joey", "Sam"]; m.el._setup.game = "wild_mouse"; m.el._render();
  m.$('[data-act="start"]').click();
  const intro = m.$(".intro-layer");
  assert.ok(intro);
  assert.match(intro.textContent, /Joey[\s\S]*VS[\s\S]*Sam/);
  assert.match(intro.querySelector(".intro-h2h").textContent, /5 – 3/);
  intro.click();
  assert.equal(m.$(".intro-layer"), null, "a tap closes it");
  m.el.remove();
});

test("intro: false, and solo games, skip the intro", () => {
  const m = wildMouse(["Joey", "Sam"], { intro: false });
  assert.equal(m.$(".intro-layer"), null);
  m.el.remove();
  const solo = wildMouse(["Joey"]);
  assert.equal(solo.$(".intro-layer"), null);
  solo.el.remove();
});

test("darts left in the board are flagged when a game starts", () => {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._boardThrows = 2;
  m.el._setup.players = ["Joey", "Sam"]; m.el._setup.game = "wild_mouse"; m.el._render();
  m.$('[data-act="start"]').click();
  assert.match(m.$(".toast").textContent, /still darts in the board/);
  assert.equal(m.el._wm.seen, 2, "and they are not counted");
  m.el.remove();
});

test("the checkout coach: what to go for if the first dart misses", () => {
  const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
  const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.coachLine = coachLine; this.checkoutRoute = checkoutRoute;", ctx);
  assert.equal(ctx.coachLine(100, ["T20", "D20"]), "", "S20 leaves 80: no one-dart finish");
  assert.equal(ctx.coachLine(60, ["S20", "D20"]), "", "a single first dart needs no plan B");
  assert.equal(ctx.coachLine(80, ["T20", "D10"]), "", "S20 leaves 60, no one-dart finish");
  assert.equal(ctx.coachLine(44, ["T4", "D16"]), "if S4: D20");
  assert.equal(ctx.coachLine(40, ["D20"]), "", "one dart: no second chance to plan");
  assert.equal(ctx.coachLine(121, ["T20", "T11", "D14"]), "if S20: " + ctx.checkoutRoute(101, 2).join(" "));
});

test("the coach shows under the integration's checkout route", () => {
  const s = states(["S1"]);
  s[`sensor.${P}_practice_remaining_score`].attributes.scores[0].remaining = 121;
  s[`sensor.${P}_practice_checkout`] = { state: "T20 T11 D14", attributes: {}, last_updated: "1" };
  const { $ } = mount(s);
  assert.match($(".banner .coach").textContent, /^if S20: /);
});

test("banter after a visit, by what it scored, and banter: false keeps it quiet", async () => {
  const m = wildMouse(["Joey", "Sam"], { banter: "always", banter_lines: { max: ["Custom max!"] } });
  const w = m.el._wm;
  w.dart("T20"); m.el._render(); w.dart("T20"); m.el._render(); w.dart("T20"); m.el._render();
  const b = m.$(".fx-layer .banter");
  assert.ok(b); assert.equal(b.textContent, "Custom max!");
  m.el.remove();
  const quiet = wildMouse(["Joey", "Sam"], { banter: false });
  ["S1", "S1", "S1"].forEach((d) => { quiet.el._wm.dart(d); quiet.el._render(); });
  assert.equal(quiet.$(".fx-layer .banter"), null);
  quiet.el.remove();
});
