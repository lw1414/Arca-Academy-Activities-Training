"""Unified command-line interface — one command for everything.

Use via the launcher in the project root:

    yta run                         # full report (defaults from .env)
    yta run --region US --category Gaming
    yta run --keywords "AI,fitness" --channels UCxxxx --no-email
    yta run --all                   # region + your saved keywords/channels

    yta categories [--region US]    # list content types you can target
    yta auth                        # one-time Google authorization
    yta dashboard                   # launch the web dashboard
    yta schedule --day MON --time 09:00 [run options]   # weekly auto-run
    yta unschedule                  # remove the scheduled task
    yta status                      # show current schedule

Without the launcher:  python tools/cli.py run --region US
"""
from __future__ import annotations

import argparse
import subprocess
import sys

import config

TASK_NAME = "YouTubeAnalystWeekly"
PY = sys.executable  # the venv python running this
REPORT_SCRIPT = str(config.ROOT / "tools" / "run_weekly_report.py")
AUTH_SCRIPT = str(config.ROOT / "tools" / "google_auth.py")
VALID_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


# --- run -------------------------------------------------------------------
def cmd_run(args) -> None:
    import run_weekly_report
    region = args.region
    keywords = args.keywords
    channels = args.channels
    # --all = use region default plus whatever keywords/channels were given.
    if args.all and not region:
        region = config.DEFAULT_REGION
    run_weekly_report.run_report(
        region=region, keywords=keywords, channels=channels,
        category=args.category, content_type=args.content_type,
        match=args.match, max_results=args.max,
        send_email_flag=not args.no_email)


# --- categories ------------------------------------------------------------
def cmd_categories(args) -> None:
    import fetch_youtube
    region = args.region or config.DEFAULT_REGION
    print(f"Content categories for region {region}:\n")
    for cid, title in fetch_youtube.list_categories(region):
        print(f"  {cid:>3}  {title}")
    print("\nUse any name or id with:  yta run --region "
          f"{region} --category <name>")


# --- auth ------------------------------------------------------------------
def cmd_auth(_args) -> None:
    subprocess.run([PY, AUTH_SCRIPT], check=False)


# --- dashboard -------------------------------------------------------------
def cmd_dashboard(_args) -> None:
    print("Starting dashboard at http://localhost:5173 (Ctrl+C to stop)...")
    subprocess.run(["node", str(config.ROOT / "serve.mjs")], check=False)


# --- scheduling (Windows Task Scheduler) -----------------------------------
def _report_command(args) -> str:
    """Build the quoted command the scheduled task will run."""
    parts = [f'"{PY}"', f'"{REPORT_SCRIPT}"']
    if args.region:
        parts += ["--region", args.region]
    if args.category:
        parts += ["--category", f'"{args.category}"']
    if args.keywords:
        parts += ["--keywords", f'"{args.keywords}"']
    if args.channels:
        parts += ["--channels", f'"{args.channels}"']
    if getattr(args, "content_type", None):
        parts += ["--content-type", args.content_type]
    if getattr(args, "match", None):
        parts += ["--match", args.match]
    if args.max:
        parts += ["--max", str(args.max)]
    if getattr(args, "no_email", False):
        parts += ["--no-email"]
    return " ".join(parts)


def cmd_schedule(args) -> None:
    day = (args.day or "MON").upper()
    if day not in VALID_DAYS:
        raise SystemExit(f"--day must be one of {', '.join(VALID_DAYS)}")
    time = args.time or "09:00"
    tr = _report_command(args)

    cmd = ["schtasks", "/Create", "/TN", TASK_NAME, "/TR", tr,
           "/SC", "WEEKLY", "/D", day, "/ST", time, "/F"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"Scheduled weekly report: every {day} at {time}.")
        print(f"  Runs: {tr}")
        print("  Manage it in Windows Task Scheduler under "
              f"'{TASK_NAME}'.")
        # Persist the schedule to .env for reference.
        config.set_env_value("SCHEDULE_DAY", day)
        config.set_env_value("SCHEDULE_TIME", time)
    else:
        print("Failed to create scheduled task:")
        print(result.stderr or result.stdout)
        print("Tip: scheduling requires Windows; run from an account allowed "
              "to create tasks.")


