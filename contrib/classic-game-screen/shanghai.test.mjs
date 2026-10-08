// Party Shanghai with its Lite option, and round limits for the party games (#4).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { states, mount } from "./dom-helpers.mjs";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.K = { LOCAL_GAME_CLASSES };", ctx);
const { LOCAL_GAME_CLASSES } = ctx.K;
const make = (kind, names, setup = {}, extra = {}) => { const [C, o] = LOCAL_GAME_CLASSES[kind]; return C.create(kind, names, { ...o(setup), ...extra }); };
const visit = (g, ...darts) => { darts.forEach((d) => g.dart(d)); g.next(); };

test("Party Shanghai: only the round's number scores, single, double or treble", () => {
  const g = make("shanghai_party", ["A", "B"]);
  visit(g, "S1", "D1", "S20"); // 1 + 2
  visit(g, "T1", "S5", "Miss"); // 3
  assert.deepEqual(g.players.map((p) => p.points), [3, 3]);
  visit(g, "T2", "S2", "S1"); // round 2: 6 + 2
  assert.equal(g.players[0].points, 11);
});

test("Party Shanghai: a Shanghai wins at once; otherwise the most points after the last round", () => {
  const g = make("shanghai_party", ["A", "B"]);
  visit(g, "S1");
  g.dart("S1"); g.dart("T1"); g.dart("D1");
  assert.equal(g.winner, 1);
  assert.match(g.note, /Shanghai/);
  const h = make("shanghai_party", ["A", "B"]);
  for (let r = 1; r <= 7; r++) { visit(h, `T${r}`); visit(h, `S${r}`); }
  assert.equal(h.winner, 0);
  assert.equal(h.round, 8);
});

test("Party Shanghai Lite: a neighbour counts as a single of the round's number, not towards a Shanghai", () => {
  const g = make("shanghai_party", ["A"], { lite: true });
  g.dart("S20"); g.dart("S18"); g.dart("S5"); // 20 and 18 sit either side of 1; 5 does not
  assert.equal(g.players[0].points, 2);
  g.next();
  const strict = make("shanghai_party", ["A"]);
  strict.dart("S20");
  assert.equal(strict.players[0].points, 0);
  const round20 = make("shanghai_party", ["A"], { sh_rounds: 20 });
  assert.equal(round20.rounds(), 20);
});

test("a round limit ends a party game: the leader wins, level leaders share it", () => {
  const g = make("snakes", ["A", "B"], {}, { maxRounds: 2 });
  visit(g, "Bull"); visit(g, "S1");
  visit(g, "D1"); visit(g, "D1");
  assert.equal(g.winner, 0);
  assert.match(g.note, /2 rounds are up/);
  const tie = make("football", ["A", "B"], {}, { maxRounds: 1 });
  visit(tie, "S20"); visit(tie, "S20"); // nobody has the ball: 0-0
  assert.deepEqual([...tie.winners], [0, 1]);
});

test("the lobby offers the round limit and the Shanghai options, and the bar counts the rounds", () => {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = ["Joey", "Sam"];
  m.$('[data-act="game"][data-value="snakes"]').click();
  m.$('[data-act="round_cap"][data-value="10"]').click();
  m.$('[data-act="start"]').click();
  assert.equal(m.el._wm.opts.maxRounds, 10);
  assert.match(m.$(".bar").textContent, /Round 1 of 10/);
  m.el._act("new");
  m.$('[data-act="game"][data-value="shanghai_party"]').click();
  assert.ok(m.$('[data-act="sh_rounds"][data-value="20"]'));
  assert.ok(m.$('[data-act="lite"]'));
  m.$('[data-act="start"]').click();
  assert.equal(m.el._wm.kind, "shanghai_party");
  assert.equal(m.el._wm.opts.maxRounds, undefined, "Shanghai has its own rounds");
});
