"""Shared Google OAuth helper.

Handles the OAuth 2.0 "installed app" flow used by Sheets, Slides, and Gmail.
On first run it opens a browser for you to approve access and writes token.json.
On later runs it silently reuses (and refreshes) that token.

Usage:
    from tools.google_auth import get_service
    sheets = get_service("sheets", "v4")
"""
from __future__ import annotations

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

import config

# All scopes this system needs. If you ADD a scope later you must delete
# token.json so the consent screen re-prompts for the new permission.
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",     # Sheets read/write
    "https://www.googleapis.com/auth/presentations",    # Slides read/write
    "https://www.googleapis.com/auth/drive.file",       # share files we create
    "https://www.googleapis.com/auth/gmail.send",       # send report email
]


def get_credentials() -> Credentials:
    """Load cached credentials, refreshing or running the consent flow as
    needed."""
    creds: Credentials | None = None

    if config.TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(
            str(config.TOKEN_PATH), SCOPES
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not config.CREDENTIALS_PATH.exists():
                raise SystemExit(
                    f"[auth] {config.CREDENTIALS_PATH} not found.\n"
                    f"        Download your OAuth Desktop client JSON from\n"
                    f"        Google Cloud Console and save it there."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(config.CREDENTIALS_PATH), SCOPES
            )
            # Opens a local browser window for approval.
            creds = flow.run_local_server(port=0)

        config.TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")

    return creds


def get_service(api: str, version: str):
    """Build an authorized Google API client (e.g. get_service('slides','v1'))."""
    return build(api, version, credentials=get_credentials(), cache_discovery=False)


if __name__ == "__main__":
    # Running this file directly triggers the one-time OAuth approval.
    print("[auth] Starting OAuth flow — a browser window will open...")
    get_credentials()
    print(f"[auth] Success. Token saved to {config.TOKEN_PATH}")
