// Every game the card scores itself, played by fast-check with random players and random
// darts, corrections, undos and Next player: the rules must always hold, whatever is thrown.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import fc from "fast-check";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.K = { LOCAL_GAME_CLASSES, CRICKET_KINDS, WildMouse, reviveGame, minPlayers, maxPlayers };", ctx);
const { LOCAL_GAME_CLASSES, CRICKET_KINDS, WildMouse, reviveGame, minPlayers, maxPlayers } = ctx.K;

const RUNS = Number(process.env.FUZZ_RUNS) || 60;
const KINDS = [...Object.keys(LOCAL_GAME_CLASSES), ...Object.keys(CRICKET_KINDS)];
const SEGS = ["Miss", "25", "Bull", ...Array.from({ length: 20 }, (_, i) => [`S${i + 1}`, `D${i + 1}`, `T${i + 1}`]).flat()];
// Players as the lobby allows them for the game.
const seat = (kind, n) => Math.min(maxPlayers(kind), Math.max(minPlayers(kind), n));
const make = (kind, count, setup = {}) => {
  const names = Array.from({ length: seat(kind, count) }, (_, i) => `P${i + 1}`);
  if (CRICKET_KINDS[kind]) return WildMouse.create(names, { kind, legs: setup.legs || 1 });
  const [Cls, opts] = LOCAL_GAME_CLASSES[kind];
  return Cls.create(kind, names, opts(setup));
};
const plain = (g) => JSON.parse(JSON.stringify(g));
const seg = fc.constantFrom(...SEGS);
const info = fc.record({ bed: fc.constantFrom(undefined, "SingleInner", "SingleOuter") });
const action = fc.oneof(
  { weight: 8, arbitrary: fc.record({ t: fc.constant("dart"), seg, info }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant("next") }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("undo") }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("correct"), i: fc.integer({ min: 0, max: 2 }), seg }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant("action"), v: fc.constantFrom("higher", "lower") }) },
);
const game = fc.record({
  kind: fc.constantFrom(...KINDS),
  players: fc.integer({ min: 1, max: 8 }),
  legs: fc.constantFrom(1, 1, 2),
  actions: fc.array(action, { maxLength: 160 }),
});

function apply(g, a) {
  if (a.t === "dart") return g.dart(a.seg, a.info);
  if (a.t === "next") return g.next();
  if (a.t === "undo") return g.undo();
  if (a.t === "correct") return g.correct(a.i, a.seg);
  if (a.t === "action") return g.action?.("call", a.v);
}

function check(g, kind, n) {
  assert.ok(g.visit.length <= 3, "at most three darts in a visit");
  assert.ok(Number.isInteger(g.current) && g.current >= 0 && g.current < n, "the thrower is a player");
  assert.equal(g.players.length, n, "nobody joins or leaves");
  if (g.winner != null) assert.ok(g.winner >= 0 && g.winner < n, "the winner is a player");
  for (const w of g.winners || []) assert.ok(w >= 0 && w < n, "every winner is a player");
  if (g.legWinner != null) assert.ok(g.legWinner >= 0 && g.legWinner < n, "the leg winner is a player");
  // What the screen shows can always be drawn.
  if (!CRICKET_KINDS[kind]) {
    for (const p of g.players) { assert.notEqual(String(g.big(p)), "NaN"); assert.notEqual(String(g.sub(p)), "NaN"); g.sub(p); }
    const panel = g.panel(); assert.equal(typeof panel, "string"); assert.ok(!/NaN|undefined/.test(panel), `panel: ${panel.slice(0, 200)}`);
    const facts = g.facts(); assert.ok(Array.isArray(facts)); assert.ok(!/NaN|undefined/.test(facts.join(" ")), facts.join(" "));
    const banner = String(g.banner() ?? ""); assert.ok(!/NaN|undefined/.test(banner), banner);
    g.overlay();
    const rows = g.results();
    assert.deepEqual([...rows.map((r) => r.i)].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), "every player once in the results");
    for (const r of rows) assert.ok(!/NaN|undefined/.test(`${r.main}`), `result ${r.main}`);
    if (g.winner != null && !g.winners) assert.equal(rows[0].i, g.winner, "the winner heads the results");
  }
  for (const d of g.visit) assert.ok(!/NaN|undefined/.test(`${d.text ?? ""}`), `dart text ${d.text}`);
  // A saved game comes back as the same game.
  const back = reviveGame(plain(g));
  assert.deepEqual(plain(back), plain(g), "a saved game revives unchanged");
}

