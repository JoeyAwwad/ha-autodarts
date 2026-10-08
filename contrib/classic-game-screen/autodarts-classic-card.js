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

// A fair shuffle; rand gives numbers in [0, 1).
function shuffle(list, rand = Math.random) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
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
// Between games the screen shows the attract screen after this many quiet seconds (idle: 0 off).
const IDLE_S = 180;
// A session (tonight's Top List) ends after this many hours without a finished game.
const SESSION_GAP_H = 6;
const SESSION_POINTS = [3, 2, 1];
const BEST_LABELS = [["highest_visit", "Highest visit"], ["highest_checkout", "Highest checkout"], ["best_session_average", "Best average"], ["best_cricket_mpr", "Best cricket MPR"], ["jdc_challenge", "JDC Challenge"], ["singles", "Singles"]];

const GROUPS = [
  { name: "X01", games: [
    ["301", "301", "Classic count-down"], ["501", "501", "The tournament standard"], ["701", "701", "Longer legs"],
    ["101", "101", "Quick finish"], ["901", "901", "Marathon"], ["1001", "1001", "Endurance"],
    ["x01_party", "Party X01", "X01 for 5 to 24 players"]] },
  { name: "Cricket", games: [
    ["cricket", "Cricket", "Close 15–20 and bull"], ["cut_throat", "Cut-Throat", "Points go to opponents"],
    ["tactics", "Tactics", "Cricket from 10 up"], ["wild_mouse", "Wild Mouse", "Cricket plus doubles & triples"],
    ["mickey_mouse", "Mickey Mouse", "20–12, doubles, trebles, beds"], ["cricket_light", "Quick Cricket", "Four random numbers"],
    ["cricket_party", "Party Cricket", "Cricket for 5 to 24"], ["cut_throat_party", "Party Cut-Throat", "Cut-Throat for 5 to 24"]] },
  { name: "Party", games: [
    ["killer", "Killer", "Become the killer, take lives"], ["shanghai", "Shanghai", "Single, double, triple"],
    ["shanghai_party", "Party Shanghai", "Up to 24, with a Lite option"],
    ["halve_it", "Halve-It", "Miss and lose half"], ["golf", "Golf", "Fewest strokes wins"],
    ["baseball", "Baseball", "Nine innings of runs"], ["count_up", "Count-Up", "Highest total wins"],
    ["gotcha", "Gotcha", "Exactly 301, knock them back"], ["scram", "Scram", "Stop them, then score"], ["lives", "Lives", "Beat the last visit"],
    ["hi_lo", "Hi-Lo", "Higher or lower?"], ["chase_dragon", "Chase the Dragon", "Trebles 10–20, then the bulls"],
    ["football", "Bull & Goal", "Bull for the ball, doubles score"], ["snooker", "Snooker", "Reds, colours, big breaks"]] },
  { name: "Training", games: [
    ["around_the_clock", "Around the Clock", "1 to 20, then bull"], ["doubles", "Doubles", "Every double in turn"],
    ["checkout", "Checkout", "Random finishes"], ["bobs_27", "Bob's 27", "The doubles classic"],
    ["checkout_121", "121", "Check out 121 and up"], ["catch_40", "Catch 40", "Finishes from 61 to 100"],
    ["jdc_challenge", "JDC Challenge", "The junior challenge"], ["singles", "Singles", "Hit every single"],
    ["random_checkout", "Random Checkout", "2 to 170, keep the streak"], ["atc_doubles", "Clock Doubles", "D1 to D20, then bull"],
    ["atc_trebles", "Clock Trebles", "T1 to T20"], ["atc_lite", "Clock Lite", "Neighbours count"],
    ["hare_hounds", "Hare & Hounds", "Catch the hare"], ["doubles_ladder", "Doubles Ladder", "Up on a hit, down on a miss"]] },
  { name: "Arcade games", games: [
    ["snakes", "Ladder Rush", "The ring is the dice"], ["derby", "Derby Dash", "Race your number home"],
    ["tower", "Tower Takedown", "Knock 180 down to zero"], ["limbo", "Under the Bar", "How low can you go?"],
    ["bull_hunt", "Chasing Bullseye", "Everything for the middle"], ["killer_venue", "Killer Night", "Bar rules, 12 rounds"],
    ["fight", "Nine Lives", "9 lives, your number heals"], ["conqueror", "Board Grab", "Take the board"],
    ["targets", "Target Blast", "Blast the targets"], ["moon_landing", "Touchdown 200", "200 down to touchdown"],
    ["beer_tap", "Pour the Pint", "Pour the first pint"]] },
];
const GAME_NAME = Object.fromEntries(GROUPS.flatMap((g) => g.games.map(([id, name]) => [id, name])));
// Party games that can be played to a round limit (the leader wins when the rounds are up).
const ROUND_CAP = new Set(["x01_party", "gotcha", "lives", "hi_lo", "limbo", "chase_dragon", "hare_hounds", "football", "snooker", "snakes", "tower", "moon_landing", "beer_tap", "fight"]);
const X01 = new Set(["101", "301", "501", "701", "901", "1001"]);
GAME_NAME.bull_off = "Sudden death";
const CRICKET = new Set(["cricket", "cut_throat", "tactics"]);
const TRAINING = new Set(GROUPS[3].games.map(([id]) => id));
const LEGS = [1, 2, 3, 5, 7];
const BOT_LEVELS = [["Off", 0], ["Easy", 30], ["Club", 50], ["Pub pro", 70], ["Pro", 90], ["Legend", 110]];
// Every player keeps a colour for the whole game: card, chalkboard column, dart markers.
const PLAYER_COLORS = ["#3b82f6", "#f43f5e", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#f97316", "#ec4899",
  "#84cc16", "#eab308", "#6366f1", "#14b8a6"];
// Games the card scores itself take a whole party; the integration's games take up to four.
// Wild Mouse is also the integration's own after 1.9.2: where it has it, the card hands it
// a game of up to four and scores bigger parties, or every game on an older one, itself.
const LOCAL_GAMES = new Set(["wild_mouse"]);
const MAX_PLAYERS = 24, MAX_PLAYERS_INTEGRATION = 4;
// Head-to-head games need somebody to play against; Scram is one stopper against one scorer.
const GAME_PLAYERS = { scram: [2, 2], lives: [2], hi_lo: [2], limbo: [2], fight: [2], killer_venue: [2], conqueror: [2] };
const maxPlayers = (game) => GAME_PLAYERS[game]?.[1] ?? (LOCAL_GAMES.has(game) ? MAX_PLAYERS : MAX_PLAYERS_INTEGRATION);
const minPlayers = (game) => GAME_PLAYERS[game]?.[0] ?? 1;
// Player photos are square JPEGs of this size, small enough to keep many in the browser.
const PHOTO_PX = 320;
// Looks for the screen; "machine" is a dark dart-machine look, "classic" the original blue.
const THEMES = [["Machine", "machine"], ["Red", "red"], ["Classic", "classic"], ["Pub", "pub"], ["Neon", "neon"], ["High contrast", "contrast"]];

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
// Button icons, drawn so they look the same on every screen (a kiosk font may lack ⛶ or emoji).
const UI_ICON = {
  full: '<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
  sound: '<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  next: '<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l8 7-8 7M13 5l8 7-8 7"/></svg>',
};
const COLORS = {
  101: "#60a5fa", 301: "#3b82f6", 501: "#6366f1", 701: "#8b5cf6", 901: "#a855f7", 1001: "#d946ef",
  cricket: "#22c55e", cut_throat: "#ef4444", tactics: "#14b8a6", wild_mouse: "#f472b6",
  killer: "#dc2626", shanghai: "#f59e0b", halve_it: "#fb923c", golf: "#84cc16", baseball: "#f87171", count_up: "#38bdf8",
  around_the_clock: "#2dd4bf", doubles: "#e11d48", checkout: "#10b981", bobs_27: "#eab308",
  checkout_121: "#06b6d4", catch_40: "#a3e635", jdc_challenge: "#fbbf24", singles: "#c084fc",
};

ICONS.shanghai_party = ICONS.shanghai;
COLORS.shanghai_party = COLORS.shanghai;
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

// The games the card scores itself: icons, colours and rules.
Object.assign(ICONS, {
  mickey_mouse: ICONS.wild_mouse, cricket_light: ICONS.cricket, cricket_party: ICONS.cricket, cut_throat_party: ICONS.cut_throat,
  atc_doubles: ICONS.around_the_clock, atc_trebles: ICONS.around_the_clock, atc_lite: ICONS.around_the_clock, killer_venue: ICONS.killer,
  snakes: '<path d="M12 42c0-7 11-8 11-15s-11-7-11-14 5-7 8-7"/><circle cx="21" cy="6" r="2" class="fill"/><path d="M30 6v36M40 6v36M30 14h10M30 22h10M30 30h10M30 38h10"/>',
  derby: '<path d="M10 42V6"/><path d="M10 7h26l-5 7 5 7H10" class="fill"/><path d="M18 7v14M26 7v14"/>',
  tower: '<path d="M10 42h28M13 42V33h22v9M16 33V24h16v9M19 24V15h10v9M22 15V7h4v8"/>',
  limbo: '<path d="M6 16h36"/><path d="M24 22v18M17 33l7 7 7-7"/>',
  bull_hunt: '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="4" class="fill"/><path d="M24 3v10M24 35v10M3 24h10M35 24h10"/>',
  fight: '<path d="M27 4L12 27h12l-4 17 16-26H24z"/>',
  conqueror: '<path d="M8 42h32M12 42V26h24v16M12 26l3-6h18l3 6M24 20V6l9 3-9 3"/>',
  targets: '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="10"/><path d="M24 24L37 11"/><circle cx="31" cy="30" r="2" class="fill"/>',
  moon_landing: '<path d="M24 4c8 6 10 16 6 26H18C14 20 16 10 24 4z"/><path d="M18 30l-6 8h8M30 30l6 8h-8"/><circle cx="24" cy="17" r="3"/>',
  beer_tap: '<path d="M13 10h19l-2 32H15z"/><path d="M32 16h4a4 4 0 010 10h-4"/><path d="M14 20h17"/>',
  scram: '<path d="M10 10l28 28M38 10L10 38"/><circle cx="24" cy="24" r="17"/>',
  lives: '<path d="M24 40S8 30 8 18a8 8 0 0116-3 8 8 0 0116 3c0 12-16 22-16 22z"/>',
  hi_lo: '<path d="M14 20l10-11 10 11M14 28l10 11 10-11"/>',
  chase_dragon: '<path d="M24 43c-8 0-12-6-12-12 0-8 8-10 8-20 6 4 8 10 8 14 2-2 3-4 3-6 4 4 5 8 5 12 0 6-4 12-12 12z"/>',
  football: '<circle cx="24" cy="24" r="17"/><path d="M24 15l7 5-3 8h-8l-3-8z" class="fill"/><path d="M24 15V7M31 20l7-3M28 28l5 7M20 28l-5 7M17 20l-7-3"/>',
  snooker: '<circle cx="17" cy="31" r="8"/><path d="M26 22L43 5"/><circle cx="34" cy="36" r="4" class="fill"/>',
  random_checkout: '<rect x="9" y="9" width="30" height="30" rx="6"/><circle cx="17" cy="17" r="2.5" class="fill"/><circle cx="24" cy="24" r="2.5" class="fill"/><circle cx="31" cy="31" r="2.5" class="fill"/>',
  hare_hounds: '<path d="M18 40c-6 0-9-5-7-10 2-4 7-5 11-3l9-3 5 3-4 3 2 6c-2 3-6 4-9 4z"/><path d="M28 24l-2-14 4 1 1 12M33 24l1-13 3 2-1 12"/>',
  doubles_ladder: '<path d="M16 5v38M32 5v38M16 13h16M16 21h16M16 29h16M16 37h16"/>',
});
Object.assign(ICON_TEXT, { x01_party: "X01", gotcha: "301" });
Object.assign(COLORS, {
  x01_party: "#818cf8", mickey_mouse: "#fb7185", cricket_light: "#4ade80", cricket_party: "#16a34a", cut_throat_party: "#b91c1c",
  gotcha: "#e879f9", scram: "#f472b6", lives: "#f43f5e", hi_lo: "#38bdf8", chase_dragon: "#f97316", football: "#22c55e", snooker: "#15803d",
  random_checkout: "#34d399", atc_doubles: "#fb7185", atc_trebles: "#f87171", atc_lite: "#5eead4", hare_hounds: "#d6d3d1", doubles_ladder: "#fda4af",
  snakes: "#a3e635", derby: "#f59e0b", tower: "#94a3b8", limbo: "#c084fc", bull_hunt: "#ef4444", killer_venue: "#991b1b",
  fight: "#facc15", conqueror: "#60a5fa", targets: "#2dd4bf", moon_landing: "#a5b4fc", beer_tap: "#fbbf24",
});
const R2 = (players, goal, steps, win) => ({ players, goal, steps, win });
Object.assign(RULES, {
  x01_party: R2("5 to 24 players (also fewer)", "X01 for a whole party: count down to exactly zero.", ["Pick the start score, double out and double in like 501.", "A bust voids the visit.", "The screen shows the checkout route."], "The first to zero wins the leg."),
  mickey_mouse: R2("1–24 players", "Close 20 down to 12, Doubles, Trebles, Beds and the bull.", ["A double or treble on an open number marks the number first, otherwise Doubles or Trebles.", "Beds: three darts in the same bed in one visit is a mark.", "Closed targets score while somebody is still open."], "Close everything and not be behind on points."),
  cricket_light: R2("1–24 players", "Cricket on four random numbers: quick and friendly.", ["Single 1 mark, double 2, treble 3; three marks close a number.", "Closed numbers score while somebody is still open."], "Close all four with at least as many points as everybody else."),
  cricket_party: R2("5 to 24 players (also fewer)", "Cricket on 20–15 and the bull for a whole party.", ["Marks and scoring as in Cricket."], "Close everything with at least as many points as everybody else."),
  cut_throat_party: R2("5 to 24 players (also fewer)", "Cut-Throat for a whole party: fewest points wins.", ["Scoring on a closed number gives the points to everybody still open."], "Close everything with no more points than anybody else."),
  gotcha: R2("2–24 players", "Race up to exactly 301.", ["Every dart adds its score.", "Going over 301 voids the visit.", "Land exactly on another player's score and they go back to zero: Gotcha!"], "The first to exactly 301."),
  scram: R2("2 players", "One player stops numbers, the other scores on them; then swap.", ["The stopper closes a number by hitting it (any bed; the bull too).", "The scorer scores every dart on a number that is still open.", "When all 20 numbers and the bull are closed, the players swap."], "The higher score after both halves."),
  lives: R2("2–24 players, 3 lives", "Beat the visit before yours.", ["The first visit sets the score.", "Every visit must score more than the one before it, or you lose a life."], "The last player with a life left."),
  hi_lo: R2("2–24 players, 3 lives", "Call it before you throw: higher or lower than the last visit?", ["Tap Higher or Lower before your first dart (higher if you don't).", "Wrong, or the same score: a life gone."], "The last player with a life left."),
  chase_dragon: R2("1–24 players", "Trebles 10 to 20, then the outer bull and the bullseye, in order.", ["Only the next target counts.", "Every hit moves you on to the next one."], "The first to slay the dragon (the bullseye)."),
  football: R2("2–24 players", "Get the ball, then score.", ["Hit the bull (25 or 50) to get the ball.", "With the ball, every double (or bullseye) is a goal."], "The first to five goals."),
  snooker: R2("2–24 players", "Clear the table.", ["Reds are the numbers 1–15, each potted once: 1 point.", "After every red a colour: 16 yellow 2, 17 green 3, 18 brown 4, 19 blue 5, 20 pink 6, bull black 7.", "When the reds are gone, the colours in order.", "Hitting the wrong thing ends your break."], "The most points when the black goes down."),
  random_checkout: R2("1–24 players", "Finish random scores from 2 to 170.", ["Three visits to finish each one on a double; a bust voids the visit.", "Ten finishes each; keep the streak going."], "The most checkouts."),
  atc_doubles: R2("1–24 players", "Around the Clock on the doubles: D1 to D20, then the bullseye.", ["Only the next double counts."], "The first round the clock."),
  atc_trebles: R2("1–24 players", "Around the Clock on the trebles: T1 to T20.", ["Only the next treble counts."], "The first round the clock."),
  atc_lite: R2("1–24 players", "Around the Clock for beginners: 1 to 20 and the bull, the neighbouring numbers count too.", ["Any bed of the number, or of the numbers either side of it."], "The first round the clock."),
  hare_hounds: R2("2–24 players", "The hare starts a quarter of the way round the board; the hounds chase it.", ["Everybody goes round the board clockwise from 20, one number at a time.", "A hound that reaches the hare catches it."], "The hare gets home first, or a hound catches it."),
  doubles_ladder: R2("1–24 players", "Climb the doubles.", ["Hit your double to go up to the next one.", "A visit without a hit takes you one down."], "The highest double reached in ten rounds."),
  shanghai_party: R2("1–24 players", "Score the most on the round's number; a Shanghai wins at once.", ["Round 1 is the 1s, round 2 the 2s and so on, 7 or 20 rounds.", "Only the round's number scores: a single its value, a double twice, a treble three times.", "Lite: the numbers either side count as a single of the round's number.", "A Shanghai (single, double and treble of the number in one visit) wins the game at once."], "The most points after the last round, or the first Shanghai."),
  bull_off: R2("The players who finished level", "Settle a dead heat: nearest to the bullseye wins.", ["Everybody throws one dart at the bullseye.", "The nearest dart wins: measured by the board when it knows where the dart sits, else by the bed (bullseye, outer bull, inner single, treble, outer single, double).", "Level again? Those players throw again."], "The dart nearest the middle."),
  snakes: R2("2–24 players", "Snakes and ladders with darts: first to square 50.", ["The ring you hit is your dice: bullseye 6, outer bull 5, inner single 4, treble 3, outer single 2, double 1, miss 0.", "Land on a ladder and climb it; land on a snake and slide down.", "You need the exact roll to land on 50 (you bounce back otherwise)."], "The first on 50."),
  derby: R2("2–20 players", "A horse race: every player's racer runs on their own number.", ["Your number moves you on: single 1, double 2, treble 3.", "Another player's number pushes their racer back.", "Nine steps to the finish, at most eight rounds; the round is finished when somebody gets home."], "First home (a dead heat is shared), or furthest after eight rounds."),
  tower: R2("1–24 players", "Knock your tower of 180 down to exactly zero.", ["Every dart anywhere knocks off its score; no double needed.", "Going below zero is a bust.", "When somebody hits zero the round is finished, so everybody gets the same darts; a tie plays off from 60."], "The only one to reach zero in the round, or the play-off winner."),
  limbo: R2("2–24 players, 3 lives", "How low can you go?", ["The first player sets the bar: three darts under 60, every dart must score.", "Every next player must score lower than the bar.", "Matching or going over, or a dart that scores nothing, loses a life and resets the bar."], "The last player with a life left."),
  bull_hunt: R2("1–24 players", "Everything for the middle.", ["Bullseye +3, outer bull +2, inner single +1.", "Treble −2, outer single, double or a miss −1.", "Six rounds; the last one counts double."], "Three bullseyes win at once; otherwise the most points."),
  killer_venue: R2("2–20 players, 3 lives", "Killer as the darts bars play it.", ["Everybody gets a random number.", "Hit your own number three times (a double counts 2, a treble 3) to become a killer.", "Killers take lives on the others' numbers; you can't kill yourself.", "Twelve rounds; hits count double in rounds 7–9 and treble in 10–12."], "The last one standing, or the most lives after twelve rounds."),
  fight: R2("2–20 players, 9 lives", "A brawl: everybody is a killer from the start.", ["Hit another player's number to hurt them: single 1, double 2, treble 3.", "Hit your own number to heal."], "The last one standing."),
  conqueror: R2("2–20 players", "Take over the board.", ["Everybody starts with a home sector.", "Hit a sector next to yours to claim it; hit your own to make it stronger (up to 3).", "Hit an opponent's sector next to yours to weaken and take it; take their home and you take all they have.", "A bull makes you king of the hill for the visit: attack anywhere."], "The last one with land, or the most sectors after 15 rounds."),
  targets: R2("1–24 players", "Circles appear on the board: blast them.", ["A dart close to a target damages it (closer hurts more).", "A destroyed target scores 10 and a new one appears."], "The most points after eight rounds."),
  moon_landing: R2("1–24 players", "Bring the lander down from 200.", ["Every dart takes its score off the altitude.", "Beginner: any landing counts. Pro: exactly zero, going under bounces you back."], "The first to touch down."),
  beer_tap: R2("1–24 players", "Pour the first full pint.", ["Every dart pours its score in millilitres.", "The round is finished when a glass is full."], "The fullest glass over 400 ml at the end of the round."),
});

// Banter after a visit, by what it scored. banter_lines in the card options replaces them.
// Moments of the card's games: the caller's line (a recording <voice_path><key>.mp3, else the
// words) and a moment picture of the same key, if the moments option has one.
const EVENT_CALL = { ladder: "Up the ladder!", snake: "Snake!", goal: "Goal!", killer: "Killer!", shanghai: "Shanghai!", black: "The black!", tower_down: "Tower down!", bullseye: "Bullseye!" };

const BANTER = {
  miss: ["Did the board move?", "The wall is safe… just", "Warm-up visit, surely", "Somebody check the flights"],
  low: ["Keep them coming", "Plenty of board left", "Settling in", "The treble is the red one"],
  mid: ["Tidy", "That'll do nicely", "Solid visit", "Building nicely"],
  ton: ["The ton!", "Now we're throwing", "Big numbers", "Somebody's warmed up"],
  ton40: ["Oh, that's heavy scoring", "Treble twenty knows your name", "Ton forty plus!", "Pub legend stuff"],
  max: ["ONE HUNDRED AND EIGHTY!", "Maximum!", "Frame that one", "Drinks are on you"],
  bust: ["Bust! Back you go", "Too greedy", "Maths is hard", "So close, so bust"],
};
function banterBand(total, bust) {
  if (bust) return "bust";
  return total >= 180 ? "max" : total >= 140 ? "ton40" : total >= 100 ? "ton" : total >= 41 ? "mid" : total > 0 ? "low" : "miss";
}

// What to go for when the first dart of a checkout misses: T20 missed is S20, D16 missed is S16.
function coachLine(rem, route) {
  const first = route?.[0];
  if (!first || route.length < 2) return "";
  const p = parseSegment(first);
  if (p.ring !== "T" && p.ring !== "D") return "";
  const left = rem - p.number;
  const alt = left > 1 ? checkoutRoute(left, route.length - 1) : null;
  return alt ? `if S${p.number}: ${alt.join(" ")}` : "";
}

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
function boardSvg(visit, throws = [], overlay = "") {
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
      ${overlay}
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

// Smart-home buttons (buttons: [light.board, {entity: scene.darts, name: Party}]): what a tap
// does for each kind of entity.
const BUTTON_CALL = { scene: ["scene", "turn_on"], script: ["script", "turn_on"], button: ["button", "press"], input_button: ["input_button", "press"] };
function homeButtons(config) {
  return (Array.isArray(config.buttons) ? config.buttons : [])
    .map((b) => (typeof b === "string" ? { entity: b } : b || {}))
    .filter((b) => /^[a-z_]+\.[a-z0-9_]+$/.test(String(b.entity || "")))
    .slice(0, 8);
}
// The time in a highlight photo's name (2026-09-26_21-05-33_Alex_180.jpg), or 0.
function photoTime(id) {
  const m = /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(String(id || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0;
}

// Grouping in millimetres: how far the darts of a visit sit from their middle, averaged over
// the visits with two or more darts (spots: [x, y, visit], 1 = the edge of the doubles, 170 mm).
function groupingMm(spots = []) {
  const byVisit = {};
  for (const [x, y, v] of spots) (byVisit[v] ??= []).push([x, y]);
  const spreads = Object.values(byVisit).filter((d) => d.length > 1).map((d) => {
    const cx = d.reduce((t, [x]) => t + x, 0) / d.length, cy = d.reduce((t, [, y]) => t + y, 0) / d.length;
    return d.reduce((t, [x, y]) => t + Math.hypot(x - cx, y - cy), 0) / d.length;
  });
  return spreads.length ? Math.round((spreads.reduce((t, v) => t + v, 0) / spreads.length) * 170) : null;
}

// A small board with a player's darts: the rings and a dot per dart.
function miniBoard(spots = [], color = "#fcd34d") {
  const rings = [1, R.doubleIn, R.tripleOut, R.tripleIn, R.outer, R.bull].map((r) => `<circle r="${r}"/>`).join("");
  const dots = spots.slice(-120).map(([x, y]) => `<circle class="dot" cx="${x}" cy="${-y}" r="0.045"/>`).join("");
  return `<svg viewBox="-1.08 -1.08 2.16 2.16" class="mini-board" style="--pc:${color}" aria-hidden="true"><g class="rings">${rings}</g>${dots}</svg>`;
}

// The X01 score chart: every player's remaining after each visit, from the start down to zero.
function scoreChart(series, start, colors) {
  const n = Math.max(2, ...series.map((s) => s.values.length));
  const lines = series.map((s, k) => {
    const pts = s.values.map((v, i) => `${((i / (n - 1)) * 100).toFixed(1)},${(40 - (Math.max(0, v) / start) * 38).toFixed(1)}`).join(" ");
    return `<polyline points="${pts}" style="--pc:${colors[k % colors.length]}"/>`;
  }).join("");
  return `<svg viewBox="-2 -2 104 46" class="score-chart" preserveAspectRatio="none" aria-label="Score chart">${lines}</svg>`;
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
// The integration's names of the extra Wild Mouse targets, as the card names them.
const WM_TARGET = { doubles: "D", triples: "T", bed: "B" };

// The same engine plays the cricket family the card scores itself: Mickey Mouse (20–12,
// doubles, trebles, beds, bull), Cricket and Cut-Throat for any number of players, and
// Quick Cricket (four random numbers).
const CRICKET_KINDS = {
  wild_mouse: { numbers: WM_NUMBERS, extras: true },
  mickey_mouse: { numbers: [20, 19, 18, 17, 16, 15, 14, 13, 12, 25], extras: true, bed: true },
  cricket_party: { numbers: WM_NUMBERS, extras: false },
  cut_throat_party: { numbers: WM_NUMBERS, extras: false, cutThroat: true },
  cricket_light: { random: 4, extras: false },
};

// A player's line, shown on their card (the regular line is the default, not shown).
const LEVELS = [["Regular", "regular"], ["Rookie", "rookie"], ["Pro", "pro"]];
const LEVEL_CHIP = { rookie: '<span class="lvl-chip rookie">Rookie</span>', pro: '<span class="lvl-chip pro">Pro</span>' };

// Teams play as one player whose members take turns, visit by visit.
const thrower = (p) => (p?.members?.length ? p.members[(p.mi || 0) % p.members.length] : p?.name);
// Teams from the list: pairs in list order (an odd one out joins the last pair), or two
// teams, the first half against the second; auto makes pairs above six players.
function makeTeams(names, mode) {
  if (mode === "auto") mode = names.length > 6 ? "pairs" : "off";
  if (mode === "pairs" && names.length >= 4) {
    const t = [];
    for (let i = 0; i + 1 < names.length; i += 2) t.push(names.slice(i, i + 2));
    if (names.length % 2) t[t.length - 1].push(names.at(-1));
    return t;
  }
  if (mode === "two" && names.length >= 3) { const h = Math.ceil(names.length / 2); return [names.slice(0, h), names.slice(h)]; }
  return null;
}

// Tonight's Top List: 3, 2 and 1 points for the first three of every game played by two or
// more; players who share a win get 3 each and the next place is counted after them. Best
// first: points, then wins, then the fewest games.
function sessionTable(games) {
  const t = {};
  for (const g of games || []) {
    // A team's place counts for each of its members.
    const groups = g.members?.length === g.names.length ? g.members : g.names.map((n) => [n]);
    const win = new Set(g.winners?.length ? g.winners : g.names.slice(0, 1));
    let place = g.names.filter((n) => win.has(n)).length;
    g.names.forEach((name, k) => {
      const won = win.has(name), pts = won ? SESSION_POINTS[0] : SESSION_POINTS[place++] || 0;
      for (const n of groups[k]) {
        const row = (t[n] ??= { name: n, pts: 0, wins: 0, games: 0 });
        row.games += 1;
        row.pts += pts;
        if (won) row.wins += 1;
      }
    });
  }
  return Object.values(t).sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.games - b.games || a.name.localeCompare(b.name));
}

class WildMouse {
  constructor(state) {
    Object.assign(this, state);
  }

  static create(players, { legs = 1, bed = false, kind = "wild_mouse" } = {}) {
    const cfg = CRICKET_KINDS[kind] || CRICKET_KINDS.wild_mouse;
    const numbers = cfg.random
      ? shuffle(Array.from({ length: 20 }, (_, i) => i + 1)).slice(0, cfg.random).sort((a, b) => b - a)
      : cfg.numbers;
    bed = cfg.bed ?? bed;
    const targets = [...numbers, ...(cfg.extras ? ["D", "T"] : []), ...(bed ? ["B"] : [])];
    return new WildMouse({
      kind, numbers, extras: cfg.extras, cutThroat: !!cfg.cutThroat, targets, legsToWin: legs, bed, leg: 1, starter: 0, current: 0,
      players: players.map((name) => ({ name, marks: Object.fromEntries(targets.map((t) => [t, 0])), points: 0, legs: 0, darts: 0, markTotal: 0 })),
      visit: [], bedVisit: false, seen: 0, winner: null, legWinner: null, history: [],
    });
  }

  toJSON() {
    const { history, ...rest } = this;
    return { ...rest, history: history.slice(-20) };
  }

  setLevels(levels) {
    this.players.forEach((p, i) => { if (levels[i]) p.level = levels[i]; });
  }

  _open(player, t) {
    return player.marks[t] < 3;
  }

  _scorable(t) {
    return this.players.some((p, i) => i !== this.current && p.marks[t] < 3);
  }

  // The targets one dart could count for, best first.
  static candidates(seg, numbers = WM_NUMBERS, extras = true) {
    const p = parseSegment(seg);
    const c = [];
    if (p.number != null && (numbers.includes(p.number))) {
      const marks = { S: 1, OUTER: 1, D: 2, BULL: 2, T: 3 }[p.ring] || 0;
      if (marks) c.push({ t: p.number, marks });
    }
    if (!extras) return c;
    if (p.ring === "D" || p.ring === "BULL") c.push({ t: "D", marks: 1 });
    if (p.ring === "T") c.push({ t: "T", marks: 1 });
    return c;
  }

  _cands(seg) {
    return WildMouse.candidates(seg, this.numbers || WM_NUMBERS, this.extras !== false);
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
    const cands = this._cands(seg);
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
      // Cut-Throat: the points go to every opponent who still has the target open.
      if (this.cutThroat && points) this.players.forEach((p, i) => { if (i !== this.current && p.marks[pick.t] < 3) p.points += points; });
      else me.points += points;
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
    // Cut-Throat: anybody who has closed everything with the fewest points wins, even when
    // somebody else's dart handed out the points.
    const order = this.cutThroat ? this.players.map((_, i) => (this.current + i) % this.players.length) : [this.current];
    const who = order.find((i) => {
      const me = this.players[i];
      const closed = this.targets.every((t) => me.marks[t] >= 3);
      const ahead = this.players.every((p) => p === me || (this.cutThroat ? me.points <= p.points : me.points >= p.points));
      return closed && ahead;
    });
    if (who == null) return;
    const me = this.players[who];
    me.legs += 1;
    this.legWinner = who;
    if (me.legs >= this.legsToWin) this.winner = who;
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
      const me = this.players[this.current];
      if (me?.members?.length) me.mi = ((me.mi || 0) + 1) % me.members.length;
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
  // Aim hints for the thrower: SCORE where they have closed and somebody is still open,
  // CLOSE where somebody else has closed and could score on them.
  const hint = (r) => {
    if (current < 0 || r.marks.every((m) => m >= 3)) return "";
    const me = r.marks[current] || 0, others = r.marks.filter((_, i) => i !== current);
    if (me >= 3 && others.some((m) => (m || 0) < 3)) return "score";
    if (me < 3 && others.some((m) => m >= 3)) return "close";
    return "";
  };
  const body = rows
    .map((r) => {
      const dead = r.marks.every((m) => m >= 3) ? "dead" : "";
      const h = hint(r);
      // The hint sits in the thrower's own cell, next to their marks.
      // ctag-score, not score: .score is the players' big score and would restyle the pill.
      const tag = h ? `<span class="ctag ctag-${h}">${h === "score" ? "Score" : "Close"}</span>` : "";
      const mcell = (m, i) => (i === current && tag ? cell(m, i).replace(/<\/div>$/, `${tag}</div>`) : cell(m, i));
      const label = `<div class="clab ${r.extra ? "extra" : ""}">${esc(r.label)}</div>`;
      const attrs = `class="crow ${dead} ${h ? `hint-${h}` : ""}" data-row="${esc(r.key ?? r.label)}"`;
      return two
        ? `<div ${attrs}>${mcell(r.marks[0], 0)}${label}${mcell(r.marks[1], 1)}</div>`
        : `<div ${attrs}>${label}${r.marks.map(mcell).join("")}</div>`;
    })
    .join("");
  // --rows lets numbers and marks shrink to fit any number of targets (Tactics has 12).
  return `<div class="chalk ${two ? "two" : "many"}" style="--cols:${players.length};--rows:${rows.length + (head ? 1 : 0)}">${head}${body}</div>`;
}

// Pictures from options and players: only data images, site paths and web addresses, so a
// picture can never run anything.
function safeImage(url) {
  const u = String(url || "");
  return /^(data:image\/(jpeg|png|webp);base64,|\/|https?:\/\/)/i.test(u) ? u : "";
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`autodarts-classic:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(`autodarts-classic:${key}`, JSON.stringify(value));
  } catch { /* private mode: the choice is just not remembered */ }
}

// -- Your own voice: recordings of the caller's lines and the sound effects -----------------------

// Every call besides the scores and names (CALLER-LINES.md has the same list, in this order).
const CALLS = ["game_on", "180", "no_score", "bust", "you_require", "checkout", "game_shot", "game_shot_leg", "game_shot_match",
  "up_next", "bounce_out", "three_in_a_bed", "doubles_closed", "triples_closed", "bullseye", "ladder", "snake", "goal", "killer", "shanghai", "black", "tower_down"];
const CALL_TEXT = {
  game_on: "Game on!", 180: "One hundred and eighty!", no_score: "No score", bust: "Bust!", you_require: "You require",
  checkout: "Checkout", game_shot: "Game shot!", game_shot_leg: "Game shot, and the leg!", game_shot_match: "Game shot, and the match!",
  up_next: "Up next", bounce_out: "Bounce out!", three_in_a_bed: "Three in a bed!", doubles_closed: "Doubles closed!", triples_closed: "Triples closed!",
  bullseye: "Bullseye!", ladder: "Up the ladder!", snake: "Snake!", goal: "Goal!", killer: "Killer!", shanghai: "Shanghai!", black: "The black!", tower_down: "Tower down!",
};
const EFFECTS = ["single", "double", "triple", "outer", "bull", "miss", "bust", "closed", "ton", "180", "win"];
const nameKey = (name) => `name_${String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

// The spoken part of a take: from the first to the last 10 ms that are louder than the
// threshold, with a little air on both sides. samples: Float32Array.
function trimSilence(samples, rate, threshold = 0.03, pad = 0.05) {
  const win = Math.max(1, Math.round(rate * 0.01)), loud = [];
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let k = i; k < end; k++) sum += samples[k] * samples[k];
    if (Math.sqrt(sum / (end - i)) > threshold) loud.push(i);
  }
  if (!loud.length) return samples.subarray(0, 0);
  const a = Math.max(0, loud[0] - Math.round(rate * pad)), b = Math.min(samples.length, loud.at(-1) + win + Math.round(rate * pad));
  return samples.subarray(a, b);
}

// A mono 16-bit WAV file of the samples.
function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Uint8Array(buf);
}

// A plain zip (stored, no compression) of [{name, data: Uint8Array}], and back.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipFiles(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true); local.setUint32(22, f.data.length, true); local.setUint16(26, name.length, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint32(16, crc, true);
    dir.setUint32(20, f.data.length, true); dir.setUint32(24, f.data.length, true); dir.setUint16(28, name.length, true); dir.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((t, x) => t + x.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((t, x) => t + x.length, 0));
  let at = 0;
  for (const x of all) { out.set(x, at); at += x.length; }
  return out;
}
function unzipFiles(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder(), out = [];
  let at = 0;
  while (at + 30 <= bytes.length && v.getUint32(at, true) === 0x04034b50) {
    const method = v.getUint16(at + 8, true), size = v.getUint32(at + 18, true), nlen = v.getUint16(at + 26, true), xlen = v.getUint16(at + 28, true);
    const name = dec.decode(bytes.subarray(at + 30, at + 30 + nlen)), start = at + 30 + nlen + xlen;
    if (method === 0) out.push({ name, data: bytes.slice(start, start + size) });
    at = start + size;
  }
  return out;
}

// The recordings of this screen, kept in the browser (IndexedDB; in memory where there is none).
class VoiceStore {
  constructor() {
    this.blobs = new Map();
    this.urls = new Map();
    this.db = null;
  }

  async load() {
    try {
      if (!globalThis.indexedDB) return this;
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("autodarts-classic-voice", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("clips");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = this.db.transaction("clips"), st = tx.objectStore("clips");
      const [keys, values] = await Promise.all([st.getAllKeys(), st.getAll()].map((r) => new Promise((res) => { r.onsuccess = () => res(r.result); r.onerror = () => res([]); })));
      keys.forEach((k, i) => this._set(k, values[i]));
    } catch { this.db = null; /* private mode: recordings last until the page closes */ }
    return this;
  }

  _set(name, blob) {
    if (this.urls.has(name)) try { URL.revokeObjectURL(this.urls.get(name)); } catch { /* already gone */ }
    if (!blob) { this.blobs.delete(name); this.urls.delete(name); return; }
    this.blobs.set(name, blob);
    try { this.urls.set(name, URL.createObjectURL(blob)); } catch { this.urls.set(name, `blob:${name}`); }
  }

  async _tx(fn) {
    if (!this.db) return;
    try { await new Promise((res) => { const tx = this.db.transaction("clips", "readwrite"); fn(tx.objectStore("clips")); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; }); } catch { /* kept in memory */ }
  }

  async put(name, blob) { this._set(name, blob); await this._tx((st) => st.put(blob, name)); }
  async del(name) { this._set(name, null); await this._tx((st) => st.delete(name)); }
  has(name) { return this.blobs.has(name); }
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
    } catch {
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
    const own = this.clips?.get(`sfx_${name}`);
    if (own) {
      try { new Audio(own).play()?.catch?.(() => {}); } catch { /* audio is a nicety */ }
      return;
    }
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
    } catch { /* audio is a nicety */ }
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
    try { window.speechSynthesis?.cancel(); } catch { /* nothing to stop */ }
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
    // A recording made on this screen, then voice_path as .mp3 and .wav, then the browser's voice.
    const urls = [file && this.clips?.get(file), ...(this.voicePath && file ? [`${this.voicePath}${file}.mp3`, `${this.voicePath}${file}.wav`] : [])].filter(Boolean);
    const tryUrl = (i) => {
      if (i >= urls.length) return speak();
      let failed = false;
      const fail = () => { if (failed || settled) return; failed = true; tryUrl(i + 1); };
      try {
        const audio = new Audio(urls[i]);
        audio.onended = once(() => this._next());
        audio.onerror = fail;
        const p = audio.play();
        if (p?.catch) p.catch(fail);
      } catch { fail(); }
    };
    tryUrl(0);
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

// -- Instant replay ------------------------------------------------------------------------------
// The thrower webcam is recorded by two MediaRecorders taking turns: each restarts every
// SEGMENT seconds, half a segment apart, so one of them always holds at least the last
// SEGMENT / 2 seconds. A replay stops that one and hands over its clip; recording goes on.
// The browser encodes the video (in hardware where it can), so this costs little.
const REPLAY_SEGMENT_S = 10;

class ReplayBuffer {
  constructor(Recorder = globalThis.MediaRecorder) {
    this.Recorder = Recorder;
    this.stream = null;
    this.slots = [];
    this.timers = [];
  }

  get running() {
    return !!this.stream;
  }

  start(stream) {
    this.stop();
    if (!this.Recorder || !stream) return false;
    this.stream = stream;
    this.slots = [0, 1].map(() => ({ rec: null, chunks: [], since: 0 }));
    this._begin(this.slots[0]);
    this.timers.push(setTimeout(() => this._begin(this.slots[1]), (REPLAY_SEGMENT_S / 2) * 1000));
    return true;
  }

  // (Re)starts one recorder; it restarts itself every segment.
  _begin(slot) {
    if (!this.stream) return;
    clearTimeout(slot.timer);
    try {
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
        .find((t) => !this.Recorder.isTypeSupported || this.Recorder.isTypeSupported(t));
      slot.rec = new this.Recorder(this.stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
      slot.chunks = [];
      slot.since = Date.now();
      slot.rec.ondataavailable = (ev) => { if (ev.data?.size) slot.chunks.push(ev.data); };
      slot.rec.start(1000);
      slot.timer = setTimeout(() => this._restart(slot), REPLAY_SEGMENT_S * 1000);
    } catch {
      slot.rec = null;
    }
  }

  _restart(slot) {
    const rec = slot.rec;
    slot.rec = null;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => this._begin(slot);
      rec.stop();
    } else {
      this._begin(slot);
    }
  }

  // The clip of the recorder that has run longest (the last few seconds), as a Blob.
  clip() {
    const slot = this.slots.filter((s) => s.rec && s.rec.state !== "inactive").sort((a, b) => a.since - b.since)[0];
    if (!slot) return Promise.resolve(null);
    const rec = slot.rec;
    slot.rec = null;
    clearTimeout(slot.timer);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = slot.chunks.length ? new Blob(slot.chunks, { type: rec.mimeType || "video/webm" }) : null;
        this._begin(slot);
        resolve(blob);
      };
      try { rec.stop(); } catch { resolve(null); }
    });
  }

  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    for (const slot of this.slots) {
      clearTimeout(slot.timer);
      if (slot.rec && slot.rec.state !== "inactive") {
        slot.rec.onstop = null;
        try { slot.rec.stop(); } catch { /* already stopped */ }
      }
    }
    this.slots = [];
    this.stream?.getTracks?.().forEach((t) => t.stop());
    this.stream = null;
  }
}

