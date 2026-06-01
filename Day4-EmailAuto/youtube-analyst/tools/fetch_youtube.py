"""Fetch YouTube data via the Data API v3.

Supports four selectors (all optional, combinable):
  - region   : YouTube's "most popular" chart for a region code (e.g. US)
  - category : content type / video category (e.g. Music, Gaming, News).
               Works with region trending; resolved name -> categoryId.
  - keywords : search top videos matching one or more search terms
  - channels : most recent videos from specific channel IDs

"all" simply means providing region (+ optional category) plus keywords plus
channels together — they are merged and de-duped.

Returns a normalized list of video dicts, each enriched with a category title.
Uses only the API KEY (no OAuth) — this is all public data.

CLI:
    python tools/fetch_youtube.py --region US --category Gaming --max 25
    python tools/fetch_youtube.py --keywords "AI,fitness" --channels UCxxxx
    python tools/fetch_youtube.py --list-categories --region US
"""
from __future__ import annotations

import argparse
import json
import re

from googleapiclient.discovery import build

import config

# Videos at or under this duration are treated as Shorts / Reels.
SHORT_MAX_SECONDS = 60

_DUR_RE = re.compile(
    r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", re.IGNORECASE)


def _parse_duration(iso: str) -> int:
    """ISO-8601 duration (e.g. 'PT1M30S') -> total seconds."""
    if not iso:
        return 0
    m = _DUR_RE.fullmatch(iso)
    if not m:
        return 0
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s

# Build a key-authenticated client (no OAuth needed for public data).
_youtube = build("youtube", "v3", developerKey=config.YOUTUBE_API_KEY,
                 cache_discovery=False)

# Cache of {region: {title_lower: id, id: title}} so we only call the API once.
_category_cache: dict[str, dict] = {}


# --- Categories ------------------------------------------------------------
def get_categories(region: str) -> dict:
    """Return a bidirectional map of video categories for a region:
    {"music": "10", "10": "Music", ...}."""
    region = (region or config.DEFAULT_REGION).upper()
    if region in _category_cache:
        return _category_cache[region]

    resp = _youtube.videoCategories().list(
        part="snippet", regionCode=region
    ).execute()
    mapping: dict[str, str] = {}
    for item in resp.get("items", []):
        cid = item["id"]
        title = item["snippet"]["title"]
        mapping[title.lower()] = cid
        mapping[cid] = title
    _category_cache[region] = mapping
    return mapping


def resolve_category(value: str | None, region: str) -> str | None:
    """Turn a category name OR id into a categoryId. Returns None if blank."""
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return value
    cats = get_categories(region)
    cid = cats.get(value.lower())
    if not cid:
        available = sorted({v for k, v in cats.items() if not k.isdigit()})
        raise SystemExit(
            f"[fetch] Unknown category '{value}' for region {region}.\n"
            f"        Available: {', '.join(available)}"
        )
    return cid


def list_categories(region: str) -> list[tuple[str, str]]:
    """Return [(id, title)] sorted by id, for display."""
    cats = get_categories(region)
    pairs = [(k, v) for k, v in cats.items() if k.isdigit()]
    return sorted(pairs, key=lambda kv: int(kv[0]))


# --- Normalization ---------------------------------------------------------
def _normalize(item: dict) -> dict:
    snip = item.get("snippet", {})
    stats = item.get("statistics", {})
    duration = _parse_duration(
        item.get("contentDetails", {}).get("duration", ""))
    return {
        "video_id": item["id"],
        "title": snip.get("title", ""),
        "channel": snip.get("channelTitle", ""),
        "channel_id": snip.get("channelId", ""),
        "category_id": snip.get("categoryId", ""),
        "category": "",  # filled in later via _attach_categories
        "published_at": snip.get("publishedAt", ""),
        "url": f"https://www.youtube.com/watch?v={item['id']}",
        "thumbnail": (snip.get("thumbnails", {}) or {})
                     .get("medium", {}).get("url", ""),
        "duration_sec": duration,
        "is_short": 0 < duration <= SHORT_MAX_SECONDS,
        "format": ("Reel" if 0 < duration <= SHORT_MAX_SECONDS else "Video"),
        "views": int(stats.get("viewCount", 0)),
        "likes": int(stats.get("likeCount", 0)),
        "comments": int(stats.get("commentCount", 0)),
        "tags": snip.get("tags", []),
    }


def _video_details(video_ids: list[str]) -> list[dict]:
    """Hydrate video IDs with snippet + statistics, in batches of 50."""
    out: list[dict] = []
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        resp = _youtube.videos().list(
            part="snippet,statistics,contentDetails",
            id=",".join(batch),
        ).execute()
        for item in resp.get("items", []):
            out.append(_normalize(item))
    return out


# --- Fetch modes -----------------------------------------------------------
def fetch_trending(region: str, max_results: int,
                   category_id: str | None = None) -> list[dict]:
    params = dict(
        part="snippet,statistics,contentDetails",
        chart="mostPopular",
        regionCode=region,
        maxResults=min(max_results, 50),
    )
    if category_id:
        params["videoCategoryId"] = category_id
    resp = _youtube.videos().list(**params).execute()
    return [_normalize(i) for i in resp.get("items", [])]


def fetch_by_keywords(keywords: list[str], max_results: int,
                      match: str = "related") -> list[dict]:
    """match controls how tightly results match the keyword:
      - related : YouTube's broad/associative search (default)
      - exact   : the keyword is sent as a quoted phrase (must appear)
      - strict  : exact phrase AND the keyword must be in the video title
    """
    match = (match or "related").lower()
    ids: list[str] = []
    for kw in keywords:
        q = f'"{kw}"' if match in ("exact", "strict") else kw
        resp = _youtube.search().list(
            part="id", q=q, type="video", order="viewCount",
            maxResults=min(max_results, 50),
        ).execute()
        ids += [it["id"]["videoId"] for it in resp.get("items", [])
                if it["id"].get("videoId")]
    videos = _video_details(list(dict.fromkeys(ids)))

    if match == "strict":
        terms = [k.lower() for k in keywords]
        videos = [v for v in videos
                  if any(t in v["title"].lower() for t in terms)]
    return videos


def fetch_by_channels(channel_ids: list[str], max_results: int) -> list[dict]:
    ids: list[str] = []
    for cid in channel_ids:
        resp = _youtube.search().list(
            part="id", channelId=cid, type="video", order="date",
            maxResults=min(max_results, 50),
        ).execute()
        ids += [it["id"]["videoId"] for it in resp.get("items", [])
                if it["id"].get("videoId")]
    return _video_details(list(dict.fromkeys(ids)))


def _attach_categories(videos: list[dict], region: str) -> None:
    """Fill each video's human-readable category title using the region map."""
    try:
        cats = get_categories(region)
    except Exception:
        return  # category titles are nice-to-have, never fatal
    for v in videos:
        if v.get("category_id"):
            v["category"] = cats.get(v["category_id"], "")


def _filter_content_type(videos: list[dict], content_type: str | None) -> list[dict]:
    """Keep reels (<=60s), regular videos (>60s), or both."""
    ct = (content_type or "both").lower()
    if ct in ("reel", "reels", "short", "shorts"):
        return [v for v in videos if v["is_short"]]
    if ct in ("video", "videos", "long"):
        return [v for v in videos if not v["is_short"]]
    return videos  # both / unknown


# Named length buckets -> (min_seconds, max_seconds). max None = no upper bound.
# Durations are inclusive of min, exclusive of max.
LENGTH_BUCKETS = {
    "reel":     (1, 61),        # Reels / Shorts: <= 60s
    "video":    (61, None),     # any standard video: > 60s
    "mid":      (61, 901),      # 1–15 min
    "gt15":     (901, None),    # > 15 min
    "gt30":     (1801, None),   # > 30 min
    "gt60":     (3601, None),   # > 60 min
}


def _filter_length(videos: list[dict], length: str | None) -> list[dict]:
    """Filter by video duration using a named bucket (see LENGTH_BUCKETS).
    Blank / 'any' / 'all' keeps everything. Videos with an unknown (0s)
    duration are dropped only when a real lower bound is requested."""
    key = (length or "").lower().strip()
    if not key or key in ("any", "all", "both"):
        return videos
    lo, hi = LENGTH_BUCKETS.get(key, (0, None))
    out = []
    for v in videos:
        d = v.get("duration_sec", 0)
        if d <= 0 and lo > 0:
            continue
        if d < lo:
            continue
        if hi is not None and d >= hi:
            continue
        out.append(v)
    return out


def fetch(region: str | None = None,
          keywords: list[str] | None = None,
          channels: list[str] | None = None,
          category: str | None = None,
          content_type: str | None = None,
          match: str = "related",
          length: str | None = None,
          max_results: int = 25) -> list[dict]:
    """Top-level fetch. Combines whichever selectors are provided, de-dupes by
    video_id, attaches category titles, and filters by content type
    (reel / video / both) and by `length` bucket. `match` controls keyword
    precision."""
    region_for_cats = region or config.DEFAULT_REGION
    category_id = resolve_category(category, region_for_cats)

    videos: list[dict] = []
    if region:
        videos += fetch_trending(region, max_results, category_id)
    if keywords:
        videos += fetch_by_keywords(keywords, max_results, match)
    if channels:
        videos += fetch_by_channels(channels, max_results)

    # If nothing was specified, default to trending in the default region.
    if not (region or keywords or channels):
        videos += fetch_trending(config.DEFAULT_REGION, max_results,
                                  category_id)

    seen: dict[str, dict] = {}
    for v in videos:
        seen[v["video_id"]] = v
    result = _filter_content_type(list(seen.values()), content_type)
    result = _filter_length(result, length)
    _attach_categories(result, region_for_cats)
    return result


def _parse_list(value: str | None) -> list[str]:
    return [x.strip() for x in value.split(",")] if value else []


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Fetch YouTube video data.")
    p.add_argument("--region", help="Region code for trending, e.g. US")
    p.add_argument("--category", help="Content type / category (name or id)")
    p.add_argument("--keywords", help="Comma-separated search keywords")
    p.add_argument("--channels", help="Comma-separated channel IDs")
    p.add_argument("--max", type=int, default=config.DEFAULT_MAX_RESULTS)
    p.add_argument("--out", default=str(config.TMP_DIR / "videos.json"))
    p.add_argument("--list-categories", action="store_true",
                   help="Print available content categories and exit.")
    args = p.parse_args()

    if args.list_categories:
        region = args.region or config.DEFAULT_REGION
        print(f"Content categories for region {region}:")
        for cid, title in list_categories(region):
            print(f"  {cid:>3}  {title}")
        raise SystemExit(0)

    data = fetch(
        region=args.region,
        keywords=_parse_list(args.keywords),
        channels=_parse_list(args.channels),
        category=args.category,
        max_results=args.max,
    )
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[fetch] {len(data)} videos -> {args.out}")
