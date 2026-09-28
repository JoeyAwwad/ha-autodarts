// The lobby's game icons and the (i) rules sheets, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

const lobby = () => mount(states([], { game: "off" }));

test("every game tile has an icon, an accent colour and an (i) button", () => {
  const { $$ } = lobby();
  const tiles = $$(".tile-wrap");
  assert.ok(tiles.length >= 24);
  for (const t of tiles) {
    const id = t.querySelector(".tile").dataset.value;
    assert.ok(t.querySelector("svg.gicon"), `${id} has an icon`);
    assert.match(t.getAttribute("style"), /--accent:#[0-9a-f]{6}/, `${id} has a colour`);
    assert.equal(t.querySelector(".info-btn")?.dataset.value, id, `${id} has rules`);
  }
});

test("(i) opens the rules of that game, and Play picks it", () => {
  const { $ } = lobby();
  $('.info-btn[data-value="killer"]').click();
  assert.ok($(".sheet-layer.open"));
  assert.match($(".sheet").textContent, /Killer/);
  assert.match($(".sheet").textContent, /How to play/);
  assert.match($(".sheet").textContent, /last player standing/i);
  $('[data-act="sheet-pick"]').click();
  assert.equal($(".sheet-layer.open"), null);
  assert.ok($('.tile.on[data-value="killer"]'));
  assert.match($('[data-act="start"]').textContent, /Killer/);
});

test("the sheet closes with its backdrop or the close button without picking", () => {
  const { $ } = lobby();
  $('.info-btn[data-value="golf"]').click();
  $(".sheet-layer .pad-back").click();
  assert.equal($(".sheet-layer.open"), null);
  $('.info-btn[data-value="golf"]').click();
  $('[data-act="sheet-close"]').click();
  assert.equal($(".sheet-layer.open"), null);
  assert.equal($('.tile.on[data-value="golf"]'), null);
});

test("X01 rules name the start score", () => {
  const { $ } = lobby();
  $('.info-btn[data-value="701"]').click();
  assert.match($(".sheet").textContent, /Count down from 701/);
});

test("in a game, (i) in the bar shows the rules of the game being played", () => {
  const { $ } = mount(states(["S20"], { game: "cricket" }));
  assert.ok($(".bar svg.gicon"), "the game's icon sits next to its name");
  $('.info-bar').click();
  assert.match($(".sheet").textContent, /Close 20, 19, 18/);
  assert.equal($('[data-act="sheet-pick"]'), null, "no Play button during a game");
});
