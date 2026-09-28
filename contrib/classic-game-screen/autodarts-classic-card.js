/*
 * autodarts-classic-card: a full-screen, play.autodarts.io-style game screen for the
 * ha-autodarts integration (https://github.com/Dennis-Otto/ha-autodarts).
 *
 * It only reads the integration's entities, calls its services and talks to the board's
 * local API for the camera picture, so it survives integration updates.
 *
 *   type: custom:autodarts-classic-card
 *   prefix: autodarts_board   # optional: the board's entity id prefix
 *   board_url: http://...:3180 # optional: otherwise taken from the integration's device
 *   camera: 0                  # optional: first camera for the live board
 *   view: virtual              # optional: virtual (drawn board) | live (camera)
 *   overlay: true              # optional: cover Home Assistant's own header and sidebar
 *   brand: Darts               # optional: the name on the screens
 *   photo: /local/my-photo.jpg # optional: a picture for the New game and Game shot screens
 *   stuck_takeout_reset: 5     # optional: seconds before a stuck takeout is reset; 0 turns it off
 */

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// Board radii as a fraction of the double ring's outer edge (170 mm).
const R = { bull: 6.35 / 170, outer: 15.9 / 170, tripleIn: 99 / 170, tripleOut: 107 / 170, doubleIn: 162 / 170 };
// The calibration homography maps camera pixels onto a 1000 x 1000 board plane with the
// bull at (500, 500) and the double ring's outer edge at radius PLANE_R.
const PLANE = 1000, PLANE_R = 360, PLANE_SHOW = 440;
// A takeout the board starts on an empty board and never finishes (Autodarts 2.0.2) is
// reset after this many seconds, so play can go on. The stuck_takeout_reset option
// changes it; 0 leaves the board alone.
const STUCK_TAKEOUT_S = 5;

const GROUPS = [
  { name: "X01", games: [
    ["301", "301", "Classic count-down"], ["501", "501", "The tournament standard"], ["701", "701", "Longer legs"],
    ["101", "101", "Quick finish"], ["901", "901", "Marathon"], ["1001", "1001", "Endurance"]] },
  { name: "Cricket", games: [
    ["cricket", "Cricket", "Close 15–20 and bull"], ["cut_throat", "Cut-Throat", "Points go to opponents"],
    ["tactics", "Tactics", "Cricket from 10 up"], ["wild_mouse", "Wild Mouse", "Cricket plus doubles & triples"]] },
  { name: "Party", games: [
    ["killer", "Killer", "Become the killer, take lives"], ["shanghai", "Shanghai", "Single, double, triple"],
    ["halve_it", "Halve-It", "Miss and lose half"], ["golf", "Golf", "Fewest strokes wins"],
    ["baseball", "Baseball", "Nine innings of runs"], ["count_up", "Count-Up", "Highest total wins"]] },
  { name: "Training", games: [
    ["around_the_clock", "Around the Clock", "1 to 20, then bull"], ["doubles", "Doubles", "Every double in turn"],
    ["checkout", "Checkout", "Random finishes"], ["bobs_27", "Bob's 27", "The doubles classic"],
    ["checkout_121", "121", "Check out 121 and up"], ["catch_40", "Catch 40", "Finishes from 61 to 100"],
    ["jdc_challenge", "JDC Challenge", "The junior challenge"], ["singles", "Singles", "Hit every single"]] },
];
const GAME_NAME = Object.fromEntries(GROUPS.flatMap((g) => g.games.map(([id, name]) => [id, name])));
const X01 = new Set(["101", "301", "501", "701", "901", "1001"]);
const CRICKET = new Set(["cricket", "cut_throat", "tactics"]);
const TRAINING = new Set(GROUPS[3].games.map(([id]) => id));
const LEGS = [1, 2, 3, 5, 7];
const BOT_LEVELS = [["Off", 0], ["Easy", 30], ["Club", 50], ["Pub pro", 70], ["Pro", 90], ["Legend", 110]];
// Every player keeps a colour for the whole game: card, chalkboard column, dart markers.
const PLAYER_COLORS = ["#3b82f6", "#f43f5e", "#22c55e", "#f59e0b"];
// Looks for the screen; "machine" is a dark dart-machine look, "classic" the original blue.
const THEMES = [["Machine", "machine"], ["Classic", "classic"], ["Pub", "pub"], ["Neon", "neon"], ["High contrast", "contrast"]];

// -- Game icons, colours and rules ----------------------------------------------------------
// Line icons on a 48 x 48 grid, drawn in the tile's accent colour. A game without a drawing
// shows its number instead (the X01 games, 121, Bob's 27, Catch 40).
const ICONS = {
  cricket: '<circle cx="24" cy="24" r="17"/><path d="M16 16l16 16M32 16L16 32"/>',
  cut_throat: '<circle cx="24" cy="24" r="11"/><path d="M19 19l10 10M29 19L19 29M24 3v6M24 39v6M3 24h6M39 24h6"/>',
  tactics: '<path d="M10 9h28M10 19h28M10 29h28M10 39h28"/><path d="M14 5l6 8M28 15l6 8M30 25l4 8M14 35l6 8"/>',
  wild_mouse: '<circle cx="24" cy="28" r="12"/><circle cx="12" cy="13" r="7"/><circle cx="36" cy="13" r="7"/><circle cx="20" cy="27" r="1.5"/><circle cx="28" cy="27" r="1.5"/><path d="M22 33q2 2 4 0"/>',
  killer: '<path d="M11 22a13 13 0 1126 0v8l-4 2v6H15v-6l-4-2z"/><circle cx="18" cy="22" r="3.5"/><circle cx="30" cy="22" r="3.5"/><path d="M22 38v-4M26 38v-4"/>',
  shanghai: '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="6"/><path d="M24 6v12"/>',
  halve_it: '<circle cx="24" cy="24" r="17"/><path d="M24 7v34"/><path d="M24 7a17 17 0 010 34z" class="fill"/>',
  golf: '<path d="M16 42V6l18 7-18 7"/><ellipse cx="20" cy="42" rx="12" ry="3"/>',
  baseball: '<circle cx="24" cy="24" r="17"/><path d="M13 11q7 13 0 26M35 11q-7 13 0 26"/><path d="M11 17l4-1M11 31l4 1M37 17l-4-1M37 31l-4 1"/>',
  count_up: '<path d="M8 40h32"/><path d="M12 40V30h6v10M21 40V22h6v18M30 40V12h6v28"/>',
  around_the_clock: '<circle cx="24" cy="24" r="17"/><path d="M24 13v11l7 5"/><path d="M24 4v3M24 41v3M4 24h3M41 24h3"/>',
  doubles: '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="14"/><path d="M11 11l4 4" class="thick"/><circle cx="24" cy="24" r="2"/>',
  checkout: '<circle cx="24" cy="24" r="17"/><path d="M15 25l6 6 12-13"/>',
  jdc_challenge: '<path d="M15 7h18v10a9 9 0 01-18 0z"/><path d="M15 10H9a6 6 0 006 7M33 10h6a6 6 0 01-6 7M24 26v7M17 41h14M19 41l2-8h6l2 8"/>',
  singles: '<path d="M24 24L17 6a19 19 0 0114 0z" class="fill"/><circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="3"/>',
};
const ICON_TEXT = { bobs_27: "27", checkout_121: "121", catch_40: "40" };
const COLORS = {
  101: "#60a5fa", 301: "#3b82f6", 501: "#6366f1", 701: "#8b5cf6", 901: "#a855f7", 1001: "#d946ef",
  cricket: "#22c55e", cut_throat: "#ef4444", tactics: "#14b8a6", wild_mouse: "#f472b6",
  killer: "#dc2626", shanghai: "#f59e0b", halve_it: "#fb923c", golf: "#84cc16", baseball: "#f87171", count_up: "#38bdf8",
  around_the_clock: "#2dd4bf", doubles: "#e11d48", checkout: "#10b981", bobs_27: "#eab308",
  checkout_121: "#06b6d4", catch_40: "#a3e635", jdc_challenge: "#fbbf24", singles: "#c084fc",
};

function gameIcon(id, cls = "gicon") {
  const color = COLORS[id] || "#93c5fd";
  const text = ICON_TEXT[id] || (X01.has(id) ? id : null);
  const body = text
    ? `<text x="24" y="25" class="itext" font-size="${text.length > 3 ? 13 : text.length > 2 ? 16 : 20}">${esc(text)}</text><circle cx="24" cy="24" r="21"/>`
    : ICONS[id] || '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="3"/>';
  return `<svg viewBox="0 0 48 48" class="${cls}" style="--accent:${color}" aria-hidden="true">${body}</svg>`;
}

// How to play, one sheet per game: who can play, the goal, the steps and how it is won.
const X01_RULES = (n) => ({
  players: "1–4 players, or two teams of two",
  goal: `Count down from ${n} to exactly zero.`,
  steps: [
    "Every dart takes its score off your remaining points: a double counts twice, a triple three times, the outer bull 25, the bullseye 50.",
    "Double out (on by default): the last dart has to be a double or the bullseye.",
    "Double in (optional): your score only starts counting after a double.",
    "Bust: going below zero, landing on exactly 1, or reaching zero without a double when double out is on. The visit counts for nothing and the turn passes.",
    "The screen shows a checkout route whenever three darts can finish.",
  ],
  win: "The first to zero wins the leg. Play first to 1, 2, 3, 5 or 7 legs.",
});
const RULES = {
  ...Object.fromEntries([...X01].map((n) => [n, X01_RULES(n)])),
  cricket: {
    players: "1–4 players, or two teams of two",
    goal: "Close 20, 19, 18, 17, 16, 15 and the bull, and score more points than everybody else.",
    steps: [
      "A single is one mark, a double two, a triple three. The outer bull is one mark, the bullseye two.",
      "Three marks close a number.",
      "Once you have closed a number, further marks on it score its value (25 for the bull) as long as an opponent still has it open.",
      "Only 20 to 15 and the bull count; every other number does nothing.",
    ],
    win: "Close everything with at least as many points as everybody else. A closing dart wins at once if your points are enough.",
  },
  cut_throat: {
    players: "1–4 players, or two teams of two",
    goal: "Close 20 to 15 and the bull with the fewest points.",
    steps: [
      "Marks work as in Cricket: single 1, double 2, triple 3; outer bull 1, bullseye 2.",
      "Scoring on a number you closed gives its value to every opponent who still has it open, not to you.",
      "So you want to close numbers quickly and load points onto the others.",
    ],
    win: "Close everything with no more points than anybody else. Fewest points wins.",
  },
  tactics: {
    players: "1–4 players, or two teams of two",
    goal: "Cricket on the twelve targets 20 down to 10 and the bull.",
    steps: [
      "Marks, closing and scoring work exactly as in Cricket, on 20 to 10 and the bull.",
      "Longer than Cricket: more numbers to close, more chances to score.",
    ],
    win: "Close all twelve targets with at least as many points as everybody else.",
  },
  wild_mouse: {
    players: "1–4 players",
    goal: "Cricket on 20 to 15 and the bull, plus Doubles and Triples (and optionally Three in a bed) to close.",
    steps: [
      "Each dart counts for one target only. A double or triple on a cricket number you still have open marks that number (T20 = three marks on 20).",
      "Otherwise a double is one mark on Doubles, a triple one mark on Triples.",
      "Three in a bed (optional): three darts in the same bed in one visit is one mark.",
      "A closed target scores while an opponent still has it open: numbers as in Cricket, Doubles and Triples the full value of the dart, Three in a bed the visit's total.",
    ],
    win: "Close everything and not be behind on points.",
  },
  shanghai: {
    players: "1–4 players",
    goal: "Score the most points on the numbers 1 to 7, one number per round.",
    steps: [
      "Round 1 is played on 1, round 2 on 2, and so on up to 7.",
      "Every dart in any bed of the round's number scores its value; other numbers score nothing.",
      "Shanghai: a single, a double and a triple of the number in one visit wins the game at once.",
    ],
    win: "A Shanghai, or the most points after seven rounds. A tie goes to the player with more hits.",
  },
  halve_it: {
    players: "1–4 players",
    goal: "Hit the target of every round, or lose half your points.",
    steps: [
      "Everybody starts with 40 points.",
      "The nine rounds aim at 15, 16, any double, 17, 18, any triple, 19, 20 and the bull.",
      "Hits on the round's target add their score. In the bull round the outer bull is 25, the bullseye 50.",
      "A visit without a single hit on the target halves your points, rounded down.",
    ],
    win: "The most points after nine rounds.",
  },
  killer: {
    players: "2–4 players, 3 lives each",
    goal: "Be the last player with a life left.",
    steps: [
      "First, throw one dart to claim a number of your own (1 to 20, one nobody has).",
      "After that only doubles count. Hit the double of your own number to become a killer.",
      "A killer takes a life with every hit on another player's double, and loses one on their own double.",
      "A player with no lives left is out and is skipped.",
    ],
    win: "The last player standing wins.",
  },
  golf: {
    players: "1–4 players",
    goal: "Play 9 or 18 holes in the fewest strokes. Hole n is played on the number n.",
    steps: [
      "Up to three darts per hole. You may stop after any dart by pulling your darts; the last dart thrown counts.",
      "Double = hole in one (1 stroke), triple 2, inner single 3, outer single 4, anything else 5.",
      "Inner or outer single comes from where the dart landed, split at the treble ring.",
    ],
    win: "The fewest strokes after the last hole. Ties play extra holes.",
  },
  baseball: {
    players: "1–4 players",
    goal: "Score the most runs in nine innings. Inning n is played on the number n.",
    steps: [
      "One visit of three darts per inning.",
      "A single on the inning's number scores 1 run, a double 2, a triple 3.",
    ],
    win: "The most runs after nine innings. Ties play extra innings on 10, 11 and so on.",
  },
  count_up: {
    players: "1–4 players",
    goal: "Score the most points.",
    steps: ["Every dart scores its full value.", "8 rounds by default."],
    win: "The highest total after the last round. Ties play extra rounds.",
  },
  around_the_clock: {
    players: "Solo training",
    goal: "Hit 1 to 20 and then the bull, in order, in as few darts as possible.",
    steps: ["Any bed of the number counts: single, double or triple.", "For the bull, the outer bull and the bullseye both count."],
    win: "Done after the bull. Beat your fewest darts.",
  },
  doubles: {
    players: "Solo training",
    goal: "Hit every double from D1 to D20 and then the bullseye.",
    steps: ["Only the double ring (and the bullseye at the end) counts.", "Every dart feeds your per-double hit rate in the statistics."],
    win: "Done after the bullseye. Beat your fewest darts.",
  },
  checkout: {
    players: "Solo training",
    goal: "Finish random scores from 2 to 170 on a double.",
    steps: [
      "You get three visits per score.",
      "As in X01, a bust only voids its visit.",
      "The screen shows the checkout route while the attempt is on.",
    ],
    win: "Your checkout rate is the share of scores you finished.",
  },
  bobs_27: {
    players: "Solo training",
    goal: "Get round every double without your score dropping to zero.",
    steps: [
      "Start with 27 points. One visit at each double, D1 to D20, then the bullseye.",
      "Every hit adds the double's value; a visit with no hit subtracts it.",
    ],
    win: "Finish after the bullseye with as many points as you can. Zero or below and the game is lost.",
  },
  checkout_121: {
    players: "Solo training",
    goal: "Check out 121 within nine darts, then climb.",
    steps: [
      "Three visits to finish the target on a double; a bust only voids its visit.",
      "A finish raises the target by one. Three visits without a finish lower it by one, never below 121.",
      "170 is the top.",
    ],
    win: "Your personal best is the highest score you checked out.",
  },
  catch_40: {
    players: "Solo training",
    goal: "Check out every score from 61 to 100 within six darts.",
    steps: [
      "Two visits per score.",
      "A finish in two darts is 3 points, in three darts 2, in four to six darts 1.",
    ],
    win: "Up to 120 points over the 40 scores.",
  },
  jdc_challenge: {
    players: "Solo training",
    goal: "The Junior Darts Corporation's 57-dart routine.",
    steps: [
      "One visit at each number from 10 to 15: every dart in the number scores its value; single, double and triple in one visit add 100.",
      "One dart at each double from D1 to D20 (50 points a hit), then one at the bullseye (100).",
      "One visit at each number from 15 to 20, like the first part.",
    ],
    win: "Up to 3,380 points.",
  },
  singles: {
    players: "Solo training",
    goal: "One visit at each number from 1 to 20, then the bull.",
    steps: ["A single on the target is 1 point, a double 2, a triple 3. Outer bull 1, bullseye 2."],
    win: "Up to 186 points.",
  },
};

