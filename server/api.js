import { store } from "./db.js";
import { hashPassword, verifyPassword, newToken, validateCredentials, rateLimit } from "./auth.js";

const SUBJECTS = new Set((process.env.SUBJECTS || "chemistry,geometry").split(",").map(s => s.trim()).filter(Boolean));
const MAX_BODY = 256 * 1024;

export function json(res, status, payload){
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req){
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY){ reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function tokenFrom(req, url){
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return url.searchParams.get("token") || null;   // sendBeacon cannot set headers
}

const publicUser = u => ({ id: u.id, username: u.username, created: u.created });

/** Returns true when it handled the request. */
export async function handleApi(req, res, url){
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const ip = req.socket.remoteAddress || "?";
  const user = store.userForToken(tokenFrom(req, url));

  const need = () => { json(res, 401, { error: "Sign in first." }); return true; };

  try {
    /* ---------- is there a backend at all? ---------- */
    if (path === "/health" && req.method === "GET")
      return json(res, 200, { ok: true, subjects: [...SUBJECTS] }), true;

    /* ---------- accounts ---------- */
    if (path === "/register" && req.method === "POST"){
      if (!rateLimit("reg:" + ip, 5)) return json(res, 429, { error: "Too many attempts. Wait a minute." }), true;
      const { username, password } = await readBody(req);
      const bad = validateCredentials(username, password);
      if (bad) return json(res, 400, { error: bad }), true;
      if (store.userByName(username)) return json(res, 409, { error: "That username is taken." }), true;
      const created = store.createUser(username, hashPassword(password));
      const token = newToken();
      store.addSession(token, created.id);
      return json(res, 201, { token, user: publicUser(created) }), true;
    }

    if (path === "/login" && req.method === "POST"){
      if (!rateLimit("login:" + ip, 10)) return json(res, 429, { error: "Too many attempts. Wait a minute." }), true;
      const { username, password } = await readBody(req);
      if (typeof username !== "string" || typeof password !== "string")
        return json(res, 400, { error: "Username and password are required." }), true;
      const row = store.userByName(username);
      if (!row || !verifyPassword(password, row.pass))
        return json(res, 401, { error: "Wrong username or password." }), true;
      const token = newToken();
      store.addSession(token, row.id);
      return json(res, 200, { token, user: publicUser(row) }), true;
    }

    if (path === "/logout" && req.method === "POST"){
      const t = tokenFrom(req, url);
      if (t) store.dropSession(t);
      return json(res, 200, { ok: true }), true;
    }

    if (path === "/me" && req.method === "GET"){
      if (!user) return need();
      return json(res, 200, { user: publicUser(user) }), true;
    }

    /* ---------- progress ---------- */
    const prog = path.match(/^\/progress\/([a-z]+)$/);
    if (prog){
      if (!user) return need();
      const subject = prog[1];
      if (!SUBJECTS.has(subject)) return json(res, 404, { error: "Unknown subject." }), true;

      if (req.method === "GET"){
        const row = store.getProgress(user.id, subject);
        return json(res, 200, { data: row ? JSON.parse(row.data) : null, updated: row ? row.updated : null }), true;
      }
      if (req.method === "PUT"){
        const { data } = await readBody(req);
        if (!data || typeof data !== "object") return json(res, 400, { error: "Expected a progress object." }), true;
        const updated = store.setProgress(user.id, subject, data);
        return json(res, 200, { ok: true, updated }), true;
      }
    }

    /* ---------- attempts and stats ---------- */
    if (path === "/attempts" && req.method === "POST"){
      if (!user) return need();
      const { attempts } = await readBody(req);
      if (!Array.isArray(attempts)) return json(res, 400, { error: "Expected an attempts array." }), true;
      const rows = attempts.filter(a => a && SUBJECTS.has(a.subject) && typeof a.topic === "string").slice(0, 500);
      if (rows.length) store.addAttempts(user.id, rows);
      return json(res, 200, { ok: true, stored: rows.length }), true;
    }

    if (path === "/stats" && req.method === "GET"){
      if (!user) return need();
      const progress = {};
      for (const row of store.allProgress(user.id)) progress[row.subject] = JSON.parse(row.data);
      return json(res, 200, {
        user: publicUser(user),
        progress,
        topics: store.topicStats(user.id),
        daily: store.dailyStats(user.id, 30)
      }), true;
    }

    return json(res, 404, { error: "No such endpoint." }), true;
  } catch (err){
    const known = err.message === "invalid JSON" || err.message === "body too large";
    return json(res, known ? 400 : 500, { error: known ? err.message : "Server error." }), true;
  }
}