// What the board saw, as the caller and the effects name it.
function dartKind(seg) {
  const p = parseSegment(seg);
  return { BULL: "bull", OUTER: "outer", T: "triple", D: "double", S: "single", M: "miss" }[p.ring] || "miss";
}

// -- Games the card scores itself ---------------------------------------------------------------
// LocalGame keeps turns, legs, undo, corrections (the visit thrown again), rounds, knock-outs
// and saving; every game adds how a dart scores and how it is shown. The card plays them all
// like Wild Mouse: darts from the board's event socket, the pad, undo, next player.

// Inner or outer single: the board's bed, else its position, else outer.
function singleSide(seg, info = {}) {
  if (info.bed) return /inner/i.test(info.bed) ? "inner" : "outer";
  const c = info.coords;
  if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) return Math.hypot(c.x, c.y) < R.tripleIn ? "inner" : "outer";
  return "outer";
}

// The numbers next to n on the board, for beginner rules that widen a target.
function neighbours(n) {
  const i = ORDER.indexOf(n);
  return i < 0 ? [] : [ORDER[(i + 19) % 20], ORDER[(i + 1) % 20]];
}

// Checkout routes for a score up to 170 with a double out: the fewest darts, big trebles first.
const ROUTE_BEDS = [
  ...Array.from({ length: 20 }, (_, k) => [`T${20 - k}`, (20 - k) * 3]),
  ["BULL", 50], ["25", 25],
  ...Array.from({ length: 20 }, (_, k) => [`S${20 - k}`, 20 - k]),
  ...Array.from({ length: 20 }, (_, k) => [`D${20 - k}`, (20 - k) * 2]),
];
const ROUTE_OUTS = [["BULL", 50], ...Array.from({ length: 20 }, (_, k) => [`D${20 - k}`, (20 - k) * 2])];
const ROUTE_CACHE = {};
function checkoutRoute(n, darts = 3) {
  const key = `${n}:${darts}`;
  if (key in ROUTE_CACHE) return ROUTE_CACHE[key];
  let best = null;
  for (const [out, ov] of ROUTE_OUTS) if (ov === n) { best = [out]; break; }
  if (!best && darts >= 2) for (const [a, av] of ROUTE_BEDS) { for (const [out, ov] of ROUTE_OUTS) if (av + ov === n) { best = [a, out]; break; } if (best) break; }
  if (!best && darts >= 3) {
    outer: for (const [a, av] of ROUTE_BEDS) for (const [b, bv] of ROUTE_BEDS) for (const [out, ov] of ROUTE_OUTS) if (av + bv + ov === n) { best = [a, b, out]; break outer; }
  }
  ROUTE_CACHE[key] = best;
  return best;
}
const isDouble = (seg) => { const r = parseSegment(seg).ring; return r === "D" || r === "BULL"; };

class LocalGame {
  // Does a visit add up to a score worth showing next to the darts?
  static tally = true;

  constructor(state) {
    Object.assign(this, state);
  }

  // A new game of this class for these players.
  static create(kind, names, opts = {}) {
    const game = new this({
      kind, opts, current: 0, starter: 0, round: 1, leg: 1, visit: [], history: [], winner: null, winners: null,
      seed: Math.floor(Math.random() * 2 ** 32),
      legWinner: null, seen: 0, legsToWin: Math.max(1, Number(opts.legs) || 1), note: "",
      players: names.map((name) => ({ name, legs: 0, darts: 0, ...this.player(opts) })),
    });
    game.init?.();
    return game;
  }

  static player() {
    return {};
  }

