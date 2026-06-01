"""Analyze fetched YouTube videos: engagement metrics, rankings, category
breakdown, and a plain-language narrative summary.

Pure computation — no API calls. Produces a structured analysis dict that the
Sheets/Slides/email tools consume, including chart-ready series.
"""
from __future__ import annotations

import json
import statistics


def _engagement_rate(v: dict) -> float:
    """(likes + comments) / views, as a percentage."""
    if v["views"] <= 0:
        return 0.0
    return round((v["likes"] + v["comments"]) / v["views"] * 100, 2)


def analyze(videos: list[dict]) -> dict:
    if not videos:
        return {
            "video_count": 0, "videos": [], "totals": {},
            "top_by_views": [], "top_by_engagement": [], "top_channels": [],
            "category_breakdown": [], "charts": {},
            "narrative": "No videos were returned for the given inputs.",
        }

    for v in videos:
        v["engagement_rate"] = _engagement_rate(v)

    by_views = sorted(videos, key=lambda v: v["views"], reverse=True)
    by_engagement = sorted(videos, key=lambda v: v["engagement_rate"],
                           reverse=True)

    total_views = sum(v["views"] for v in videos)
    total_likes = sum(v["likes"] for v in videos)
    total_comments = sum(v["comments"] for v in videos)
    avg_engagement = round(
        statistics.mean(v["engagement_rate"] for v in videos), 2
    )

    # Channel frequency.
    channel_counts: dict[str, int] = {}
    for v in videos:
        channel_counts[v["channel"]] = channel_counts.get(v["channel"], 0) + 1
    top_channels = sorted(channel_counts.items(),
                          key=lambda kv: kv[1], reverse=True)[:5]

    # Category breakdown: count + total views per category.
    cat_stats: dict[str, dict] = {}
    for v in videos:
        name = v.get("category") or "Uncategorized"
        c = cat_stats.setdefault(name, {"count": 0, "views": 0})
        c["count"] += 1
        c["views"] += v["views"]
    category_breakdown = sorted(
        ({"category": k, **val} for k, val in cat_stats.items()),
        key=lambda d: d["views"], reverse=True,
    )

    analysis = {
        "video_count": len(videos),
        "videos": videos,
        "totals": {
            "views": total_views,
            "likes": total_likes,
            "comments": total_comments,
            "avg_engagement_rate": avg_engagement,
        },
        "top_by_views": by_views[:5],
        "top_by_engagement": by_engagement[:5],
        "top_channels": top_channels,
        "category_breakdown": category_breakdown,
    }
    analysis["charts"] = _chart_series(analysis)
    analysis["narrative"] = _narrative(analysis)
    return analysis


def _chart_series(a: dict) -> dict:
    """Pre-compute simple (label, value) series for the slide/email bar charts."""
    return {
        "views_bar": [
            {"label": v["title"][:40], "value": v["views"],
             "sub": v["channel"]}
            for v in a["top_by_views"]
        ],
        "engagement_bar": [
            {"label": v["title"][:40], "value": v["engagement_rate"],
             "sub": v["channel"]}
            for v in a["top_by_engagement"]
        ],
        "category_bar": [
            {"label": c["category"], "value": c["views"], "sub": f"{c['count']} videos"}
            for c in a["category_breakdown"][:6]
        ],
    }


def _narrative(a: dict) -> str:
    top = a["top_by_views"][0]
    eng = a["top_by_engagement"][0]
    t = a["totals"]
    lead_channels = ", ".join(c for c, _ in a.get("top_channels", [])[:3])
    lead_cat = (a["category_breakdown"][0]["category"]
                if a["category_breakdown"] else "")

    parts = [
        f"Analyzed {a['video_count']} videos with a combined "
        f"{t['views']:,} views, {t['likes']:,} likes, and "
        f"{t['comments']:,} comments.",
        f"The most-viewed video is \"{top['title']}\" by {top['channel']} "
        f"({top['views']:,} views).",
        f"The strongest engagement belongs to \"{eng['title']}\" by "
        f"{eng['channel']} at a {eng['engagement_rate']}% engagement rate, "
        f"against an average of {t['avg_engagement_rate']}% across the set.",
    ]
    if lead_cat:
        parts.append(f"The dominant content category by views is {lead_cat}.")
    if lead_channels:
        parts.append(f"Most frequently appearing channels: {lead_channels}.")
    return " ".join(parts)


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="Analyze fetched video data.")
    p.add_argument("--in", dest="infile", default=".tmp/videos.json")
    p.add_argument("--out", default=".tmp/analysis.json")
    args = p.parse_args()

    with open(args.infile, encoding="utf-8") as f:
        videos = json.load(f)
    result = analyze(videos)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"[analyze] {result['video_count']} videos analyzed -> {args.out}")
    print("[analyze] " + result["narrative"])
