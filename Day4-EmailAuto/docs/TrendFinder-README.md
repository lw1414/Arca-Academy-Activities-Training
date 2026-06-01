# Trend Finder — Trend Research System

Search trending articles across **Google News, Reddit, and Hacker News**, use
**Gemini Flash** to extract the ranked idea/product list inside each article,
pick the ideas you want, and **export them to CSV**.

## Architecture (two servers)

| Server | File | Port | Role |
|--------|------|------|------|
| Node.js | `serve.mjs` | 3002 | Serves the frontend, proxies thumbnail images (`/img`), proxies Gemini (`/gemini`) so the API key never reaches the browser |
| Flask | `server.py` | 5001 | Scraping + extraction: `/api/trending`, `/api/extract` |

The browser loads the page from Node (:3002) and calls the Flask API (:5001)
directly for search/extraction.

## Setup

1. **Install Python dependencies**
   ```powershell
   pip install -r requirements.txt
   ```
2. **Add your Gemini API key** — copy `.env.example` to `.env` and paste your key
   from <https://aistudio.google.com/app/apikey>:
   ```
   GEMINI_API_KEY=your_key_here
   ```
   The key is read server-side only and is never exposed to the browser.
   (Node 20.6+ / 24 is required — `serve.mjs` uses built-in `fetch` and
   `process.loadEnvFile`, so there is **no `npm install`**.)

## Run (two terminals)

```powershell
# Terminal 1 — Flask API
python server.py            # http://localhost:5001

# Terminal 2 — Node frontend
node serve.mjs              # http://localhost:3002
```

Then open **http://localhost:3002**.

## How to use

1. **Search** a topic → top 5 trending articles appear as cards.
2. On any card:
   - **Extract Ideas** — pulls the ranked list straight into the right panel.
   - **Browse & Pick** — opens a checklist popup so you choose which ideas to keep.
3. **Idea panel** (right) — each idea is a checkbox; tick the ones you want.
4. **Preview** — see the selected ideas in a table.
5. **Export CSV** — downloads a UTF-8 CSV (opens cleanly in Excel / Google Sheets).

## Google News links

Most listicles arrive as Google News **redirect** links, which a server can't
follow. When that happens the card shows a **yellow warning** with an
**Open article ↗** link and a paste box:

1. Click **Open article ↗**, let it redirect to the real article (GQ, Forbes,
   Wirecutter, CNET, …).
2. Copy the URL from your browser's address bar.
3. Paste it into the box and press **Enter** — extraction runs on the real article.

## Extraction quality

Gemini Flash is the **primary** extractor: the full article text is sent to it
and it returns only the real ranked list (ignoring menus, sidebars, ads).
A lightweight HTML/pattern-matching parser is used **only as a fallback** if
Gemini is unavailable or returns nothing usable. Gemini is used for **text
analysis only** — never image generation.

## Files

```
.env              # your GEMINI_API_KEY (gitignored, never commit)
.env.example      # template
server.py         # Flask API  (:5001)
serve.mjs         # Node server (:3002)
Trend Finder.html # frontend UI
requirements.txt  # flask, requests, beautifulsoup4, feedparser, python-dotenv
```
