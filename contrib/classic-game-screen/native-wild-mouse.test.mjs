// Wild Mouse played by the integration where it has the game, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, settle, states, mount } from "./dom-helpers.mjs";

const OPTIONS = ["off", "501", "cricket", "cut_throat", "tactics", "wild_mouse"];

// Home Assistant's states with an integration that offers Wild Mouse.
function offering(game = "off", attributes = null) {
  const s = states([], { game });
  s[`select.${P}_practice_game`].attributes = { options: OPTIONS };
  if (attributes) s[`sensor.${P}_practice_remaining_score`].attributes = attributes;
  return s;
}

function lobby(players, s = offering()) {
  const m = mount(s);
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = players;
  m.el._setup.bed = true;
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  return m;
}

// The snapshot of a Wild Mouse game of the integration, A to throw.
const snapshot = (extra = {}) => ({
  game: "wild_mouse", player: 1, round: 2, visit: ["D20", "S5", "T19"],
  numbers: [20, 19, 18, 17, 16, 15, 25], targets: ["doubles", "triples", "bed"],
  counted: [20, null, 19], bed: false,
  scores: [
    { player: 1, name: "A", points: 0, mpr: 1.5, marks: [2, 3, 0, 0, 0, 0, 0, 1, 0, 0] },
    { player: 2, name: "B", points: 0, mpr: 0.5, marks: [0, 0, 0, 0, 0, 0, 0, 0, 3, 0] },
  ],
  ...extra,
});

test("a game of up to four goes to the integration, with legs, the bot and three in a bed", async () => {
  const { el, calls, $ } = lobby(["A", "B"]);
  assert.ok($('[data-act="bot"]'), "the integration's Wild Mouse has the bot");
  el._setup.bot = 50;
  $('[data-act="start"]').click();
  await settle();
  assert.equal(el._wm, null);
  const start = calls.find(([d, s]) => d === "autodarts" && s === "start_game");
  assert.deepEqual(start[2], { game: "wild_mouse", players: ["A", "B"], legs: el._setup.legs, bot_level: 50, three_in_a_bed: true });
});

test("a bigger party, or an integration without Wild Mouse, is scored by the screen", async () => {
  const party = lobby(["A", "B", "C", "D", "E", "F"]);
  assert.match(party.$(".setup").textContent, /this screen scores the game itself/);
  assert.equal(party.$('[data-act="bot"]'), null);
  party.$('[data-act="start"]').click();
  await settle();
  assert.equal(party.el._wm.players.length, 6);
  assert.equal(party.calls.some(([, s]) => s === "start_game"), false);

  const old = lobby(["A", "B"], states([], { game: "off" }));
  assert.equal(old.$('[data-act="bot"]'), null);
  old.$('[data-act="start"]').click();
  await settle();
  assert.ok(old.el._wm);
});

test("the integration's game gets the chalkboard rows of its targets and what each dart counted for", () => {
  const { el, $, $$ } = mount(offering("wild_mouse", snapshot()));
  assert.equal(el._wm, null);
  const rows = $$(".crow[data-row]").map((r) => r.dataset.row);
  assert.deepEqual(rows, ["20", "19", "18", "17", "16", "15", "25", "D", "T", "B"]);
  const row = (k) => $$(".crow[data-row]").find((r) => r.dataset.row === k);
  assert.match(row("D").textContent, /Dbl/);
  assert.match(row("B").textContent, /3-Bed/);
  assert.match($(".bar").textContent, /Cricket \+ doubles & triples/);
  assert.match($(".bar").textContent, /3 in a bed/);
  const turn = $(".turn").textContent;
  assert.match(turn, /→ 20/);
  assert.match(turn, /no score/);
  assert.match(turn, /→ 19/);
});

test("three in a bed shows a banner; without the bed there is no bed row", () => {
  const bed = mount(offering("wild_mouse", snapshot({ visit: ["S20", "S20", "S20"], counted: ["bed", "bed", "bed"], bed: true })));
  assert.match(bed.$(".row").textContent, /Three in a bed!/);
  assert.match(bed.$(".turn").textContent, /→ 3 in a bed/);

  const plain = mount(offering("wild_mouse", snapshot({ targets: ["doubles", "triples"] })));
  assert.equal(plain.$$(".crow[data-row]").some((r) => r.dataset.row === "B"), false);
  assert.doesNotMatch(plain.$(".bar").textContent, /3 in a bed/);
});

test("auto next asks the integration for the next player after the third dart", async () => {
  const s = offering("wild_mouse", snapshot());
  const { el, calls } = mount(s, { auto_next: 0.05 });
  assert.match(el.shadowRoot.querySelector(".turn-tag").textContent, /Next player in/);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(calls.filter(([d, sv]) => d === "autodarts" && sv === "next_player").length, 1);

  // Two darts: nothing moves.
  const two = mount(offering("wild_mouse", snapshot({ visit: ["D20", "S5"], counted: [20, null] })), { auto_next: 0.05 });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(two.calls.some(([, sv]) => sv === "next_player"), false);
});