// The (i) sheet: how to play one game, with a button to pick it from the lobby.
function rulesSheet(id, { pick = false } = {}) {
  const r = RULES[id];
  if (!r) return "";
  const name = GAME_NAME[id] || id;
  return `
    <div class="sheet" role="dialog" aria-label="How to play ${esc(name)}" style="--accent:${COLORS[id] || "#93c5fd"}">
      <div class="sheet-head">
        ${gameIcon(id, "gicon big")}
        <div><b>${esc(name)}</b><small>${esc(r.players)}</small></div>
        <button class="ghost icon" data-act="sheet-close" title="Close">✕</button>
      </div>
      <p class="sheet-goal">${esc(r.goal)}</p>
      <h4>How to play</h4>
      <ul>${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <h4>Winning</h4>
      <p>${esc(r.win)}</p>
      ${pick ? `<button class="primary sheet-pick" data-act="sheet-pick" data-value="${esc(id)}">Play ${esc(name)}</button>` : ""}
    </div>`;
}

// "T20" -> {ring: "T", number: 20}; bulls and misses too.
function parseSegment(name) {
  const s = String(name || "").toUpperCase();
  if (!s || s.startsWith("M") || s === "MISS") return { ring: "M", number: null, label: "Miss" };
  if (s === "BULL" || s === "DB" || s === "D25" || s === "50") return { ring: "BULL", number: 25, label: "Bull" };
  if (s === "25" || s === "S25" || s === "SB" || s === "OB") return { ring: "OUTER", number: 25, label: "25" };
  const m = s.match(/^([SDT])(\d+)$/);
  if (m) return { ring: m[1], number: Number(m[2]), label: s };
  return { ring: "?", number: null, label: s };
}

function segmentScore(name) {
  const p = parseSegment(name);
  if (p.ring === "BULL") return 50;
  if (p.ring === "OUTER") return 25;
  if (p.number == null) return 0;
  return p.number * ({ S: 1, D: 2, T: 3 }[p.ring] || 0);
}

function polar(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

// An annular wedge between radii r1..r2 and angles a1..a2 (degrees, 0 = right, clockwise).
function wedge(r1, r2, a1, a2) {
  const [x1, y1] = polar(r2, a1), [x2, y2] = polar(r2, a2);
  const [x3, y3] = polar(r1, a2), [x4, y4] = polar(r1, a1);
  return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
}

// The board, with the beds of the visit lit and a marker where each dart sits. Board
// coordinates are fractions of the double ring's outer edge, y pointing up.
function boardSvg(visit, throws = []) {
  const hits = visit.map(parseSegment);
  const hit = (ring, number) => hits.some((h) => h.number === number && h.ring === ring);
  let beds = "";
  ORDER.forEach((n, i) => {
    const a1 = -99 + i * 18, a2 = a1 + 18;
    const dark = i % 2 === 0;
    const single = dark ? "#1b1b1f" : "#efe3c2";
    const ring = dark ? "#d13b3b" : "#1f9d55";
    const bed = (r1, r2, fill, lit) => `<path d="${wedge(r1, r2, a1, a2)}" fill="${fill}" class="bed ${lit ? "lit" : ""}"/>`;
    beds += bed(R.outer, R.tripleIn, single, hit("S", n));
    beds += bed(R.tripleIn, R.tripleOut, ring, hit("T", n));
    beds += bed(R.tripleOut, R.doubleIn, single, hit("S", n));
    beds += bed(R.doubleIn, 1, ring, hit("D", n));
    const [tx, ty] = polar(1.13, -90 + i * 18);
    beds += `<text x="${tx}" y="${ty}" class="num" font-size="0.12">${n}</text>`;
  });
  return `
    <svg viewBox="-1.25 -1.25 2.5 2.5" class="board" aria-label="Dartboard">
      <circle r="1.24" fill="#101014"/>
      ${beds}
      <circle r="${R.outer}" fill="#1f9d55" class="${hits.some((h) => h.ring === "OUTER") ? "lit" : ""}"/>
      <circle r="${R.bull}" fill="#d13b3b" class="${hits.some((h) => h.ring === "BULL") ? "lit" : ""}"/>
      ${throws
        .map((t, i) => {
          const c = t.coords;
          if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return "";
          const newest = i === throws.length - 1 ? "newest" : "";
          return `<g class="vdart ${newest}" transform="translate(${c.x} ${-c.y})"><circle class="halo" r="0.075"/><circle r="0.05"/><text y="0.004" font-size="0.06">${i + 1}</text></g>`;
        })
        .join("")}
    </svg>`;
}

// -- Wild Mouse (Minnesota) Cricket ------------------------------------------------------
// Cricket on 20-15 and bull, plus Doubles and Triples (and optionally Three-in-a-bed) to
// close. The integration has no such game, so the card keeps score itself from the
// board's darts. A dart counts toward one target only: a double or triple on a cricket
// number the thrower still has open marks that number; otherwise it marks Doubles or
// Triples (one mark each). Once a target is closed, hitting it scores while an opponent
// still has it open: numbers as in Cricket, Doubles and Triples the dart's full value,
// Three-in-a-bed the visit's total.
const WM_NUMBERS = [20, 19, 18, 17, 16, 15, 25];
const WM_LABEL = { 25: "Bull", D: "Doubles", T: "Triples", B: "3 in a bed" };

class WildMouse {
  constructor(state) {
    Object.assign(this, state);
  }

  static create(players, { legs = 1, bed = false } = {}) {
    const targets = [...WM_NUMBERS, "D", "T", ...(bed ? ["B"] : [])];
    return new WildMouse({
      kind: "wild_mouse", targets, legsToWin: legs, bed, leg: 1, starter: 0, current: 0,
      players: players.map((name) => ({ name, marks: Object.fromEntries(targets.map((t) => [t, 0])), points: 0, legs: 0, darts: 0, markTotal: 0 })),
      visit: [], bedVisit: false, seen: 0, winner: null, legWinner: null, history: [],
    });
  }

  toJSON() {
    const { history, ...rest } = this;
    return { ...rest, history: history.slice(-20) };
  }

  _open(player, t) {
    return player.marks[t] < 3;
  }

  _scorable(t) {
    return this.players.some((p, i) => i !== this.current && p.marks[t] < 3);
  }

  // The targets one dart could count for, best first.
  static candidates(seg) {
    const p = parseSegment(seg);
    const c = [];
    if (p.number != null && (WM_NUMBERS.includes(p.number))) {
      const marks = { S: 1, OUTER: 1, D: 2, BULL: 2, T: 3 }[p.ring] || 0;
      if (marks) c.push({ t: p.number, marks });
    }
    if (p.ring === "D" || p.ring === "BULL") c.push({ t: "D", marks: 1 });
    if (p.ring === "T") c.push({ t: "T", marks: 1 });
    return c;
  }

  _snapshot() {
    const { history, ...rest } = this;
    return JSON.parse(JSON.stringify(rest));
  }

  // A dart the board saw. Returns what it counted for.
  dart(seg) {
    if (this.winner != null || this.legWinner != null || this.visit.length >= 3) return null;
    if (!this.visit.length) this.history.push(this._snapshot());
    const me = this.players[this.current];
    const value = segmentScore(seg);
    const cands = WildMouse.candidates(seg);
    let pick = cands.find((c) => this._open(me, c.t)) || cands.find((c) => this._scorable(c.t));
    let marks = 0, points = 0;
    if (pick) {
      const unit = pick.t === "D" || pick.t === "T" ? value : pick.t;
      if (this._open(me, pick.t)) {
        marks = Math.min(3 - me.marks[pick.t], pick.marks);
        me.marks[pick.t] += marks;
        const extra = pick.marks - marks;
        if (extra > 0 && typeof pick.t === "number" && this._scorable(pick.t)) points = extra * unit;
      } else {
        points = typeof pick.t === "number" ? pick.marks * unit : unit;
      }
      me.points += points;
    }
    // Match statistics: darts thrown and marks that closed or scored (for marks per round).
    me.darts = (me.darts || 0) + 1;
    me.markTotal = (me.markTotal || 0) + (points ? Math.max(marks, pick.marks) : marks);
    this.visit.push({ seg, target: pick ? pick.t : null, marks, points });
    if (this.visit.length === 3) this._bedCheck();
    this._winCheck();
    return this.visit[this.visit.length - 1];
  }

  _bedCheck() {
    if (!this.bed) return;
    const segs = this.visit.map((d) => parseSegment(d.seg));
    const same = segs.every((x) => x.number != null && x.number === segs[0].number && x.ring === segs[0].ring);
    if (!same) return;
    const me = this.players[this.current];
    const counted = this._open(me, "B") || this._scorable("B");
    if (this._open(me, "B")) me.marks.B += 1;
    else if (this._scorable("B")) me.points += this.visit.reduce((t, d) => t + segmentScore(d.seg), 0);
    if (counted) me.markTotal = (me.markTotal || 0) + 1;
    this.bedVisit = true;
  }

  _winCheck() {
    const me = this.players[this.current];
    const closed = this.targets.every((t) => me.marks[t] >= 3);
    const ahead = this.players.every((p) => p === me || me.points >= p.points);
    if (!closed || !ahead) return;
    me.legs += 1;
    this.legWinner = this.current;
    if (me.legs >= this.legsToWin) this.winner = this.current;
  }

  // The visit ends: darts pulled, or Next player.
  next() {
    if (this.winner != null) return;
    if (this.legWinner != null) {
      // Next leg: fresh marks and points, the next player starts.
      this.players.forEach((p) => { p.points = 0; this.targets.forEach((t) => { p.marks[t] = 0; }); });
      this.leg += 1;
      this.starter = (this.starter + 1) % this.players.length;
      this.current = this.starter;
      this.legWinner = null;
    } else {
      if (!this.visit.length) this.history.push(this._snapshot());
      this.current = (this.current + 1) % this.players.length;
    }
    this.visit = [];
    this.bedVisit = false;
  }

  // Puts dart i of the visit into another bed: the visit is thrown again from its start
  // with the right bed, so marks, points and a won leg all follow.
  correct(i, seg) {
    if (!(i >= 0 && i < this.visit.length) || !this.history.length) return null;
    const darts = this.visit.map((d) => d.seg);
    darts[i] = seg;
    const { seen } = this;
    const start = this.history.pop(); // pushed with the visit's first dart
    const history = this.history;
    Object.keys(this).forEach((k) => delete this[k]);
    Object.assign(this, start, { history });
    darts.forEach((d) => this.dart(d));
    this.seen = seen;
    return this.visit[i];
  }

  // Takes back the last visit (or the darts of the one in progress).
  undo() {
    const prev = this.history.pop();
    if (!prev) return false;
    const history = this.history;
    Object.keys(this).forEach((k) => delete this[k]);
    Object.assign(this, prev, { history });
    return true;
  }
}

// Cricket marks as crisp strokes, readable from the oche: one, two, closed.
const MARK_SVG = [
  "",
  '<svg viewBox="0 0 100 100" class="mk"><path d="M28 78 L72 22"/></svg>',
  '<svg viewBox="0 0 100 100" class="mk"><path d="M28 78 L72 22 M28 22 L72 78"/></svg>',
  '<svg viewBox="0 0 100 100" class="mk closed"><path d="M33 67 L67 33 M33 33 L67 67"/><circle cx="50" cy="50" r="38"/></svg>',
];

// A pub-style cricket board: target numbers down the middle with the two players'
// marks either side, or a column per player for three and four. rows:
// [{label, extra, marks: [one per player]}]; current: index of the player throwing.
function chalkboard(rows, players, current, colors = PLAYER_COLORS) {
  const two = players.length === 2;
  const pc = (i) => `style="--pc:${colors[i % colors.length]}"`;
  const cell = (m, i) => `<div class="cm ${i === current ? "cur" : ""}" ${pc(i)}>${MARK_SVG[Math.min(m || 0, 3)]}</div>`;
  const head = two ? "" : `<div class="crow chead"><div class="clab"></div>${players.map((p, i) => `<div class="cm ${i === current ? "cur" : ""}" ${pc(i)}><span>${esc(p)}</span></div>`).join("")}</div>`;
  const body = rows
    .map((r) => {
      const dead = r.marks.every((m) => m >= 3) ? "dead" : "";
      const label = `<div class="clab ${r.extra ? "extra" : ""}">${esc(r.label)}</div>`;
      return two
        ? `<div class="crow ${dead}">${cell(r.marks[0], 0)}${label}${cell(r.marks[1], 1)}</div>`
        : `<div class="crow ${dead}">${label}${r.marks.map(cell).join("")}</div>`;
    })
    .join("");
  return `<div class="chalk ${two ? "two" : "many"}" style="--cols:${players.length}">${head}${body}</div>`;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`autodarts-classic:${key}`)) ?? fallback;
  } catch (err) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(`autodarts-classic:${key}`, JSON.stringify(value));
  } catch (err) { /* private mode: the choice is just not remembered */ }
}

