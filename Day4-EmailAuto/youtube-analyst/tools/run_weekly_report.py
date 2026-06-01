"""Pipeline orchestrator.

Exposes run_report(...) — the full fetch -> analyze -> Sheets -> Slides ->
Gmail pipeline — and a thin CLI. The unified `yta` CLI (tools/cli.py) calls
run_report() directly; this file also stays runnable on its own.

    python tools/run_weekly_report.py --region US --category Gaming
    python tools/run_weekly_report.py --keywords "AI,fitness" --no-email
"""
from __future__ import annotations

import argparse
import datetime
import json

import config
import fetch_youtube
import analyze_trends
import write_sheets
import generate_slides
import send_email

RUN_CONFIG = config.TMP_DIR / "run_config.json"


def _load_run_config() -> dict:
    if RUN_CONFIG.exists():
        try:
            return json.loads(RUN_CONFIG.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def _split(value):
    if not value:
        return []
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    return [x.strip() for x in str(value).split(",") if x.strip()]


LENGTH_LABELS = {
    "reel": "Reels/Shorts (≤60s)", "video": "videos (>60s)",
    "mid": "videos 1–15 min", "gt15": "videos >15 min",
    "gt30": "videos >30 min", "gt60": "videos >60 min",
}


def run_report(region: str | None = None,
               keywords=None,
               channels=None,
               category: str | None = None,
               content_type: str | None = None,
               match: str | None = None,
               length: str | None = None,
               max_results: int | None = None,
               send_email_flag: bool = True) -> dict:
    """Run the whole pipeline. Returns {sheet_url, slides_url, analysis}."""
    keywords = _split(keywords)
    channels = _split(channels)
    category = category or config.DEFAULT_CATEGORY or None
    content_type = content_type or "both"
    match = match or "related"
    length = (length or "").lower().strip() or None
    max_results = max_results or config.DEFAULT_MAX_RESULTS
    # When nothing is specified, fall back to configured defaults:
    # default keyword(s) first, else trending in the default region.
    if not (region or keywords or channels):
        if config.DEFAULT_KEYWORDS:
            keywords = _split(config.DEFAULT_KEYWORDS)
        else:
            region = config.DEFAULT_REGION

    today = datetime.date.today().strftime("%B %d, %Y")
    scope = []
    if region:
        scope.append(f"{region} trending"
                     + (f" / {category}" if category else ""))
    if keywords:
        scope.append("keywords: " + ", ".join(keywords))
    if channels:
        scope.append(f"{len(channels)} channel(s)")
    if content_type and content_type.lower() != "both":
        scope.append(f"{content_type}s only")
    if length:
        scope.append(LENGTH_LABELS.get(length, length))
    report_date = f"{today}  ·  " + "  +  ".join(scope)

    print("=" * 60)
    print("YouTube Analytics Automation - Report")
    print(f"  region={region!r} category={category!r} keywords={keywords} "
          f"channels={channels} content_type={content_type!r} "
          f"length={length!r} max={max_results}")
    print("=" * 60)

    # 1. Fetch -------------------------------------------------------------
    print("\n[1/5] Fetching YouTube data...")
    videos = fetch_youtube.fetch(
        region=region, keywords=keywords, channels=channels,
        category=category, content_type=content_type, match=match,
        length=length, max_results=max_results)
    print(f"      {len(videos)} unique videos.")
    if not videos:
        raise SystemExit("No videos returned - check inputs/quota.")

    # 2. Analyze -----------------------------------------------------------
    print("\n[2/5] Analyzing trends and engagement...")
    analysis = analyze_trends.analyze(videos)
    (config.TMP_DIR / "analysis.json").write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8")
    print("      " + analysis["narrative"])

    # 3. Sheets ------------------------------------------------------------
    print("\n[3/5] Writing to Google Sheets...")
    spreadsheet_id = write_sheets.write(analysis)
    if spreadsheet_id != config.SPREADSHEET_ID:
        config.set_env_value("SPREADSHEET_ID", spreadsheet_id)
        print("      Saved SPREADSHEET_ID to .env.")
    sheet_url = write_sheets.url(spreadsheet_id)

    # 4. Slides ------------------------------------------------------------
    print("\n[4/5] Generating Google Slides...")
    presentation_id = generate_slides.generate(analysis, report_date=report_date)
    if presentation_id != config.PRESENTATION_ID:
        config.set_env_value("PRESENTATION_ID", presentation_id)
        print("      Saved PRESENTATION_ID to .env.")
    generate_slides.share_anyone(presentation_id)
    slides_url = generate_slides.url(presentation_id)

    # 5. Email -------------------------------------------------------------
    if send_email_flag:
        print("\n[5/5] Sending report email...")
        send_email.send(analysis, slides_url=slides_url, sheet_url=sheet_url,
                        report_date=report_date)
    else:
        print("\n[5/5] Skipping email.")

    print("\n" + "=" * 60)
    print("DONE.")
    print(f"  Sheet:  {sheet_url}")
    print(f"  Slides: {slides_url}")
    print("=" * 60)
    return {"sheet_url": sheet_url, "slides_url": slides_url,
            "analysis": analysis}


def main() -> None:
    p = argparse.ArgumentParser(description="Run the YouTube report.")
    p.add_argument("--region")
    p.add_argument("--category")
    p.add_argument("--keywords")
    p.add_argument("--channels")
    p.add_argument("--content-type", choices=["reel", "video", "both"])
    p.add_argument("--match", choices=["related", "exact", "strict"])
    p.add_argument("--length", choices=list(LENGTH_LABELS.keys()))
    p.add_argument("--max", type=int)
    p.add_argument("--no-email", action="store_true")
    args = p.parse_args()

    # CLI flags override the frontend run_config.
    rc = _load_run_config()
    run_report(
        region=args.region or rc.get("region"),
        keywords=args.keywords or rc.get("keywords"),
        channels=args.channels or rc.get("channels"),
        category=args.category or rc.get("category"),
        content_type=args.content_type or rc.get("content_type"),
        match=args.match or rc.get("match"),
        length=args.length or rc.get("length"),
        max_results=args.max or rc.get("max_results"),
        send_email_flag=not (args.no_email or rc.get("no_email")),
    )


if __name__ == "__main__":
    main()
