#!/usr/bin/env python3
"""FAQ accordion: four pages keep items, seven have none, and no FAQPage JSON-LD."""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compare_copy import DOCS, jsonld_faqs, visible_faqs  # noqa: E402

# Pages that keep a visible accordion, with the expected heading and item count.
WITH_FAQ = {
    "index.html": ("More on how it works", 2),
    "difference/index.html": ("Groups and privacy", 2),
    "chronological-age/index.html": ("If you're scoring a test", 1),
    "cat-age/index.html": ("Compared with other conversions", 2),
}

# Tool pages that must have no accordion and no leftover wrapper.
WITHOUT_FAQ = [
    "past/index.html",
    "days-between-dates/index.html",
    "dog-age/index.html",
    "korean-age/index.html",
    "birthday-countdown/index.html",
    "how-old-will-i-be/index.html",
    "what-year-was-i-born/index.html",
]


def heading(html: str) -> str:
    m = re.search(r'<h2 id="faq-h">([^<]*)</h2>', html)
    return m.group(1).strip() if m else ""


def fold_apos(s: str) -> str:
    return s.replace("\u2019", "'").replace("\u2018", "'")


def has_faq_wrapper(html: str) -> bool:
    return bool(re.search(r'<section[^>]*class="[^"]*\bfaq\b', html))


def main() -> int:
    issues: list[str] = []
    checked = 0
    for rel, (want_h, want_n) in WITH_FAQ.items():
        pth = DOCS / rel
        if not pth.is_file():
            issues.append(f"{rel} missing")
            continue
        html = pth.read_text(encoding="utf-8")
        vis = visible_faqs(html)
        ld = jsonld_faqs(html)
        h = heading(html)
        if not vis:
            issues.append(f"{rel} has no visible accordion")
        if len(vis) != want_n:
            issues.append(f"{rel} accordion count {len(vis)}, expected {want_n}")
        if not h:
            issues.append(f"{rel} is missing the accordion heading")
        elif fold_apos(h) != fold_apos(want_h):
            issues.append(f"{rel} heading {h!r}, expected {want_h!r}")
        if ld:
            issues.append(f"{rel} still has FAQPage JSON-LD")
        checked += 1
    for rel in WITHOUT_FAQ:
        pth = DOCS / rel
        if not pth.is_file():
            issues.append(f"{rel} missing")
            continue
        html = pth.read_text(encoding="utf-8")
        vis = visible_faqs(html)
        ld = jsonld_faqs(html)
        h = heading(html)
        if vis:
            issues.append(f"{rel} still has a visible accordion ({len(vis)} items)")
        if ld:
            issues.append(f"{rel} still has FAQPage JSON-LD")
        if h:
            issues.append(f"{rel} still has an accordion heading: {h!r}")
        if has_faq_wrapper(html):
            issues.append(f"{rel} still has a leftover FAQ wrapper")
        checked += 1
    if checked != 11:
        issues.append(f"expected 11 tool pages, checked {checked}")
    if issues:
        print("FAIL  FAQ accordion:")
        for item in issues:
            print("  -", item)
        return 1
    print(
        "ok    accordion on 4 pages, none on 7, and no FAQPage JSON-LD on the 11 tool pages"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
