"""Central configuration loader.

Reads values from the project's .env file and exposes them as module-level
constants. Every other tool imports from here so there is ONE place that knows
about environment variables.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Windows consoles default to cp1252 and crash on emoji in video titles.
# Force UTF-8 output (replacing anything unprintable) for every tool.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Project root.
# - Normal run:  the folder that contains this tools/ directory.
# - Frozen .exe (PyInstaller): the folder where the .exe lives, so it reads the
#   .env / credentials.json / token.json sitting next to the executable.
if getattr(sys, "frozen", False):
    ROOT = Path(sys.executable).resolve().parent
else:
    ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"

# Load .env into the process environment.
load_dotenv(ENV_PATH)


def _get(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


# --- YouTube ---------------------------------------------------------------
YOUTUBE_API_KEY = _get("YOUTUBE_API_KEY")

# --- OAuth file paths (resolved relative to project root) ------------------
CREDENTIALS_PATH = ROOT / _get("GOOGLE_CREDENTIALS_PATH", "credentials.json")
TOKEN_PATH = ROOT / _get("GOOGLE_TOKEN_PATH", "token.json")

# --- Generated resource IDs (blank until first run) ------------------------
SPREADSHEET_ID = _get("SPREADSHEET_ID")
PRESENTATION_ID = _get("PRESENTATION_ID")

# --- Email -----------------------------------------------------------------
SENDER_EMAIL = _get("SENDER_EMAIL")
# RECIPIENT_EMAIL may be a comma-separated list.
RECIPIENT_EMAIL = _get("RECIPIENT_EMAIL")

# --- Defaults --------------------------------------------------------------
DEFAULT_REGION = _get("DEFAULT_REGION", "US")
# Default topic(s) searched when `yta run` is called with no selectors.
DEFAULT_KEYWORDS = _get("DEFAULT_KEYWORDS")
DEFAULT_CATEGORY = _get("DEFAULT_CATEGORY")
DEFAULT_MAX_RESULTS = int(_get("DEFAULT_MAX_RESULTS", "25") or "25")

# --- Paths -----------------------------------------------------------------
TMP_DIR = ROOT / ".tmp"
TMP_DIR.mkdir(exist_ok=True)


def recipients() -> list[str]:
    """Return the recipient email(s) as a clean list."""
    return [e.strip() for e in RECIPIENT_EMAIL.split(",") if e.strip()]


def require(name: str) -> str:
    """Fetch a required env value, raising a clear error if it's missing."""
    value = _get(name)
    if not value:
        raise SystemExit(
            f"[config] Missing required value '{name}' in {ENV_PATH}.\n"
            f"         Open .env and fill it in, then re-run."
        )
    return value


def set_env_value(key: str, value: str) -> None:
    """Write/replace a KEY=value line in the .env file (used to persist
    generated Sheet/Slide IDs after the first run)."""
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    found = False
    for i, line in enumerate(lines):
        stripped = line.lstrip()
        if stripped.startswith(f"{key}=") and not stripped.startswith("#"):
            lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
