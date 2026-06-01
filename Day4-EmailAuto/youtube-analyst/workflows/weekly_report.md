# Workflow: YouTube Analytics Report

## Objective
Fetch trending/searched/channel videos, analyze engagement, write the dataset
to Google Sheets, build a designed Google Slides deck (KPI cards + bar-chart
graphs), and email a polished report to the recipients.

## The one command
Everything runs through the `yta` launcher in the project root:

```
yta run                                  # uses .env defaults (topic: Claude Code)
yta run --region PH                      # PH trending (all categories)
yta run --region US --category Gaming    # trending filtered to a content type
yta run --keywords "AI,fitness"          # keyword search
yta run --channels UCxxxx,UCyyyy         # specific channels
yta run --all --keywords "Claude Code"   # region trending + keywords combined
yta run --no-email                       # build Sheet/Slides without emailing
```

Other commands:
```
yta categories --region US      # list content types you can target
yta auth                        # one-time Google authorization
yta dashboard                   # launch the web UI (http://localhost:5173)
yta schedule --day MON --time 09:00 [run options]   # weekly auto-run
yta status                      # show the current schedule
yta unschedule                  # remove the scheduled task
```

> On PowerShell use `.\yta.bat run ...` (or `.\yta.ps1 run ...`). The launcher
> auto-uses the project's `.venv` Python.

## Selectors ("what to analyze")
Combine any of these — "all" just means using several together:
- **region** — 2-letter COUNTRY code for the trending chart (e.g. `PH`, `US`).
  Note: YouTube has no "Asia" region; pick a country.
- **category** — content type by name or id (Music, Gaming, News & Politics…).
  Applies to the trending chart. Run `yta categories` to list them.
- **keywords** — comma-separated search terms (region-independent).
- **channels** — comma-separated channel IDs (most recent uploads).

## Defaults (in .env)
- `DEFAULT_REGION=PH` — used for trending when no region is given.
- `DEFAULT_KEYWORDS=Claude Code` — searched when `yta run` gets no selectors.
- `DEFAULT_CATEGORY=` — optional content type applied to default trending.
- `DEFAULT_MAX_RESULTS=25` — per-source cap (max 50).

## Pipeline (tools, in order)
1. `fetch_youtube.py` — pull video data + category titles (API key only).
2. `analyze_trends.py` — engagement metrics, category breakdown, narrative.
3. `write_sheets.py` — write dataset to Sheets.
4. `generate_slides.py` — 5-slide deck (title, KPI cards, 3 bar charts).
5. `send_email.py` — polished HTML email (KPI cards, thumbnails, bars).
Orchestrated by `run_weekly_report.run_report()`, invoked by `cli.py`.

## Outputs
- Google Sheet (ID in `.env` as `SPREADSHEET_ID`).
- Google Slides deck (ID as `PRESENTATION_ID`).
- Email to `RECIPIENT_EMAIL` with summary, top videos, category bars, links.

## Edge cases / lessons learned
- **Slides object IDs** must be 5-50 chars — IDs are zero-padded in
  generate_slides.py. Don't shorten them.
- **Console UTF-8** — config.py reconfigures stdout to UTF-8 so emoji in video
  titles don't crash printing on Windows.
- **Public sharing** needs the Drive API enabled; it's skipped gracefully and
  only matters when emailing people who don't already have access.
- **OAuth scope change** → delete `token.json` and re-run `yta auth`.
- **Quota**: `search.list` costs 100 units (of 10,000/day); trending is cheap.
