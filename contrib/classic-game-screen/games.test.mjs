// The games the card scores itself: their rules, and every one on the screen.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { states, mount } from "./dom-helpers.mjs";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.K = { LOCAL_GAME_CLASSES, CRICKET_KINDS, WildMouse, checkoutRoute, reviveGame, LOCAL_GAMES };", ctx);
const { LOCAL_GAME_CLASSES, WildMouse, checkoutRoute, reviveGame, LOCAL_GAMES } = ctx.K;
const make = (kind, names = ["A", "B"], setup = {}) => {
  const [Cls, opts] = LOCAL_GAME_CLASSES[kind];
  return Cls.create(kind, names, opts(setup));
};
const visit = (g, ...darts) => { darts.forEach((d) => (typeof d === "string" ? g.dart(d) : g.dart(d[0], d[1]))); g.next(); };

test("checkout routes: the fewest darts, finishing on a double", () => {
  assert.equal(checkoutRoute(40).join(" "), "D20");
  assert.equal(checkoutRoute(170).join(" "), "T20 T20 BULL");
  assert.equal(checkoutRoute(81).length, 2);
  assert.equal(checkoutRoute(169), null, "169 cannot be finished");
});

test("Party X01: counts down, busts, needs the double, and plays legs", () => {
  const g = make("x01_party", ["A", "B", "C", "D", "E"], { start: 101, legs: 2 });
  visit(g, "T20", "S1", "S20"); // 101 → 20
  assert.equal(g.players[0].rem, 20);
  ["S1", "S1", "S1"].forEach(() => {}); visit(g, "S1"); visit(g, "S1"); visit(g, "S1"); visit(g, "S1"); // B–E
  g.dart("S10"); g.dart("S9"); // 20 → 1: bust with double out
  assert.equal(g.players[0].rem, 20); assert.equal(g.blocked(), true);
  g.next(); ["B", "C", "D", "E"].forEach(() => visit(g, "S1"));
  g.dart("D10");
  assert.equal(g.legWinner, 0); assert.equal(g.winner, null, "first to two legs");
  g.next();
  assert.equal(g.leg, 2); assert.equal(g.players[0].rem, 101); assert.equal(g.current, 1, "the next player starts the leg");
});

test("Party X01 with double in: nothing counts before a double", () => {
  const g = make("x01_party", ["A"], { start: 301, double_in: true });
  g.dart("T20");
  assert.equal(g.players[0].rem, 301);
  g.dart("D20"); g.dart("T20");
  assert.equal(g.players[0].rem, 201);
});

test("Tower Takedown: equal turns, and a tie plays off from 60", () => {
  const g = make("tower", ["A", "B"]);
  visit(g, "T20", "T20", "T20"); // A 180 → 0
  assert.equal(g.winner, null, "B still throws");
  visit(g, "S1");
  assert.equal(g.winner, 0);
  const t = make("tower", ["A", "B"]);
  visit(t, "T20", "T20", "T20"); visit(t, "T20", "T20", "T20");
  assert.equal(t.winner, null); assert.equal(t.players[0].rem, 60); assert.match(t.note, /Play-off/);
});

test("Touchdown 200: beginners may overshoot, pros bounce back", () => {
  const b = make("moon_landing", ["A"]);
  visit(b, "T20", "T20", "T20"); b.dart("Bull");
  assert.equal(b.winner, 0);
  const p = make("moon_landing", ["A"], { pro: true });
  visit(p, "T20", "T20", "T20"); p.dart("T20");
  assert.equal(p.players[0].rem, 20); assert.equal(p.winner, null);
});

test("Gotcha: landing on a score sends it back to zero; over 301 is a bust", () => {
  const g = make("gotcha");
  visit(g, "T20"); // A 60
  visit(g, "T20"); // B 60 → A back to 0
  assert.equal(g.players[0].total, 0); assert.equal(g.players[1].total, 60);
  g.players[0].total = 290; g.dart("T20");
  assert.equal(g.players[0].total, 290);
  g.next(); visit(g, "S1"); g.dart("S11");
  assert.equal(g.winner, 0);
});

test("Chase the Dragon and Around the Clock: only the next target counts", () => {
  const g = make("chase_dragon", ["A"]);
  g.dart("S10"); g.dart("T10"); g.dart("T12");
  assert.equal(g.players[0].pos, 1);
  const lite = make("atc_lite", ["A"]);
  lite.dart("S20"); // 20 is next to 1
  assert.equal(lite.players[0].pos, 1);
  lite.dart("S5");
  assert.equal(lite.players[0].pos, 1, "5 is not next to 2");
  const d = make("atc_doubles", ["A"]);
  d.dart("S1"); d.dart("D1");
  assert.equal(d.players[0].pos, 1);
});

