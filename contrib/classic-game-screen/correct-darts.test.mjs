// Correcting and adding darts on the classic game screen, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, settle, states, mount } from "./dom-helpers.mjs";

const x01 = (visit, manual = "off") => states(visit, { manual });

test("a tap on a dart opens the pad, and a bed corrects that dart", async () => {
  const { calls, $ } = mount(x01(["S20", "S5"]));
  assert.ok($('.slot[data-value="1"] .edit'), "the dart shows it can be edited");
  $('.slot[data-value="1"]').click();
  assert.ok($(".pad-layer.open"));
  $('[data-act="pad-ring"][data-value="T"]').click();
  $('[data-act="pad-bed"][data-value="T20"]').click();
  await settle();
  assert.deepEqual(calls, [["autodarts", "correct_dart", { dart: 2, segment: "T20" }]]);
  assert.equal($(".pad-layer.open"), null, "the pad closes");
});

test("the pad starts on the ring of the dart", () => {
  const { $ } = mount(x01(["S20", "D5"]));
  $('.slot[data-value="1"]').click();
  assert.ok($('[data-act="pad-ring"][data-value="D"].on'));
  assert.ok($('[data-act="pad-bed"][data-value="D5"]'));
});

test("25, Bull and Miss are on the pad", async () => {
  const { calls, $ } = mount(x01(["S20"]));
  $('.slot[data-value="0"]').click();
  $('[data-act="pad-bed"][data-value="MISS"]').click();
  await settle();
  assert.deepEqual(calls, [["autodarts", "correct_dart", { dart: 1, segment: "MISS" }]]);
});

test("the backdrop closes the pad without a change", async () => {
  const { calls, $ } = mount(x01(["S20"]));
  $('.slot[data-value="0"]').click();
  $(".pad-back").click();
  await settle();
  assert.equal($(".pad-layer.open"), null); assert.equal(calls.length, 0);
});

test("a missed dart can be added only with manual entry on", async () => {
  const off = mount(x01(["S20", "S5"], "off"));
  assert.equal(off.$(".slot.add"), null);
  const { calls, $ } = mount(x01(["S20", "S5"], "on"));
  assert.equal($(".slot.add").dataset.value, "2", "the next empty slot");
  $(".slot.add").click();
  $('[data-act="pad-bed"][data-value="25"]').click();
  await settle();
  assert.deepEqual(calls, [["autodarts", "throw_dart", { segment: "25" }]]);
});

test("Wild Mouse corrects and adds darts in the card", async () => {
  const idle = x01([]);
  idle[`select.${P}_practice_game`] = { state: "off", attributes: {}, last_updated: "1" };
  const { el, calls, $ } = mount(idle);
  $('[data-act="game"][data-value="wild_mouse"]').click();
  $('[data-act="start"]').click();
  await settle();
  el._wmThrows([{ segment: { name: "S20" } }]);
  $('.slot[data-value="0"]').click();
  $('[data-act="pad-ring"][data-value="T"]').click();
  $('[data-act="pad-bed"][data-value="T20"]').click();
  await settle();
  assert.equal(el._wm.players[0].marks[20], 3);
  $(".slot.add").click();
  $('[data-act="pad-bed"][data-value="BULL"]').click();
  await settle();
  assert.equal(el._wm.players[0].marks[25], 2);
  assert.equal(calls.length, 0, "Wild Mouse needs no service");
  assert.match($('.slot[data-value="0"]').textContent, /T20/);
});
