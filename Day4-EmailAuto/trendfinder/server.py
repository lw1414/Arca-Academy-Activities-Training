"""Trend Finder backend — Flask API on port 5001.

Endpoints:
  GET /api/trending?q=<query>
      Searches Google News RSS, Reddit, and Hacker News and returns the top 5
      trending articles as JSON: {rank, title, link, source, thumbnail}.

  GET /api/extract?url=<article-url>
      Fetches an article, extracts its main text, and asks Gemini Flash to
      return the ranked list of products/ideas in it. Falls back to HTML
      parsing only if Gemini is unavailable or returns nothing usable.
      Returns: {title, url, items:[{rank, idea}], method, ...}.

The Gemini API key is read from .env (GEMINI_API_KEY) and never exposed to the
browser. Run alongside serve.mjs (Node on :3002), which serves the frontend and
proxies images + Gemini.
"""

import concurrent.futures
import json
import os
import re
from urllib.parse import quote_plus, urlparse

import feedparser
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
# Flash model — text analysis only (per the lesson, never image generation).
# "gemini-flash-latest" is the alias that authenticated cleanly with the
# provided key (2.0-flash hit a per-model quota, 1.5-flash is retired).
GEMINI_MODEL = "gemini-flash-latest"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

MAX_RESULTS = 5

app = Flask(__name__)


# Allow the Node frontend (localhost:3002) to call this API from the browser.
@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


# ── Source 1: Google News RSS ────────────────────────────────────────────────
def search_google_news(query):
    """Top articles from Google News RSS. Links are google.com redirects (the
    frontend handles those with the manual paste-box workaround)."""
    url = (
        "https://news.google.com/rss/search?q="
        + quote_plus(query)
        + "&hl=en-US&gl=US&ceid=US:en"
    )
    out = []
    try:
        feed = feedparser.parse(url)
        for entry in feed.entries[:MAX_RESULTS]:
            # Google News titles look like "Real Title - Publisher".
            title = entry.get("title", "")
            source = ""
            src = entry.get("source")
            if src and getattr(src, "title", None):
                source = src.title
            elif " - " in title:
                title, source = title.rsplit(" - ", 1)
            out.append({
                "title": title.strip(),
                "link": entry.get("link", ""),
                "source": (source or "Google News").strip(),
                "thumbnail": None,
            })
    except Exception:
        pass
    return out


