// Darts from the board's event socket reach every game, including the games that colour
// sectors of the drawn board (they used to throw on every dart and count none).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { states, mount } from "./dom-helpers.mjs";

const dart = (name, x, y) => ({ segment: { name, bed: name.startsWith("S") ? "SingleOuter" : undefined }, coords: { x, y } });
const send = (m, throws) => m.el._ws.onmessage({ data: JSON.stringify({ type: "state", data: { status: "Throw", throws } }) });

for (const game of ["derby", "killer_venue", "fight", "conqueror", "targets", "scram", "snakes", "x01_party", "wild_mouse", "chase_dragon"]) {
  test(`${game}: the board's darts count, and pulling them ends the visit`, () => {
    const m = mount(states([], { game: "off" }));
    m.el._sfx.play = () => {}; m.el._caller.say = () => {};
    m.el._setup.players = ["Robin", "Sam", "Alex"];
    m.$(`[data-act="game"][data-value="${game}"]`).click();
    m.$('[data-act="start"]').click();
    assert.ok(m.el._ws, "the card listens to the board");
    const g = m.el._wm;
    send(m, [dart("S20", 0.02, 0.8)]);
    assert.equal(g.visit.length, 1);
    send(m, [dart("S20", 0.02, 0.8), dart("T19", -0.19, -0.58)]);
    assert.equal(g.visit.length, 2);
    assert.deepEqual(g.visit.map((d) => d.seg), ["S20", "T19"]);
    // The drawn board shows where the darts sit.
    assert.equal(m.el._lastThrows.length, 2);
    send(m, []);
    assert.equal(g.visit.length, 0, "the takeout ends the visit");
    assert.equal(g.current, 1);
  });
}
