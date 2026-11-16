"""Bake each page's empty result card into the static HTML.

Default path: inject vendored snapshots from scripts/fragments/leaves/, so
build_copy.py can run from the repo alone with no browser, no extra Python
environment, and no server on port 8777.

Optional refresh: BAKE_LEAVES=1 python3 scripts/ux/prerender.py
starts a local ephemeral HTTP server and re-snapshots #leaf with Playwright.
"""
from __future__ import annotations

import os
import pathlib
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).resolve().parent
FRAG_LEAVES = HERE.parent / "fragments" / "leaves"
REPO = HERE.parents[1]


def _soup():
    from bs4 import BeautifulSoup
    return BeautifulSoup


def calc_pages(docs: pathlib.Path) -> list[pathlib.Path]:
    pages = []
    for p in sorted(docs.glob("*.html")):
        if "data-calc" in p.read_text(encoding="utf-8"):
            pages.append(p)
    return pages


def inject_leaves(docs: pathlib.Path) -> int:
    BeautifulSoup = _soup()
    docs = pathlib.Path(docs)
    n = 0
    missing = []
    for p in calc_pages(docs):
        snap = FRAG_LEAVES / p.name
        if not snap.is_file():
            missing.append(p.name)
            continue
        s = BeautifulSoup(p.read_text(encoding="utf-8"), "html.parser")
        leaf = s.select_one("#leaf")
        if not leaf:
            continue
        baked = BeautifulSoup(snap.read_text(encoding="utf-8"), "html.parser").select_one("#leaf")
        if baked is None:
            raise SystemExit(f"leaf snapshot for {p.name} has no #leaf")
        leaf.replace_with(baked)
        p.write_text(str(s), encoding="utf-8")
        print("baked", p.name, " ".join(baked.get("class") or []), baked.get("data-state") or "")
        n += 1
    if missing:
        raise SystemExit(
            "Missing vendored #leaf snapshots in scripts/fragments/leaves/: "
            + ", ".join(missing)
            + ". Re-run with BAKE_LEAVES=1 to refresh them."
        )
    return n


def _serve(docs: pathlib.Path):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(docs), **kwargs)

        def log_message(self, fmt, *args):
            pass

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    port = httpd.server_address[1]
    return httpd, f"http://127.0.0.1:{port}"


def bake_leaves(docs: pathlib.Path) -> int:
    """Refresh scripts/fragments/leaves/ from a live load of each calculator page."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise SystemExit("BAKE_LEAVES=1 needs playwright in this Python environment") from e
    BeautifulSoup = _soup()
    docs = pathlib.Path(docs)
    FRAG_LEAVES.mkdir(parents=True, exist_ok=True)
    httpd, base = _serve(docs)
    n = 0
    try:
        launch_kw = {"args": ["--no-sandbox"]}
        chrome = pathlib.Path("/usr/bin/google-chrome")
        if chrome.is_file():
            launch_kw["executable_path"] = str(chrome)
        with sync_playwright() as pw:
            b = pw.chromium.launch(**launch_kw)
            pg = b.new_page(viewport={"width": 390, "height": 844}, locale="en-GB", timezone_id="Europe/London")
            for p in calc_pages(docs):
                pg.goto(f"{base}/{p.name}", wait_until="networkidle")
                pg.wait_for_timeout(250)
                d = pg.evaluate(
                    """() => { const l = document.getElementById('leaf');
                      return { cls: l.className, state: l.getAttribute('data-state'),
                               html: l.innerHTML.replace(/<noscript>[\\s\\S]*?<\\/noscript>/, '') }; }"""
                )
                s = BeautifulSoup(p.read_text(encoding="utf-8"), "html.parser")
                leaf = s.select_one("#leaf")
                ns = leaf.find("noscript") if leaf else None
                leaf.clear()
                leaf.append(BeautifulSoup(d["html"], "html.parser"))
                if ns:
                    leaf.append(ns)
                leaf["class"] = d["cls"].split()
                leaf["data-state"] = d["state"] or "empty"
                (FRAG_LEAVES / p.name).write_text(str(leaf), encoding="utf-8")
                p.write_text(str(s), encoding="utf-8")
                print("rebaked", p.name, d["cls"])
                n += 1
            b.close()
    finally:
        httpd.shutdown()
    return n


def prerender(docs: pathlib.Path, base: str | None = None) -> int:
    # `base` is accepted for compatibility; the default path does not use a server.
    if os.environ.get("BAKE_LEAVES") == "1":
        return bake_leaves(pathlib.Path(docs))
    return inject_leaves(pathlib.Path(docs))


if __name__ == "__main__":
    docs = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else (REPO / "docs")
    prerender(docs)
