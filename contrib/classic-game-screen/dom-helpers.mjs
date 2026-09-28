// A browser for the classic game screen's tests: happy-dom (from the repository's dev
// dependencies: npm ci first), no board, and a fake Home Assistant.
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost:8123/darts-classic/game" });
globalThis.window = window;
for (const name of ["document", "customElements", "HTMLElement", "localStorage", "ResizeObserver", "location"]) globalThis[name] = window[name];
globalThis.WebSocket = class { close() {} };
globalThis.fetch = async () => ({ json: async () => ({}) });
await import("./autodarts-classic-card.js");

export const P = "autodarts_board";
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
let tick = 0;

// Home Assistant's states for a game of the integration with the given darts in the visit;
// game "off" shows the lobby.
export function states(visit = [], { game = "501", manual = "off", extra = {} } = {}) {
  tick += 1;
  return {
    [`select.${P}_practice_game`]: { state: game, attributes: {}, last_updated: "1" },
    [`sensor.${P}_practice_remaining_score`]: {
      state: "321", last_updated: String(tick),
      attributes: game === "off" ? {} : { game, player: 1, visit, scores: [{ player: 1, name: "A", remaining: 321 }, { player: 2, name: "B", remaining: 501 }] },
    },
    [`sensor.${P}_detection_status`]: { state: "throw", attributes: {}, last_updated: "1" },
    [`switch.${P}_practice_manual_entry`]: { state: manual, attributes: {}, last_updated: "1" },
    [`switch.${P}_detection`]: { state: "on", attributes: {}, last_updated: "1" },
    ...extra,
  };
}

export function mount(hassStates, config = {}) {
  localStorage.clear();
  const calls = [];
  const el = document.createElement("autodarts-classic-card");
  el.setConfig({ board_url: "http://board:3180", ...config });
  document.body.appendChild(el);
  el.hass = { states: hassStates, devices: {}, callService: async (...call) => { calls.push(call); } };
  const $ = (sel) => el.shadowRoot.querySelector(sel);
  const $$ = (sel) => [...el.shadowRoot.querySelectorAll(sel)];
  return { el, calls, $, $$ };
}
