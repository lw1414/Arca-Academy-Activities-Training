"""Generate a designed Google Slides report from the analysis.

Deck layout:
  1. Title slide (dark, branded, with a KPI strip)
  2. Key Metrics  — 4 KPI cards + narrative
  3. Top by Views — horizontal bar chart
  4. Top by Engagement — horizontal bar chart
  5. Category breakdown — horizontal bar chart

Charts are drawn natively with shapes (rectangles), so they render reliably
without needing the Drive API or embedded Sheets charts.

If PRESENTATION_ID is set, the existing deck is wiped and rebuilt so the link
stays stable. Otherwise a new deck is created.

Requires OAuth (presentations scope; drive.file only for optional sharing).
"""
from __future__ import annotations

import config
from google_auth import get_service

# Canvas is 720 x 405 pt (the default 16:9 size).
PAGE_W, PAGE_H = 720, 405

# Palette.
RED = {"red": 0.80, "green": 0.05, "blue": 0.05}
RED_SOFT = {"red": 0.95, "green": 0.85, "blue": 0.85}
DARK = {"red": 0.09, "green": 0.09, "blue": 0.11}
GREY = {"red": 0.42, "green": 0.42, "blue": 0.46}
LIGHT = {"red": 0.96, "green": 0.96, "blue": 0.97}
WHITE = {"red": 1, "green": 1, "blue": 1}

_uid = 0


def _oid(prefix: str) -> str:
    # Slides requires object IDs to be 5-50 chars; zero-pad to guarantee it.
    global _uid
    _uid += 1
    return f"{prefix}_{_uid:05d}"


# --- low-level request builders -------------------------------------------
def _slide(slide_id):
    return {"createSlide": {
        "objectId": slide_id,
        "slideLayoutReference": {"predefinedLayout": "BLANK"}}}


def _bg(slide_id, color):
    return {"updatePageProperties": {
        "objectId": slide_id,
        "pageProperties": {"pageBackgroundFill": {
            "solidFill": {"color": {"rgbColor": color}}}},
        "fields": "pageBackgroundFill.solidFill.color"}}


def _rect(slide_id, x, y, w, h, fill, rounded=False, oid=None):
    oid = oid or _oid("rect")
    shape = "ROUND_RECTANGLE" if rounded else "RECTANGLE"
    return oid, [
        {"createShape": {
            "objectId": oid, "shapeType": shape,
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {"width": {"magnitude": w, "unit": "PT"},
                         "height": {"magnitude": h, "unit": "PT"}},
                "transform": {"scaleX": 1, "scaleY": 1,
                              "translateX": x, "translateY": y, "unit": "PT"}}}},
        {"updateShapeProperties": {
            "objectId": oid,
            "shapeProperties": {
                "shapeBackgroundFill": {"solidFill": {
                    "color": {"rgbColor": fill}}},
                "outline": {"propertyState": "NOT_RENDERED"}},
            "fields": "shapeBackgroundFill.solidFill.color,outline.propertyState"}},
    ]


def _text(slide_id, text, x, y, w, h, size, color,
          bold=False, align="START", oid=None):
    oid = oid or _oid("tx")
    reqs = [
        {"createShape": {
            "objectId": oid, "shapeType": "TEXT_BOX",
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {"width": {"magnitude": w, "unit": "PT"},
                         "height": {"magnitude": h, "unit": "PT"}},
                "transform": {"scaleX": 1, "scaleY": 1,
                              "translateX": x, "translateY": y, "unit": "PT"}}}},
        {"insertText": {"objectId": oid, "text": text}},
        {"updateTextStyle": {
            "objectId": oid,
            "style": {
                "fontSize": {"magnitude": size, "unit": "PT"},
                "bold": bold,
                "foregroundColor": {"opaqueColor": {"rgbColor": color}},
                "fontFamily": "Arial"},
            "fields": "fontSize,bold,foregroundColor,fontFamily"}},
        {"updateParagraphStyle": {
            "objectId": oid,
            "style": {"alignment": align},
            "fields": "alignment"}},
    ]
    return reqs


