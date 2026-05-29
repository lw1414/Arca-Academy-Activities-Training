# Deploying Day4-EmailAuto to Vercel (Hobby / free tier)

This project lives at `Day4-EmailAuto/` inside the
[Arca-Academy-Activities-Training](https://github.com/lw1414/Arca-Academy-Activities-Training)
repo. You deploy it as a **subfolder project** — Vercel needs to know to look
inside `Day4-EmailAuto/`, not at the repo root.

After deploy, `api/briefing.mjs` becomes a serverless endpoint, and Vercel Cron
fires it daily at **07:00 Asia/Manila**. Your laptop can be off — Vercel runs
it in the cloud.

---

## What gets deployed

| Local file | Becomes |
|---|---|
| `api/briefing.mjs` | `https://<your-project>.vercel.app/api/briefing` |
| `vercel.json` → `crons` | Daily cron POSTing to `/api/briefing` |
| Everything else | Static assets (README etc., nothing user-facing) |

The cron schedule in [vercel.json](./vercel.json) is `0 23 * * *` UTC = **07:00 Asia/Manila** (UTC+8).

---

## Step 1 — Import the repo into Vercel

1. Open https://vercel.com/new
2. Click **Add GitHub Account** if needed, authorize Vercel on `lw1414/Arca-Academy-Activities-Training`
3. Find the repo → click **Import**
4. On the configuration screen:

   | Field | Value |
   |---|---|
   | **Project Name** | `day4-email-auto` (or whatever you like) |
   | **Framework Preset** | `Other` |
   | **Root Directory** | ⚠️ **Click "Edit" and set to `Day4-EmailAuto`** |
   | **Build Command** | leave blank (uses default) |
   | **Output Directory** | leave blank |
   | **Install Command** | leave default (`npm install`) |

   The Root Directory step is the most important one. Without it the build will
   fail because Vercel won't find `package.json` or the `api/` folder.

5. Click **Deploy**

The first deploy will succeed but the briefing won't actually send — env vars
are missing. That's the next step.

---

## Step 2 — Add environment variables

Vercel → your project → **Settings → Environment Variables**. Add each row
(check **Production, Preview, AND Development** for each):

| Key | Example value |
|---|---|
| `BRIEFING_AI` | `groq` |
| `GROQ_API_KEY` | `gsk_...` *(from console.groq.com)* |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `SUPABASE_URL` | `https://<your-project>.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_...` |
| `SUPABASE_TABLE` | `form_submissions` |
| `RESEND_API_KEY` | `re_...` *(from resend.com/api-keys, "Sending access")* |
| `RESEND_FROM` | `onboarding@resend.dev` *(or `briefing@yourdomain.com` if you verify a domain)* |
| `BRIEFING_TO` | your recipient email — **must match the email registered with Resend** unless you verified a domain |
| `BRIEFING_TZ` | `Asia/Manila` |
| `BRIEFING_SECRET` | a long random string — **see below** |

> Not needed on Vercel: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GMAIL_*`,
> `BRIEFING_PORT`, `BRIEFING_CRON`. Groq + Resend cover everything; the
> schedule is hard-coded in `vercel.json`.

### Generate `BRIEFING_SECRET`

In PowerShell:
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

Or paste a 48-char alphanumeric from https://1password.com/password-generator/.

Store the same value somewhere safe — you'll need it to manually trigger the
function for testing.

---

## Step 3 — Redeploy so env vars take effect

In Vercel → **Deployments** → top entry → **···** → **Redeploy** → confirm.
Wait ~30 seconds.

---

## Step 4 — Verify the cron is registered

Vercel → **Settings → Cron Jobs**. You should see:

```
GET   /api/briefing    0 23 * * *
```

That's **07:00 Asia/Manila** daily.

> Vercel Hobby plan caveat: cron schedules are rounded to **daily
> granularity** — fires once per day around that time, not exactly to the
> minute. Fine for a morning briefing.

---

## Step 5 — Smoke-test the deployed endpoint

```powershell
# Replace placeholders
$URL    = "https://<your-project>.vercel.app/api/briefing"
$SECRET = "<your BRIEFING_SECRET>"

# Dry run with demo leads (no email sent, just confirms config)
curl.exe "$URL`?dry=1&demo=1&secret=$SECRET"

# Real send with demo leads
curl.exe "$URL`?demo=1&secret=$SECRET"

# Real send with live Supabase leads (last 24h)
curl.exe "$URL`?secret=$SECRET"
```

Expected response on success:
```json
{"ok":true,"id":"...","provider":"resend","headline":"...","total":6,"cron":false}
```

Email lands in your inbox in seconds. The row also appears in your Supabase
`email_log` table with `source='briefing'`.

---

## Step 6 — Hands-off mode

Once Step 1–4 are done, you can **close your laptop**. The cron fires daily
in Vercel's cloud. To stop it, see "Cleanup" below.

---

## Vercel Hobby plan limits — relevant ones

| Limit | This project's usage |
|---|---|
| 1 cron job per project | We use 1. ✓ |
| Daily cron precision | Fine for a morning briefing. |
| 10 second function timeout (default) | One Groq + one Resend call takes ~2s. ✓ The `maxDuration: 30` in `vercel.json` gives headroom. |
| 100 GB-hours / month free | We use ~30 seconds/month. ✓ |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails "no package.json found" | You didn't set **Root Directory = `Day4-EmailAuto`** in Step 1 |
| 401 `invalid_secret` from manual trigger | `?secret=...` must match the Vercel env var exactly. Re-check capitalization. |
| 500 `ANTHROPIC_API_KEY missing` | Shouldn't be needed if `BRIEFING_AI=groq`. Confirm `GROQ_API_KEY` is set and `BRIEFING_AI=groq`. |
| 500 `Resend: You can only send testing emails…` | Resend free tier restricts recipients. Change `BRIEFING_TO` to your Resend-registered email, or verify a domain. |
| Email lands in spam | Verify a domain in Resend → change `RESEND_FROM` to `briefing@yourdomain.com` |
| Cron doesn't fire | Vercel re-reads `vercel.json` cron config only on deploy. After any cron edit, push → redeploy. |
| Need a different time | Edit `crons[0].schedule` in `vercel.json` (UTC cron). 7 AM Manila = `0 23 * * *`. Commit, push, redeploy. |

---

## Cleanup / rollback

To pause the briefing without deleting the deployment:

1. Vercel → **Settings → Cron Jobs** → toggle the cron OFF
2. Or remove the `crons` array from `vercel.json` and redeploy

To delete everything:
1. Vercel → **Settings → Advanced → Delete Project**
2. Or delete `Day4-EmailAuto/` from the repo
