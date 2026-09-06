/**
 * Thin client for the study-app backend.
 * Every call resolves to { ok, status, data } — network failures included — so callers
 * can fall back to local-only mode without try/catch at each site.
 */
import { API_BASE } from "./config.js";

const TOKEN_KEY = "studyapp.token";
const USER_KEY  = "studyapp.user";

function read(key){ try { return localStorage.getItem(key); } catch { return null; } }
function write(key, val){
  try { val == null ? localStorage.removeItem(key) : localStorage.setItem(key, val); } catch {}
}

export const api = {
  get token(){ return read(TOKEN_KEY); },
  get user(){ const u = read(USER_KEY); return u ? JSON.parse(u) : null; },
  get signedIn(){ return !!this.token; },

  /** Served as static files (GitHub Pages), there is no API. Ask once, then adapt the UI. */
  available: null,
  async detect(){
    if (this.available !== null) return this.available;
    if (!API_BASE && location.hostname.endsWith("github.io")) return (this.available = false);
    const res = await this.call("/health");
    this.available = !!(res.ok && res.data && res.data.ok);
    return this.available;
  },

  async call(path, { method = "GET", body } = {}){
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = "Bearer " + this.token;
    try {
      const res = await fetch(API_BASE + "/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
      if (res.status === 401) this.clear();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { error: "offline" } };
    }
  },

  remember(token, user){ write(TOKEN_KEY, token); write(USER_KEY, JSON.stringify(user)); },
  clear(){ write(TOKEN_KEY, null); write(USER_KEY, null); },

  register(username, password){ return this.call("/register", { method: "POST", body: { username, password } }); },
  login(username, password){ return this.call("/login", { method: "POST", body: { username, password } }); },
  logout(){ const p = this.call("/logout", { method: "POST" }); this.clear(); return p; },
  me(){ return this.call("/me"); },

  getProgress(subject){ return this.call("/progress/" + subject); },
  putProgress(subject, data){ return this.call("/progress/" + subject, { method: "PUT", body: { data } }); },
  postAttempts(rows){ return this.call("/attempts", { method: "POST", body: { attempts: rows } }); },
  stats(){ return this.call("/stats"); }
};
