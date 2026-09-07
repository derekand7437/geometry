import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.env.DB_FILE || join(root, "data", "study.db");
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

/** Older databases were created before accounts had a phone number. */
function addColumnIfMissing(table, column, decl){
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass     TEXT NOT NULL,
    phone    TEXT,
    created  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pending_signups (
    id       TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    pass     TEXT NOT NULL,
    phone    TEXT NOT NULL,
    code     TEXT NOT NULL,
    tries    INTEGER NOT NULL DEFAULT 0,
    sends    INTEGER NOT NULL DEFAULT 1,
    expires  INTEGER NOT NULL,
    created  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_challenges (
    id      TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code    TEXT NOT NULL,
    tries   INTEGER NOT NULL DEFAULT 0,
    sends   INTEGER NOT NULL DEFAULT 1,
    expires INTEGER NOT NULL,
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token   TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    data    TEXT NOT NULL,
    updated TEXT NOT NULL,
    PRIMARY KEY (user_id, subject)
  );
  CREATE TABLE IF NOT EXISTS prefs (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data    TEXT NOT NULL,
    updated TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic   TEXT NOT NULL,
    correct INTEGER NOT NULL,
    day     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id, day);
`);

addColumnIfMissing("users", "phone", "TEXT");

const q = {
  createUser:  db.prepare("INSERT INTO users (username, pass, phone, created) VALUES (?, ?, ?, ?)"),
  addPending:  db.prepare(`INSERT INTO pending_signups (id, username, pass, phone, code, expires, created)
                           VALUES (?, ?, ?, ?, ?, ?, ?)`),
  getPending:  db.prepare("SELECT * FROM pending_signups WHERE id = ?"),
  dropPending: db.prepare("DELETE FROM pending_signups WHERE id = ?"),
  pendTries:   db.prepare("UPDATE pending_signups SET tries = ? WHERE id = ?"),
  pendResend:  db.prepare("UPDATE pending_signups SET code = ?, tries = 0, sends = ?, expires = ? WHERE id = ?"),
  addChal:     db.prepare("INSERT INTO login_challenges (id, user_id, code, expires, created) VALUES (?, ?, ?, ?, ?)"),
  getChal:     db.prepare("SELECT * FROM login_challenges WHERE id = ?"),
  dropChal:    db.prepare("DELETE FROM login_challenges WHERE id = ?"),
  chalTries:   db.prepare("UPDATE login_challenges SET tries = ? WHERE id = ?"),
  chalResend:  db.prepare("UPDATE login_challenges SET code = ?, tries = 0, sends = ?, expires = ? WHERE id = ?"),
  userByName:  db.prepare("SELECT * FROM users WHERE username = ?"),
  userById:    db.prepare("SELECT id, username, created FROM users WHERE id = ?"),
  addSession:  db.prepare("INSERT INTO sessions (token, user_id, created) VALUES (?, ?, ?)"),
  session:     db.prepare("SELECT user_id FROM sessions WHERE token = ?"),
  dropSession: db.prepare("DELETE FROM sessions WHERE token = ?"),
  getPrefs:    db.prepare("SELECT data, updated FROM prefs WHERE user_id = ?"),
  setPrefs:    db.prepare(`INSERT INTO prefs (user_id, data, updated) VALUES (?, ?, ?)
                           ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated`),
  getProgress: db.prepare("SELECT data, updated FROM progress WHERE user_id = ? AND subject = ?"),
  setProgress: db.prepare(`INSERT INTO progress (user_id, subject, data, updated) VALUES (?, ?, ?, ?)
                           ON CONFLICT(user_id, subject) DO UPDATE SET data = excluded.data, updated = excluded.updated`),
  allProgress: db.prepare("SELECT subject, data, updated FROM progress WHERE user_id = ?"),
  addAttempt:  db.prepare("INSERT INTO attempts (user_id, subject, topic, correct, day) VALUES (?, ?, ?, ?, ?)"),
  topicStats:  db.prepare(`SELECT subject, topic, COUNT(*) AS total, SUM(correct) AS right
                           FROM attempts WHERE user_id = ? GROUP BY subject, topic ORDER BY total DESC`),
  dailyStats:  db.prepare(`SELECT day, COUNT(*) AS total, SUM(correct) AS right
                           FROM attempts WHERE user_id = ? AND day >= ? GROUP BY day ORDER BY day`)
};

export const store = {
  createUser(username, pass, phone){
    q.createUser.run(username, pass, phone || null, new Date().toISOString());
    return q.userByName.get(username);
  },

  addPending(row){ q.addPending.run(row.id, row.username, row.pass, row.phone, row.code, row.expires, new Date().toISOString()); },
  getPending:  id => q.getPending.get(id) || null,
  dropPending: id => q.dropPending.run(id),
  pendingTries(id, n){ q.pendTries.run(n, id); },
  pendingResend(id, code, sends, expires){ q.pendResend.run(code, sends, expires, id); },

  addChallenge(id, userId, code, expires){ q.addChal.run(id, userId, code, expires, new Date().toISOString()); },
  getChallenge:  id => q.getChal.get(id) || null,
  dropChallenge: id => q.dropChal.run(id),
  challengeTries(id, n){ q.chalTries.run(n, id); },
  challengeResend(id, code, sends, expires){ q.chalResend.run(code, sends, expires, id); },
  userByName: name => q.userByName.get(name),
  userById:   id   => q.userById.get(id),
  addSession(token, userId){ q.addSession.run(token, userId, new Date().toISOString()); },
  userForToken(token){
    if (!token) return null;
    const row = q.session.get(token);
    return row ? q.userById.get(row.user_id) : null;
  },
  dropSession: token => q.dropSession.run(token),

  getPrefs(userId){ return q.getPrefs.get(userId) || null; },
  setPrefs(userId, data){
    const now = new Date().toISOString();
    q.setPrefs.run(userId, JSON.stringify(data), now);
    return now;
  },

  getProgress(userId, subject){ return q.getProgress.get(userId, subject) || null; },
  setProgress(userId, subject, data){
    const now = new Date().toISOString();
    q.setProgress.run(userId, subject, JSON.stringify(data), now);
    return now;
  },
  allProgress: userId => q.allProgress.all(userId),

  addAttempts(userId, rows){
    const insert = db.prepare("INSERT INTO attempts (user_id, subject, topic, correct, day) VALUES (?, ?, ?, ?, ?)");
    db.exec("BEGIN");
    try {
      for (const r of rows){
        const day = new Date(Number(r.at) || Date.now()).toISOString().slice(0, 10);
        insert.run(userId, String(r.subject).slice(0, 32), String(r.topic).slice(0, 32), r.correct ? 1 : 0, day);
      }
      db.exec("COMMIT");
    } catch (e){ db.exec("ROLLBACK"); throw e; }
  },
  topicStats: userId => q.topicStats.all(userId),
  dailyStats(userId, days){
    const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    return q.dailyStats.all(userId, from);
  }
};
