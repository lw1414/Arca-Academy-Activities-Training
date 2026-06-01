import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── .env loader (no dependencies) ───────────────────────────────────────────
function loadEnv() {
  const env = {};
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[k] = v;
    }
  }
  return env;
}
const ENV = { ...loadEnv(), ...process.env };
const PORT = Number(ENV.PORT || 3000);

// ─── kie.ai image-generation proxy (powers FrontendGen.html) ─────────────────
// The KIE API key is read ONLY from .env and never exposed to the browser.
const KIE_API_KEY = (ENV.KIE_API_KEY || '').trim();
const KIE_BASE = (ENV.KIE_API_BASE_URL || 'https://api.kie.ai').replace(/\/+$/, '');
const KIE_GENERATE = `${KIE_BASE}/api/v1/gpt4o-image/generate`;
const KIE_RECORD = `${KIE_BASE}/api/v1/gpt4o-image/record-info`;
const KIE_CREDIT = `${KIE_BASE}/api/v1/chat/credit`;
const KIE_CREATETASK = `${KIE_BASE}/api/v1/jobs/createTask`;
const KIE_JOBS_RECORD = `${KIE_BASE}/api/v1/jobs/recordInfo`;

const MODELS = {
  'gpt4o':         { label: 'GPT-4o Image',  kind: 'gpt4o' },
  'nano-banana':   { label: 'Nano Banana',   kind: 'jobs', model: 'google/nano-banana', aspectKey: 'image_size' },
  'nano-banana-2': { label: 'Nano Banana 2', kind: 'jobs', model: 'nano-banana-2',       aspectKey: 'aspect_ratio', resolution: '2K' },
};
const resolveModel = (k) => (MODELS[k] ? k : 'gpt4o');
const authHeaders = () => ({ Authorization: `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' });

const sendJson = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => resolve(data));
  req.on('error', reject);
});
async function kieFetch(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { httpStatus: r.status, body };
}
async function kieGenerate(modelKey, prompt, size) {
  const cfg = MODELS[resolveModel(modelKey)];
  if (cfg.kind === 'gpt4o') {
    return kieFetch(KIE_GENERATE, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        prompt,
        size: ['1:1', '3:2', '2:3'].includes(size) ? size : '3:2',
        enableFallback: true, fallbackModel: 'FLUX_MAX',
      }),
    });
  }
  const input = { prompt, output_format: 'png' };
  input[cfg.aspectKey] = size || '3:2';
  if (cfg.resolution) input.resolution = cfg.resolution;
  return kieFetch(KIE_CREATETASK, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ model: cfg.model, input }),
  });
}
async function kieRecord(modelKey, taskId) {
  const cfg = MODELS[resolveModel(modelKey)];
  if (cfg.kind === 'gpt4o') {
    const { httpStatus, body } = await kieFetch(`${KIE_RECORD}?taskId=${encodeURIComponent(taskId)}`, { headers: authHeaders() });
    if (httpStatus !== 200) return { status: 'failed', urls: [], progress: null, error: `HTTP ${httpStatus}` };
    const d = body?.data || {};
    let status = 'pending';
    if (d.successFlag === 1) status = 'success';
    else if (d.successFlag === 2 || d.successFlag === 3) status = 'failed';
    return {
      status, urls: d.response?.result_urls || d.response?.resultUrls || [], progress: d.progress ?? null,
      error: status === 'failed' ? (d.errorMessage || body?.msg || 'generation failed') : null,
    };
  }
  const { httpStatus, body } = await kieFetch(`${KIE_JOBS_RECORD}?taskId=${encodeURIComponent(taskId)}`, { headers: authHeaders() });
  if (httpStatus !== 200) return { status: 'failed', urls: [], progress: null, error: `HTTP ${httpStatus}` };
  const d = body?.data || {};
  let urls = [];
  try { const rj = d.resultJson ? JSON.parse(d.resultJson) : {}; urls = rj.resultUrls || rj.result_urls || []; } catch {}
  let status = 'pending';
  if (d.state === 'success') status = 'success';
  else if (d.state === 'fail') status = 'failed';
  return {
    status, urls, progress: typeof d.progress === 'number' ? d.progress : null,
    error: status === 'failed' ? (d.failMsg || body?.msg || 'generation failed') : null,
  };
}

// returns true if the request was an /api/* call and has been handled
async function handleApi(req, res, url) {
  const p = url.pathname;
  if (p === '/api/health') { sendJson(res, 200, { ok: true, hasKey: !!KIE_API_KEY }); return true; }

  if (p === '/api/credits') {
    if (!KIE_API_KEY) { sendJson(res, 200, { ok: false, error: 'KIE_API_KEY is missing in .env' }); return true; }
    const { httpStatus, body } = await kieFetch(KIE_CREDIT, { headers: { Authorization: `Bearer ${KIE_API_KEY}` } });
    if (httpStatus === 200 && body?.code === 200 && typeof body.data === 'number') sendJson(res, 200, { ok: true, credits: body.data });
    else sendJson(res, 200, { ok: false, error: body?.msg || `HTTP ${httpStatus}` });
    return true;
  }

  if (p === '/api/test' && req.method === 'POST') {
    if (!KIE_API_KEY) { sendJson(res, 200, { ok: false, error: 'KIE_API_KEY is missing in .env' }); return true; }
    let tp = {}; try { tp = JSON.parse((await readBody(req)) || '{}'); } catch {}
    const modelKey = resolveModel(tp.model);
    const { httpStatus, body } = await kieGenerate(modelKey, 'a plain light gray square, minimal placeholder', '1:1');
    const taskId = body?.data?.taskId;
    if (httpStatus === 200 && body?.code === 200 && taskId) sendJson(res, 200, { ok: true, taskId, model: modelKey, msg: body.msg || 'success' });
    else sendJson(res, 200, { ok: false, error: body?.msg || `HTTP ${httpStatus}`, detail: body });
    return true;
  }

  if (p === '/api/generate' && req.method === 'POST') {
    if (!KIE_API_KEY) { sendJson(res, 200, { ok: false, error: 'KIE_API_KEY is missing in .env' }); return true; }
    let body0; try { body0 = JSON.parse((await readBody(req)) || '{}'); } catch { sendJson(res, 400, { ok: false, error: 'invalid JSON body' }); return true; }
    if (!body0.prompt) { sendJson(res, 400, { ok: false, error: 'prompt is required' }); return true; }
    const modelKey = resolveModel(body0.model);
    const { httpStatus, body } = await kieGenerate(modelKey, body0.prompt, body0.size);
    const taskId = body?.data?.taskId;
    if (httpStatus === 200 && body?.code === 200 && taskId) sendJson(res, 200, { ok: true, taskId, model: modelKey });
    else sendJson(res, 200, { ok: false, error: body?.msg || `HTTP ${httpStatus}`, detail: body });
    return true;
  }

  if (p === '/api/record' && req.method === 'GET') {
    const taskId = url.searchParams.get('taskId');
    if (!taskId) { sendJson(res, 400, { ok: false, error: 'taskId is required' }); return true; }
    const r = await kieRecord(resolveModel(url.searchParams.get('model')), taskId);
    sendJson(res, 200, { ok: true, ...r });
    return true;
  }
  return false;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
};

// ─── /img proxy (Trend Finder thumbnails — bypass hotlink/CORS) ──────────────
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
async function handleImageProxy(res, target) {
  if (!target) { res.writeHead(400); res.end('Missing url'); return; }
  try {
    const upstream = await fetch(target, { headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*,*/*' } });
    if (!upstream.ok) { res.writeHead(upstream.status); res.end('Upstream image error'); return; }
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' });
    res.end(buf);
  } catch (e) {
    res.writeHead(502); res.end('Image proxy failed: ' + e.message);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // API routes (kie.ai proxy for the Frontend Concept Generator) take priority
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url);
      if (handled) return;
    }

    // Trend Finder thumbnail proxy
    if (url.pathname === '/img') { await handleImageProxy(res, url.searchParams.get('url')); return; }

    const urlPath = decodeURIComponent(url.pathname);
    let filePath = path.join(__dirname, urlPath === '/' ? '/index.html' : urlPath);
    const rel = path.relative(__dirname, filePath);
    if (rel.startsWith('..')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    // never serve the .env (secrets)
    if (filePath.toLowerCase().endsWith('.env')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + urlPath);
      return;
    }
    if (fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);
    const size = stat.size;
    const range = req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : size - 1;
        if (start >= size || end >= size) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': size,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${__dirname} on http://localhost:${PORT}`);
});