def _heading(slide_id, text):
    """Standard section heading with a small red accent bar."""
    reqs = []
    _, bar = _rect(slide_id, 40, 34, 6, 26, RED)
    reqs += bar
    reqs += _text(slide_id, text, 56, 28, 620, 40, 24, DARK, bold=True)
    return reqs


# --- chart -----------------------------------------------------------------
def _bar_chart(slide_id, series, value_fmt, top=92):
    """Horizontal bar chart from [{label, value, sub}]. value_fmt(value)->str."""
    reqs = []
    if not series:
        return _text(slide_id, "No data.", 40, top, 620, 30, 14, GREY)

    max_val = max((s["value"] for s in series), default=0) or 1
    label_x, label_w = 34, 250
    bar_x, bar_max_w = 292, 300
    row_h, gap = 26, 12
    y = top

    for s in series:
        scaled = max(3, s["value"] / max_val * bar_max_w)
        # Label (title) + sub (channel/extra) stacked in the left column.
        reqs += _text(slide_id, s["label"], label_x, y - 2, label_w, 18,
                      11, DARK, bold=True)
        if s.get("sub"):
            reqs += _text(slide_id, s["sub"], label_x, y + 13, label_w, 14,
                          8, GREY)
        # Track + bar.
        _, track = _rect(slide_id, bar_x, y, bar_max_w, row_h - 6, LIGHT)
        reqs += track
        _, bar = _rect(slide_id, bar_x, y, scaled, row_h - 6, RED)
        reqs += bar
        # Value label at the end of the bar.
        reqs += _text(slide_id, value_fmt(s["value"]),
                      bar_x + bar_max_w + 8, y - 1, 90, 18, 10, DARK, bold=True)
        y += row_h + gap
    return reqs


# --- KPI cards -------------------------------------------------------------
def _kpi_cards(slide_id, totals, count, top=86):
    cards = [
        ("VIDEOS", f"{count:,}"),
        ("TOTAL VIEWS", _short(totals["views"])),
        ("TOTAL LIKES", _short(totals["likes"])),
        ("AVG ENGAGEMENT", f"{totals['avg_engagement_rate']}%"),
    ]
    reqs = []
    card_w, gap, h = 150, 20, 96
    x = 30
    for label, value in cards:
        _, card = _rect(slide_id, x, top, card_w, h, LIGHT, rounded=True)
        reqs += card
        _, accent = _rect(slide_id, x, top, card_w, 5, RED)
        reqs += accent
        reqs += _text(slide_id, value, x, top + 24, card_w, 40, 26, DARK,
                      bold=True, align="CENTER")
        reqs += _text(slide_id, label, x, top + 68, card_w, 18, 9, GREY,
                      align="CENTER")
        x += card_w + gap
    return reqs


