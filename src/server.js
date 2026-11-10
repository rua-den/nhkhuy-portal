const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "services.json");
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 4180);
const HOST = process.env.HOST || "127.0.0.1";
const TOKEN = process.env.ADMIN_TOKEN || "";
const DOMAIN = process.env.BASE_DOMAIN || "nhkhuy.run.place";
const MAX_BODY = 32 * 1024;

fs.mkdirSync(path.dirname(DATA), { recursive: true });
if (!fs.existsSync(DATA)) {
  fs.copyFileSync(path.join(ROOT, "config", "services.json"), DATA);
}

function readDb() {
  return JSON.parse(fs.readFileSync(DATA, "utf8"));
}
function writeDb(db) {
  const tmp = DATA + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, DATA);
}
function send(res, status, value, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "x-content-type-options": "nosniff" });
  res.end(type.startsWith("application/json") ? JSON.stringify(value) : value);
}
function authorized(req) {
  if (!TOKEN) return false;
  const supplied = req.headers.authorization || "";
  const expected = `Bearer ${TOKEN}`;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error("Request body too large");
  }
  return raw ? JSON.parse(raw) : {};
}
function safeId(s) { return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s); }
function safePort(n) { return Number.isInteger(n) && n >= 1024 && n <= 65535; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { status: "ok", service: "nhkhuy-portal" });
  }
  if (req.method === "GET" && url.pathname === "/api/services") {
    const db = readDb();
    return send(res, 200, db.services.filter(x => x.enabled).map(({ id, name, description, url, category, icon }) =>
      ({ id, name, description, url, category, icon })));
  }
  if (url.pathname.startsWith("/api/admin/")) {
    if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });
    if (req.method === "GET" && url.pathname === "/api/admin/services") return send(res, 200, readDb());
    if (req.method === "POST" && url.pathname === "/api/admin/services") {
      try {
        const x = await body(req);
        const id = String(x.id || "").toLowerCase();
        const name = String(x.name || "").trim();
        const port = Number(x.port);
        if (!safeId(id) || !name || !safePort(port)) return send(res, 400, { error: "Use a short lowercase slug, a name, and a local port from 1024–65535." });
        if (["9router", "wedding", "www", "api", "admin"].includes(id)) return send(res, 409, { error: "This subdomain is reserved." });
        const db = readDb();
        if (db.services.some(s => s.id === id)) return send(res, 409, { error: "Service already exists." });
        const service = {
          id, name, description: String(x.description || "").slice(0, 180),
          url: `https://${id}.${DOMAIN}`, category: String(x.category || "Apps").slice(0, 40),
          icon: "app-window", enabled: true, managedProxy: true, upstream: `127.0.0.1:${port}`
        };
        db.services.push(service);
        writeDb(db);
        return send(res, 201, { service, note: "Saved to registry. Proxy activation is a separate deployment step in v0.1." });
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/services/")) {
      try {
        const id = url.pathname.split("/").pop();
        const x = await body(req);
        const db = readDb();
        const service = db.services.find(s => s.id === id);
        if (!service) return send(res, 404, { error: "Service not found." });
        if (typeof x.enabled === "boolean") service.enabled = x.enabled;
        if (x.name) service.name = String(x.name).trim().slice(0, 80);
        if (x.description !== undefined) service.description = String(x.description).slice(0, 180);
        writeDb(db);
        return send(res, 200, { service });
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    return send(res, 404, { error: "Not found" });
  }
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.resolve(PUBLIC, "." + requested);
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const ext = path.extname(file);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
    send(res, 200, data, types[ext] || "application/octet-stream");
  });
});
server.listen(PORT, HOST, () => console.log(`NHKHUY Portal listening on http://${HOST}:${PORT}`));
