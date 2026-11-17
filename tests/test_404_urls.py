#!/usr/bin/env python3
"""404.html must work on nested paths with JS off (M6 / N4 / N5).

No <base>, no document.write, and href/src values must be absolute root
paths with trailing slashes on page links. Preview builds may prefix
/agecalculator-preview; a LAUNCH=1 build must not.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "docs" / "404.html"
LAUNCH = os.environ.get("LAUNCH") == "1"
PREFIX = "" if LAUNCH else "/agecalculator-preview"
OK = re.compile(r"""^(?:/|#|https://|mailto:)""", re.I)
ATTR = re.compile(r"""\b(?:href|src)\s*=\s*(['"])(.*?)\1""", re.I)
PAGE_SLUGS = {
    "difference", "past", "how-old-will-i-be", "days-between-dates",
    "chronological-age", "birthday-countdown", "korean-age",
    "what-year-was-i-born", "dog-age", "cat-age", "embed", "privacy",
    "contact", "widget",
}


def main() -> int:
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
            issues.append(f"relative URL {url!r}")
            continue
        if url.startswith(("#", "mailto:", "https://", "http://")):
            continue
        if LAUNCH and url.startswith("/agecalculator-preview"):
            issues.append(f"launch 404 still has preview prefix: {url!r}")
        if not LAUNCH and url.startswith("/") and not url.startswith(PREFIX + "/") and url not in ("/",):
            # Home can be PREFIX + '/' or, if we ever used '/', call it out.
            if not url.startswith(PREFIX):
                issues.append(f"preview 404 URL missing {PREFIX} prefix: {url!r}")
        path = url
        if path.startswith(PREFIX):
            path = path[len(PREFIX):] or "/"
        slug = path.strip("/")
        if slug in PAGE_SLUGS and not path.endswith("/"):
            issues.append(f"page link missing trailing slash: {url!r}")
    if "There's no page at this address" not in text and "There is no page at this address" not in text:
        issues.append("missing the production 404 wording")
    if issues:
        print(f"FAIL  {HTML.relative_to(ROOT)} is not ready:")
        for item in issues:
            print(f"  - {item}")
        return 1
    mode = "launch" if LAUNCH else "preview"
    print(f"ok    {HTML.relative_to(ROOT)} has absolute root-relative URLs and no <base> or document.write ({mode})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
