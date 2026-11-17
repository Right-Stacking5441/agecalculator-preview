#!/usr/bin/env python3
"""Fail if a tool page loses its FAQ section or FAQPage JSON-LD."""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compare_copy import DOCS, MAP, jsonld_faqs, visible_faqs  # noqa: E402

TOOL_HTML = [
    "index.html",
    "past/index.html",
    "difference/index.html",
    "days-between-dates/index.html",
    "chronological-age/index.html",
    "dog-age/index.html",
    "cat-age/index.html",
    "korean-age/index.html",
    "birthday-countdown/index.html",
    "how-old-will-i-be/index.html",
    "what-year-was-i-born/index.html",
]


def heading(html: str) -> str:
    m = re.search(r'<h2 id="faq-h">([^<]*)</h2>', html)
    return m.group(1).strip() if m else ""


def main() -> int:
    # Sanity: the 11 tool pages in MAP are the ones that must keep a FAQ.
    issues: list[str] = []
    for rel in TOOL_HTML:
        pth = DOCS / rel
        if not pth.is_file():
            issues.append(f"{rel} missing")
            continue
        html = pth.read_text(encoding="utf-8")
        vis = visible_faqs(html)
        ld = jsonld_faqs(html)
        h = heading(html)
        if not vis:
            issues.append(f"{rel} has no visible FAQ")
        if not ld:
            issues.append(f"{rel} has no FAQPage JSON-LD")
        if not h:
            issues.append(f"{rel} is missing the FAQ heading")
        if vis and ld and vis != ld:
            issues.append(f"{rel} visible FAQ does not match FAQPage JSON-LD ({len(vis)} vs {len(ld)})")
    if issues:
        print("FAIL  FAQ presence:")
        for item in issues:
            print("  -", item)
        return 1
    print(f"ok    FAQ and FAQPage JSON-LD present and matching on {len(TOOL_HTML)} tool pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
