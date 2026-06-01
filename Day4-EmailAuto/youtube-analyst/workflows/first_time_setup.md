# Workflow: First-Time Setup

One-time steps to get the system running. Most are MANUAL (Claude cannot do
them).

## 1. Google Cloud (manual)
- Create a project at https://console.cloud.google.com
- Enable APIs: **YouTube Data API v3, Google Sheets API, Google Slides API,
  Gmail API**

## 2. Credentials (manual)
- **API key** → Credentials → Create credentials → API key → restrict to
  YouTube Data API v3. Paste into `.env` as `YOUTUBE_API_KEY`.
- **OAuth client** → Configure consent screen (External) → add your email as a
  test user → Create OAuth client ID → **Desktop app** → Download JSON → save
  as `credentials.json` in project root.

## 3. Environment (manual fill)
Edit `.env`:
- `YOUTUBE_API_KEY` — the API key
- `SENDER_EMAIL` — the Google account you authorize (sends the email)
- `RECIPIENT_EMAIL` — where the report goes (comma-separate for multiple)
- `SPREADSHEET_ID` / `PRESENTATION_ID` — leave blank; auto-filled on first run

## 4. Python (one-time)
```
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 5. Authorize OAuth (one-time, interactive)
```
.\.venv\Scripts\python.exe tools\google_auth.py
```
A browser opens → sign in with `SENDER_EMAIL` → approve. Creates `token.json`.
> If you see "Google hasn't verified this app", click **Advanced → Go to
> (app) (unsafe)** — expected for a personal test app.

## 6. First report run
```
.\.venv\Scripts\python.exe tools\run_weekly_report.py
```
This creates the Sheet + Slides, saves their IDs to `.env`, and emails the
report.

## Re-authentication
If `token.json` expires or scopes change: delete `token.json` and repeat step 5.
