import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi, json } from "./api.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3000;

const TYPES = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".svg":"image/svg+xml", ".ico":"image/x-icon" };

/** Only the front end is public. server/, data/ and everything else stay unreachable. */
function resolvePublic(pathname){
  if (pathname === "/" || pathname === "/index.html") return join(root, "index.html");
  const rel = normalize(pathname).replace(/^[/\\]+/, "");
  if (!/^(css|js)\//.test(rel)) return null;
  const file = join(root, rel);
  return file.startsWith(join(root, "css")) || file.startsWith(join(root, "js")) ? file : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) { await handleApi(req, res, url); return; }
    if (req.method !== "GET" && req.method !== "HEAD"){ res.writeHead(405).end("Method not allowed"); return; }

    const file = resolvePublic(url.pathname);
    if (!file){ res.writeHead(404, { "Content-Type":"text/plain" }).end("Not found"); return; }
    const info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()){ res.writeHead(404, { "Content-Type":"text/plain" }).end("Not found"); return; }

    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": extname(file) === ".html" ? "no-cache" : "public, max-age=300" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (err){
    console.error("request failed:", err);
    if (!res.headersSent) json(res, 500, { error: "Server error." });
    else res.end();
  }
});

server.listen(PORT, () => console.log(`Compass and Proof running at http://localhost:${PORT}`));
