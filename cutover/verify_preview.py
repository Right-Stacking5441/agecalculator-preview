#!/usr/bin/env python3
"""Check the preview (local docs server or hosted GitHub Pages) for 404s.

Usage:
  python3 cutover/verify_preview.py --base http://127.0.0.1:8765
  python3 cutover/verify_preview.py --base https://right-stacking5441.github.io/agecalculator-preview

The preview is a project site, so --base must include the /agecalculator-preview
prefix when pointed at GitHub Pages. A local server of docs/ uses a bare origin.
Stubs are 200s (meta refresh + canonical), not 301s. Directory URLs without a
slash should 301 to the slash form (GitHub Pages and Python's http.server both
do this).
"""
from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from legacy_urls import preview_paths, slash_variants  # noqa: E402


def fetch(url: str):
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "agecalculator-preview-verify"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        body = e.read() if e.fp else b""
        return e.code, e.headers, body


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
        # Do not follow redirects automatically: we want to see 301 vs 404.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "agecalculator-preview-verify"})
        status = None
        location = None
        body = b""
        try:
            with opener.open(req, timeout=20) as r:
                status = r.status
                location = r.headers.get("Location") or r.headers.get("location")
                body = r.read(2048)
        except urllib.error.HTTPError as e:
            status = e.code
            location = e.headers.get("Location") or e.headers.get("location") if e.headers else None
            body = e.read(2048) if e.fp else b""
        except Exception as e:
            print(f"FAIL  {path}  error: {e}")
            failed += 1
            continue

        name = path.rsplit("/", 1)[-1]
        is_stub = name.endswith(".html") and name not in ("index.html",) or path.rstrip("/").endswith(("how-old-am-i", "date-of-birth"))
        # Directory without slash: 301 to slash is success.
        if not path.endswith("/") and not name.endswith((".html", ".xml", ".txt", ".ico", ".svg", ".js", ".css")) and path != "/":
            ok = status in (301, 302) and location and location.rstrip("/").endswith(path.rstrip("/"))
            # Some servers append the full path; accept any Location that ends with path + /
            if status in (301, 302) and location and (location.endswith(path.rstrip("/") + "/") or location.endswith(path + "/")):
                ok = True
            if ok:
                print(f"ok    {path}  {status} -> {location}")
                passed += 1
            elif status == 200:
                # http.server sometimes serves the index at the slashless URL.
                print(f"ok    {path}  200 (slashless directory served)")
                passed += 1
            else:
                print(f"FAIL  {path}  expected 301 to trailing slash, got {status} {location}")
                failed += 1
            continue

        if status != 200:
            print(f"FAIL  {path}  expected 200, got {status} {location or ''}")
            failed += 1
            continue
        print(f"ok    {path}  200")
        passed += 1

    print(f"{passed} passed, {failed} failed")
    if httpd is not None:
        httpd.shutdown()
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