test("every game keeps its rules under random play, undos and corrections", () => {
  fc.assert(fc.property(game, ({ kind, players, legs, actions }) => {
    const g = make(kind, players, { legs });
    players = g.players.length;
    check(g, kind, players);
    for (const a of actions) {
      apply(g, a);
      check(g, kind, players);
    }
  }), { numRuns: RUNS * KINDS.length });
});

test("undo takes a whole visit back to exactly where it started", () => {
  fc.assert(fc.property(game, fc.array(fc.tuple(seg, info), { minLength: 1, maxLength: 3 }), ({ kind, players, legs, actions }, visit) => {
    const g = make(kind, players, { legs });
    for (const a of actions) apply(g, a);
    if (g.winner != null) return;
    g.next(); // start from a clean visit
    if (g.winner != null || g.legWinner != null) return;
    const before = plain(g);
    delete before.history;
    let thrown = 0;
    for (const [s, i] of visit) if (g.dart(s, i)) thrown += 1;
    if (!thrown) return;
    assert.ok(g.undo());
    const after = plain(g);
    delete after.history;
    assert.deepEqual(after, before);
  }), { numRuns: RUNS * KINDS.length });
});

test("correcting a dart to the bed it already was changes nothing", () => {
  fc.assert(fc.property(game, fc.array(fc.tuple(seg, info), { minLength: 1, maxLength: 3 }), fc.nat(2), ({ kind, players }, visit, pick) => {
    const g = make(kind, players);
    for (const [s] of visit) g.dart(s, {});
    if (!g.visit.length) return;
    const i = pick % g.visit.length;
    const before = plain(g);
    g.correct(i, g.visit[i].seg);
    const after = plain(g);
    delete before.seen; delete after.seen;
    assert.deepEqual(after, before);
  }), { numRuns: RUNS * KINDS.length });
});

// Every game comes to an end with darts thrown at random (Mickey Mouse needs three in a bed,
// which random darts almost never throw, so it is left to its own tests).
test("every game ends, whatever is thrown", () => {
  const kinds = KINDS.filter((k) => k !== "mickey_mouse");
  fc.assert(fc.property(fc.constantFrom(...kinds), fc.integer({ min: 1, max: 4 }), fc.integer(), (kind, players, seed) => {
    const g = make(kind, players);
    let x = seed >>> 0; // mulberry32: a plain LCG never throws some pairs, such as S1 then D1
    const rand = () => { let t = (x = (x + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };
    let k = 0;
    // Random darts finish an X01 on 3 (S1 then D1) about once in 3,700 visits: enough darts
    // that a game which can end does end.
    for (; k < 100000 && g.winner == null; k++) if (g.visit.length >= 3 || !g.dart(SEGS[Math.floor(rand() * SEGS.length)], {})) g.next();
    assert.ok(g.winner != null, `${kind} with ${g.players.length} player(s) had no winner after ${k} darts`);
  }), { numRuns: RUNS * 3 });
});

test("the lobby's player limits: head-to-head games need two, Scram takes exactly two", () => {
  for (const k of ["lives", "hi_lo", "limbo", "fight", "killer_venue", "conqueror", "scram"]) assert.equal(minPlayers(k), 2, k);
  assert.equal(maxPlayers("scram"), 2);
  assert.equal(minPlayers("snakes"), 1);
});
