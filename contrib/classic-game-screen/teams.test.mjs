// Teams, throw lines and handicaps, sudden death and the trophies of the night (#12, #18).
// Run: node --test "contrib/classic-game-screen/*.test.mjs"
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { states, mount } from "./dom-helpers.mjs";

const src = fs.readFileSync(new URL("./autodarts-classic-card.js", import.meta.url), "utf8");
const ctx = { HTMLElement: class {}, customElements: { define() {} }, window: {}, localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.K = { makeTeams, sessionTable, LOCAL_GAME_CLASSES };", ctx);
const { makeTeams, sessionTable, LOCAL_GAME_CLASSES } = ctx.K;
const plain = (x) => JSON.parse(JSON.stringify(x));

function lobby(players, setup = {}) {
  const m = mount(states([], { game: "off" }));
  m.el._sfx.play = () => {}; m.el._caller.say = () => {};
  Object.assign(m.el._setup, { players, ...setup });
  return m;
}
function start(m, game) {
  m.el._act("new");
  m.$(`[data-act="game"][data-value="${game}"]`).click();
  m.$('[data-act="start"]').click();
  return m;
}

test("teams from the list: pairs in order, an odd one joins the last pair, two halves, auto above six", () => {
  assert.deepEqual(plain(makeTeams(["A", "B", "C", "D"], "pairs")), [["A", "B"], ["C", "D"]]);
  assert.deepEqual(plain(makeTeams(["A", "B", "C", "D", "E"], "pairs")), [["A", "B"], ["C", "D", "E"]]);
  assert.deepEqual(plain(makeTeams(["A", "B", "C", "D", "E"], "two")), [["A", "B", "C"], ["D", "E"]]);
  assert.equal(makeTeams(["A", "B", "C", "D", "E", "F"], "auto"), null);
  assert.equal(makeTeams(["A", "B", "C", "D", "E", "F", "G"], "auto").length, 3);
  assert.equal(makeTeams(["A", "B"], "pairs"), null, "two players are no teams");
  assert.equal(makeTeams(["A", "B", "C", "D"], "off"), null);
});

test("a team plays as one: its members take turns visit by visit, also through undo", () => {
  const m = start(lobby(["Robin", "Sam", "Alex", "Mia"], { teams: "pairs" }), "x01_party");
  const g = m.el._wm;
  assert.deepEqual(g.players.map((p) => p.name), ["Robin & Sam", "Alex & Mia"]);
  assert.match(m.$(".player.active .turn-tag").textContent, /Robin · dart 1 of 3/);
  g.dart("T20"); g.next(); // Robin
  g.dart("T20"); g.next(); // Alex
  m.el._render();
  assert.match(m.$(".player.active .turn-tag").textContent, /Sam · dart 1 of 3/);
  g.undo(); g.undo();
  m.el._render();
  assert.match(m.$(".player.active .turn-tag").textContent, /Robin/);
});

test("teams also take turns in the cricket games, and keep their members over a new leg", () => {
  const m = start(lobby(["Robin", "Sam", "Alex", "Mia"], { teams: "pairs", legs: 2 }), "cricket_party");
  const g = m.el._wm;
  g.next(); g.next();
  assert.equal(g.players[0].mi, 1);
  const x = start(lobby(["A", "B", "C", "D"], { teams: "two", legs: 2 }), "x01_party").el._wm;
  x.winLeg(0); x.next();
  assert.deepEqual(plain(x.players[0].members), ["A", "B"]);
});

test("a team's place counts for each member on the Top List", () => {
  const t = sessionTable([{ names: ["A & B", "C & D"], members: [["A", "B"], ["C", "D"]], winners: ["A & B"] }]);
  const pts = Object.fromEntries(t.map((r) => [r.name, r.pts]));
  assert.deepEqual(pts, { A: 3, B: 3, C: 2, D: 2 });
  const m = start(lobby(["Robin", "Sam", "Alex", "Mia"], { teams: "pairs" }), "x01_party");
  m.el._wm.winLeg(1); m.el._render();
  assert.deepEqual(plain(m.el._session().games[0].members), [["Alex", "Mia"], ["Robin", "Sam"]]);
});

test("the lobby shows the teams, and counts teams for the players a game needs", () => {
  const m = lobby(["Robin", "Sam", "Alex", "Mia"], { teams: "pairs", game: "scram" });
  m.el._act("new");
  assert.equal(m.$$(".team-tag").length, 4);
  assert.equal(m.$('[data-act="start"]').disabled, false, "two teams can play Scram");
  const one = lobby(["Robin", "Sam", "Alex"], { teams: "two", game: "lives" });
  one.el._act("new");
  assert.equal(one.$('[data-act="start"]').disabled, false);
});

test("throw lines: a tap changes a player's line; rookies and regulars start ahead with the bonus", () => {
  const m = lobby(["Robin", "Sam", "Alex"], { game: "x01_party", start: 501 });
  m.el._act("new");
  m.$('[data-act="level"][data-value="0"]').click(); // Robin: rookie
  m.$('[data-act="level"][data-value="2"]').click(); m.$('[data-act="level"][data-value="2"]').click(); // Alex: pro
  assert.equal(m.el._setup.levels.Robin, "rookie");
  assert.equal(m.el._setup.levels.Alex, "pro");
  m.$('[data-act="handicap"]').click();
  m.$('[data-act="start"]').click();
  const g = m.el._wm;
  assert.deepEqual(g.players.map((p) => p.rem), [401, 501, 501]);
  assert.match(m.$(".stage").innerHTML, /lvl-chip rookie/);
  assert.match(m.$(".stage").innerHTML, /lvl-chip pro/);
});

test("head starts where a game has a start to give", () => {
  const make = (kind) => { const [C, o] = LOCAL_GAME_CLASSES[kind]; const g = C.create(kind, ["A", "B", "C"], o({})); g.setLevels(["rookie", "regular", "pro"], true); return g.players; };
  assert.deepEqual(make("snakes").map((p) => p.sq), [5, 2, 0]);
  assert.deepEqual(make("chase_dragon").map((p) => p.pos), [2, 1, 0]);
  assert.deepEqual(make("derby").map((p) => p.step), [2, 1, 0]);
  assert.deepEqual(make("tower").map((p) => p.rem), [140, 160, 180]);
  const noBonus = (() => { const [C, o] = LOCAL_GAME_CLASSES.snakes; const g = C.create("snakes", ["A"], o({})); g.setLevels(["rookie"], false); return g.players[0]; })();
  assert.equal(noBonus.sq, 0);
  assert.equal(noBonus.level, "rookie");
});

test("sudden death settles a dead heat: nearest the bullseye wins, and takes the game on the Top List", () => {
  const m = start(lobby(["Robin", "Sam", "Alex"]), "targets");
  const g = m.el._wm;
  g.winShared([0, 2]); m.el._render();
  assert.match(m.$(".gameshot").textContent, /Dead heat/);
  m.$('[data-act="sudden"]').click();
  const bo = m.el._wm;
  assert.equal(bo.kind, "bull_off");
  assert.deepEqual(bo.players.map((p) => p.name), ["Robin", "Alex"]);
  bo.dart("25"); bo.next(); // Robin: outer bull
  bo.dart("Bull"); bo.next(); // Alex: bullseye
  m.el._render();
  assert.equal(bo.winner, 1);
  const e = m.el._session().games[0];
  assert.deepEqual([...e.winners], ["Alex"]);
  assert.equal(e.names[0], "Alex");
  const pts = Object.fromEntries(sessionTable(m.el._session().games).map((r) => [r.name, r.pts]));
  assert.deepEqual(pts, { Alex: 3, Robin: 2, Sam: 1 });
});

test("sudden death: level darts throw again, the board's positions decide when it knows them", () => {
  const [C] = LOCAL_GAME_CLASSES.bull_off;
  const g = C.create("bull_off", ["A", "B", "C"], {});
  g.dart("Bull"); g.next(); g.dart("Bull"); g.next(); g.dart("S20", { bed: "SingleOuter" }); g.next();
  assert.equal(g.winner, null);
  assert.equal(g.players[2].out, true);
  g.dart("S1", { coords: { x: 0.2, y: 0.1 } }); g.next();
  g.dart("S1", { coords: { x: 0.05, y: 0.05 } }); g.next();
  assert.equal(g.winner, 1);
});

test("the trophies of the night, and the highlights through a notify service", async () => {
  const m = start(lobby(["Robin", "Sam"]), "x01_party");
  m.el._wm.winLeg(0); m.el._render();
  m.el._act("rematch"); m.el._wm.winLeg(1); m.el._render(); // the order turns: Robin is second now
  m.el._act("rematch"); m.el._wm.winLeg(1); m.el._render(); // and Sam again
  m.el._act("new");
  m.$('[data-act="trophies"]').click();
  assert.ok(m.$(".trophies"));
  assert.match(m.$(".tr-champ").textContent, /Robin\s*8 points · 2 wins/);
  assert.match(m.$(".tr-podium").textContent, /2\s*S?\s*Sam\s*7 points/);
  assert.equal(m.$$(".tr-games li").length, 3);
  assert.equal(m.$('[data-act="send-highlights"]'), null, "no notify service configured");
  const n = mount(states([], { game: "off" }), { notify: "notify.mobile_app_robin" });
  n.el._sess = m.el._session();
  n.el._act("trophies");
  n.$('[data-act="send-highlights"]').click();
  await new Promise((r) => setTimeout(r, 0));
  const call = n.calls.find((c) => c[0] === "notify");
  assert.equal(call[1], "mobile_app_robin");
  assert.match(call[2].title, /Robin wins the night/);
  assert.match(call[2].message, /1\. Robin 8 pts \(2 wins\)\n2\. Sam 7 pts/);
});
