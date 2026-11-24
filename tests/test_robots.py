#!/usr/bin/env python3
"""Robots and preview-banner behaviour for preview vs LAUNCH=1 builds."""
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
ROBOTS_RE = re.compile(r'<meta[^>]*name=["\']robots["\'][^>]*>', re.I)
CONTENT_RE = re.compile(r'content=["\']([^"\']+)["\']', re.I)
STUBS = {
    "how-old-am-i.html",
    "date-of-birth.html",
    "rodent-age-calculator.html",
    "how-old-am-i/index.html",
    "date-of-birth/index.html",
}


def robots_content(html: str) -> str | None:
    m = ROBOTS_RE.search(html)
    if not m:
        return None
    c = CONTENT_RE.search(m.group(0))
    return c.group(1) if c else m.group(0)


def classify(rel: str) -> str:
    if rel in STUBS:
        return "stub"
    if rel in ("embed/index.html", "embed.html"):
        return "embed"
    if rel in ("widget/index.html", "widget.html"):
        return "widget"
    parts = rel.split("/")
    if (
        len(parts) == 3
        and parts[0] == "past"
        and parts[1].isdigit()
        and parts[2] == "index.html"
    ):
        return "year"
    if rel == "past/index.html":
        return "hub"
    return "page"


def check_tree(docs: Path, launch: bool) -> list[str]:
    issues: list[str] = []
    robots = (docs / "robots.txt").read_text()
    if launch:
        if "Disallow: /" in robots:
            issues.append("launch robots.txt still has Disallow: /")
        if "Allow: /" not in robots:
            issues.append("launch robots.txt missing Allow: /")
        if "Sitemap: https://agecalculator.com/sitemap.xml" not in robots:
            issues.append("launch robots.txt missing Sitemap line")
    else:
        if "Disallow: /" not in robots:
            issues.append("preview robots.txt missing Disallow: /")
        if "Sitemap:" in robots:
            issues.append("preview robots.txt should not list a Sitemap")

    saw_banner = False
    for pth in sorted(docs.rglob("*.html")):
        rel = pth.relative_to(docs).as_posix()
        html = pth.read_text(encoding="utf-8")
        kind = classify(rel)
        content = robots_content(html)
        has_banner = 'class="preview-banner"' in html
        if has_banner:
            saw_banner = True
        if kind == "stub":
            if content is not None and "noindex" in content:
                issues.append(f"{rel} stub must not have noindex ({content})")
            continue
        if launch:
            if has_banner:
                issues.append(f"{rel} launch page still has the preview banner")
            if kind in ("embed", "widget"):
                if content != "noindex":
                    issues.append(f"{rel} should be noindex only, got {content!r}")
            else:
                if content is not None:
                    issues.append(f"{rel} should have no robots meta in a launch build, got {content!r}")
        else:
            if kind in ("year", "hub"):
                if content is not None and "noindex" in content:
                    issues.append(f"{rel} year/hub preview must not have noindex ({content})")
            elif content != "noindex,nofollow":
                issues.append(f"{rel} preview should be noindex,nofollow, got {content!r}")
    if launch and saw_banner:
        issues.append("launch build kept a preview banner")
    if not launch and not saw_banner:
        issues.append("preview build has no preview banner")
    # Privacy date is confirmed, not a placeholder.
    privacy = docs / "privacy" / "index.html"
    if privacy.is_file() and "Last updated 23 November 2026" not in privacy.read_text():
        issues.append("privacy should say Last updated 23 November 2026")

    html_404 = (docs / "404.html").read_text(encoding="utf-8")
    if 'property="og:url"' in html_404 or "property='og:url'" in html_404:
        issues.append("404.html should not have og:url (it was pointing at /privacy)")
    title_m = re.search(r"<title>([^<]*)</title>", html_404)
    title = title_m.group(1) if title_m else ""
    if launch and re.search(r"preview", title, re.I):
        issues.append(f"LAUNCH 404 title should not mention preview, got {title!r}")
    if not launch and saw_banner:
        # The preview banner must live in a landmark (aside).
        if "<aside" not in html_404 or "preview-banner" not in html_404:
            issues.append("preview 404 banner is not inside a landmark")
        # Spot-check the homepage too.
        home = (docs / "index.html").read_text(encoding="utf-8")
        if "<aside" not in home or 'class="preview-banner"' not in home:
            issues.append("preview homepage banner is not inside a landmark")
    return issues


def build_launch_copy() -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="agecalc-launch-"))
    dest = tmp / "agecalculator"
    shutil.copytree(
        ROOT,
        dest,
        ignore=shutil.ignore_patterns(".git", "__pycache__", ".pytest_cache", "node_modules"),
    )
    env = os.environ.copy()
    env["LAUNCH"] = "1"
    # Drop AGECALC_DOCS if a parent set it.
    env.pop("AGECALC_DOCS", None)
    subprocess.check_call(
        [sys.executable, "scripts/build_copy.py"],
        cwd=dest,
        env=env,
    )
    return dest


def main() -> int:
    issues = check_tree(DOCS, launch=False)
    if issues:
        print("FAIL  preview docs/ robots checks:")
        for item in issues:
            print("  -", item)
        return 1
    print("ok    preview docs/: site-wide noindex,nofollow, Disallow robots.txt, banner present")

    dest = None
    try:
        dest = build_launch_copy()
        launch_issues = check_tree(dest / "docs", launch=True)
        if launch_issues:
            print("FAIL  LAUNCH=1 build robots checks:")
            for item in launch_issues:
                print("  -", item)
            return 1
        print("ok    LAUNCH=1 build: open robots.txt with Sitemap, noindex only on /embed/ and /widget/, no preview banner")
    finally:
        if dest is not None:
            shutil.rmtree(dest.parent, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
