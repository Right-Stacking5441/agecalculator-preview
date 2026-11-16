"""Old and new URLs to check so none 404 after the GitHub Pages cutover."""
from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from promote_dirs import YEAR_MIN, YEAR_MAX, DIR_PAGES  # noqa: E402

SEO_MAP = Path("/workspace/marketing/seo/2026-11-16-agecalculator-redirect-map.csv")
SITEMAP = ROOT / "docs" / "sitemap.xml"

TOOL_SLUGS = list(DIR_PAGES)

STUB_PATHS = [
    "/how-old-am-i",
    "/how-old-am-i/",
    "/how-old-am-i.html",
    "/date-of-birth",
    "/date-of-birth/",
    "/date-of-birth.html",
    "/rodent-age-calculator.html",
]


def sitemap_paths() -> list[str]:
    if not SITEMAP.is_file():
        return []
    text = SITEMAP.read_text()
    out = []
    for loc in __import__("re").findall(r"<loc>([^<]+)</loc>", text):
        p = urlparse(loc).path or "/"
        out.append(p)
    return out


def year_paths() -> list[str]:
    return [f"/past/{y}/" for y in range(YEAR_MIN, YEAR_MAX + 1)]


def stub_paths() -> list[str]:
    return list(STUB_PATHS)


def slash_variants(path: str) -> list[str]:
    """With and without a trailing slash, plus a bare directory form."""
    if path == "/":
        return ["/"]
    if Path(path).suffix in {".html", ".xml", ".txt", ".ico", ".svg", ".js", ".css", ".woff2", ".woff"}:
        return [path]
    no = path.rstrip("/")
    yes = no + "/"
    return [no, yes]


def preview_paths() -> list[str]:
    """Every path the local / hosted preview check should request (no host)."""
    seen, out = set(), []
    for group in (sitemap_paths(), year_paths(), stub_paths(), ["/"], ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/favicon.svg"]):
        for p in group:
            for v in slash_variants(p):
                if v not in seen:
                    seen.add(v)
                    out.append(v)
    return out


def directory_slashless() -> list[str]:
    """Paths that must 301 to the trailing-slash form on GitHub Pages."""
    paths = [f"/{slug}" for slug in TOOL_SLUGS]
    paths += [f"/past/{y}" for y in range(YEAR_MIN, YEAR_MAX + 1)]
    return paths


def app_redirects() -> list[tuple[str, str]]:
    """(old app path, expected Location on https://agecalculator.com). One hop to the slash URL."""
    pairs = [
        ("/", "https://agecalculator.com/"),
        ("/past", "https://agecalculator.com/past/"),
        ("/past/", "https://agecalculator.com/past/"),
        ("/difference", "https://agecalculator.com/difference/"),
        ("/privacy", "https://agecalculator.com/privacy/"),
        ("/how-old-am-i", "https://agecalculator.com/"),
        ("/date-of-birth", "https://agecalculator.com/"),
        ("/rodent-age-calculator.html", "https://agecalculator.com/"),
        ("/robots.txt", "https://agecalculator.com/robots.txt"),
    ]
    for y in (YEAR_MIN, 1990, 2010, 2024, 2025, YEAR_MAX):
        pairs.append((f"/past/{y}", f"https://agecalculator.com/past/{y}/"))
        pairs.append((f"/past/{y}/", f"https://agecalculator.com/past/{y}/"))
    # A year outside the prebuilt range: hub + ?year=
    pairs.append((f"/past/{YEAR_MAX + 1}", f"https://agecalculator.com/past/?year={YEAR_MAX + 1}"))
    return pairs


if __name__ == "__main__":
    ps = preview_paths()
    print(f"{len(ps)} preview paths")
    for p in ps:
        print(p)
