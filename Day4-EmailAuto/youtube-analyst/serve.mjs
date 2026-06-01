// Minimal zero-dependency dev server for the YouTube Analyst dashboard.
//
//   node serve.mjs           -> http://localhost:5173
//
// Endpoints:
//   GET  /                -> serves youtube-analyst.html
//   POST /api/run         -> writes .tmp/run_config.json, launches the Python
//                            pipeline, and streams its output
//   GET  /api/status      -> current run state + accumulated log
//
// The browser only TRIGGERS the pipeline; all real work happens in the
// deterministic Python tools.

import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = 5173;

// Pick the venv Python if present, else fall back to system python.
const PY_VENV = join(ROOT, ".venv", "Scripts", "python.exe");
const PYTHON = (await fileExists(PY_VENV)) ? PY_VENV : "python";

// In-memory run state (single-run-at-a-time, matches the manual workflow).
const run = { state: "idle", log: "", startedAt: null, finishedAt: null };

async function fileExists(p) {
  try { await readFile(p); return true; } catch { return false; }
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

async function startPipeline(cfg) {
  if (run.state === "running") return false;

  await mkdir(join(ROOT, ".tmp"), { recursive: true });
  await writeFile(
    join(ROOT, ".tmp", "run_config.json"),
    JSON.stringify(cfg, null, 2),
    "utf-8",
  );

  run.state = "running";
  run.log = "";
  run.startedAt = new Date().toISOString();
  run.finishedAt = null;

  const args = [join("tools", "run_weekly_report.py")];
  if (cfg.no_email) args.push("--no-email");

  const child = spawn(PYTHON, args, { cwd: ROOT });
  child.stdout.on("data", (d) => { run.log += d.toString(); });
  child.stderr.on("data", (d) => { run.log += d.toString(); });
  child.on("close", (code) => {
    run.state = code === 0 ? "success" : "error";
    run.finishedAt = new Date().toISOString();
    run.log += `\n[server] Pipeline exited with code ${code}.\n`;
  });
  return true;
}

const server = createServer(async (req, res) => {
  // CORS for local dev convenience.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (req.method === "GET" && req.url === "/") {
    try {
      const html = await readFile(join(ROOT, "youtube-analyst.html"), "utf-8");
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(html);
    } catch {
      res.writeHead(404);
      return res.end("youtube-analyst.html not found");
    }
  }

  if (req.method === "GET" && req.url === "/api/status") {
    return json(res, 200, run);
  }

  if (req.method === "POST" && req.url === "/api/run") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let cfg = {};
      try { cfg = body ? JSON.parse(body) : {}; }
      catch { return json(res, 400, { error: "Invalid JSON" }); }
      const ok = await startPipeline(cfg);
      if (!ok) return json(res, 409, { error: "A run is already in progress" });
      return json(res, 202, { state: run.state });
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n  YouTube Analyst dashboard running:`);
  console.log(`  -> http://localhost:${PORT}\n`);
  console.log(`  Python: ${PYTHON}`);
});
