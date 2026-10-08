// Smart-home buttons and the highlight photo on the game shot screen (#11).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { states, mount } from "./dom-helpers.mjs";

const extra = {
  "light.board": { state: "on", attributes: { friendly_name: "Board light" }, last_updated: "1" },
  "scene.party": { state: "scening", attributes: { friendly_name: "Party" }, last_updated: "1" },
  "input_button.caller": { state: "unknown", attributes: {}, last_updated: "1" },
};
const buttons = ["light.board", { entity: "scene.party", name: "Party time" }, "input_button.caller", "bad entity"];

test("the buttons option puts smart-home buttons in the bar, lit while on", () => {
  const m = mount(states([], { extra }), { buttons });
  const b = m.$$('[data-act="home"]');
  assert.deepEqual(b.map((x) => x.textContent), ["Board light", "Party time", "caller"]);
  assert.ok(b[0].classList.contains("on"));
  assert.equal(b[1].classList.contains("on"), false);
});

test("a tap toggles a light, turns a scene on and presses a button", async () => {
  const m = mount(states([], { extra }), { buttons });
  for (const e of ["light.board", "scene.party", "input_button.caller"]) m.$(`[data-act="home"][data-value="${e}"]`).click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(m.calls.map((c) => [c[0], c[1], c[2].entity_id]), [
    ["homeassistant", "toggle", "light.board"], ["scene", "turn_on", "scene.party"], ["input_button", "press", "input_button.caller"],
  ]);
});

test("the lobby has the buttons too, and a light's change redraws them", () => {
  const m = mount(states([], { game: "off", extra }), { buttons: ["light.board"] });
  assert.ok(m.$('[data-act="home"].on'));
  m.el.hass = { ...m.el._hass, states: { ...m.el._hass.states, "light.board": { state: "off", attributes: { friendly_name: "Board light" }, last_updated: "2" } } };
  assert.equal(m.$('[data-act="home"].on'), null);
});

test("the highlight photo the blueprint takes shows on the game shot screen", async () => {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  const now = new Date(Date.now() + 2000), p2 = (n) => String(n).padStart(2, "0");
  const file = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}_${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}_Robin_game_shot.jpg`;
  const asked = [];
  m.el._hass.callWS = async (msg) => {
    asked.push(msg.type);
    if (msg.type === "media_source/browse_media") return { children: [{ media_content_id: `media-source://autodarts/${file.slice(0, 7)}/${file}` }, { media_content_id: "media-source://autodarts/2020-01/2020-01-01_10-00-00_Old_180.jpg" }] };
    return { url: "/media/local/autodarts/highlights/" + file + "?authSig=x" };
  };
  m.el._setup.players = ["Robin", "Sam"];
  m.$('[data-act="game"][data-value="x01_party"]').click();
  m.$('[data-act="start"]').click();
  const realSet = globalThis.setInterval;
  m.el._wm.winLeg(0);
  m.el._render();
  assert.ok(m.el._hlTimer, "it looks for the photo");
  // Run the look-up now instead of waiting three seconds.
  clearInterval(m.el._hlTimer);
  m.el._hlTimer = null;
  await (async () => { const fn = m.el._watchHighlight.bind(m.el); globalThis.setInterval = (f) => { f(); return 1; }; fn(); globalThis.setInterval = realSet; })();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(asked.slice(-2), ["media_source/browse_media", "media_source/resolve_media"]);
  assert.match(m.$(".gs-photo").getAttribute("src"), /Robin_game_shot\.jpg/);
});
