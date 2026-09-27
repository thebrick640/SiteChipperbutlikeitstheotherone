#!/usr/bin/env node
// Local dev server that mirrors Firebase Hosting routing from firebase.json.
// With --emulators it also proxies the Auth/Firestore/Storage emulators on the
// same origin, so an https preview can reach them without mixed-content errors,
// and injects window.__CB_EMULATOR__ so js/firebase.js targets them.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const PORT = Number(arg("--port", process.env.PORT || 8000));
const HOST = String(arg("--host", "0.0.0.0"));
const EMULATORS = Boolean(arg("--emulators", process.env.CB_EMULATORS === "1"));
const PROJECT = String(arg("--project", process.env.GCLOUD_PROJECT || "demo-coolbrador"));
const EMU = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099",
  firestore: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
  storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199",
};

const hosting = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8")).hosting || {};

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".webmanifest": "application/manifest+json",
};

function escapeRe(s) { return s.replace(/[.+^${}()|[\]\\]/g, "\\$&"); }

// Firebase Hosting glob subset: **, *, ?, {a,b}, @(a|b) and :param / :param* captures.
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { re += "(?:.*/)?"; i += 2; }
      else if (re.endsWith("/")) { re = re.slice(0, -1) + "(?:/.*)?"; i += 1; }
      else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "@" && glob[i + 1] === "(") {
      const end = glob.indexOf(")", i);
      re += "(?:" + glob.slice(i + 2, end).split("|").map(escapeRe).join("|") + ")";
      i = end;
    } else if (c === "{") {
      const end = glob.indexOf("}", i);
      re += "(?:" + glob.slice(i + 1, end).split(",").map(escapeRe).join("|") + ")";
      i = end;
    } else if (c === ":" && /[A-Za-z_]/.test(glob[i + 1] || "")) {
      const m = /^:([A-Za-z_][A-Za-z0-9_]*)(\*)?/.exec(glob.slice(i));
      re += m[2] ? `(?<${m[1]}>.*)` : `(?<${m[1]}>[^/]+)`;
      i += m[0].length - 1;
    } else re += escapeRe(c);
  }
  return new RegExp("^" + re + "$");
}

const ignoreRes = (hosting.ignore || []).map(globToRegExp);
const rewrites = (hosting.rewrites || []).map((r) => ({ ...r, re: globToRegExp(r.source) }));
const redirects = (hosting.redirects || []).map((r) => ({ ...r, re: globToRegExp(r.source) }));

function isIgnored(rel) {
  return ignoreRes.some((re) => re.test(rel));
}

function resolveFile(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  const abs = path.normalize(path.join(ROOT, decoded));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  if (rel && isIgnored(rel)) return null;
  let st;
  try { st = fs.statSync(abs); } catch { return null; }
  if (st.isFile()) return abs;
  if (st.isDirectory()) {
    const idx = path.join(abs, "index.html");
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

const EMULATOR_SNIPPET = () =>
  `<script>window.__CB_EMULATOR__=${JSON.stringify({ projectId: PROJECT })};</script>`;

function sendFile(res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const headers = { "Content-Type": type, "Cache-Control": "no-store" };
  if (ext === ".html" && EMULATORS) {
    let html = fs.readFileSync(file, "utf8");
    const m = /<head[^>]*>/i.exec(html);
    html = m ? html.slice(0, m.index + m[0].length) + EMULATOR_SNIPPET() + html.slice(m.index + m[0].length)
      : EMULATOR_SNIPPET() + html;
    res.writeHead(status, headers);
    res.end(html);
    return;
  }
  res.writeHead(status, headers);
  fs.createReadStream(file).pipe(res);
}

function proxyTarget(urlPath) {
  if (!EMULATORS) return null;
  if (urlPath.startsWith("/identitytoolkit.googleapis.com/") || urlPath.startsWith("/securetoken.googleapis.com/")) return EMU.auth;
  if (urlPath.startsWith("/emulator/")) return /\/databases\//.test(urlPath) ? EMU.firestore : EMU.auth;
  if (urlPath.startsWith("/google.firestore.v1.Firestore/") || urlPath.startsWith("/v1/projects/")) return EMU.firestore;
  if (urlPath.startsWith("/v0/b/") || urlPath.startsWith("/upload/storage/") || urlPath.startsWith("/storage/v1/")) return EMU.storage;
  return null;
}

function proxy(req, res, target) {
  const [host, port] = target.split(":");
  const upstream = http.request(
    { host, port: Number(port), method: req.method, path: req.url, headers: { ...req.headers, host: target } },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    }
  );
  upstream.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Emulator proxy error: " + err.message);
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  const target = proxyTarget(p);
  if (target) return proxy(req, res, target);

  // Firebase Hosting order: redirects, exact static file, rewrites, 404.
  for (const r of redirects) {
    const m = r.re.exec(p);
    if (!m) continue;
    let dest = r.destination;
    for (const [k, v] of Object.entries(m.groups || {})) dest = dest.replace(new RegExp(":" + k + "\\*?", "g"), v || "");
    res.writeHead(r.type || 301, { Location: dest });
    return res.end();
  }

  const file = resolveFile(p);
  if (file) return sendFile(res, file);

  for (const r of rewrites) {
    if (!r.re.test(p)) continue;
    if (r.destination) {
      const dest = resolveFile(r.destination);
      if (dest) return sendFile(res, dest);
    } else if (r.function) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: `Cloud Function "${r.function}" is not served by the dev server` }));
    }
  }

  const notFound = resolveFile("/404.html");
  if (notFound) return sendFile(res, notFound, 404);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  const mode = EMULATORS ? `emulators (${PROJECT})` : "production Firebase";
  console.log(`Coolbrador dev server on http://${HOST}:${PORT} using ${mode}`);
});
