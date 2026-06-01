"""Desktop GUI for the YouTube Analytics Automation.

A simple windowed app: pick region / category / content type from dropdowns,
type keywords, click Run. Progress streams into the log box. Designed to be
packaged into a standalone .exe with PyInstaller (see build_exe.bat).

Run as a script:  python tools/gui.py
"""
from __future__ import annotations

import queue
import sys
import threading
import tkinter as tk
from tkinter import ttk

import config

# Dropdown option sets ------------------------------------------------------
REGIONS = [
    ("(skip trending)", ""),
    ("Philippines (PH)", "PH"), ("United States (US)", "US"),
    ("Japan (JP)", "JP"), ("India (IN)", "IN"), ("Singapore (SG)", "SG"),
    ("South Korea (KR)", "KR"), ("Indonesia (ID)", "ID"),
    ("United Kingdom (GB)", "GB"), ("Australia (AU)", "AU"),
    ("Canada (CA)", "CA"),
]
CATEGORIES = [
    ("All categories", ""), ("Film & Animation", "Film & Animation"),
    ("Music", "Music"), ("Sports", "Sports"), ("Gaming", "Gaming"),
    ("People & Blogs", "People & Blogs"), ("Comedy", "Comedy"),
    ("Entertainment", "Entertainment"), ("News & Politics", "News & Politics"),
    ("Howto & Style", "Howto & Style"), ("Education", "Education"),
    ("Science & Technology", "Science & Technology"),
]
CONTENT_TYPES = [("Both", "both"), ("Reels only (<=60s)", "reel"),
                 ("Videos only (>60s)", "video")]
MATCH_MODES = [("Related (broad)", "related"),
               ("Exact phrase", "exact"),
               ("Strict (phrase in title)", "strict")]

RED = "#cc0000"
DARK = "#17171c"


class StreamToQueue:
    """File-like object that pushes writes onto a thread-safe queue."""
    def __init__(self, q: queue.Queue):
        self.q = q

    def write(self, text):
        self.q.put(text)

    def flush(self):
        pass


