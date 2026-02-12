import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2]) || 4173;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function safeResolve(urlPath) {
  const normalized = decodeURIComponent(urlPath).replace(/\\/g, "/");
  const withoutQuery = normalized.split("?")[0].split("#")[0];
  const relativePath = withoutQuery === "/" ? "/examples/index.html" : withoutQuery;
  const absolute = path.resolve(ROOT, `.${relativePath}`);

  if (!absolute.startsWith(ROOT)) {
    return null;
  }

  return absolute;
}

async function sendFile(res, absolutePath) {
  try {
    const fileStat = await stat(absolutePath);
    if (fileStat.isDirectory()) {
      return sendFile(res, path.join(absolutePath, "index.html"));
    }

    const data = await readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const type = CONTENT_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const target = safeResolve(req.url || "/");
  if (!target) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  await sendFile(res, target);
});

server.listen(PORT, () => {
  console.log(`BetterDataTable demo server running at http://localhost:${PORT}/`);
  console.log("Serving project root with /examples/index.html as default.");
});

