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
  home.js       the full-screen home screen — the day you are on, and the way in
  study.js      the question runner: one question, whole screen, Next for the following one
  prefs.js      appearance settings: background colour, text colour, text size
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
| POST | `/api/verify` | step two: the texted code |
| POST | `/api/resend` | text the code again |
| GET/PUT | `/api/prefs` | appearance settings, shared by both subjects |
| GET/PUT | `/api/progress/geometry` | saved progress |
| POST | `/api/attempts` | log answered problems |
| GET | `/api/stats` | accuracy by topic, last 30 days |

Progress is written to `localStorage` first and pushed to the server behind it, so the page
never waits on the network. On load the two copies are merged — the higher count for each
day, and any day either side has finished — so signing in on a new device pulls your history
down, and signing in after working signed-out pushes that work up.

## Two-step verification

Signing up asks for a phone number; signing in asks for the code texted to it. The password
alone never returns a session. The browser does not decide any of this — the server answers
with a pending/challenge id instead of a token when a code is needed, so the same dialog
works whether or not texting is switched on.

Texting needs an SMS provider configured on the backend (`../study-api`, Twilio). Until it
is, phone numbers are still collected but there is no code step, because a code nobody can
receive would lock everyone out.

## The home screen

Every visit opens full-screen. Signed out that is a welcome: the name of the site, what it is
for, and **Log in** / **Sign up**. (A quiet "keep going without an account" sits under them, so
a deploy with no backend — where nobody can sign in — is not a dead end.) Signed in it becomes
your place in the path: which day you are on, how far through you are, and **Start learning**
or **Settings**. The *Home & settings* control in the top bar brings it back, and `#settings`
links straight to the settings screen.

## One question at a time

Questions are never stacked on a page. **Start learning** opens the day full-screen — the
lesson on its own page, then one question per screen, with **Next question** for the following
one. Each library unit keeps its notes and figures on the page and hands practice to the same
runner, so the page is reference and the runner is practice.

Settings covers background colour, text colour and text size. The two colours drive a whole
derived palette — panels, rules and secondary text are computed from the pair, so any
combination stays readable. Text size scales the entire page, drawn figures included.

Settings save to this browser first. Because both study sites are served from one origin they
already share those settings; signing in also carries them to your other devices.

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
