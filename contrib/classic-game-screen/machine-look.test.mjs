// The dart-machine look: themes, player colours, the turn indicator and the result screen.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, states, mount } from "./dom-helpers.mjs";

test("the machine theme is the default, and the lobby switches and remembers the look", () => {
  const { el, $ } = mount(states([], { game: "off" }));
  assert.equal($(".stage").dataset.theme, "machine");
  $('[data-act="theme"][data-value="pub"]').click();
  assert.equal($(".stage").dataset.theme, "pub");
  assert.equal(JSON.parse(localStorage.getItem("autodarts-classic:theme")), "pub");
  el.setConfig({ board_url: "http://board:3180" });
  assert.equal(el._theme, "pub", "a remembered look wins over the default");
});

test("the theme option sets the look", () => {
  const { $ } = mount(states([], { game: "off" }), { theme: "classic" });
  assert.equal($(".stage").dataset.theme, "classic");
});

test("every player card carries its colour; the thrower shows darts left", () => {
  const { $$ } = mount(states(["S20"]));
  const cards = $$(".player");
  assert.match(cards[0].getAttribute("style"), /--pc:#3b82f6/);
  assert.match(cards[1].getAttribute("style"), /--pc:#f43f5e/);
  const tag = cards[0].querySelector(".turn-tag");
  assert.match(tag.textContent, /dart 2 of 3/i);
  assert.equal(tag.querySelectorAll(".pips i.used").length, 1);
  assert.equal(cards[1].querySelector(".turn-tag"), null, "only the thrower has the tag");
});

test("after three darts the thrower is asked to pull the darts", () => {
  const { $ } = mount(states(["S20", "S20", "S20"]));
  assert.match($(".player.active .turn-tag").textContent, /pull your darts/i);
});

test("player_colors replaces the colours, and anything that is not a colour is dropped", () => {
  const { $$ } = mount(states([]), { player_colors: ["#ff00ff", "red;background:url(x)", "teal"] });
  assert.match($$(".player")[0].getAttribute("style"), /--pc:#ff00ff/);
  assert.match($$(".player")[1].getAttribute("style"), /--pc:teal/);
});

test("the result screen ranks the players with their numbers", () => {
  const s = states([]);
  s[`sensor.${P}_practice_remaining_score`].attributes = {
    game: "501", player: 1, winner: 2, legs_to_win: 3, visit: [],
    scores: [{ player: 1, name: "Robin", remaining: 40, legs: 2, average: 70.4 }, { player: 2, name: "Sam", remaining: 0, legs: 3, average: 66.1 }],
  };
  const { $, $$ } = mount(s);
  assert.equal($(".gs-name").textContent, "Sam");
  const rows = $$(".res-row");
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /Sam[\s\S]*3[\s\S]*legs[\s\S]*66\.1[\s\S]*0[\s\S]*left/);
  assert.match(rows[1].textContent, /Robin[\s\S]*70\.4[\s\S]*40/);
  assert.ok($('.gameshot [data-act="rematch"]') && $('.gameshot [data-act="new"]'));
});

test("Wild Mouse shows marks per round and ends on the result screen", async () => {
  const { el, $, $$ } = mount(states([], { game: "off" }));
  el._setup.players = ["Robin", "Sam"];
  $('[data-act="game"][data-value="wild_mouse"]').click();
  $('[data-act="start"]').click();
  const w = el._wm;
  const v = (...d) => { d.forEach((x) => w.dart(x)); w.next(); };
  v("T20", "S20"); // 3 marks closing 20, then 1 scoring 20 points
  el._render();
  assert.match($$(".player")[0].textContent, /MPR 6\.00/); // 4 marks in 2 darts
  for (const n of [19, 18, 17, 16, 15]) { v("S1"); v("T" + n); }
  v("S1"); v("BULL", "S25", "D1"); v("S1"); v("D2", "D3", "T1"); v("S1"); w.dart("T2"); w.dart("T3");
  el._render();
  assert.equal($(".gs-name").textContent, "Robin");
  assert.match($$(".res-row")[0].textContent, /Robin[\s\S]*MPR[\s\S]*20[\s\S]*points/);
});
