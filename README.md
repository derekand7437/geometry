# Compass and Proof

A study site for first-semester (10th grade) geometry: a 21-day guided path that starts from
nothing, plus a reference library with practice problems that never run out.

It runs two ways from the same code.

**As a plain static site** (GitHub Pages) it works completely on its own — every lesson,
every generated problem, every figure. Progress saves in the visitor's browser, and the
sign-in control hides itself because there is no server to sign in to.

**With its backend** (`npm start`) the same pages gain accounts, progress that follows you
between devices, and a stats panel showing accuracy by topic and the last 30 days.

## Running it with the backend

```bash
npm start          # http://localhost:3000
```

Nothing to install: the server uses only Node's built-in modules, and the database is a
SQLite file created on first run at `data/study.db`. Needs Node 22.5 or newer.

```bash
npm run dev        # restarts when you edit a file
PORT=8080 npm start
```

## Layout

```
index.html      the page
css/            base.css (shell, charts) + the subject stylesheet
js/
  main.js       boots everything
  engine.js     the drill engine and the 21-day path
  store.js      progress — saved locally, synced to the server when signed in
  api.js        backend client; detects whether a backend exists at all
  account.js    the sign-in dialog
  charts.js     the two stats charts
  stats.js      the stats panel
  *-content.js  the lessons, problem generators and data
  *-extras.js   the extras on this page
server/
  index.js      HTTP server — serves index.html, css/ and js/, nothing else
  api.js        the JSON API
  db.js         SQLite schema and queries
  auth.js       scrypt hashing, session tokens, rate limiting
data/study.db   created on first run; not in git
```

## The API

| Method | Path | Does |
|---|---|---|
| GET | `/api/health` | is a backend present |
| POST | `/api/register` · `/login` · `/logout` | accounts |
| GET | `/api/me` | who am I |
| GET/PUT | `/api/progress/geometry` | saved progress |
| POST | `/api/attempts` | log answered problems |
| GET | `/api/stats` | accuracy by topic, last 30 days |

Progress is written to `localStorage` first and pushed to the server behind it, so the page
never waits on the network. On load the two copies are merged — the higher count for each
day, and any day either side has finished — so signing in on a new device pulls your history
down, and signing in after working signed-out pushes that work up.

## Publishing it

**Static (free, no accounts):** push to GitHub, then Settings → Pages → deploy from `main`,
folder `/ (root)`. The site works; sign-in stays hidden.

**With the backend:** deploy to a host that runs Node — on Render, for example, create a Web
Service from this repo with start command `npm start`. Note that free tiers usually wipe the
disk on redeploy, which would erase `data/study.db`; a real deployment wants a hosted database.

## Accounts on the live site

GitHub Pages serves files but cannot run a server, so on the published site this page saves
progress in the visitor's own browser and hides the sign-in control.

To turn on real accounts, deploy the shared API in `../study-api` (Cloudflare Workers + D1,
free), then paste the URL it prints into `js/config.js`:

```js
const WORKER_URL = "https://study-api.your-name.workers.dev";
```

Commit, push, and the live site gains account creation, cross-device progress and the stats
panel. One account covers both the chemistry and geometry sites.

## The 21 days

Points, lines and notation · classifying angles · complementary and supplementary ·
vertical angles and linear pairs · parallel lines and a transversal · finding angle measures ·
solving for x · the triangle angle sum · SSS and SAS · ASA, AAS and HL · what does not prove
congruence · the Pythagorean theorem · missing legs · special right triangles · similarity ·
perimeter and area ratios · distance · midpoint and slope · central and inscribed angles ·
arc length and sector area · area and volume.

## Security notes

Passwords are hashed with scrypt and a per-user salt and compared in constant time. Session
tokens are 32 random bytes, revoked on sign-out. Register and login are rate-limited per IP.
Request bodies are capped, and the static handler serves only `index.html`, `css/` and `js/` —
`server/` and `data/` are unreachable over HTTP.