def cmd_unschedule(_args) -> None:
    result = subprocess.run(
        ["schtasks", "/Delete", "/TN", TASK_NAME, "/F"],
        capture_output=True, text=True)
    print("Removed scheduled task." if result.returncode == 0
          else (result.stderr or result.stdout))


def cmd_status(_args) -> None:
    result = subprocess.run(
        ["schtasks", "/Query", "/TN", TASK_NAME, "/FO", "LIST"],
        capture_output=True, text=True)
    if result.returncode == 0:
        print(result.stdout)
    else:
        print(f"No schedule found (task '{TASK_NAME}' is not registered).")
        print("Create one with:  yta schedule --day MON --time 09:00")


# --- arg parsing -----------------------------------------------------------
def _add_run_options(sp) -> None:
    sp.add_argument("--region", help="Trending region code, e.g. US")
    sp.add_argument("--category", help="Content type/category (name or id)")
    sp.add_argument("--keywords", help="Comma-separated search keywords")
    sp.add_argument("--channels", help="Comma-separated channel IDs")
    sp.add_argument("--content-type", choices=["reel", "video", "both"],
                    help="Filter by Reel (<=60s), Video (>60s), or Both")
    sp.add_argument("--match", choices=["related", "exact", "strict"],
                    help="Keyword precision: related (broad), exact (phrase), "
                         "strict (phrase + in title)")
    sp.add_argument("--max", type=int, help="Max results per source")
    sp.add_argument("--no-email", action="store_true",
                    help="Build artifacts without emailing")
    sp.add_argument("--all", action="store_true",
                    help="Use region trending plus given keywords/channels")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="yta", description="YouTube Analytics Automation")
    sub = p.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Generate and send a report")
    _add_run_options(run)
    run.set_defaults(func=cmd_run)

    cats = sub.add_parser("categories", help="List content categories")
    cats.add_argument("--region")
    cats.set_defaults(func=cmd_categories)

    sub.add_parser("auth", help="One-time Google authorization") \
        .set_defaults(func=cmd_auth)
    sub.add_parser("dashboard", help="Launch the web dashboard") \
        .set_defaults(func=cmd_dashboard)

    sched = sub.add_parser("schedule", help="Schedule a weekly auto-run")
    sched.add_argument("--day", help="MON..SUN (default MON)")
    sched.add_argument("--time", help="HH:MM 24h (default 09:00)")
    _add_run_options(sched)
    sched.set_defaults(func=cmd_schedule)

    sub.add_parser("unschedule", help="Remove the scheduled task") \
        .set_defaults(func=cmd_unschedule)
    sub.add_parser("status", help="Show the current schedule") \
        .set_defaults(func=cmd_status)
    return p


def _friendly_error(exc: Exception) -> str:
    """Turn common API errors into plain-language guidance."""
    msg = str(exc)
    if "invalidRegionCode" in msg:
        return ("That region code isn't valid. Use a 2-letter COUNTRY code "
                "(e.g. PH, US, JP) — there is no 'Asia' code. For a topic "
                "search you don't need a region at all; just use keywords.")
    if "quotaExceeded" in msg or "dailyLimitExceeded" in msg:
        return ("Your YouTube API daily quota is used up. Try again tomorrow "
                "or reduce --max.")
    if "API key not valid" in msg or "keyInvalid" in msg:
        return "Your YOUTUBE_API_KEY in .env looks invalid. Check it."
    if "credentials.json" in msg or "token.json" in msg:
        return ("Google authorization is missing or expired. Run `yta auth` "
                "to sign in again.")
    return msg


def main() -> None:
    args = build_parser().parse_args()
    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - top-level friendly handler
        print("\n------------------------------------------------------------")
        print("Something went wrong:")
        print("  " + _friendly_error(exc))
        print("------------------------------------------------------------")
        sys.exit(1)


if __name__ == "__main__":
    main()
