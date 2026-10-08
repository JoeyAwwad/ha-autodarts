// Your own voice: record the caller's lines and the sound effects on the screen (#33).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { states, mount } from "./dom-helpers.mjs";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} }, TextEncoder, TextDecoder };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.K = { trimSilence, encodeWav, zipFiles, unzipFiles, crc32, CALLS };", ctx);
const { trimSilence, encodeWav, zipFiles, unzipFiles, crc32, CALLS } = ctx.K;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const until = async (ok, what) => { for (let i = 0; i < 200; i++) { if (ok()) return; await tick(5); } assert.fail(`waited for ${what}`); };

test("the silence is cut off both ends of a take, with a little air", () => {
  const rate = 1000, s = new Float32Array(3000);
  for (let i = 1000; i < 1500; i++) s[i] = Math.sin(i) * 0.5;
  const t = trimSilence(s, rate);
  assert.ok(t.length >= 500 && t.length <= 620, `kept ${t.length} samples`);
  assert.equal(trimSilence(new Float32Array(2000), rate).length, 0, "nothing but silence");
});

test("a take becomes a 16-bit mono WAV file", () => {
  const w = encodeWav(new Float32Array([0, 1, -1]), 22050);
  const txt = (a, b) => String.fromCharCode(...w.slice(a, b));
  assert.equal(txt(0, 4), "RIFF"); assert.equal(txt(8, 12), "WAVE"); assert.equal(txt(36, 40), "data");
  const v = new DataView(w.buffer);
  assert.equal(v.getUint32(24, true), 22050);
  assert.equal(v.getUint32(40, true), 6);
  assert.equal(v.getInt16(46, true), 32767);
});

test("export and import: a plain zip of the recordings, and back", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const files = [{ name: "180.wav", data: new Uint8Array([1, 2, 3]) }, { name: "score_60.wav", data: new Uint8Array(1000).fill(7) }];
  const back = unzipFiles(zipFiles(files));
  assert.deepEqual([...back.map((f) => f.name)], ["180.wav", "score_60.wav"]);
  assert.deepEqual([...back[1].data].slice(0, 3), [7, 7, 7]);
  assert.equal(back[1].data.length, 1000);
});

// The card asks the global navigator (Node's) for the microphone.
const mic = (getUserMedia) => Object.defineProperty(globalThis.navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });

// A microphone, a recorder and a decoder for happy-dom, which has none.
function fakeAudio() {
  const stopped = [];
  mic(async () => ({ getTracks: () => [{ stop: () => stopped.push(1) }] }));
  globalThis.MediaRecorder = class {
    constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob([new Uint8Array(10)]) }); setTimeout(() => this.onstop?.(), 0); }
  };
  window.AudioContext = class {
    async decodeAudioData() { const d = new Float32Array(8000); for (let i = 2000; i < 5000; i++) d[i] = 0.4 * Math.sin(i / 3); return { sampleRate: 8000, getChannelData: () => d }; }
    close() {}
  };
  return stopped;
}
function playsRecorded() {
  const played = [];
  globalThis.Audio = window.Audio = class { constructor(src) { this.src = src; played.push(src); } play() { setTimeout(() => this.onended?.(), 0); return Promise.resolve(); } };
  return played;
}

function openPage() {
  const m = mount(states([], { game: "off" }));
  m.el._voiceBeat = 0;
  m.$('[data-act="voice"]').click();
  return m;
}

test("the page lists every call, the scores, the names and the effects", () => {
  const m = openPage();
  assert.equal(m.$$(".vc-row").length, CALLS.length);
  m.$('[data-vc="tab"][data-value="scores"]').click();
  assert.equal(m.$$(".vc-chip").length, 181);
  m.$('[data-vc="tab"][data-value="names"]').click();
  assert.match(m.$(".vc-list").textContent, /Player 1/);
  m.$('[data-vc="tab"][data-value="sfx"]').click();
  assert.equal(m.$$(".vc-row").length, 11);
  m.$('[data-vc="close"]').click();
  assert.equal(m.$(".voice-layer"), null);
});

test("record, hear, keep: the caller then plays the recording, and Use default goes back", async () => {
  fakeAudio();
  const m = openPage();
  m.$('[data-vc="rec"][data-value="180"]').click();
  await until(() => /Speak now/.test(m.$(".vc-rec")?.textContent), "the recording");
  m.$('[data-vc="stop"]').click();
  await until(() => /Recorded/.test(m.$(".vc-rec")?.textContent), "the take");
  m.$('[data-vc="keep"]').click();
  await tick(5);
  assert.ok(m.el._voice.has("180"));
  assert.match(m.$(".vc-row.own").textContent, /Your recording/);
  const played = playsRecorded();
  m.el._caller.voicePath = "/local/darts/voice/";
  m.el._caller.say(["180", "One hundred and eighty!"]);
  assert.match(played[0], /^blob:/, "the recording before voice_path");
  m.$('[data-vc="default"][data-value="180"]').click();
  await tick(5);
  assert.equal(m.el._voice.has("180"), false);
  m.el._caller.say(["180", "One hundred and eighty!"]);
  await tick(5);
  assert.equal(played.at(-1), "/local/darts/voice/180.mp3");
});

test("record the numbers one by one: Keep goes straight on to the next number", async () => {
  fakeAudio();
  const m = openPage();
  m.$('[data-vc="tab"][data-value="scores"]').click();
  m.$('[data-vc="walk"]').click();
  for (let n = 0; n < 3; n++) {
    await until(() => new RegExp(`Speak now: ${n}(?!\\d)`).test(m.$(".vc-rec")?.textContent), `number ${n}`);
    m.$('[data-vc="stop"]').click();
    await until(() => m.$('[data-vc="keep"]'), "Keep");
    m.$('[data-vc="keep"]').click();
  }
  await until(() => /Speak now: 3(?!\d)/.test(m.$(".vc-rec")?.textContent), "number 3");
  assert.deepEqual(["score_0", "score_1", "score_2"].map((k) => m.el._voice.has(k)), [true, true, true]);
  m.$('[data-vc="stop"]').click();
  await until(() => m.$('[data-vc="cancel"]'), "Cancel");
  m.$('[data-vc="cancel"]').click();
  assert.equal(m.$$(".vc-chip.own").length, 3);
});

test("an effect you recorded replaces the drawn one", () => {
  const played = playsRecorded();
  const m = mount(states([], { game: "off" }));
  m.el._voice._set("sfx_bull", new Blob([new Uint8Array(4)], { type: "audio/wav" }));
  m.el._sfx.play("bull");
  assert.match(played.at(-1), /^blob:/);
});

test("no microphone: a clear note instead of a silent failure", async () => {
  mic(async () => { throw new Error("NotAllowedError"); });
  const m = openPage();
  m.$('[data-vc="rec"][data-value="bust"]').click();
  await tick(5);
  assert.match(m.$(".toast").textContent, /https or on localhost/);
});
