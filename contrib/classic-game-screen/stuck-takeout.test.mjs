// The automatic reset of a takeout that hangs on an empty board (Autodarts 2.0.2).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");

// A card with its timers and board calls captured instead of run.
function card(config) {
  const timers = [], resets = [];
  const ctx = {
    HTMLElement: class {},
    customElements: { define() {} },
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout: (fn, ms) => timers.push({ fn, ms }) && timers.length,
    clearTimeout: () => {},
    fetch: (url, opts) => { resets.push([url, opts.method]); return Promise.resolve(); },
  };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.Card = AutodartsClassicCard;", ctx);
  const c = new ctx.Card();
  c.setConfig({ board_url: "http://board:3180", ...config });
  c._toast = () => {};
  return { c, timers, resets };
}
const STUCK = { status: "Takeout in progress", numThrows: 0 };

test("a stuck takeout is reset after 5 seconds by default", () => {
  const { c, timers, resets } = card({});
  c._watchTakeout(STUCK);
  assert.equal(timers.length, 1); assert.equal(timers[0].ms, 5000);
  timers[0].fn();
  assert.deepEqual(resets, [["http://board:3180/api/reset", "POST"]]);
});
test("stuck_takeout_reset sets the wait in seconds", () => {
  const { c, timers } = card({ stuck_takeout_reset: 12 });
  c._watchTakeout(STUCK);
  assert.equal(timers[0].ms, 12000);
});
test("stuck_takeout_reset: 0 leaves the board alone", () => {
  const { c, timers, resets } = card({ stuck_takeout_reset: 0 });
  c._watchTakeout(STUCK);
  assert.equal(timers.length, 0); assert.equal(resets.length, 0);
});
test("a takeout with darts still on the board is not stuck", () => {
  const { c, timers } = card({});
  c._watchTakeout({ status: "Takeout in progress", numThrows: 3 });
  assert.equal(timers.length, 0);
});
