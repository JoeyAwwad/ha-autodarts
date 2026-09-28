// Cameras: the thrower replay, the board camera window and the camera setup, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { P, settle, states, mount } from "./dom-helpers.mjs";

// A MediaRecorder that records instantly: every recorder made is kept for the checks.
const made = [];
class FakeRecorder {
  static isTypeSupported(t) { return t === "video/webm"; }
  constructor(stream, opts) { this.stream = stream; this.mimeType = opts.mimeType; this.state = "inactive"; made.push(this); }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["frames"], { type: "video/webm" }) });
    this.onstop?.();
  }
}
const tracks = [];
const fakeStream = () => { const t = { stopped: false, stop() { this.stopped = true; } }; tracks.push(t); return { getTracks: () => [t] }; };
function withMedia(fn) {
  return async () => {
    Object.defineProperty(globalThis.navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => fakeStream(),
      enumerateDevices: async () => [{ kind: "videoinput", deviceId: "cam-monitor", label: "Monitor webcam" }, { kind: "videoinput", deviceId: "cam-oche", label: "Oche webcam" }, { kind: "audioinput", deviceId: "mic" }],
    } });
    globalThis.MediaRecorder = FakeRecorder;
    globalThis.URL.createObjectURL ??= () => "blob:replay";
    globalThis.URL.revokeObjectURL ??= () => {};
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", { configurable: true, value() { return Promise.resolve(); } });
    try { await fn(); } finally { delete globalThis.navigator.mediaDevices; delete globalThis.MediaRecorder; }
  };
}

test("the replay buffer hands over the last seconds and keeps recording", withMedia(async () => {
  const { el } = mount(states([], { game: "off" }));
  const buf = new el._replayBuf.constructor(FakeRecorder);
  made.length = 0;
  const stream = fakeStream();
  assert.ok(buf.start(stream));
  assert.equal(made.length, 1); assert.equal(made[0].state, "recording"); assert.equal(made[0].mimeType, "video/webm");
  const blob = await buf.clip();
  assert.ok(blob instanceof Blob); assert.equal(blob.size, 6);
  assert.equal(made.length, 2, "a new recording starts right away"); assert.equal(made[1].state, "recording");
  buf.stop();
  assert.equal(made[1].state, "inactive"); assert.ok(tracks[tracks.length - 1].stopped, "the webcam is released");
  assert.equal(await buf.clip(), null);
}));

test("the thrower webcam records during a game, a 180 plays the replay, the lobby stops it", withMedia(async () => {
  const s = states(["T20", "T20"]);
  const m = mount(s);
  Object.assign(m.el._camSet, { replay: "cam-oche", replayOn: ["180"] });
  m.el._syncReplay();
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  m.el._replayDelay = 0; m.el._replayShowAfter = 0;
  await settle(); await settle();
  assert.ok(m.el._replayBuf.running);
  m.el._key = null; m.el._render();
  assert.ok(m.$('[data-act="replay"]'), "a replay button in the game bar");
  const k = `sensor.${P}_practice_remaining_score`;
  m.el.hass = { ...m.el._hass, states: { ...s, [k]: { ...s[k], last_updated: "x", attributes: { ...s[k].attributes, visit: ["T20", "T20", "T20"] } } } };
  await settle(); await settle(); await settle();
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(m.$(".replay-layer"), "Let's see that again");
  assert.match(m.$(".replay-head").textContent, /see that again/i);
  m.$('.replay [data-rp="close"]').click();
  assert.equal(m.$(".replay-layer"), null);
  const off = states([], { game: "off" });
  m.el.hass = { ...m.el._hass, states: off };
  m.el._lobby = true; m.el._render();
  assert.equal(m.el._replayBuf.running, false);
  m.el.remove();
}));

test("a moment that is not chosen gets no replay", withMedia(async () => {
  const m = mount(states(["T20", "T20"]));
  Object.assign(m.el._camSet, { replay: "cam-oche", replayOn: ["game_shot"] });
  m.el._syncReplay();
  let asked = 0;
  m.el._replay = () => { asked += 1; };
  await settle(); await settle();
  m.el._maybeReplay("180");
  assert.equal(asked, 0);
  m.el._maybeReplay("game_shot");
  assert.equal(asked, 1);
  m.el.remove(); // lets go of the webcam and its timers
}));

test("the board camera window streams only on the game screen, and opens the camera wall", () => {
  localStorage.clear();
  const m = mount(states(["S20"]), { camera_window: true });
  const win = m.$(".camwin");
  assert.equal(win.hidden, false);
  assert.equal(win.querySelector("img").getAttribute("src"), "http://board:3180/api/streams/cams/0");
  win.click();
  const cams = m.$$(".camwall-cam");
  assert.equal(cams.length, 3);
  cams[1].click();
  assert.equal(m.$(".camwall-layer"), null);
  assert.equal(m.$(".camwin img").getAttribute("src"), "http://board:3180/api/streams/cams/1");
  m.el._lobby = true; m.el._render();
  assert.equal(m.$(".camwin").hidden, true);
  assert.equal(m.$(".camwin img").getAttribute("src"), null, "no stream in the lobby");
});

test("camera setup lists the webcams and remembers the choices", withMedia(async () => {
  localStorage.clear();
  const m = mount(states([], { game: "off" }));
  m.$('[data-act="cams"]').click();
  await settle(); await settle(); await settle();
  const selects = m.$$(".camsetup select");
  assert.equal(selects.length, 2);
  assert.equal(selects[1].querySelectorAll("option").length, 3, "Off + two webcams, no microphone");
  selects[1].value = "cam-oche";
  selects[1].dispatchEvent(new window.Event("change", { bubbles: true }));
  m.$('.camsetup [data-cs="on"][data-value="bull"]').click();
  m.$('.camsetup [data-cs="window"]').click();
  const saved = JSON.parse(localStorage.getItem("autodarts-classic:cameras"));
  assert.equal(saved.replay, "cam-oche"); assert.ok(saved.replayOn.includes("bull")); assert.equal(saved.window, true);
  m.$('.camsetup [data-cs="close"]').click();
  assert.equal(m.$(".camsetup-layer"), null);
}));
