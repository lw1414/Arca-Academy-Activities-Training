// Morning briefing for Tester.io
//
// Usage:
//   node morning-briefing.mjs preview --demo        # render to briefing/preview.html (no send)
//   node morning-briefing.mjs preview               # same, but with real Supabase leads (24h)
//   node morning-briefing.mjs run                   # send via Resend (default)
//   node morning-briefing.mjs run --gmail           # send via Gmail/NodeMailer
//   node morning-briefing.mjs run --demo            # use sample leads instead of Supabase
//   node morning-briefing.mjs run --dry             # log to stdout, do not send, do not write email_log
//   node morning-briefing.mjs watch                 # daemon: node-cron + Express POST /api/briefing/run-now

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

import { renderEmail } from './briefing/template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- config ----------
const cfg = {
  ai:             process.env.BRIEFING_AI || 'claude',
  anthropicKey:   process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  groqKey:        process.env.GROQ_API_KEY,
  groqModel:      process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  supabaseUrl:    process.env.SUPABASE_URL,
  supabaseKey:    process.env.SUPABASE_ANON_KEY,
  supabaseTable:  process.env.SUPABASE_TABLE || 'form_submissions',
  resendKey:      process.env.RESEND_API_KEY,
  resendFrom:     process.env.RESEND_FROM || 'onboarding@resend.dev',
  gmailUser:      process.env.GMAIL_USER,
  gmailPass:      (process.env.GMAIL_PASS_ARCA || process.env.GMAIL_PASS || '').replace(/\s+/g, ''),
  to:             process.env.BRIEFING_TO,
  tz:             process.env.BRIEFING_TZ || 'Asia/Manila',
  cron:           process.env.BRIEFING_CRON || '0 8 * * *',
  port:           Number(process.env.BRIEFING_PORT || 3100),
  dashboardUrl:   'http://localhost:3000/dashboard.html',
};

// ---------- sample leads (--demo) ----------
const SAMPLE_LEADS = [
  { name: 'Emily Johnson',   email: 'emily.johnson@acmecorp.com',   company: 'Acme Corp',   message: 'Looking to evaluate Tester.io for our 40-engineer team. Need a demo this week.' },
  { name: 'Michael Smith',   email: 'michael.smith@finflow.com',    company: 'FinFlow',     message: 'Migrating from Cypress — what does the importer support?' },
  { name: 'Olivia Brown',    email: 'olivia.brown@growthlab.com',   company: 'GrowthLab',   message: 'Pricing for 12 seats?' },
  { name: 'James Williams',  email: 'james.williams@stackr.com',    company: 'Stackr',      message: 'Hi, just browsing — added to my shortlist for Q3.' },
  { name: 'Sophia Davis',    email: 'sophia.davis@clarityhq.com',   company: 'Clarity HQ',  message: 'We are a fintech. SOC2 report available under NDA?' },
  { name: 'Liam Miller',     email: 'liam.miller@buildco.com',      company: 'BuildCo',     message: 'Want to set up a call to discuss enterprise contracting.' },
].map((l, i) => ({ ...l, created_at: new Date(Date.now() - i * 47 * 60 * 1000).toISOString() }));

// ---------- helpers ----------
function inferCompany(email = '') {
  const dom = (email.split('@')[1] || '').split('.')[0];
  if (!dom) return '';
  return dom.charAt(0).toUpperCase() + dom.slice(1);
}