def _short(n: int) -> str:
    for unit, div in (("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if n >= div:
            return f"{n / div:.1f}{unit}"
    return f"{n:,}"


# --- presentation lifecycle ------------------------------------------------
def _new_presentation(svc) -> str:
    return svc.presentations().create(
        body={"title": "YouTube Analytics Report"}
    ).execute()["presentationId"]


def _clear_slides(svc, presentation_id: str) -> None:
    pres = svc.presentations().get(presentationId=presentation_id).execute()
    reqs = [{"deleteObject": {"objectId": s["objectId"]}}
            for s in pres.get("slides", [])]
    if reqs:
        svc.presentations().batchUpdate(
            presentationId=presentation_id, body={"requests": reqs}).execute()


def generate(analysis: dict, presentation_id: str | None = None,
             report_date: str = "") -> str:
    global _uid
    _uid = 0
    svc = get_service("slides", "v1")
    presentation_id = presentation_id or config.PRESENTATION_ID or None

    if not presentation_id:
        presentation_id = _new_presentation(svc)
        print(f"[slides] Created new presentation: {presentation_id}")
    else:
        _clear_slides(svc, presentation_id)
        print(f"[slides] Reusing presentation: {presentation_id}")

    t = analysis["totals"]
    ch = analysis.get("charts", {})
    reqs = []

    # --- Slide 1: Title -----------------------------------------------------
    s1 = "s_title"
    reqs.append(_slide(s1)); reqs.append(_bg(s1, DARK))
    _, accent = _rect(s1, 0, 0, 10, PAGE_H, RED); reqs += accent
    reqs += _text(s1, "YouTube Analytics Report", 50, 120, 620, 60, 34,
                  WHITE, bold=True)
    reqs += _text(s1, report_date or "Trending & Engagement Analysis",
                  50, 185, 620, 30, 16, RED_SOFT)
    strip = (f"{analysis['video_count']} videos   ·   "
             f"{_short(t['views'])} views   ·   "
             f"{t['avg_engagement_rate']}% avg engagement")
    reqs += _text(s1, strip, 50, 250, 620, 24, 12, GREY)

    # --- Slide 2: Key Metrics ----------------------------------------------
    s2 = "s_metrics"
    reqs.append(_slide(s2)); reqs.append(_bg(s2, WHITE))
    reqs += _heading(s2, "Key Metrics")
    reqs += _kpi_cards(s2, t, analysis["video_count"])
    reqs += _text(s2, analysis["narrative"], 30, 205, 660, 180, 13, DARK)

    # --- Slide 3: Top by Views ---------------------------------------------
    s3 = "s_views"
    reqs.append(_slide(s3)); reqs.append(_bg(s3, WHITE))
    reqs += _heading(s3, "Top Videos by Views")
    reqs += _bar_chart(s3, ch.get("views_bar", []),
                       value_fmt=lambda v: _short(int(v)))

    # --- Slide 4: Top by Engagement ----------------------------------------
    s4 = "s_eng"
    reqs.append(_slide(s4)); reqs.append(_bg(s4, WHITE))
    reqs += _heading(s4, "Top Videos by Engagement Rate")
    reqs += _bar_chart(s4, ch.get("engagement_bar", []),
                       value_fmt=lambda v: f"{v}%")

    # --- Slide 5: Category breakdown ---------------------------------------
    s5 = "s_cat"
    reqs.append(_slide(s5)); reqs.append(_bg(s5, WHITE))
    reqs += _heading(s5, "Views by Content Category")
    reqs += _bar_chart(s5, ch.get("category_bar", []),
                       value_fmt=lambda v: _short(int(v)))

    # Chunk the requests to stay well under API limits.
    for i in range(0, len(reqs), 400):
        svc.presentations().batchUpdate(
            presentationId=presentation_id,
            body={"requests": reqs[i:i + 400]}).execute()
    print("[slides] Built 5 slides (KPI cards + 3 bar charts).")
    return presentation_id


def share_anyone(presentation_id: str) -> bool:
    """Best-effort public sharing (needs the Drive API). Non-fatal."""
    try:
        drive = get_service("drive", "v3")
        drive.permissions().create(
            fileId=presentation_id,
            body={"role": "reader", "type": "anyone"}).execute()
        print("[slides] Sharing set to 'anyone with link can view'.")
        return True
    except Exception as e:  # noqa: BLE001 - non-fatal by design
        msg = str(e)
        if "drive.googleapis.com" in msg or "accessNotConfigured" in msg:
            print("[slides] WARNING: Drive API not enabled — skipping public "
                  "sharing. Enable it only if external recipients need access.")
        else:
            print(f"[slides] WARNING: could not set sharing ({msg[:120]}).")
        return False


def url(presentation_id: str) -> str:
    return f"https://docs.google.com/presentation/d/{presentation_id}/edit"


if __name__ == "__main__":
    import json

    with open(".tmp/analysis.json", encoding="utf-8") as f:
        analysis = json.load(f)
    pid = generate(analysis)
    print(f"[slides] {url(pid)}")
