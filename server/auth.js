import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
