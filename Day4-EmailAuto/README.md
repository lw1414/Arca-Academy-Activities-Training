# Day 4 — Email Automation

Automated **morning briefing** that runs daily and emails an AI-generated summary of yesterday's signups.

## What it does

1. **Fetches leads** from a Supabase `form_submissions` table (last 24 hours)
2. **Summarizes** them with an LLM (Groq by default — free; Anthropic Claude optional)
3. **Renders** an email-safe HTML template with a "Top picks" ranking
4. **Sends** via Resend (default) or Gmail/NodeMailer
5. **Logs** each send to a Supabase `email_log` table for auditability

Triggered either by **local `node-cron`** (terminal stays open) or **Vercel Cron** (deployed, runs in cloud).

## Stack

| Concern | Package |
|---|---|
| LLM (free) | `groq-sdk` |
| LLM (paid, optional) | `@anthropic-ai/sdk` |
| Email (default) | `resend` |
| Email (alt) | `nodemailer` (Gmail) |
| Scheduling (local) | `node-cron` |
| Scheduling (cloud) | Vercel Cron via `vercel.json` |
| Env loading | `dotenv` |
| Tests | `@playwright/test` |

## Setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in: GROQ_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
#          RESEND_API_KEY, RESEND_FROM, BRIEFING_TO

# 3. Apply Supabase schema (creates email_log table + allows source='briefing')
# Run supabase/dashboard-tables.sql + supabase/email-log-add-briefing-source.sql
# in https://supabase.com/dashboard/project/<your-project>/sql/new
```

## CLI

```bash
# Preview (renders briefing/preview.html, no email sent)
node morning-briefing.mjs preview --demo            # 6 sample leads
node morning-briefing.mjs preview                   # real Supabase leads

# Send for real
node morning-briefing.mjs run                       # real leads, Resend
node morning-briefing.mjs run --demo                # demo leads, Resend
node morning-briefing.mjs run --gmail               # via Gmail
node morning-briefing.mjs run --claude              # use Claude instead of Groq

# Dry run (renders + prints, no email, no DB write)
node morning-briefing.mjs run --demo --dry

# Daemon mode — node-cron at BRIEFING_CRON + HTTP API on :BRIEFING_PORT
node morning-briefing.mjs watch
```

## HTTP API (while `watch` is running)

```bash
GET  /api/briefing/health
POST /api/briefing/run-now[?demo=1][&gmail=1][&dry=1][&ai=claude|groq]
POST /api/briefing/preview[?demo=1][&ai=claude|groq]
```

## Deploy to Vercel

See [DEPLOY.md](./DEPLOY.md). Hobby plan free tier supports one daily cron — sufficient for this workflow. Vercel Cron schedule lives in [vercel.json](./vercel.json):

```json
{ "crons": [{ "path": "/api/briefing", "schedule": "0 23 * * *" }] }
```

`0 23 * * *` UTC = **07:00 Asia/Manila** (UTC+8) — adjust per timezone.

## File layout

```
Day4-EmailAuto/
├── morning-briefing.mjs              # main CLI + cron daemon
├── briefing/
│   └── template.mjs                  # email-safe HTML renderer
├── api/
│   └── briefing.mjs                  # Vercel serverless handler
├── supabase/
│   ├── dashboard-tables.sql          # creates email_log + newsletters tables
│   └── email-log-add-briefing-source.sql  # allows source='briefing'
├── tests/
│   └── briefing.spec.mjs             # Playwright preview smoke test
├── vercel.json                       # Vercel Cron config
├── DEPLOY.md                         # deployment guide
├── package.json
└── .env.example
```

## Activity goals covered

- ✅ Supabase signups query (last 24h)
- ✅ AI summary with prioritized picks
- ✅ Email send (Resend + Gmail/NodeMailer)
- ✅ Cron scheduling (local + cloud)
- ✅ Preview server (writes `briefing/preview.html` viewable in browser)
- ✅ Deploy guide (Vercel free tier)
- ✅ Demo + real modes
