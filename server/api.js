import { store } from "./db.js";
import { hashPassword, verifyPassword, newToken, validateCredentials, rateLimit,
         normalizePhone, phoneHint, newCode, sealCode, checkCode, smsConfigured, sendCode,
         CODE_TTL_MS, MAX_CODE_TRIES, MAX_CODE_SENDS } from "./auth.js";

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
      return json(res, 200, { ok: true, subjects: [...SUBJECTS], twoFactor: smsConfigured() }), true;

    /* ---------- accounts ---------- */
    if (path === "/register" && req.method === "POST"){
      if (!rateLimit("reg:" + ip, 5)) return json(res, 429, { error: "Too many attempts. Wait a minute." }), true;
      const { username, password, phone } = await readBody(req);
      const bad = validateCredentials(username, password);
      if (bad) return json(res, 400, { error: bad }), true;

      const e164 = normalizePhone(phone);
      if (!e164){
        // A cached older copy of the page has no phone box, so asking for one is a dead end.
        return json(res, 400, { error: phone === undefined
          ? "This page is out of date. Reload it and try again \u2014 pull down to refresh on a phone, or Ctrl+Shift+R (\u2318\u21e7R on a Mac)."
          : "Enter a phone number that can receive texts." }), true;
      }
      if (store.userByName(username)) return json(res, 409, { error: "That username is taken." }), true;

      const pass = hashPassword(password);

      // With no SMS gateway there is no way to prove the number, so keep signup one step
      // rather than asking for a code that can never arrive.
      if (!smsConfigured()){
        const created = store.createUser(username, pass, e164);
        const token = newToken();
        store.addSession(token, created.id);
        return json(res, 201, { token, user: publicUser(created) }), true;
      }

      const code = newCode();
      const sent = await sendCode(e164, code);
      if (!sent.ok) return json(res, 502, { error: sent.error }), true;
      const id = newToken();
      store.addPending({ id, username, pass, phone: e164, code: sealCode(code), expires: Date.now() + CODE_TTL_MS });
      return json(res, 202, { pending: id, phoneHint: phoneHint(e164) }), true;
    }

    if (path === "/login" && req.method === "POST"){
      if (!rateLimit("login:" + ip, 10)) return json(res, 429, { error: "Too many attempts. Wait a minute." }), true;
      const { username, password } = await readBody(req);
      if (typeof username !== "string" || typeof password !== "string")
        return json(res, 400, { error: "Username and password are required." }), true;
      const row = store.userByName(username);
      if (!row || !verifyPassword(password, row.pass))
        return json(res, 401, { error: "Wrong username or password." }), true;
      if (smsConfigured() && row.phone){
        const code = newCode();
        const sent = await sendCode(row.phone, code);
        if (!sent.ok) return json(res, 502, { error: sent.error }), true;
        const id = newToken();
        store.addChallenge(id, row.id, sealCode(code), Date.now() + CODE_TTL_MS);
        return json(res, 202, { challenge: id, phoneHint: phoneHint(row.phone) }), true;
      }

      const token = newToken();
      store.addSession(token, row.id);
      return json(res, 200, { token, user: publicUser(row) }), true;
    }

    /* ---------- step two: the code ---------- */
    if (path === "/verify" && req.method === "POST"){
      if (!rateLimit("verify:" + ip, 60, 300_000))
        return json(res, 429, { error: "Too many attempts. Wait a few minutes." }), true;
      const { pending, challenge, code } = await readBody(req);
      if (typeof code !== "string" || !/^\d{4,8}$/.test(code.trim()))
        return json(res, 400, { error: "Enter the code from the text." }), true;
      const entered = code.trim();

      if (pending){
        const row = store.getPending(pending);
        if (!row) return json(res, 404, { error: "That code has expired. Start again." }), true;
        if (Date.now() > row.expires){
          store.dropPending(pending);
          return json(res, 410, { error: "That code has expired. Start again." }), true;
        }
        if (!checkCode(entered, row.code)){
          const tries = row.tries + 1;
          if (tries >= MAX_CODE_TRIES){
            store.dropPending(pending);
            return json(res, 429, { error: "Too many wrong codes. Start again." }), true;
          }
          store.pendingTries(pending, tries);
          return json(res, 401, { error: `That code is not right. ${MAX_CODE_TRIES - tries} tries left.` }), true;
        }
        store.dropPending(pending);
        if (store.userByName(row.username))
          return json(res, 409, { error: "That username was taken while you were verifying." }), true;
        const created = store.createUser(row.username, row.pass, row.phone);
        const token = newToken();
        store.addSession(token, created.id);
        return json(res, 201, { token, user: publicUser(created) }), true;
      }

      if (challenge){
        const row = store.getChallenge(challenge);
        if (!row) return json(res, 404, { error: "That code has expired. Sign in again." }), true;
        if (Date.now() > row.expires){
          store.dropChallenge(challenge);
          return json(res, 410, { error: "That code has expired. Sign in again." }), true;
        }
        if (!checkCode(entered, row.code)){
          const tries = row.tries + 1;
          if (tries >= MAX_CODE_TRIES){
            store.dropChallenge(challenge);
            return json(res, 429, { error: "Too many wrong codes. Sign in again." }), true;
          }
          store.challengeTries(challenge, tries);
          return json(res, 401, { error: `That code is not right. ${MAX_CODE_TRIES - tries} tries left.` }), true;
        }
        store.dropChallenge(challenge);
        const who = store.userById(row.user_id);
        if (!who) return json(res, 404, { error: "That account is gone." }), true;
        const token = newToken();
        store.addSession(token, who.id);
        return json(res, 200, { token, user: publicUser(who) }), true;
      }

      return json(res, 400, { error: "Nothing to verify." }), true;
    }

    /* ---------- send it again ---------- */
    if (path === "/resend" && req.method === "POST"){
      if (!rateLimit("resend:" + ip, 20, 300_000))
        return json(res, 429, { error: "Too many texts requested. Wait a few minutes." }), true;
      const { pending, challenge } = await readBody(req);
      const row = pending ? store.getPending(pending) : challenge ? store.getChallenge(challenge) : null;
      if (!row) return json(res, 400, { error: "Nothing to resend." }), true;
      if (Date.now() > row.expires) return json(res, 404, { error: "That code has expired. Start again." }), true;
      if (row.sends >= MAX_CODE_SENDS) return json(res, 429, { error: "That is as many texts as we can send. Start again." }), true;

      const to = pending ? row.phone : (store.userByName((store.userById(row.user_id) || {}).username) || {}).phone;
      if (!to) return json(res, 404, { error: "No number on file." }), true;

      const code = newCode();
      const sent = await sendCode(to, code);
      if (!sent.ok) return json(res, 502, { error: sent.error }), true;
      const expires = Date.now() + CODE_TTL_MS;
      pending ? store.pendingResend(pending, sealCode(code), row.sends + 1, expires)
              : store.challengeResend(challenge, sealCode(code), row.sends + 1, expires);
      return json(res, 200, { ok: true, phoneHint: phoneHint(to) }), true;
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

    /* ---------- appearance settings, shared by both subjects ---------- */
    if (path === "/prefs"){
      if (!user) return need();

      if (req.method === "GET"){
        const row = store.getPrefs(user.id);
        return json(res, 200, { data: row ? JSON.parse(row.data) : null, updated: row ? row.updated : null }), true;
      }
      if (req.method === "PUT"){
        const { data } = await readBody(req);
        if (!data || typeof data !== "object" || Array.isArray(data))
          return json(res, 400, { error: "Expected a settings object." }), true;
        const updated = store.setPrefs(user.id, data);
        return json(res, 200, { ok: true, updated }), true;
      }
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