// -- Sound effects and the caller --------------------------------------------------------------
// Effects are synthesised with Web Audio, so the card needs no sound files. The caller plays
// the recording <voice_path><name>.mp3 when there is one and speaks the line otherwise.

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

// 140 -> "one hundred and forty", the way a caller says it.
function numberWords(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n >= 1000) return String(n);
  const under100 = (m) => (m < 20 ? ONES[m] : TENS[Math.floor(m / 10)] + (m % 10 ? `-${ONES[m % 10]}` : ""));
  if (n < 100) return under100(n);
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${under100(rest)}` : ""}`;
}

class Sound {
  constructor() {
    this.ctx = null;
  }

  // Browsers start audio only after a tap, unless the kiosk allows autoplay.
  unlock() {
    try {
      this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch (err) {
      this.ctx = null;
    }
  }

  // One tone: frequency (Hz, or [from, to] for a glide), start offset and length in seconds.
  _tone(freq, at, len, { type = "sine", gain = 0.25 } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    const [f1, f2] = Array.isArray(freq) ? freq : [freq, freq];
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  // A short burst of noise: the thud of a dart in the board.
  _thud(at = 0, gain = 0.5) {
    const c = this.ctx, t = c.currentTime + at, len = 0.09;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = "lowpass";
    f.frequency.value = 900;
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  play(name) {
    if (!this.ctx) return;
    try {
      const T = (...a) => this._tone(...a);
      switch (name) {
        case "single": this._thud(); T(220, 0, 0.12, { gain: 0.12 }); break;
        case "double": this._thud(); T(523, 0.02, 0.14); T(784, 0.12, 0.2); break;
        case "triple": this._thud(); T(523, 0.02, 0.12); T(659, 0.1, 0.12); T(1047, 0.18, 0.28); break;
        case "outer": this._thud(); T(330, 0.02, 0.2, { type: "triangle" }); break;
        case "bull": this._thud(0, 0.7); T([90, 45], 0, 0.5, { gain: 0.5 }); T(1319, 0.05, 0.5, { gain: 0.12, type: "triangle" }); break;
        case "miss": T([160, 90], 0, 0.22, { type: "square", gain: 0.06 }); break;
        case "bust": T([300, 70], 0, 0.6, { type: "sawtooth", gain: 0.18 }); break;
        case "closed": T(880, 0, 0.1, { type: "triangle" }); T(1175, 0.08, 0.18, { type: "triangle" }); break;
        case "ton": [523, 659, 784].forEach((f, i) => T(f, i * 0.09, 0.25, { type: "triangle" })); break;
        case "180": [523, 659, 784, 1047, 1319].forEach((f, i) => T(f, i * 0.1, 0.35, { type: "sawtooth", gain: 0.12 })); T([60, 40], 0, 1.2, { gain: 0.4 }); break;
        case "win": [[523, 659, 784], [587, 740, 880], [659, 831, 988, 1319]].forEach((ch, i) => ch.forEach((f) => T(f, i * 0.28, i === 2 ? 1.2 : 0.3, { type: "triangle", gain: 0.1 }))); break;
        default: break;
      }
    } catch (err) { /* audio is a nicety */ }
  }
}

// Calls lines one after the other, never over each other.
class Caller {
  constructor() {
    this.queue = [];
    this.busy = false;
    this.voicePath = "";
    this.voiceName = "";
  }

  // line: [recording name, text to speak]; several lines are called in turn.
  say(...lines) {
    this.queue.push(...lines);
    if (!this.busy) this._next();
  }

  stop() {
    this.queue = [];
    this.busy = false;
    try { window.speechSynthesis?.cancel(); } catch (err) { /* nothing to stop */ }
  }

  _next() {
    const line = this.queue.shift();
    if (!line) { this.busy = false; return; }
    this.busy = true;
    const [file, text] = line;
    // A missing recording fails twice (error event and play()); the line is spoken once.
    let settled = false;
    const once = (fn) => () => { if (!settled) { settled = true; fn(); } };
    const speak = once(() => this._speak(text));
    if (this.voicePath && file) {
      try {
        const audio = new Audio(`${this.voicePath}${file}.mp3`);
        audio.onended = once(() => this._next());
        audio.onerror = speak;
        const p = audio.play();
        if (p?.catch) p.catch(speak);
        return;
      } catch (err) { /* fall back to speech */ }
    }
    speak();
  }

  _speak(text) {
    const synth = window.speechSynthesis;
    if (!synth || !text || typeof SpeechSynthesisUtterance === "undefined") return this._next();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices?.() || [];
    const voice = (this.voiceName && voices.find((v) => v.name.includes(this.voiceName)))
      || voices.find((v) => /en[-_]GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.pitch = 0.95;
    u.onend = () => this._next();
    u.onerror = () => this._next();
    synth.speak(u);
  }
}

// What the board saw, as the caller and the effects name it.
function dartKind(seg) {
  const p = parseSegment(seg);
  return { BULL: "bull", OUTER: "outer", T: "triple", D: "double", S: "single", M: "miss" }[p.ring] || "miss";
}

class AutodartsClassicCard extends HTMLElement {
  setConfig(config) {
    this._config = { prefix: "autodarts_board", camera: 0, view: "virtual", overlay: true, brand: "Darts", photo: "", stuck_takeout_reset: STUCK_TAKEOUT_S, theme: "machine", ...config };
    this._theme = load("theme", this._config.theme);
    this._soundOn = load("sound", this._config.sound !== false);
    this._callerOn = load("caller", this._config.caller !== false);
    this._sfx ??= new Sound();
    this._caller ??= new Caller();
    const vp = String(this._config.voice_path || "");
    this._caller.voicePath = vp && !vp.endsWith("/") ? `${vp}/` : vp;
    this._caller.voiceName = String(this._config.caller_voice || "");
    const colors = Array.isArray(this._config.player_colors) && this._config.player_colors.length ? this._config.player_colors : PLAYER_COLORS;
    // Colours go into style attributes: only hex values and plain colour names.
    this._colors = colors.map(String).filter((c) => /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(c));
    if (!this._colors.length) this._colors = PLAYER_COLORS;
    this._key = null;
    this._view = load("board-view", this._config.view);
    this._cam = load("camera", Number(this._config.camera) || 0);
    this._lobby = null; // null: follow the game; true/false: the players asked for it
    this._setup = load("setup", { game: "501", players: ["Player 1", "Player 2"], legs: 1, double_out: true, double_in: false, bot: 0, holes: "9", bed: false });
    const wm = load("wm", null);
    this._wm = wm?.kind === "wild_mouse" ? new WildMouse(wm) : null;
  }

  _saveWm() {
    save("wm", this._wm ? this._wm.toJSON() : null);
  }

  // Darts for a game the card scores itself: new darts on the board count, and the
  // board clearing them (takeout or reset) ends the visit.
  _wmThrows(throws) {
    const wm = this._wm;
    if (!wm) return;
    let changed = false;
    if (throws.length > wm.seen) {
      for (const t of throws.slice(wm.seen)) wm.dart(t.segment?.name || "M");
      changed = true;
    } else if (!throws.length && wm.seen) {
      if (wm.visit.length || wm.legWinner != null) wm.next();
      changed = true;
    }
    wm.seen = throws.length;
    if (changed) {
      this._saveWm();
      this._render();
    }
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  connectedCallback() {
    if (this._stage) {
      this._syncLive();
      this._connectEvents();
    }
  }

  disconnectedCallback() {
    this._stopLive();
    this._closeEvents();
  }

  _id(domain, name) {
    return `${domain}.${this._config.prefix}_${name}`;
  }

  _st(domain, name) {
    return this._hass?.states[this._id(domain, name)];
  }

  set hass(hass) {
    this._hass = hass;
    const watched = ["practice_remaining_score", "practice_checkout", "practice_target", "detection_status", "player_profiles"]
      .map((n) => this._st("sensor", n))
      .concat([this._st("select", "practice_game"), this._st("switch", "practice_manual_entry")]);
    // Re-render only when something the card shows has changed.
    const key = watched.map((s) => s?.last_updated + s?.state).join("|");
    if (key === this._key) return;
    this._key = key;
    this._render();
  }

  // -- board: address, events, live camera -------------------------------------------

  // The board's address: the card option, else the integration's device, else this host.
  _boardUrl() {
    if (this._config.board_url) return this._config.board_url.replace(/\/$/, "");
    const dev = Object.values(this._hass?.devices || {}).find((d) => (d.identifiers || []).some((i) => i[0] === "autodarts"));
    return (dev?.configuration_url || `http://${location.hostname}:3180`).replace(/\/$/, "");
  }

  // Dart positions come straight from the board's event socket; the integration's
  // entities carry the segments but not where on the board the darts sit.
  _connectEvents() {
    if (this._ws || !this.isConnected) return;
    const ws = new WebSocket(`${this._boardUrl().replace(/^http/, "ws")}/api/events`);
    this._ws = ws;
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (err) {
        return;
      }
      if (m.type !== "state" || !m.data) return;
      this._boardThrows = (m.data.throws || []).length;
      this._drawDarts(m.data.throws || []);
      this._watchTakeout(m.data);
      this._wmThrows(m.data.throws || []);
    };
    ws.onclose = () => {
      this._ws = null;
      if (this.isConnected) this._wsRetry = setTimeout(() => this._connectEvents(), 3000);
    };
  }

  _closeEvents() {
    clearTimeout(this._wsRetry);
    clearTimeout(this._stuckTimer);
    this._stuckTimer = null;
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
  }

  _watchTakeout(state) {
    const wait = Number(this._config.stuck_takeout_reset);
    const stuck = state.status === "Takeout in progress" && !state.numThrows && wait > 0;
    if (!stuck) {
      clearTimeout(this._stuckTimer);
      this._stuckTimer = null;
      return;
    }
    if (this._stuckTimer) return;
    this._stuckTimer = setTimeout(() => {
      this._stuckTimer = null;
      fetch(`${this._boardUrl()}/api/reset`, { method: "POST" }).catch(() => {});
      this._toast("The board got stuck after the takeout, so it was reset");
    }, wait * 1000);
  }

  _stopLive() {
    if (this._img) this._img.removeAttribute("src");
    this._liveOn = false;
  }

  async _syncLive() {
    const want = this._view === "live" && this.isConnected && !this._isLobby();
    this._stage.classList.toggle("virtual-mode", this._view !== "live" || this._liveFailed);
    if (!want) return this._stopLive();
    if (this._liveOn && this._liveCam === this._cam) return;
    this._stopLive();
    this._liveOn = true;
    this._liveCam = this._cam;
    const base = this._boardUrl();
    try {
      if (!this._cams) this._cams = (await (await fetch(`${base}/api/system`)).json()).calibration.cams;
      const cam = this._cam % this._cams.length;
      const H = this._cams[cam].homography;
      this._img.style.transform = `matrix3d(${[H[0][0], H[1][0], 0, H[2][0], H[0][1], H[1][1], 0, H[2][1], 0, 0, 1, 0, H[0][2], H[1][2], 0, H[2][2]].join(",")})`;
      this._img.src = `${base}/api/streams/cams/${cam}`;
      this._liveFailed = false;
    } catch (err) {
      this._liveFailed = true;
    }
    this._stage.classList.toggle("virtual-mode", this._liveFailed);
  }

  _drawDarts(throws) {
    if (!this._overlay) return;
    this._lastThrows = throws;
    if (this._virtual) this._virtual.innerHTML = boardSvg(this._lastVisit || [], throws);
    this._overlay.innerHTML = throws
      .map((t, i) => {
        const c = t.coords;
        if (!c) return "";
        const x = PLANE / 2 + c.x * PLANE_R, y = PLANE / 2 - c.y * PLANE_R;
        return `<g class="hit" transform="translate(${x} ${y})"><circle r="16"/><text y="1">${i + 1}</text></g>`;
      })
      .join("");
  }

  _fit() {
    const size = this._viewEl.clientWidth;
    if (size) this._plane.style.transform = `translate(-50%, -50%) scale(${size / (2 * PLANE_SHOW)})`;
  }

  // -- actions ---------------------------------------------------------------------------

  async _call(domain, service, data = {}) {
    try {
      await this._hass.callService(domain, service, data);
      return true;
    } catch (err) {
      this._toast(err?.message || "That did not work");
      return false;
    }
  }

  _toast(text) {
    const t = this.shadowRoot.querySelector(".toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove("show"), 4000);
  }

  _game() {
    const g = this._st("select", "practice_game")?.state;
    return g && g !== "off" && g !== "unknown" && g !== "unavailable" ? g : null;
  }

  // The game on the screen: the card's own, a training game, or the integration's.
  _currentGame() {
    if (this._wm) return this._wm.kind;
    return this._st("sensor", "practice_target")?.attributes?.drill || this._st("sensor", "practice_remaining_score")?.attributes?.game || this._game();
  }

  _isLobby() {
    return this._lobby ?? !(this._wm || this._game());
  }

  _knownPlayers() {
    const profiles = this._st("sensor", "player_profiles")?.attributes?.players || [];
    return profiles
      .slice()
      .sort((a, b) => String(b.last_played || "").localeCompare(String(a.last_played || "")))
      .map((p) => p.name)
      .filter(Boolean);
  }

  async _start(setup = this._setup) {
    const g = setup.game;
    save("setup", setup);
    if (g === "wild_mouse") {
      if (this._game()) await this._call("select", "select_option", { entity_id: this._id("select", "practice_game"), option: "off" });
      this._wake();
      this._wm = WildMouse.create(setup.players.length ? setup.players : ["Player 1"], { legs: setup.legs, bed: setup.bed });
      this._wm.seen = this._boardThrows || 0; // darts already on the board are not part of it
      this._saveWm();
      this._lobby = null;
      this._confirmEnd = false;
      this._announce(["game_on", "Game on!"]);
      return this._render();
    }
    this._wm = null;
    this._saveWm();
    const data = { game: g, players: setup.players.length ? setup.players : ["Player 1"] };
    if (X01.has(g) || CRICKET.has(g)) {
      data.legs = setup.legs;
      if (setup.bot) data.bot_level = setup.bot;
    }
    if (X01.has(g)) {
      data.double_out = setup.double_out;
      data.double_in = setup.double_in;
    }
    if (g === "golf") data.holes = setup.holes;
    if (await this._call("autodarts", "start_game", data)) {
      this._lobby = null;
      this._confirmEnd = false;
      this._key = null;
      this._announce(["game_on", "Game on!"]);
      this._render();
    }
  }

  async _act(act, value) {
    const s = this._setup;
    const wm = this._wm;
    if (act !== "edit-dart" && !act.startsWith("pad-")) this._pad = null;
    if (act !== "sheet") this._sheet = null;
    if (wm && ["undo", "next", "end"].includes(act) && !(act === "end" && !this._confirmEnd)) {
      if (act === "undo") {
        if (!wm.undo()) return this._toast("Nothing to undo");
        wm.seen = this._boardThrows || 0; // darts still in the board are not thrown again
      } else if (act === "next") {
        wm.next();
        wm.seen = this._boardThrows || 0;
      } else {
        this._confirmEnd = false;
        this._wm = null;
        this._lobby = true;
      }
      this._saveWm();
      return this._render();
    }
    switch (act) {
      case "wake": return this._wake();
      case "undo": return this._call("autodarts", "undo_visit");
      case "next": return this._call("autodarts", "next_player");
      case "reset": return this._call("button", "press", { entity_id: this._id("button", "reset_detection") });
      case "new": this._lobby = true; break;
      case "close-lobby": this._lobby = false; break;
      case "rematch": return this._start();
      case "edit-dart": {
        const i = Number(value);
        const ring = parseSegment((this._lastVisit || [])[i]).ring;
        this._pad = this._pad?.dart === i ? null : { dart: i, ring: ["D", "T"].includes(ring) ? ring : "S" };
        break;
      }
      case "pad-ring": if (this._pad) this._pad.ring = value; break;
      case "pad-close": this._pad = null; break;
      case "sheet": this._sheet = this._sheet === value ? null : value; break;
      case "sheet-close": break;
      case "sheet-pick": s.game = value; break;
      case "pad-bed": return this._pad && this._padBed(value);
      case "end":
        if (!this._confirmEnd) {
          this._confirmEnd = true;
          clearTimeout(this._endTimer);
          this._endTimer = setTimeout(() => { this._confirmEnd = false; this._render(); }, 3000);
          break;
        }
        this._confirmEnd = false;
        await this._call("select", "select_option", { entity_id: this._id("select", "practice_game"), option: "off" });
        this._lobby = true;
        break;
      case "game": s.game = value; break;
      case "legs": s.legs = Number(value); break;
      case "bot": s.bot = Number(value); break;
      case "holes": s.holes = value; break;
      case "theme": this._theme = value; save("theme", value); break;
      case "sound": this._soundOn = !this._soundOn; save("sound", this._soundOn); if (this._soundOn) this._sfx.unlock(); break;
      case "caller": this._callerOn = !this._callerOn; save("caller", this._callerOn); if (!this._callerOn) this._caller.stop(); break;
      case "mute": {
        const on = !(this._soundOn || this._callerOn);
        this._soundOn = this._callerOn = on;
        save("sound", on); save("caller", on);
        if (on) this._sfx.unlock(); else this._caller.stop();
        break;
      }
      case "bed": s.bed = !s.bed; break;
      case "double_out": s.double_out = !s.double_out; break;
      case "double_in": s.double_in = !s.double_in; break;
      case "add-player":
        if (!s.players.includes(value) && s.players.length < 4) s.players.push(value);
        break;
      case "remove-player": s.players.splice(Number(value), 1); break;
      case "up-player": {
        const i = Number(value);
        if (i > 0) [s.players[i - 1], s.players[i]] = [s.players[i], s.players[i - 1]];
        break;
      }
      case "start": return this._start();
      case "view":
        this._view = this._view === "live" ? "virtual" : "live";
        this._liveFailed = false;
        save("board-view", this._view);
        break;
      case "cam":
        this._cam = (this._cam + 1) % (this._cams?.length || 3);
        save("camera", this._cam);
        break;
      case "full":
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.().catch(() => {});
        break;
      default: return;
    }
    save("setup", s);
    this._render();
  }

  // -- rendering -------------------------------------------------------------------------

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
      <div class="stage ${this._config.overlay ? "overlay-mode" : ""}" data-theme="${esc(this._theme)}">
        <div class="game-screen">
          <div class="info"></div>
          <div class="boardwrap">
            <div class="view">
              <div class="plane"><img class="cam" alt=""><svg class="overlay" viewBox="0 0 ${PLANE} ${PLANE}"></svg></div>
              <div class="virtual"></div>
            </div>
            <div class="viewctl">
              <button data-act="view" class="ghost"></button>
              <button data-act="cam" class="ghost"></button>
            </div>
          </div>
        </div>
        <div class="lobby"></div>
        <div class="pad-layer"></div>
        <div class="sheet-layer"></div>
        <div class="fx-layer" aria-live="polite"></div>
        <div class="toast" role="status"></div>
      </div>`;
    this._stage = this.shadowRoot.querySelector(".stage");
    if (this._config.photo) this._stage.style.setProperty("--photo", `url("${this._config.photo}")`);
    this._stage.classList.toggle("has-photo", !!this._config.photo);
    document.title = this._config.brand;
    this._info = this.shadowRoot.querySelector(".info");
    this._lobbyEl = this.shadowRoot.querySelector(".lobby");
    this._padEl = this.shadowRoot.querySelector(".pad-layer");
    this._sheetEl = this.shadowRoot.querySelector(".sheet-layer");
    this._fxEl = this.shadowRoot.querySelector(".fx-layer");
    this._viewEl = this.shadowRoot.querySelector(".view");
    this._plane = this.shadowRoot.querySelector(".plane");
    this._img = this.shadowRoot.querySelector(".cam");
    this._overlay = this.shadowRoot.querySelector(".overlay");
    this._virtual = this.shadowRoot.querySelector(".virtual");
    this._img.addEventListener("error", () => {
      if (!this._img.getAttribute("src")) return;
      this._liveFailed = true;
      this._stage.classList.add("virtual-mode");
    });
    new ResizeObserver(() => this._fit()).observe(this._viewEl);
    this._stage.addEventListener("click", (ev) => {
      if (this._soundOn) this._sfx.unlock(); // browsers start audio on a tap
      const b = ev.target.closest("[data-act]");
      if (b && !b.disabled) this._act(b.dataset.act, b.dataset.value);
    });
    this._stage.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const input = ev.target.querySelector("input");
      const name = input.value.trim().slice(0, 20);
      if (name) this._act("add-player", name);
    });
    this._connectEvents();
    if (this._soundOn) this._sfx.unlock(); // works at once where the kiosk allows autoplay
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._stage) {
      this._build();
      if (this._st("sensor", "detection_status")?.state === "stopped") this._wake();
    }
    const lobby = this._isLobby();
    this._stage.classList.toggle("in-lobby", lobby);
    this._stage.dataset.theme = this._theme;
    if (lobby) this._lobbyEl.innerHTML = this._renderLobby();
    else this._renderGame();
    const pad = !!this._pad && !lobby;
    this._padEl.classList.toggle("open", pad);
    this._padEl.innerHTML = pad ? `<div class="pad-back" data-act="pad-close"></div>${this._renderPad()}` : "";
    const sheet = this._sheet ? rulesSheet(this._sheet, { pick: lobby }) : "";
    this._sheetEl.classList.toggle("open", !!sheet);
    this._sheetEl.innerHTML = sheet ? `<div class="pad-back" data-act="sheet-close"></div>${sheet}` : "";
    this._syncLive();
    this._tweenScores();
    this._fxArmed = true; // the first render after loading replays nothing
  }

  // -- feedback: effects, celebrations and the caller -------------------------------------

  _play(name) {
    if (this._soundOn) this._sfx.play(name);
  }

  _announce(...lines) {
    if (this._callerOn) this._caller.say(...lines);
  }

  // What changed since the last render, told with effects and the caller: every new dart,
  // the end of a visit, a bust, a closed target, a new thrower, a won leg or game.
  // ctx: {game, kind, color, bust, winner, match, legs, turn, turnName, remaining, requires, closed, bed}
  _feedback(prev, visit, ctx) {
    const was = this._fxPrev || {};
    this._fxPrev = ctx;
    if (!this._fxArmed || ctx.game !== was.game) return;
    const grew = visit.length > prev.length && prev.every((s, i) => visit[i] === s);
    if (grew) {
      const seg = visit[visit.length - 1];
      this._hitFlash(seg, ctx.color);
      this._play(dartKind(seg));
      if (ctx.closed) {
        this._play("closed");
        if (ctx.closed === "D" || ctx.closed === "T") this._announce([`${ctx.closed === "D" ? "doubles" : "triples"}_closed`, `${ctx.closed === "D" ? "Doubles" : "Triples"} closed!`]);
      }
      if (visit.length === 3 && ctx.kind === "x01" && !ctx.bust && !ctx.winner) {
        const total = visit.reduce((t, s) => t + segmentScore(s), 0);
        if (total === 180) {
          this._celebrate("180", "One hundred and eighty!", "max", ctx.color);
          this._play("180");
          this._announce(["180", "One hundred and eighty!"]);
        } else {
          if (total >= 100) {
            this._celebrate(String(total), total >= 140 ? "Ton forty plus" : "Ton plus", "ton", ctx.color);
            this._play("ton");
          }
          this._announce(total ? [`score_${total}`, numberWords(total)] : ["no_score", "No score"]);
        }
      }
    }
    if (ctx.bed && !was.bed) {
      this._celebrate("3 in a bed", "", "ton", ctx.color);
      this._play("ton");
      this._announce(["three_in_a_bed", "Three in a bed!"]);
    }
    if (ctx.bust && !was.bust) {
      this._celebrate("Bust", "", "bust", ctx.color);
      this._play("bust");
      this._announce(["bust", "Bust!"]);
    }
    if (ctx.winner && ctx.winner !== was.winner) {
      this._confetti();
      this._play("win");
      this._announce([ctx.match ? "game_shot_match" : "game_shot", ctx.match ? "Game shot, and the match!" : "Game shot!"], this._nameLine(ctx.winner));
    } else if (!ctx.winner && ctx.legs && was.legs && ctx.legs !== was.legs) {
      this._play("win");
      this._announce(["game_shot_leg", "Game shot, and the leg!"]);
    } else if (ctx.turn != null && was.turn != null && ctx.turn !== was.turn && !ctx.winner) {
      const r = Number(ctx.remaining);
      if (ctx.kind === "x01" && ctx.requires && r >= 2 && r <= 170) this._announce(this._nameLine(ctx.turnName), ["you_require", "you require"], [`score_${r}`, numberWords(r)]);
    }
  }

  // A player's name for the caller: name_<name>.mp3, or spoken.
  _nameLine(name) {
    return [`name_${String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, String(name || "")];
  }

  // The dart that just landed, big over the board for a moment.
  _hitFlash(seg, color) {
    const p = parseSegment(seg), kind = dartKind(seg);
    const word = { single: "", double: "Double", triple: "Treble", bull: "Bullseye", outer: "Outer bull", miss: "Miss" }[kind];
    const big = kind === "bull" ? "50" : kind === "outer" ? "25" : kind === "miss" ? "✕" : p.label;
    this._fx(`<div class="hitfx ${kind}" style="--pc:${color}"><b>${esc(big)}</b>${word ? `<small>${esc(word)}</small>` : ""}</div>`, 1100);
  }

  _celebrate(big, small, kind, color) {
    this._fx(`<div class="celebrate ${kind}" style="--pc:${color}"><i class="rays"></i><b>${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ""}</div>`, 2600);
  }

  // Paper in the players' colours, falling over the game shot screen.
  _confetti() {
    const bits = Array.from({ length: 90 }, (_, i) => {
      const c = this._colors[i % this._colors.length], x = Math.random() * 100, d = (Math.random() * 1.4).toFixed(2);
      const t = (2.4 + Math.random() * 1.8).toFixed(2), r = Math.round(Math.random() * 720 - 360), w = 6 + Math.round(Math.random() * 8);
      return `<i style="left:${x.toFixed(1)}%;background:${i % 5 === 0 ? "#fcd34d" : c};width:${w}px;animation-delay:${d}s;animation-duration:${t}s;--r:${r}deg"></i>`;
    }).join("");
    this._fx(`<div class="confetti">${bits}</div>`, 5000);
  }

  // One effect at a time in the effects layer; it clears itself.
  _fx(html, ms) {
    if (!this._fxEl) return;
    this._fxEl.insertAdjacentHTML("beforeend", html);
    const el = this._fxEl.lastElementChild;
    [...this._fxEl.children].slice(0, -1).forEach((c) => { if (!c.classList.contains("confetti")) c.remove(); });
    setTimeout(() => el.remove(), ms);
  }

  // Scores run down (or up) to their new value instead of jumping.
  _tweenScores() {
    const now = {};
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    this._info?.querySelectorAll(".player .score").forEach((el, i) => {
      const to = Number(el.textContent);
      if (!Number.isFinite(to) || el.textContent.trim() === "") return;
      now[i] = to;
      const from = this._scoreVals?.[i];
      if (!this._fxArmed || reduced || from == null || from === to || typeof requestAnimationFrame !== "function") return;
      const start = performance.now(), len = Math.min(900, 250 + Math.abs(to - from) * 4);
      const step = (t) => {
        const k = Math.min(1, (t - start) / len), e = 1 - (1 - k) ** 3;
        if (!el.isConnected) return;
        el.textContent = String(Math.round(from + (to - from) * e));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    this._scoreVals = now;
  }

  // -- correcting and adding darts -------------------------------------------------------

  // Darts entered by hand need the integration's manual entry; Wild Mouse is the card's own.
  _manualEntry() {
    return this._st("switch", "practice_manual_entry")?.state === "on";
  }

  // The pad for dart i of the visit: pick the ring, then the bed.
  _renderPad() {
    const { dart, ring } = this._pad;
    const cur = (this._lastVisit || [])[dart];
    const title = cur ? `Dart ${dart + 1}: ${parseSegment(cur).label} is really…` : `Dart ${dart + 1}: add a dart`;
    const rings = [["Single", "S"], ["Double", "D"], ["Triple", "T"]]
      .map(([label, r]) => `<button data-act="pad-ring" data-value="${r}" class="${r === ring ? "on" : ""}">${label}</button>`)
      .join("");
    const beds = Array.from({ length: 20 }, (_, k) => `${ring}${k + 1}`)
      .map((b) => `<button data-act="pad-bed" data-value="${b}">${b}</button>`)
      .join("");
    return `
      <div class="pad" role="dialog" aria-label="${esc(title)}">
        <div class="pad-head"><b>${esc(title)}</b><button class="ghost icon" data-act="pad-close" title="Close">✕</button></div>
        <div class="seg pad-rings">${rings}</div>
        <div class="pad-beds">${beds}</div>
        <div class="pad-extra">
          <button data-act="pad-bed" data-value="25">25</button>
          <button data-act="pad-bed" data-value="BULL">Bull</button>
          <button data-act="pad-bed" data-value="MISS" class="miss">Miss</button>
        </div>
      </div>`;
  }

  // The bed chosen on the pad: corrects dart i, or adds it when the slot was empty.
  async _padBed(seg) {
    const i = this._pad.dart;
    this._pad = null;
    const wm = this._wm;
    if (wm) {
      if (i < wm.visit.length) wm.correct(i, seg);
      else wm.dart(seg);
      this._saveWm();
      return this._render();
    }
    this._render();
    const has = i < (this._lastVisit || []).length;
    await this._call("autodarts", has ? "correct_dart" : "throw_dart", has ? { dart: i + 1, segment: seg } : { segment: seg });
  }

  // Autodarts stands the cameras down after 15 idle minutes; waking is one tap.
  _wake() {
    if (this._st("switch", "detection")?.state === "on" && this._st("sensor", "detection_status")?.state !== "stopped") return;
    this._call("switch", "turn_on", { entity_id: this._id("switch", "detection") });
  }

  _statusPill() {
    const status = this._st("sensor", "detection_status")?.state || "offline";
    if (status === "stopped") return `<button class="pill warn" data-act="wake"><i></i>Board asleep · tap to wake</button>`;
    const text = {
      takeout: "Pull out your darts", takeout_in_progress: "Pulling darts…", calibrating: "Calibrating…",
      starting: "Board starting…", stopping: "Board stopping…", stopped: "Detection stopped",
      offline: "Board offline: is the Autodarts app running?", error: "Board error",
    }[status];
    if (!text) return "";
    const bad = ["offline", "stopped", "error"].includes(status);
    return `<button class="pill ${bad ? "bad" : "warn"}" data-act="reset" title="Reset the board"><i></i>${esc(text)}</button>`;
  }

  // The three darts of the visit. A tap on a dart opens the pad to correct it; the next
  // empty slot adds a dart the board missed, where darts can be entered by hand.
  _slots(visit, note = (s) => ({ text: segmentScore(s), miss: parseSegment(s).ring === "M" }), canAdd = this._manualEntry()) {
    return [0, 1, 2]
      .map((i) => {
        const s = visit[i];
        if (!s && canAdd && i === visit.length) {
          return `<button class="slot empty add" data-act="edit-dart" data-value="${i}" title="Add a dart the board missed"><b>+</b><small>Add dart</small></button>`;
        }
        if (!s) return `<div class="slot empty"><svg viewBox="0 0 64 16" class="dart"><path d="M2 8h30M32 5l10 3-10 3zM42 8h20M48 3l8 5-8 5"/></svg></div>`;
        const n = note(s, i);
        const picked = this._pad?.dart === i ? "picked" : "";
        return `<button class="slot ${n.miss ? "miss" : ""} ${picked}" data-act="edit-dart" data-value="${i}" title="Correct this dart"><b>${esc(parseSegment(s).label)}</b><small>${esc(n.text)}</small><svg class="edit" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4"/></svg></button>`;
      })
      .join("");
  }

  _bar(title, facts) {
    return `
      <header class="bar">
        <div class="title"><span class="avatar" title="${esc(this._config.brand)}"></span>${this._currentGame() ? gameIcon(this._currentGame(), "gicon bar-icon") : ""}<span class="gname">${esc(title)}</span>${facts.map((f) => `<span class="fact">${esc(f)}</span>`).join("")}</div>
        <div class="bar-actions">
          ${this._statusPill()}
          ${RULES[this._currentGame()] ? `<button data-act="sheet" data-value="${esc(this._currentGame())}" class="ghost icon info-bar" title="How to play" aria-label="How to play">i</button>` : ""}
          <button data-act="new" class="ghost">New game</button>
          <button data-act="end" class="ghost ${this._confirmEnd ? "danger" : ""}">${this._confirmEnd ? "Tap again to end" : "End game"}</button>
          <button data-act="mute" class="ghost icon" title="Sound and caller" aria-label="Sound and caller">${this._soundOn || this._callerOn ? "🔊" : "🔇"}</button>
          <button data-act="full" class="ghost icon" title="Full screen">⛶</button>
        </div>
      </header>`;
  }

  _finishBoard(visit, color = this._colors[0], ctx = {}) {
    this._feedback(this._lastVisit || [], visit, { color, ...ctx });
    this._lastVisit = visit;
    if (!visit.length && !(this._lastThrows || []).length) this._lastThrows = [];
    this._virtual.style.setProperty("--pc", color);
    this._virtual.innerHTML = boardSvg(visit, this._lastThrows || []);
    this._stage.querySelector('[data-act="view"]').textContent = this._view === "live" ? "Virtual board" : "Live camera";
    this._stage.querySelector('[data-act="cam"]').textContent = `Camera ${(this._cam % (this._cams?.length || 3)) + 1}`;
  }

  // The result table of an integration game: the winner first, then by legs and score.
  _resultRows(kind, a, scores) {
    const sets = (a.sets_to_win || 1) > 1, legs = (a.legs_to_win || 1) > 1 || sets;
    const main = (p) => (kind === "x01" ? p.remaining : a.game === "killer" ? Math.max(p.lives || 0, 0) : p.points ?? p.score ?? 0);
    const mainLabel = kind === "x01" ? "left" : a.game === "killer" ? "lives" : a.game === "golf" ? "strokes" : "points";
    // Fewer is better for X01 (remaining), Golf (strokes) and Cut-Throat (points).
    const low = kind === "x01" || a.game === "golf" || a.game === "cut_throat";
    return scores
      .map((p, i) => ({ p, i }))
      .sort((x, y) => (y.p.player === a.winner) - (x.p.player === a.winner) || (y.p.sets ?? 0) - (x.p.sets ?? 0)
        || (y.p.legs ?? 0) - (x.p.legs ?? 0) || (low ? main(x.p) - main(y.p) : main(y.p) - main(x.p)))
      .map(({ p, i }) => ({
        name: p.name || `Player ${p.player}`, color: this._pc(i), main: main(p), mainLabel,
        stats: [
          ...(sets ? [["sets", p.sets ?? 0]] : []), ...(legs ? [["legs", p.legs ?? 0]] : []),
          ...(p.average != null ? [["average", Number(p.average).toFixed(1)]] : []),
          ...(p.mpr != null ? [["MPR", Number(p.mpr).toFixed(2)]] : []),
        ],
      }));
  }

  _pc(i) {
    return this._colors[Math.max(i, 0) % this._colors.length];
  }

  // Marks per round: marks that closed or scored, per three darts thrown.
  _mpr(p) {
    return p.darts ? ((p.markTotal || 0) * 3 / p.darts).toFixed(2) : "0.00";
  }

  // Whose turn it is and how many darts are left: shown on the thrower's card.
  _turnTag(thrown) {
    const pips = [0, 1, 2].map((i) => `<i class="${i < thrown ? "used" : ""}"></i>`).join("");
    const text = thrown >= 3 ? "Pull your darts" : `Throwing · dart ${thrown + 1} of 3`;
    return `<div class="turn-tag"><span>${text}</span><span class="pips" aria-label="${3 - Math.min(thrown, 3)} darts left">${pips}</span></div>`;
  }

  // The end of a game: the winner big, then everybody ranked with their numbers.
  // rows: [{name, color, main, mainLabel, stats: [[label, value]]}], best first.
  _resultScreen({ label = "Game shot", winner, rows, undo = false }) {
    const table = rows
      .map((r, i) => `
        <div class="res-row ${i === 0 ? "first" : ""}" style="--pc:${r.color}">
          <span class="res-rank">${i + 1}</span>
          <span class="res-name">${esc(r.name)}</span>
          ${(r.stats || []).map(([l, v]) => `<span class="res-stat"><b>${esc(v)}</b><small>${esc(l)}</small></span>`).join("")}
          <span class="res-main"><b>${esc(r.main)}</b><small>${esc(r.mainLabel || "")}</small></span>
        </div>`)
      .join("");
    return `
      <div class="gameshot" style="--pc:${rows[0]?.color || "#fcd34d"}">
        <div class="gs-label">${esc(label)}</div>
        <div class="gs-name">${esc(winner)}</div>
        <div class="res-table">${table}</div>
        <div class="gs-actions">
          <button class="primary big" data-act="rematch">Rematch</button>
          <button class="big" data-act="new">New game</button>
        </div>
        ${undo ? `<button class="ghost gs-undo" data-act="undo">↶ Wrong reading? Undo the last visit</button>` : ""}
      </div>`;
  }

  // Training games ("drills") keep their state on the target sensor: one thrower, a
  // target to hit next and the progress through the drill.
  _renderDrill(target, d) {
    this._stage.classList.remove("cricket-mode");
    const game = d.drill || this._game();
    const visit = Array.isArray(d.visit) ? d.visit : [];
    const rate = d.hit_rate != null ? `${Math.round(Number(d.hit_rate) <= 1 ? d.hit_rate * 100 : d.hit_rate)}%` : "–";
    const pct = d.targets ? Math.min(100, Math.round(((d.progress || 0) / d.targets) * 100)) : 0;
    const name = this._setup.players[0] || "Training";
    this._info.innerHTML = `
      ${this._bar(GAME_NAME[game] || game, ["Training"])}
      <div class="players n1">
        <div class="player active drill">
          <div class="pname">${esc(name)}</div>
          <div class="tlabel">${d.finished ? "Done" : "Next target"}</div>
          <div class="score">${esc(d.finished ? "✓" : target && target !== "unknown" ? target : "–")}</div>
          ${d.targets ? `<div class="progress"><i style="width:${pct}%"></i></div><div class="stats">${d.progress || 0} of ${d.targets}</div>` : ""}
          <div class="drill-stats">
            <div><b>${d.darts ?? 0}</b><small>darts</small></div>
            <div><b>${d.hits ?? 0}</b><small>hits</small></div>
            <div><b>${rate}</b><small>hit rate</small></div>
            ${d.best != null ? `<div><b>${esc(d.best)}</b><small>best</small></div>` : ""}
          </div>
        </div>
      </div>
      <div class="turn">
        <div class="total">${visit.reduce((t, x) => t + segmentScore(x), 0)}</div>
        ${this._slots(visit)}
      </div>
      <div class="row">
        <div></div>
        <div class="actions">
          <button data-act="undo" ${this._st("sensor", "practice_remaining_score")?.attributes?.undo ? "" : "disabled"}>↶ Undo</button>
          <button data-act="next" class="primary">Next visit ⏭</button>
        </div>
      </div>
      ${d.finished ? `
        <div class="gameshot">
          <div class="gs-label">Training complete</div>
          <div class="gs-name">${d.hits ?? 0} hits · ${rate}</div>
          <div class="gs-actions">
            <button class="primary big" data-act="rematch">Go again</button>
            <button class="big" data-act="new">New game</button>
          </div>
        </div>` : ""}`;
    this._finishBoard(visit, this._colors[0], { game, kind: "drill" });
  }

  _renderWildMouse() {
    const wm = this._wm;
    const label = (t) => (t === 25 ? "Bull" : t === "D" ? "Dbl" : t === "T" ? "Trp" : t === "B" ? "3-Bed" : t);
    const legs = wm.legsToWin > 1;
    const cards = wm.players
      .map((p, i) => {
        const active = i === wm.current && wm.winner == null && wm.legWinner == null;
        return `
          <div class="player ${active ? "active" : ""} ${wm.winner === i || wm.legWinner === i ? "winner" : ""}" style="--pc:${this._pc(i)}">
            ${legs ? `<div class="legs"><span>${p.legs}<small>legs</small></span></div>` : ""}
            <div class="pname">${esc(p.name)}</div>
            <div class="score">${p.points}</div>
            ${active ? this._turnTag(wm.visit.length) : `<div class="stats">${p.darts ? `MPR ${this._mpr(p)}` : ""}</div>`}
          </div>`;
      })
      .join("");
    const slots = this._slots(
      wm.visit.map((d) => d.seg),
      (s, i) => {
        const d = wm.visit[i];
        return { text: d.target == null ? "no score" : `→ ${WM_LABEL[d.target] || d.target}${d.points ? ` +${d.points}` : ""}`, miss: d.target == null };
      },
      wm.winner == null && wm.legWinner == null,
    );
    const points = wm.visit.reduce((t, d) => t + d.points, 0);
    const legName = wm.legWinner != null ? wm.players[wm.legWinner].name : "";
    const hint = wm.legWinner != null && wm.winner == null
      ? `<div class="banner win">Leg to ${esc(legName)}: pull the darts for leg ${wm.leg + 1}</div>`
      : wm.bedVisit ? `<div class="banner">Three in a bed!</div>` : "";
    const facts = ["Cricket + doubles & triples"];
    if (wm.bed) facts.push("3 in a bed");
    if (legs) facts.push(`First to ${wm.legsToWin} legs · Leg ${wm.leg}`);
    const winner = wm.winner != null ? wm.players[wm.winner] : null;
    this._stage.classList.add("cricket-mode");
    this._info.innerHTML = `
      ${this._bar("Wild Mouse", facts)}
      <div class="players n${Math.min(wm.players.length, 4)}">${cards}</div>
      ${chalkboard(
        wm.targets.map((t) => ({ label: label(t), extra: typeof t === "string", marks: wm.players.map((p) => p.marks[t]) })),
        wm.players.map((p) => p.name),
        wm.winner == null ? wm.current : -1,
        this._colors,
      )}
      <div class="turn">
        <div class="total">${points ? `+${points}` : wm.visit.length ? "0" : "–"}</div>
        ${slots}
      </div>
      <div class="row">
        ${hint || "<div></div>"}
        <div class="actions">
          <button data-act="undo" ${wm.history.length ? "" : "disabled"}>↶ Undo</button>
          <button data-act="next" class="primary">Next player ⏭</button>
        </div>
      </div>
      ${winner ? this._resultScreen({
        winner: winner.name,
        undo: true,
        rows: wm.players
          .map((p, i) => ({ p, i }))
          .sort((a, b) => (b.i === wm.winner) - (a.i === wm.winner) || b.p.legs - a.p.legs || b.p.points - a.p.points)
          .map(({ p, i }) => ({
            name: p.name, color: this._pc(i), main: p.points, mainLabel: "points",
            stats: [...(legs ? [["legs", p.legs]] : []), ["MPR", this._mpr(p)], ["darts", p.darts || 0]],
          })),
      }) : ""}`;
    const last = wm.visit[wm.visit.length - 1];
    this._finishBoard(wm.visit.map((d) => d.seg), this._pc(wm.current), {
      game: "wild_mouse", kind: "wm", winner: winner?.name, match: legs, bed: !!wm.bedVisit, turn: wm.current,
      legs: wm.players.map((p) => p.legs).join(),
      closed: last && last.marks > 0 && wm.players[wm.current].marks[last.target] >= 3 ? last.target : null,
    });
  }

  _renderGame() {
    if (this._wm) return this._renderWildMouse();
    const tgt = this._st("sensor", "practice_target");
    if (tgt?.attributes?.drill) return this._renderDrill(tgt.state, tgt.attributes);
    const a = this._st("sensor", "practice_remaining_score")?.attributes || {};
    const kind = X01.has(String(a.game)) ? "x01" : CRICKET.has(a.game) ? "cricket" : "other";
    const visit = Array.isArray(a.visit) ? a.visit : [];
    const visitTotal = visit.reduce((t, s) => t + segmentScore(s), 0);
    const checkout = this._st("sensor", "practice_checkout")?.state;
    const target = this._st("sensor", "practice_target")?.state;
    const scores = Array.isArray(a.scores) ? a.scores : [];
    const legsToWin = a.legs_to_win || 1;
    const setsToWin = a.sets_to_win || 1;
    const winner = a.winner != null ? scores.find((p) => p.player === a.winner) : null;

    const facts = [];
    if (kind === "x01") facts.push(`${a.double_in ? "Double in · " : ""}${a.double_out ? "Double out" : "Single out"}`);
    if (legsToWin > 1 || setsToWin > 1) facts.push(setsToWin > 1 ? `First to ${setsToWin} sets` : `First to ${legsToWin} legs`);
    if (a.round != null) facts.push(`Round ${a.round}${a.rounds ? ` of ${a.rounds}` : ""}`);

    const playerCard = (p, i) => {
      const active = p.player === a.player && !winner;
      let big, sub = "", extra = "";
      if (kind === "x01") {
        big = p.remaining;
        sub = p.average != null ? `Avg ${Number(p.average).toFixed(1)}` : "";
      } else if (kind === "cricket") {
        big = p.points ?? 0;
        sub = p.mpr != null ? `MPR ${Number(p.mpr).toFixed(2)}` : "";
      } else if (a.game === "killer") {
        big = p.number ?? "?";
        sub = p.lives != null && p.lives <= 0 ? "Out" : `${"♥".repeat(Math.max(p.lives || 0, 0))}${p.killer ? " · Killer" : ""}`;
      } else {
        big = p.points ?? p.score ?? p.remaining ?? 0;
      }
      const legs = legsToWin > 1 || setsToWin > 1
        ? `<div class="legs">${setsToWin > 1 ? `<span>${p.sets ?? 0}<small>sets</small></span>` : ""}<span>${p.legs ?? 0}<small>legs</small></span></div>` : "";
      return `
        <div class="player ${active ? "active" : ""} ${winner && p.player === a.winner ? "winner" : ""}" style="--pc:${this._pc(i)}">
          ${legs}
          <div class="pname">${esc(p.name || `Player ${p.player}`)}</div>
          <div class="score">${esc(big)}</div>
          <div class="stats">${esc(sub)}</div>
          ${active ? this._turnTag(visit.length) : ""}
          ${extra}
        </div>`;
    };
    const current = scores.findIndex((p) => p.player === a.player);

    const slots = this._slots(visit);

    const hint =
      a.bust ? `<div class="banner bust">Bust</div>` :
      kind === "x01" && checkout && checkout !== "unknown" ? `<div class="banner">Checkout <b>${esc(checkout)}</b></div>` :
      a.phase === "choose" ? `<div class="banner">Throw to pick your number</div>` :
      kind !== "x01" && target && target !== "unknown" ? `<div class="banner">Aim for <b>${esc(target)}</b></div>` : "";

    const game = a.game || this._game();
    this._stage.classList.toggle("cricket-mode", kind === "cricket");
    const board = kind === "cricket"
      ? chalkboard(
        (a.numbers || []).map((n, i) => ({ label: n === 25 ? "Bull" : n, marks: scores.map((p) => (p.marks || [])[i] || 0) })),
        scores.map((p) => p.name || `Player ${p.player}`),
        winner ? -1 : current,
        this._colors,
      )
      : "";
    this._info.innerHTML = `
      ${this._bar(GAME_NAME[game] || game || "", facts)}
      <div class="players n${Math.min(scores.length, 4)}">${scores.map(playerCard).join("")}</div>
      ${board}
      <div class="turn">
        <div class="total ${a.bust ? "bust" : ""}">${a.bust ? "Bust" : visitTotal}</div>
        ${slots}
      </div>
      <div class="row">
        ${hint || "<div></div>"}
        <div class="actions">
          <button data-act="undo" ${a.undo ? "" : "disabled"}>↶ Undo</button>
          <button data-act="next" class="primary">Next player ⏭</button>
        </div>
      </div>
      ${winner ? this._resultScreen({ winner: winner.name, undo: !!a.undo, rows: this._resultRows(kind, a, scores) }) : ""}`;
    this._finishBoard(visit, this._pc(current), {
      game, kind, bust: !!a.bust, winner: winner?.name, match: legsToWin > 1 || setsToWin > 1, turn: a.player,
      turnName: scores[current]?.name, legs: scores.map((p) => `${p.sets ?? 0}.${p.legs ?? 0}`).join(),
      remaining: scores[current]?.remaining, requires: !!checkout && checkout !== "unknown",
    });
  }

  _renderLobby() {
    const s = this._setup;
    const g = s.game;
    const running = !!(this._wm || this._game());
    const tiles = GROUPS.map((grp) => `
      <section>
        <h3>${grp.name}</h3>
        <div class="tiles">${grp.games
          .map(([id, name, blurb]) => `
            <div class="tile-wrap" style="--accent:${COLORS[id] || "#93c5fd"}">
              <button class="tile ${id === g ? "on" : ""}" data-act="game" data-value="${id}">
                ${gameIcon(id)}<b>${esc(name)}</b><small>${esc(blurb)}</small>
              </button>
              ${RULES[id] ? `<button class="info-btn" data-act="sheet" data-value="${id}" title="How to play ${esc(name)}" aria-label="How to play ${esc(name)}">i</button>` : ""}
            </div>`)
          .join("")}</div>
      </section>`).join("");

    const known = this._knownPlayers().filter((n) => !s.players.includes(n)).slice(0, 8);
    const players = `
      <ol class="plist">${s.players
        .map((n, i) => `
          <li><span class="pnum">${i + 1}</span><span class="pn">${esc(n)}</span>
            ${i ? `<button class="mini" data-act="up-player" data-value="${i}" title="Move up">▲</button>` : ""}
            <button class="mini" data-act="remove-player" data-value="${i}" title="Remove">✕</button></li>`)
        .join("")}</ol>
      ${s.players.length < 4 ? `
        <form class="addp"><input maxlength="20" placeholder="Add a player" enterkeyhint="done"><button class="mini wide">Add</button></form>
        ${known.length ? `<div class="chips">${known.map((n) => `<button class="chip" data-act="add-player" data-value="${esc(n)}">+ ${esc(n)}</button>`).join("")}</div>` : ""}
        <div class="chips">${!s.players.includes("Guest") ? `<button class="chip" data-act="add-player" data-value="Guest">+ Guest</button>` : ""}</div>` : ""}`;

    const seg = (act, options, current) =>
      `<div class="seg">${options.map(([label, value]) => `<button data-act="${act}" data-value="${value}" class="${String(value) === String(current) ? "on" : ""}">${label}</button>`).join("")}</div>`;
    const toggle = (act, label, on) => `<button class="toggle ${on ? "on" : ""}" data-act="${act}"><i></i>${label}</button>`;

    let options = "";
    if (X01.has(g) || CRICKET.has(g)) {
      options += `<div class="opt"><label>Legs to win</label>${seg("legs", LEGS.map((n) => [n, n]), s.legs)}</div>`;
      options += `<div class="opt"><label>Play the bot</label>${seg("bot", BOT_LEVELS, s.bot || 0)}</div>`;
    }
    if (X01.has(g)) options += `<div class="opt"><label>Rules</label><div class="toggles">${toggle("double_out", "Double out", s.double_out)}${toggle("double_in", "Double in", s.double_in)}</div></div>`;
    if (g === "golf") options += `<div class="opt"><label>Holes</label>${seg("holes", [["9", "9"], ["18", "18"]], s.holes)}</div>`;
    if (g === "wild_mouse") {
      options += `<div class="opt"><label>Legs to win</label>${seg("legs", LEGS.map((n) => [n, n]), s.legs)}</div>`;
      options += `<div class="opt"><label>Extra target</label><div class="toggles">${toggle("bed", "Three in a bed", s.bed)}</div></div>`;
      options += `<p class="note">Close 20–15, bull, 3 doubles and 3 triples. A double or triple on an open number counts for the number first.</p>`;
    }
    if (TRAINING.has(g)) options += `<p class="note">Training game: best played alone.</p>`;

    return `
      <header class="bar">
        <div class="title"><span class="avatar"></span><span class="gname">${esc(this._config.brand)}</span><span class="fact">New game</span></div>
        <div class="bar-actions">
          ${this._statusPill()}
          ${running ? `<button data-act="close-lobby" class="ghost">Back to game</button>` : ""}
          <button data-act="full" class="ghost icon" title="Full screen">⛶</button>
        </div>
      </header>
      <div class="lobby-grid">
        <div class="games">
          ${this._config.photo ? `
            <div class="hero">
              <div class="hero-text"><b>${esc(this._config.brand)}</b><span>Pick a game, add the players, game on.</span></div>
            </div>` : ""}
          ${tiles}
        </div>
        <aside class="setup">
          <h3>Players</h3>
          ${players}
          ${options ? `<h3>Options</h3>${options}` : ""}
          <button class="primary start" data-act="start">Start ${esc(GAME_NAME[g] || g)}</button>
          <h3>Screen</h3>
          <div class="opt"><label>Look</label>${seg("theme", THEMES, this._theme)}</div>
          <div class="opt"><label>Sound</label><div class="toggles">${toggle("sound", "Effects", this._soundOn)}${toggle("caller", "Caller", this._callerOn)}</div></div>
        </aside>
      </div>`;
  }
}

const CSS = `
  :host { display: block; height: 100%; }
  * { box-sizing: border-box; }
  .stage {
    /* Theme tokens: background, glass panels, lines, solid panels, ink on white, overlays, glow. */
    --glass: rgba(255, 255, 255, 0.045); --glass-2: rgba(255, 255, 255, 0.1); --line: rgba(255, 255, 255, 0.11);
    --panel: #12141d; --ink: #0b0d14; --overlay: rgba(4, 5, 10, 0.94); --glow: rgba(99, 102, 241, 0.4);
    --bg:
      radial-gradient(ellipse at 50% -25%, rgba(99, 102, 241, 0.24), transparent 55%),
      radial-gradient(ellipse at 100% 110%, rgba(34, 211, 238, 0.1), transparent 50%),
      #07080c;
    height: calc(100dvh - var(--header-height, 56px)); overflow: hidden; color: #fff;
    font-family: "Open Sans", "Segoe UI", Roboto, system-ui, sans-serif; -webkit-tap-highlight-color: transparent;
    background: var(--bg);
  }
  .stage[data-theme="classic"] {
    --glass: rgba(255, 255, 255, 0.09); --glass-2: rgba(255, 255, 255, 0.16); --line: rgba(255, 255, 255, 0.16);
    --panel: #1f1a54; --ink: #27307a; --overlay: rgba(12, 11, 38, 0.93); --glow: rgba(80, 220, 200, 0.4);
    --bg:
      radial-gradient(ellipse at 70% 90%, rgba(60, 170, 190, 0.32), transparent 55%),
      radial-gradient(ellipse at 85% 0%, rgba(90, 120, 230, 0.5), transparent 60%),
      linear-gradient(160deg, #221d5c 0%, #2a3688 45%, #2a55a1 100%);
  }
  .stage[data-theme="pub"] {
    --glass: rgba(0, 0, 0, 0.22); --glass-2: rgba(255, 255, 255, 0.1); --line: rgba(255, 255, 255, 0.14);
    --panel: #0f2e22; --ink: #0c2a1e; --overlay: rgba(4, 18, 12, 0.94); --glow: rgba(250, 204, 21, 0.3);
    --bg: radial-gradient(ellipse at 50% 40%, #1d5a42 0%, #0e3526 55%, #07190f 100%);
  }
  .stage[data-theme="neon"] {
    --glass: rgba(255, 255, 255, 0.04); --glass-2: rgba(255, 255, 255, 0.09); --line: rgba(236, 72, 153, 0.35);
    --panel: #130a26; --ink: #1a0b33; --overlay: rgba(6, 2, 16, 0.95); --glow: rgba(236, 72, 153, 0.5);
    --bg:
      radial-gradient(ellipse at 0% 0%, rgba(236, 72, 153, 0.28), transparent 50%),
      radial-gradient(ellipse at 100% 100%, rgba(34, 211, 238, 0.24), transparent 50%),
      #05010d;
  }
  .stage[data-theme="contrast"] {
    --glass: #141414; --glass-2: #262626; --line: rgba(255, 255, 255, 0.55);
    --panel: #0a0a0a; --ink: #000; --overlay: rgba(0, 0, 0, 0.97); --glow: transparent;
    --bg: #000;
  }
  .stage[data-theme="contrast"] .players:not(.n1) .player:not(.active):not(.winner) { opacity: 0.8; }
  /* Cover Home Assistant's own header and sidebar: the players only see the game. */
  .stage.overlay-mode { position: fixed; inset: 0; z-index: 10; height: 100dvh; }

  button {
    font: inherit; font-weight: 600; color: #fff; cursor: pointer; border-radius: 10px;
    background: var(--glass-2); border: 1px solid var(--line); padding: 10px 16px; font-size: 1rem;
    transition: background 0.15s, transform 0.08s; touch-action: manipulation;
  }
  button:hover { background: rgba(255, 255, 255, 0.24); }
  button:active { transform: scale(0.97); }
  button:disabled { opacity: 0.35; cursor: default; transform: none; }
  button.ghost { background: transparent; }
  button.ghost:hover { background: var(--glass-2); }
  button.primary { background: #fff; color: var(--ink); border-color: #fff; }
  button.primary:hover { background: #e8ecff; }
  button.danger { background: #dc2626; border-color: #dc2626; }
  button.icon { padding: 10px 13px; }
  button.big { font-size: 1.3rem; padding: 16px 34px; }

  .game-screen {
    height: 100%; padding: 14px clamp(12px, 2.5vw, 36px) 18px;
    display: grid; gap: 16px; grid-template-rows: auto minmax(0, 1fr);
  }
  .info { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  @media (min-aspect-ratio: 5/4) {
    .game-screen { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); align-items: stretch; }
    .info { justify-content: center; }
    .info .bar { position: absolute; top: 14px; left: clamp(12px, 2.5vw, 36px); right: clamp(12px, 2.5vw, 36px); z-index: 2; }
    .game-screen { position: relative; padding-top: 76px; }
  }
  .in-lobby .game-screen { display: none; }
  .lobby { display: none; height: 100%; overflow: auto; padding: 14px clamp(12px, 2.5vw, 36px) 24px; }
  .in-lobby .lobby { display: block; }

  .bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .title { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .gname { font-size: clamp(1.5rem, 3.8vh, 2.8rem); font-weight: 800; letter-spacing: -0.01em; }
  .title { align-items: center; }
  .avatar { display: none; }
  .has-photo .avatar {
    display: inline-block; width: 38px; height: 38px; border-radius: 50%; flex: none; align-self: center;
    background: var(--photo) 48% 23% / 260% auto no-repeat; border: 2px solid #4f8dff; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }
  .hero {
    position: relative; height: clamp(170px, 26vh, 260px); border-radius: 16px; overflow: hidden; margin-bottom: 18px;
    background: var(--photo) right 24% / 58% auto no-repeat, linear-gradient(120deg, var(--panel), color-mix(in srgb, var(--panel) 70%, #3b4fd8));
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  /* Fade the picture's left edge into the banner so the title sits on a clean ground. */
  .hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, var(--panel) 0%, var(--panel) 44%, color-mix(in srgb, var(--panel) 55%, transparent) 58%, transparent 80%); }
  .hero-text { position: absolute; left: 26px; bottom: 22px; z-index: 1; display: flex; flex-direction: column; gap: 4px; }
  .hero-text b { font-size: clamp(2rem, 4vw, 3.4rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1; }
  .hero-text span { opacity: 0.85; font-size: 1.05rem; }
  .fact { font-size: clamp(0.95rem, 2.2vh, 1.4rem); opacity: 0.85; }
  .bar-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .pill { display: inline-flex; align-items: center; gap: 8px; font-size: 0.9rem; background: rgba(0, 0, 0, 0.25); border-color: transparent; }
  .pill i { width: 10px; height: 10px; border-radius: 50%; background: currentColor; animation: blink 1.2s infinite; }
  .pill.warn { color: #fcd34d; } .pill.bad { color: #fca5a5; }
  @keyframes blink { 50% { opacity: 0.3; } }

  .players { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .players.n1 { grid-template-columns: 1fr; }
  .player {
    position: relative; text-align: center; padding: 14px 14px 16px; border-radius: 14px;
    background: var(--glass); border: 2px solid transparent; transition: background 0.25s, border-color 0.25s, opacity 0.25s;
  }
  .players:not(.n1) .player:not(.active):not(.winner) { opacity: 0.55; }
  /* The player's colour: a bar along the top, and the whole card lit while they throw. */
  .player { --pc: #93c5fd; overflow: hidden; }
  .player::before { content: ""; position: absolute; inset: 0 0 auto; height: 5px; background: var(--pc); }
  .player.active {
    background: linear-gradient(180deg, color-mix(in srgb, var(--pc) 30%, transparent), color-mix(in srgb, var(--pc) 8%, transparent));
    border-color: var(--pc); box-shadow: 0 0 0 1px var(--pc), 0 12px 50px color-mix(in srgb, var(--pc) 45%, transparent);
    animation: throwing 2.4s ease-in-out infinite;
  }
  @keyframes throwing { 50% { box-shadow: 0 0 0 1px var(--pc), 0 12px 70px color-mix(in srgb, var(--pc) 65%, transparent); } }
  .player.winner { border-color: #fcd34d; box-shadow: 0 0 40px rgba(252, 211, 77, 0.4); }
  .turn-tag {
    display: inline-flex; align-items: center; gap: 12px; margin-top: 8px; padding: 6px 14px; border-radius: 999px;
    background: var(--pc); color: #fff; font-weight: 800; font-size: clamp(0.9rem, 2.2vh, 1.4rem); text-transform: uppercase; letter-spacing: 0.06em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }
  .pips { display: inline-flex; gap: 6px; }
  .pips i { width: clamp(10px, 1.6vh, 16px); height: clamp(10px, 1.6vh, 16px); border-radius: 50%; background: #fff; box-shadow: 0 0 6px rgba(255, 255, 255, 0.7); }
  .pips i.used { background: rgba(0, 0, 0, 0.3); box-shadow: none; }
  .pname { font-size: clamp(1.1rem, 3.2vh, 2.2rem); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
  .score {
    font-size: clamp(64px, min(10vw, 18vh), 210px); font-weight: 800; line-height: 1.02; letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums; text-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  }
  .players.n3 .score, .players.n4 .score { font-size: clamp(52px, min(7vw, 13vh), 150px); }
  .stats { font-size: clamp(1rem, 2.6vh, 1.8rem); font-weight: 600; opacity: 0.9; min-height: 1.2em; }
  .legs { position: absolute; top: 10px; right: 14px; display: flex; gap: 12px; font-weight: 800; font-size: clamp(1.4rem, 3.6vh, 2.4rem); line-height: 1; }
  .legs small { display: block; font-size: clamp(0.6rem, 1.4vh, 0.9rem); font-weight: 700; opacity: 0.7; text-transform: uppercase; }
  .tlabel { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.14em; opacity: 0.7; margin-top: 6px; }
  .progress { height: 8px; border-radius: 999px; background: rgba(0, 0, 0, 0.25); margin: 10px auto 4px; max-width: 420px; overflow: hidden; }
  .progress i { display: block; height: 100%; background: linear-gradient(90deg, #6ee7a0, #22c55e); border-radius: inherit; transition: width 0.4s; }
  .drill-stats { display: flex; justify-content: center; gap: clamp(16px, 4vw, 48px); margin-top: 12px; }
  .drill-stats b { display: block; font-size: clamp(1.6rem, 4.5vh, 3rem); font-weight: 800; }
  .drill-stats small { font-size: clamp(0.8rem, 1.8vh, 1.2rem); text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; }
  .tlabel { font-size: clamp(0.9rem, 2.2vh, 1.4rem); }
  .marks { display: grid; grid-template-columns: repeat(auto-fit, minmax(34px, 1fr)); gap: 4px; margin-top: 10px; }
  .mark { background: rgba(0, 0, 0, 0.2); border-radius: 6px; padding: 3px 0; font-size: 0.75rem; }
  .mark span { display: block; opacity: 0.7; }
  .mark b { display: block; height: 1.3em; font-size: 1.05rem; }
  .mark.m3 { background: rgba(110, 231, 160, 0.3); }

  .chalk {
    flex: 1 1 auto; min-height: 0; display: grid; grid-auto-rows: minmax(0, 1fr); gap: 3px;
    background: rgba(0, 0, 0, 0.22); border-radius: 14px; padding: 6px;
  }
  .crow { display: grid; align-items: center; border-radius: 8px; min-height: 0; }
  .chalk.two .crow { grid-template-columns: 1fr clamp(90px, 13vh, 170px) 1fr; }
  .chalk.many .crow { grid-template-columns: clamp(90px, 13vh, 170px) repeat(var(--cols), 1fr); }
  .crow:nth-child(odd) { background: rgba(255, 255, 255, 0.04); }
  .clab {
    text-align: center; font-weight: 800; font-size: clamp(22px, 4.6vh, 54px); line-height: 1; font-variant-numeric: tabular-nums;
  }
  .clab.extra { color: #fcd34d; font-size: clamp(18px, 3.6vh, 42px); }
  .cm { height: 100%; display: grid; place-items: center; border-radius: 8px; min-height: 0; }
  .cm { --pc: #fff; }
  .cm.cur { background: color-mix(in srgb, var(--pc) 16%, transparent); }
  .chead .cm span { color: var(--pc); font-weight: 800; font-size: clamp(0.9rem, 2.2vh, 1.4rem); text-transform: uppercase; letter-spacing: 0.05em; }
  .mk { height: clamp(24px, 5.2vh, 60px); width: auto; stroke: color-mix(in srgb, var(--pc) 45%, #fff); stroke-width: 11; stroke-linecap: round; fill: none; }
  .mk.closed { stroke: var(--pc); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--pc) 70%, transparent)); }
  .crow.dead { opacity: 0.3; }
  .crow.dead .clab { text-decoration: line-through; text-decoration-thickness: 3px; }

  /* Cricket games: compact score cards, the chalkboard takes the height, the board a
     little less width. */
  .cricket-mode .info { justify-content: flex-start; }
  .cricket-mode .player { padding: 8px 12px 10px; }
  .cricket-mode .score { font-size: clamp(48px, 10vh, 130px); }
  @media (min-aspect-ratio: 5/4) {
    .cricket-mode .game-screen { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); }
  }
  .mark.extra span { color: #fcd34d; opacity: 1; font-weight: 700; }

  .turn { display: grid; grid-template-columns: 1fr 1.3fr 1.3fr 1.3fr; gap: 8px; }
  .total, .slot {
    height: clamp(64px, 12vh, 140px); border-radius: 12px; background: var(--glass);
    display: grid; place-items: center; align-content: center; font-variant-numeric: tabular-nums;
  }
  .total { font-size: clamp(36px, 7vh, 84px); font-weight: 800; background: var(--glass-2); }
  .total.bust { color: #fecaca; background: rgba(220, 38, 38, 0.5); font-size: clamp(26px, 3vw, 40px); }
  .slot b { font-size: clamp(28px, 6vh, 72px); font-weight: 800; line-height: 1; }
  .slot small { opacity: 0.85; font-size: clamp(0.9rem, 2.1vh, 1.4rem); font-weight: 600; }
  .slot.miss b { color: #fca5a5; }
  button.slot { width: 100%; padding: 0; position: relative; border: 2px solid transparent; color: #fff; }
  button.slot:hover { background: var(--glass-2); }
  button.slot.picked { border-color: #fcd34d; }
  .slot .edit {
    position: absolute; top: 8px; right: 8px; width: clamp(16px, 2.6vh, 26px); height: auto; opacity: 0.6;
    fill: none; stroke: #fff; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
  }
  button.slot:hover .edit { opacity: 1; }
  .slot.add { border-style: dashed; border-color: var(--line); }
  .slot.add b { opacity: 0.8; }

  /* The pad to correct a dart or add one: above the game shot screen, big touch targets. */
  .pad-layer { display: none; }
  .pad-layer.open { display: grid; position: fixed; inset: 0; z-index: 8; place-items: center; }
  .pad-back { position: absolute; inset: 0; background: rgba(5, 5, 20, 0.6); }
  .pad {
    position: relative; width: min(560px, 94vw); padding: 18px; border-radius: 16px; background: var(--panel);
    border: 1px solid var(--line); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; gap: 12px;
  }
  .pad-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 1.25rem; }
  .pad-rings button { flex: 1; padding: 12px; font-size: 1.05rem; }
  .pad-beds { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .pad-extra { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .pad-beds button, .pad-extra button { padding: 14px 0; font-size: 1.2rem; font-weight: 800; background: var(--glass); }
  .pad-extra .miss { color: #fca5a5; }
  .dart { width: 70%; max-width: 110px; stroke: rgba(255, 255, 255, 0.45); fill: rgba(255, 255, 255, 0.45); stroke-width: 2; }

  .row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .actions { display: flex; gap: 8px; }
  .actions button { padding: clamp(12px, 1.8vh, 20px) clamp(18px, 2.4vh, 30px); font-size: clamp(1.05rem, 2.6vh, 1.6rem); }
  .banner { font-size: clamp(1.15rem, 3vh, 2rem); padding: 10px 18px; border-radius: 10px; background: rgba(0, 0, 0, 0.28); }
  .banner b { font-size: clamp(1.4rem, 3.8vh, 2.6rem); margin-left: 10px; letter-spacing: 0.04em; }
  .banner.bust { background: rgba(220, 38, 38, 0.6); font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; }

  .gameshot {
    position: fixed; inset: 0; z-index: 5; display: grid; place-content: center; gap: 14px; text-align: center;
    background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--pc) 28%, transparent), transparent 60%), var(--overlay); animation: pop 0.4s ease-out;
  }
  .has-photo .gameshot {
    /* The picture fills the left at full height (about 0.8 x the height wide) and fades out before its edge. */
    background: linear-gradient(90deg, color-mix(in srgb, var(--panel) 20%, transparent) 0, color-mix(in srgb, var(--panel) 60%, transparent) 45vh, var(--panel) 78vh), var(--photo) 0 25% / auto 100% no-repeat, var(--panel);
  }
  .gs-label { font-size: clamp(1.2rem, 2.5vw, 1.8rem); letter-spacing: 0.4em; text-transform: uppercase; color: #fcd34d; font-weight: 700; }
  .gs-name { font-size: clamp(48px, 9vw, 120px); font-weight: 800; }
  .gs-actions { display: flex; gap: 12px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
  @keyframes pop { from { opacity: 0; transform: scale(1.05); } }
  .gs-undo { justify-self: center; margin-top: 18px; font-size: 0.95rem; opacity: 0.75; }
  /* Effects: the dart that just landed, celebrations and confetti, above the game shot screen. */
  .fx-layer { position: fixed; inset: 0; z-index: 7; pointer-events: none; overflow: hidden; }
  .hitfx {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center;
    padding: 18px 42px; border-radius: 22px; background: rgba(0, 0, 0, 0.55); border: 3px solid var(--pc);
    box-shadow: 0 0 60px color-mix(in srgb, var(--pc) 55%, transparent); animation: hit 1.1s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
  }
  @media (min-aspect-ratio: 5/4) { .hitfx { left: 74%; } }
  .hitfx b { font-size: clamp(64px, 14vh, 170px); font-weight: 900; line-height: 1; letter-spacing: -0.02em; }
  .hitfx small { font-size: clamp(1.1rem, 3vh, 2rem); font-weight: 800; text-transform: uppercase; letter-spacing: 0.25em; color: var(--pc); }
  .hitfx.double b { color: #4ade80; text-shadow: 0 0 30px rgba(74, 222, 128, 0.7); }
  .hitfx.triple b { color: #f87171; text-shadow: 0 0 30px rgba(248, 113, 113, 0.8); }
  .hitfx.triple { animation-name: hit-big; }
  .hitfx.bull b, .hitfx.outer b { color: #fde047; text-shadow: 0 0 40px rgba(253, 224, 71, 0.9); }
  .hitfx.bull { animation-name: hit-big; border-color: #fde047; }
  .hitfx.miss { border-color: rgba(255, 255, 255, 0.3); box-shadow: none; animation-name: hit-miss; }
  .hitfx.miss b { opacity: 0.6; }
  @keyframes hit { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 18% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); } 30% { transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.96); } }
  @keyframes hit-big { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(-6deg); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1.22) rotate(2deg); } 34% { transform: translate(-50%, -50%) scale(1) rotate(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes hit-miss { 0% { opacity: 0; } 15% { opacity: 1; transform: translate(-54%, -50%); } 25% { transform: translate(-46%, -50%); } 35% { transform: translate(-50%, -50%); } 75% { opacity: 1; } 100% { opacity: 0; } }
  .celebrate {
    position: absolute; inset: 0; display: grid; place-content: center; text-align: center; animation: cel 2.6s ease-out forwards;
    background: radial-gradient(circle, color-mix(in srgb, var(--pc) 35%, transparent), rgba(0, 0, 0, 0.75) 70%);
  }
  .celebrate b { position: relative; font-size: clamp(120px, 34vh, 380px); font-weight: 900; line-height: 0.9; letter-spacing: -0.04em; color: #fff; text-shadow: 0 0 60px var(--pc), 0 0 120px var(--pc); animation: slam 2.6s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards; }
  .celebrate small { position: relative; font-size: clamp(1.4rem, 4vh, 3rem); font-weight: 800; text-transform: uppercase; letter-spacing: 0.3em; color: #fcd34d; margin-top: 10px; }
  .celebrate.ton b { font-size: clamp(90px, 24vh, 260px); }
  .celebrate.bust { background: radial-gradient(circle, rgba(220, 38, 38, 0.45), rgba(0, 0, 0, 0.7) 70%); }
  .celebrate.bust b { color: #fecaca; text-shadow: 0 0 60px #dc2626; text-transform: uppercase; font-size: clamp(90px, 22vh, 240px); }
  .celebrate .rays {
    position: absolute; left: 50%; top: 50%; width: 180vmax; height: 180vmax; transform: translate(-50%, -50%); opacity: 0.35;
    background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--pc) 70%, transparent) 0 6deg, transparent 6deg 18deg);
    animation: spin 8s linear infinite; -webkit-mask-image: radial-gradient(circle, #000 10%, transparent 55%); mask-image: radial-gradient(circle, #000 10%, transparent 55%);
  }
  .celebrate.bust .rays { display: none; }
  @keyframes cel { 0% { opacity: 0; } 8% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes slam { 0% { transform: scale(2.6); opacity: 0; } 12% { transform: scale(0.94); opacity: 1; } 20% { transform: scale(1.04); } 28% { transform: scale(1); } }
  @keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
  .confetti i { position: absolute; top: -20px; height: 14px; border-radius: 2px; animation: fall linear forwards; }
  @keyframes fall { to { transform: translateY(110vh) rotate(var(--r)); } }
  @media (prefers-reduced-motion: reduce) { .hitfx, .celebrate, .celebrate b, .celebrate .rays, .player.active { animation: none !important; } .confetti { display: none; } }
  .gs-name { color: var(--pc); text-shadow: 0 0 40px color-mix(in srgb, var(--pc) 60%, transparent); line-height: 1; }
  .res-table { display: flex; flex-direction: column; gap: 8px; width: min(820px, 92vw); margin: 10px auto 0; }
  .res-row {
    display: flex; align-items: center; gap: clamp(10px, 2vw, 26px); padding: 10px 18px; border-radius: 12px;
    background: var(--glass); border-left: 6px solid var(--pc); text-align: left;
  }
  .res-row.first { background: color-mix(in srgb, var(--pc) 22%, transparent); }
  .res-rank { font-size: 1.4rem; font-weight: 800; opacity: 0.7; width: 1.4em; }
  .res-name { flex: 1; font-size: clamp(1.2rem, 3vh, 2rem); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .res-stat, .res-main { display: flex; flex-direction: column; align-items: center; min-width: 64px; }
  .res-stat b { font-size: clamp(1.1rem, 2.6vh, 1.6rem); }
  .res-main b { font-size: clamp(1.6rem, 4.4vh, 2.8rem); font-weight: 800; }
  .res-stat small, .res-main small { opacity: 0.7; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.1em; }

  .boardwrap { position: relative; min-height: 220px; display: flex; justify-content: center; align-items: center; container-type: size; }
  .view {
    position: relative; width: min(100cqw, 100cqh); height: min(100cqw, 100cqh); border-radius: 50%; overflow: hidden;
    box-shadow: 0 0 70px 14px var(--glow); background: #0b0b10;
  }
  .plane { position: absolute; left: 50%; top: 50%; width: ${PLANE}px; height: ${PLANE}px; overflow: hidden; }
  .cam { position: absolute; left: 0; top: 0; transform-origin: 0 0; max-width: none; }
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hit circle { fill: #fde047; stroke: #111; stroke-width: 4; }
  .hit text { fill: #111; font: 800 20px system-ui, sans-serif; text-anchor: middle; dominant-baseline: central; }
  .virtual { position: absolute; inset: 0; display: none; }
  .virtual-mode .virtual { display: block; }
  .virtual-mode .plane { display: none; }
  .virtual-mode .view { background: transparent; box-shadow: none; overflow: visible; }
  .board { width: 100%; height: 100%; filter: drop-shadow(0 0 40px var(--glow)); }
  .board .num { fill: #fff; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
  .board .bed { stroke: rgba(210, 210, 220, 0.55); stroke-width: 0.004; }
  .board .lit { fill: #fde047 !important; animation: pulse 1.4s ease-in-out infinite; }
  /* Darts of the visit in the thrower's colour, the newest one white. */
  .vdart circle { fill: var(--pc, #22d3ee); stroke: #0b1020; stroke-width: 0.012; }
  .vdart.newest circle:not(.halo) { fill: #fff; }
  .vdart .halo { fill: color-mix(in srgb, var(--pc, #22d3ee) 35%, transparent); stroke: none; }
  .vdart text { fill: #0b1020; font-weight: 800; text-anchor: middle; dominant-baseline: central; }
  .vdart.newest .halo { animation: ping 1.2s ease-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes ping { 0% { transform: scale(0.7); opacity: 1; } 100% { transform: scale(1.9); opacity: 0; } }
  @keyframes pulse { 50% { opacity: 0.6; } }
  .viewctl { position: absolute; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
  .viewctl button { font-size: 0.8rem; padding: 7px 11px; opacity: 0.7; }
  .viewctl button:hover { opacity: 1; }
  .virtual-mode [data-act="cam"] { display: none; }

  .lobby-grid { display: grid; gap: 22px; margin-top: 14px; grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 900px) { .lobby-grid { grid-template-columns: minmax(0, 1fr) 360px; align-items: start; } }
  .lobby h3 { margin: 6px 0 10px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.14em; opacity: 0.7; }
  .games section + section { margin-top: 16px; }
  .tiles { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .tile-wrap { position: relative; }
  .tile {
    width: 100%; height: 100%; text-align: left; padding: 14px; min-height: 118px; border: 2px solid transparent;
    background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 26%, transparent), var(--glass) 70%);
  }
  .tile:hover { background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 40%, transparent), var(--glass-2) 70%); }
  .tile b { display: block; font-size: 1.15rem; margin-top: 8px; }
  .tile small { display: block; margin-top: 4px; font-weight: 400; opacity: 0.7; font-size: 0.8rem; }
  .tile.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 8px 28px color-mix(in srgb, var(--accent) 35%, transparent); }
  .gicon { width: 44px; height: 44px; display: block; fill: none; stroke: var(--accent); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
  .gicon .fill { fill: var(--accent); fill-opacity: 0.35; }
  .gicon .thick { stroke-width: 6; }
  .gicon .itext { fill: var(--accent); stroke: none; font-weight: 800; text-anchor: middle; dominant-baseline: central; font-family: inherit; }
  .gicon.big { width: 64px; height: 64px; }
  .gicon.bar-icon { width: clamp(30px, 4.6vh, 48px); height: auto; align-self: center; }
  .info-btn {
    position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; padding: 0; border-radius: 50%;
    font: italic 800 1rem Georgia, serif; background: rgba(0, 0, 0, 0.25); border-color: rgba(255, 255, 255, 0.3);
  }
  .info-btn:hover { background: var(--accent); border-color: var(--accent); }
  button.info-bar { font: italic 800 1.1rem Georgia, serif; width: 42px; }

  /* How to play: a sheet over the lobby or the game. */
  .sheet-layer { display: none; }
  .sheet-layer.open { display: grid; position: fixed; inset: 0; z-index: 9; place-items: center; }
  .sheet {
    position: relative; width: min(620px, 94vw); max-height: 88vh; overflow: auto; padding: 22px 24px; border-radius: 18px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 22%, var(--panel)), var(--panel) 60%);
    border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent); box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  }
  .sheet-head { display: flex; align-items: center; gap: 14px; }
  .sheet-head div { flex: 1; display: flex; flex-direction: column; }
  .sheet-head b { font-size: 1.7rem; font-weight: 800; }
  .sheet-head small { opacity: 0.75; }
  .sheet-goal { font-size: 1.15rem; font-weight: 600; margin: 16px 0 6px; }
  .sheet h4 { margin: 16px 0 6px; font-size: 0.8rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
  .sheet ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; line-height: 1.4; }
  .sheet p { margin: 0; line-height: 1.4; }
  .sheet-pick { width: 100%; margin-top: 18px; padding: 14px; font-size: 1.15rem; font-weight: 800; }
  .setup { position: sticky; top: 0; padding: 16px; border-radius: 14px; background: rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; gap: 8px; }
  .plist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .plist li { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 10px; border-radius: 10px; background: var(--glass); }
  .pnum { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: var(--ink); font-weight: 800; font-size: 0.85rem; }
  .pn { flex: 1; font-weight: 700; }
  button.mini { padding: 6px 10px; font-size: 0.85rem; border-radius: 8px; background: transparent; }
  button.mini.wide { background: var(--glass-2); }
  .addp { display: flex; gap: 6px; }
  .addp input {
    flex: 1; min-width: 0; font: inherit; color: #fff; padding: 10px 12px; border-radius: 10px;
    background: rgba(0, 0, 0, 0.25); border: 1px solid var(--line); outline: none;
  }
  .addp input::placeholder { color: rgba(255, 255, 255, 0.5); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 6px 12px; font-size: 0.9rem; border-radius: 999px; background: var(--glass); }
  .opt { display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px; }
  .opt label { font-size: 0.85rem; opacity: 0.8; }
  .seg { display: flex; flex-wrap: wrap; gap: 4px; }
  .seg button { padding: 8px 12px; font-size: 0.9rem; background: var(--glass); }
  .seg button.on { background: #fff; color: var(--ink); }
  .toggles { display: flex; gap: 6px; flex-wrap: wrap; }
  .toggle { display: inline-flex; align-items: center; gap: 8px; background: var(--glass); font-size: 0.95rem; }
  .toggle i { width: 30px; height: 18px; border-radius: 999px; background: rgba(255, 255, 255, 0.25); position: relative; transition: background 0.2s; }
  .toggle i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left 0.2s; }
  .toggle.on i { background: #22c55e; }
  .toggle.on i::after { left: 14px; }
  .note { margin: 0; font-size: 0.85rem; opacity: 0.7; }
  .start { margin-top: 8px; padding: 16px; font-size: 1.25rem; font-weight: 800; }

  .toast {
    position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 30px); opacity: 0; pointer-events: none; z-index: 20;
    background: rgba(10, 10, 30, 0.92); padding: 12px 18px; border-radius: 10px; transition: opacity 0.25s, transform 0.25s; max-width: 90vw;
  }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }

  @media (max-width: 600px) {
    .actions button { padding: 12px 14px; font-size: 1rem; }
    .fact { display: none; }
  }
`;

customElements.define("autodarts-classic-card", AutodartsClassicCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "autodarts-classic-card",
  name: "Autodarts classic game screen",
  description: "A full-screen, play.autodarts.io-style game screen for the Autodarts integration",
});
