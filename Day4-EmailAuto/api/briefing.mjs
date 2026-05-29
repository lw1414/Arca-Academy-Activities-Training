// Vercel serverless handler for the morning briefing.
//
// Invoked two ways:
//   1. Vercel Cron — daily at 07:00 Asia/Manila (configured in vercel.json,
//      stored as UTC = 23:00 of the previous day).
//   2. Manual trigger from the dashboard's "Run now" button (with ?secret=...).
//
// Vercel Hobby limits:
//   • 1 cron schedule per project (we use the one for the daily briefing)
//   • 10s default function timeout — should be plenty for a single Claude/Groq
//     call + a single Resend POST.
//
// Required env vars on Vercel (set in dashboard → Settings → Environment):
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL,
//   SUPABASE_URL, SUPABASE_ANON_KEY,
//   RESEND_API_KEY, RESEND_FROM,
//   BRIEFING_TO, BRIEFING_TZ, BRIEFING_SECRET
//   Optional fallback: GROQ_API_KEY, GROQ_MODEL

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { Resend } from 'resend';
import { renderEmail } from '../briefing/template.mjs';

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
  to:             process.env.BRIEFING_TO,
  tz:             process.env.BRIEFING_TZ || 'Asia/Manila',
  secret:         process.env.BRIEFING_SECRET,
  dashboardUrl:   process.env.PUBLIC_SITE_URL ? `${process.env.PUBLIC_SITE_URL}/dashboard.html` : 'http://localhost:3000/dashboard.html',
};

const SAMPLE_LEADS = [
  { name: 'Emily Johnson',   email: 'emily.johnson@acmecorp.com',   company: 'Acme Corp',   message: 'Looking to evaluate Tester.io for our 40-engineer team. Need a demo this week.' },
  { name: 'Michael Smith',   email: 'michael.smith@finflow.com',    company: 'FinFlow',     message: 'Migrating from Cypress — what does the importer support?' },
  { name: 'Olivia Brown',    email: 'olivia.brown@growthlab.com',   company: 'GrowthLab',   message: 'Pricing for 12 seats?' },
  { name: 'James Williams',  email: 'james.williams@stackr.com',    company: 'Stackr',      message: 'Hi, just browsing — added to my shortlist for Q3.' },
  { name: 'Sophia Davis',    email: 'sophia.davis@clarityhq.com',   company: 'Clarity HQ',  message: 'We are a fintech. SOC2 report available under NDA?' },
  { name: 'Liam Miller',     email: 'liam.miller@buildco.com',      company: 'BuildCo',     message: 'Want to set up a call to discuss enterprise contracting.' },
].map((l, i) => ({ ...l, created_at: new Date(Date.now() - i * 47 * 60 * 1000).toISOString() }));

const inferCompany = (email = '') => {
  const dom = (email.split('@')[1] || '').split('.')[0];
  return dom ? dom.charAt(0).toUpperCase() + dom.slice(1) : '';
};

