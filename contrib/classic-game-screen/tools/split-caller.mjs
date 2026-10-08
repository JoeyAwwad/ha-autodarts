// Splits one long recording of the caller into a file per line: read the numbers 0 to 180
// (or any list of lines) with a short pause between them, and this cuts the recording at the
// pauses into score_0.mp3 ... score_180.mp3, ready for the card's voice_path.
//
//   node contrib/classic-game-screen/tools/split-caller.mjs numbers.wav [out-dir]
//   node contrib/classic-game-screen/tools/split-caller.mjs take2.m4a out --from 100 --to 180
//   node contrib/classic-game-screen/tools/split-caller.mjs calls.wav out --lines calls
//   node contrib/classic-game-screen/tools/split-caller.mjs names.wav out --lines name_joey,name_sam
//
// Options: --from / --to (numbers, default 0 and 180), --lines calls | a,b,c, --noise -35
// (dB: quieter than this is a pause), --gap 0.35 (seconds of quiet between two lines),
// --force (write even when the count of lines does not match).
// Needs ffmpeg. The checklist of every line is CALLER-LINES.md.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Every call the caller makes besides the scores and the names, in the order of CALLER-LINES.md.
export const CALLS = [
  "game_on", "180", "no_score", "bust", "you_require", "checkout", "game_shot", "game_shot_leg", "game_shot_match",
  "up_next", "bounce_out", "three_in_a_bed", "doubles_closed", "triples_closed", "bullseye",
  "ladder", "snake", "goal", "killer", "shanghai", "black", "tower_down",
];

// The pauses ffmpeg's silencedetect found: [{start, end}] in seconds.
export function parseSilences(log) {
  const out = [];
  for (const line of String(log).split(/\r?\n/)) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (s) out.push({ start: Math.max(0, Number(s[1])), end: null });
    const e = /silence_end:\s*([\d.]+)/.exec(line);
    if (e && out.length && out.at(-1).end == null) out.at(-1).end = Number(e[1]);
  }
  return out;
}

// The spoken parts between the pauses: [{start, end}], leaving out clicks shorter than minLen.
export function soundSegments(silences, duration, minLen = 0.12) {
  const parts = [];
  let from = 0;
  for (const s of silences) {
    if (s.start - from >= minLen) parts.push({ start: from, end: s.start });
    from = s.end ?? duration;
  }
  if (duration - from >= minLen) parts.push({ start: from, end: duration });
  return parts;
}

// The names of the files, in the order they are read.
export function lineNames({ lines, from = 0, to = 180 }) {
  if (lines === "calls") return [...CALLS];
  if (lines) return String(lines).split(",").map((x) => x.trim()).filter(Boolean);
  const a = Number(from), b = Number(to);
  return Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => `score_${a <= b ? a + i : a - i}`);
}

function args(argv) {
  const o = { files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") o.force = true;
    else if (a.startsWith("--")) o[a.slice(2)] = argv[++i];
    else o.files.push(a);
  }
  return o;
}

function main() {
  const o = args(process.argv.slice(2));
  const [input, outDir = "voice"] = o.files;
  if (!input) { console.error("Usage: split-caller.mjs <recording> [out-dir] [--from 0] [--to 180] [--lines calls|a,b] [--noise -35] [--gap 0.35] [--force]"); process.exit(2); }
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", input, "-af", `silencedetect=noise=${Number(o.noise ?? -35)}dB:d=${Number(o.gap ?? 0.35)}`, "-f", "null", "-"], { encoding: "utf8" });
  if (probe.error) { console.error("ffmpeg is needed: https://ffmpeg.org/download.html"); process.exit(2); }
  const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(probe.stderr);
  if (!dur) { console.error(`Cannot read ${input}`); process.exit(2); }
  const duration = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  const parts = soundSegments(parseSilences(probe.stderr), duration);
  const names = lineNames(o);
  console.log(`${parts.length} spoken parts found, ${names.length} lines expected (${names[0]} ... ${names.at(-1)}).`);
  if (parts.length !== names.length && !o.force) {
    console.error("The counts differ, so the files would be misnamed. Try --gap (a longer pause between lines) or --noise (-30 for a noisy room, -45 for a quiet one), or read again; --force writes anyway.");
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  parts.slice(0, names.length).forEach((p, i) => {
    // A little air on both sides, so no word is clipped.
    const start = Math.max(0, p.start - 0.05), len = p.end - p.start + 0.1;
    const file = path.join(outDir, `${names[i]}.mp3`);
    const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", start.toFixed(3), "-t", len.toFixed(3), "-i", input, "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k", file], { encoding: "utf8" });
    if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
  });
  console.log(`Wrote ${Math.min(parts.length, names.length)} files to ${outDir}. Copy them to config/www/darts/voice/ and set voice_path: /local/darts/voice/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
