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
      players: players.map((name) => ({ name, marks: Object.fromEntries(targets.map((t) => [t, 0])), points: 0, legs: 0 })),
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
    if (this._open(me, "B")) me.marks.B += 1;
    else if (this._scorable("B")) me.points += this.visit.reduce((t, d) => t + segmentScore(d.seg), 0);
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
function chalkboard(rows, players, current) {
  const two = players.length === 2;
  const cell = (m, i) => `<div class="cm ${i === current ? "cur" : ""}">${MARK_SVG[Math.min(m || 0, 3)]}</div>`;
  const head = two ? "" : `<div class="crow chead"><div class="clab"></div>${players.map((p, i) => `<div class="cm ${i === current ? "cur" : ""}"><span>${esc(p)}</span></div>`).join("")}</div>`;
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

class AutodartsClassicCard extends HTMLElement {
  setConfig(config) {
    this._config = { prefix: "autodarts_board", camera: 0, view: "virtual", overlay: true, brand: "Darts", photo: "", stuck_takeout_reset: STUCK_TAKEOUT_S, ...config };
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
      .concat([this._st("select", "practice_game")]);
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
      this._render();
    }
  }

  async _act(act, value) {
    const s = this._setup;
    const wm = this._wm;
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
      <div class="stage ${this._config.overlay ? "overlay-mode" : ""}">
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
        <div class="toast" role="status"></div>
      </div>`;
    this._stage = this.shadowRoot.querySelector(".stage");
    if (this._config.photo) this._stage.style.setProperty("--photo", `url("${this._config.photo}")`);
    this._stage.classList.toggle("has-photo", !!this._config.photo);
    document.title = this._config.brand;
    this._info = this.shadowRoot.querySelector(".info");
    this._lobbyEl = this.shadowRoot.querySelector(".lobby");
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
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._stage) {
      this._build();
      if (this._st("sensor", "detection_status")?.state === "stopped") this._wake();
    }
    const lobby = this._isLobby();
    this._stage.classList.toggle("in-lobby", lobby);
    if (lobby) this._lobbyEl.innerHTML = this._renderLobby();
    else this._renderGame();
    this._syncLive();
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

  _slots(visit) {
    return [0, 1, 2]
      .map((i) => {
        const s = visit[i];
        if (!s) return `<div class="slot empty"><svg viewBox="0 0 64 16" class="dart"><path d="M2 8h30M32 5l10 3-10 3zM42 8h20M48 3l8 5-8 5"/></svg></div>`;
        const p = parseSegment(s);
        return `<div class="slot ${p.ring === "M" ? "miss" : ""}"><b>${esc(p.label)}</b><small>${segmentScore(s)}</small></div>`;
      })
      .join("");
  }

  _bar(title, facts) {
    return `
      <header class="bar">
        <div class="title"><span class="avatar" title="${esc(this._config.brand)}"></span><span class="gname">${esc(title)}</span>${facts.map((f) => `<span class="fact">${esc(f)}</span>`).join("")}</div>
        <div class="bar-actions">
          ${this._statusPill()}
          <button data-act="new" class="ghost">New game</button>
          <button data-act="end" class="ghost ${this._confirmEnd ? "danger" : ""}">${this._confirmEnd ? "Tap again to end" : "End game"}</button>
          <button data-act="full" class="ghost icon" title="Full screen">⛶</button>
        </div>
      </header>`;
  }

  _finishBoard(visit) {
    this._lastVisit = visit;
    if (!visit.length && !(this._lastThrows || []).length) this._lastThrows = [];
    this._virtual.innerHTML = boardSvg(visit, this._lastThrows || []);
    this._stage.querySelector('[data-act="view"]').textContent = this._view === "live" ? "Virtual board" : "Live camera";
    this._stage.querySelector('[data-act="cam"]').textContent = `Camera ${(this._cam % (this._cams?.length || 3)) + 1}`;
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
    this._finishBoard(visit);
  }

  _renderWildMouse() {
    const wm = this._wm;
    const label = (t) => (t === 25 ? "Bull" : t === "D" ? "Dbl" : t === "T" ? "Trp" : t === "B" ? "3-Bed" : t);
    const legs = wm.legsToWin > 1;
    const cards = wm.players
      .map((p, i) => {
        const active = i === wm.current && wm.winner == null;
        return `
          <div class="player ${active ? "active" : ""} ${wm.winner === i || wm.legWinner === i ? "winner" : ""}">
            ${legs ? `<div class="legs"><span>${p.legs}<small>legs</small></span></div>` : ""}
            <div class="pname">${esc(p.name)}</div>
            <div class="score">${p.points}</div>
          </div>`;
      })
      .join("");
    const slots = [0, 1, 2]
      .map((i) => {
        const d = wm.visit[i];
        if (!d) return `<div class="slot empty"><svg viewBox="0 0 64 16" class="dart"><path d="M2 8h30M32 5l10 3-10 3zM42 8h20M48 3l8 5-8 5"/></svg></div>`;
        const p = parseSegment(d.seg);
        const what = d.target == null ? "no score" : `→ ${WM_LABEL[d.target] || d.target}${d.points ? ` +${d.points}` : ""}`;
        return `<div class="slot ${d.target == null ? "miss" : ""}"><b>${esc(p.label)}</b><small>${esc(what)}</small></div>`;
      })
      .join("");
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
      ${winner ? `
        <div class="gameshot">
          <div class="gs-label">Game shot</div>
          <div class="gs-name">${esc(winner.name)}</div>
          <div class="gs-actions">
            <button class="primary big" data-act="rematch">Rematch</button>
            <button class="big" data-act="new">New game</button>
          </div>
          <button class="ghost gs-undo" data-act="undo">↶ Wrong reading? Undo the last visit</button>
        </div>` : ""}`;
    this._finishBoard(wm.visit.map((d) => d.seg));
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

    const playerCard = (p) => {
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
        <div class="player ${active ? "active" : ""} ${winner && p.player === a.winner ? "winner" : ""}">
          ${legs}
          <div class="pname">${esc(p.name || `Player ${p.player}`)}</div>
          <div class="score">${esc(big)}</div>
          <div class="stats">${esc(sub)}</div>
          ${extra}
        </div>`;
    };

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
        winner ? -1 : scores.findIndex((p) => p.player === a.player),
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
      ${winner ? `
        <div class="gameshot">
          <div class="gs-label">Game shot</div>
          <div class="gs-name">${esc(winner.name)}</div>
          <div class="gs-actions">
            <button class="primary big" data-act="rematch">Rematch</button>
            <button class="big" data-act="new">New game</button>
          </div>
          ${a.undo ? `<button class="ghost gs-undo" data-act="undo">↶ Wrong reading? Undo the last visit</button>` : ""}
        </div>` : ""}`;
    this._finishBoard(visit);
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
            <button class="tile ${id === g ? "on" : ""}" data-act="game" data-value="${id}">
              <b>${esc(name)}</b><small>${esc(blurb)}</small>
            </button>`)
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
        </aside>
      </div>`;
  }
}

const CSS = `
  :host { display: block; height: 100%; }
  * { box-sizing: border-box; }
  .stage {
    --glass: rgba(255, 255, 255, 0.09); --glass-2: rgba(255, 255, 255, 0.16); --line: rgba(255, 255, 255, 0.16);
    height: calc(100dvh - var(--header-height, 56px)); overflow: hidden; color: #fff;
    font-family: "Open Sans", "Segoe UI", Roboto, system-ui, sans-serif; -webkit-tap-highlight-color: transparent;
    background:
      radial-gradient(ellipse at 70% 90%, rgba(60, 170, 190, 0.32), transparent 55%),
      radial-gradient(ellipse at 85% 0%, rgba(90, 120, 230, 0.5), transparent 60%),
      linear-gradient(160deg, #221d5c 0%, #2a3688 45%, #2a55a1 100%);
  }
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
  button.primary { background: #fff; color: #27307a; border-color: #fff; }
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
    background: var(--photo) right 24% / 58% auto no-repeat, linear-gradient(120deg, #1d1850, #2a3a8e);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  /* Fade the picture's left edge into the banner so the title sits on a clean ground. */
  .hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #1f1a54 0%, #1f1a54 44%, rgba(31, 26, 84, 0.55) 58%, transparent 80%); }
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
  .players:not(.n1) .player:not(.active):not(.winner) { opacity: 0.6; }
  .player.active { background: rgba(255, 255, 255, 0.2); border-color: #fff; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25); }
  .player.winner { border-color: #fcd34d; box-shadow: 0 0 40px rgba(252, 211, 77, 0.4); }
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
  .cm.cur { background: rgba(255, 255, 255, 0.1); }
  .chead .cm span { font-weight: 800; font-size: clamp(0.9rem, 2.2vh, 1.4rem); text-transform: uppercase; letter-spacing: 0.05em; }
  .mk { height: clamp(24px, 5.2vh, 60px); width: auto; stroke: #fff; stroke-width: 11; stroke-linecap: round; fill: none; }
  .mk.closed { stroke: #6ee7a0; }
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
  .dart { width: 70%; max-width: 110px; stroke: rgba(255, 255, 255, 0.45); fill: rgba(255, 255, 255, 0.45); stroke-width: 2; }

  .row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .actions { display: flex; gap: 8px; }
  .actions button { padding: clamp(12px, 1.8vh, 20px) clamp(18px, 2.4vh, 30px); font-size: clamp(1.05rem, 2.6vh, 1.6rem); }
  .banner { font-size: clamp(1.15rem, 3vh, 2rem); padding: 10px 18px; border-radius: 10px; background: rgba(0, 0, 0, 0.28); }
  .banner b { font-size: clamp(1.4rem, 3.8vh, 2.6rem); margin-left: 10px; letter-spacing: 0.04em; }
  .banner.bust { background: rgba(220, 38, 38, 0.6); font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; }

  .gameshot {
    position: fixed; inset: 0; z-index: 5; display: grid; place-content: center; gap: 14px; text-align: center;
    background: radial-gradient(circle, rgba(34, 29, 92, 0.85), rgba(10, 10, 30, 0.95)); animation: pop 0.4s ease-out;
  }
  .has-photo .gameshot {
    /* The picture fills the left at full height (about 0.8 x the height wide) and fades out before its edge. */
    background: linear-gradient(90deg, rgba(13, 12, 42, 0.2) 0, rgba(13, 12, 42, 0.6) 45vh, #0d0c2a 78vh), var(--photo) 0 25% / auto 100% no-repeat, #0d0c2a;
  }
  .gs-label { font-size: clamp(1.2rem, 2.5vw, 1.8rem); letter-spacing: 0.4em; text-transform: uppercase; color: #fcd34d; font-weight: 700; }
  .gs-name { font-size: clamp(48px, 9vw, 120px); font-weight: 800; }
  .gs-actions { display: flex; gap: 12px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
  @keyframes pop { from { opacity: 0; transform: scale(1.05); } }
  .gs-undo { justify-self: center; margin-top: 18px; font-size: 0.95rem; opacity: 0.75; }

  .boardwrap { position: relative; min-height: 220px; display: flex; justify-content: center; align-items: center; container-type: size; }
  .view {
    position: relative; width: min(100cqw, 100cqh); height: min(100cqw, 100cqh); border-radius: 50%; overflow: hidden;
    box-shadow: 0 0 70px 14px rgba(80, 220, 200, 0.4); background: #0b0b10;
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
  .board { width: 100%; height: 100%; filter: drop-shadow(0 0 40px rgba(80, 220, 200, 0.45)); }
  .board .num { fill: #fff; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
  .board .bed { stroke: rgba(210, 210, 220, 0.55); stroke-width: 0.004; }
  .board .lit { fill: #fde047 !important; animation: pulse 1.4s ease-in-out infinite; }
  .vdart circle { fill: #22d3ee; stroke: #0b1020; stroke-width: 0.012; }
  .vdart .halo { fill: rgba(34, 211, 238, 0.28); stroke: none; }
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
  .tiles { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .tile { text-align: left; padding: 14px; background: var(--glass); border: 2px solid transparent; min-height: 78px; }
  .tile b { display: block; font-size: 1.15rem; }
  .tile small { display: block; margin-top: 4px; font-weight: 400; opacity: 0.7; font-size: 0.8rem; }
  .tile.on { background: rgba(255, 255, 255, 0.24); border-color: #fff; }
  .setup { position: sticky; top: 0; padding: 16px; border-radius: 14px; background: rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; gap: 8px; }
  .plist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .plist li { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 10px; border-radius: 10px; background: var(--glass); }
  .pnum { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: #27307a; font-weight: 800; font-size: 0.85rem; }
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
  .seg button.on { background: #fff; color: #27307a; }
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
