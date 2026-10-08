// Home Assistant sync: the screen's game written to helpers, and controls from Home
// Assistant, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { P, settle, states, mount } from "./dom-helpers.mjs";

const HELPERS = ["status", "game", "player", "scores", "last_dart", "winner", "players"];
const BUTTONS = ["new_game", "rematch", "next_player", "undo", "end_game"];
function helpers(over = {}) {
  const s = {};
  for (const h of HELPERS) s[`input_text.darts_screen_${h}`] = { entity_id: `input_text.darts_screen_${h}`, state: "", attributes: {}, last_updated: "1" };
  for (const b of BUTTONS) s[`input_button.darts_screen_${b}`] = { entity_id: `input_button.darts_screen_${b}`, state: "2026-09-28T10:00:00", attributes: {}, last_updated: "1" };
  s["input_select.darts_screen_game"] = { entity_id: "input_select.darts_screen_game", state: "—", attributes: {}, last_updated: "1" };
  return { ...s, ...over };
}
const set = (m, id, state) => { m.el.hass = { ...m.el._hass, states: { ...m.el._hass.states, [id]: { ...m.el._hass.states[id], state } } }; };
const written = (calls) => Object.fromEntries(calls.filter((c) => c[0] === "input_text").map((c) => [c[2].entity_id.replace("input_text.darts_screen_", ""), c[2].value]));

function wildMouse(config = { ha_sync: true }) {
  const m = mount(states([], { game: "off", extra: helpers() }), config);
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._setup.players = ["Robin", "Sam"];
  m.$('[data-act="game"][data-value="wild_mouse"]').click();
  m.$('[data-act="start"]').click();
  return m;
}

test("the screen writes its game to the helpers, and only what changed", () => {
  const m = wildMouse();
  let w = written(m.calls);
  assert.equal(w.status, "playing"); assert.equal(w.game, "Wild Mouse"); assert.equal(w.player, "Robin");
  assert.equal(w.scores, "Robin 0 · Sam 0");
  m.calls.length = 0;
  m.el._wm.dart("T20"); m.el._render();
  w = written(m.calls);
  assert.deepEqual(Object.keys(w).sort(), ["last_dart"]); assert.equal(w.last_dart, "T20");
  m.calls.length = 0;
  m.el._render();
  assert.equal(m.calls.length, 0, "nothing written twice");
});

test("the integration's games are written too", () => {
  const s = states(["T20"], { extra: helpers() });
  const m = mount(s, { ha_sync: true });
  const w = written(m.calls);
  assert.equal(w.game, "501"); assert.equal(w.player, "A"); assert.equal(w.scores, "A 321 · B 501"); assert.equal(w.last_dart, "T20");
});

test("without ha_sync, or without the helpers, nothing is written", () => {
  const off = mount(states(["T20"], { extra: helpers() }));
  assert.equal(off.calls.filter((c) => c[0] === "input_text").length, 0);
  const none = mount(states(["T20"]), { ha_sync: true });
  assert.equal(none.calls.filter((c) => c[0] === "input_text").length, 0);
});

test("buttons in Home Assistant drive the screen; loading presses nothing", () => {
  const m = wildMouse();
  assert.equal(m.el._wm.current, 0, "no button pressed on load");
  set(m, "input_button.darts_screen_next_player", "2026-09-28T10:05:00");
  assert.equal(m.el._wm.current, 1);
  m.el._wm.dart("T20"); m.el._render();
  set(m, "input_button.darts_screen_undo", "2026-09-28T10:06:00");
  assert.equal(m.el._wm.players[1].marks[20], 0);
  set(m, "input_button.darts_screen_new_game", "2026-09-28T10:07:00");
  assert.ok(m.$(".stage.in-lobby"));
});

test("the player list and the game select start a game from Home Assistant", async () => {
  const m = mount(states([], { game: "off", extra: helpers() }), { ha_sync: true });
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  set(m, "input_text.darts_screen_players", "Mia, Tom , Mia, Priya");
  assert.deepEqual(m.el._setup.players, ["Mia", "Tom", "Priya"]);
  set(m, "input_select.darts_screen_game", "Wild Mouse");
  await settle();
  assert.equal(m.el._wm?.players.map((p) => p.name).join(), "Mia,Tom,Priya");
  set(m, "input_button.darts_screen_end_game", "2026-09-28T10:09:00");
  await settle();
  assert.equal(m.el._wm, null);
});

test("a board camera problem shows on the screen", () => {
  const s = states(["S20"], { extra: { [`binary_sensor.${P}_camera_2_problem`]: { entity_id: `binary_sensor.${P}_camera_2_problem`, state: "on", attributes: { device_class: "problem" }, last_updated: "1" } } });
  const { $ } = mount(s);
  assert.match($(".pill").textContent, /camera has a problem/);
});

test("the package's game select lists exactly the games of the New game screen", async () => {
  const yaml = fs.readFileSync(new URL("./extras/darts-screen-package.yaml", import.meta.url), "utf8");
  const options = yaml.split("options:")[1].split("\n").map((l) => l.match(/^\s+- "?([^"]+)"?$/)?.[1]).filter(Boolean).filter((o) => o !== "—");
  const { $$ } = mount(states([], { game: "off" }));
  const tiles = $$(".tile b").map((b) => b.textContent);
  assert.deepEqual([...options].sort(), [...tiles].sort());
  for (const h of HELPERS) assert.match(yaml, new RegExp(`darts_screen_${h}:`));
  for (const b of BUTTONS) assert.match(yaml, new RegExp(`darts_screen_${b}:`));
});
