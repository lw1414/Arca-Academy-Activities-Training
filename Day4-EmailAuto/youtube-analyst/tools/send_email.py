"""Send the report via the Gmail API.

Sends a polished, responsive HTML email: KPI cards, the narrative summary,
a top-videos table with thumbnails and inline bar graphs, a category
breakdown, and buttons linking to the Slides deck and the Sheets dataset.

Sends from SENDER_EMAIL (the authorized account) to every address in
RECIPIENT_EMAIL. Requires OAuth (gmail.send scope).
"""
from __future__ import annotations

import base64
from email.mime.text import MIMEText

import config
from google_auth import get_service

RED = "#cc0000"
DARK = "#17171c"
GREY = "#6b6b72"
LIGHT = "#f4f4f6"


def _short(n: int) -> str:
    for unit, div in (("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if n >= div:
            return f"{n / div:.1f}{unit}"
    return f"{n:,}"


def _kpi_cards(t: dict, count: int) -> str:
    cards = [
        ("Videos", f"{count:,}"),
        ("Total Views", _short(t["views"])),
        ("Total Likes", _short(t["likes"])),
        ("Avg Engagement", f"{t['avg_engagement_rate']}%"),
    ]
    cells = ""
    for label, value in cards:
        cells += f"""
        <td width="25%" style="padding:6px">
          <div style="background:{LIGHT};border-top:3px solid {RED};
                      border-radius:8px;padding:14px 8px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:{DARK}">{value}</div>
            <div style="font-size:11px;color:{GREY};text-transform:uppercase;
                        letter-spacing:.5px;margin-top:4px">{label}</div>
          </div>
        </td>"""
    return f'<table width="100%" cellpadding="0" cellspacing="0"><tr>{cells}</tr></table>'


def _video_rows(videos: list[dict]) -> str:
    if not videos:
        return ""
    max_v = max((v["views"] for v in videos), default=1) or 1
    rows = ""
    for i, v in enumerate(videos[:5], 1):
        pct = max(4, round(v["views"] / max_v * 100))
        thumb = v.get("thumbnail") or \
            f"https://i.ytimg.com/vi/{v['video_id']}/mqdefault.jpg"
        rows += f"""
        <tr>
          <td style="padding:8px 6px;vertical-align:top;width:90px">
            <a href="{v['url']}"><img src="{thumb}" width="80"
               style="border-radius:6px;display:block" alt=""></a>
          </td>
          <td style="padding:8px 6px;vertical-align:top">
            <a href="{v['url']}" style="color:{DARK};font-weight:600;
               font-size:13px;text-decoration:none">{i}. {v['title']}</a>
            <div style="font-size:11px;color:{GREY};margin:2px 0 5px">
               {v['channel']} &nbsp;·&nbsp; {v.get('category','')}</div>
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:{LIGHT};border-radius:4px">
                <div style="background:{RED};height:8px;width:{pct}%;
                            border-radius:4px"></div></td>
              <td style="width:70px;text-align:right;font-size:11px;
                         font-weight:700;color:{DARK};padding-left:8px">
                {_short(v['views'])}</td>
            </tr></table>
          </td>
        </tr>"""
    return f'<table width="100%" cellpadding="0" cellspacing="0">{rows}</table>'


def _category_bars(breakdown: list[dict]) -> str:
    if not breakdown:
        return ""
    items = breakdown[:6]
    max_v = max((c["views"] for c in items), default=1) or 1
    rows = ""
    for c in items:
        pct = max(4, round(c["views"] / max_v * 100))
        rows += f"""
        <tr>
          <td style="width:140px;font-size:12px;color:{DARK};padding:4px 6px">
            {c['category']}</td>
          <td style="padding:4px 6px">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:{LIGHT};border-radius:4px">
                <div style="background:{RED};height:8px;width:{pct}%;
                            border-radius:4px"></div></td>
              <td style="width:60px;text-align:right;font-size:11px;
                         color:{GREY};padding-left:8px">{_short(c['views'])}</td>
            </tr></table></td>
        </tr>"""
    return f'<table width="100%" cellpadding="0" cellspacing="0">{rows}</table>'


def _html_body(a: dict, slides_url: str, sheet_url: str,
               report_date: str = "") -> str:
    t = a["totals"]
    return f"""\
<div style="background:#e9e9ee;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
 <table align="center" width="640" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:14px;overflow:hidden;
               box-shadow:0 2px 10px rgba(0,0,0,.08)">
  <tr><td style="background:{DARK};padding:22px 28px;border-left:6px solid {RED}">
    <div style="color:#fff;font-size:20px;font-weight:700">YouTube Analytics Report</div>
    <div style="color:#bdbdc4;font-size:12px;margin-top:3px">
      {report_date or 'Trending &amp; Engagement Analysis'}</div>
  </td></tr>

  <tr><td style="padding:18px 22px 4px">{_kpi_cards(t, a['video_count'])}</td></tr>

  <tr><td style="padding:10px 28px">
    <p style="font-size:13px;color:{DARK};line-height:1.6;margin:0">{a['narrative']}</p>
  </td></tr>

  <tr><td style="padding:14px 24px 4px">
    <div style="font-size:14px;font-weight:700;color:{RED};
                border-bottom:2px solid {LIGHT};padding-bottom:6px">
      Top Videos by Views</div>
    {_video_rows(a.get('top_by_views', []))}
  </td></tr>

  <tr><td style="padding:14px 24px 4px">
    <div style="font-size:14px;font-weight:700;color:{RED};
                border-bottom:2px solid {LIGHT};padding-bottom:6px">
      Views by Content Category</div>
    <div style="padding-top:8px">{_category_bars(a.get('category_breakdown', []))}</div>
  </td></tr>

  <tr><td style="padding:22px 28px;text-align:center">
    <a href="{slides_url}" style="background:{RED};color:#fff;padding:12px 22px;
       text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;
       display:inline-block">View Slides Report</a>
    &nbsp;&nbsp;
    <a href="{sheet_url}" style="color:{RED};font-size:13px;font-weight:600">
       Open dataset (Sheets) &rarr;</a>
  </td></tr>

  <tr><td style="background:{LIGHT};padding:14px 28px;text-align:center">
    <div style="font-size:11px;color:{GREY}">
      Generated automatically by YouTube Analytics Automation.</div>
  </td></tr>
 </table>
</div>"""


def send(analysis: dict, slides_url: str, sheet_url: str,
         subject: str | None = None, report_date: str = "") -> None:
    svc = get_service("gmail", "v1")
    recipients = config.recipients()
    if not recipients:
        raise SystemExit("[email] No RECIPIENT_EMAIL set in .env.")

    html = _html_body(analysis, slides_url, sheet_url, report_date)
    msg = MIMEText(html, "html")
    msg["to"] = ", ".join(recipients)
    msg["from"] = config.SENDER_EMAIL
    msg["subject"] = subject or "Your YouTube Analytics Report"

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    svc.users().messages().send(userId="me", body={"raw": raw}).execute()
    print(f"[email] Sent to: {', '.join(recipients)}")


if __name__ == "__main__":
    import json

    with open(".tmp/analysis.json", encoding="utf-8") as f:
        analysis = json.load(f)
    send(analysis,
         slides_url="https://docs.google.com/presentation/d/EXAMPLE/edit",
         sheet_url="https://docs.google.com/spreadsheets/d/EXAMPLE/edit")
