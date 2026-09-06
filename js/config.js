/**
 * Where the backend lives.
 *
 * Empty string means "same origin" — right when you run the site locally with `npm start`.
 * GitHub Pages has no server on the same origin, so point this at the Cloudflare Worker.
 * Paste the URL `npx wrangler deploy` prints, with no trailing slash:
 *
 *   const WORKER_URL = "https://study-api.your-name.workers.dev";
 *
 * Leave it empty and the site still works — it just saves progress in the browser only.
 */
const WORKER_URL = "https://study-api.study-api.workers.dev";

const override = new URLSearchParams(location.search).get("api");   // handy for testing
const onGitHubPages = location.hostname.endsWith("github.io");

export const API_BASE = override || (onGitHubPages ? WORKER_URL : "");
