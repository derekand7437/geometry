import { api } from "./api.js";
import { debounce } from "./util.js";

/**
 * Appearance settings: background colour, text colour and text size.
 *
 * Local-first, the same shape as progress. Both study sites are served from one origin,
 * so this single localStorage key already themes them together even signed out; signing
 * in carries the same settings to your other devices.
 *
 * Only { bg, ink, size } is ever stored or synced. The derived token map is recomputed
 * from those three and cached under `css` purely so the inline script in <head> can paint
 * the right colours before the first frame, with no colour maths of its own.
 */
const KEY = "studyapp.prefs";

export const SIZES = [
  { id: 90,  label: "Small" },
  { id: 100, label: "Normal" },
  { id: 115, label: "Large" },
  { id: 130, label: "Extra large" }
];

export const BG_PRESETS = [
  { v: "#FFFFFF", n: "White" },        { v: "#F5F0E4", n: "Cream" },
  { v: "#E9EDF1", n: "Cool grey" },    { v: "#EAF1EA", n: "Mint" },
  { v: "#1B2530", n: "Slate" },        { v: "#0C1116", n: "Near black" }
];
export const INK_PRESETS = [
  { v: "#121A22", n: "Ink" },          { v: "#000000", n: "Black" },
  { v: "#2B2118", n: "Sepia" },        { v: "#123A2B", n: "Forest" },
  { v: "#E7EDF3", n: "Paper" },        { v: "#FFFFFF", n: "White" }
];

/* ---------- colour helpers ---------- */
const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
const hex = a => "#" + a.map(v => clamp(v).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const luma = a => (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) / 255;
const WHITE = [255, 255, 255];

export function rgb(value){
  const raw = String(value || "").trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map(c => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

/** Every surface token either subject stylesheet reads. Writing one it does not use is harmless. */
const TOKENS = ["--bg", "--ink", "--ink-2", "--muted", "--line", "--line-2", "--grid",
                "--sheet", "--panel", "--surface", "--surface-2", "--sunk"];

/**
 * Build a coherent palette from just a background and a text colour, so the panels, rules
 * and secondary text stay readable against whatever pair someone picks.
 */
export function derive(bgHex, inkHex){
  const bg = rgb(bgHex), ink = rgb(inkHex);
  if (!bg || !ink) return null;
  const dark = luma(bg) < 0.5;
  const lift = t => hex(mix(bg, WHITE, t));       // surfaces sit above the page in both modes
  const toward = t => hex(mix(bg, ink, t));
  const surface = lift(dark ? 0.08 : 0.62);
  const panel = lift(dark ? 0.05 : 0.34);
  return {
    "--bg": hex(bg),
    "--ink": hex(ink),
    "--ink-2": hex(mix(ink, bg, 0.18)),
    "--muted": hex(mix(ink, bg, 0.42)),
    "--line": toward(0.18),
    "--line-2": toward(0.32),
    "--grid": "rgba(" + ink.join(",") + ",.05)",
    "--sheet": surface,
    "--surface": surface,
    "--panel": panel,
    "--surface-2": panel,
    "--sunk": lift(dark ? 0.03 : 0.44)
  };
}

/* ---------- state ---------- */
function readLocal(){
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    return { bg: raw.bg || "", ink: raw.ink || "", size: Number(raw.size) || 0 };
  } catch { return { bg: "", ink: "", size: 0 }; }
}
function clean(s){
  const out = {};
  if (s.bg && s.ink){ out.bg = s.bg; out.ink = s.ink; }
  if (s.size && s.size !== 100) out.size = s.size;
  return out;
}

let state = readLocal();
const listeners = [];
const pushRemote = debounce(() => { if (api.signedIn) api.putPrefs(clean(state)); }, 600);

export const prefs = {
  get all(){ return clean(state); },
  get colored(){ return !!(state.bg && state.ink); },
  get size(){ return state.size || 100; },

  onChange(fn){ listeners.push(fn); },
  emit(){ const v = this.all; listeners.forEach(f => f(v)); },

  /** Paint the current settings onto the document. */
  apply(){
    const s = document.documentElement.style;
    TOKENS.forEach(t => s.removeProperty(t));
    s.removeProperty("zoom");

    if (state.bg && state.ink){
      const map = derive(state.bg, state.ink);
      if (map) for (const k in map) s.setProperty(k, map[k]);
    }
    const z = state.size || 100;
    if (z !== 100) s.setProperty("zoom", String(z / 100));
  },

  persist(){
    const out = clean(state);
    if (out.bg) out.css = derive(out.bg, out.ink);
    try {
      Object.keys(out).length ? localStorage.setItem(KEY, JSON.stringify(out))
                              : localStorage.removeItem(KEY);
    } catch {}
  },

  set(patch){
    state = Object.assign({}, state, patch);
    this.persist(); this.apply(); this.emit(); pushRemote();
  },

  reset(){
    state = { bg: "", ink: "", size: 0 };
    this.persist(); this.apply(); this.emit(); pushRemote();
  },

  /** What the page is showing right now — seeds the colour pickers on first open. */
  current(){
    const cs = getComputedStyle(document.documentElement);
    const read = (name, fallback) => {
      const parsed = rgb(cs.getPropertyValue(name));
      return parsed ? hex(parsed) : fallback;
    };
    return {
      bg: state.bg || read("--bg", "#ffffff"),
      ink: state.ink || read("--ink", "#111111")
    };
  },

  /** Local wins when set; otherwise adopt the account's copy and push local up. */
  async sync(){
    if (!api.signedIn || !(await api.detect())) return false;
    const res = await api.getPrefs();
    if (!res.ok) return false;
    const remote = (res.data && res.data.data) || null;
    const mine = clean(state);

    if (!Object.keys(mine).length && remote && Object.keys(remote).length){
      state = { bg: remote.bg || "", ink: remote.ink || "", size: Number(remote.size) || 0 };
      this.persist(); this.apply(); this.emit();
      return true;
    }
    if (Object.keys(mine).length) await api.putPrefs(mine);
    return false;
  }
};

prefs.apply();
