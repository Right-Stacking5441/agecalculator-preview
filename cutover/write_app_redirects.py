#!/usr/bin/env python3
"""Write cutover/netlify-app-redirects/_redirects from the year range and slugs."""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "scripts"))
from promote_dirs import DIR_PAGES, YEAR_MAX, YEAR_MIN  # noqa: E402

DEST = HERE / "netlify-app-redirects" / "_redirects"
HOST = "https://app.agecalculator.com"
ROOT_URL = "https://agecalculator.com"


def rule(src: str, dest: str) -> str:
    return f"{src}  {dest}  301!"


def main() -> None:
    lines: list[str] = [
        "# Redirect-only site for app.agecalculator.com.",
        "# Publish this directory. Do not attach agecalculator.com or www.",
        "# HTTP is two hops on Netlify (same-host HTTP→HTTPS first); https:// rules are the ones that fire.",
        f"# Prebuilt year pages: /past/{YEAR_MIN}/ … /past/{YEAR_MAX}/, one hop to the trailing-slash URL.",
        "# Years outside that range go to /past/?year=.",
        "",
    ]
    aliases = [
        ("/rodent-age-calculator.html", f"{ROOT_URL}/"),
        ("/how-old-am-i", f"{ROOT_URL}/"),
        ("/date-of-birth", f"{ROOT_URL}/"),
        # CSV row 73 (Wayback): must sit above the catch-alls. Netlify also
        # matches a no-slash rule to the slashed path, but both are listed so
        # the intent is obvious in the file.
        ("/privacy-policy", f"{ROOT_URL}/privacy/"),
        ("/privacy-policy/", f"{ROOT_URL}/privacy/"),
    ]
    for scheme in ("https", "http"):
        origin = f"{scheme}://app.agecalculator.com"
        for path, dest in aliases:
            lines.append(rule(f"{origin}{path}", dest))
    lines.append("")

    for year in range(YEAR_MIN, YEAR_MAX + 1):
        dest = f"{ROOT_URL}/past/{year}/"
        for scheme in ("https", "http"):
            origin = f"{scheme}://app.agecalculator.com"
            lines.append(rule(f"{origin}/past/{year}", dest))
    lines.append("")

    for scheme in ("https", "http"):
        origin = f"{scheme}://app.agecalculator.com"
        lines.append(rule(f"{origin}/past", f"{ROOT_URL}/past/"))
        lines.append(rule(f"{origin}/past/*", f"{ROOT_URL}/past/?year=:splat"))
    lines.append("")

    slugs = [s for s in DIR_PAGES if s != "past"]
    for slug in slugs:
        dest = f"{ROOT_URL}/{slug}/"
        for scheme in ("https", "http"):
            origin = f"{scheme}://app.agecalculator.com"
            lines.append(rule(f"{origin}/{slug}", dest))
            lines.append(rule(f"{origin}/{slug}.html", dest))
    lines.append("")

    # /* already matches / (empty splat -> https://agecalculator.com/), so
    # a separate exact-/ rule would never fire.
    for scheme in ("https", "http"):
        origin = f"{scheme}://app.agecalculator.com"
        lines.append(rule(f"{origin}/*", f"{ROOT_URL}/:splat"))
    lines.append("")

    lines.append("# Path-only copies, used if the request is already on this site without a host match.")
    for path, dest in aliases:
        lines.append(rule(path, dest))
    for year in range(YEAR_MIN, YEAR_MAX + 1):
        lines.append(rule(f"/past/{year}", f"{ROOT_URL}/past/{year}/"))
    lines.append(rule("/past", f"{ROOT_URL}/past/"))
    lines.append(rule("/past/*", f"{ROOT_URL}/past/?year=:splat"))
    for slug in slugs:
        dest = f"{ROOT_URL}/{slug}/"
        lines.append(rule(f"/{slug}", dest))
        lines.append(rule(f"/{slug}.html", dest))
    lines.append(rule("/*", f"{ROOT_URL}/:splat"))
    lines.append("")

    DEST.write_text("\n".join(lines))
    print(f"wrote {DEST} ({sum(1 for ln in lines if ln and not ln.startswith('#'))} rules)")


if __name__ == "__main__":
    main()
