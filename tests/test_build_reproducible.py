#!/usr/bin/env python3
"""A fresh preview build_copy must byte-match the committed docs/ tree."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

JS_FLAG = "document.documentElement.classList.add('js');"
JOIN_RAW_NEWLINE = re.compile(r"join\('\n'\)")


def _files(root: Path) -> dict[Path, Path]:
    out: dict[Path, Path] = {}
    for pth in root.rglob("*"):
        if not pth.is_file():
            continue
        rel = pth.relative_to(root)
        if any(part.startswith(".") or part == "__pycache__" for part in rel.parts):
            continue
        out[rel] = pth
    return out


def _check_generated_scripts(docs: Path) -> list[str]:
    issues: list[str] = []
    html_files = sorted(p for p in docs.rglob("*.html") if p.is_file())
    flagged = 0
    for pth in html_files:
        text = pth.read_text(encoding="utf-8")
        rel = pth.relative_to(docs).as_posix()
        if JOIN_RAW_NEWLINE.search(text):
            issues.append(f"{rel}: menu debug script has a raw newline inside join('...')")
        if JS_FLAG in text:
            flagged += 1
            js_at = text.find(JS_FLAG)
            css_at = text.find('rel="stylesheet"')
            if css_at == -1:
                css_at = text.find("rel='stylesheet'")
            if css_at == -1 or not (0 <= js_at < css_at):
                issues.append(f"{rel}: js-flag script is missing or not before the first stylesheet")
    if flagged == 0:
        issues.append("no page has the html.js flag script")
    return issues


def main() -> int:
    issues = _check_generated_scripts(DOCS)
    tmp = Path(tempfile.mkdtemp(prefix="agecalc-rebuild-"))
    dest = tmp / "docs"
    try:
        shutil.copytree(DOCS, dest, ignore=shutil.ignore_patterns(".git", "__pycache__"))
        env = os.environ.copy()
        env["AGECALC_DOCS"] = str(dest)
        env.pop("LAUNCH", None)
        subprocess.check_call(
            [sys.executable, "scripts/build_copy.py"],
            cwd=ROOT,
            env=env,
        )
        issues.extend(_check_generated_scripts(dest))
        expected = _files(DOCS)
        got = _files(dest)
        missing = sorted(expected.keys() - got.keys())
        extra = sorted(got.keys() - expected.keys())
        for rel in missing:
            issues.append(f"fresh build is missing {rel.as_posix()}")
        for rel in extra:
            issues.append(f"fresh build added unexpected {rel.as_posix()}")
        for rel in sorted(expected.keys() & got.keys()):
            a = expected[rel].read_bytes()
            b = got[rel].read_bytes()
            if a != b:
                issues.append(
                    f"{rel.as_posix()} differs from a fresh build_copy "
                    f"(committed {len(a)} bytes, generated {len(b)} bytes)"
                )
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if issues:
        print("FAIL  docs/ does not match a fresh preview build:")
        for item in issues[:40]:
            print("  -", item)
        if len(issues) > 40:
            print(f"  ... and {len(issues) - 40} more")
        return 1
    print("ok    fresh build_copy into a temp dir byte-matches docs/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