  // The game's own dice (mulberry32): seeded and saved with the game, so a visit thrown again
  // for a correction, an undo or a saved game draw the same numbers as the first time.
  _rand() {
    let t = (this.seed = ((this.seed ?? Math.floor(Math.random() * 2 ** 32)) + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  toJSON() {
    const { history, _palette, ...rest } = this;
    return { ...rest, history: history.slice(-20) };
  }

  _snapshot() {
    const { history, _palette, ...rest } = this;
    return JSON.parse(JSON.stringify(rest));
  }

  // The card's player colours, for the game's own panels (never saved with the game).
  _pc(i) {
    const c = this._palette || PLAYER_COLORS;
    return c[Math.max(i, 0) % c.length];
  }

  get me() {
    return this.players[this.current];
  }

  isOut(p) {
    return !!p.out;
  }

  // Darts after the visit is over (a bust, a foul) count for nothing.
  blocked() {
    return !!this.stop;
  }

  // A dart the board saw (or the pad entered). info: {bed, coords} when known.
  dart(seg, info = {}) {
    if (this.winner != null || this.legWinner != null || this.visit.length >= 3 || this.blocked()) return null;
    if (!this.visit.length) {
      this.history.push(this._snapshot());
      this.startVisit?.(this.me);
    }
    const me = this.me;
    me.darts = (me.darts || 0) + 1;
    const r = this.score(seg, me, info) || {};
    const d = { seg, text: r.text ?? "", points: r.points || 0, good: !!r.good, info: { bed: info.bed, coords: info.coords } };
    // A moment of the game for the caller and the moment pictures: ladder, snake, goal, killer, ...
    const ev = r.event || (this.kind === "tower" && me.rem === 0 ? "tower_down" : null);
    if (ev) d.event = ev;
    this.visit.push(d);
    return d;
  }

  // The visit ends: darts pulled, or Next player.
  next() {
    if (this.winner != null) return;
    if (this.legWinner != null) return this.newLeg();
    if (!this.visit.length) this.history.push(this._snapshot());
    this.endVisit?.(this.me);
    const me = this.me;
    if (me?.members?.length) me.mi = ((me.mi || 0) + 1) % me.members.length;
    this.stop = false;
    this.visit = [];
    if (this.winner == null && this.legWinner == null) this._advance();
  }

  // The next player still in; a full round runs endRound.
  _advance() {
    const n = this.players.length;
    let i = this.current;
    for (let k = 0; k < n * 2; k++) {
      i = (i + 1) % n;
      if (i === this.starter) {
        this.round += 1;
        this.endRound?.();
        if (this.winner == null && this.legWinner == null && this.opts.maxRounds && this.round > this.opts.maxRounds) this.capRounds();
        if (this.winner != null || this.legWinner != null) return;
      }
      if (!this.isOut(this.players[i])) break;
    }
    this.current = i;
  }

  // One player wins the leg; enough legs win the game.
  winLeg(i) {
    const p = this.players[i];
    p.legs += 1;
    this.legWinner = i;
    if (p.legs >= this.legsToWin) this.winner = i;
  }

  // Several players share the win (a dead heat).
  winShared(list) {
    this.winners = list;
    this.winner = list[0];
  }

  newLeg() {
    const keep = this.players.map((p) => ({ name: p.name, legs: p.legs, darts: p.darts, members: p.members, mi: p.mi }));
    const fresh = this.constructor.create(this.kind, keep.map((p) => p.name), this.opts);
    fresh.players.forEach((p, i) => {
      Object.assign(p, { legs: keep[i].legs, darts: keep[i].darts });
      if (keep[i].members) Object.assign(p, { members: keep[i].members, mi: keep[i].mi });
    });
    Object.assign(this, {
      ...fresh, history: this.history, leg: this.leg + 1, legsToWin: this.legsToWin, seen: this.seen,
      starter: (this.starter + 1) % this.players.length,
    });
    this.current = this.starter;
    this.legWinner = null;
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return false;
    const history = this.history;
    Object.keys(this).forEach((k) => delete this[k]);
    Object.assign(this, prev, { history });
    return true;
  }

  // Dart i of the visit into another bed: the visit is thrown again from its start.
  correct(i, seg) {
    if (!(i >= 0 && i < this.visit.length) || !this.history.length) return null;
    const darts = this.visit.map((d) => ({ seg: d.seg, info: d.info || {} }));
    darts[i] = { seg, info: {} };
    const { seen } = this;
    const start = this.history.pop();
    const history = this.history;
    Object.keys(this).forEach((k) => delete this[k]);
    Object.assign(this, start, { history });
    darts.forEach((d) => this.dart(d.seg, d.info));
    this.seen = seen;
    return this.visit[i];
  }

  // A button of the game's own (Hi-Lo's call).
  action() {
    return false;
  }

  // The round limit is up: the leader wins (level leaders share it).
  capRounds() {
    const rows = this.results();
    if (!rows.length) return;
    const top = rows.filter((r) => String(r.main) === String(rows[0].main)).map((r) => r.i);
    this.note = `${this.opts.maxRounds} rounds are up`;
    if (top.length > 1) this.winShared(top); else this.winLeg(top[0]);
  }

  // Handicaps: each player's line (rookie, regular, pro) is shown on the screen; with a start
  // bonus, rookies and regulars start ahead where the game has a start to give.
  setLevels(levels, bonus) {
    this.players.forEach((p, i) => {
      const lvl = levels[i];
      if (!lvl) return;
      p.level = lvl;
      const lead = bonus ? { rookie: 2, regular: 1 }[lvl] || 0 : 0;
      if (lead) this.headStart?.(p, lead);
    });
  }

  // -- presentation --
  big(p) { return p.points ?? 0; }
  sub() { return ""; }
  facts() { return []; }
  banner() { return this.note || ""; }
  panel() { return ""; }
  overlay() { return ""; }
  // Result rows, best first: [{i, main, mainLabel, stats}]
  results() {
    return this.players.map((p, i) => ({ i, main: this.big(p), mainLabel: "points", stats: [["darts", p.darts || 0]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (Number(b.main) - Number(a.main)));
  }

  isWinner(i) {
    return this.winners ? this.winners.includes(i) : this.winner === i;
  }

  // The highest (or lowest) scorers, for games decided at the end.
  leaders(value, low = false) {
    const all = this.players.map((p, i) => ({ i, v: value(p) }));
    // When everyone is out (every attempt used), everyone is still ranked.
    const still = all.filter(({ i }) => !this.isOut(this.players[i]));
    const live = still.length ? still : all;
    const best = low ? Math.min(...live.map((x) => x.v)) : Math.max(...live.map((x) => x.v));
    return live.filter((x) => x.v === best).map((x) => x.i);
  }
}

// -- Countdowns and races --------------------------------------------------------------------------

// X01 for any number of players, and its relatives: Tower Takedown (180, no double, equal
// turns), Touchdown 200 (200, beginner may overshoot).
class CountdownGame extends LocalGame {
  static player(o) {
    return { rem: Number(o.start) || 501, in: !o.doubleIn, scored: 0 };
  }

  // A tenth of the start per step, in tens: 501 starts at 401 for a rookie, 451 for a regular.
  headStart(p, lead) { const start = Number(this.opts.start) || 501; p.rem = start - Math.round((start * lead) / 100) * 10; }

  startVisit(me) {
    me.visitStart = me.rem;
    this.note = "";
  }

  score(seg, me) {
    const o = this.opts, v = segmentScore(seg);
    if (!me.in) {
      if (!isDouble(seg)) return { text: "not in yet" };
      me.in = true;
    }
    const left = me.rem - v;
    const exact = !o.overshoot;
    const bust = exact && (left < 0 || (o.doubleOut && left === 1) || (o.doubleOut && left === 0 && !isDouble(seg)));
    if (bust) {
      me.scored -= me.visitStart - me.rem;
      me.rem = me.visitStart;
      this.stop = true;
      this.note = "Bust";
      return { text: "Bust" };
    }
    me.rem = Math.max(0, left);
    me.scored += v;
    if (me.rem === 0) this.finish(this.current);
    return { text: `${v}`, points: v, good: v >= 40 };
  }

  finish(i) {
    if (!this.opts.equalTurns || this.players.length === 1) return this.winLeg(i);
    this.players[i].done = true;
    this.stop = true;
  }

  // Equal turns: the round is completed, then whoever reached zero wins; a tie plays off.
  endRound() {
    if (!this.opts.equalTurns) return;
    const done = this.players.map((p, i) => (p.done ? i : -1)).filter((i) => i >= 0);
    if (done.length === 1) this.winLeg(done[0]);
    else if (done.length > 1) {
      this.players.forEach((p, i) => { if (!done.includes(i)) p.out = true; else { p.done = false; p.rem = Number(this.opts.playoff) || 60; } });
      this.note = "Play-off from " + (Number(this.opts.playoff) || 60);
    }
  }

  // The chart on the game shot screen: the remaining after every visit.
  endVisit(me) { (me.trail ??= [Number(this.opts.start) || 501]).push(me.rem); }
  big(p) { return p.rem; }
  sub(p) {
    if (!p.in) return "Needs a double to start";
    const route = this.opts.doubleOut && p.rem <= 170 ? checkoutRoute(p.rem) : null;
    const avg = p.darts ? `Avg ${((p.scored / p.darts) * 3).toFixed(1)}` : "";
    return route ? `${avg}${avg ? " · " : ""}${route.join(" ")}` : avg;
  }
  facts() {
    const o = this.opts, f = [];
    if (this.kind === "x01_party") f.push(`${o.start} · ${o.doubleIn ? "Double in · " : ""}${o.doubleOut ? "Double out" : "Single out"}`);
    if (this.legsToWin > 1) f.push(`First to ${this.legsToWin} legs · Leg ${this.leg}`);
    f.push(`Round ${this.round}`);
    return f;
  }
  banner() {
    const me = this.me;
    if (this.note) return this.note;
    const route = this.opts.doubleOut && me.rem <= 170 ? checkoutRoute(me.rem) : null;
    const coach = route ? coachLine(me.rem, route) : "";
    return route ? `Checkout <b>${esc(route.join(" "))}</b>${coach ? `<span class="coach">${esc(coach)}</span>` : ""}` : "";
  }
  results() {
    return this.players.map((p, i) => ({ i, main: p.rem, mainLabel: "left",
      stats: [...(this.legsToWin > 1 ? [["legs", p.legs]] : []), ["average", p.darts ? ((p.scored / p.darts) * 3).toFixed(1) : "–"], ["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (this.players[b.i].legs - this.players[a.i].legs) || (a.main - b.main));
  }

  // Tower Takedown: a tower of blocks per player; Touchdown 200: a lander coming down.
  panel() {
    const start = Number(this.opts.start) || 180;
    if (this.kind === "tower") {
      const cols = this.players.map((p, i) => {
        const blocks = Math.ceil(p.rem / 10), total = Math.ceil(start / 10);
        const cells = Array.from({ length: total }, (_, k) => `<i class="${k < blocks ? "on" : ""}"></i>`).reverse().join("");
        return `<div class="tower ${i === this.current ? "cur" : ""}" style="--pc:${this._pc(i)}"><div class="tower-stack">${cells}</div><b>${p.rem}</b><small>${esc(p.name)}</small></div>`;
      }).join("");
      return `<div class="gpanel towers">${cols}</div>`;
    }
    if (this.kind === "moon_landing") {
      const lanes = this.players.map((p, i) => {
        const h = Math.max(0, Math.min(1, p.rem / start));
        return `<div class="lane ${i === this.current ? "cur" : ""}" style="--pc:${this._pc(i)};--h:${h}"><div class="sky"><span class="lander">🚀</span></div><div class="moon"></div><b>${p.rem}</b><small>${esc(p.name)}</small></div>`;
      }).join("");
      return `<div class="gpanel lanes">${lanes}</div>`;
    }
    return "";
  }
}

// Gotcha: race to exactly 301; landing on another player's score sends them back to zero.
class GotchaGame extends LocalGame {
  static player() { return { total: 0 }; }
  startVisit(me) { me.visitStart = me.total; this.note = ""; }
  score(seg, me) {
    const target = Number(this.opts.target) || 301, v = segmentScore(seg);
    if (me.total + v > target) {
      me.total = me.visitStart;
      this.stop = true;
      this.note = "Bust: over " + target;
      return { text: "Bust" };
    }
    me.total += v;
    let text = `${v}`;
    this.players.forEach((p, i) => {
      if (i !== this.current && p.total === me.total && me.total > 0) { p.total = 0; text = `Gotcha ${p.name}!`; this.note = `Gotcha: ${p.name} back to 0`; }
    });
    if (me.total === target) this.winLeg(this.current);
    return { text, points: v, good: text.startsWith("Gotcha") };
  }
  big(p) { return p.total; }
  sub(p) { return `${(Number(this.opts.target) || 301) - p.total} to go`; }
  facts() { return [`Exactly ${Number(this.opts.target) || 301}`, `Round ${this.round}`]; }
  panel() { return racePanel(this, (p) => p.total / (Number(this.opts.target) || 301)); }
}

// Pour the Pint: every dart pours; the first full glass at the end of a round wins.
class BeerTapGame extends LocalGame {
  static player() { return { total: 0 }; }
  score(seg, me) {
    const v = segmentScore(seg);
    me.total += v;
    return { text: `${v} ml`.replace(/^0 ml$/, "spilled"), points: v, good: v >= 40 };
  }
  endRound() {
    const full = Number(this.opts.target) || 400;
    const done = this.players.map((p, i) => (p.total >= full ? i : -1)).filter((i) => i >= 0);
    if (done.length) {
      const best = Math.max(...done.map((i) => this.players[i].total));
      const top = done.filter((i) => this.players[i].total === best);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return p.total; }
  sub() { return `of ${Number(this.opts.target) || 400} ml`; }
  facts() { return [`Fill ${Number(this.opts.target) || 400} ml`, `Round ${this.round}`]; }
  panel() {
    const full = Number(this.opts.target) || 400;
    return `<div class="gpanel glasses">${this.players.map((p, i) => `<div class="glass ${i === this.current ? "cur" : ""}" style="--pc:${this._pc(i)};--f:${Math.min(1, p.total / full)}"><div class="beer"><i></i></div><small>${esc(p.name)}</small></div>`).join("")}</div>`;
  }
}

// A lane per player that fills from left to right, for races.
function racePanel(game, share) {
  return `<div class="gpanel race" style="--n:${game.players.length}">${game.players.map((p, i) => `
    <div class="race-lane ${i === game.current ? "cur" : ""} ${game.isOut(p) ? "out" : ""}" style="--pc:${game._pc(i)};--f:${Math.max(0, Math.min(1, share(p)))}">
      <span class="race-name">${esc(p.name)}</span><span class="race-track"><i></i></span></div>`).join("")}</div>`;
}

// -- Sequences -------------------------------------------------------------------------------------

// Hit the targets in order: Chase the Dragon, Around the Clock on doubles or trebles, the
// beginner Around the Clock where the neighbours count, Hare & Hounds.
class SequenceGame extends LocalGame {
  static tally = false;
  static player() { return { pos: 0, hits: 0 }; }
  headStart(p, lead) { p.pos = Math.min(this.targets.length - 1, p.pos + lead); }

  init() {
    const k = this.kind;
    this.targets = k === "chase_dragon" ? [...Array.from({ length: 11 }, (_, i) => `T${10 + i}`), "25", "BULL"]
      : k === "atc_doubles" ? [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), "BULL"]
      : k === "atc_trebles" ? Array.from({ length: 20 }, (_, i) => `T${i + 1}`)
      : k === "hare_hounds" ? [...ORDER, 20].map((n) => `N${n}`)
      : [...Array.from({ length: 20 }, (_, i) => `N${i + 1}`), "N25"];
    // Hare & Hounds: the hare (first player) starts a quarter of the way round.
    if (k === "hare_hounds") this.players.forEach((p, i) => { p.pos = i === 0 ? 5 : 0; });
  }

  // Does this dart hit target t? N = any bed of the number (and its neighbours in lite).
  hits(seg, t) {
    const p = parseSegment(seg);
    if (t.startsWith("N")) {
      const n = Number(t.slice(1));
      if (n === 25) return p.number === 25;
      return p.number === n || (this.kind === "atc_lite" && neighbours(n).includes(p.number));
    }
    if (t === "BULL") return p.ring === "BULL";
    if (t === "25") return p.ring === "OUTER" || p.ring === "BULL";
    return p.label === t;
  }

  score(seg, me) {
    const t = this.targets[me.pos];
    if (t == null || !this.hits(seg, t)) return { text: "miss" };
    me.pos += 1;
    me.hits += 1;
    if (this.kind === "hare_hounds") {
      const hare = this.players[0];
      if (this.current !== 0 && me.pos >= hare.pos && hare.pos < this.targets.length) { this.winLeg(this.current); return { text: "Caught the hare!", good: true }; }
    }
    if (me.pos >= this.targets.length) this.winLeg(this.current);
    return { text: "hit", good: true };
  }

  label(t) {
    return t == null ? "✓" : t.startsWith("N") ? (t === "N25" ? "Bull" : t.slice(1)) : t === "BULL" ? "Bull" : t;
  }

  big(p) { return this.label(this.targets[p.pos]); }
  sub(p) { return `${p.pos} of ${this.targets.length}${p.darts ? ` · ${Math.round((p.hits / p.darts) * 100)}%` : ""}`; }
  facts() { return [this.kind === "atc_lite" ? "Neighbours count" : this.kind === "hare_hounds" ? "Round the board from 20" : "In order", `Round ${this.round}`]; }
  banner() { return `Aim for <b>${esc(this.label(this.targets[this.me.pos]))}</b>`; }
  // Rows per strip: few players get their targets over several rows, so every cell (and its
  // text) is as big as the panel allows; many players get one row each.
  // The text size a strip allows with r rows (in panel heights; the panel is about as wide as
  // it is high): the longest label ("Bull", "D10") must fit a cell, the rows the height.
  stripChars() { return Math.max(...this.targets.map((t) => this.label(t).length)); }
  stripRows() {
    const n = this.players.length, k = this.targets.length, ch = this.stripChars();
    let best = 1, size = 0;
    for (let r = 1; r <= 5; r++) {
      const s = Math.min(0.95 / (Math.ceil(k / r) * (ch * 0.62 + 0.7)), 0.46 / (n * (r * 1.55 + 0.9)));
      if (s > size * 1.05) { best = r; size = s; }
    }
    return best;
  }

  panel() {
    const rows = this.stripRows(), cols = Math.ceil(this.targets.length / rows);
    const strip = (p, i) => `<div class="seq ${i === this.current ? "cur" : ""} ${this.isOut(p) ? "out" : ""}" style="--pc:${this._pc(i)}"><span class="seq-name">${esc(p.name)}</span><div class="seq-cells">${this.targets
      .map((t, k) => `<i class="${k < p.pos ? "done" : k === p.pos ? "next" : ""}">${esc(this.label(t))}</i>`).join("")}</div></div>`;
    return `<div class="gpanel seqs" style="--n:${this.players.length};--rows:${rows};--cols:${cols};--ch:${this.stripChars()}">${this.players.map(strip).join("")}</div>`;
  }
  results() {
    return this.players.map((p, i) => ({ i, main: p.pos, mainLabel: "targets", stats: [["darts", p.darts], ["hit rate", p.darts ? `${Math.round((p.hits / p.darts) * 100)}%` : "–"]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// Doubles Ladder: up a double for every hit, down one for a visit without a hit.
class LadderGame extends LocalGame {
  static tally = false;
  static player() { return { pos: 0, best: 0, hits: 0 }; }
  init() { this.targets = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), "BULL"]; }
  startVisit(me) { me.visitHits = 0; }
  score(seg, me) {
    const t = this.targets[me.pos];
    if (parseSegment(seg).label !== t && !(t === "BULL" && parseSegment(seg).ring === "BULL")) return { text: "miss" };
    me.hits += 1;
    me.visitHits += 1;
    me.pos = Math.min(this.targets.length - 1, me.pos + 1);
    me.best = Math.max(me.best, me.pos);
    if (me.hits && me.pos === this.targets.length - 1 && t === "BULL") this.winLeg(this.current);
    return { text: "up", good: true };
  }
  endVisit(me) {
    if (!me.visitHits && this.visit.length) { me.pos = Math.max(0, me.pos - 1); this.note = `${me.name} steps down to ${this.targets[me.pos]}`; } else this.note = "";
  }
  endRound() {
    if (this.round > (Number(this.opts.rounds) || 10)) {
      const top = this.leaders((p) => p.best);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return this.targets[p.pos] === "BULL" ? "Bull" : this.targets[p.pos]; }
  sub(p) { return `Best ${this.targets[p.best]} · ${p.hits} hits`; }
  facts() { return [`${Number(this.opts.rounds) || 10} rounds`, `Round ${Math.min(this.round, Number(this.opts.rounds) || 10)}`]; }
  banner() { return this.note || `Aim for <b>${esc(this.big(this.me))}</b>`; }
  results() {
    return this.players.map((p, i) => ({ i, main: this.targets[p.best], mainLabel: "best", stats: [["hits", p.hits], ["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (this.players[b.i].best - this.players[a.i].best));
  }
}

// Random Checkout: a random finish from 2 to 170, three visits to take it out on a double.
const BOGEY = new Set([169, 168, 166, 165, 163, 162, 159]);
class RandomCheckoutGame extends LocalGame {
  static player() { return { target: 0, left: 0, tries: 0, done: 0, streak: 0, best: 0, visits: 0 }; }
  init() { this.players.forEach((p) => this.deal(p)); }
  deal(p) {
    let n;
    do n = 2 + Math.floor(this._rand() * 169); while (BOGEY.has(n));
    Object.assign(p, { target: n, left: n, visits: 0 });
  }
  startVisit(me) { me.visitStart = me.left; this.note = ""; }
  score(seg, me) {
    const v = segmentScore(seg), left = me.left - v;
    if (left < 0 || left === 1 || (left === 0 && !isDouble(seg))) { me.left = me.visitStart; this.stop = true; this.note = "Bust"; return { text: "Bust" }; }
    me.left = left;
    if (left === 0) {
      me.done += 1; me.tries += 1; me.streak += 1; me.best = Math.max(me.best, me.target);
      this.note = `Checked out ${me.target}!`;
      this.stop = true;
      this.pendingDeal = true;
      return { text: "Checkout!", good: true, points: me.target };
    }
    return { text: `${left} left` };
  }
  endVisit(me) {
    if (this.pendingDeal) { this.pendingDeal = false; this.deal(me); }
    else if (++me.visits >= 3) { me.tries += 1; me.streak = 0; this.note = `${me.target} got away`; this.deal(me); }
    if (this.players.every((p) => p.tries >= (Number(this.opts.attempts) || 10))) {
      const top = this.leaders((p) => p.done);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  isOut(p) { return p.tries >= (Number(this.opts.attempts) || 10); }
  big(p) { return p.left; }
  sub(p) { return `${p.done} of ${p.tries} · streak ${p.streak} · visit ${Math.min(p.visits + 1, 3)} of 3`; }
  facts() { return [`${Number(this.opts.attempts) || 10} finishes`, "Double out"]; }
  banner() { const r = checkoutRoute(this.me.left); return this.note || (r ? `Checkout <b>${esc(r.join(" "))}</b>` : ""); }
  results() {
    return this.players.map((p, i) => ({ i, main: p.done, mainLabel: "checkouts", stats: [["tries", p.tries], ["best", p.best || "–"]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// -- Lives -----------------------------------------------------------------------------------------

// 11 Lives (Legs): beat the visit before yours or lose a life. Hi-Lo: call higher or lower
// before the visit. Under the Bar: stay under the bar.
class LivesGame extends LocalGame {
  static player(o) { return { lives: Number(o.lives) || 3 }; }
  isOut(p) { return p.lives <= 0; }
  startVisit() { this.note = ""; }
  score(seg) { const v = segmentScore(seg); return { text: `${v}`, points: v }; }
  total() { return this.visit.reduce((t, d) => t + segmentScore(d.seg), 0); }

  action(name, value) {
    if (name !== "call" || this.kind !== "hi_lo" || this.visit.length) return false;
    this.call = value === "lo" ? "lo" : "hi";
    return true;
  }

  endVisit(me) {
    const t = this.total();
    let lost = false;
    if (this.kind === "lives") {
      lost = this.last != null && t <= this.last;
      this.note = lost ? `${me.name} needed more than ${this.last}: a life gone` : "";
      this.last = t;
    } else if (this.kind === "hi_lo") {
      const call = this.call || "hi";
      lost = this.last != null && (call === "hi" ? t <= this.last : t >= this.last);
      this.note = this.last == null ? "" : `${me.name} called ${call === "hi" ? "higher" : "lower"} than ${this.last}: ${lost ? "wrong, a life gone" : "right"}`;
      this.last = t;
      this.call = null;
    } else if (this.kind === "limbo") {
      const bar = this.bar ?? 60;
      const everyDart = this.visit.length === 3 && this.visit.every((d) => segmentScore(d.seg) >= 1);
      lost = !everyDart || t >= bar;
      if (lost) { this.note = `${me.name} hit the bar (${t}${everyDart ? "" : ", every dart must score"}): a life gone`; this.bar = null; }
      else { this.bar = t; this.note = `The bar is down to ${t}`; }
    }
    if (lost) me.lives -= 1;
    const alive = this.players.map((p, i) => (p.lives > 0 ? i : -1)).filter((i) => i >= 0);
    if (alive.length === 1 && this.players.length > 1) this.winLeg(alive[0]);
  }

  // "3♥" rather than a row of hearts: it fits any card and reads from the oche.
  big(p) { return p.lives > 0 ? `${p.lives}♥` : "Out"; }
  sub(p) { return p.lives > 0 ? (p.lives === 1 ? "last life" : "lives left") : "Out"; }
  facts() {
    if (this.kind === "limbo") return [`The bar: ${this.bar ?? "under 60"}`];
    if (this.kind === "hi_lo") return [this.last == null ? "First visit sets the score" : `Last visit: ${this.last}`];
    return [this.last == null ? "First visit sets the score" : `Beat ${this.last}`];
  }
  banner() {
    if (this.note) return esc(this.note);
    if (this.kind === "limbo") return `Stay under <b>${this.bar ?? 60}</b>, every dart must score`;
    if (this.kind === "hi_lo" && this.last != null) return `Higher or lower than <b>${this.last}</b>?`;
    return this.last != null ? `Beat <b>${this.last}</b>` : "";
  }
  panel() {
    if (this.kind !== "hi_lo" || this.last == null || this.visit.length || this.winner != null) return "";
    const c = this.call || "hi";
    return `<div class="gpanel hilo"><button class="big ${c === "hi" ? "primary" : ""}" data-act="lg" data-value="call:hi">▲ Higher than ${this.last}</button>
      <button class="big ${c === "lo" ? "primary" : ""}" data-act="lg" data-value="call:lo">▼ Lower than ${this.last}</button></div>`;
  }
  results() {
    return this.players.map((p, i) => ({ i, main: Math.max(p.lives, 0), mainLabel: "lives", stats: [["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// Killer (bar rules: hit your own number three times to become a killer, no killing
// yourself, 12 rounds with rising multipliers) and Nine Lives (9 lives, your number heals).
// Lite counts the neighbouring numbers too.
class KillerGame extends LocalGame {
  static tally = false;
  static player(o) { return { lives: o.fight ? 9 : 3, charge: 0, killer: !!o.fight, number: 0 }; }
  init() {
    const pool = shuffle([...ORDER], () => this._rand());
    this.players.forEach((p, i) => { p.number = pool[i % 20]; });
  }
  isOut(p) { return p.lives <= 0; }
  hitsNumber(seg, n) {
    const x = parseSegment(seg).number;
    return x === n || (this.opts.lite && neighbours(n).includes(x));
  }
  mult() {
    if (this.opts.fight) return 1;
    return this.round >= 10 ? 3 : this.round >= 7 ? 2 : 1;
  }
  score(seg, me) {
    const p = parseSegment(seg), m = { S: 1, D: 2, T: 3 }[p.ring] || 0;
    if (!m) return { text: "no score" };
    if (this.hitsNumber(seg, me.number)) {
      if (this.opts.fight) { const before = me.lives; me.lives = Math.min(9, me.lives + m); return { text: `+${me.lives - before} life`, good: me.lives > before }; }
      if (!me.killer) { me.charge = Math.min(3, me.charge + m); if (me.charge >= 3) { me.killer = true; return { text: "Killer!", good: true, event: "killer" }; } return { text: `${me.charge}/3` }; }
      return { text: "own number" };
    }
    const victim = this.players.findIndex((q, i) => i !== this.current && q.lives > 0 && this.hitsNumber(seg, q.number));
    if (victim < 0 || !me.killer) return { text: me.killer ? "no one there" : "not a killer yet" };
    const v = this.players[victim], dmg = m * this.mult();
    v.lives = Math.max(0, v.lives - dmg);
    const alive = this.players.map((q, i) => (q.lives > 0 ? i : -1)).filter((i) => i >= 0);
    if (alive.length === 1) this.winLeg(alive[0]);
    return { text: `${v.name} −${dmg}${v.lives ? "" : " out!"}`, good: true };
  }
  endRound() {
    if (!this.opts.fight && this.round > 12) {
      const top = this.leaders((p) => p.lives);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return p.number; }
  sub(p) {
    if (p.lives <= 0) return "Out";
    const hearts = "♥".repeat(Math.min(p.lives, 9));
    return this.opts.fight ? hearts : `${hearts}${p.killer ? " · Killer" : ` · ${p.charge}/3`}`;
  }
  facts() {
    const f = [this.opts.fight ? "Your number heals" : "Three on your number to become a killer"];
    if (this.opts.lite) f.push("Neighbours count");
    if (!this.opts.fight) f.push(`Round ${Math.min(this.round, 12)} of 12${this.mult() > 1 ? ` · hits ×${this.mult()}` : ""}`);
    return f;
  }
  banner() {
    const me = this.me;
    return me.killer ? `Hunt: ${this.players.filter((q, i) => i !== this.current && q.lives > 0).map((q) => `<b>${q.number}</b>`).join(" ")}` : `Go for your number <b>${me.number}</b>`;
  }
  // The players' numbers on the board, in their colours.
  overlay() {
    return this.players.map((p, i) => p.lives > 0 ? sectorOverlay(p.number, this._pc(i), 0.45) : "").join("");
  }
  results() {
    return this.players.map((p, i) => ({ i, main: Math.max(p.lives, 0), mainLabel: "lives", stats: [["number", p.number], ["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// A number's whole wedge on the drawn board, tinted.
function sectorOverlay(n, color, opacity = 0.4, strength = 0) {
  const i = ORDER.indexOf(n);
  if (i < 0) return "";
  const a1 = -99 + i * 18, a2 = a1 + 18;
  const dots = Array.from({ length: strength }, (_, k) => { const [x, y] = polar(1.05 + 0.0, -90 + i * 18 + (k - (strength - 1) / 2) * 4); return `<circle cx="${x}" cy="${y}" r="0.022" fill="${color}"/>`; }).join("");
  return `<path d="${wedge(R.outer, 1, a1, a2)}" fill="${color}" fill-opacity="${opacity}" class="sector"/>${dots}`;
}

// -- Board games -----------------------------------------------------------------------------------

// Ladder Rush: the ring is the dice (bull 6, outer bull 5, inner single 4, treble 3,
// outer single 2, double 1); up the ladders, down the snakes, first to 50.
// Ladders and snakes run up and down a column of the board, so they never cross it.
const SNAKES_LADDERS = { 4: 17, 9: 32, 21: 40, 26: 35, 33: 48, 42: 19, 44: 24, 38: 3, 27: 14, 16: 5 };
class SnakesGame extends LocalGame {
  static tally = false;
  static player() { return { sq: 0 }; }
  headStart(p, lead) { p.sq = { 1: 2, 2: 5 }[lead]; }
  roll(seg, info) {
    const p = parseSegment(seg);
    return { BULL: 6, OUTER: 5, T: 3, D: 1 }[p.ring] ?? (p.ring === "S" ? (singleSide(seg, info) === "inner" ? 4 : 2) : 0);
  }
  score(seg, me, info) {
    const r = this.roll(seg, info);
    if (!r) return { text: "no move" };
    let to = me.sq + r;
    const exact = this.opts.exact !== false;
    if (to > 50) to = exact ? 50 - (to - 50) : 50;
    let text = `+${r} → ${to}`;
    const jump = SNAKES_LADDERS[to], landed = to;
    if (jump) { text += jump > to ? ` · ladder to ${jump}!` : ` · snake to ${jump}`; to = jump; }
    me.sq = to;
    if (to === 50) this.winLeg(this.current);
    return { text, good: !!jump && jump > landed, event: jump ? (jump > landed ? "ladder" : "snake") : null };
  }
  big(p) { return p.sq; }
  sub(p) { return p.sq >= 50 ? "Home!" : `${50 - p.sq} to go`; }
  facts() { return ["Bull 6 · 25 5 · inner 4 · treble 3 · outer 2 · double 1", this.opts.exact !== false ? "Exact roll to finish" : "Any roll finishes"]; }
  panel() {
    // 10 × 5 squares, snaking from the bottom left; ladders green, snakes red. The squares
    // stretch to fill the panel, so the board is as big as the screen allows; the snakes and
    // ladders are drawn over them and the numbers and tokens on top, so nothing hides a number.
    const pos = (sq) => { const k = Math.max(sq, 1) - 1, row = Math.floor(k / 10), col = row % 2 ? 9 - (k % 10) : k % 10; return [col * 10 + 5, (4 - row) * 10 + 5]; };
    const here = new Set(this.players.map((p) => p.sq));
    const cur = this.me?.sq;
    let cells = "";
    for (let sq = 1; sq <= 50; sq++) {
      const [x, y] = pos(sq), dark = ((x - 5) / 10 + (y - 5) / 10) % 2;
      const jump = SNAKES_LADDERS[sq];
      const cls = [dark ? "a" : "b", sq === 50 ? "home" : "", jump ? (jump > sq ? "up" : "down") : "", sq === cur && this.winner == null ? "cur" : "", here.has(sq) ? "taken" : ""].join(" ");
      cells += `<div class="slc ${cls}" style="grid-column:${(x + 5) / 10};grid-row:${(y + 5) / 10}"><span>${sq}</span></div>`;
    }
    const links = Object.entries(SNAKES_LADDERS).map(([a, b]) => {
      const [x1, y1] = pos(Number(a)), [x2, y2] = pos(b);
      if (b > a) {
        // A ladder: two rails and rungs.
        const count = Math.max(2, Math.round((y1 - y2) / 3));
        const rungs = Array.from({ length: count }, (_, k) => { const t = (k + 0.5) / count, yy = y1 + (y2 - y1) * t, xx = x1 + (x2 - x1) * t; return `<line x1="${xx - 1.6}" y1="${yy}" x2="${xx + 1.6}" y2="${yy}"/>`; }).join("");
        return `<g class="ladder"><line x1="${x1 - 1.6}" y1="${y1 + 2}" x2="${x2 - 1.6}" y2="${y2 - 2}"/><line x1="${x1 + 1.6}" y1="${y1 + 2}" x2="${x2 + 1.6}" y2="${y2 - 2}"/>${rungs}</g>`;
      }
      // A snake: a wave from its head down to its tail.
      const n = Math.max(2, Math.round((y2 - y1) / 5)), pts = [];
      for (let k = 0; k <= n * 4; k++) { const t = k / (n * 4); pts.push(`${(x1 + (x2 - x1) * t + 2.2 * Math.sin(t * n * Math.PI)).toFixed(2)} ${(y1 + (y2 - y1) * t).toFixed(2)}`); }
      return `<g class="snake"><path d="M${pts.join(" L")}"/></g>`;
    }).join("");
    const heads = Object.entries(SNAKES_LADDERS).filter(([a, b]) => b < a).map(([a]) => { const [x, y] = pos(Number(a)); return `<i class="slhead" style="left:${x}%;top:${y * 2}%"></i>`; }).join("");
    // Tokens on one square sit side by side; players still at the start wait left of square 1.
    const bySq = {};
    const tokens = this.players.map((p, i) => {
      const k = (bySq[p.sq] = (bySq[p.sq] ?? -1) + 1);
      const [x, y] = p.sq ? pos(p.sq) : [-4, 45];
      const dx = p.sq ? ((k % 3) - 1) * 3.3 : 0, dy = p.sq ? (Math.floor(k / 3) % 2 ? 3.4 : 0.6) : -(k % 8) * 5.5;
      return `<span class="sltok ${i === this.current && this.winner == null ? "cur" : ""} ${p.sq ? "" : "start"}" style="--pc:${this._pc(i)};left:${x + dx}%;top:${(y + dy) * 2}%" title="${esc(p.name)}">${esc((p.name[0] || "?").toUpperCase())}</span>`;
    }).join("");
    const key = [["Bull", 6], ["25", 5], ["Inner", 4], ["Treble", 3], ["Outer", 2], ["Double", 1]].map(([l, v]) => `<span><b>${v}</b>${l}</span>`).join("");
    return `<div class="gpanel sl" style="--pc:${this._pc(this.current)}"><div class="slwrap"><div class="slgrid">${cells}<svg class="sllinks" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${heads}${tokens}</div></div><div class="slkey">${key}</div></div>`;
  }
  results() {
    return this.players.map((p, i) => ({ i, main: p.sq, mainLabel: "square", stats: [["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// Derby Dash: a racer per player on a number; your number moves you on, another player's
// number pushes them back; a 9-step track, at most 8 rounds, the round is finished.
class DerbyGame extends LocalGame {
  static tally = false;
  static player() { return { step: 0, number: 0, home: false }; }
  headStart(p, lead) { p.step = lead; }
  init() {
    const pool = shuffle([...ORDER], () => this._rand());
    this.players.forEach((p, i) => { p.number = pool[i % 20]; });
  }
  score(seg, me) {
    const p = parseSegment(seg), m = { S: 1, D: 2, T: 3 }[p.ring] || 0, track = Number(this.opts.track) || 9;
    if (!m) return { text: "no move" };
    if (p.number === me.number) {
      if (me.home) return { text: "already home" };
      me.step = Math.min(track, me.step + m);
      if (me.step >= track) { me.home = true; this.finishing = true; return { text: "Home!", good: true }; }
      return { text: `+${m}`, good: true };
    }
    const v = this.players.find((q, i) => i !== this.current && q.number === p.number && !q.home);
    if (!v) return { text: "no one's number" };
    const back = Math.min(v.step, m);
    v.step -= back;
    return { text: back ? `${v.name} −${back}` : `${v.name} at the start`, good: back > 0 };
  }
  endRound() {
    const home = this.players.map((p, i) => (p.home ? i : -1)).filter((i) => i >= 0);
    if (home.length) return home.length > 1 ? this.winShared(home) : this.winLeg(home[0]);
    if (this.round > (Number(this.opts.rounds) || 8)) {
      const top = this.leaders((p) => p.step);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return p.number; }
  sub(p) { return p.home ? "Home!" : `Step ${p.step} of ${Number(this.opts.track) || 9}`; }
  facts() { return [`Round ${Math.min(this.round, Number(this.opts.rounds) || 8)} of ${Number(this.opts.rounds) || 8}`, this.finishing ? "Last round: finish it!" : "Your number moves you, theirs pushes them back"]; }
  banner() { return `Go for <b>${this.me.number}</b>, push back ${this.players.filter((q, i) => i !== this.current && !q.home && q.step > 0).map((q) => `<b>${q.number}</b>`).join(" ") || "nobody yet"}`; }
  panel() {
    const track = Number(this.opts.track) || 9;
    return `<div class="gpanel derby" style="--n:${this.players.length}">${this.players.map((p, i) => `
      <div class="derby-lane ${i === this.current ? "cur" : ""}" style="--pc:${this._pc(i)};--f:${p.step / track}">
        <span class="derby-no">${p.number}</span><span class="derby-track">${Array.from({ length: track }, () => "<i></i>").join("")}<span class="racer">🏇</span></span><span class="derby-flag">🏁</span></div>`).join("")}</div>`;
  }
  overlay() { return this.players.map((p, i) => sectorOverlay(p.number, this._pc(i), 0.4)).join(""); }
  results() {
    return this.players.map((p, i) => ({ i, main: p.step, mainLabel: "steps", stats: [["number", p.number], ["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// Board Grab: claim the sectors next to yours, strengthen them, take the others'; the bull
// makes you king for the visit (attack anywhere); taking a home sector takes it all.
class ConquerorGame extends LocalGame {
  static tally = false;
  static player() { return { home: 0, king: false }; }
  init() {
    const pool = shuffle([...ORDER], () => this._rand());
    this.owner = {};
    this.players.forEach((p, i) => { p.home = pool[i]; this.owner[p.home] = { by: i, str: 3 }; });
  }
  startVisit(me) { me.king = false; }
  isOut(p) { return !Object.values(this.owner).some((o) => this.players[o.by] === p); }
  mine(i) { return Object.entries(this.owner).filter(([, o]) => o.by === i).map(([n]) => Number(n)); }
  score(seg, me) {
    const p = parseSegment(seg), m = { S: 1, D: 2, T: 3 }[p.ring] || 0, i = this.current;
    if (p.ring === "BULL" || p.ring === "OUTER") { me.king = true; return { text: "King of the hill!", good: true }; }
    if (!m) return { text: "no move" };
    const n = p.number, o = this.owner[n];
    const reach = me.king || this.mine(i).some((x) => neighbours(x).includes(n) || x === n);
    if (!reach) return { text: "out of reach" };
    if (!o) { this.owner[n] = { by: i, str: Math.min(3, m) }; return { text: `claimed ${n}`, good: true }; }
    if (o.by === i) { o.str = Math.min(3, o.str + m); return { text: `${n} stronger` }; }
    o.str -= m;
    const victim = this.players[o.by];
    if (o.str > 0) return { text: `${victim.name}'s ${n} −${m}`, good: true };
    if (n === victim.home) {
      Object.values(this.owner).forEach((x) => { if (x.by === this.players.indexOf(victim)) x.by = i; });
      this.owner[n] = { by: i, str: 1 };
      this.checkEnd();
      return { text: `took ${victim.name}'s home: all theirs!`, good: true };
    }
    this.owner[n] = { by: i, str: 1 };
    return { text: `took ${n}`, good: true };
  }
  checkEnd() {
    const alive = this.players.map((p, k) => (this.mine(k).length ? k : -1)).filter((k) => k >= 0);
    if (alive.length === 1) this.winLeg(alive[0]);
  }
  endRound() {
    if (this.round > (Number(this.opts.rounds) || 15)) {
      const top = this.leaders((p) => this.mine(this.players.indexOf(p)).length);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return this.mine(this.players.indexOf(p)).length; }
  sub(p) { return `Home ${p.home}${p.king ? " · King" : ""}`; }
  facts() { return [`Round ${Math.min(this.round, Number(this.opts.rounds) || 15)} of ${Number(this.opts.rounds) || 15}`, "Bull: attack anywhere"]; }
  banner() { return this.me.king ? "<b>King</b>: attack anywhere" : "Claim the sectors next to yours"; }
  overlay() { return Object.entries(this.owner).map(([n, o]) => sectorOverlay(Number(n), this._pc(o.by), 0.25 + o.str * 0.15, o.str)).join(""); }
  results() {
    return this.players.map((p, i) => ({ i, main: this.mine(i).length, mainLabel: "sectors", stats: [["home", p.home], ["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// Target Blast: circles on the board take damage by how close darts land; a destroyed one
// scores and a new one appears.
class TargetsGame extends LocalGame {
  static player() { return { points: 0, kills: 0 }; }
  init() { this.targets = [0, 1, 2].map(() => this.spawn()); }
  spawn() {
    const a = this._rand() * Math.PI * 2, r = 0.25 + this._rand() * 0.6;
    return { x: r * Math.sin(a), y: r * Math.cos(a), hp: 3 };
  }
  // Where a dart landed: the board's position, else the middle of its bed.
  where(seg, info) {
    const c = info.coords;
    if (c && Number.isFinite(c.x)) return c;
    const p = parseSegment(seg);
    if (p.number === 25) return { x: 0, y: 0 };
    if (p.number == null) return null;
    const r = { T: (R.tripleIn + R.tripleOut) / 2, D: (R.doubleIn + 1) / 2, S: 0.8 }[p.ring] || 0.8;
    const a = ((ORDER.indexOf(p.number) * 18) * Math.PI) / 180;
    return { x: r * Math.sin(a), y: r * Math.cos(a) };
  }
  score(seg, me, info) {
    const c = this.where(seg, info);
    if (!c) return { text: "missed the board" };
    let dmg = 0, killed = 0;
    this.targets.forEach((t, k) => {
      const d = Math.hypot(c.x - t.x, c.y - t.y);
      const hit = d < 0.06 ? 3 : d < 0.12 ? 2 : d < 0.18 ? 1 : 0;
      if (!hit) return;
      dmg += hit;
      t.hp -= hit;
      if (t.hp <= 0) { killed += 1; this.targets[k] = this.spawn(); }
    });
    me.points += dmg + killed * 10;
    me.kills += killed;
    return { text: killed ? `destroyed! +${dmg + killed * 10}` : dmg ? `+${dmg}` : "no hit", points: dmg + killed * 10, good: dmg > 0 };
  }
  endRound() {
    if (this.round > (Number(this.opts.rounds) || 8)) {
      const top = this.leaders((p) => p.points);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return p.points; }
  sub(p) { return `${p.kills} destroyed`; }
  facts() { return [`Round ${Math.min(this.round, Number(this.opts.rounds) || 8)} of ${Number(this.opts.rounds) || 8}`, "Close hits hurt more"]; }
  banner() { return "Hit the <b>targets</b> on the board"; }
  overlay() { return this.targets.map((t) => `<g class="target"><circle cx="${t.x}" cy="${-t.y}" r="0.18" class="t3"/><circle cx="${t.x}" cy="${-t.y}" r="0.12" class="t2"/><circle cx="${t.x}" cy="${-t.y}" r="0.06" class="t1"/><text x="${t.x}" y="${-t.y + 0.004}">${t.hp}</text></g>`).join(""); }
}

// -- Scoring games ---------------------------------------------------------------------------------

// Chasing Bullseye: go for the middle. Bull +3, outer bull +2, inner single +1, treble −2, the rest
// −1; six rounds, the last one double; three bullseyes win at once.
class BullHuntGame extends LocalGame {
  static player() { return { points: 0, bulls: 0 }; }
  score(seg, me, info) {
    const p = parseSegment(seg);
    let v = p.ring === "BULL" ? 3 : p.ring === "OUTER" ? 2 : p.ring === "T" ? -2 : p.ring === "S" && singleSide(seg, info) === "inner" ? 1 : -1;
    if (this.round >= (Number(this.opts.rounds) || 6)) v *= 2;
    me.points += v;
    if (p.ring === "BULL" && ++me.bulls >= 3) this.winLeg(this.current);
    return { text: `${v > 0 ? "+" : ""}${v}`, points: v, good: v > 0 };
  }
  endRound() {
    if (this.round > (Number(this.opts.rounds) || 6)) {
      const top = this.leaders((p) => p.points);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return p.points; }
  sub(p) { return `${p.bulls} bullseye${p.bulls === 1 ? "" : "s"}`; }
  facts() { const n = Number(this.opts.rounds) || 6; return [`Round ${Math.min(this.round, n)} of ${n}${this.round >= n ? " · counts double" : ""}`]; }
  banner() { return "Aim for the <b>bull</b>"; }
}

// Bull & Goal: hit the bull to get the ball, then every double is a goal; first to five.
class FootballGame extends LocalGame {
  static player() { return { goals: 0, ball: false }; }
  score(seg, me) {
    const p = parseSegment(seg);
    if (!me.ball) {
      if (p.number === 25) { me.ball = true; return { text: "Got the ball!", good: true }; }
      return { text: "needs the bull" };
    }
    if (p.ring === "D" || p.ring === "BULL") {
      me.goals += 1;
      if (me.goals >= (Number(this.opts.goals) || 5)) this.winLeg(this.current);
      return { text: "GOAL!", good: true, points: 1, event: "goal" };
    }
    return { text: "wide" };
  }
  big(p) { return p.goals; }
  sub(p) { return p.ball ? "⚽ On the ball" : "Needs the bull"; }
  facts() { return [`First to ${Number(this.opts.goals) || 5} goals`]; }
  banner() { return this.me.ball ? "Score on the <b>doubles</b>" : "Hit the <b>bull</b> to get the ball"; }
  results() {
    return this.players.map((p, i) => ({ i, main: p.goals, mainLabel: "goals", stats: [["darts", p.darts]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || (b.main - a.main));
  }
}

// Snooker darts: reds on 1–15 (each potted once), a colour after every red (16 yellow 2,
// 17 green 3, 18 brown 4, 19 blue 5, 20 pink 6, bull black 7), then the colours in order.
// Anything else ends the break.
const COLOURS = [[16, "Yellow", 2], [17, "Green", 3], [18, "Brown", 4], [19, "Blue", 5], [20, "Pink", 6], [25, "Black", 7]];
class SnookerGame extends LocalGame {
  static player() { return { points: 0, best: 0 }; }
  init() { this.reds = Array.from({ length: 15 }, (_, i) => i + 1); this.colourNext = 0; }
  startVisit(me) { this.wantColour = false; me.brk = 0; }
  score(seg, me) {
    const p = parseSegment(seg), n = p.number;
    const foul = () => { this.stop = true; this.note = `${me.name}: foul, the break ends`; return { text: "foul" }; };
    if (this.reds.length) {
      if (!this.wantColour) {
        if (!this.reds.includes(n)) return foul();
        this.reds = this.reds.filter((r) => r !== n);
        this.wantColour = true;
        return this.pot(me, 1, "red");
      }
      const c = COLOURS.find(([cn]) => cn === n);
      if (!c) return foul();
      this.wantColour = false;
      return this.pot(me, c[2], c[1]);
    }
    const [cn, name, v] = COLOURS[this.colourNext] || [];
    if (n !== cn) return foul();
    this.colourNext += 1;
    const r = this.pot(me, v, name);
    if (this.colourNext >= COLOURS.length) {
      const top = this.leaders((q) => q.points);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
    return r;
  }
  pot(me, v, name) {
    me.points += v; me.brk += v; me.best = Math.max(me.best, me.brk);
    return { text: `${name} +${v}`, points: v, good: true, event: name === "Black" ? "black" : null };
  }
  big(p) { return p.points; }
  sub(p) { return `Best break ${p.best}`; }
  facts() { return [this.reds.length ? `${this.reds.length} reds left` : `Colours: ${COLOURS.slice(this.colourNext).map(([, n]) => n).join(", ")}`]; }
  banner() {
    if (this.note && this.stop) return esc(this.note);
    if (this.reds.length) return this.wantColour ? "A <b>colour</b>: 16–20 or the bull" : `A <b>red</b>: ${this.reds.join(" ")}`;
    const c = COLOURS[this.colourNext];
    return c ? `The <b>${c[1]}</b> on ${c[0] === 25 ? "the bull" : c[0]}` : "";
  }
}

// Scram, for two: the stopper closes numbers by hitting them, the scorer scores on the
// numbers still open; when all are closed they swap. The higher score after both halves wins.
class ScramGame extends LocalGame {
  static player() { return { points: 0 }; }
  init() { this.half = 1; this.closed = []; }
  stopper() { return this.half === 1 ? 1 : 0; }
  score(seg, me) {
    const p = parseSegment(seg), n = p.number, i = this.current;
    if (n == null || n === 0) return { text: "miss" };
    const key = n === 25 ? 25 : n;
    if (i === this.stopper()) {
      if (this.closed.includes(key)) return { text: "already closed" };
      this.closed.push(key);
      if (this.closed.length >= 21) this.swap();
      return { text: `closed ${key === 25 ? "Bull" : key}`, good: true };
    }
    if (this.closed.includes(key)) return { text: "closed" };
    const v = segmentScore(seg);
    me.points += v;
    return { text: `+${v}`, points: v, good: true };
  }
  swap() {
    if (this.half === 2) {
      const [a, b] = this.players;
      if (a.points === b.points) this.winShared([0, 1]); else this.winLeg(a.points > b.points ? 0 : 1);
      return;
    }
    this.half = 2;
    this.closed = [];
    this.stop = true;
    this.note = "All closed: swap! The stopper now scores.";
  }
  big(p) { return p.points; }
  sub(p) { const i = this.players.indexOf(p); return i === this.stopper() ? "Stopper" : "Scorer"; }
  facts() { return [`Half ${this.half} of 2`, `${21 - this.closed.length} numbers open`]; }
  banner() {
    if (this.note && this.stop) return esc(this.note);
    return this.current === this.stopper() ? "Close numbers: hit them" : "Score on the <b>open</b> numbers";
  }
  overlay() { return this.closed.filter((n) => n !== 25).map((n) => sectorOverlay(n, "#000", 0.6)).join(""); }
}

// Party Shanghai: the round's number scores (single, double, treble), 7 or 20 rounds, and a
// Shanghai (single, double and treble of the number in one visit) wins at once. Lite: the
// numbers either side count as a single of the round's number.
class ShanghaiGame extends LocalGame {
  static player() { return { points: 0, shanghais: 0 }; }
  get target() { return Math.min(this.round, this.rounds()); }
  rounds() { return Number(this.opts.rounds) || 7; }
  startVisit(me) { me.beds = []; }
  score(seg, me) {
    const p = parseSegment(seg), n = this.target;
    let m = 0;
    if (p.number === n) m = { S: 1, D: 2, T: 3 }[p.ring] || 0;
    else if (this.opts.lite && p.ring !== "M" && neighbours(n).includes(p.number)) m = 1;
    if (!m) return { text: "no score" };
    const v = m * n;
    me.points += v;
    if (p.number === n) (me.beds ??= []).push(p.ring);
    if (["S", "D", "T"].every((r) => me.beds.includes(r))) {
      me.shanghais += 1;
      this.note = `Shanghai! ${me.name} wins`;
      this.winLeg(this.current);
      return { text: "SHANGHAI!", points: v, good: true, event: "shanghai" };
    }
    return { text: `+${v}${p.number === n ? "" : " (neighbour)"}`, points: v, good: true };
  }
  endRound() {
    if (this.round > this.rounds()) {
      const top = this.leaders((p) => p.points);
      top.length > 1 ? this.winShared(top) : this.winLeg(top[0]);
    }
  }
  big(p) { return p.points; }
  sub(p) { return p.shanghais ? "Shanghai!" : `Round ${this.target} of ${this.rounds()}`; }
  facts() { return [`Round ${this.target} of ${this.rounds()}: the ${this.target}s`, this.opts.lite ? "Lite: neighbours count" : "Shanghai wins at once"]; }
  banner() { return this.note || `Aim for the <b>${this.target}</b>`; }
  overlay() {
    const n = this.target, c = this._pc(this.current);
    return sectorOverlay(n, c, 0.45) + (this.opts.lite ? neighbours(n).map((x) => sectorOverlay(x, c, 0.18)).join("") : "");
  }
}

// Sudden death after a dead heat: one dart each at the bullseye, the nearest wins; players
// level on the best dart throw again, the others are out.
const BED_FAR = { BULL: 0.02, OUTER: 0.06, T: 0.6, D: 0.97 };
class BullOffGame extends LocalGame {
  static tally = false;
  static player() { return { dist: null, dart: "" }; }
  // How far from the middle (1 = the edge of the doubles): where the board saw the dart, else
  // the middle of its bed.
  far(seg, info = {}) {
    const c = info.coords;
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) return Math.hypot(c.x, c.y);
    const p = parseSegment(seg);
    if (p.ring === "S") return info.bed === "SingleInner" ? 0.3 : 0.8;
    return BED_FAR[p.ring] ?? 2;
  }
  score(seg, me, info) {
    me.dist = this.far(seg, info);
    me.dart = seg;
    this.stop = true; // one dart each
    return { text: me.dist >= 1.5 ? "off the board" : me.dist <= 0.04 ? "bullseye!" : `${Math.round(me.dist * 170)} mm`, good: me.dist <= 0.06, event: me.dist <= 0.04 ? "bullseye" : null };
  }
  endRound() {
    const live = this.players.map((p, i) => ({ p, i })).filter(({ p }) => !p.out);
    if (live.some(({ p }) => p.dist == null)) return;
    const best = Math.min(...live.map(({ p }) => p.dist));
    const level = live.filter(({ p }) => Math.abs(p.dist - best) < 1e-9);
    if (level.length === 1) return this.winLeg(level[0].i);
    live.forEach(({ p }) => { if (!level.some((l) => l.p === p)) p.out = true; p.dist = null; });
    this.note = `Level: ${level.map(({ p }) => p.name).join(" and ")} throw again`;
  }
  big(p) { return p.out ? "Out" : p.dart ? segmentScore(p.dart) === 50 ? "Bull" : p.dart : "–"; }
  sub(p) { return p.dist == null ? (p.out ? "" : "to throw") : p.dist >= 1.5 ? "off the board" : `${Math.round(p.dist * 170)} mm from the middle`; }
  facts() { return ["One dart each", "Nearest the middle wins"]; }
  banner() { return this.note || "Sudden death: <b>one dart</b> at the bullseye"; }
  results() {
    return this.players.map((p, i) => ({ i, main: p.dist == null ? "–" : `${Math.round(p.dist * 170)} mm`, mainLabel: "from the middle", stats: [["dart", p.dart || "–"]] }))
      .sort((a, b) => (this.isWinner(b.i) - this.isWinner(a.i)) || ((this.players[a.i].dist ?? 9) - (this.players[b.i].dist ?? 9)));
  }
}

// Every game the card scores itself: its class and the options it starts with.
const LOCAL_GAME_CLASSES = {
  x01_party: [CountdownGame, (s) => ({ start: Number(s.start) || 501, doubleOut: s.double_out !== false, doubleIn: !!s.double_in, legs: s.legs })],
  tower: [CountdownGame, () => ({ start: 180, equalTurns: true, playoff: 60 })],
  moon_landing: [CountdownGame, (s) => ({ start: 200, overshoot: !s.pro })],
  gotcha: [GotchaGame, () => ({ target: 301 })],
  scram: [ScramGame, () => ({})],
  beer_tap: [BeerTapGame, () => ({ target: 400 })],
  chase_dragon: [SequenceGame, () => ({})],
  atc_doubles: [SequenceGame, () => ({})],
  atc_trebles: [SequenceGame, () => ({})],
  atc_lite: [SequenceGame, () => ({})],
  hare_hounds: [SequenceGame, () => ({})],
  doubles_ladder: [LadderGame, () => ({ rounds: 10 })],
  random_checkout: [RandomCheckoutGame, () => ({ attempts: 10 })],
  lives: [LivesGame, () => ({ lives: 3 })],
  hi_lo: [LivesGame, () => ({ lives: 3 })],
  limbo: [LivesGame, () => ({ lives: 3 })],
  killer_venue: [KillerGame, (s) => ({ lite: !!s.lite })],
  fight: [KillerGame, (s) => ({ fight: true, lite: !!s.lite })],
  snakes: [SnakesGame, (s) => ({ exact: s.exact !== false })],
  derby: [DerbyGame, () => ({ track: 9, rounds: 8 })],
  conqueror: [ConquerorGame, () => ({ rounds: 15 })],
  targets: [TargetsGame, () => ({ rounds: 8 })],
  bull_hunt: [BullHuntGame, () => ({ rounds: 6 })],
  football: [FootballGame, () => ({ goals: 5 })],
  snooker: [SnookerGame, () => ({})],
  bull_off: [BullOffGame, () => ({})],
  shanghai_party: [ShanghaiGame, (s) => ({ rounds: Number(s.sh_rounds) || 7, lite: !!s.lite })],
};

// A saved game back to life, whatever its kind.
for (const k of [...Object.keys(CRICKET_KINDS), ...Object.keys(LOCAL_GAME_CLASSES)]) LOCAL_GAMES.add(k);

function reviveGame(state) {
  if (!state?.kind) return null;
  if (CRICKET_KINDS[state.kind]) return new WildMouse(state);
  const entry = LOCAL_GAME_CLASSES[state.kind];
  return entry ? new entry[0](state) : null;
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
    // Recordings made on this screen (the settings page): the caller and the effects play them.
    if (!this._voice) {
      this._voice = new VoiceStore();
      this._voice.load().then(() => { if (this._voicePage) this._renderVoice(); });
    }
    this._caller.clips = this._sfx.clips = this._voice.urls;
    // Cameras: which webcam takes photos and which records the thrower for replays, whether
    // the board camera window shows, and which moments get a replay.
    this._camSet = {
      photo: "", replay: "", window: !!this._config.camera_window,
      replayOn: Array.isArray(this._config.replay_on) ? this._config.replay_on.map(String) : ["180", "game_shot"],
      ...load("cameras", {}),
    };
    this._replayBuf ??= new ReplayBuffer();
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
    this._wm = reviveGame(wm);
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
      for (const t of throws.slice(wm.seen)) wm.dart(t.segment?.name || "M", { bed: t.segment?.bed, coords: t.coords });
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

  // Keys for a keyboard, a presenter or a TV remote: N / Space / Enter / → next player
  // (Enter also starts and rematches), U / Backspace / ← undo, 1–3 correct a dart, R
  // rematch, G new game, F full screen, M mute, I rules, Escape closes whatever is open.
  _onKey(ev) {
    if (!this._stage || !this.isConnected) return;
    this._active = Date.now();
    if (this._idleOn) { ev.preventDefault(); return this._idleOff(); }
    if (this._config.keys === false) return;
    const t = ev.composedPath?.()[0];
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key, lobby = this._isLobby(), over = !!this._stage.querySelector(".gameshot");
    const act = (a, v) => { ev.preventDefault(); this._act(a, v); };
    if (k === "Escape") {
      if (this._booth) { ev.preventDefault(); return this._closeBooth(); }
      if (this._replayView) { ev.preventDefault(); return this._closeReplay(); }
      if (this._camWall) { ev.preventDefault(); this._closeCamWall(); return this._render(); }
      if (this._pad) return act("pad-close");
      if (this._sheet) return act("sheet-close");
      return;
    }
    if (this._pad) {
      if (/^[sdt]$/i.test(k)) return act("pad-ring", k.toUpperCase());
      return;
    }
    if (k === "f" || k === "F") return act("full");
    if (k === "m" || k === "M") return act("mute");
    if (k === "i" || k === "I") return act("sheet", lobby ? this._setup.game : this._currentGame());
    if (lobby) {
      if (k === "Enter") return act("start");
      return;
    }
    if (over && (k === "Enter" || k === "r" || k === "R")) return act("rematch");
    if (k === "r" || k === "R") return;
    if (k === "g" || k === "G") return act("new");
    if (["n", "N", " ", "Enter", "ArrowRight", "PageDown", "MediaTrackNext", "MediaPlayPause"].includes(k)) return act("next");
    if (["u", "U", "Backspace", "ArrowLeft", "PageUp", "MediaTrackPrevious"].includes(k)) return act("undo");
    if (["1", "2", "3"].includes(k) && (this._lastVisit || []).length >= Number(k)) return act("edit-dart", String(Number(k) - 1));
  }

  connectedCallback() {
    this._active = Date.now();
    if (!this._idleTimer) {
      this._idleTimer = setInterval(() => this._idleTick(), 5000);
      this._idleTimer?.unref?.(); // outside a browser (the tests) it must not keep the process alive
    }
    this._keyHandler ??= (ev) => this._onKey(ev);
    window.addEventListener("keydown", this._keyHandler);
    if (this._stage) {
      this._syncLive();
      this._connectEvents();
      this._syncCamWindow();
      this._syncReplay();
    }
  }

  disconnectedCallback() {
    if (this._keyHandler) window.removeEventListener("keydown", this._keyHandler);
    clearInterval(this._idleTimer);
    this._idleTimer = null;
    clearInterval(this._hlTimer);
    this._closeVoice();
    this._stopLive();
    this._closeEvents();
    this._closeBooth();
    this._replayBuf?.stop();
    clearTimeout(this._autoTimer);
    this._autoKey = null;
    this._closeReplay();
    this._closeCamWall();
    this._closeCamSetup();
    this._syncCamWindow();
  }

  _id(domain, name) {
    return `${domain}.${this._config.prefix}_${name}`;
  }

  _st(domain, name) {
    return this._hass?.states[this._id(domain, name)];
  }

  set hass(hass) {
    this._hass = hass;
    this._haControls(hass);
    const watched = ["practice_remaining_score", "practice_checkout", "practice_target", "detection_status", "player_profiles"]
      .map((n) => this._st("sensor", n))
      .concat([this._st("select", "practice_game"), this._st("switch", "practice_manual_entry")])
      .concat(homeButtons(this._config || {}).map((b) => hass.states?.[b.entity]));
    // Re-render only when something the card shows has changed.
    const key = watched.map((s) => s?.last_updated + s?.state).join("|");
    if (key === this._key) return;
    this._key = key;
    this._active = Date.now();
    if (this._idleOn) this._idleOff();
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
      } catch {
        return;
      }
      if (m.type !== "state" || !m.data) return;
      const throws = m.data.throws || [];
      // The board flags a dart that bounced out; the miss it becomes shows as a bounce out.
      if (throws.slice(this._boardThrows || 0).some((t) => t.bouncer)) this._bouncedAt = Date.now();
      if (throws.length !== this._boardThrows) { this._active = Date.now(); if (this._idleOn) this._idleOff(); }
      this._keepSpots(throws);
      this._boardThrows = throws.length;
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
    } catch {
      this._liveFailed = true;
    }
    this._stage.classList.toggle("virtual-mode", this._liveFailed);
  }

  // The darts where the board saw them, on the drawn board and over the live camera. (The
  // sectors a game colours in are this._overlay, a string; the camera's layer is _camLayer.)
  _drawDarts(throws) {
    this._lastThrows = throws;
    if (this._virtual) this._virtual.innerHTML = boardSvg(this._lastVisit || [], throws, (this._overlay || "") + (this._heatSvg || ""));
    if (!this._camLayer) return;
    this._camLayer.innerHTML = throws
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

  // Whether the integration plays Wild Mouse for this setup: it offers the game (the
  // releases after 1.9.2), the players are no more than it takes and play no teams of the card.
  _nativeWildMouse(s = this._setup) {
    const options = this._st("select", "practice_game")?.attributes?.options;
    return Array.isArray(options) && options.includes("wild_mouse") && s.players.length <= MAX_PLAYERS_INTEGRATION && !makeTeams(s.players, s.teams);
  }

  // Sides in the game: teams when the card's game is played in teams, else players.
  _seats(s = this._setup) {
    const t = LOCAL_GAMES.has(s.game) ? makeTeams(s.players, s.teams) : null;
    return t ? t.length : s.players.length;
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

  // Rematch: same order, the order turned round one place, the loser first, or the winner
  // stays on against the next in the list (the loser goes to the back).
  _rematch() {
    const s = this._setup, order = this._lastRanking || [];
    const mode = s.rematch || "rotate";
    const inGame = s.players.filter((n) => order.includes(n));
    if (mode === "rotate" && s.players.length > 1) s.players.push(s.players.shift());
    else if (mode === "loser" && inGame.length > 1) {
      const loser = order[order.length - 1];
      s.players = [loser, ...s.players.filter((n) => n !== loser)];
    } else if (mode === "winner" && order.length > 1) {
      const [winner] = order, losers = order.slice(1);
      const rest = s.players.filter((n) => !order.includes(n));
      s.players = [winner, ...rest, ...losers];
    }
    save("setup", s);
    return this._start();
  }

  // Before the first dart: the players with their photos, and the head-to-head record of two.
  _showIntro(names) {
    if (this._config.intro === false || names.length < 2) return;
    this._closeIntro();
    const h2h = names.length === 2 ? this._headToHead(names[0], names[1]) : null;
    const layer = document.createElement("div");
    layer.className = "intro-layer";
    layer.dataset.act = "intro-close";
    const list = names.slice(0, 8).map((n, i) => `<div class="intro-p" style="--pc:${this._pc(i)};--d:${i * 0.12}s">${this._avatar(n, i, "xl")}<b>${esc(n)}</b></div>`);
    layer.innerHTML = `
      <div class="intro-game">${gameIcon(this._setup.game, "gicon big")}<span>${esc(GAME_NAME[this._setup.game] || this._setup.game)}</span></div>
      <div class="intro-players ${names.length === 2 ? "two" : ""}">${names.length === 2 ? `${list[0]}<div class="intro-vs">VS</div>${list[1]}` : list.join("")}${names.length > 8 ? `<div class="intro-more">+${names.length - 8}</div>` : ""}</div>
      ${h2h ? `<div class="intro-h2h">Head to head <b>${h2h[0]} – ${h2h[1]}</b></div>` : ""}
      <div class="intro-go">Game on!</div>`;
    this._stage.appendChild(layer);
    this._introEl = layer;
    this._introTimer = setTimeout(() => this._closeIntro(), 3600);
  }

  _closeIntro() {
    clearTimeout(this._introTimer);
    this._introEl?.remove();
    this._introEl = null;
  }

  // Wins of two players against each other, from the integration's player profiles.
  _headToHead(a, b) {
    const players = this._st("sensor", "player_profiles")?.attributes?.players || [];
    const pa = players.find((p) => p.name === a);
    const rec = pa?.head_to_head?.[b] || pa?.head_to_head?.find?.((h) => h.opponent === b);
    if (!rec) return null;
    const won = Number(rec.won ?? rec.wins ?? 0), lost = Number(rec.lost ?? rec.losses ?? 0);
    return won || lost ? [won, lost] : null;
  }

  async _start(setup = this._setup) {
    const g = setup.game;
    save("setup", setup);
    // Darts still in the board are not the first darts of the new game: ask for them out.
    if (this._boardThrows > 0) this._toast("There are still darts in the board: pull them out before the first throw");
    if (LOCAL_GAMES.has(g) && !(g === "wild_mouse" && this._nativeWildMouse(setup))) {
      const teams = makeTeams(setup.players, setup.teams);
      const min = minPlayers(g);
      if (this._seats(setup) < min) {
        this._toast(`${GAME_NAME[g] || g} is played by at least ${min}: add a player`);
        return;
      }
      if (this._game()) await this._call("select", "select_option", { entity_id: this._id("select", "practice_game"), option: "off" });
      this._wake();
      const names = teams ? teams.slice(0, maxPlayers(g)).map((t) => t.join(" & ")) : (setup.players.length ? setup.players : ["Player 1"]).slice(0, maxPlayers(g));
      const entry = LOCAL_GAME_CLASSES[g];
      this._wm = CRICKET_KINDS[g]
        ? WildMouse.create(names, { legs: setup.legs, bed: setup.bed, kind: g })
        : entry[0].create(g, names, { ...entry[1](setup), ...(ROUND_CAP.has(g) && Number(setup.round_cap) ? { maxRounds: Number(setup.round_cap) } : {}) });
      if (teams) this._wm.players.forEach((p, i) => Object.assign(p, { members: teams[i], mi: 0 }));
      else if (Object.keys(setup.levels || {}).length) this._wm.setLevels(names.map((n) => setup.levels[n] || ""), !!setup.handicap);
      this._wm.seen = this._boardThrows || 0; // darts already on the board are not part of it
      this._saveWm();
      this._lobby = null;
      this._confirmEnd = false;
      this._announce(["game_on", "Game on!"]);
      this._render();
      return this._showIntro(names);
    }
    this._wm = null;
    this._saveWm();
    // The integration plays up to four: the first four in the list.
    const data = { game: g, players: setup.players.length ? setup.players.slice(0, MAX_PLAYERS_INTEGRATION) : ["Player 1"] };
    if (X01.has(g) || CRICKET.has(g) || g === "wild_mouse") {
      data.legs = setup.legs;
      if (setup.bot) data.bot_level = setup.bot;
    }
    if (g === "wild_mouse") data.three_in_a_bed = !!setup.bed;
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
      this._showIntro(data.players);
    }
  }

  async _act(act, value) {
    const s = this._setup;
    const wm = this._wm;
    if (act !== "edit-dart" && !act.startsWith("pad-")) this._pad = null;
    if (act !== "sheet") this._sheet = null;
    if (wm && ["undo", "next", "end"].includes(act) && !(act === "end" && !this._confirmEnd)) {
      if (act === "undo") {
        if (wm.winner != null) this._untrackResult();
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
      case "idle-wake": return this._idleOff();
      case "home": {
        const b = homeButtons(this._config).find((x) => x.entity === value);
        if (!b) return;
        const [domain, service] = BUTTON_CALL[b.entity.split(".")[0]] || ["homeassistant", "toggle"];
        return this._call(domain, service, { entity_id: b.entity });
      }
      case "undo":
        if (this._stage?.querySelector(".gameshot")) this._untrackResult();
        return this._call("autodarts", "undo_visit");
      case "next": return this._call("autodarts", "next_player");
      case "reset": return this._call("button", "press", { entity_id: this._id("button", "reset_detection") });
      case "new": this._lobby = true; break;
      case "new-session":
        if (!this._confirmSession) { this._confirmSession = true; clearTimeout(this._sessTimer); this._sessTimer = setTimeout(() => { this._confirmSession = false; this._render(); }, 4000); break; }
        this._confirmSession = false;
        this._sess = { started: Date.now(), last: Date.now(), games: [], lastKey: null };
        this._saveSession();
        break;
      case "close-lobby": this._lobby = false; break;
      case "rematch": return this._rematch();
      case "trophies": this._trophies = true; this._lobby = true; break;
      case "trophies-close": this._trophies = false; break;
      case "send-highlights": {
        const [domain, service] = String(this._config.notify || "").split(".");
        if (domain !== "notify" || !service) return this._toast("Set notify: notify.<service> in the card to send the highlights");
        if (await this._call(domain, service, this._highlightsText())) this._toast("Highlights sent");
        return;
      }
      case "sudden": {
        const g = this._wm;
        if (!(g?.winners?.length > 1)) return;
        const tied = g.winners.map((i) => g.players[i]);
        const bo = BullOffGame.create("bull_off", tied.map((p) => p.name), {});
        tied.forEach((p, k) => { if (p.members) Object.assign(bo.players[k], { members: p.members, mi: 0 }); });
        bo.tiebreakFor = this._session().lastKey;
        bo.seen = this._boardThrows || 0;
        this._wm = bo;
        this._saveWm();
        this._lobby = null;
        this._announce(["game_on", "Sudden death!"]);
        return this._render();
      }
      case "rematch_order": s.rematch = value; break;
      case "intro-close": this._closeIntro(); return;
      case "lg": {
        const [name, arg] = String(value).split(":");
        if (this._wm?.action?.(name, arg)) { this._saveWm(); return this._render(); }
        return;
      }
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
      case "auto_next": s.autoNext = Number(value); break;
      case "teams": s.teams = value; break;
      case "sh_rounds": s.sh_rounds = Number(value); break;
      case "round_cap": s.round_cap = Number(value); break;
      case "handicap": s.handicap = !s.handicap; break;
      case "level": {
        const n = s.players[Number(value)];
        if (n == null) break;
        const order = LEVELS.map(([, v]) => v), cur = (s.levels || {})[n] || "regular";
        s.levels = { ...(s.levels || {}), [n]: order[(order.indexOf(cur) + 1) % order.length] };
        break;
      }
      case "start_score": s.start = Number(value); break;
      case "pro": s.pro = !s.pro; break;
      case "lite": s.lite = !s.lite; break;
      case "exact": s.exact = s.exact === false; break;
      case "double_out": s.double_out = s.double_out === false; break;
      case "double_in": s.double_in = !s.double_in; break;
      case "add-player":
        if (!s.players.includes(value) && s.players.length < MAX_PLAYERS) s.players.push(value);
        break;
      case "shuffle":
        for (let i = s.players.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [s.players[i], s.players[j]] = [s.players[j], s.players[i]];
        }
        break;
      case "clear-players": s.players = []; break;
      case "photo": return this._openBooth(value);
      case "camwall": return this._openCamWall();
      case "cams": return this._openCamSetup();
      case "voice": return this._openVoice();
      case "replay": return this._replay(300, 0);
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
            <div class="camwin" hidden data-act="camwall" title="Board cameras"><img alt="Board camera"><span>Live</span></div>
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
        <div class="idle-layer" data-act="idle-wake"></div>
      </div>`;
    this._stage = this.shadowRoot.querySelector(".stage");
    if (this._config.photo) this._stage.style.setProperty("--photo", `url("${this._config.photo}")`);
    this._stage.classList.toggle("has-photo", !!this._config.photo);
    const logo = safeImage(this._config.logo);
    if (logo) this._stage.querySelector(".boardwrap").insertAdjacentHTML("beforeend", `<img class="logo-mark" src="${esc(logo)}" alt="${esc(this._config.brand)}">`);
    document.title = this._config.brand;
    this._info = this.shadowRoot.querySelector(".info");
    this._lobbyEl = this.shadowRoot.querySelector(".lobby");
    this._padEl = this.shadowRoot.querySelector(".pad-layer");
    this._sheetEl = this.shadowRoot.querySelector(".sheet-layer");
    this._fxEl = this.shadowRoot.querySelector(".fx-layer");
    this._idleEl = this.shadowRoot.querySelector(".idle-layer");
    this._camWin = this.shadowRoot.querySelector(".camwin");
    this._viewEl = this.shadowRoot.querySelector(".view");
    this._plane = this.shadowRoot.querySelector(".plane");
    this._img = this.shadowRoot.querySelector(".cam");
    this._camLayer = this.shadowRoot.querySelector(".overlay");
    this._virtual = this.shadowRoot.querySelector(".virtual");
    this._img.addEventListener("error", () => {
      if (!this._img.getAttribute("src")) return;
      this._liveFailed = true;
      this._stage.classList.add("virtual-mode");
    });
    new ResizeObserver(() => this._fit()).observe(this._viewEl);
    this._stage.addEventListener("click", (ev) => {
      this._active = Date.now();
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
    this._overNow = null;
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
    this._syncCamWindow();
    this._syncReplay();
    this._haPublish();
    this._trackResult();
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
      if (ctx.shield != null) this._shieldRow(ctx.shield);
      if (dartKind(seg) === "bull") this._maybeReplay("bull");
      if (parseSegment(seg).label === "T20") this._maybeReplay("t20");
      if (ctx.closed) {
        this._play("closed");
        if (ctx.closed === "D" || ctx.closed === "T") this._announce([`${ctx.closed === "D" ? "doubles" : "triples"}_closed`, `${ctx.closed === "D" ? "Doubles" : "Triples"} closed!`]);
      }
      if (visit.length === 3 && !ctx.winner) this._banter(visit, ctx);
      if (ctx.event && EVENT_CALL[ctx.event]) {
        this._moment(ctx.event, ctx.color) || this._celebrate(EVENT_CALL[ctx.event].replace("!", ""), "", "ton", ctx.color);
        this._announce([ctx.event, EVENT_CALL[ctx.event]]);
      } else if (ctx.kind === "local" && !ctx.x01 && dartKind(seg) === "bull") {
        this._announce(["bullseye", "Bullseye!"]);
      }
      if (visit.length === 3 && (ctx.kind === "x01" || ctx.x01) && !ctx.bust && !ctx.winner) {
        const total = visit.reduce((t, s) => t + segmentScore(s), 0);
        if (total === 180) {
          this._keepMoment("180", ctx.turnName, 180, visit, ctx);
          this._moment("180", ctx.color, 2600) || this._celebrate("180", "One hundred and eighty!", "max", ctx.color);
          this._maybeReplay("180");
          this._play("180");
          this._announce(["180", "One hundred and eighty!"]);
        } else {
          if (total >= 100) {
            (total >= 140 && this._moment("ton40", ctx.color)) || this._moment("ton", ctx.color)
              || this._celebrate(String(total), total >= 140 ? "Ton forty plus" : "Ton plus", "ton", ctx.color);
            this._play("ton");
            this._maybeReplay("ton");
          }
          this._announce(total ? [`score_${total}`, numberWords(total)] : ["no_score", "No score"]);
        }
      }
    }
    if (ctx.bed && !was.bed) {
      this._moment("three_in_a_bed", ctx.color) || this._celebrate("3 in a bed", "", "ton", ctx.color);
      this._play("ton");
      this._announce(["three_in_a_bed", "Three in a bed!"]);
    }
    if (ctx.bust && !was.bust) {
      this._moment("bust", ctx.color) || this._celebrate("Bust", "", "bust", ctx.color);
      this._play("bust");
      this._announce(["bust", "Bust!"]);
    }
    if (ctx.winner && ctx.winner !== was.winner) {
      const out = (ctx.kind === "x01" || ctx.x01) ? visit.reduce((t, sg) => t + segmentScore(sg), 0) : 0;
      this._keepMoment(out >= 100 ? "checkout" : "game_shot", ctx.winner, out || null, visit, ctx);
      this._confetti();
      // A game's own win picture (derby_win, snakes_win, ...) before the game shot one.
      this._moment(`${ctx.game}_win`, ctx.color, 3200) || this._moment("game_shot", ctx.color, 3200);
      this._maybeReplay("game_shot");
      this._play("win");
      this._announce([ctx.match ? "game_shot_match" : "game_shot", ctx.match ? "Game shot, and the match!" : "Game shot!"], this._nameLine(ctx.winner));
      if (out >= 100) this._announce(["checkout", "Checkout"], [`score_${out}`, numberWords(out)]);
    } else if (!ctx.winner && ctx.legs && was.legs && ctx.legs !== was.legs) {
      this._play("win");
      this._announce(["game_shot_leg", "Game shot, and the leg!"]);
    } else if (ctx.turn != null && was.turn != null && ctx.turn !== was.turn && !ctx.winner) {
      this._upNext(ctx.turnName, ctx.turnIndex, ctx.players);
      const r = Number(ctx.remaining);
      const x01 = ctx.kind === "x01" || ctx.x01;
      if (x01 && ctx.requires && r >= 2 && r <= 170) this._announce(this._nameLine(ctx.turnName), ["you_require", "you require"], [`score_${r}`, numberWords(r)]);
      else if (!x01 && ctx.players > 1 && ctx.turnName) this._announce(["up_next", "Up next"], this._nameLine(ctx.turnName));
    }
  }

  // The cricket number a dart hit when everybody has it closed, or null.
  _deadNumber(seg, numbers, scores) {
    const n = parseSegment(seg).number, i = numbers.indexOf(n);
    return i >= 0 && scores.length && scores.every((p) => ((p.marks || [])[i] || 0) >= 3) ? n : null;
  }

  // A shield on a chalkboard row: the dart hit a target nobody can score on any more.
  _shieldRow(key) {
    const row = [...(this._info?.querySelectorAll(".crow[data-row]") || [])].find((r) => r.dataset.row === String(key));
    if (!row) return;
    row.classList.add("shielded");
    row.insertAdjacentHTML("beforeend", `<span class="shield" aria-label="Closed by everybody"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg></span>`);
    setTimeout(() => { row.classList.remove("shielded"); row.querySelector(".shield")?.remove(); }, 1500);
  }

  // The next thrower, big for a moment once the darts are pulled: photo, name, colour.
  _upNext(name, index, players) {
    if (this._config.up_next === false || !name || (players ?? 2) < 2) return;
    this._fx(`<div class="upnext" style="--pc:${this._pc(index)}"><div class="un-inner">${this._avatar(name, index, "xl")}
      <small>Up next</small><b>${esc(name)}</b></div></div>`, 2000);
  }

  // The coach's line for a checkout route: what to go for if the first dart misses.
  _coach(rem, route) {
    if (this._config.coach === false) return "";
    const r = Array.isArray(route) ? route : String(route || "").split(/\s+/).filter(Boolean);
    const line = coachLine(Number(rem), r);
    return line ? `<span class="coach">${esc(line)}</span>` : "";
  }

  // A line of banter after a visit, next to the thrower, now and then (or every visit).
  _banter(visit, ctx) {
    if (this._config.banter === false) return;
    const total = visit.reduce((t, s) => t + segmentScore(s), 0), band = banterBand(total, ctx.bust);
    const every = this._config.banter === "always";
    if (!every && band !== "max" && band !== "ton40" && band !== "bust" && band !== "miss" && Math.random() > 0.35) return;
    const lines = (this._config.banter_lines || {})[band] || BANTER[band];
    if (!Array.isArray(lines) || !lines.length) return;
    const line = String(lines[Math.floor(Math.random() * lines.length)]).slice(0, 80);
    this._fxEl?.querySelector(".banter")?.remove();
    this._fxEl?.insertAdjacentHTML("beforeend", `<div class="banter" style="--pc:${ctx.color}">${esc(line)}</div>`);
    const el = this._fxEl?.lastElementChild;
    setTimeout(() => el?.remove(), 2800);
  }

  // A player's name for the caller: name_<name>.mp3, or spoken.
  _nameLine(name) {
    return [`name_${String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, String(name || "")];
  }

  // The dart that just landed, big over the board for a moment.
  _hitFlash(seg, color) {
    const p = parseSegment(seg), kind = dartKind(seg);
    // A picture for this kind of dart, if the moments option has one: the treble of the
    // number first (t20), then any treble; a miss that bounced out is a bounce out.
    const bounced = kind === "miss" && Date.now() - (this._bouncedAt || 0) < 5000;
    if (bounced) this._announce(["bounce_out", "Bounce out!"]);
    const keys = { bull: ["bull"], outer: ["outer"], double: ["double"], triple: [`t${p.number}`, "treble"], miss: [bounced ? "bounce_out" : "miss"] }[kind] || [];
    if (keys.some((k) => this._moment(k, color, 1700))) return;
    const word = { single: "", double: "Double", triple: "Treble", bull: "Bullseye", outer: "Outer bull", miss: "Miss" }[kind];
    const big = kind === "bull" ? "50" : kind === "outer" ? "25" : kind === "miss" ? "✕" : p.label;
    this._fx(`<div class="hitfx ${kind}" style="--pc:${color}"><b>${esc(big)}</b>${word ? `<small>${esc(word)}</small>` : ""}</div>`, 1100);
  }

  // A picture from the moments option slammed in over the screen; false when there is none.
  _moment(key, color, ms = 2200) {
    const url = safeImage((this._config.moments || {})[key]);
    if (!url) return false;
    this._fx(`<div class="moment m-${esc(key)}" style="--pc:${color}"><img src="${esc(url)}" alt=""></div>`, ms);
    return true;
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
      // Games played for points: a badge floats up from the card that just scored.
      if (this._fxArmed && this._pointsGame && from != null && to > from) {
        el.closest(".player")?.insertAdjacentHTML("beforeend", `<span class="pts-badge">+${to - from}</span>`);
      }
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
    if (status !== "offline" && this._cameraProblem()) return `<button class="pill bad" data-act="reset" title="Reset the board"><i></i>A board camera has a problem</button>`;
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
          ${this._homeButtons()}
          <button data-act="new" class="ghost">New game</button>
          <button data-act="end" class="ghost ${this._confirmEnd ? "danger" : ""}">${this._confirmEnd ? "Tap again to end" : "End game"}</button>
          ${this._replayBuf?.running ? `<button data-act="replay" class="ghost icon" title="Replay the last throw" aria-label="Replay the last throw"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h12v10H3zM15 10l6-3v10l-6-3"/></svg></button>` : ""}
          <button data-act="mute" class="ghost icon" title="Sound and caller" aria-label="Sound and caller">${this._soundOn || this._callerOn ? UI_ICON.sound : UI_ICON.mute}</button>
          <button data-act="full" class="ghost icon" title="Full screen" aria-label="Full screen">${UI_ICON.full}</button>
        </div>
      </header>`;
  }

  _finishBoard(visit, color = this._colors[0], ctx = {}) {
    this._feedback(this._lastVisit || [], visit, { color, ...ctx });
    this._lastVisit = visit;
    if (!visit.length && !(this._lastThrows || []).length) this._lastThrows = [];
    this._virtual.style.setProperty("--pc", color);
    this._heatSvg = this._heat(ctx.turnName);
    this._virtual.innerHTML = boardSvg(visit, this._lastThrows || [], (this._overlay || "") + this._heatSvg);
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
        name: p.name || `Player ${p.player}`, color: this._pc(i), avatar: this._avatar(p.name || `Player ${p.player}`, i, "sm"), main: main(p), mainLabel,
        stats: [
          ...(sets ? [["sets", p.sets ?? 0]] : []), ...(legs ? [["legs", p.legs ?? 0]] : []),
          ...(p.average != null ? [["average", Number(p.average).toFixed(1)]] : []),
          ...(p.mpr != null ? [["MPR", Number(p.mpr).toFixed(2)]] : []),
        ],
      }));
  }

  // -- player photos -----------------------------------------------------------------------

  // A player's picture: a photo taken on this screen, the avatars option, the picture of a
  // Home Assistant person with the same name, or none.
  _photoUrl(name) {
    const key = String(name || "").toLowerCase();
    const photos = this._photos ?? (this._photos = load("photos", {}));
    if (photos[name]) return photos[name];
    const conf = this._config.avatars || {};
    const fromConf = Object.entries(conf).find(([n]) => n.toLowerCase() === key)?.[1];
    if (fromConf) return String(fromConf);
    const person = Object.values(this._hass?.states || {}).find((s) => s.entity_id?.startsWith("person.")
      && String(s.attributes?.friendly_name || "").toLowerCase() === key && s.attributes?.entity_picture);
    return person ? person.attributes.entity_picture : "";
  }

  // The round picture of a player in their colour, or their initials.
  _avatar(name, i, size = "") {
    const url = this._photoUrl(name);
    // Only pictures the card took, site paths and web addresses; nothing that runs.
    const safe = safeImage(url);
    const initials = String(name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return safe
      ? `<img class="pav ${size}" src="${esc(safe)}" alt="" style="--pc:${this._pc(i)}">`
      : `<span class="pav initials ${size}" style="--pc:${this._pc(i)}" aria-hidden="true">${esc(initials)}</span>`;
  }

  // The photo booth: the webcam of the screen, a countdown and a square photo. Built once
  // while open, so the live picture is not torn down by the card's renders.
  async _openBooth(name) {
    this._closeBooth();
    const layer = document.createElement("div");
    layer.className = "booth-layer";
    const has = !!this._photos?.[name] || !!load("photos", {})[name];
    layer.innerHTML = `
      <div class="pad-back" data-booth="close"></div>
      <div class="booth" role="dialog" aria-label="Photo of ${esc(name)}">
        <div class="pad-head"><b>Photo of ${esc(name)}</b><button class="ghost icon" data-booth="close" title="Close">✕</button></div>
        <div class="booth-view">
          <video playsinline muted autoplay></video>
          <img class="booth-shot" alt="">
          <div class="booth-count"></div>
          <div class="booth-msg"></div>
        </div>
        <div class="booth-actions">
          <button class="primary big" data-booth="snap">📸 Take photo</button>
          <button class="primary big" data-booth="keep" hidden>Use this photo</button>
          <button class="big" data-booth="retake" hidden>Retake</button>
          <label class="big file-btn">🖼 Choose a picture<input type="file" accept="image/*" hidden></label>
          ${has ? `<button class="ghost" data-booth="remove">Remove photo</button>` : ""}
        </div>
      </div>`;
    this._stage.appendChild(layer);
    const booth = { name, layer, stream: null, shot: "" };
    this._booth = booth;
    const $ = (sel) => layer.querySelector(sel);
    const msg = (text) => { $(".booth-msg").textContent = text; $(".booth-msg").hidden = !text; };
    const show = (mode) => {
      const shot = mode === "shot";
      $("video").hidden = shot || !booth.stream;
      $(".booth-shot").hidden = !shot;
      $('[data-booth="snap"]').hidden = shot || !booth.stream;
      $('[data-booth="keep"]').hidden = !shot;
      $('[data-booth="retake"]').hidden = !shot || !booth.stream;
    };
    booth.useShot = (url) => { booth.shot = url; $(".booth-shot").src = url; msg(""); show("shot"); };
    layer.addEventListener("click", (ev) => {
      const act = ev.target.closest("[data-booth]")?.dataset.booth;
      if (act === "close") this._closeBooth();
      else if (act === "snap") this._snap();
      else if (act === "retake") { booth.shot = ""; show("live"); }
      else if (act === "keep") this._keepPhoto(name, booth.shot);
      else if (act === "remove") this._keepPhoto(name, "");
    });
    $("input[type=file]").addEventListener("change", (ev) => {
      const file = ev.target.files?.[0];
      if (file) this._photoFromFile(file).then(booth.useShot).catch(() => msg("That picture could not be read."));
    });
    show("live");
    msg("Starting the camera…");
    // Browsers only give pages on https or localhost a camera.
    if (!navigator.mediaDevices?.getUserMedia || window.isSecureContext === false) {
      msg("This browser keeps the webcam from this page: open Home Assistant as http://localhost:8123 on the screen's PC (or over https). A picture from a file works here too.");
      return show("live");
    }
    try {
      const cam = this._camSet.photo ? { deviceId: { exact: this._camSet.photo } } : { facingMode: "user" };
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...cam }, audio: false });
      if (this._booth !== booth) return stream.getTracks().forEach((t) => t.stop());
      booth.stream = stream;
      $("video").srcObject = stream;
      msg("");
      show("live");
    } catch (err) {
      msg(err?.name === "NotAllowedError" ? "The camera was not allowed. Allow it in the browser, or choose a picture." : "No webcam found. Plug one into the screen's PC, or choose a picture.");
    }
  }

  // Three, two, one, then the square middle of the picture, mirrored as the players saw it.
  _snap() {
    const booth = this._booth;
    if (!booth?.stream) return;
    const count = booth.layer.querySelector(".booth-count");
    let n = 3;
    const tick = () => {
      if (this._booth !== booth) return;
      if (n > 0) {
        count.textContent = String(n);
        count.classList.remove("go"); void count.offsetWidth; count.classList.add("go");
        n -= 1;
        this._play("single");
        return setTimeout(tick, 800);
      }
      count.textContent = "";
      const video = booth.layer.querySelector("video");
      const w = video.videoWidth, h = video.videoHeight, side = Math.min(w, h);
      if (!side) return;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = PHOTO_PX;
      const c = canvas.getContext("2d");
      c.translate(PHOTO_PX, 0);
      c.scale(-1, 1);
      c.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
      booth.layer.querySelector(".booth-view").classList.add("flash");
      setTimeout(() => booth.layer.querySelector(".booth-view")?.classList.remove("flash"), 400);
      booth.useShot(canvas.toDataURL("image/jpeg", 0.85));
    };
    tick();
  }

  // A picture from a file, cut to the same square.
  _photoFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = PHOTO_PX;
          canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  _keepPhoto(name, url) {
    const photos = { ...load("photos", {}) };
    if (url) photos[name] = url;
    else delete photos[name];
    save("photos", photos);
    this._photos = photos;
    this._closeBooth();
    this._render();
  }

  _closeBooth() {
    const booth = this._booth;
    this._booth = null;
    if (!booth) return;
    booth.stream?.getTracks().forEach((t) => t.stop()); // the webcam is free again at once
    booth.layer.remove();
  }

  // -- Home Assistant sync: the screen's game as helpers, and controls from Home Assistant ----
  // With ha_sync (true, or a prefix other than "darts_screen") and the helpers of
  // extras/darts-screen-package.yaml, the card writes what it shows to input_text helpers
  // and follows input_button / input_select / input_text controls.

  _haPrefix() {
    const v = this._config.ha_sync;
    if (!v) return "";
    return typeof v === "string" && /^[a-z0-9_]+$/.test(v) ? v : "darts_screen";
  }

  // What the screen shows, in a few words per helper.
  _haSnapshot() {
    const lobby = this._isLobby();
    const game = this._currentGame();
    const wm = this._wm;
    let player = "", scores = "", last = "", winner = "", status = lobby ? "lobby" : "playing";
    if (wm) {
      player = wm.players[wm.current]?.name || "";
      scores = wm.players.map((p) => `${p.name} ${wm.big ? wm.big(p) : p.points}`).join(" · ");
      last = wm.visit[wm.visit.length - 1]?.seg || "";
      winner = wm.winner != null ? wm.players[wm.winner].name : "";
    } else if (this._game()) {
      const a = this._st("sensor", "practice_remaining_score")?.attributes || {};
      const list = Array.isArray(a.scores) ? a.scores : [];
      const x01 = X01.has(String(a.game));
      player = list.find((p) => p.player === a.player)?.name || "";
      scores = list.map((p) => `${p.name} ${x01 ? p.remaining : p.points ?? p.score ?? ""}`).join(" · ");
      last = Array.isArray(a.visit) ? a.visit[a.visit.length - 1] || "" : "";
      winner = a.winner != null ? list.find((p) => p.player === a.winner)?.name || "" : "";
    } else {
      status = "idle";
    }
    if (winner) status = "finished";
    return { status, game: game ? GAME_NAME[game] || game : "", player: winner ? "" : player, scores, last_dart: last, winner };
  }

  // Writes the helpers that changed; never the same value twice, never one that is missing.
  _haPublish() {
    const p = this._haPrefix();
    if (!p || !this._hass) return;
    const snap = this._haSnapshot();
    this._haSent ??= {};
    for (const [key, value] of Object.entries(snap)) {
      const id = `input_text.${p}_${key}`, v = String(value).slice(0, 255);
      if (!this._hass.states[id] || this._haSent[id] === v || this._hass.states[id].state === v) { this._haSent[id] = v; continue; }
      this._haSent[id] = v;
      this._hass.callService("input_text", "set_value", { entity_id: id, value: v }).catch(() => {});
    }
  }

  // Buttons, a game select and a player list in Home Assistant drive the screen. The first
  // look only remembers where they stand, so loading the page presses nothing.
  _haControls(hass) {
    const p = this._haPrefix();
    if (!p) return;
    const seen = (this._haSeen ??= {});
    // Positions are noted from the very first update, before the screen is built.
    const ready = !!this._stage && !!this._config;
    const changed = (id) => {
      const st = hass.states[id]?.state;
      if (st == null) return false;
      const was = seen[id];
      seen[id] = st;
      return ready && was !== undefined && was !== st && st !== "unknown" && st !== "unavailable";
    };
    const button = (name, act) => { if (changed(`input_button.${p}_${name}`)) this._act(act); };
    button("new_game", "new");
    button("rematch", "rematch");
    button("next_player", "next");
    button("undo", "undo");
    if (changed(`input_button.${p}_end_game`)) { this._confirmEnd = true; this._act("end"); }
    const players = `input_text.${p}_players`;
    if (changed(players)) {
      const names = hass.states[players].state.split(",").map((n) => n.trim().slice(0, 20)).filter(Boolean);
      if (names.length) { this._setup.players = [...new Set(names)].slice(0, MAX_PLAYERS); save("setup", this._setup); this._render(); }
    }
    const select = `input_select.${p}_game`;
    if (changed(select)) {
      const name = hass.states[select].state;
      const id = Object.keys(GAME_NAME).find((k) => GAME_NAME[k] === name || k === name);
      if (id) { this._setup.game = id; this._start(); }
    }
  }

  // A camera of the board reporting a problem (the integration's camera problem sensors).
  _cameraProblem() {
    const pre = `binary_sensor.${this._config.prefix}_`;
    return Object.values(this._hass?.states || {}).some((s) => s.entity_id?.startsWith(pre) && /camera/.test(s.entity_id)
      && s.attributes?.device_class === "problem" && s.state === "on");
  }

  // -- cameras: thrower replay, board camera window ------------------------------------------

  _saveCams() {
    save("cameras", this._camSet);
  }

  // The thrower webcam records while a game is on the screen, and stops in the lobby.
  async _syncReplay() {
    const want = !!this._camSet.replay && this.isConnected && !!this._stage && !this._isLobby();
    const buf = this._replayBuf;
    if (!want) {
      if (buf.running) buf.stop();
      this._replayCam = null;
      return;
    }
    if (buf.running && this._replayCam === this._camSet.replay) return;
    if (this._replayStarting) return;
    this._replayStarting = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: this._camSet.replay }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false,
      });
      if (!this._camSet.replay || this._isLobby()) stream.getTracks().forEach((t) => t.stop());
      else if (buf.start(stream)) this._replayCam = this._camSet.replay;
    } catch {
      this._replayCam = null;
      if (!this._replayWarned) this._toast("The replay camera could not start: is it plugged in?");
      this._replayWarned = true;
    } finally {
      this._replayStarting = false;
    }
  }

  // A replay after a big moment, if that moment is one the players want replayed.
  _maybeReplay(key) {
    if (this._replayBuf.running && this._camSet.replayOn.includes(key)) this._replay(this._replayDelay ?? 1200, this._replayShowAfter ?? 2600);
  }

  // Keeps recording a moment longer (the dart settling), then shows the clip once the
  // celebration is over.
  async _replay(settle = 0, showAfter = 0) {
    if (this._replayPending) return;
    this._replayPending = true;
    await new Promise((r) => setTimeout(r, settle));
    const blob = await this._replayBuf.clip();
    this._replayPending = false;
    if (!blob) return;
    setTimeout(() => this._showReplay(blob), Math.max(0, showAfter - settle));
  }

  // "Let's see that again": the last seconds at normal speed, then the end in slow motion.
  _showReplay(blob) {
    this._closeReplay();
    const url = URL.createObjectURL(blob);
    const layer = document.createElement("div");
    layer.className = "replay-layer";
    layer.innerHTML = `
      <div class="pad-back" data-rp="close"></div>
      <div class="replay">
        <div class="replay-head"><b>Let's see that again</b><span class="replay-speed"></span><button class="ghost icon" data-rp="close" title="Close">✕</button></div>
        <video playsinline muted></video>
        <div class="replay-actions"><button data-rp="again">↺ Again</button><button data-rp="slow">Slow motion</button></div>
      </div>`;
    this._stage.appendChild(layer);
    const video = layer.querySelector("video"), speed = layer.querySelector(".replay-speed");
    const r = { layer, url, video };
    this._replayView = r;
    // Recordings arrive without a length; asking for a time far past the end reveals it.
    const length = () => new Promise((resolve) => {
      if (Number.isFinite(video.duration)) return resolve(video.duration);
      video.addEventListener("timeupdate", function once() {
        video.removeEventListener("timeupdate", once);
        resolve(Number.isFinite(video.duration) ? video.duration : video.currentTime);
      });
      try { video.currentTime = 1e6; } catch { resolve(0); }
    });
    const play = async (rate, lastSeconds) => {
      const d = await length();
      video.playbackRate = rate;
      try { video.currentTime = Math.max(0, d - lastSeconds); } catch { /* from the start */ }
      speed.textContent = rate < 1 ? "Slow motion" : "";
      layer.classList.toggle("slow", rate < 1);
      return video.play()?.catch?.(() => {});
    };
    r.step = 0;
    video.addEventListener("ended", () => {
      if (this._replayView !== r) return;
      r.step += 1;
      if (r.step === 1) play(0.35, 2.5);
      else setTimeout(() => this._replayView === r && this._closeReplay(), 800);
    });
    layer.addEventListener("click", (ev) => {
      const act = ev.target.closest("[data-rp]")?.dataset.rp;
      if (act === "close") this._closeReplay();
      else if (act === "again") { r.step = 0; play(1, 5); }
      else if (act === "slow") { r.step = 1; play(0.35, 2.5); }
    });
    video.addEventListener("loadedmetadata", () => play(1, 5), { once: true });
    video.src = url;
    r.timer = setTimeout(() => this._replayView === r && this._closeReplay(), 30000);
  }

  _closeReplay() {
    const r = this._replayView;
    this._replayView = null;
    if (!r) return;
    clearTimeout(r.timer);
    r.video.pause?.();
    r.layer.remove();
    URL.revokeObjectURL(r.url);
  }

  // The small live board camera in a corner of the board area; only streams while shown.
  _syncCamWindow() {
    const el = this._camWin;
    if (!el) return;
    const want = this._camSet.window && !this._isLobby() && this.isConnected;
    el.hidden = !want;
    const img = el.querySelector("img");
    const src = want ? `${this._boardUrl()}/api/streams/cams/${this._cam}` : "";
    if (img.dataset.src !== src) {
      img.dataset.src = src;
      if (src) img.src = src; else img.removeAttribute("src");
    }
  }

  // Every board camera big, over the game; tap one to use it in the window.
  _openCamWall() {
    this._closeCamWall();
    const n = this._cams?.length || 3, base = this._boardUrl();
    const layer = document.createElement("div");
    layer.className = "camwall-layer";
    layer.innerHTML = `
      <div class="pad-back" data-cw="close"></div>
      <div class="camwall">
        <div class="replay-head"><b>Board cameras</b><button class="ghost icon" data-cw="close" title="Close">✕</button></div>
        <div class="camwall-grid">${Array.from({ length: n }, (_, i) => `
          <button class="camwall-cam ${i === this._cam % n ? "on" : ""}" data-cw="cam" data-value="${i}"><img src="${esc(base)}/api/streams/cams/${i}" alt="Camera ${i + 1}"><span>Camera ${i + 1}</span></button>`).join("")}
        </div>
      </div>`;
    layer.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-cw]");
      if (!b) return;
      if (b.dataset.cw === "cam") { this._cam = Number(b.dataset.value); save("camera", this._cam); }
      this._closeCamWall();
      this._render();
    });
    this._stage.appendChild(layer);
    this._camWall = layer;
  }

  _closeCamWall() {
    if (!this._camWall) return;
    this._camWall.querySelectorAll("img").forEach((i) => i.removeAttribute("src")); // stop the streams
    this._camWall.remove();
    this._camWall = null;
  }

  // Which webcam does what: photos, thrower replays; and what gets replayed.
  async _openCamSetup() {
    this._closeCamSetup();
    const layer = document.createElement("div");
    layer.className = "booth-layer camsetup-layer";
    layer.innerHTML = `<div class="pad-back" data-cs="close"></div><div class="booth camsetup"><div class="pad-head"><b>Cameras</b><button class="ghost icon" data-cs="close" title="Close">✕</button></div><div class="camsetup-body">Looking for webcams…</div></div>`;
    this._stage.appendChild(layer);
    this._camSetup = layer;
    let cams = [];
    try {
      // Webcam names only show once the page may use a camera.
      const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      probe.getTracks().forEach((t) => t.stop());
      cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    } catch {
      cams = [];
    }
    if (this._camSetup !== layer) return;
    const s = this._camSet;
    const opts = (cur, none) => `${none ? `<option value="">${none}</option>` : ""}${cams.map((c, i) => `<option value="${esc(c.deviceId)}" ${c.deviceId === cur ? "selected" : ""}>${esc(c.label || `Webcam ${i + 1}`)}</option>`).join("")}`;
    const moments = [["180", "180"], ["game_shot", "Game shot"], ["bull", "Bullseye"], ["t20", "T20"], ["ton", "Ton plus"]];
    layer.querySelector(".camsetup-body").innerHTML = `
      ${cams.length ? "" : `<p class="note warn">No webcam found, or the browser does not allow it here (use http://localhost:8123 on the screen's PC).</p>`}
      <label class="cs-row">Photos of players<select data-cs="photo">${opts(s.photo, "The default webcam")}</select></label>
      <label class="cs-row">Thrower replays<select data-cs="replay">${opts(s.replay, "Off")}</select></label>
      <div class="cs-row">Replay after<div class="toggles">${moments.map(([k, l]) => `<button class="toggle ${s.replayOn.includes(k) ? "on" : ""}" data-cs="on" data-value="${k}"><i></i>${l}</button>`).join("")}</div></div>
      <div class="cs-row">Board camera<div class="toggles"><button class="toggle ${s.window ? "on" : ""}" data-cs="window"><i></i>Small live window on the game screen</button></div></div>
      <p class="note">The thrower webcam records only while a game is on the screen and keeps the last seconds in memory; nothing is saved. Plug webcams into a different USB controller from the Autodarts cameras.</p>`;
    layer.addEventListener("change", (ev) => {
      const key = ev.target.dataset.cs;
      if (key === "photo" || key === "replay") { s[key] = ev.target.value; this._saveCams(); this._syncReplay(); }
    });
    layer.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-cs]");
      if (!b || b.tagName === "SELECT") return;
      if (b.dataset.cs === "close") return this._closeCamSetup();
      if (b.dataset.cs === "on") {
        const k = b.dataset.value;
        s.replayOn = s.replayOn.includes(k) ? s.replayOn.filter((x) => x !== k) : [...s.replayOn, k];
      } else if (b.dataset.cs === "window") s.window = !s.window;
      else return;
      b.classList.toggle("on");
      this._saveCams();
    });
  }

  _closeCamSetup() {
    this._camSetup?.remove();
    this._camSetup = null;
  }

  // -- your own voice: record the caller's lines and the sound effects (a settings page) ---------
  _voiceLines(tab) {
    if (tab === "scores") return Array.from({ length: 181 }, (_, n) => [`score_${n}`, String(n), numberWords(n)]);
    if (tab === "names") {
      const names = [...new Set([...this._setup.players, ...this._knownPlayers()])].slice(0, 40);
      return names.map((n) => [nameKey(n), n, n]);
    }
    if (tab === "sfx") return EFFECTS.map((e) => [`sfx_${e}`, e === "180" ? "180" : e[0].toUpperCase() + e.slice(1), ""]);
    return CALLS.map((c) => [c, CALL_TEXT[c], CALL_TEXT[c]]);
  }

  _openVoice() {
    this._closeVoice();
    const layer = document.createElement("div");
    layer.className = "booth-layer voice-layer";
    this._stage.appendChild(layer);
    this._voicePage = { layer, tab: "calls", rec: null, walk: false };
    layer.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-vc]");
      if (b && !b.disabled) this._voiceAct(b.dataset.vc, b.dataset.value);
    });
    layer.addEventListener("change", (ev) => {
      if (ev.target.dataset.vc === "import" && ev.target.files?.[0]) this._voiceImport(ev.target.files[0]);
    });
    this._renderVoice();
  }

  _closeVoice() {
    this._voiceStop();
    this._voicePage?.layer.remove();
    this._voicePage = null;
  }

  _renderVoice() {
    const vp = this._voicePage;
    if (!vp) return;
    const tabs = [["calls", "Calls"], ["scores", "Scores 0–180"], ["names", "Names"], ["sfx", "Sound effects"]];
    const lines = this._voiceLines(vp.tab), rec = vp.rec, store = this._voice;
    const done = lines.filter(([k]) => store.has(k)).length;
    const row = ([key, label, words]) => `
      <div class="vc-row ${store.has(key) ? "own" : ""} ${rec?.name === key ? "busy" : ""}">
        <span class="vc-label"><b>${esc(label)}</b>${words && words !== label ? `<small>${esc(words)}</small>` : ""}</span>
        <span class="vc-state">${store.has(key) ? "Your recording" : "Default"}</span>
        <button class="mini" data-vc="play" data-value="${esc(key)}" title="Play">▶</button>
        <button class="mini rec" data-vc="rec" data-value="${esc(key)}" title="Record" ${rec ? "disabled" : ""}>● Record</button>
        ${store.has(key) ? `<button class="mini" data-vc="default" data-value="${esc(key)}">Use default</button>` : ""}
      </div>`;
    const grid = vp.tab === "scores"
      ? `<div class="vc-grid">${lines.map(([k, l]) => `<button class="vc-chip ${store.has(k) ? "own" : ""} ${rec?.name === k ? "busy" : ""}" data-vc="pick" data-value="${k}">${l}</button>`).join("")}</div>
         ${vp.pick ? row(lines.find(([k]) => k === vp.pick) || lines[0]) : ""}`
      : lines.map(row).join("") || `<p class="note">Add players in the lobby to record their names.</p>`;
    const status = !rec ? "" : rec.phase === "count" ? `<div class="vc-rec">Get ready: <b>${rec.n}</b></div>`
      : rec.phase === "rec" ? `<div class="vc-rec live">Speak now: <b>${esc(rec.label)}</b><button class="big" data-vc="stop">Stop</button></div>`
      : rec.phase === "review" ? `<div class="vc-rec">${rec.empty ? "Nothing heard: try again, a little louder." : `Recorded <b>${esc(rec.label)}</b>`}
          <button class="big" data-vc="hear">▶ Hear it</button>${rec.empty ? "" : `<button class="primary big" data-vc="keep">Keep</button>`}<button class="big" data-vc="retake">Retake</button><button class="ghost" data-vc="cancel">Cancel</button></div>` : "";
    vp.layer.innerHTML = `<div class="pad-back" data-vc="close"></div>
      <div class="booth voice">
        <div class="pad-head"><b>Your voice</b><button class="ghost icon" data-vc="close" title="Close">✕</button></div>
        <div class="seg vc-tabs">${tabs.map(([k, l]) => `<button data-vc="tab" data-value="${k}" class="${vp.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <p class="note">Record with the webcam's microphone: ● counts down, you speak, the silence is cut off. ${done} of ${lines.length} recorded here. Browsers allow the microphone only on https or on localhost.</p>
        ${vp.tab === "scores" ? `<div class="toggles"><button class="toggle-btn" data-vc="walk" ${rec ? "disabled" : ""}>Record the numbers one by one…</button></div>` : ""}
        ${status}
        <div class="vc-list">${grid}</div>
        <div class="vc-foot">
          <button class="mini wide" data-vc="export" ${store.blobs.size ? "" : "disabled"}>Export (zip)</button>
          <label class="mini wide vc-import">Import…<input type="file" accept=".zip,application/zip" data-vc="import" hidden></label>
          <span class="note">The zip holds a WAV file per line: import it on another screen, or unzip it into config/www/darts/voice/ for voice_path.</span>
        </div>
      </div>`;
  }

  async _voiceAct(act, value) {
    const vp = this._voicePage, store = this._voice;
    if (!vp) return;
    const label = (k) => (this._voiceLines(vp.tab).find(([x]) => x === k) || [k, k])[1];
    switch (act) {
      case "close": return this._closeVoice();
      case "tab": vp.tab = value; vp.pick = null; break;
      case "pick": vp.pick = value; break;
      case "play": {
        if (value.startsWith("sfx_")) { this._sfx.unlock(); this._sfx.play(value.slice(4)); break; }
        const words = (this._voiceLines(vp.tab).find(([k]) => k === value) || [])[2] || label(value);
        this._caller.stop();
        this._caller.say([value, words]);
        break;
      }
      case "default": await store.del(value); break;
      case "rec": vp.walk = false; return this._voiceRecord(value, label(value));
      case "walk": {
        vp.walk = true;
        const first = Array.from({ length: 181 }, (_, n) => `score_${n}`).find((k) => !store.has(k)) || "score_0";
        return this._voiceRecord(first, first.slice(6));
      }
      case "stop": if (vp.rec?.recorder?.state === "recording") vp.rec.recorder.stop(); return;
      case "hear": if (vp.rec?.url) try { new Audio(vp.rec.url).play()?.catch?.(() => {}); } catch { /* no audio */ } return;
      case "retake": { const r = vp.rec; this._voiceStop(); return this._voiceRecord(r.name, r.label); }
      case "cancel": this._voiceStop(); vp.walk = false; break;
      case "keep": {
        const r = vp.rec;
        await store.put(r.name, r.blob);
        this._voiceStop();
        const n = Number(r.name.slice(6));
        if (vp.walk && r.name.startsWith("score_") && n < 180) return this._voiceRecord(`score_${n + 1}`, String(n + 1));
        vp.walk = false;
        break;
      }
      case "export": return this._voiceExport();
      default: return;
    }
    this._renderVoice();
  }

  // Count down, record until Stop (or 4 s), cut the silence off both ends, and offer it back.
  async _voiceRecord(name, label) {
    const vp = this._voicePage;
    if (!vp) return;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      this._toast("No microphone here: the browser allows it only on https or on localhost");
      return;
    }
    const rec = (vp.rec = { name, label, phase: "count", n: 3, stream });
    for (let n = 3; n > 0; n--) {
      rec.n = n;
      this._renderVoice();
      await new Promise((r) => setTimeout(r, this._voiceBeat ?? 700));
      if (vp.rec !== rec) return;
    }
    const chunks = [];
    const recorder = (rec.recorder = new MediaRecorder(stream));
    recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (vp.rec !== rec) return;
      try {
        const raw = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audio = await ctx.decodeAudioData(await raw.arrayBuffer());
        const trimmed = trimSilence(audio.getChannelData(0), audio.sampleRate);
        ctx.close?.();
        rec.empty = trimmed.length < audio.sampleRate * 0.08;
        rec.blob = new Blob([encodeWav(trimmed, audio.sampleRate)], { type: "audio/wav" });
        rec.url = URL.createObjectURL(rec.blob);
      } catch {
        rec.empty = true;
      }
      rec.phase = "review";
      this._renderVoice();
    };
    rec.phase = "rec";
    recorder.start();
    this._renderVoice();
    rec.timer = setTimeout(() => recorder.state === "recording" && recorder.stop(), 4000);
  }

  _voiceStop() {
    const rec = this._voicePage?.rec;
    if (!rec) return;
    clearTimeout(rec.timer);
    this._voicePage.rec = null;
    try { if (rec.recorder?.state === "recording") rec.recorder.stop(); } catch { /* stopped */ }
    rec.stream?.getTracks().forEach((t) => t.stop());
    if (rec.url) try { URL.revokeObjectURL(rec.url); } catch { /* gone */ }
  }

  async _voiceExport() {
    const files = [];
    for (const [name, blob] of this._voice.blobs) files.push({ name: `${name}.wav`, data: new Uint8Array(await blob.arrayBuffer()) });
    const url = URL.createObjectURL(new Blob([zipFiles(files)], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "darts-voice.zip";
    this._stage.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async _voiceImport(file) {
    let n = 0;
    try {
      for (const f of unzipFiles(new Uint8Array(await file.arrayBuffer()))) {
        const name = f.name.replace(/^.*\//, "").replace(/\.(wav|mp3)$/i, "");
        if (!/^[a-z0-9_]+$/.test(name)) continue;
        await this._voice.put(name, new Blob([f.data], { type: /\.mp3$/i.test(f.name) ? "audio/mpeg" : "audio/wav" }));
        n += 1;
      }
    } catch { /* not a zip of recordings */ }
    this._toast(n ? `${n} recordings imported` : "No recordings in that file");
    this._renderVoice();
  }

  _pc(i) {
    return this._colors[Math.max(i, 0) % this._colors.length];
  }

  // Marks per round: marks that closed or scored, per three darts thrown.
  _mpr(p) {
    return p.darts ? ((p.markTotal || 0) * 3 / p.darts).toFixed(2) : "0.00";
  }

  // Whose turn it is and how many darts are left: shown on the thrower's card.
  // Seconds after the third dart before Wild Mouse moves on by itself; 0 waits for the takeout.
  _autoNextS() {
    return Number(this._setup.autoNext ?? this._config.auto_next ?? 0) || 0;
  }

  // Wild Mouse moves to the next player a few seconds after the third dart, for boards whose
  // takeout is not seen reliably. due: the visit is complete; key: the visit, so any change
  // to it starts the wait again; go: moves on.
  _autoNext(due, key, go) {
    const secs = this._autoNextS();
    key = due && secs > 0 ? key : null;
    if (key === this._autoKey) return;
    clearTimeout(this._autoTimer);
    this._autoKey = key;
    this._autoTimer = null;
    if (!key) return;
    this._autoTimer = setTimeout(() => {
      if (this._autoKey !== key) return;
      this._autoKey = null;
      go();
    }, secs * 1000);
  }

  _autoNextLocal(wm) {
    const due = wm.visit.length >= 3 && wm.winner == null && wm.legWinner == null;
    this._autoNext(due, `wm:${wm.leg}:${wm.current}:${wm.history.length}:${wm.visit.map((d) => d.seg).join()}`, () => {
      if (this._wm !== wm) return;
      wm.next();
      wm.seen = this._boardThrows || 0; // darts still in the board are not thrown again
      this._saveWm();
      this._render();
    });
  }

  _turnTag(thrown, who = "") {
    const pips = [0, 1, 2].map((i) => `<i class="${i < thrown ? "used" : ""}"></i>`).join("");
    const auto = thrown >= 3 && this._autoKey ? this._autoNextS() : 0;
    const text = auto ? `Next player in ${auto} s` : thrown >= 3 ? "Pull your darts" : `${who ? esc(who) : "Throwing"} · dart ${thrown + 1} of 3`;
    return `<div class="turn-tag ${auto ? "auto" : ""}" style="${auto ? `--auto:${auto}s` : ""}"><span>${text}</span><span class="pips" aria-label="${3 - Math.min(thrown, 3)} darts left">${pips}</span></div>`;
  }

  // The end of a game: the winner big, then everybody ranked with their numbers.
  // rows: [{name, color, main, mainLabel, stats: [[label, value]]}], best first.
  // -- where the darts land: every player's darts of this leg -----------------------------------
  // For the heat on the drawn board, the grouping and the mini boards of the game shot screen.
  _gameKey() {
    const g = this._wm;
    if (g) return `${g.kind}|${g.seed ?? g.players.map((p) => p.name).join(",")}|${g.leg ?? 1}`;
    const a = this._st("sensor", "practice_remaining_score")?.attributes || {};
    return `${a.game || ""}|${(a.scores || []).map((p) => `${p.name}:${p.legs ?? 0}:${p.sets ?? 0}`).join(",")}`;
  }

  // Kept in the browser like the game itself, so a reload (Home Assistant restarting) keeps them.
  _stats() {
    const key = this._gameKey();
    if (this._st$?.key !== key) {
      const saved = load("stats", null);
      this._st$ = saved?.key === key && saved.spots && saved.trail ? saved : { key, spots: {}, trail: {}, visit: 0 };
    }
    return this._st$;
  }

  // New darts on the board belong to whoever is throwing; a takeout starts the next visit.
  _keepSpots(throws) {
    const before = this._boardThrows || 0, who = this._fxPrev?.turnName;
    if (!throws.length && before) { this._stats().visit += 1; save("stats", this._st$); return; }
    if (throws.length <= before || !who) return;
    const st = this._stats(), list = (st.spots[who] ??= []);
    for (const t of throws.slice(before)) {
      const c = t.coords;
      if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) list.push([Number(c.x.toFixed(3)), Number(c.y.toFixed(3)), st.visit]);
    }
    if (list.length > 300) list.splice(0, list.length - 300);
    save("stats", st);
  }

  // The thrower's earlier darts of the leg as faint dots on the drawn board (heat: false off).
  _heat(name) {
    if (this._config.heat === false || !name) return "";
    const st = this._stats();
    return (st.spots[name] || []).filter(([, , v]) => v !== st.visit).slice(-60)
      .map(([x, y]) => `<circle class="heat" cx="${x}" cy="${-y}" r="0.03"/>`).join("");
  }

  _spotsOf(name) {
    const members = this._wm?.players?.find((p) => p.name === name)?.members || [name];
    return members.flatMap((n) => this._stats().spots[n] || []);
  }

  // The integration's X01: the remaining after each visit, as it changes (an undo takes it back).
  _trackTrail(scores) {
    const st = this._stats();
    for (const p of scores) {
      const v = Number(p.remaining);
      if (!Number.isFinite(v)) continue;
      const t = (st.trail[p.name] ??= [v]), was = t.length;
      while (t.length > 1 && v > t.at(-1)) t.pop();
      if (v < t.at(-1)) t.push(v);
      if (t.length !== was) save("stats", st);
    }
  }

  // Moments for the gallery of the attract screen: 180s, big checkouts and game shots, with the
  // darts where the board saw them.
  _keepMoment(kind, name, value, visit, ctx) {
    if (!name) return;
    const list = load("moments", []);
    const darts = (this._lastThrows || []).slice(-3).filter((t) => t.coords).map((t) => ({ x: Number(t.coords.x.toFixed(3)), y: Number(t.coords.y.toFixed(3)) }));
    list.push({ kind, name, value, visit: visit.slice(-3), darts, game: ctx.game, color: ctx.color, at: Date.now() });
    save("moments", list.slice(-40));
  }

  // -- the attract screen between games ------------------------------------------------------
  _idleTick() {
    if (!this._stage || !this.isConnected) return;
    const secs = Number(this._config.idle ?? IDLE_S);
    if (this._idleOn) return this._renderIdle();
    if (!secs) return;
    const between = this._isLobby() || !!this._stage.querySelector(".gameshot");
    if (!between || this._pad || this._booth || this._sheet || this._camWall || this._replayView) return;
    if (Date.now() - (this._active || 0) < secs * 1000) return;
    this._idleOn = true;
    this._slide = 0;
    this._slideAt = Date.now();
    this._renderIdle();
  }

  _idleOff() {
    this._active = Date.now();
    if (!this._idleOn) return;
    this._idleOn = false;
    this._idleEl?.classList.remove("open");
    if (this._idleEl) this._idleEl.innerHTML = this._idleHtml = "";
  }

  // The slides beside the Top List: the board's personal bests, then the moment pictures.
  _idleSlides() {
    const slides = [];
    const pb = this._st("sensor", "personal_best")?.attributes || {};
    const bests = BEST_LABELS.filter(([k]) => pb[k] != null && pb[k] !== "" && Number(pb[k]) !== 0);
    if (bests.length) {
      slides.push(`<div class="idle-bests"><h2>Board records</h2>${bests.slice(0, 4).map(([k, l]) => `<div class="ib-row"><span>${esc(l)}</span><b>${esc(pb[k])}</b></div>`).join("")}
        ${pb.name && pb.record ? `<p class="ib-latest">Latest: ${esc(pb.name)}, ${esc((BEST_LABELS.find(([k]) => k === pb.record) || [0, pb.record])[1])} ${esc(pb.value ?? "")}</p>` : ""}</div>`);
    }
    const kinds = { 180: "180", checkout: "checkout", game_shot: "game shot" };
    for (const m of load("moments", []).slice(-6).reverse()) {
      const t = new Date(m.at), when = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
      slides.push(`<figure class="idle-moment saved" style="--pc:${esc(m.color || "#fcd34d")}">${boardSvg(m.visit || [], (m.darts || []).map((d) => ({ coords: d })))}<figcaption>${esc(m.name)} · ${esc(m.kind === "checkout" ? `${m.value} checkout` : kinds[m.kind] || m.kind)}<small>${esc(GAME_NAME[m.game] || "")} · ${when}</small></figcaption></figure>`);
    }
    const labels = { 180: "180!", game_shot: "Game shot", bull: "Bullseye", t20: "Treble 20", bounce_out: "Bounce out", miss: "Miss", ton: "Ton", ton40: "Ton forty", three_in_a_bed: "Three in a bed" };
    for (const [key, url] of Object.entries(this._config.moments || {})) {
      const safe = safeImage(url);
      if (safe) slides.push(`<figure class="idle-moment"><img src="${esc(safe)}" alt=""><figcaption>${esc(labels[key] || key.replace(/_/g, " "))}</figcaption></figure>`);
    }
    return slides;
  }

  _renderIdle() {
    if (!this._idleEl) return;
    const slides = this._idleSlides();
    if (Date.now() - (this._slideAt || 0) > 8000) { this._slide = (this._slide || 0) + 1; this._slideAt = Date.now(); }
    const slide = slides.length ? slides[(this._slide || 0) % slides.length] : "";
    const now = new Date(), clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const logo = safeImage(this._config.logo), bg = safeImage(this._config.hero) || safeImage(this._config.photo);
    const list = this._topList(8, true);
    const html = `
      ${bg ? `<div class="idle-bg" style="background-image:url('${esc(bg).replace(/'/g, "%27")}')"></div>` : ""}
      <div class="idle-top">${logo ? `<img class="idle-logo" src="${esc(logo)}" alt="">` : ""}<b>${esc(this._config.brand)}</b><span class="idle-clock">${clock}</span></div>
      <div class="idle-main ${slide ? "" : "solo"}">
        <section class="idle-list"><h2>Tonight's Top List</h2>${list || `<p class="idle-empty">No games yet tonight. Who throws first?</p>`}</section>
        ${slide ? `<section class="idle-slide">${slide}</section>` : ""}
      </div>
      <div class="idle-cta">Throw a dart or tap the screen to play</div>`;
    if (html !== this._idleHtml || !this._idleEl.classList.contains("open")) this._idleEl.innerHTML = this._idleHtml = html;
    this._idleEl.classList.add("open");
  }

  // -- the session: tonight's Top List ------------------------------------------------------
  _session() {
    let s = this._sess ?? load("session", null);
    const gap = (Number(this._config.session_gap_h) || SESSION_GAP_H) * 3600e3;
    if (!s || !Array.isArray(s.games) || Date.now() - (s.last || 0) > gap) s = { started: Date.now(), last: Date.now(), games: [], lastKey: null };
    return (this._sess = s);
  }

  _saveSession() {
    save("session", this._sess);
  }

  // A finished game counts once, when its game shot screen first shows (also after a reload);
  // games of one player are training and do not count.
  _trackResult() {
    const s = this._session(), o = this._overNow;
    if (!o) {
      this._hlPhoto = null;
      if (s.lastKey) { s.lastKey = null; this._saveSession(); }
      return;
    }
    const game = this._currentGame() || "";
    const key = [game, o.names.join(","), o.winners.join(","), this._wm?.seed ?? "", this._wm?.leg ?? ""].join("|");
    if (s.lastKey === key) return;
    s.lastKey = key;
    this._watchHighlight();
    // Sudden death decides the dead heat it was played for: its winner takes that game.
    if (this._wm?.kind === "bull_off") {
      const e = s.games.find((x) => x.key === this._wm.tiebreakFor), w = o.winners[0];
      if (e && e.names.includes(w)) {
        const k = e.names.indexOf(w);
        e.names.unshift(...e.names.splice(k, 1));
        if (e.members) e.members.unshift(...e.members.splice(k, 1));
        e.winners = [w];
      }
      return this._saveSession();
    }
    if (o.names.length > 1) {
      const members = o.names.map((n) => this._wm?.players?.find((p) => p.name === n)?.members || [n]);
      s.games.push({ at: Date.now(), game, names: o.names, winners: o.winners, members, key });
      s.last = Date.now();
    }
    this._saveSession();
  }

  // Undo on the game shot screen: the game is not over after all.
  _untrackResult() {
    const s = this._session();
    if (this._wm?.kind === "bull_off") {
      const e = s.games.find((x) => x.key === this._wm.tiebreakFor);
      if (e) { e.winners = this._wm.players.map((p) => p.name); this._saveSession(); }
      return;
    }
    if (s.lastKey && s.games.at(-1)?.key === s.lastKey) { s.games.pop(); this._saveSession(); }
  }

  // The end of the night: the champion, the podium and who won every game.
  _renderTrophies() {
    const table = sessionTable(this._session().games), [champ, ...rest] = table;
    const idx = (n) => Math.max(0, this._setup.players.indexOf(n));
    const games = this._session().games.map((e) => `<li><span>${esc(GAME_NAME[e.game] || e.game || "Game")}</span><b>${esc((e.winners?.length ? e.winners : e.names.slice(0, 1)).join(" & "))}</b></li>`).join("");
    return `
      <div class="trophies" style="--pc:${this._pc(idx(champ.name))}">
        <div class="tr-label">Champion of the night</div>
        <div class="tr-champ">${this._avatar(champ.name, idx(champ.name), "xl")}<b>${esc(champ.name)}</b><span>${champ.pts} points · ${champ.wins} ${champ.wins === 1 ? "win" : "wins"}</span></div>
        ${rest.length ? `<div class="tr-podium">${rest.slice(0, 2).map((r, k) => `<div class="tr-place" style="--pc:${this._pc(idx(r.name))}"><i>${k + 2}</i>${this._avatar(r.name, idx(r.name))}<b>${esc(r.name)}</b><span>${r.pts} points</span></div>`).join("")}</div>` : ""}
        <ol class="tr-games">${games}</ol>
        <div class="gs-actions">
          ${this._config.notify ? `<button class="primary big" data-act="send-highlights">Send the highlights</button>` : ""}
          <button class="big" data-act="trophies-close">Back to the games</button>
          <button class="big ${this._confirmSession ? "danger" : ""}" data-act="new-session">${this._confirmSession ? "Tap again to clear" : "New session"}</button>
        </div>
      </div>`;
  }

  // The night in a few lines, for a Home Assistant notify service (notify: notify.mobile_app_x).
  _highlightsText() {
    const table = sessionTable(this._session().games);
    const games = this._session().games;
    return {
      title: `${this._config.brand}: ${table[0]?.name || "nobody"} wins the night`,
      message: [
        table.slice(0, 8).map((r, i) => `${i + 1}. ${r.name} ${r.pts} pts (${r.wins} ${r.wins === 1 ? "win" : "wins"})`).join("\n"),
        "",
        `${games.length} ${games.length === 1 ? "game" : "games"}: ${games.map((e) => `${GAME_NAME[e.game] || e.game} to ${(e.winners?.length ? e.winners : e.names.slice(0, 1)).join(" & ")}`).join("; ")}`,
      ].join("\n"),
    };
  }

  _topList(limit = 8, big = false) {
    const rows = sessionTable(this._session().games).slice(0, limit);
    if (!rows.length) return "";
    return `<ol class="toplist ${big ? "big" : ""}">${rows.map((r, i) => `
      <li style="--pc:${this._pc(Math.max(0, this._setup.players.indexOf(r.name)))}"><span class="tl-rank">${i + 1}</span>${this._avatar(r.name, Math.max(0, this._setup.players.indexOf(r.name)), "sm")}<span class="tl-name">${esc(r.name)}</span><span class="tl-wins">${r.wins} ${r.wins === 1 ? "win" : "wins"}</span><b class="tl-pts">${r.pts}</b></li>`).join("")}</ol>`;
  }

  // The smart-home buttons in the bar: lit while their entity is on.
  _homeButtons() {
    return homeButtons(this._config).map((b) => {
      const st = this._hass?.states?.[b.entity];
      const name = b.name || st?.attributes?.friendly_name || b.entity.split(".")[1].replace(/_/g, " ");
      const on = ["on", "playing", "open"].includes(st?.state);
      return `<button data-act="home" data-value="${esc(b.entity)}" class="ghost home ${on ? "on" : ""}" ${st?.state === "unavailable" ? "disabled" : ""}>${esc(name)}</button>`;
    }).join("");
  }

  // The integration's highlight photo, when its blueprint takes one: looked for in the media
  // browser's highlight gallery for 40 s after the game shot.
  _watchHighlight() {
    clearInterval(this._hlTimer);
    this._hlPhoto = null;
    if (this._config.highlight_photo === false || !this._hass?.callWS) return;
    const since = Date.now() - 15000;
    let tries = 0;
    const look = async () => {
      if (++tries > 14 || !this._stage?.querySelector(".gameshot")) return clearInterval(this._hlTimer);
      try {
        const d = new Date(), month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const res = await this._hass.callWS({ type: "media_source/browse_media", media_content_id: `media-source://autodarts/${month}` });
        const item = (res?.children || []).find((c) => photoTime(c.media_content_id) >= since);
        if (!item) return;
        clearInterval(this._hlTimer);
        const r = await this._hass.callWS({ type: "media_source/resolve_media", media_content_id: item.media_content_id });
        if (r?.url) { this._hlPhoto = r.url; this._render(); }
      } catch { /* no gallery (the blueprint is not in use): no photo */ }
    };
    this._hlTimer = setInterval(look, 3000);
    this._hlTimer?.unref?.();
  }

  // A player's darts of the leg on a mini board, with their grouping.
  _resSpots(r) {
    const spots = this._spotsOf(r.name);
    if (!spots.length) return "";
    const g = groupingMm(spots);
    return `<span class="res-heat">${miniBoard(spots, r.color)}${g != null ? `<span class="res-stat"><b>${g} mm</b><small>grouping</small></span>` : ""}</span>`;
  }

  // The score chart of an X01 game: Party X01 keeps its own trail, the integration's is watched.
  _chartHtml(rows) {
    const g = this._wm;
    let series = [], start = 501;
    if (g?.kind === "x01_party") {
      start = Number(g.opts.start) || 501;
      series = rows.map((r) => { const p = g.players.find((q) => q.name === r.name); const t = [...(p?.trail || [start])]; if (p && t.at(-1) !== p.rem) t.push(p.rem); return { name: r.name, values: t }; });
    } else if (!g) {
      const tr = this._stats().trail;
      series = rows.filter((r) => tr[r.name]?.length > 1).map((r) => ({ name: r.name, values: tr[r.name] }));
      start = Math.max(...series.map((x) => x.values[0]), 1);
    }
    if (!series.some((x) => x.values.length > 2)) return "";
    return `<div class="chart-wrap">${scoreChart(series, start, rows.map((r) => r.color))}<div class="chart-key">${series.map((x, k) => `<span style="--pc:${rows[k].color}">${esc(x.name)}</span>`).join("")}</div></div>`;
  }

  _resultScreen({ label = "Game shot", winner, winners, rows, undo = false, sudden = false }) {
    this._lastRanking = rows.map((r) => r.name);
    this._overNow = { names: rows.map((r) => r.name), winners: winners || [rows[0]?.name].filter(Boolean) };
    const mode = this._setup.rematch || "rotate";
    const orders = [["Next starts", "rotate"], ["Same order", "same"], ["Loser starts", "loser"], ["Winner stays on", "winner"]];
    const table = rows
      .map((r, i) => `
        <div class="res-row ${i === 0 ? "first" : ""}" style="--pc:${r.color}">
          <span class="res-rank">${i + 1}</span>
          ${r.avatar || ""}<span class="res-name">${esc(r.name)}</span>
          ${(r.stats || []).map(([l, v]) => `<span class="res-stat"><b>${esc(v)}</b><small>${esc(l)}</small></span>`).join("")}
          ${this._resSpots(r)}
          <span class="res-main"><b>${esc(r.main)}</b><small>${esc(r.mainLabel || "")}</small></span>
        </div>`)
      .join("");
    return `
      <div class="gameshot ${rows.length > 4 ? "many" : ""}" style="--pc:${rows[0]?.color || "#fcd34d"}">
        <div class="gs-label">${esc(label)}</div>
        <div class="gs-name">${esc(winner)}</div>
        ${this._hlPhoto ? `<img class="gs-photo" src="${esc(this._hlPhoto)}" alt="The board after the game shot">` : ""}
        ${this._chartHtml(rows)}
        <div class="res-table">${table}</div>
        <div class="gs-actions">
          ${sudden ? `<button class="primary big" data-act="sudden">Sudden death</button>` : ""}
          <button class="${sudden ? "" : "primary "}big" data-act="rematch">Rematch</button>
          <button class="big" data-act="new">New game</button>
        </div>
        ${rows.length > 1 ? `<div class="seg gs-order">${orders.map(([l, v]) => `<button data-act="rematch_order" data-value="${v}" class="${v === mode ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
        ${undo ? `<button class="ghost gs-undo" data-act="undo">↶ Wrong reading? Undo the last visit</button>` : ""}
      </div>`;
  }

  // Training games ("drills") keep their state on the target sensor: one thrower, a
  // target to hit next and the progress through the drill.
  _renderDrill(target, d) {
    this._pointsGame = false;
    this._autoNext(false);
    this._stage.classList.remove("cricket-mode");
    const game = d.drill || this._game();
    const visit = Array.isArray(d.visit) ? d.visit : [];
    const rate = d.hit_rate != null ? `${Math.round(Number(d.hit_rate) <= 1 ? d.hit_rate * 100 : d.hit_rate)}%` : "–";
    const pct = d.targets ? Math.min(100, Math.round(((d.progress || 0) / d.targets) * 100)) : 0;
    const name = this._setup.players[0] || "Training";
    this._info.innerHTML = `
      ${this._bar(GAME_NAME[game] || game, ["Training"])}
      <div class="players n1">
        <div class="player active drill" style="--pc:${this._pc(0)}">
          ${this._avatar(name, 0)}<div class="pname">${esc(name)}</div>
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
          <button data-act="next" class="primary">Next visit ${UI_ICON.next}</button>
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
    this._overlay = "";
    this._pointsGame = true;
    this._autoNextLocal(wm);
    const label = (t) => (t === 25 ? "Bull" : t === "D" ? "Dbl" : t === "T" ? "Trp" : t === "B" ? "3-Bed" : t);
    const legs = wm.legsToWin > 1;
    const cards = wm.players
      .map((p, i) => {
        const active = i === wm.current && wm.winner == null && wm.legWinner == null;
        return `
          <div class="player ${active ? "active" : ""} ${wm.winner === i || wm.legWinner === i ? "winner" : ""}" style="--pc:${this._pc(i)}">
            ${legs ? `<div class="legs"><span>${p.legs}<small>legs</small></span></div>` : ""}
            ${this._avatar(thrower(p), i)}<div class="pname">${esc(p.name)}${LEVEL_CHIP[p.level] || ""}</div>
            <div class="score">${p.points}</div>
            <div class="stats">${p.darts ? `MPR ${this._mpr(p)}` : ""}</div>
            ${active ? this._turnTag(wm.visit.length, p.members ? thrower(p) : "") : ""}
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
    const facts = [{ wild_mouse: "Cricket + doubles & triples", mickey_mouse: "20–12 + doubles, trebles & beds",
      cricket_light: `Numbers ${(wm.numbers || []).join(" ")}`, cut_throat_party: "Fewest points wins" }[wm.kind] || "Cricket"];
    if (wm.bed && wm.kind === "wild_mouse") facts.push("3 in a bed");
    if (legs) facts.push(`First to ${wm.legsToWin} legs · Leg ${wm.leg}`);
    const winner = wm.winner != null ? wm.players[wm.winner] : null;
    this._stage.classList.add("cricket-mode");
    this._info.innerHTML = `
      ${this._bar(GAME_NAME[wm.kind] || "Wild Mouse", facts)}
      <div class="players n${Math.min(wm.players.length, 4)} ${wm.players.length > 4 ? "many" : ""}">${cards}</div>
      ${chalkboard(
        wm.targets.map((t) => ({ key: t, label: label(t), extra: typeof t === "string", marks: wm.players.map((p) => p.marks[t]) })),
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
          <button data-act="next" class="primary">Next player ${UI_ICON.next}</button>
        </div>
      </div>
      ${winner ? this._resultScreen({
        winner: winner.name,
        undo: true,
        rows: wm.players
          .map((p, i) => ({ p, i }))
          .sort((a, b) => (b.i === wm.winner) - (a.i === wm.winner) || b.p.legs - a.p.legs || (wm.cutThroat ? a.p.points - b.p.points : b.p.points - a.p.points))
          .map(({ p, i }) => ({
            name: p.name, color: this._pc(i), avatar: this._avatar(p.name, i, "sm"), main: p.points, mainLabel: "points",
            stats: [...(legs ? [["legs", p.legs]] : []), ["MPR", this._mpr(p)], ["darts", p.darts || 0]],
          })),
      }) : ""}`;
    const last = wm.visit[wm.visit.length - 1];
    this._finishBoard(wm.visit.map((d) => d.seg), this._pc(wm.current), {
      game: wm.kind, kind: "wm", winner: winner?.name, match: legs, bed: !!wm.bedVisit, turn: wm.current,
      legs: wm.players.map((p) => p.legs).join(),
      closed: last && last.marks > 0 && wm.players[wm.current].marks[last.target] >= 3 ? last.target : null,
      shield: last && last.target == null ? wm._cands(last.seg)[0]?.t ?? null : null,
      turnName: thrower(wm.players[wm.current]), turnIndex: wm.current, players: wm.players.length,
    });
  }

  _renderLocal() {
    const g = this._wm;
    g._palette = this._colors;
    this._pointsGame = false;
    this._autoNext(g);
    const legs = g.legsToWin > 1;
    const over = g.winner != null;
    const cards = g.players.map((p, i) => {
      const active = i === g.current && !over && g.legWinner == null;
      return `
        <div class="player ${active ? "active" : ""} ${g.isWinner(i) || g.legWinner === i ? "winner" : ""} ${g.isOut(p) ? "out" : ""}" style="--pc:${this._pc(i)}">
          ${legs ? `<div class="legs"><span>${p.legs}<small>legs</small></span></div>` : ""}
          ${this._avatar(thrower(p), i)}<div class="pname">${esc(p.name)}${LEVEL_CHIP[p.level] || ""}</div>
          <div class="score">${esc(g.big(p))}</div>
          <div class="stats">${esc(g.sub(p))}</div>
          ${active ? this._turnTag(g.visit.length, p.members ? thrower(p) : "") : ""}
        </div>`;
    }).join("");
    const slots = this._slots(g.visit.map((d) => d.seg), (sg, i) => ({ text: g.visit[i].text, miss: !g.visit[i].good && !g.visit[i].points }), !over && g.legWinner == null);
    const total = g.visit.reduce((t, d) => t + (d.points || 0), 0);
    const tally = g.constructor.tally;
    const legName = g.legWinner != null ? g.players[g.legWinner].name : "";
    const banner = g.legWinner != null && !over ? `Leg to ${esc(legName)}: pull the darts for leg ${g.leg + 1}` : g.banner();
    this._overlay = g.overlay();
    const panel = g.panel();
    // A game with a board of its own (Ladder Rush, towers, lanes) gets the space:
    // one-line player cards, like the cricket games.
    this._stage.classList.toggle("cricket-mode", !!panel);
    // On a wide screen the board takes the whole left side; the dartboard, the darts of
    // the visit and the buttons share the right.
    this._stage.classList.toggle("board-mode", !!panel);
    const winners = over ? (g.winners || [g.winner]).map((i) => g.players[i].name) : [];
    this._info.innerHTML = `
      ${this._bar(GAME_NAME[g.kind] || g.kind, g.opts.maxRounds ? [`Round ${Math.min(g.round, g.opts.maxRounds)} of ${g.opts.maxRounds}`, ...g.facts()] : g.facts())}
      <div class="players n${Math.min(g.players.length, 4)} ${g.players.length > 4 ? "many" : ""}">${cards}</div>
      ${panel}
      <div class="turn ${tally ? "" : "no-total"}">
        ${tally ? `<div class="total">${total ? total : g.visit.length ? "0" : "–"}</div>` : ""}
        ${slots}
      </div>
      <div class="row">
        ${banner ? `<div class="banner">${banner}</div>` : "<div></div>"}
        <div class="actions">
          <button data-act="undo" ${g.history.length ? "" : "disabled"}>↶ Undo</button>
          <button data-act="next" class="primary">Next player ${UI_ICON.next}</button>
        </div>
      </div>
      ${over ? this._resultScreen({
        label: winners.length > 1 ? "Dead heat" : "Game shot",
        winner: winners.join(" & "),
        winners,
        sudden: winners.length > 1,
        undo: true,
        rows: g.results().map((r) => ({ name: g.players[r.i].name, color: this._pc(r.i), avatar: this._avatar(g.players[r.i].name, r.i, "sm"), main: r.main, mainLabel: r.mainLabel, stats: r.stats })),
      }) : ""}`;
    this._finishBoard(g.visit.map((d) => d.seg), this._pc(g.current), {
      game: g.kind, kind: "local", winner: winners.join(" & ") || undefined, match: legs, turn: g.current,
      // Party X01 gets the X01 calls: 180, ton plus, bust, you require.
      x01: g.kind === "x01_party", bust: g.kind === "x01_party" && !!g.stop && g.note === "Bust",
      event: g.visit.at(-1)?.event || null,
      remaining: g.me?.rem, requires: g.kind === "x01_party" && g.opts.doubleOut && !!checkoutRoute(g.me?.rem || 0),
      legs: g.players.map((p) => p.legs).join(), turnName: thrower(g.me), turnIndex: g.current, players: g.players.length,
    });
  }

  _renderGame() {
    this._stage.classList.remove("board-mode");
    if (this._wm) return CRICKET_KINDS[this._wm.kind] ? this._renderWildMouse() : this._renderLocal();
    this._overlay = "";
    const tgt = this._st("sensor", "practice_target");
    if (tgt?.attributes?.drill) return this._renderDrill(tgt.state, tgt.attributes);
    const a = this._st("sensor", "practice_remaining_score")?.attributes || {};
    const kind = X01.has(String(a.game)) ? "x01" : CRICKET.has(a.game) || a.game === "wild_mouse" ? "cricket" : "other";
    // The integration's Wild Mouse: its targets follow the numbers, and every dart says what it counted for.
    const wildMouse = a.game === "wild_mouse";
    const extraTargets = wildMouse && Array.isArray(a.targets) ? a.targets : [];
    this._pointsGame = kind !== "x01" && a.game !== "golf" && a.game !== "killer";
    const visit = Array.isArray(a.visit) ? a.visit : [];
    const visitTotal = visit.reduce((t, s) => t + segmentScore(s), 0);
    const checkout = this._st("sensor", "practice_checkout")?.state;
    const target = this._st("sensor", "practice_target")?.state;
    const scores = Array.isArray(a.scores) ? a.scores : [];
    const legsToWin = a.legs_to_win || 1;
    const setsToWin = a.sets_to_win || 1;
    const winner = a.winner != null ? scores.find((p) => p.player === a.winner) : null;
    if (kind === "x01") this._trackTrail(scores);
    this._autoNext(wildMouse && visit.length >= 3 && !winner, `ha:${a.player}:${a.round}:${scores.map((p) => `${p.sets ?? 0}.${p.legs ?? 0}`).join()}:${visit.join()}`,
      () => this._call("autodarts", "next_player"));

    const facts = [];
    if (wildMouse) facts.push("Cricket + doubles & triples");
    if (extraTargets.includes("bed")) facts.push("3 in a bed");
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
          ${this._avatar(p.name || `Player ${p.player}`, i)}<div class="pname">${esc(p.name || `Player ${p.player}`)}</div>
          <div class="score">${esc(big)}</div>
          <div class="stats">${esc(sub)}</div>
          ${active ? this._turnTag(visit.length) : ""}
          ${extra}
        </div>`;
    };
    const current = scores.findIndex((p) => p.player === a.player);

    const counted = Array.isArray(a.counted) ? a.counted : [];
    const slots = wildMouse
      ? this._slots(visit, (s, i) => {
        const t = counted[i];
        const name = t == null ? null : WM_LABEL[WM_TARGET[t] ?? t] || t;
        return { text: name == null ? "no score" : `→ ${name}`, miss: name == null };
      })
      : this._slots(visit);

    const hint =
      a.bust ? `<div class="banner bust">Bust</div>` :
      kind === "x01" && checkout && checkout !== "unknown" ? `<div class="banner">Checkout <b>${esc(checkout)}</b>${this._coach(scores.find((p) => p.player === a.player)?.remaining, checkout)}</div>` :
      a.phase === "choose" ? `<div class="banner">Throw to pick your number</div>` :
      wildMouse && a.bed ? `<div class="banner">Three in a bed!</div>` :
      kind !== "x01" && target && target !== "unknown" ? `<div class="banner">Aim for <b>${esc(target)}</b></div>` : "";

    const game = a.game || this._game();
    this._stage.classList.toggle("cricket-mode", kind === "cricket");
    const board = kind === "cricket"
      ? chalkboard(
        [...(a.numbers || []), ...extraTargets].map((n, i) => {
          const t = WM_TARGET[n];
          const label = n === 25 ? "Bull" : t === "D" ? "Dbl" : t === "T" ? "Trp" : t === "B" ? "3-Bed" : n;
          return { key: t ?? n, label, extra: !!t, marks: scores.map((p) => (p.marks || [])[i] || 0) };
        }),
        scores.map((p) => p.name || `Player ${p.player}`),
        winner ? -1 : current,
        this._colors,
      )
      : "";
    this._info.innerHTML = `
      ${this._bar(GAME_NAME[game] || game || "", facts)}
      <div class="players n${Math.min(scores.length, 4)} ${scores.length > 4 ? "many" : ""}">${scores.map(playerCard).join("")}</div>
      ${board}
      <div class="turn">
        <div class="total ${a.bust ? "bust" : ""}">${a.bust ? "Bust" : visitTotal}</div>
        ${slots}
      </div>
      <div class="row">
        ${hint || "<div></div>"}
        <div class="actions">
          <button data-act="undo" ${a.undo ? "" : "disabled"}>↶ Undo</button>
          <button data-act="next" class="primary">Next player ${UI_ICON.next}</button>
        </div>
      </div>
      ${winner ? this._resultScreen({ winner: winner.name, undo: !!a.undo, rows: this._resultRows(kind, a, scores) }) : ""}`;
    this._finishBoard(visit, this._pc(current), {
      game, kind, bust: !!a.bust, winner: winner?.name, match: legsToWin > 1 || setsToWin > 1, turn: a.player,
      turnName: scores[current]?.name, turnIndex: current, players: scores.length, legs: scores.map((p) => `${p.sets ?? 0}.${p.legs ?? 0}`).join(),
      remaining: scores[current]?.remaining, requires: !!checkout && checkout !== "unknown",
      shield: kind === "cricket" ? this._deadNumber(visit[visit.length - 1], a.numbers || [], scores) : null,
      bed: wildMouse && !!a.bed,
    });
  }

  _renderLobby() {
    if (this._trophies && this._session().games.length) return this._renderTrophies();
    this._trophies = false;
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
                ${s.players.length < minPlayers(id) ? `<span class="tile-badge dim">${minPlayers(id)}+ players</span>` : s.players.length > maxPlayers(id) && GAME_PLAYERS[id] ? `<span class="tile-badge dim">Max ${maxPlayers(id)}</span>` : s.players.length > MAX_PLAYERS_INTEGRATION ? (LOCAL_GAMES.has(id) ? `<span class="tile-badge">Up to ${MAX_PLAYERS} players</span>` : `<span class="tile-badge dim">Max ${maxPlayers(id)}</span>`) : id === "wild_mouse" ? `<span class="tile-badge">Up to ${MAX_PLAYERS} players</span>` : ""}
              </button>
              ${RULES[id] ? `<button class="info-btn" data-act="sheet" data-value="${id}" title="How to play ${esc(name)}" aria-label="How to play ${esc(name)}">i</button>` : ""}
            </div>`)
          .join("")}</div>
      </section>`).join("");

    const known = this._knownPlayers().filter((n) => !s.players.includes(n)).slice(0, 12);
    const max = maxPlayers(g);
    const guest = Array.from({ length: MAX_PLAYERS }, (_, i) => (i ? `Guest ${i + 1}` : "Guest")).find((n) => !s.players.includes(n));
    const teamsNow = LOCAL_GAMES.has(g) ? makeTeams(s.players, s.teams) : null;
    const teamOf = (n) => (teamsNow ? teamsNow.findIndex((t) => t.includes(n)) : -1);
    const levelOf = (n) => (s.levels || {})[n] || "regular";
    const players = `
      <ol class="plist ${s.players.length > 6 ? "compact" : ""}">${s.players
        .map((n, i) => `
          <li class="${!teamsNow && i >= max ? "over" : ""}" style="--pc:${this._pc(teamsNow ? teamOf(n) : i)}"><span class="pnum">${i + 1}</span>${this._avatar(n, i, "sm")}<span class="pn">${esc(n)}</span>
            ${teamsNow ? `<span class="team-tag">Team ${teamOf(n) + 1}</span>` : LOCAL_GAMES.has(g) ? `<button class="mini lvl ${levelOf(n)}" data-act="level" data-value="${i}" title="Throw line: tap to change">${(LEVELS.find(([, v]) => v === levelOf(n)) || LEVELS[0])[0]}</button>` : ""}
            <button class="mini" data-act="photo" data-value="${esc(n)}" title="Photo of ${esc(n)}" aria-label="Photo of ${esc(n)}"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
            ${i ? `<button class="mini" data-act="up-player" data-value="${i}" title="Move up">▲</button>` : ""}
            <button class="mini" data-act="remove-player" data-value="${i}" title="Remove">✕</button></li>`)
        .join("")}</ol>
      ${s.players.length > 2 ? `<div class="chips"><button class="chip" data-act="shuffle">⇄ Shuffle order</button><button class="chip" data-act="clear-players">Clear all</button></div>` : ""}
      ${s.players.length > max ? `<p class="note warn">${esc(GAME_NAME[g] || g)} plays up to ${max} players, the first ${max} in the list. Wild Mouse takes up to ${MAX_PLAYERS}.</p>` : ""}
      ${this._seats() < minPlayers(g) ? `<p class="note warn">${esc(GAME_NAME[g] || g)} is played by at least ${minPlayers(g)}: add a player.</p>` : ""}
      ${s.players.length < MAX_PLAYERS ? `
        <form class="addp"><input maxlength="20" placeholder="Add a player" enterkeyhint="done"><button class="mini wide">Add</button></form>
        ${known.length ? `<div class="chips">${known.map((n) => `<button class="chip" data-act="add-player" data-value="${esc(n)}">+ ${esc(n)}</button>`).join("")}</div>` : ""}
        <div class="chips">${guest ? `<button class="chip" data-act="add-player" data-value="${esc(guest)}">+ ${esc(guest)}</button>` : ""}</div>` : ""}`;

    const seg = (act, options, current) =>
      `<div class="seg">${options.map(([label, value]) => `<button data-act="${act}" data-value="${value}" class="${String(value) === String(current) ? "on" : ""}">${label}</button>`).join("")}</div>`;
    const toggle = (act, label, on) => `<button class="toggle ${on ? "on" : ""}" data-act="${act}"><i></i>${label}</button>`;

    let options = "";
    if (X01.has(g) || CRICKET.has(g) || g === "wild_mouse") {
      options += `<div class="opt"><label>Legs to win</label>${seg("legs", LEGS.map((n) => [n, n]), s.legs)}</div>`;
      // The card's own Wild Mouse has no bot.
      if (g !== "wild_mouse" || this._nativeWildMouse()) options += `<div class="opt"><label>Play the bot</label>${seg("bot", BOT_LEVELS, s.bot || 0)}</div>`;
    }
    if (X01.has(g)) options += `<div class="opt"><label>Rules</label><div class="toggles">${toggle("double_out", "Double out", s.double_out)}${toggle("double_in", "Double in", s.double_in)}</div></div>`;
    if (g === "golf") options += `<div class="opt"><label>Holes</label>${seg("holes", [["9", "9"], ["18", "18"]], s.holes)}</div>`;
    if (CRICKET_KINDS[g] || g === "x01_party") options += `<div class="opt"><label>Legs to win</label>${seg("legs", LEGS.map((n) => [n, n]), s.legs)}</div>`;
    if (g === "x01_party") {
      options += `<div class="opt"><label>Start score</label>${seg("start_score", [["301", 301], ["501", 501], ["701", 701]], s.start || 501)}</div>`;
      options += `<div class="opt"><label>Rules</label><div class="toggles">${toggle("double_out", "Double out", s.double_out !== false)}${toggle("double_in", "Double in", s.double_in)}</div></div>`;
    }
    if (g === "wild_mouse") {
      options += `<div class="opt"><label>Extra target</label><div class="toggles">${toggle("bed", "Three in a bed", s.bed)}</div></div>`;
      options += `<p class="note">Close 20–15, bull, 3 doubles and 3 triples. A double or triple on an open number counts for the number first.</p>`;
      const offered = (this._st("select", "practice_game")?.attributes?.options || []).includes("wild_mouse");
      if (offered && !this._nativeWildMouse()) options += `<p class="note">More than ${MAX_PLAYERS_INTEGRATION} players, or teams: this screen scores the game itself, without the bot and the statistics of Home Assistant.</p>`;
    }
    if (g === "moon_landing") options += `<div class="opt"><label>Landing</label><div class="toggles">${toggle("pro", "Pro: exactly zero", s.pro)}</div></div>`;
    if (g === "shanghai_party") {
      options += `<div class="opt"><label>Rounds</label>${seg("sh_rounds", [["1 to 7", 7], ["1 to 20", 20]], s.sh_rounds || 7)}</div>`;
      options += `<div class="opt"><label>Beginners</label><div class="toggles">${toggle("lite", "Lite: neighbours count", s.lite)}</div></div>`;
    }
    if (ROUND_CAP.has(g)) options += `<div class="opt"><label>Round limit</label>${seg("round_cap", [["None", 0], ["10", 10], ["15", 15], ["20", 20]], Number(s.round_cap) || 0)}</div>`;
    if (g === "killer_venue" || g === "fight") options += `<div class="opt"><label>Beginners</label><div class="toggles">${toggle("lite", "Lite: neighbours count", s.lite)}</div></div>`;
    if (g === "snakes") options += `<div class="opt"><label>Finish</label><div class="toggles">${toggle("exact", "Exact roll for 50", s.exact !== false)}</div></div>`;
    if (LOCAL_GAMES.has(g) && s.players.length >= 3) {
      options += `<div class="opt"><label>Teams</label>${seg("teams", [["Off", "off"], ["Pairs", "pairs"], ["Two teams", "two"], ["Auto", "auto"]], s.teams || "off")}</div>`;
      if (s.teams && s.teams !== "off") options += `<p class="note">Teams go in list order (Pairs: 1 and 2, 3 and 4; Two teams: first half against second). Shuffle for random teams. Auto plays pairs above six players.</p>`;
    }
    if (LOCAL_GAMES.has(g) && !makeTeams(s.players, s.teams) && Object.values(s.levels || {}).some((l) => l !== "regular")) {
      options += `<div class="opt"><label>Handicap</label><div class="toggles">${toggle("handicap", "Start bonus: rookies and regulars start ahead", s.handicap)}</div></div>`;
    }
    if (LOCAL_GAMES.has(g)) options += `<div class="opt"><label>Next player after three darts</label>${seg("auto_next", [["When darts are pulled", 0], ["3 s", 3], ["5 s", 5], ["10 s", 10]], this._autoNextS())}</div>`;
    if (TRAINING.has(g)) options += `<p class="note">Training game: best played alone.</p>`;

    return `
      <header class="bar">
        <div class="title">${safeImage(this._config.logo) ? `<img class="logo-head" src="${esc(safeImage(this._config.logo))}" alt="">` : ""}<span class="avatar"></span><span class="gname">${esc(this._config.brand)}</span><span class="fact">New game</span></div>
        <div class="bar-actions">
          ${this._statusPill()}
          ${running ? `<button data-act="close-lobby" class="ghost">Back to game</button>` : ""}
          ${this._homeButtons()}
          <button data-act="full" class="ghost icon" title="Full screen" aria-label="Full screen">${UI_ICON.full}</button>
        </div>
      </header>
      <div class="lobby-grid">
        <div class="games">
          ${safeImage(this._config.hero) ? `
            <div class="hero wide" style="background-image:url('${esc(safeImage(this._config.hero)).replace(/'/g, "%27")}');background-position:${esc(String(this._config.hero_position || "center 35%").replace(/[^a-z0-9% .-]/gi, ""))}"></div>` : this._config.photo ? `
            <div class="hero">
              <div class="hero-text"><b>${esc(this._config.brand)}</b><span>Pick a game, add the players, game on.</span></div>
            </div>` : ""}
          ${tiles}
        </div>
        <aside class="setup">
          ${this._session().games.length ? `<h3 class="tl-head">Tonight's Top List <span class="tl-btns"><button class="mini" data-act="trophies">Trophies</button><button class="mini ${this._confirmSession ? "danger" : ""}" data-act="new-session">${this._confirmSession ? "Tap again to clear" : "New session"}</button></span></h3>${this._topList(8)}` : ""}
          <h3>Players</h3>
          ${players}
          ${options ? `<h3>Options</h3>${options}` : ""}
          <button class="primary start" data-act="start" ${this._seats() < minPlayers(g) ? "disabled" : ""}>Start ${esc(GAME_NAME[g] || g)}</button>
          <div class="opt"><label>Rematch</label>${seg("rematch_order", [["Next starts", "rotate"], ["Same order", "same"], ["Loser starts", "loser"], ["Winner stays on", "winner"]], s.rematch || "rotate")}</div>
          <h3>Screen</h3>
          <div class="opt"><label>Look</label>${seg("theme", THEMES, this._theme)}</div>
          <div class="opt"><label>Cameras</label><div class="toggles"><button class="toggle-btn" data-act="cams">Set up webcams and replays…</button></div></div>
          <div class="opt"><label>Sound</label><div class="toggles">${toggle("sound", "Effects", this._soundOn)}${toggle("caller", "Caller", this._callerOn)}</div></div>
          <div class="opt"><label>Your voice</label><div class="toggles"><button class="toggle-btn" data-act="voice">Record the caller and the sounds…</button></div></div>
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
  .stage[data-theme="red"] {
    --glass: rgba(255, 255, 255, 0.045); --glass-2: rgba(255, 255, 255, 0.1); --line: rgba(239, 68, 68, 0.28);
    --panel: #170a0c; --ink: #1a0506; --overlay: rgba(10, 2, 3, 0.95); --glow: rgba(239, 68, 68, 0.5);
    --bg:
      radial-gradient(ellipse at 50% -25%, rgba(220, 38, 38, 0.38), transparent 55%),
      radial-gradient(ellipse at 100% 110%, rgba(220, 38, 38, 0.16), transparent 50%),
      #080405;
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
    .info { justify-content: safe center; }
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
  .player { container-type: inline-size; }
  .turn-tag {
    display: inline-flex; align-items: center; gap: 10px; margin-top: 8px; padding: 6px 14px; border-radius: 999px; white-space: nowrap; max-width: 100%;
    background: var(--pc); color: #fff; font-weight: 800; font-size: min(clamp(0.9rem, 2.2vh, 1.4rem), 5.2cqw); text-transform: uppercase; letter-spacing: 0.05em;
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
  .players.n3 .score, .players.n4 .score { font-size: clamp(44px, min(7vw, 11vh), 150px); }
  /* Three or four players: smaller cards, so everything fits on a TV. */
  .players.n3 .player, .players.n4 .player { padding: 8px 10px 10px; }
  .players.n3 .pav:not(.sm), .players.n4 .pav:not(.sm) { width: clamp(38px, 6.5vh, 80px); height: clamp(38px, 6.5vh, 80px); font-size: clamp(0.9rem, 2.2vh, 1.5rem); }
  .players.n3 .pname, .players.n4 .pname { font-size: clamp(0.95rem, 2.4vh, 1.7rem); }
  .players.n3 .stats, .players.n4 .stats { font-size: clamp(0.85rem, 2vh, 1.3rem); }
  /* A party of five or more: small cards for everybody, the thrower's card big. */
  .players.many { grid-template-columns: repeat(auto-fill, minmax(clamp(110px, 11vw, 170px), 1fr)); gap: 8px; }
  .players.many .player { padding: 8px 8px 10px; }
  .players.many .pname { font-size: clamp(0.85rem, 1.9vh, 1.2rem); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .players.many .score { font-size: clamp(30px, 5vh, 60px); }
  .players.many .stats { font-size: clamp(0.75rem, 1.6vh, 1rem); }
  .players.many .player.active { grid-column: span 2; grid-row: span 2; display: flex; flex-direction: column; justify-content: center; }
  .players.many .player.active .score { font-size: clamp(56px, 11vh, 130px); }
  .players.many .player.active .pname { font-size: clamp(1.1rem, 3vh, 2rem); }
  .players.many .turn-tag { font-size: clamp(0.75rem, 1.7vh, 1.05rem); padding: 4px 10px; }
  .players.many .pav { width: clamp(30px, 4.5vh, 48px); height: clamp(30px, 4.5vh, 48px); }
  .players.many .player.active .pav { width: clamp(56px, 9vh, 100px); height: clamp(56px, 9vh, 100px); }
  .players.many .legs { font-size: 1rem; top: 6px; right: 8px; }
  /* Cricket games with a party: one-line cards, so the chalkboard keeps the height. */
  .cricket-mode .players.many { grid-template-columns: repeat(auto-fill, minmax(clamp(120px, 10vw, 180px), 1fr)); gap: 6px; }
  .cricket-mode .players.many .player { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 6px; padding: 5px 8px; text-align: left; }
  .cricket-mode .players.many .player .pav { width: 28px; height: 28px; margin: 0; font-size: 0.7rem; border-width: 2px; }
  .cricket-mode .players.many .score { font-size: clamp(20px, 3.4vh, 38px); }
  .cricket-mode .players.many .stats, .cricket-mode .players.many .legs { display: none; }
  .cricket-mode .players.many .player.active { grid-row: auto; grid-column: span 2; display: grid; }
  .cricket-mode .players.many .player.active .pav { width: 36px; height: 36px; }
  .cricket-mode .players.many .player.active .score { font-size: clamp(26px, 4.4vh, 50px); }
  .cricket-mode .players.many .player.active .pname { font-size: clamp(0.95rem, 2.2vh, 1.4rem); }
  .cricket-mode .players.many .turn-tag { grid-column: 1 / -1; justify-self: start; margin-top: 2px; }
  .chalk { overflow: hidden; }
  .chalk.many .crow { grid-template-columns: clamp(64px, 9vh, 150px) repeat(var(--cols), minmax(0, 1fr)); }
  .chalk.many .mk { height: min(clamp(14px, min(3.4vh, calc(40vw / var(--cols))), 48px), calc(var(--rh) * 0.84)); stroke-width: 12; }
  .ico { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; vertical-align: middle; }
  .chalk.many .chead .cm span { font-size: clamp(0.6rem, 1.5vh, 1.2rem); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; padding: 0 2px; }

  /* Player pictures: a round photo in the player's colour, or their initials. */
  .pav {
    place-items: center; width: clamp(54px, 9vh, 110px); height: clamp(54px, 9vh, 110px); border-radius: 50%;
    object-fit: cover; border: 3px solid var(--pc); background: color-mix(in srgb, var(--pc) 35%, #111); flex: none;
    font-weight: 800; font-size: clamp(1rem, 3vh, 2rem); letter-spacing: 0.02em; margin: 0 auto 4px; display: block;
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.3), 0 0 22px color-mix(in srgb, var(--pc) 40%, transparent);
  }
  span.pav { display: grid; }
  .pav.sm { width: 34px; height: 34px; font-size: 0.8rem; margin: 0; border-width: 2px; box-shadow: none; }
  .cricket-mode .player .pav:not(.sm) { width: clamp(40px, 6vh, 70px); height: clamp(40px, 6vh, 70px); }
  .res-row .pav.sm { width: 44px; height: 44px; }

  /* Board camera window, camera wall, thrower replay, camera setup. */
  .camwin {
    position: absolute; left: 0; top: 0; width: clamp(160px, 16vw, 300px); aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; z-index: 2;
    background: #000; border: 2px solid var(--line); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); cursor: zoom-in;
  }
  .camwin[hidden] { display: none; }
  .camwin img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .camwin span { position: absolute; left: 8px; top: 6px; padding: 1px 8px; border-radius: 6px; background: #dc2626; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .camwall-layer, .replay-layer { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; }
  .camwall, .replay {
    position: relative; width: min(1500px, 96vw); padding: 16px; border-radius: 18px; background: var(--panel);
    border: 1px solid var(--line); box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; gap: 12px;
  }
  .replay-head { display: flex; align-items: center; gap: 14px; font-size: clamp(1.2rem, 3vh, 2rem); }
  .replay-head b { flex: 1; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
  .replay-speed { color: #fcd34d; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; font-size: 0.8em; }
  .replay video { width: 100%; max-height: 74vh; border-radius: 12px; background: #000; }
  .replay-layer.slow .replay { box-shadow: 0 0 0 3px #fcd34d, 0 24px 70px rgba(0, 0, 0, 0.6); }
  .replay-actions { display: flex; gap: 10px; justify-content: center; }
  .camwall-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
  .camwall-cam { position: relative; padding: 0; overflow: hidden; aspect-ratio: 16 / 9; border: 3px solid transparent; }
  .camwall-cam.on { border-color: var(--pc, #fff); }
  .camwall-cam img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .camwall-cam span { position: absolute; left: 10px; bottom: 8px; background: rgba(0, 0, 0, 0.6); padding: 2px 10px; border-radius: 6px; }
  .camsetup { width: min(720px, 94vw); }
  .camsetup-body { display: flex; flex-direction: column; gap: 14px; }
  .cs-row { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; opacity: 0.95; }
  .cs-row select { font: inherit; color: #fff; background: rgba(0, 0, 0, 0.35); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .toggle-btn { background: var(--glass); font-size: 0.95rem; }

  /* The photo booth. */
  .booth-layer { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; }
  .booth {
    position: relative; width: min(640px, 94vw); padding: 18px; border-radius: 18px; background: var(--panel);
    border: 1px solid var(--line); box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55); display: flex; flex-direction: column; gap: 14px;
  }
  .booth-view { position: relative; aspect-ratio: 1; width: min(460px, 80vw, 60vh); margin: 0 auto; border-radius: 50%; overflow: hidden; background: #000; border: 4px solid #fff; }
  .booth-view video, .booth-view .booth-shot { width: 100%; height: 100%; object-fit: cover; display: block; }
  .booth-view video { transform: scaleX(-1); }
  .booth-view [hidden] { display: none; }
  .booth-view.flash::after { content: ""; position: absolute; inset: 0; background: #fff; animation: flash 0.4s ease-out forwards; }
  @keyframes flash { to { opacity: 0; } }
  .booth-count { position: absolute; inset: 0; display: grid; place-items: center; font-size: 160px; font-weight: 900; text-shadow: 0 0 30px rgba(0, 0, 0, 0.8); pointer-events: none; }
  .booth-count.go { animation: slam 0.8s ease-out; }
  .booth-msg { position: absolute; inset: auto 12% 30%; text-align: center; font-weight: 600; line-height: 1.4; }
  .booth-msg[hidden] { display: none; }
  .booth-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; align-items: center; }
  .booth-actions [hidden] { display: none; }
  .file-btn { font-weight: 600; cursor: pointer; border-radius: 10px; background: var(--glass-2); border: 1px solid var(--line); font-size: 1.1rem; padding: 14px 22px; }
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
    flex: 1 1 auto; min-height: calc(var(--rows, 7) * 17px); display: grid; grid-auto-rows: minmax(0, 1fr); gap: 3px;
    background: rgba(0, 0, 0, 0.22); border-radius: 14px; padding: 6px;
    /* Everything in a row scales with the row's height, whatever the number of targets. */
    container-type: size;
    --rh: calc((100cqh - 12px) / var(--rows, 7) - 3px);
  }
  .crow { display: grid; align-items: center; border-radius: 8px; min-height: 0; }
  .chalk.two .crow { grid-template-columns: 1fr clamp(90px, 13vh, 170px) 1fr; }
  .chalk.many .crow { grid-template-columns: clamp(90px, 13vh, 170px) repeat(var(--cols), 1fr); }
  .crow:nth-child(odd) { background: rgba(255, 255, 255, 0.04); }
  .clab {
    text-align: center; font-weight: 800; font-size: min(clamp(22px, 4.6vh, 54px), calc(var(--rh) * 0.74)); line-height: 1; font-variant-numeric: tabular-nums;
  }
  .clab.extra { color: #fcd34d; font-size: min(clamp(18px, 3.6vh, 42px), calc(var(--rh) * 0.62)); }
  .cm { height: 100%; display: grid; place-items: center; border-radius: 8px; min-height: 0; }
  .cm { --pc: #fff; }
  .cm.cur { background: color-mix(in srgb, var(--pc) 16%, transparent); }
  .chead .cm span { color: var(--pc); font-weight: 800; font-size: min(clamp(0.9rem, 2.2vh, 1.4rem), calc(var(--rh) * 0.5)); text-transform: uppercase; letter-spacing: 0.05em; }
  .mk { height: min(clamp(24px, 5.2vh, 60px), calc(var(--rh) * 0.84)); width: auto; stroke: color-mix(in srgb, var(--pc) 45%, #fff); stroke-width: 11; stroke-linecap: round; fill: none; }
  .mk.closed { stroke: var(--pc); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--pc) 70%, transparent)); }
  .crow.dead { opacity: 0.3; }
  /* Aim hints for the thrower, a shield when a dart hits a closed-out target. */
  .crow { position: relative; }
  .clab { position: relative; }
  .cm { position: relative; }
  .ctag {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 1px 8px; border-radius: 999px; font-size: min(clamp(0.55rem, 1.3vh, 0.8rem), calc(var(--rh) * 0.42));
    font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.5;
  }
  .ctag-score { background: #16a34a; color: #fff; }
  .ctag-close { background: #f59e0b; color: #1a1205; }
  .crow.hint-score { box-shadow: inset 0 0 0 2px rgba(34, 197, 94, 0.55); animation: hint 1.8s ease-in-out infinite; }
  .crow.hint-close { box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.55); }
  @keyframes hint { 50% { box-shadow: inset 0 0 0 2px rgba(34, 197, 94, 0.15); } }
  .chalk.many .ctag { display: none; }
  .crow.shielded { animation: shielded 1.5s ease-out; }
  @keyframes shielded { 0%, 60% { background: rgba(148, 163, 184, 0.35); } }
  .shield { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: clamp(22px, 4vh, 40px); animation: pop 0.3s ease-out; }
  .shield svg { width: 100%; fill: rgba(148, 163, 184, 0.9); stroke: #fff; stroke-width: 1.5; }
  /* Points just scored float up from the card. */
  .pts-badge {
    position: absolute; right: 10px; top: 8px; padding: 2px 10px; border-radius: 999px; background: var(--pc); color: #fff; font-weight: 900;
    font-size: clamp(1rem, 2.6vh, 1.6rem); animation: pts 1.8s ease-out forwards; pointer-events: none; box-shadow: 0 0 20px var(--pc);
  }
  @keyframes pts { 0% { opacity: 0; transform: translateY(10px) scale(0.6); } 15% { opacity: 1; transform: translateY(0) scale(1.1); } 70% { opacity: 1; } 100% { opacity: 0; transform: translateY(-30px); } }
  /* Wild Mouse counting down to the next player. */
  .turn-tag.auto { position: relative; overflow: hidden; }
  .turn-tag.auto::after { content: ""; position: absolute; left: 0; bottom: 0; height: 3px; background: #fff; animation: autonext var(--auto) linear forwards; }
  @keyframes autonext { from { width: 0; } to { width: 100%; } }
  @media (prefers-reduced-motion: reduce) { .crow.hint-score, .pts-badge { animation: none !important; } }
  .crow.dead .clab { text-decoration: line-through; text-decoration-thickness: 3px; }

  /* Cricket games: compact score cards, the chalkboard takes the height, the board a
     little less width. */
  .cricket-mode .info { justify-content: flex-start; }
  /* Cricket games for up to four: one-line cards (photo, name, score), so the chalkboard
     keeps its height. */
  .cricket-mode .players:not(.many) .player {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "av name score" "av stats score" "tag tag tag";
    align-items: center; column-gap: 12px; row-gap: 0; text-align: left; padding: 8px 14px;
  }
  .cricket-mode .players:not(.many) .pav { grid-area: av; width: clamp(40px, 7vh, 76px); height: clamp(40px, 7vh, 76px); margin: 0; font-size: clamp(0.9rem, 2.4vh, 1.6rem); }
  .cricket-mode .players:not(.many) .pname { grid-area: name; align-self: end; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cricket-mode .players:not(.many) .stats { grid-area: stats; align-self: start; min-height: 0; }
  .cricket-mode .players:not(.many) .score { grid-area: score; font-size: clamp(40px, 8.5vh, 110px); }
  .cricket-mode .players:not(.many) .turn-tag { grid-area: tag; justify-self: start; margin-top: 6px; }
  .cricket-mode .players:not(.many) .legs { position: static; grid-area: stats; justify-self: end; font-size: 1rem; }
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
  /* Panels of the card-scored games: towers, landers, glasses, races, target strips, the
     Ladder Rush board, derby lanes. They take the height the chalkboard takes in cricket. */
  .gpanel {
    flex: 1 1 0; min-height: clamp(120px, 26vh, 320px); display: flex; gap: 10px; padding: 10px; border-radius: 14px;
    background: rgba(0, 0, 0, 0.22); overflow: hidden;
  }
  .player.out { opacity: 0.3 !important; filter: grayscale(1); }
  .player.out .score { text-decoration: line-through; text-decoration-thickness: 4px; }
  .towers, .lanes, .glasses { justify-content: center; align-items: stretch; }
  .tower, .lane, .glass { flex: 1 1 0; max-width: 130px; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .tower b, .lane b { font-size: clamp(1rem, 2.6vh, 1.8rem); font-weight: 900; font-variant-numeric: tabular-nums; }
  .tower small, .lane small, .glass small { opacity: 0.8; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
  .tower.cur b, .lane.cur b, .glass.cur small { color: var(--pc); }
  .tower-stack { flex: 1 1 0; min-height: 0; width: 70%; display: flex; flex-direction: column; gap: 2px; }
  .tower-stack i { flex: 1 1 0; min-height: 2px; border-radius: 3px; background: rgba(255, 255, 255, 0.06); }
  .tower-stack i.on { background: var(--pc); box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.25); }
  .sky { position: relative; flex: 1 1 0; min-height: 0; width: 64%; border-radius: 10px 10px 0 0; background: linear-gradient(#050816, #1e1b4b); overflow: hidden; }
  .lander { position: absolute; left: 50%; bottom: calc(var(--h) * 82% + 2%); transform: translateX(-50%) rotate(180deg); font-size: clamp(18px, 3.6vh, 36px); transition: bottom 0.8s ease-out; }
  .moon { width: 80%; height: 12px; border-radius: 50% 50% 0 0; background: #cbd5e1; }
  .beer { position: relative; flex: 1 1 0; min-height: 0; width: 64%; border: 3px solid rgba(255, 255, 255, 0.55); border-top: none; border-radius: 0 0 16px 16px; overflow: hidden; }
  .beer i { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--f) * 100%); background: linear-gradient(#fde68a, #f59e0b 30%, #b45309); transition: height 0.8s ease-out; }
  .beer i::before { content: ""; position: absolute; left: 0; right: 0; top: -8px; height: 10px; background: #fffbeb; border-radius: 6px; }
  .race, .seqs, .derby { flex-direction: column; justify-content: center; gap: 6px; }
  .race-lane { display: grid; grid-template-columns: minmax(70px, 22%) 1fr; align-items: center; gap: 10px; }
  .race-name, .seq-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .race-lane.cur .race-name, .seq.cur .seq-name { color: var(--pc); }
  .race-track { height: clamp(12px, 2.4vh, 26px); border-radius: 999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
  .race-track i { display: block; height: 100%; width: calc(var(--f) * 100%); background: var(--pc); border-radius: inherit; transition: width 0.6s; }
  .race-lane.out, .seq.out { opacity: 0.35; }
  .seq { display: grid; grid-template-columns: minmax(64px, 16%) repeat(auto-fit, minmax(0, 1fr)); gap: 3px; align-items: center; }
  .seq i { font-style: normal; text-align: center; font-size: clamp(0.55rem, 1.4vh, 0.9rem); font-weight: 700; padding: 4px 0; border-radius: 6px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
  .seq i.done { background: var(--pc); color: #fff; }
  .seq i.next { background: color-mix(in srgb, var(--pc) 30%, transparent); box-shadow: inset 0 0 0 2px var(--pc); }
  .hilo { justify-content: center; align-items: center; flex-wrap: wrap; }
  .sl { justify-content: center; align-items: center; padding: 6px; min-height: clamp(200px, 38vh, 520px); }
  .slboard { width: 100%; height: 100%; }
  .slboard rect.a { fill: rgba(255, 255, 255, 0.05); }
  .slboard rect.b { fill: rgba(255, 255, 255, 0.11); }
  .slboard .sqn { font-size: 2.2px; fill: rgba(255, 255, 255, 0.55); font-weight: 700; }
  .slboard .ladder line { stroke: #4ade80; stroke-width: 0.7; stroke-linecap: round; }
  .slboard rect.home { fill: rgba(252, 211, 77, 0.35); }
  .slboard .snake path { stroke: #ef4444; stroke-width: 1.3; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .slboard .snake circle { fill: #ef4444; }
  .slboard .token circle { stroke: #0b0d14; stroke-width: 0.4; }
  .slboard .token.cur circle { stroke: #fff; stroke-width: 0.7; }
  .slboard .token text { font-size: 2.4px; fill: #fff; font-weight: 900; text-anchor: middle; dominant-baseline: central; }
  .derby-lane { display: grid; grid-template-columns: clamp(34px, 5vh, 56px) 1fr 28px; align-items: center; gap: 8px; }
  .derby-no { font-weight: 900; font-size: clamp(1.1rem, 3vh, 2rem); color: var(--pc); text-align: center; }
  .derby-track { position: relative; display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; height: clamp(22px, 4vh, 44px); }
  .derby-track i { background: rgba(255, 255, 255, 0.06); border-radius: 4px; }
  .derby-lane.cur .derby-track { box-shadow: 0 0 0 2px var(--pc); border-radius: 6px; }
  .racer { position: absolute; top: 50%; left: calc(var(--f) * (100% - 1.4em)); transform: translateY(-50%) scaleX(-1); font-size: clamp(18px, 3.4vh, 36px); transition: left 0.6s ease-out; }
  .board .sector { pointer-events: none; }
  .board .target .t3 { fill: rgba(45, 212, 191, 0.16); stroke: #2dd4bf; stroke-width: 0.008; }
  .board .target .t2 { fill: rgba(45, 212, 191, 0.3); }
  .board .target .t1 { fill: #2dd4bf; }
  .board .target text { font-size: 0.07px; fill: #0b1020; font-weight: 900; text-anchor: middle; dominant-baseline: central; }
  /* Responsive: the title never wraps over the cards; compact cards, panels and strips size
     their text to the space they have (container queries), from a 720p TV to a 4K one. */
  .bar .title { flex-wrap: nowrap; min-width: 0; overflow: hidden; }
  .bar .gname { white-space: nowrap; }
  .bar .fact { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .bar .fact + .fact { flex-shrink: 3; }
  .bar-actions { flex-wrap: nowrap; flex-shrink: 0; }
  @media (max-width: 1400px) and (min-aspect-ratio: 5/4) { .bar .fact + .fact { display: none; } }
  @media (max-width: 1150px) and (min-aspect-ratio: 5/4) { .bar .fact { display: none; } }
  .cricket-mode .players:not(.many) .pname { font-size: min(clamp(1rem, 2.6vh, 1.8rem), 11cqw); }
  .cricket-mode .players:not(.many) .stats { font-size: min(clamp(0.85rem, 2vh, 1.3rem), 8cqw); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cricket-mode .players:not(.many) .score { font-size: min(clamp(40px, 8.5vh, 110px), 30cqw); }
  .cricket-mode .players:not(.many) .pav { width: min(clamp(40px, 7vh, 76px), 22cqw); height: min(clamp(40px, 7vh, 76px), 22cqw); }
  .cricket-mode .players.n3 .player, .cricket-mode .players.n4 .player { column-gap: 8px; padding: 6px 10px; }
  .cricket-mode .players:not(.many) .turn-tag { font-size: min(clamp(0.8rem, 1.9vh, 1.2rem), 5.4cqw); }
  .gpanel { container-type: size; }
  .seq { grid-template-columns: minmax(64px, 14%) repeat(auto-fit, minmax(0, 1fr)); gap: 0.6cqw; }
  .seqs .seq i { font-size: clamp(0.7rem, min(2.6cqw, 22cqh / var(--n, 1)), 2.2rem); padding: min(1.4cqh, 14px) 0; border-radius: 8px; }
  .seqs .seq-name { font-size: clamp(0.8rem, min(2.4cqw, 20cqh / var(--n, 1)), 1.8rem); }
  .race-name { font-size: clamp(0.85rem, min(3cqw, 26cqh / var(--n, 1)), 2rem); }
  .race-track { height: clamp(12px, 40cqh / var(--n, 1), 44px); }
  .derby-no { font-size: clamp(1rem, min(4cqw, 34cqh / var(--n, 1)), 2.6rem); }
  .derby-track { height: clamp(20px, 48cqh / var(--n, 1), 64px); }
  .racer { font-size: clamp(16px, 40cqh / var(--n, 1), 52px); }
  .tower b, .lane b { font-size: clamp(1rem, min(6cqw, 10cqh), 2.6rem); }
  .tower small, .lane small, .glass small { font-size: clamp(0.75rem, min(3.4cqw, 7cqh), 1.4rem); }
  .hilo button { font-size: clamp(1rem, 4cqh, 1.8rem); }
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
  /* Moment pictures: a square image slammed in over the screen, glowing in the thrower's colour. */
  .moment { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(circle, color-mix(in srgb, var(--pc) 30%, transparent), rgba(0, 0, 0, 0.7) 70%); animation: cel 2.2s ease-out forwards; }
  .moment img {
    width: min(78vh, 86vw); height: min(78vh, 86vw); object-fit: cover; border-radius: 22px;
    box-shadow: 0 0 0 4px var(--pc), 0 0 80px color-mix(in srgb, var(--pc) 70%, transparent), 0 30px 90px rgba(0, 0, 0, 0.7);
    animation: moment-in 2.2s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards;
  }
  .moment.m-game_shot img { animation-duration: 3.2s; }
  @keyframes moment-in { 0% { transform: scale(0.4) rotate(-8deg); opacity: 0; } 14% { transform: scale(1.06) rotate(1deg); opacity: 1; } 24% { transform: scale(1) rotate(0); } 85% { opacity: 1; transform: scale(1.02); } 100% { opacity: 0; transform: scale(1.08); } }
  .logo-mark { position: absolute; right: 0; top: 0; width: clamp(64px, 10vh, 130px); height: auto; border-radius: 12px; opacity: 0.9; pointer-events: none; z-index: 1; }
  .logo-head { height: clamp(40px, 6vh, 64px); width: auto; border-radius: 10px; align-self: center; }
  .hero.wide { background-size: cover; background-repeat: no-repeat; height: clamp(200px, 32vh, 360px); }
  .hero.wide::after { display: none; }
  @media (prefers-reduced-motion: reduce) { .moment, .moment img { animation: none !important; } }
  .upnext {
    position: absolute; inset: 0; display: grid; place-items: center; animation: cel 2s ease-out forwards;
    background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--pc) 40%, transparent), rgba(0, 0, 0, 0.82) 65%);
  }
  .un-inner { display: flex; flex-direction: column; align-items: center; gap: 10px; animation: upnext 2s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards; }
  .un-inner small { font-size: clamp(1.2rem, 3.4vh, 2.4rem); font-weight: 800; letter-spacing: 0.4em; text-transform: uppercase; color: #fcd34d; }
  .un-inner b { font-size: clamp(64px, 15vh, 200px); font-weight: 900; line-height: 1; text-transform: uppercase; color: #fff; text-shadow: 0 0 50px var(--pc), 0 6px 30px rgba(0, 0, 0, 0.6); }
  .pav.xl { width: min(34vh, 320px); height: min(34vh, 320px); font-size: clamp(3rem, 12vh, 8rem); border-width: 6px; margin: 0; box-shadow: 0 0 0 6px rgba(0, 0, 0, 0.35), 0 0 80px var(--pc); }
  @keyframes upnext { 0% { transform: translateX(40vw); opacity: 0; } 16% { transform: translateX(-2vw); opacity: 1; } 24% { transform: translateX(0); } 84% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-30vw); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .upnext, .un-inner { animation: none !important; } }
  .banter {
    position: absolute; left: 50%; top: 14%; transform: translateX(-50%); max-width: 70vw; padding: 14px 26px; border-radius: 22px;
    background: #fff; color: #0b0d14; font-weight: 900; font-size: clamp(1.2rem, 3.6vh, 2.4rem); box-shadow: 0 0 0 4px var(--pc), 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: banter 2.8s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .banter::after { content: ""; position: absolute; left: 50%; bottom: -12px; border: 12px solid transparent; border-top-color: #fff; border-bottom: 0; transform: translateX(-50%); }
  @keyframes banter { 0% { opacity: 0; transform: translateX(-50%) scale(0.6) rotate(-4deg); } 12% { opacity: 1; transform: translateX(-50%) scale(1.05) rotate(1deg); } 20% { transform: translateX(-50%) scale(1) rotate(0); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-20px); } }
  @media (min-aspect-ratio: 5/4) { .banter { left: 78%; max-width: 38vw; } }
  .coach { margin-left: 14px; font-size: 0.75em; opacity: 0.8; white-space: nowrap; }
  .gs-order { justify-content: center; margin-top: 10px; }
  .intro-layer {
    position: fixed; inset: 0; z-index: 11; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4vh;
    background: radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.94) 70%); animation: cel 3.6s ease-out forwards; cursor: pointer;
  }
  .intro-game { display: flex; align-items: center; gap: 14px; font-size: clamp(1.4rem, 4vh, 2.6rem); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
  .intro-players { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 3vw; max-width: 92vw; }
  .intro-p { display: flex; flex-direction: column; align-items: center; gap: 10px; animation: introp 0.7s var(--d) cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
  .intro-p b { font-size: clamp(1.4rem, 4.5vh, 3.4rem); font-weight: 900; text-transform: uppercase; color: var(--pc); text-shadow: 0 0 30px var(--pc); }
  .intro-players:not(.two) .pav.xl { width: min(18vh, 170px); height: min(18vh, 170px); font-size: clamp(2rem, 6vh, 4rem); }
  .intro-vs { font-size: clamp(3rem, 12vh, 9rem); font-weight: 900; font-style: italic; color: #fcd34d; text-shadow: 0 0 40px rgba(252, 211, 77, 0.7); animation: slam 1s 0.3s both; }
  .intro-more { font-size: 2rem; font-weight: 900; opacity: 0.7; }
  .intro-h2h { font-size: clamp(1.1rem, 3vh, 2rem); opacity: 0.9; }
  .intro-h2h b { color: #fcd34d; margin-left: 10px; }
  .intro-go { font-size: clamp(2rem, 7vh, 5rem); font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase; animation: slam 1s 2.2s both; }
  @keyframes introp { from { opacity: 0; transform: translateY(40px) scale(0.8); } }
  @media (prefers-reduced-motion: reduce) { .banter, .intro-layer, .intro-p, .intro-vs, .intro-go { animation: none !important; } }
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
  .tile-badge { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; background: var(--accent); color: #0b0d14; }
  .tile-badge.dim { background: rgba(255, 255, 255, 0.15); color: #fff; }
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
  .plist li { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 10px; border-radius: 10px; background: var(--glass); border-left: 4px solid var(--pc, transparent); }
  .plist li.over { opacity: 0.45; }
  .plist.compact { max-height: 46vh; overflow: auto; }
  .plist.compact li { padding: 3px 4px 3px 8px; }
  .plist.compact .mini { padding: 4px 8px; }
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
  .note.warn { color: #fcd34d; opacity: 1; }
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

  /* Board games on a wide screen (Ladder Rush, strips, lanes, towers), read from the
     oche 2 m away: the game's own board takes the whole left side under the players; the
     dartboard, the darts of the visit and the buttons share a column on the right. */
  .uic { width: 1.2em; height: 1.2em; vertical-align: -0.22em; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  .turn.no-total { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .slot { min-width: 0; overflow: hidden; }
  .slot small { max-width: 92%; text-align: center; line-height: 1.1; }
  @media (min-aspect-ratio: 5/4) {
    .board-mode { --side: clamp(240px, min(27vw, 44vh), 520px); }
    .board-mode .game-screen {
      grid-template-columns: minmax(0, 1fr) var(--side);
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      grid-template-areas: "players board" "panel board" "panel turn" "panel row";
      column-gap: clamp(14px, 2vw, 32px); row-gap: 12px;
    }
    .board-mode .info { display: contents; }
    .board-mode .info > .players { grid-area: players; }
    .board-mode .info > .gpanel { grid-area: panel; min-height: 0; }
    .board-mode .info > .turn { grid-area: turn; container-type: inline-size; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .board-mode .info > .turn .total { grid-column: 1 / -1; height: auto; padding: 2px 0; font-size: clamp(24px, 4vh, 52px); }
    /* Slim player cards: name, photo and the one number that matters, so the board gets the height. */
    .board-mode .players:not(.many) .player { padding: 5px 12px 6px; }
    .board-mode .players:not(.many) .score { font-size: min(clamp(32px, 6vh, 84px), 30cqw); }
    .board-mode .players:not(.many) .pav { width: min(clamp(34px, 5.4vh, 60px), 20cqw); height: min(clamp(34px, 5.4vh, 60px), 20cqw); }
    .board-mode .players:not(.many) .pname { font-size: min(clamp(0.95rem, 2.3vh, 1.6rem), 11cqw); }
    .board-mode .players:not(.many) .stats { font-size: min(clamp(0.8rem, 1.8vh, 1.15rem), 8cqw); }
    .board-mode .players:not(.many) .turn-tag { margin-top: 3px; font-size: min(clamp(0.72rem, 1.6vh, 1rem), 5.4cqw); padding: 3px 10px; }
    .board-mode .info > .row { grid-area: row; flex-direction: column; align-items: stretch; flex-wrap: nowrap; gap: 8px; }
    .board-mode .boardwrap { grid-area: board; min-height: 0; }
    .board-mode .slot { height: clamp(56px, 10vh, 118px); }
    .board-mode .slot b { font-size: min(clamp(26px, 5.2vh, 64px), 11cqw); }
    .board-mode .slot small { font-size: min(clamp(0.9rem, 2.2vh, 1.5rem), 5.2cqw); }
    .board-mode .slot .edit { width: min(clamp(14px, 2.2vh, 24px), 5cqw); top: 5px; right: 5px; }
    .board-mode .row .banner { text-align: center; padding: 8px 12px; }
    .board-mode .actions button { flex: 1 1 0; white-space: nowrap; padding-left: 8px; padding-right: 8px; }
    .board-mode .actions button.primary { flex-grow: 1.7; }
    .board-mode .hitfx { left: calc(100% - clamp(12px, 2.5vw, 36px) - var(--side, 30vw) / 2); }
    /* The bubble speaks over the dartboard in the right column, never over the cards or the board. */
    .board-mode .banter {
      left: calc(100% - clamp(12px, 2.5vw, 36px) - var(--side, 30vw) / 2); top: 26%;
      width: max-content; max-width: calc(var(--side, 30vw) + 24px); white-space: normal; text-align: center; font-size: clamp(1.1rem, 3vh, 2.1rem);
    }
  }
  /* Ladder Rush: the squares stretch to the panel (never much taller than wide); numbers
     and tokens sit above the snakes and ladders, the current player's square is lit. */
  .gpanel.sl { flex-direction: column; justify-content: center; align-items: stretch; gap: clamp(6px, 1.2cqh, 14px); padding: clamp(6px, 1.2cqh, 14px); }
  .slwrap { position: relative; flex: 1 1 0; min-height: 0; display: flex; align-items: center; padding-left: 5.5%; }
  .slgrid {
    position: relative; width: 100%; height: 100%; max-height: 74cqw; display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr)); grid-template-rows: repeat(5, minmax(0, 1fr));
  }
  .slc { position: relative; border-radius: 4px; }
  .slc.a { background: rgba(255, 255, 255, 0.05); }
  .slc.b { background: rgba(255, 255, 255, 0.12); }
  .slc.up { background: rgba(74, 222, 128, 0.16); }
  .slc.down { background: rgba(239, 68, 68, 0.16); }
  .slc.home { background: rgba(252, 211, 77, 0.45); }
  .slc.cur { box-shadow: inset 0 0 0 max(3px, 0.45cqw) var(--pc); background: color-mix(in srgb, var(--pc) 22%, transparent); }
  .slc span {
    position: absolute; left: 6%; top: 3%; z-index: 2; font-size: clamp(0.85rem, min(2.8cqw, 5cqh), 2.8rem); font-weight: 800;
    line-height: 1; color: rgba(255, 255, 255, 0.82); text-shadow: 0 0 4px #000, 0 0 2px #000; font-variant-numeric: tabular-nums;
  }
  .slc.home span { color: #fff; }
  .sllinks { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; overflow: visible; }
  .sllinks line, .sllinks path { vector-effect: non-scaling-stroke; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .sllinks .ladder line { stroke: #4ade80; stroke-width: max(3px, 0.45cqw); }
  .sllinks .snake path { stroke: #ef4444; stroke-width: max(6px, 1.05cqw); }
  .slhead { position: absolute; z-index: 1; width: max(12px, min(2cqw, 3.8cqh)); aspect-ratio: 1; border-radius: 50%; background: #ef4444; transform: translate(-50%, -50%); box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35); }
  .sltok {
    position: absolute; z-index: 3; width: max(28px, min(5cqw, 9.5cqh)); aspect-ratio: 1; border-radius: 50%; transform: translate(-50%, -50%);
    display: grid; place-items: center; background: var(--pc); color: #fff; font-weight: 900; font-size: max(14px, min(2.8cqw, 5.2cqh));
    border: max(2px, 0.25cqw) solid #0b0d14; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5); transition: left 0.6s ease-out, top 0.6s ease-out;
  }
  .sltok.cur { border-color: #fff; z-index: 4; width: max(34px, min(6cqw, 11cqh)); font-size: max(16px, min(3.3cqw, 6.2cqh)); box-shadow: 0 0 0 max(3px, 0.35cqw) var(--pc), 0 0 18px var(--pc); }
  .slkey { display: flex; justify-content: center; flex-wrap: wrap; gap: clamp(6px, 1.2cqw, 18px); font-size: clamp(0.85rem, min(2.1cqw, 4cqh), 1.9rem); font-weight: 700; opacity: 0.9; }
  .slkey span { display: inline-flex; align-items: baseline; gap: 0.35em; padding: 0.15em 0.55em; border-radius: 8px; background: rgba(255, 255, 255, 0.07); }
  .slkey b { font-size: 1.35em; color: #fcd34d; }
  /* Target strips: the targets wrap into rows when there are few players, so every cell is big. */
  .seqs { justify-content: space-evenly; gap: clamp(6px, 1.5cqh, 18px); }
  .seqs .seq { display: flex; flex-direction: column; gap: clamp(2px, 0.6cqh, 8px); --cell: clamp(0.8rem, min(calc(88cqw / var(--cols, 13) / (var(--ch, 3) * 0.62 + 0.7)), calc(46cqh / (var(--n, 1) * (var(--rows, 1) * 1.55 + 0.9)))), 4.6rem); }
  .seqs .seq-name { font-size: max(0.9rem, calc(var(--cell) * 0.7)); line-height: 1.15; }
  .seq-cells { display: grid; grid-template-columns: repeat(var(--cols, 13), minmax(0, 1fr)); gap: clamp(4px, 0.9cqw, 12px); }
  .seqs .seq-cells i { font-size: var(--cell); line-height: 1.15; padding: 0.2em 0; border-radius: 8px; }
  .seqs .seq.cur { outline: 2px solid color-mix(in srgb, var(--pc) 60%, transparent); outline-offset: 4px; border-radius: 10px; }
  /* Lanes and towers grow with the panel. */
  .race-name { font-size: clamp(0.9rem, min(4cqw, 30cqh / var(--n, 1)), 3rem); }
  .race-track { height: clamp(14px, 44cqh / var(--n, 1), 80px); }
  .derby-lane { grid-template-columns: clamp(34px, 8cqw, 120px) 1fr clamp(24px, 4cqw, 60px); }
  .derby-no { font-size: clamp(1rem, min(6.5cqw, 42cqh / var(--n, 1)), 5rem); }
  .derby-track { height: clamp(20px, 62cqh / var(--n, 1), 150px); }
  .racer { font-size: clamp(16px, 50cqh / var(--n, 1), 110px); }
  .derby-flag { font-size: clamp(16px, min(4cqw, 30cqh / var(--n, 1)), 50px); }
  .tower, .lane, .glass { max-width: max(130px, 24cqw); }
  .tower b, .lane b { font-size: clamp(1.2rem, min(9cqw, 12cqh), 5rem); }
  .tower small, .lane small, .glass small { font-size: clamp(0.9rem, min(4.5cqw, 7cqh), 2.4rem); }

  /* Party cricket: cards wide enough for a name, slimmer darts row so the chalkboard keeps its rows. */
  .cricket-mode .players.many { grid-template-columns: repeat(auto-fill, minmax(clamp(150px, 14vw, 230px), 1fr)); }
  .cricket-mode .players.many .player:not(.active) .pav { display: none; }
  .cricket-mode .players.many .player:not(.active) { grid-template-columns: minmax(0, 1fr) auto; }
  .cricket-mode:not(.board-mode) .total, .cricket-mode:not(.board-mode) .slot { height: clamp(54px, 9.5vh, 118px); }
  .cricket-mode:not(.board-mode) .slot b { font-size: clamp(26px, 5vh, 62px); }
  .cricket-mode:not(.board-mode) .total { font-size: clamp(30px, 5.4vh, 68px); }

  /* Tonight's Top List (lobby and attract screen). */
  .tl-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .toplist { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .toplist li { display: grid; grid-template-columns: 1.6em auto minmax(0, 1fr) auto 2.4em; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 10px; background: var(--glass); border-left: 4px solid var(--pc); }
  .toplist li:first-child { background: color-mix(in srgb, #fcd34d 16%, var(--glass)); }
  .tl-rank { font-weight: 900; opacity: 0.7; text-align: center; }
  .tl-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tl-wins { opacity: 0.7; font-size: 0.85em; white-space: nowrap; }
  .tl-pts { font-size: 1.3em; text-align: right; font-variant-numeric: tabular-nums; color: #fcd34d; }
  /* The attract screen: brand, clock, the Top List and slides, big enough for the whole room. */
  .idle-layer { position: fixed; inset: 0; z-index: 9; display: none; flex-direction: column; gap: clamp(12px, 3vh, 36px); padding: clamp(16px, 4vh, 48px) clamp(16px, 4vw, 64px); background: var(--bg); color: #fff; cursor: pointer; overflow: hidden; }
  .idle-layer.open { display: flex; animation: idle-in 0.8s ease-out; }
  @keyframes idle-in { from { opacity: 0; } }
  .idle-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.18; filter: saturate(1.1); }
  .idle-top, .idle-main, .idle-cta { position: relative; }
  .idle-top { display: flex; align-items: center; gap: clamp(12px, 2vw, 28px); font-size: clamp(1.6rem, 5vh, 4rem); }
  .idle-logo { height: clamp(48px, 10vh, 130px); width: auto; border-radius: 12px; }
  .idle-clock { margin-left: auto; font-weight: 800; font-variant-numeric: tabular-nums; opacity: 0.9; }
  .idle-main { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: clamp(16px, 3vw, 48px); align-items: center; }
  .idle-main.solo { grid-template-columns: minmax(0, 1fr); max-width: 1100px; width: 100%; margin: 0 auto; }
  .idle-main h2 { margin: 0 0 0.5em; font-size: clamp(1.6rem, 4.6vh, 3.6rem); letter-spacing: 0.02em; }
  .idle-list, .idle-slide { min-height: 0; max-height: 100%; overflow: hidden; }
  .toplist.big { gap: clamp(4px, 1vh, 12px); }
  .toplist.big li { font-size: clamp(1.3rem, 4.2vh, 3.2rem); padding: 0.25em 0.5em; border-left-width: 8px; }
  .toplist.big .pav { width: 1.4em; height: 1.4em; font-size: 0.6em; }
  .idle-empty { font-size: clamp(1.3rem, 4vh, 3rem); opacity: 0.8; }
  .idle-bests .ib-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 0.3em 0; border-bottom: 1px solid var(--line); font-size: clamp(1.2rem, 3.8vh, 3rem); }
  .idle-bests .ib-row b { font-size: 1.5em; color: #fcd34d; font-variant-numeric: tabular-nums; }
  .ib-latest { font-size: clamp(1rem, 2.6vh, 2rem); opacity: 0.85; }
  .idle-moment { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; animation: idle-in 0.8s ease-out; }
  .idle-moment img { max-width: 100%; max-height: 58vh; border-radius: 18px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); }
  .idle-moment figcaption { font-size: clamp(1.4rem, 4.4vh, 3.4rem); font-weight: 900; }
  .idle-cta { text-align: center; font-size: clamp(1.1rem, 3.2vh, 2.4rem); font-weight: 700; opacity: 0.85; animation: idle-pulse 2.4s ease-in-out infinite; }
  @keyframes idle-pulse { 50% { opacity: 0.45; } }
  @media (prefers-reduced-motion: reduce) { .idle-layer.open, .idle-moment, .idle-cta { animation: none; } }
  @media (max-aspect-ratio: 5/4) { .idle-main { grid-template-columns: minmax(0, 1fr); } .idle-slide { display: none; } }

  /* Teams and throw lines. */
  .team-tag { margin-left: auto; font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: color-mix(in srgb, var(--pc) 35%, transparent); white-space: nowrap; }
  .plist .mini.lvl { margin-left: auto; min-width: 5.2em; font-size: 0.75rem; font-weight: 800; }
  .plist .mini.lvl.rookie { background: rgba(34, 197, 94, 0.28); }
  .plist .mini.lvl.pro { background: rgba(250, 204, 21, 0.28); }
  .lvl-chip { display: inline-block; margin-left: 0.5em; padding: 0.1em 0.45em; border-radius: 6px; font-size: 0.55em; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; vertical-align: middle; }
  .lvl-chip.rookie { background: #16a34a; color: #fff; }
  .lvl-chip.pro { background: #facc15; color: #111; }

  /* The end of the night: champion, podium and every game's winner. */
  .tl-btns { display: flex; gap: 6px; }
  .trophies { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 2.4vh, 28px); text-align: center; padding: 16px;
    background: radial-gradient(circle at 50% 25%, color-mix(in srgb, #fcd34d 22%, transparent), transparent 60%); }
  .tr-label { font-size: clamp(1.1rem, 3vh, 2.2rem); letter-spacing: 0.35em; text-transform: uppercase; color: #fcd34d; font-weight: 800; }
  .tr-champ { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .tr-champ b { font-size: clamp(48px, 10vh, 130px); line-height: 1; }
  .tr-champ span { font-size: clamp(1.1rem, 3vh, 2.2rem); opacity: 0.85; }
  .tr-podium { display: flex; gap: clamp(12px, 3vw, 48px); justify-content: center; flex-wrap: wrap; }
  .tr-place { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 14px; background: var(--glass-2); border-left: 6px solid var(--pc); font-size: clamp(1.1rem, 3vh, 2.2rem); }
  .tr-place i { font-style: normal; font-weight: 900; color: #fcd34d; }
  .tr-place span { opacity: 0.75; font-size: 0.75em; }
  .tr-games { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 6px; width: min(100%, 1100px); }
  .tr-games li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 14px; border-radius: 10px; background: var(--glass); font-size: clamp(0.95rem, 2.2vh, 1.4rem); }
  .tr-games li span { opacity: 0.75; }

  /* Heat, grouping and the score chart (#10). */
  .board .heat { fill: var(--pc, #fcd34d); opacity: 0.45; stroke: #000; stroke-width: 0.006; pointer-events: none; }
  .res-heat { display: inline-flex; align-items: center; gap: 6px; }
  .res-heat .res-stat b { white-space: nowrap; }
  .mini-board { width: clamp(48px, 8vh, 84px); height: auto; }
  .mini-board .rings circle { fill: none; stroke: rgba(255, 255, 255, 0.28); stroke-width: 0.025; }
  .mini-board .dot { fill: var(--pc); stroke: #000; stroke-width: 0.01; opacity: 0.85; }
  .chart-wrap { width: min(92vw, 820px); justify-self: center; margin: 0 auto; }
  .score-chart { width: 100%; height: clamp(90px, 16vh, 180px); background: rgba(0, 0, 0, 0.25); border-radius: 12px; }
  .score-chart polyline { fill: none; stroke: var(--pc); stroke-width: 1.2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; stroke-width: 4px; }
  .chart-key { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-top: 4px; font-weight: 700; }
  .chart-key span::before { content: ""; display: inline-block; width: 18px; height: 4px; margin-right: 6px; vertical-align: middle; background: var(--pc); border-radius: 2px; }
  .idle-moment.saved .board { width: min(46vh, 90%); height: auto; }
  .idle-moment.saved figcaption small { display: block; font-size: 0.5em; opacity: 0.75; font-weight: 700; }

  /* Smart-home buttons and the highlight photo (#11). */
  .bar-actions button.home { max-width: 12em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-actions button.home.on { background: #fcd34d; color: #111; border-color: #fcd34d; }
  .gs-photo { justify-self: center; max-width: min(80vw, 560px); max-height: 30vh; border-radius: 16px; box-shadow: 0 0 0 4px var(--pc), 0 20px 60px rgba(0, 0, 0, 0.5); }

  /* Your voice: the settings page for recordings (#33). */
  .booth.voice { width: min(96vw, 900px); max-height: 92vh; display: flex; flex-direction: column; gap: 10px; }
  .vc-tabs { flex-wrap: wrap; }
  .vc-list { overflow: auto; min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; }
  .vc-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto auto; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; background: var(--glass); }
  .vc-row.own { border-left: 4px solid #22c55e; }
  .vc-row.busy { outline: 2px solid #fcd34d; }
  .vc-label small { display: block; opacity: 0.7; font-size: 0.8em; }
  .vc-state { font-size: 0.8rem; opacity: 0.75; white-space: nowrap; }
  .vc-row .mini.rec { color: #fca5a5; }
  .vc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); gap: 4px; margin-bottom: 8px; }
  .vc-chip { padding: 6px 0; border-radius: 8px; font-weight: 800; background: var(--glass); border: 1px solid var(--line); color: #fff; }
  .vc-chip.own { background: rgba(34, 197, 94, 0.35); }
  .vc-chip.busy { outline: 2px solid #fcd34d; }
  .vc-rec { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 12px; background: var(--glass-2); font-size: 1.3rem; }
  .vc-rec b { font-size: 1.6em; }
  .vc-rec.live { background: rgba(220, 38, 38, 0.35); }
  .vc-foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .vc-import { cursor: pointer; }

  /* The game shot screen never cuts off the winner: it scrolls when it must, and many players
     get compact rows. */
  .gameshot { place-content: safe center; overflow-y: auto; padding-block: 16px; }
  .gameshot.many { gap: 8px; }
  .gameshot.many .gs-name { font-size: clamp(40px, min(7vw, 9vh), 96px); }
  .gameshot.many .res-table { gap: 5px; }
  .gameshot.many .res-row { padding: 4px 14px; }
  .gameshot.many .res-row .pav.sm { width: 34px; height: 34px; }
  .gameshot.many .mini-board { width: clamp(32px, 5vh, 48px); }
  .gameshot.many .res-heat .res-stat { display: none; }
  .gameshot.many .score-chart { height: clamp(70px, 11vh, 130px); }

  /* A big screen gets a big result table: it grows with the width (820 px on a small one). */
  .res-table { width: min(max(820px, 62vw), 92vw); }
  .gameshot .res-name { font-size: clamp(1.2rem, 3.2vh, 2.6rem); }
  .gameshot .res-main b { font-size: clamp(1.6rem, 4.8vh, 3.4rem); }
`;

customElements.define("autodarts-classic-card", AutodartsClassicCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "autodarts-classic-card",
  name: "Autodarts classic game screen",
  description: "A full-screen, play.autodarts.io-style game screen for the Autodarts integration",
});