async function fetchLeads({ demo = false } = {}) {
  if (demo) return SAMPLE_LEADS;
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing in .env');
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = `${cfg.supabaseUrl}/rest/v1/${cfg.supabaseTable}?select=id,name,email,message,created_at&created_at=gte.${since}&order=created_at.desc&limit=200`;
  const r = await fetch(url, { headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows.map(r => ({ ...r, company: inferCompany(r.email) }));
}

// Shared user prompt — same instruction set regardless of which model runs it.
function buildPrompt(leads) {
  return `You are a sales triage assistant for Tester.io, a QA testing platform.

Below are the contact-form signups from the last 24 hours. Rank by buying intent and surface the 3 most promising. Be concise and concrete.

For each top pick, write one sentence (≤24 words) explaining why they look promising. Use signals like: enterprise/team size mentioned, urgency language, specific use case, compliance mentions, migration intent.

Reply with VALID JSON only, no markdown, in this exact shape:
{
  "headline": "≤10-word headline summarizing the day, e.g. 'Strong fintech interest overnight'",
  "top_picks": [{"name":"...","email":"...","company":"...","why":"..."}],
  "notable_companies": ["...", "..."]
}

Signups:
${JSON.stringify(leads.map(l => ({ name: l.name, email: l.email, company: l.company, message: l.message })), null, 2)}`;
}

const SYSTEM_PROMPT = 'You output strictly valid JSON. Never wrap in markdown.';

function fallback(leads) {
  return {
    headline: leads.length ? `${leads.length} new signup${leads.length === 1 ? '' : 's'} overnight` : 'Quiet night — no new signups',
    top_picks: leads.slice(0, 3).map(l => ({ name: l.name, email: l.email, company: l.company, why: 'AI summary skipped — no API key configured.' })),
    notable_companies: [...new Set(leads.map(l => l.company).filter(Boolean))].slice(0, 8),
  };
}

function normalize(parsed, leads) {
  parsed.top_picks = (parsed.top_picks || []).slice(0, 3).map(p => {
    const match = leads.find(l => (l.email || '').toLowerCase() === (p.email || '').toLowerCase());
    return { ...p, company: p.company || match?.company || inferCompany(p.email) };
  });
  parsed.notable_companies = parsed.notable_companies || [];
  parsed.headline = parsed.headline || 'Briefing';
  return parsed;
}

async function summarizeViaGroq(leads) {
  const groq = new Groq({ apiKey: cfg.groqKey });
  const completion = await groq.chat.completions.create({
    model: cfg.groqModel,
    response_format: { type: 'json_object' },
    temperature: 0.4,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(leads) },
    ],
  });
  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  return normalize(parsed, leads);
}

async function summarizeViaClaude(leads) {
  const client = new Anthropic({ apiKey: cfg.anthropicKey });
  const msg = await client.messages.create({
    model: cfg.anthropicModel,
    max_tokens: 1024,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(leads) }],
  });
  // First text block; tolerate stray prose by extracting the first {...} block.
  const text = msg.content.find(b => b.type === 'text')?.text || '{}';
  const match = text.match(/\{[\s\S]*\}/);
  let parsed;
  try { parsed = JSON.parse(match ? match[0] : text); } catch { parsed = {}; }
  return normalize(parsed, leads);
}

async function summarize(leads, { ai } = {}) {
  const provider = ai || cfg.ai;
  const hasClaude = !!cfg.anthropicKey;
  const hasGroq   = !!cfg.groqKey;
  if (provider === 'claude' && hasClaude) return summarizeViaClaude(leads);
  if (provider === 'groq'   && hasGroq)   return summarizeViaGroq(leads);
  // graceful fallback chain: requested provider missing → try the other
  if (hasClaude) return summarizeViaClaude(leads);
  if (hasGroq)   return summarizeViaGroq(leads);
  return fallback(leads);
}

function buildEmail(summary, leads) {
  return renderEmail({
    headline: summary.headline || 'Morning briefing',
    generated_at: new Date(),
    tz: cfg.tz,
    total: leads.length,
    top_picks: summary.top_picks || [],
    notable_companies: summary.notable_companies || [],
    all_leads: leads,
    cta_url: cfg.dashboardUrl,
  });
}

async function sendViaResend({ html, subject, to }) {
  if (!cfg.resendKey) throw new Error('RESEND_API_KEY missing — set it in .env or use --gmail');
  const resend = new Resend(cfg.resendKey);
  const r = await resend.emails.send({ from: cfg.resendFrom, to: [to], subject, html });
  if (r.error) throw new Error(`Resend: ${r.error.message || JSON.stringify(r.error)}`);
  return { id: r.data?.id, provider: 'resend' };
}

async function sendViaGmail({ html, subject, to }) {
  if (!cfg.gmailUser || !cfg.gmailPass) throw new Error('GMAIL_USER / GMAIL_PASS_ARCA missing in .env');
  const tx = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: cfg.gmailUser, pass: cfg.gmailPass },
  });
  const info = await tx.sendMail({ from: cfg.gmailUser, to, subject, html });
  return { id: info.messageId, provider: 'gmail' };
}