# ── Source 2: Reddit ─────────────────────────────────────────────────────────
def search_reddit(query):
    """Top relevant Reddit posts via the public search JSON."""
    url = "https://www.reddit.com/search.json"
    out = []
    try:
        resp = requests.get(
            url,
            params={"q": query, "limit": MAX_RESULTS, "sort": "relevance", "t": "year"},
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        for child in resp.json().get("data", {}).get("children", []):
            d = child.get("data", {})
            thumb = d.get("thumbnail")
            if thumb in ("self", "default", "nsfw", "spoiler", "", None):
                # Prefer a real preview image when available.
                try:
                    thumb = (
                        d["preview"]["images"][0]["source"]["url"].replace("&amp;", "&")
                    )
                except Exception:
                    thumb = None
            out.append({
                "title": d.get("title", ""),
                "link": "https://www.reddit.com" + d.get("permalink", ""),
                "source": "Reddit r/" + d.get("subreddit", ""),
                "thumbnail": thumb,
            })
    except Exception:
        pass
    return out


# ── Source 3: Hacker News (Algolia) ──────────────────────────────────────────
def search_hacker_news(query):
    """Top relevant Hacker News stories via the Algolia search API."""
    url = "https://hn.algolia.com/api/v1/search"
    out = []
    try:
        resp = requests.get(
            url,
            params={"query": query, "tags": "story", "hitsPerPage": MAX_RESULTS},
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        for hit in resp.json().get("hits", []):
            link = hit.get("url") or (
                "https://news.ycombinator.com/item?id=" + str(hit.get("objectID"))
            )
            out.append({
                "title": hit.get("title") or hit.get("story_title") or "",
                "link": link,
                "source": "Hacker News",
                "thumbnail": None,
            })
    except Exception:
        pass
    return out


def _interleave(lists):
    """Round-robin merge so the top 5 mixes sources instead of 5 from one."""
    merged, i = [], 0
    while len(merged) < MAX_RESULTS and any(i < len(l) for l in lists):
        for l in lists:
            if i < len(l):
                merged.append(l[i])
                if len(merged) >= MAX_RESULTS:
                    break
        i += 1
    return merged


def _favicon_for(domain):
    """A logo image for a domain via Google's favicon service (always returns
    something — a globe if the domain is unknown). Used when we can't get a
    real article image."""
    if not domain:
        return None
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"


def _domain_from_source(source):
    """Best-effort guess of a publisher domain from its display name, e.g.
    'Fortune Business Insights' -> 'fortunebusinessinsights.com'. Used only for
    Google News redirect links whose real URL we can't read."""
    if not source:
        return None
    name = re.sub(r"\b(news|magazine|the|inc|hub|learn|business|insights)\b", "",
                  source, flags=re.I)
    slug = re.sub(r"[^a-z0-9]", "", name.lower())
    return f"{slug}.com" if slug else None


def _og_image(url):
    """Fetch a page and return its og:image / twitter:image, or None. Short
    timeout so slow pages can't hold up the whole response."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=6)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for attr, key in (("property", "og:image"), ("name", "og:image"),
                          ("property", "twitter:image"), ("name", "twitter:image")):
            tag = soup.find("meta", attrs={attr: key})
            if tag and tag.get("content"):
                src = tag["content"].strip()
                return src if src.startswith("http") else None
    except Exception:
        pass
    return None


def enrich_thumbnail(result):
    """Give each result a real, link-related image:
       1. keep any thumbnail we already have (e.g. Reddit preview),
       2. for a real article URL, use its og:image, else the site's favicon,
       3. for a Google News redirect link, use the publisher's favicon."""
    if result.get("thumbnail"):
        return result
    link = result.get("link", "")
    host = urlparse(link).netloc.lower()

    if "news.google.com" in host or not link.startswith("http"):
        result["thumbnail"] = _favicon_for(_domain_from_source(result.get("source", "")))
        return result

    result["thumbnail"] = _og_image(link) or _favicon_for(host)
    return result


@app.route("/api/trending")
def trending():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Missing search query (?q=)"}), 400

    # Hit the three sources in parallel for speed.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        f_news = ex.submit(search_google_news, query)
        f_reddit = ex.submit(search_reddit, query)
        f_hn = ex.submit(search_hacker_news, query)
        news, reddit, hn = f_news.result(), f_reddit.result(), f_hn.result()

    results = _interleave([news, reddit, hn])

    # Enrich missing thumbnails in parallel so the page shows real images.
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(enrich_thumbnail, results))

    for i, r in enumerate(results, 1):
        r["rank"] = i

    return jsonify({"query": query, "count": len(results), "results": results})


# ── Article text extraction ──────────────────────────────────────────────────
def fetch_reddit(url):
    """Read a Reddit thread via its public .json API (the HTML 403s scrapers).

    Returns (title, text) built from the post's title, selftext, and the top
    comments — enough for Gemini to pull a list if the thread contains one.
    """
    json_url = url.split("?", 1)[0].rstrip("/") + ".json"
    resp = requests.get(json_url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    post = data[0]["data"]["children"][0]["data"]
    title = post.get("title", "")
    parts = [title, post.get("selftext", "")]
    # Include top comments — list-style threads often live in the replies.
    if len(data) > 1:
        for child in data[1]["data"]["children"][:40]:
            body = child.get("data", {}).get("body")
            if body:
                parts.append(body)
    text = re.sub(r"\n{2,}", "\n", "\n".join(p for p in parts if p))
    return title, text[:12000]


def fetch_article(url):
    """Return (title, main_text) for an article, or raise on failure."""
    if "reddit.com" in urlparse(url).netloc.lower():
        return fetch_reddit(url)

    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    title = ""
    if soup.title:
        title = soup.title.get_text(strip=True)
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        title = og["content"].strip()

    # Drop layout/noise elements before reading the body text.
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
        tag.decompose()

    main = soup.find("article") or soup.find("main") or soup.body or soup
    text = main.get_text("\n", strip=True)
    # Collapse blank lines and cap length so the Gemini prompt stays small.
    text = re.sub(r"\n{2,}", "\n", text)
    return title, text[:12000]


def extract_with_gemini(title, text):
    """Ask Gemini Flash for the ranked list. Returns a list[str] or None.

    Returns None (so the caller can fall back) when no key is set or the call
    fails. Returns [] only if Gemini explicitly found no list.
    """
    if not GEMINI_API_KEY:
        return None

    prompt = (
        "You are reading the text of a web article. Identify the actual ranked "
        "list of products, tools, or ideas that the article is about. Ignore "
        "navigation menus, sidebars, ads, related-article links, and page "
        "layout text. Return ONLY a JSON array of strings, each string being "
        "one product/idea in the order presented. If the article contains no "
        "such list, return [].\n\n"
        f"ARTICLE TITLE: {title}\n\nARTICLE TEXT:\n{text}"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    try:
        resp = requests.post(
            GEMINI_URL, params={"key": GEMINI_API_KEY}, json=body, timeout=40
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
        # Some responses wrap the list in an object.
        if isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    return [str(x).strip() for x in v if str(x).strip()]
        return None
    except Exception:
        return None


def extract_with_html(text):
    """Fallback: pull list-like lines from the article text heuristically.

    Looks for "1. Foo" / "2) Bar" style numbered lines first; if none, takes the
    most substantial standalone lines. Best-effort only — Gemini is primary.
    """
    items = []
    for line in text.split("\n"):
        line = line.strip()
        m = re.match(r"^\d{1,2}[\.\)\:]\s+(.{3,120})$", line)
        if m:
            items.append(m.group(1).strip())
    if not items:
        for line in text.split("\n"):
            line = line.strip()
            if 15 <= len(line) <= 120 and not line.endswith((".", "!", "?")):
                items.append(line)
            if len(items) >= 10:
                break
    # De-dupe, keep order.
    seen, out = set(), []
    for it in items:
        if it.lower() not in seen:
            seen.add(it.lower())
            out.append(it)
    return out[:15]


@app.route("/api/extract")
def extract():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing article url (?url=)"}), 400

    # Google News redirect links can't be followed server-side — tell the
    # frontend to use the manual "Open article + paste real URL" workaround.
    host = urlparse(url).netloc.lower()
    if "news.google.com" in host or "google.com/rss" in url:
        return jsonify({
            "needs_manual_url": True,
            "url": url,
            "message": (
                "This is a Google News redirect link. Open it in your browser, "
                "wait for the real article to load, then copy that URL and paste "
                "it back here."
            ),
        })

    try:
        title, text = fetch_article(url)
    except Exception as e:
        return jsonify({"error": f"Could not fetch the article: {e}", "url": url}), 502

    if not text:
        return jsonify({"error": "No readable text found in the article.", "url": url}), 422

    method = "gemini"
    ideas = extract_with_gemini(title, text)
    if ideas is None:  # Gemini unavailable or failed -> fallback.
        method = "html-fallback"
        ideas = extract_with_html(text)

    items = [{"rank": i, "idea": idea} for i, idea in enumerate(ideas, 1)]
    return jsonify({
        "title": title,
        "url": url,
        "items": items,
        "count": len(items),
        "method": method,
        "gemini_configured": bool(GEMINI_API_KEY),
    })


@app.route("/api/health")
def health():
    return jsonify({"ok": True, "gemini_configured": bool(GEMINI_API_KEY)})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
