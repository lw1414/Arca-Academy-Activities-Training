"""Write the analysis dataset to Google Sheets.

If SPREADSHEET_ID is set in .env, reuses that spreadsheet (clears + rewrites).
Otherwise creates a new spreadsheet and returns its ID so the orchestrator can
persist it to .env.

Requires OAuth (spreadsheets scope).
"""
from __future__ import annotations

import config
from google_auth import get_service

HEADER = [
    "Rank", "Title", "Channel", "Views", "Likes", "Comments",
    "Engagement %", "Published", "URL",
]


def _rows(analysis: dict) -> list[list]:
    rows = [HEADER]
    ranked = sorted(
        analysis["videos"], key=lambda v: v["views"], reverse=True
    )
    for i, v in enumerate(ranked, start=1):
        rows.append([
            i, v["title"], v["channel"], v["views"], v["likes"],
            v["comments"], v["engagement_rate"], v["published_at"], v["url"],
        ])
    return rows


def write(analysis: dict, spreadsheet_id: str | None = None) -> str:
    """Write the dataset. Returns the spreadsheet ID (new or reused)."""
    svc = get_service("sheets", "v4")
    spreadsheet_id = spreadsheet_id or config.SPREADSHEET_ID or None

    if not spreadsheet_id:
        created = svc.spreadsheets().create(
            body={"properties": {"title": "YouTube Analytics Report"}}
        ).execute()
        spreadsheet_id = created["spreadsheetId"]
        print(f"[sheets] Created new spreadsheet: {spreadsheet_id}")
    else:
        # Clear the first sheet before rewriting.
        svc.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id, range="A:Z"
        ).execute()
        print(f"[sheets] Reusing spreadsheet: {spreadsheet_id}")

    values = _rows(analysis)
    svc.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range="A1",
        valueInputOption="RAW",
        body={"values": values},
    ).execute()

    # Bold the header row.
    svc.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": [{
            "repeatCell": {
                "range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1},
                "cell": {"userEnteredFormat": {
                    "textFormat": {"bold": True}}},
                "fields": "userEnteredFormat.textFormat.bold",
            }
        }]},
    ).execute()

    print(f"[sheets] Wrote {len(values) - 1} rows.")
    return spreadsheet_id


def url(spreadsheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"


if __name__ == "__main__":
    import json

    with open(".tmp/analysis.json", encoding="utf-8") as f:
        analysis = json.load(f)
    sid = write(analysis)
    print(f"[sheets] {url(sid)}")