async function fetchLeads(demo) {
  if (demo) return SAMPLE_LEADS;
  if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY missing');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = `${cfg.supabaseUrl}/rest/v1/${cfg.supabaseTable}?select=id,name,email,message,created_at&created_at=gte.${since}&order=created_at.desc&limit=200`;
  const r = await fetch(url, { headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows.map(r => ({ ...r, company: inferCompany(r.email) }));
}

function buildPrompt(leads) {
  return `You are a sales triage assistant for Tester.io, a QA testing platform.

Below are the contact-form signups from the last 24 hours. Rank by buying intent and surface the 3 most promising. Be concise and concrete.

For each top pick, write one sentence (≤24 words) explaining why they look promising.

Reply with VALID JSON only, no markdown:
{ "headline": "...", "top_picks": [{"name":"...","email":"...","company":"...","why":"..."}], "notable_companies": ["..."] }

Signups:
${JSON.stringify(leads.map(l => ({ name: l.name, email: l.email, company: l.company, message: l.message })), null, 2)}`;
}

function normalize(parsed, leads) {
  parsed.top_picks = (parsed.top_picks || []).slice(0, 3).map(p => ({ ...p, company: p.company || inferCompany(p.email) }));
  parsed.notable_companies = parsed.notable_companies || [];
  parsed.headline = parsed.headline || 'Briefing';
  return parsed;
}

async function summarize(leads, ai) {
  const provider = ai || cfg.ai;
  const sys = 'You output strictly valid JSON. Never wrap in markdown.';
  if (provider === 'claude' && cfg.anthropicKey) {
    const client = new Anthropic({ apiKey: cfg.anthropicKey });
    const msg = await client.messages.create({
      model: cfg.anthropicModel, max_tokens: 1024, temperature: 0.4,
      system: sys, messages: [{ role: 'user', content: buildPrompt(leads) }],
    });
    const text = msg.content.find(b => b.type === 'text')?.text || '{}';
    const m = text.match(/\{[\s\S]*\}/);
    let parsed; try { parsed = JSON.parse(m ? m[0] : text); } catch { parsed = {}; }
    return normalize(parsed, leads);
  }
  if (cfg.groqKey) {
    const groq = new Groq({ apiKey: cfg.groqKey });
    const r = await groq.chat.completions.create({
      model: cfg.groqModel, response_format: { type: 'json_object' }, temperature: 0.4,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: buildPrompt(leads) }],
    });
    let parsed; try { parsed = JSON.parse(r.choices[0]?.message?.content || '{}'); } catch { parsed = {}; }
    return normalize(parsed, leads);
  }
  // ultimate fallback
  return {
    headline: leads.length ? `${leads.length} new signup${leads.length === 1 ? '' : 's'} overnight` : 'Quiet night — no new signups',
    top_picks: leads.slice(0, 3).map(l => ({ name: l.name, email: l.email, company: l.company, why: 'AI summary skipped — no API key configured.' })),
    notable_companies: [...new Set(leads.map(l => l.company).filter(Boolean))].slice(0, 8),
  };
}

async function logToSupabase({ subject, html, status, error }) {
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
      body: JSON.stringify({ to_email: cfg.to, subject, body_html: html, source: 'briefing', status, error: error || null }),
    });
  } catch {}
}

export default async function handler(req, res) {
  // Auth: Vercel Cron sets `x-vercel-cron: 1`. Manual triggers must include the secret.
  const isCron = req.headers['x-vercel-cron'] === '1';
  const url = new URL(req.url, `http://${req.headers.host}`);
  const passed = url.searchParams.get('secret') || req.headers['x-briefing-secret'];
  if (!isCron) {
    if (!cfg.secret) return res.status(500).json({ ok: false, error: 'BRIEFING_SECRET not configured on the server' });
    if (passed !== cfg.secret) return res.status(401).json({ ok: false, error: 'invalid_secret' });
  }

  const demo = url.searchParams.get('demo') === '1';
  const dry = url.searchParams.get('dry') === '1';
  const ai = url.searchParams.get('ai') || undefined;

  try {
    if (!cfg.to) throw new Error('BRIEFING_TO missing');
    if (!cfg.resendKey) throw new Error('RESEND_API_KEY missing');

    const leads = await fetchLeads(demo);
    const summary = await summarize(leads, ai);
    const html = renderEmail({
      headline: summary.headline,
      generated_at: new Date(),
      tz: cfg.tz,
      total: leads.length,
      top_picks: summary.top_picks,
      notable_companies: summary.notable_companies,
      all_leads: leads,
      cta_url: cfg.dashboardUrl,
    });
    const subject = `Tester.io · ${summary.headline} (${leads.length})`;

    if (dry) return res.status(200).json({ ok: true, dry: true, headline: summary.headline, total: leads.length });

    const resend = new Resend(cfg.resendKey);
    const r = await resend.emails.send({ from: cfg.resendFrom, to: [cfg.to], subject, html });
    if (r.error) {
      await logToSupabase({ subject, html, status: 'failed', error: r.error.message });
      throw new Error(`Resend: ${r.error.message}`);
    }
    await logToSupabase({ subject, html, status: 'sent' });
    return res.status(200).json({ ok: true, id: r.data?.id, provider: 'resend', headline: summary.headline, total: leads.length, cron: isCron });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
