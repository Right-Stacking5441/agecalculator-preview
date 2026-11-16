#!/usr/bin/env python3
"""Cutover gate for 404.html (M6 / N4 / N5).

Fails if docs/404.html still has relative href/src values, a <base>, or
document.write. Run only at launch:

    LAUNCH=1 python3 tests/test_404_urls.py

Without LAUNCH=1 the test skips, so the preview suite stays green while the
preview 404 still uses a JS <base> and prefix-relative URLs.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "docs" / "404.html"
OK = re.compile(r"""^(?:/|#|https://|mailto:)""", re.I)
ATTR = re.compile(r"""\b(?:href|src)\s*=\s*(['"])(.*?)\1""", re.I)


def main() -> int:
    if os.environ.get("LAUNCH") != "1":
        print("SKIP tests/test_404_urls.py (set LAUNCH=1 at cutover to enforce root-relative 404 URLs)")
        return 0
    if not HTML.is_file():
        print(f"FAIL  {HTML} is missing")
        return 1
    text = HTML.read_text(encoding="utf-8")
    issues: list[str] = []
    if re.search(r"<base\b", text, re.I):
        issues.append("contains a <base> element")
    if "document.write" in text:
        issues.append("contains document.write")
    for quote, url in ATTR.findall(text):
        if not OK.search(url):
            issues.append(f'relative URL {url!r}')
    if issues:
        print(f"FAIL  {HTML.relative_to(ROOT)} is not cutover-ready:")
        for item in issues:
            print(f"  - {item}")
        return 1
    print(f"ok    {HTML.relative_to(ROOT)} has root-relative URLs and no <base> or document.write")
    return 0


if __name__ == "__main__":
    sys.exit(main())
