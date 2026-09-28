// Wild Mouse (Minnesota) Cricket rules of the classic game screen.
// Run: node --test contrib/classic-game-screen/
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.WildMouse = WildMouse;", ctx);
const { WildMouse } = ctx;
const visit = (g, ...darts) => { const r = darts.map((d) => g.dart(d)); g.next(); return r; };

test("T20 on an open 20 marks the number, not Triples", () => {
  const g = WildMouse.create(["A", "B"]);
  const [r] = visit(g, "T20");
  assert.equal(r.target, 20); assert.equal(g.players[0].marks[20], 3); assert.equal(g.players[0].marks.T, 0);
});
test("T20 after 20 is closed marks Triples", () => {
  const g = WildMouse.create(["A", "B"]);
  visit(g, "T20"); visit(g, "S1");
  const [r] = visit(g, "T20");
  assert.equal(r.target, "T"); assert.equal(g.players[0].marks.T, 1); assert.equal(g.players[0].points, 0);
});
test("doubles and triples of non-cricket numbers mark D and T", () => {
  const g = WildMouse.create(["A", "B"]);
  const r = visit(g, "D7", "T3", "S9");
  assert.deepEqual(r.map((x) => x.target), ["D", "T", null]);
});
test("D-bull on open bull marks bull twice; then Doubles", () => {
  const g = WildMouse.create(["A", "B"]);
  visit(g, "BULL", "S25");
  assert.equal(g.players[0].marks[25], 3);
  visit(g, "S1"); const [r] = visit(g, "BULL");
  assert.equal(r.target, "D");
});
test("closed Triples score the full dart value while an opponent is open", () => {
  const g = WildMouse.create(["A", "B"]);
  visit(g, "T1", "T2", "T3"); visit(g, "S1");
  const [r] = visit(g, "T19"); // 19 open for A -> counts on 19, not T
  assert.equal(r.target, 19);
  visit(g, "S1");
  const [r2] = visit(g, "T5"); // non-cricket triple, T closed, B open -> 15 points
  assert.equal(r2.target, "T"); assert.equal(r2.points, 15);
});
test("extra marks on a closing number score while an opponent is open", () => {
  const g = WildMouse.create(["A", "B"]);
  visit(g, "S20", "T20"); // 1 + 3: closes with 2, 1 extra -> 20 points
  assert.equal(g.players[0].points, 20);
});
test("no points when everyone has the target closed", () => {
  const g = WildMouse.create(["A", "B"]);
  visit(g, "T20"); visit(g, "T20"); visit(g, "T20");
  assert.equal(g.players[0].points, 0);
});
test("undo takes back the last visit", () => {
  const g = WildMouse.create(["A", "B"]);
  visit(g, "T20", "T19"); assert.equal(g.current, 1);
  assert.ok(g.undo()); assert.equal(g.current, 0); assert.equal(g.players[0].marks[20], 0); assert.equal(g.visit.length, 0);
});
test("undo mid-visit drops the darts of the visit in progress", () => {
  const g = WildMouse.create(["A", "B"]);
  g.dart("T20"); g.undo(); assert.equal(g.players[0].marks[20], 0); assert.equal(g.current, 0);
});
test("next with no darts passes the turn and can be undone", () => {
  const g = WildMouse.create(["A", "B"]);
  g.next(); assert.equal(g.current, 1); g.undo(); assert.equal(g.current, 0);
});
test("closing everything with enough points wins; legs", () => {
  const g = WildMouse.create(["A"], { legs: 2 });
  for (const n of [20, 19, 18, 17, 16, 15]) visit(g, "T" + n);
  visit(g, "BULL", "S25", "D1"); visit(g, "D2", "D3", "T1");
  g.dart("T2"); g.dart("T3");
  assert.equal(g.legWinner, 0); assert.equal(g.winner, null); assert.equal(g.players[0].legs, 1);
  assert.equal(g.dart("S1"), null, "no darts after the leg is won");
  g.next(); assert.equal(g.leg, 2); assert.equal(g.legWinner, null); assert.equal(g.players[0].marks[20], 0);
  for (const n of [20, 19, 18, 17, 16, 15]) visit(g, "T" + n);
  visit(g, "BULL", "S25", "D1"); visit(g, "D2", "D3", "T1"); g.dart("T2"); g.dart("T3");
  assert.equal(g.winner, 0); assert.equal(g.players[0].legs, 2);
});
test("three-in-a-bed marks B only when enabled", () => {
  const g = WildMouse.create(["A", "B"], { bed: true });
  visit(g, "S5", "S5", "S5"); assert.equal(g.players[0].marks.B, 1);
  const h = WildMouse.create(["A", "B"]); visit(h, "S5", "S5", "S5"); assert.equal(h.players[0].marks.B, undefined);
});
test("a fourth dart in a visit is ignored", () => {
  const g = WildMouse.create(["A", "B"]);
  ["S20", "S20", "S20"].forEach((d) => g.dart(d)); assert.equal(g.dart("T19"), null);
});
test("state survives JSON round trip", () => {
  const g = WildMouse.create(["A", "B"]); visit(g, "T20");
  const back = new WildMouse(JSON.parse(JSON.stringify(g)));
  assert.equal(back.players[0].marks[20], 3); back.undo(); assert.equal(back.players[0].marks[20], 0);
});
test("a leader who closes everything but trails on points has not won", () => {
  const g = WildMouse.create(["A", "B"]);
  visit(g, "S1"); visit(g, "T1", "T2", "T3"); visit(g, "S1"); visit(g, "T20", "T20", "T20"); // B: T and 20 closed, then 60 points
  for (const n of [20, 19, 18, 17, 16, 15]) { visit(g, "T" + n); visit(g, "S1"); }
  visit(g, "BULL", "S25", "D1"); visit(g, "S1"); visit(g, "D2", "D3", "T1"); visit(g, "S1"); visit(g, "T2", "T3");
  assert.equal(g.legWinner, null); assert.ok(g.players[1].points > g.players[0].points);
});
