// The caller: the recording splitter (#13), the checklist of lines, and the calls of the card's
// games (ladder, snake, goal, ..., up next).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CALLS, parseSilences, soundSegments, lineNames } from "./tools/split-caller.mjs";
import { states, mount } from "./dom-helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const card = fs.readFileSync(path.join(here, "autodarts-classic-card.js"), "utf8");
const checklist = fs.readFileSync(path.join(here, "CALLER-LINES.md"), "utf8");

test("the pauses ffmpeg reports become the spoken parts between them", () => {
  const log = [
    "[silencedetect @ 0x1] silence_start: -0.02", "[silencedetect @ 0x1] silence_end: 0.5 | silence_duration: 0.52",
    "[silencedetect @ 0x1] silence_start: 1.1", "[silencedetect @ 0x1] silence_end: 1.6 | silence_duration: 0.5",
    "[silencedetect @ 0x1] silence_start: 1.65", "[silencedetect @ 0x1] silence_end: 2.2 | silence_duration: 0.55",
    "[silencedetect @ 0x1] silence_start: 3.0",
  ].join("\n");
  const s = parseSilences(log);
  assert.equal(s.length, 4);
  assert.deepEqual(soundSegments(s, 3.4), [{ start: 0.5, end: 1.1 }, { start: 2.2, end: 3.0 }], "a click of 0.05 s between two pauses is no line");
});

test("the lines of a take: 0 to 180 by default, a range, the calls, or a list", () => {
  const all = lineNames({});
  assert.equal(all.length, 181);
  assert.equal(all[0], "score_0");
  assert.equal(all[180], "score_180");
  assert.deepEqual(lineNames({ from: 100, to: 102 }), ["score_100", "score_101", "score_102"]);
  assert.deepEqual(lineNames({ lines: "calls" }), CALLS);
  assert.deepEqual(lineNames({ lines: "name_robin, name_sam" }), ["name_robin", "name_sam"]);
});

test("every line the card calls is a known call, and the checklist has every call", () => {
  const keys = new Set();
  for (const line of card.split("\n").filter((l) => l.includes("_announce("))) for (const m of line.matchAll(/\["([a-z0-9_]+)", "/g)) keys.add(m[1]);
  for (const k of ["doubles_closed", "triples_closed", "game_shot_match", "ladder", "snake", "goal", "killer", "shanghai", "black", "tower_down"]) keys.add(k);
  for (const k of keys) assert.ok(CALLS.includes(k), `${k} is missing from CALLS`);
  for (const k of CALLS) assert.match(checklist, new RegExp("`" + k + "`"), `${k} is missing from CALLER-LINES.md`);
});

test("split-caller cuts a take into a file per line (with ffmpeg)", { skip: spawnSync("ffmpeg", ["-version"]).error ? "no ffmpeg" : false }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "split-"));
  const wav = path.join(dir, "take.wav");
  // Three beeps with pauses between them.
  const make = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i",
    "sine=frequency=440:duration=0.4,apad=pad_dur=0.6[a];sine=frequency=660:duration=0.4,apad=pad_dur=0.6[b];sine=frequency=880:duration=0.4[c];[a][b][c]concat=n=3:v=0:a=1", wav]);
  assert.equal(make.status, 0, String(make.stderr));
  const tool = path.join(here, "tools", "split-caller.mjs");
  const ok = spawnSync(process.execPath, [tool, wav, path.join(dir, "out"), "--lines", "one,two,three"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(fs.readdirSync(path.join(dir, "out")).sort(), ["one.mp3", "three.mp3", "two.mp3"]);
  const wrong = spawnSync(process.execPath, [tool, wav, path.join(dir, "bad"), "--lines", "a,b"], { encoding: "utf8" });
  assert.equal(wrong.status, 1, "two names for three parts: refused");
  assert.equal(fs.existsSync(path.join(dir, "bad")), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

function start(game, players = ["Robin", "Sam"]) {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {};
  const said = [];
  m.el._announce = (...lines) => said.push(lines.map((l) => l[0]).join(" "));
  m.el._setup.players = players;
  m.$(`[data-act="game"][data-value="${game}"]`).click();
  m.$('[data-act="start"]').click();
  m.el._fxArmed = true;
  return { m, said };
}
const throwDart = (m, seg, info) => { m.el._wm.dart(seg, info); m.el._render(); };

test("the card's games call their moments: ladder, snake, goal, and up next with the name", () => {
  const s = start("snakes");
  throwDart(s.m, "D1", {}); throwDart(s.m, "T1", {}); // 1 then 4: the ladder to 17
  assert.ok(s.said.includes("ladder"), s.said.join(" | "));
  s.m.el._wm.next(); s.m.el._render();
  assert.ok(s.said.includes("up_next name_sam"), s.said.join(" | "));
  const f = start("football");
  throwDart(f.m, "Bull", {}); throwDart(f.m, "D20", {});
  assert.ok(f.said.includes("goal"), f.said.join(" | "));
});

test("a snake is no good dart, a ladder is", () => {
  const { m } = start("snakes");
  const g = m.el._wm;
  g.players[0].sq = 14; // 2 more: 16, the snake down to 5
  const d = g.dart("S1", { bed: "SingleOuter" });
  assert.equal(d.event, "snake");
  assert.equal(d.good, false);
  assert.equal(g.players[0].sq, 5);
});
