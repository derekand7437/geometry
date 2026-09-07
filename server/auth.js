import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const KEYLEN = 64;

/** scrypt with a per-user random salt; stored as "salt:hash". */
export function hashPassword(password){
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, KEYLEN).toString("hex");
}

export function verifyPassword(password, stored){
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, KEYLEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const newToken = () => randomBytes(32).toString("hex");

export function validateCredentials(username, password){
  if (typeof username !== "string" || typeof password !== "string") return "Username and password are required.";
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(username)) return "Usernames are 3–24 characters: letters, numbers, underscore or hyphen.";
  if (password.length < 8) return "Passwords need at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

/** Crude in-memory throttle so the login endpoint cannot be ground through. */
const hits = new Map();
export function rateLimit(key, max = 10, windowMs = 60_000){
  const now = Date.now();
  const rec = hits.get(key) || { n: 0, until: now + windowMs };
  if (now > rec.until){ rec.n = 0; rec.until = now + windowMs; }
  rec.n++;
  hits.set(key, rec);
  if (hits.size > 5000) hits.clear();
  return rec.n <= max;
}

/* ---------- phone numbers and verification codes ---------- */

/** Normalise to E.164. A bare 10-digit number is assumed US — both sites are one US course. */
export function normalizePhone(raw){
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (plus) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
}

export const phoneHint = e164 => "\u2022\u2022\u2022\u2022 " + String(e164).slice(-4);

/** Six digits, uniform (reject the tail rather than take the modulo bias). */
export function newCode(){
  const max = Math.floor(0xFFFFFFFF / 1000000) * 1000000;
  let n = randomBytes(4).readUInt32BE(0);
  while (n >= max) n = randomBytes(4).readUInt32BE(0);
  return String(n % 1000000).padStart(6, "0");
}

/** Salted SHA-256: a six-digit code is too small a space for a slow hash to rescue, so the
 *  real defences are the ten-minute expiry, the five-try limit and single use. */
export function sealCode(code){
  const salt = randomBytes(16).toString("hex");
  return salt + "$" + createHash("sha256").update(salt + ":" + code).digest("hex");
}

export function checkCode(code, stored){
  const [salt, want] = String(stored).split("$");
  if (!salt || !want) return false;
  const got = createHash("sha256").update(salt + ":" + code).digest("hex");
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_TRIES = 5;
export const MAX_CODE_SENDS = 4;

/** The Node backend has no SMS gateway wired up; the Worker deployment is where texting
 *  lives. Returning false here keeps signup and login one step, rather than asking for a
 *  code that can never arrive. */
export const smsConfigured = () => false;
export async function sendCode(){ return { ok: false, error: "SMS is not configured." }; }
