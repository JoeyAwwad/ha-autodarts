// Players: a whole party, pictures and the photo booth, in a browser.
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, states, mount } from "./dom-helpers.mjs";

const lobby = (config) => mount(states([], { game: "off" }), config);
const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

test("the lobby takes a whole party, far past four", () => {
  const { el, $, $$ } = lobby();
  el._setup.players = [];
  for (const n of names(14)) el._act("add-player", n);
  assert.equal(el._setup.players.length, 14);
  assert.equal($$(".plist li").length, 14);
  assert.ok($(".plist.compact"), "a long list gets compact");
  assert.ok($(".addp"), "still room for more");
});

test("Wild Mouse plays twelve players, the thrower big, everybody on the chalkboard", () => {
  const { el, $, $$ } = lobby();
  el._setup.players = names(12);
  $('[data-act="game"][data-value="wild_mouse"]').click();
  $('[data-act="start"]').click();
  assert.equal(el._wm.players.length, 12);
  assert.equal($$(".player").length, 12);
  assert.ok($(".players.many"));
  assert.match($(".player.active").textContent, /P1/);
  assert.equal($$(".chalk .chead .cm").length, 12);
  el._wm.next(); el._render();
  assert.match($(".player.active").textContent, /P2/);
  assert.match($$(".player")[11].getAttribute("style"), /--pc:#14b8a6/, "twelve distinct colours");
});

test("an integration game with more than four warns and starts the first four", async () => {
  const { el, calls, $ } = lobby();
  el._setup.players = names(6);
  $('[data-act="game"][data-value="501"]').click();
  assert.match($(".note.warn").textContent, /up to 4 players/);
  assert.equal($$count($, ".plist li.over"), 2);
  assert.ok($('[data-value="wild_mouse"] .tile-badge'));
  assert.match($('[data-value="cricket"] .tile-badge').textContent, /Max 4/);
  $('[data-act="start"]').click();
  await settle();
  const start = calls.find((c) => c[1] === "start_game");
  assert.deepEqual(start[2].players, ["P1", "P2", "P3", "P4"]);
});
function $$count($, sel) { return $(".plist").querySelectorAll(sel).length; }

test("shuffle keeps everybody, clear empties the list", () => {
  const { el, $ } = lobby();
  el._setup.players = names(8);
  el._render();
  $('[data-act="shuffle"]').click();
  assert.deepEqual([...el._setup.players].sort(), names(8).sort());
  $('[data-act="clear-players"]').click();
  assert.equal(el._setup.players.length, 0);
});

test("pictures: a booth photo, the avatars option, a Home Assistant person, else initials", () => {
  localStorage.clear();
  const s = states([], { game: "off", extra: { "person.sam": { entity_id: "person.sam", state: "home", attributes: { friendly_name: "Sam", entity_picture: "/api/image/serve/abc/512x512" }, last_updated: "1" } } });
  const { el } = mount(s, { avatars: { alex: "/local/darts/alex.png", evil: "javascript:alert(1)" } });
  localStorage.setItem("autodarts-classic:photos", JSON.stringify({ Robin: PIXEL }));
  el._photos = null;
  el._setup.players = ["Robin", "Sam", "Alex", "Evil Kid"];
  el._render();
  const pics = [...el.shadowRoot.querySelectorAll(".plist .pav")];
  assert.equal(pics[0].getAttribute("src"), PIXEL);
  assert.equal(pics[1].getAttribute("src"), "/api/image/serve/abc/512x512");
  assert.equal(pics[2].getAttribute("src"), "/local/darts/alex.png");
  assert.equal(pics[3].tagName, "SPAN"); assert.equal(pics[3].textContent, "EK");
  el._config.avatars["Evil Kid"] = "javascript:alert(1)";
  el._render();
  assert.equal(el.shadowRoot.querySelectorAll(".plist .pav")[3].tagName, "SPAN", "no script URLs as pictures");
});

test("the photos show on the score cards and the result screen", () => {
  const { el, $ } = lobby();
  localStorage.setItem("autodarts-classic:photos", JSON.stringify({ Robin: PIXEL }));
  el._photos = null;
  el._setup.players = ["Robin", "Sam"];
  $('[data-act="game"][data-value="wild_mouse"]').click();
  $('[data-act="start"]').click();
  assert.equal($(".player img.pav").getAttribute("src"), PIXEL);
});

test("the booth without a webcam explains why and offers a picture from a file", async () => {
  const { el, $ } = lobby();
  el._setup.players = ["Robin"]; el._render();
  $('[data-act="photo"][data-value="Robin"]').click();
  await settle();
  assert.ok($(".booth-layer"));
  assert.match($(".booth-msg").textContent, /localhost|webcam/i);
  assert.ok($(".file-btn input[type=file]"));
  $('.booth [data-booth="close"]').click();
  assert.equal($(".booth-layer"), null);
});

test("the booth uses the webcam and frees it again on close", async () => {
  let stopped = 0;
  const stream = { getTracks: () => [{ stop: () => { stopped += 1; } }] };
  Object.defineProperty(globalThis.navigator, "mediaDevices", { value: { getUserMedia: async () => stream }, configurable: true });
  // happy-dom's <video> only takes a real MediaStream.
  Object.defineProperty(window.HTMLMediaElement.prototype, "srcObject", { set() {}, get() { return null; }, configurable: true });
  try {
    const { el, $ } = lobby();
    el._setup.players = ["Robin"]; el._render();
    $('[data-act="photo"][data-value="Robin"]').click();
    await settle(); await settle();
    assert.equal(el._booth.stream, stream);
    assert.equal($('[data-booth="snap"]').hidden, false);
    el._booth.useShot(PIXEL);
    $('[data-booth="keep"]').click();
    assert.equal(stopped, 1, "the camera is released");
    assert.equal(JSON.parse(localStorage.getItem("autodarts-classic:photos")).Robin, PIXEL);
    assert.equal($(".plist img.pav").getAttribute("src"), PIXEL);
    $('[data-act="photo"][data-value="Robin"]').click();
    await settle(); await settle();
    $('[data-booth="remove"]').click();
    assert.equal(JSON.parse(localStorage.getItem("autodarts-classic:photos")).Robin, undefined);
  } finally {
    delete globalThis.navigator.mediaDevices;
  }
});