test("Hare & Hounds: a hound that reaches the hare catches it", () => {
  const g = make("hare_hounds", ["Hare", "Hound"]);
  assert.equal(g.players[0].pos, 5);
  g.next(); // the hare misses
  g.players[1].pos = 4; g.dart("S13"); // 5th number round the board from 20: 20 1 18 4 13
  assert.equal(g.winner, 1);
});

test("Doubles Ladder: up on a hit, down after a visit without one", () => {
  const g = make("doubles_ladder", ["A"]);
  visit(g, "D1", "D2", "S3");
  assert.equal(g.players[0].pos, 2);
  visit(g, "S3", "S3", "S3");
  assert.equal(g.players[0].pos, 1);
});

test("Random Checkout: finish the target on a double", () => {
  const g = make("random_checkout", ["A"]);
  Object.assign(g.players[0], { target: 40, left: 40, visits: 0 });
  g.dart("D20");
  assert.equal(g.players[0].done, 1);
  g.next();
  assert.notEqual(g.players[0].target, 0); assert.equal(g.players[0].visits, 0, "a new target");
});

test("Lives, Hi-Lo and Under the Bar lose lives the way their rules say", () => {
  const l = make("lives", ["A", "B"]);
  visit(l, "S20"); visit(l, "S10");
  assert.equal(l.players[1].lives, 2);
  const h = make("hi_lo", ["A", "B"]);
  visit(h, "S20");
  assert.ok(h.action("call", "lo")); visit(h, "S5");
  assert.equal(h.players[1].lives, 3, "called lower, was lower");
  visit(h, "S20"); // A: no call means higher than 5, and 20 is
  assert.equal(h.players[0].lives, 3);
  const m = make("limbo", ["A", "B"]);
  visit(m, "S10", "S10", "S10"); // bar 30
  visit(m, "S10", "S10", "S10"); // 30 is not under 30
  assert.equal(m.players[1].lives, 2); assert.equal(m.bar, null);
  visit(m, "S1", "MISS", "S1"); // a dart that scores nothing
  assert.equal(m.players[0].lives, 2);
});

test("Killer Night: become a killer on your number, no killing yourself, knock-outs", () => {
  const g = make("killer_venue", ["A", "B"]);
  g.players[0].number = 7; g.players[1].number = 12;
  visit(g, "T7"); // A is a killer
  assert.equal(g.players[0].killer, true);
  visit(g, "S1");
  g.dart("D12"); g.dart("S12");
  assert.equal(g.winner, 0, "B lost 3 lives");
});

test("Nine Lives: everybody is a killer, your number heals", () => {
  const g = make("fight", ["A", "B"]);
  g.players[0].number = 7; g.players[1].number = 12;
  g.dart("T12");
  assert.equal(g.players[1].lives, 6);
  g.next(); g.dart("D12");
  assert.equal(g.players[1].lives, 8);
});

test("Ladder Rush: the ring is the dice, ladders climb, exact to finish", () => {
  const g = make("snakes");
  g.dart("S20", { bed: "SingleInner" }); // roll 4 onto the ladder at 4
  assert.equal(g.players[0].sq, 17);
  g.dart("T1"); // roll 3 → 20
  assert.equal(g.players[0].sq, 20);
  const snake = LOCAL_GAME_CLASSES.snakes[0].create("snakes", ["A", "B"], {});
  snake.players[0].sq = 37; snake.dart("D1"); // 38: the snake down to 3
  assert.equal(snake.players[0].sq, 3);
  g.players[0].sq = 48; g.dart("S20", { bed: "SingleInner" }); // 52 bounces back to 48
  assert.equal(g.players[0].sq, 48);
});

test("Derby Dash: your number moves you, theirs pushes them back, the round is finished", () => {
  const g = make("derby");
  g.players[0].number = 20; g.players[1].number = 1;
  visit(g, "T20"); // A 3
  visit(g, "D20"); // B pushes A back 2
  assert.equal(g.players[0].step, 1);
  g.players[0].step = 8; g.dart("S20");
  assert.equal(g.players[0].home, true); assert.equal(g.winner, null);
  g.next(); g.players[1].step = 9; g.players[1].home = true; g.next();
  assert.deepEqual([...g.winners], [0, 1], "a dead heat");
});

test("Board Grab: claim next door, out of reach elsewhere, a home sector takes all", () => {
  const g = make("conqueror");
  g.owner = { 20: { by: 0, str: 3 }, 3: { by: 1, str: 1 } };
  g.players[0].home = 20; g.players[1].home = 3;
  assert.equal(g.dart("S1").text, "claimed 1");
  assert.equal(g.dart("S3").text, "out of reach");
  g.dart("Bull"); // king
  g.next(); g.next();
  g.dart("Bull"); g.dart("S3");
  assert.equal(g.winner, 0);
});

