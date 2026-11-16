#!/usr/bin/env python3
"""Post-cutover Playwright check: the 404 page works with JavaScript off.

Visit $BASE/past/1990 (default https://agecalculator.com/past/1990) with JS
disabled. After cutover, Cloudflare Pages serves /404.html for that path.

Asserts:
  - the computed body font includes "Libre Franklin"
  - document.styleSheets is non-empty
  - no 4xx subresource requests
  - Tab then Enter on the skip link leaves the URL on the 404 path

Do not run this against the live root until cutover. For a dry run,
BASE_URL may be pointed at a local Cloudflare-style server.

    python3 cutover/verify-404-nojs.py
    BASE_URL=http://127.0.0.1:8780 python3 cutover/verify-404-nojs.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Allow running from repo root or cutover/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.sync_api import sync_playwright  # noqa: E402


def main() -> int:
    base = os.environ.get("BASE_URL", "https://agecalculator.com").rstrip("/")
    url = base + "/past/1990"
    chrome = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")
    failed: list[str] = []
    failed_reqs: list[str] = []

    def on_response(resp):
        # The document itself is the 404; only flag subresources.
        if resp.request.resource_type == "document":
            return
        if resp.status >= 400:
            failed_reqs.append(f"{resp.status} {resp.request.resource_type} {resp.url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=chrome if Path(chrome).exists() else None,
            args=["--no-sandbox"],
        )
        context = browser.new_context(java_script_enabled=False)
        page = context.new_page()
        page.on("response", on_response)
        page.goto(url, wait_until="load", timeout=30000)
        status = page.evaluate("() => document.readyState")
        font = page.evaluate("() => getComputedStyle(document.body).fontFamily")
        sheets = page.evaluate("() => document.styleSheets.length")
        print(f"GET {url}  readyState={status}  font={font!r}  styleSheets={sheets}")
        if "Libre Franklin" not in (font or ""):
            failed.append(f"body font is {font!r}, expected Libre Franklin")
        if not sheets:
            failed.append("document.styleSheets is empty")
        if failed_reqs:
            failed.append("4xx subresource requests: " + "; ".join(failed_reqs))

        skip = page.locator("a.skip")
        if skip.count():
            page.keyboard.press("Tab")
            page.keyboard.press("Enter")
            page.wait_for_timeout(300)
            here = page.url
            # Stay on this 404 path, not bounced to the homepage.
            if "/past/1990" not in here:
                failed.append(f"skip link left the 404 path; now at {here}")
            else:
                print(f"ok    skip link stayed on {here}")
        else:
            failed.append("no a.skip link found")

        browser.close()

    if failed:
        for item in failed:
            print("FAIL ", item)
        return 1
    print("ok    404 /past/1990 with JavaScript off")
    return 0


if __name__ == "__main__":
    sys.exit(main())
