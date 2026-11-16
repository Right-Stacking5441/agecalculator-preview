#!/usr/bin/env python3
"""Cutover gate: fail if any built HTML or approved copy still has a placeholder.

Run only at launch:

    LAUNCH=1 python3 tests/test_placeholders.py

Without LAUNCH=1 the test skips, so the preview suite stays green while
privacy.md still has [PLACEHOLDER: date this policy is published].
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
COPY = ROOT / "copy-approved"
NEEDLE = re.compile(r"\[PLACEHOLDER|PLACEHOLDER:", re.I)


def iter_files():
    for p in sorted(DOCS.glob("*.html")):
        yield p
    if COPY.is_dir():
        for p in sorted(COPY.glob("*.md")):
            yield p


def main() -> int:
    if os.environ.get("LAUNCH") != "1":
        print("SKIP tests/test_placeholders.py (set LAUNCH=1 at cutover to fail on leftover placeholders)")
        return 0
    issues: list[str] = []
    for p in iter_files():
        text = p.read_text(encoding="utf-8")
        for i, line in enumerate(text.splitlines(), 1):
            if NEEDLE.search(line):
                issues.append(f"{p.relative_to(ROOT)}:{i}: {line.strip()}")
    if issues:
        print("FAIL  placeholders remain:")
        for item in issues:
            print(f"  - {item}")
        return 1
    print("ok    no [PLACEHOLDER / PLACEHOLDER: in built HTML or approved copy")
    return 0


if __name__ == "__main__":
    sys.exit(main())