class App:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.q: queue.Queue = queue.Queue()
        root.title("YouTube Analyst")
        root.geometry("600x740")
        root.configure(bg="white")
        root.minsize(520, 660)

        self._build_header()
        self._build_form()
        self._build_log()
        self._poll_queue()

    # --- layout ------------------------------------------------------------
    def _build_header(self):
        bar = tk.Frame(self.root, bg=DARK, height=64)
        bar.pack(fill="x")
        bar.pack_propagate(False)
        tk.Frame(bar, bg=RED, width=6).pack(side="left", fill="y")
        tk.Label(bar, text="  YouTube Analyst", bg=DARK, fg="white",
                 font=("Segoe UI", 16, "bold")).pack(side="left", pady=14)

    def _row(self, parent, label):
        f = tk.Frame(parent, bg="white")
        f.pack(fill="x", pady=6)
        tk.Label(f, text=label, bg="white", fg=DARK, width=14, anchor="w",
                 font=("Segoe UI", 10)).pack(side="left")
        return f

    def _combo(self, parent, options, default_idx=0):
        var = tk.StringVar(value=options[default_idx][0])
        cb = ttk.Combobox(parent, textvariable=var, state="readonly",
                          values=[o[0] for o in options], font=("Segoe UI", 10))
        cb.pack(side="left", fill="x", expand=True)
        return var, options

    def _build_form(self):
        form = tk.Frame(self.root, bg="white", padx=22, pady=10)
        form.pack(fill="x")

        # Keywords (typed)
        r = self._row(form, "Keywords")
        self.kw = tk.Entry(r, font=("Segoe UI", 10))
        self.kw.pack(side="left", fill="x", expand=True)
        self.kw.insert(0, config.DEFAULT_KEYWORDS or "")

        # Keyword match precision
        r = self._row(form, "Keyword match")
        self.match_var, self.match_opts = self._combo(r, MATCH_MODES)

        # Region dropdown. Defaults to "(skip trending)" so a keyword/topic
        # report shows ONLY topic videos — picking a region mixes in that
        # country's trending (which has huge view counts and can bury the
        # topic videos in the rankings).
        r = self._row(form, "Region")
        self.region_var, self.region_opts = self._combo(r, REGIONS, 0)

        # Category dropdown
        r = self._row(form, "Category")
        self.cat_var, self.cat_opts = self._combo(r, CATEGORIES)

        # Content type dropdown
        r = self._row(form, "Content type")
        self.ct_var, self.ct_opts = self._combo(r, CONTENT_TYPES)

        # Channels (optional, typed)
        r = self._row(form, "Channel IDs")
        self.channels = tk.Entry(r, font=("Segoe UI", 10))
        self.channels.pack(side="left", fill="x", expand=True)

        # Max + email
        r = self._row(form, "Max results")
        self.max_var = tk.IntVar(value=config.DEFAULT_MAX_RESULTS)
        tk.Spinbox(r, from_=5, to=50, textvariable=self.max_var, width=6,
                   font=("Segoe UI", 10)).pack(side="left")
        self.email_var = tk.BooleanVar(value=True)
        tk.Checkbutton(r, text="Email the report", variable=self.email_var,
                       bg="white", font=("Segoe UI", 10),
                       activebackground="white").pack(side="left", padx=18)

        # Run button
        self.run_btn = tk.Button(
            form, text="Run Report", bg=RED, fg="white",
            activebackground="#a30000", activeforeground="white",
            font=("Segoe UI", 11, "bold"), relief="flat", pady=8,
            cursor="hand2", command=self.on_run)
        self.run_btn.pack(fill="x", pady=(12, 4))

    def _build_log(self):
        wrap = tk.Frame(self.root, bg="white", padx=22, pady=4)
        wrap.pack(fill="both", expand=True)
        self.status = tk.Label(wrap, text="Ready.", bg="white", fg="#666",
                               anchor="w", font=("Segoe UI", 9))
        self.status.pack(fill="x")
        self.log = tk.Text(wrap, bg="#101014", fg="#d4d4d8", wrap="word",
                           font=("Consolas", 9), height=12, relief="flat")
        self.log.pack(fill="both", expand=True, pady=(4, 8))

    # --- helpers -----------------------------------------------------------
    def _selected(self, var, opts):
        label = var.get()
        for disp, value in opts:
            if disp == label:
                return value
        return ""

    def _append(self, text):
        self.log.insert("end", text)
        self.log.see("end")

    def _poll_queue(self):
        try:
            while True:
                self._append(self.q.get_nowait())
        except queue.Empty:
            pass
        self.root.after(80, self._poll_queue)

    # --- run ---------------------------------------------------------------
    def on_run(self):
        params = dict(
            region=self._selected(self.region_var, self.region_opts) or None,
            category=self._selected(self.cat_var, self.cat_opts) or None,
            content_type=self._selected(self.ct_var, self.ct_opts),
            match=self._selected(self.match_var, self.match_opts),
            keywords=self.kw.get().strip() or None,
            channels=self.channels.get().strip() or None,
            max_results=self.max_var.get(),
            send_email_flag=self.email_var.get(),
        )
        self.run_btn.config(state="disabled", text="Running…")
        self.status.config(text="Working… this takes about a minute.")
        self.log.delete("1.0", "end")
        threading.Thread(target=self._worker, args=(params,),
                         daemon=True).start()

    def _worker(self, params):
        import run_weekly_report
        old = sys.stdout
        sys.stdout = StreamToQueue(self.q)
        ok = True
        try:
            run_weekly_report.run_report(**params)
        except SystemExit as e:
            ok = False
            self.q.put(f"\n[stopped] {e}\n")
        except Exception as e:  # noqa: BLE001
            ok = False
            self.q.put(f"\n[error] {e}\n")
        finally:
            sys.stdout = old
            self.root.after(0, lambda: self._done(ok))

    def _done(self, ok):
        self.run_btn.config(state="normal", text="Run Report")
        self.status.config(
            text="Done — check your email." if ok else "Finished with an error.")


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