async function logToSupabase({ subject, html, status, error, provider, sendId }) {
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return;
  try {
    await fetch(`${cfg.supabaseUrl}/rest/v1/email_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseKey,
        Authorization: 'Bearer ' + cfg.supabaseKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        to_email: cfg.to,
        subject,
        body_html: html,
        source: 'briefing',
        status,
        error: error || null,
      }),
    });
  } catch (e) { console.warn('email_log insert failed:', e.message); }
}

function openInBrowser(filepath) {
  const url = 'http://localhost:3000/' + path.relative(__dirname, filepath).replaceAll('\\', '/');
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref(); } catch {}
  return url;
}

// ---------- commands ----------
async function cmdPreview({ demo, ai }) {
  const leads = await fetchLeads({ demo });
  const summary = await summarize(leads, { ai });
  const html = buildEmail(summary, leads);
  const outDir = path.join(__dirname, 'briefing');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'preview.html');
  fs.writeFileSync(outFile, html, 'utf8');
  const url = openInBrowser(outFile);
  console.log(`✓ preview written: ${path.relative(__dirname, outFile)}`);
  console.log(`  → if serve.mjs is running on :3000, view at: ${url}`);
  console.log(`  → headline: ${summary.headline}`);
  console.log(`  → top picks: ${(summary.top_picks || []).map(p => p.email).join(', ') || '(none)'}`);
  return { headline: summary.headline, total: leads.length, file: outFile };
}

async function cmdRun({ demo, gmail, dry, ai }) {
  if (!cfg.to) throw new Error('BRIEFING_TO missing in .env');
  const leads = await fetchLeads({ demo });
  const summary = await summarize(leads, { ai });
  const html = buildEmail(summary, leads);
  const subject = `Tester.io · ${summary.headline || 'Morning briefing'} (${leads.length})`;
  if (dry) {
    console.log('DRY RUN — would send:');
    console.log('  to:', cfg.to);
    console.log('  subject:', subject);
    console.log('  html size:', html.length, 'bytes');
    return { ok: true, dry: true };
  }
  let sent;
  try {
    sent = gmail ? await sendViaGmail({ html, subject, to: cfg.to }) : await sendViaResend({ html, subject, to: cfg.to });
  } catch (err) {
    await logToSupabase({ subject, html, status: 'failed', error: err.message });
    throw err;
  }
  await logToSupabase({ subject, html, status: 'sent', sendId: sent.id, provider: sent.provider });
  console.log(`✓ sent via ${sent.provider} (id: ${sent.id || 'n/a'}) to ${cfg.to}`);
  console.log(`  subject: ${subject}`);
  return { ok: true, id: sent.id, provider: sent.provider, headline: summary.headline, total: leads.length };
}

function cmdWatch() {
  if (!cron.validate(cfg.cron)) throw new Error(`Bad BRIEFING_CRON: ${cfg.cron}`);
  console.log(`▸ Briefing daemon`);
  console.log(`  cron:    ${cfg.cron} (${cfg.tz})`);
  console.log(`  to:      ${cfg.to}`);
  console.log(`  api:     http://localhost:${cfg.port}`);

  cron.schedule(cfg.cron, async () => {
    const ts = new Date().toLocaleString('en-US', { timeZone: cfg.tz });
    console.log(`[${ts}] cron tick — running briefing…`);
    try { await cmdRun({}); }
    catch (e) { console.error('cron run failed:', e.message); }
  }, { timezone: cfg.tz });

  // mini HTTP API for the dashboard "Run now" button
  const cors = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };
  const srv = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    if (req.method === 'GET' && req.url === '/api/briefing/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, tz: cfg.tz, cron: cfg.cron, to: cfg.to }));
    }

    if (req.method === 'POST' && req.url.startsWith('/api/briefing/run-now')) {
      const u = new URL(req.url, 'http://x');
      const demo = u.searchParams.get('demo') === '1';
      const gmail = u.searchParams.get('gmail') === '1';
      const dry = u.searchParams.get('dry') === '1';
      const ai = u.searchParams.get('ai') || undefined;
      try {
        const result = await cmdRun({ demo, gmail, dry, ai });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }

    if (req.method === 'POST' && req.url.startsWith('/api/briefing/preview')) {
      const u = new URL(req.url, 'http://x');
      const demo = u.searchParams.get('demo') === '1';
      const ai = u.searchParams.get('ai') || undefined;
      try {
        const result = await cmdPreview({ demo, ai });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });
  srv.listen(cfg.port, () => console.log(`  ready  — POST http://localhost:${cfg.port}/api/briefing/run-now`));
}

// ---------- CLI ----------
const [, , command, ...rest] = process.argv;
const flags = new Set(rest);
const opts = {
  demo:  flags.has('--demo'),
  gmail: flags.has('--gmail'),
  dry:   flags.has('--dry'),
  ai:    flags.has('--claude') ? 'claude' : flags.has('--groq') ? 'groq' : undefined,
};

const usage = () => console.log(`Usage:
  node morning-briefing.mjs preview [--demo] [--claude|--groq]
  node morning-briefing.mjs run     [--demo] [--gmail] [--dry] [--claude|--groq]
  node morning-briefing.mjs watch`);

(async () => {
  try {
    if (command === 'preview') await cmdPreview(opts);
    else if (command === 'run') await cmdRun(opts);
    else if (command === 'watch') cmdWatch();
    else { usage(); process.exit(1); }
  } catch (e) {
    console.error('✗', e.message);
    process.exit(1);
  }
})();
