# Deploying the morning briefing to Vercel (Hobby / free tier)

This guide deploys `api/briefing.mjs` as a Vercel serverless function and wires Vercel Cron to fire it daily at **07:00 Asia/Manila**.

The local `morning-briefing.mjs` keeps working unchanged — Vercel just gives you a hands-off scheduled run that doesn't need your laptop on.

---

## Prerequisites

- A Vercel account (Hobby plan is fine — no credit card required)
- The Vercel CLI installed (optional but easier): `npm i -g vercel`
- This repo pushed to GitHub (Vercel deploys from a repo)

## What gets deployed

| Path | Becomes |
|---|---|
| `api/briefing.mjs` | A serverless function at `https://<your-project>.vercel.app/api/briefing` |
| `vercel.json` → `crons` | A daily cron that POSTs to `/api/briefing` |
| Everything else (`index.html`, `dashboard.html`, etc.) | Static files served from the same domain |

## 1 — Push to GitHub

If you haven't already:
```powershell
git add .
git commit -m "Add Vercel briefing function"
git push
```

## 2 — Import into Vercel

1. Go to https://vercel.com/new
2. Pick the GitHub repo
3. **Don't change** the build settings — Vercel will detect `vercel.json` and skip the build step (your project is static + one serverless function)
4. Click **Deploy**

The first deploy will succeed but the briefing won't run yet — env vars are missing.

## 3 — Add environment variables

In your project on Vercel: **Settings → Environment Variables**. Add these (paste the same values from your local `.env`):

| Key | Example value |
|---|---|
| `BRIEFING_AI` | `claude` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `GROQ_API_KEY` *(optional fallback)* | `gsk_...` |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `SUPABASE_URL` | `https://ejdarjipxnruwxoaimgs.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_...` |
| `SUPABASE_TABLE` | `form_submissions` |
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM` | `onboarding@resend.dev` *(or `briefing@yourdomain.com` after you verify a domain)* |
| `BRIEFING_TO` | `aernestleanrivera@gmail.com` |
| `BRIEFING_TZ` | `Asia/Manila` |
| `BRIEFING_SECRET` | a long random string — generate one below |
| `PUBLIC_SITE_URL` *(optional)* | `https://<your-project>.vercel.app` *(used for the "Open dashboard" CTA in the email)* |

### Generate a `BRIEFING_SECRET`

In PowerShell:
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```
Or just open https://1password.com/password-generator/ and copy a 48-char alphanumeric.

Add the same value to your local `.env` as `BRIEFING_SECRET` so the dashboard's "Run now" button can authenticate.

After saving, **redeploy** so the new env vars take effect: Deployments → top-right ··· → Redeploy.

## 4 — Verify the cron is wired

After redeploy, on Vercel: **Settings → Cron Jobs**. You should see one entry:

```
GET  /api/briefing    0 23 * * *
```

Why `0 23 * * *` and not `0 7 * * *`? **Vercel Cron schedules are UTC**, and Asia/Manila is UTC+8. So 07:00 Manila = 23:00 UTC the previous day.

> Hobby plan caveat: cron schedules on Hobby are rounded to daily granularity. The job fires once per day around that time, not always exactly at the minute.

## 5 — Trigger it manually to test

Once deployed:
```powershell
# Replace with your project URL + the secret you set in env vars
$URL = "https://<your-project>.vercel.app/api/briefing"
$SECRET = "<the BRIEFING_SECRET you set>"

# Dry run (renders, does not send)
curl.exe "$URL`?dry=1&demo=1&secret=$SECRET"

# Send for real, with demo leads
curl.exe "$URL`?demo=1&secret=$SECRET"

# Send for real, with live Supabase leads (last 24h)
curl.exe "$URL`?secret=$SECRET"
```

Or in your browser, just paste the URL with `?dry=1&demo=1&secret=...` — you'll get a JSON response. Check the **Email Log** tab in the dashboard for the new row.

## 6 — Point the dashboard's "Run now" button at the deployed function

Edit [dashboard.html](../dashboard.html), change the `BRIEFING_API` constant:

```js
// BEFORE
const BRIEFING_API = 'http://localhost:3100';

// AFTER (use deployed URL + add secret as a query param appended in withProvider)
const BRIEFING_API  = 'https://<your-project>.vercel.app';
const BRIEFING_SECRET = '<the BRIEFING_SECRET>';
```

Then update the fetch URLs in the briefing JS block to append `&secret=${BRIEFING_SECRET}`. Or — more pragmatically — keep both:
- `http://localhost:3100` for local dev when the `watch` daemon is running
- the Vercel URL for production

A 5-line guard at the top of the briefing JS block can flip between them based on `location.hostname`.

## Vercel Hobby plan limits to know

| Limit | Impact |
|---|---|
| 1 cron job per project | We use it for the briefing. Fine. |
| Daily cron precision only | Job fires once a day — not on a fine schedule. Fine for a morning briefing. |
| 10 second function timeout (default) | One Claude call + one Resend POST takes < 3s. Fine. `maxDuration: 30` in vercel.json gives extra headroom. |
| 100 GB-hours of function execution / month | This function runs ~1 sec/day. Free for life at this scale. |

## Troubleshooting

| Symptom | Fix |
|---|---|
| "invalid_secret" 401 from manual trigger | Make sure `?secret=...` matches the env var on Vercel exactly. |
| Function logs say "ANTHROPIC_API_KEY missing" | You forgot to add it in Settings → Environment Variables, or you added it for "Preview" only — also add for "Production". |
| Cron doesn't fire | Vercel only re-evaluates `vercel.json` cron config on deploy. After editing `vercel.json`, redeploy. |
| Email lands in spam | Verify a domain in Resend and change `RESEND_FROM` to `briefing@yourdomain.com`. |
| Need to change the schedule | Edit `crons[0].schedule` in `vercel.json` (UTC cron syntax), commit, push, redeploy. |

## Cleanup / rollback

To stop the briefing without deleting the project:
1. Vercel → Settings → Cron Jobs → toggle off
2. Or remove the `crons` array from `vercel.json` and redeploy

To delete the function entirely: delete `api/briefing.mjs`, remove the `crons` block from `vercel.json`, commit, push.