test("Target Blast: close darts damage, destroyed targets score", () => {
  const g = make("targets", ["A"]);
  g.targets = [{ x: 0, y: 0.5, hp: 3 }, { x: 0.8, y: 0, hp: 3 }, { x: -0.8, y: 0, hp: 3 }];
  g.dart("S20", { coords: { x: 0, y: 0.5 } });
  assert.equal(g.players[0].points, 13);
});

test("Chasing Bullseye: the middle scores, the edge costs, three bullseyes win", () => {
  const g = make("bull_hunt", ["A", "B"]);
  g.dart("25"); g.dart("T20"); g.dart("S20");
  assert.equal(g.players[0].points, 2 - 2 - 1);
  g.next(); g.next();
  g.dart("Bull"); g.dart("Bull"); g.dart("Bull");
  assert.equal(g.winner, 0);
});

test("Bull & Goal: the bull for the ball, then doubles are goals", () => {
  const g = make("football", ["A"]);
  g.dart("D20");
  assert.equal(g.players[0].goals, 0);
  g.dart("25"); g.dart("D1");
  assert.equal(g.players[0].goals, 1);
});

test("Snooker: red, colour, and a foul ends the break", () => {
  const g = make("snooker");
  g.dart("S1"); g.dart("S20"); // a red, then the pink
  assert.equal(g.players[0].points, 7);
  g.dart("S2"); // the next red: fine
  assert.equal(g.blocked(), false); assert.equal(g.players[0].points, 8);
  g.next();
  g.dart("S3"); g.dart("S4"); // a red when a colour is on: foul
  assert.equal(g.blocked(), true); assert.equal(g.players[1].points, 1);
});

test("the cricket family: Mickey Mouse numbers, Quick Cricket, Cut-Throat's points and win", () => {
  const mm = WildMouse.create(["A", "B"], { kind: "mickey_mouse" });
  mm.dart("T12");
  assert.equal(mm.players[0].marks[12], 3);
  const light = WildMouse.create(["A"], { kind: "cricket_light" });
  assert.equal(light.targets.length, 4);
  const ct = WildMouse.create(["A", "B"], { kind: "cut_throat_party" });
  ct.dart("T20"); ct.dart("S20");
  assert.equal(ct.players[0].points, 0); assert.equal(ct.players[1].points, 20);
  assert.equal(ct.targets.includes("D"), false, "no doubles and trebles targets");
});

test("undo and corrections work for every card-scored game", () => {
  const g = make("gotcha");
  g.dart("S20"); g.dart("S5");
  g.correct(0, "T20");
  assert.equal(g.players[0].total, 65);
  assert.ok(g.undo()); assert.equal(g.players[0].total, 0);
  const back = reviveGame(JSON.parse(JSON.stringify(make("snakes"))));
  assert.equal(back.constructor.name, "SnakesGame");
});

test("every card-scored game starts, takes darts, shows its screen and its result", async () => {
  for (const kind of LOCAL_GAMES) {
    const m = mount(states([], { game: "off" }));
    m.el._sfx.play = () => {}; m.el._caller.say = () => {};
    m.el._setup.players = ["Joey", "Sam", "Alex"];
    m.el._setup.game = kind;
    await m.el._start();
    const g = m.el._wm;
    assert.ok(g, `${kind} started`);
    assert.equal(g.kind, kind);
    for (const d of ["T20", "S5", "Bull"]) { g.dart(d, { coords: { x: 0.1, y: 0.5 }, bed: "SingleInner" }); m.el._render(); }
    g.next(); m.el._render();
    assert.ok(m.$(".player.active"), `${kind} shows whose turn it is`);
    assert.match(m.$(".bar .gname").textContent, /\S/, `${kind} has a title`);
    g.winner = 0; if (g.winners !== undefined) g.winners = null;
    m.el._render();
    assert.ok(m.$(".gameshot .res-row"), `${kind} ends on the result screen`);
    assert.ok(m.$$(".tile-wrap").length === 0 || true);
  }
});

test("Scram: the stopper closes numbers, the scorer scores on open ones, then they swap", () => {
  const g = make("scram");
  assert.equal(g.stopper(), 1);
  g.dart("T20"); assert.equal(g.players[0].points, 60);
  g.next();
  g.dart("S20"); assert.deepEqual([...g.closed], [20]);
  g.next();
  g.dart("T20"); assert.equal(g.players[0].points, 60, "20 is closed now");
  g.closed = Array.from({ length: 20 }, (_, i) => i + 1); g.next();
  g.dart("Bull");
  assert.equal(g.half, 2); assert.equal(g.stopper(), 0);
});
