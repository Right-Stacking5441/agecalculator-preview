#!/usr/bin/env python3
"""Check the preview (local docs server or hosted GitHub Pages) for 404s.

Usage:
  python3 cutover/verify_preview.py --base http://127.0.0.1:8765
  python3 cutover/verify_preview.py --base https://right-stacking5441.github.io/agecalculator-preview

The preview is a project site, so --base must include the /agecalculator-preview
prefix when pointed at GitHub Pages. A local server of docs/ uses a bare origin.

Directory URLs without a slash must 301 to the slash form (not a 200 stub body).
Legacy stubs (/rodent-age-calculator.html, /how-old-am-i, /date-of-birth) are 200s
(meta refresh + canonical to /), not 301s. Unknown paths must return HTTP 404.
"""
from __future__ import annotations

import argparse
import re
import sys
from urllib.parse import urljoin
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from legacy_urls import (  # noqa: E402
    STUB_PATHS,
    directory_slashless,
    preview_paths,
)


def join(base: str, path: str) -> str:
    base = base.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def serve_docs(docs: Path):
    from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
    import threading

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(docs), **k)

        def log_message(self, *a):
            pass

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def open_no_follow(url: str):
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "agecalculator-preview-verify"})
    try:
        with opener.open(req, timeout=20) as r:
            return r.status, r.headers.get("Location") or r.headers.get("location"), r.read(4096)
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location") or e.headers.get("location") if e.headers else None
        body = e.read(4096) if e.fp else b""
        return e.code, loc, body


def expects_slash_301(path: str) -> bool:
    return path in directory_slashless()


def is_stub(path: str) -> bool:
    return path in STUB_PATHS or path.rstrip("/") in {p.rstrip("/") for p in STUB_PATHS if not p.endswith(".html")}


def location_is_slash_form(path: str, location: str | None) -> bool:
    if not location:
        return False
    want = path.rstrip("/") + "/"
    return location.endswith(want) or location.rstrip("/").endswith(path.rstrip("/")) and location.endswith("/")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", help="Origin, including any repo prefix")
    ap.add_argument("--docs", help="Serve this docs/ directory on an ephemeral local port")
    args = ap.parse_args()
    httpd = None
    if args.docs:
        httpd, base = serve_docs(Path(args.docs))
    elif args.base:
        base = args.base.rstrip("/")
    else:
        ap.error("provide --base or --docs")
    failed = 0
    passed = 0
    paths = preview_paths()
    print(f"verify preview against {base}  ({len(paths)} paths)")
    for path in paths:
        url = join(base, path)
        try:
            status, location, body = open_no_follow(url)
        except Exception as e:
            print(f"FAIL  {path}  error: {e}")
            failed += 1
            continue

        if expects_slash_301(path):
            if status in (301, 302) and location_is_slash_form(path, location):
                # A 200 stub body here would mean a leftover slug.html is stealing the 301.
                print(f"ok    {path}  {status} -> {location}")
                passed += 1
            else:
                hint = ""
                if status == 200:
                    hint = " (200 body; leftover slug.html stub would cause this on GitHub Pages)"
                print(f"FAIL  {path}  expected 301 to trailing slash, got {status} {location or ''}{hint}")
                failed += 1
            continue

        if is_stub(path):
            # Slashless /how-old-am-i and /date-of-birth: Python's server 301s to the
            # directory stub; GitHub Pages may serve a sibling .html stub as 200.
            if status in (301, 302) and not path.endswith((".html", "/")) and location_is_slash_form(path, location):
                print(f"ok    {path}  {status} -> {location} (alias to directory stub)")
                passed += 1
                continue
            if status != 200:
                print(f"FAIL  {path}  expected stub 200, got {status} {location or ''}")
                failed += 1
                continue
            text = body.decode("utf-8", "replace")
            if "noindex" in text:
                print(f"FAIL  {path}  stub must not have noindex")
                failed += 1
                continue
            if 'http-equiv="refresh"' not in text or 'content="0;url=' not in text:
                print(f"FAIL  {path}  stub missing content=\"0\" meta refresh")
                failed += 1
                continue
            if 'rel="canonical"' not in text or "https://agecalculator.com/" not in text:
                print(f"FAIL  {path}  stub missing canonical to the homepage")
                failed += 1
                continue
            print(f"ok    {path}  200 stub")
            passed += 1
            continue

        if status != 200:
            print(f"FAIL  {path}  expected 200, got {status} {location or ''}")
            failed += 1
            continue
        print(f"ok    {path}  200")
        passed += 1

    # Unknown paths must be a real 404 (custom 404.html on GitHub Pages; plain 404 locally).
    for unknown in ("/no-such-page", "/no-such/nested/path"):
        try:
            status, location, body = open_no_follow(join(base, unknown))
        except Exception as e:
            print(f"FAIL  {unknown}  error: {e}")
            failed += 1
            continue
        if status == 404:
            print(f"ok    {unknown}  404")
            passed += 1
        else:
            print(f"FAIL  {unknown}  expected 404, got {status} {location or ''}")
            failed += 1

    # The /embed/ demo iframe must point at a slash widget URL that returns 200.
    try:
        opener = urllib.request.build_opener(NoRedirect)
        req = urllib.request.Request(
            join(base, "/embed/"),
            method="GET",
            headers={"User-Agent": "agecalculator-preview-verify"},
        )
        with opener.open(req, timeout=20) as r:
            estatus, ehtml = r.status, r.read().decode("utf-8", "replace")
        if estatus != 200:
            print(f"FAIL  /embed/  expected 200 for iframe check, got {estatus}")
            failed += 1
        else:
            m = re.search(r'<iframe[^>]*\ssrc="([^"]+)"', ehtml)
            if not m:
                print("FAIL  /embed/  missing demo iframe")
                failed += 1
            else:
                src = m.group(1)
                bad = "widget.html" in src or re.search(r"/widget(\?|$)", src)
                if bad or "/widget/" not in src:
                    print(f"FAIL  /embed/  iframe src should be a slash widget URL, got {src}")
                    failed += 1
                else:
                    widget_url = src if src.startswith("http") else urljoin(join(base, "/embed/"), src)
                    wstatus, _loc, _body = open_no_follow(widget_url)
                    if wstatus != 200:
                        print(f"FAIL  embed iframe {widget_url}  expected 200, got {wstatus}")
                        failed += 1
                    else:
                        print(f"ok    embed iframe {src}  200")
                        passed += 1
    except Exception as e:
        print(f"FAIL  /embed/ iframe check  error: {e}")
        failed += 1

    print(f"{passed} passed, {failed} failed")
    if httpd is not None:
        httpd.shutdown()
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
