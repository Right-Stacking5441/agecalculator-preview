"""Promote flat docs/*.html pages into trailing-slash directory indexes.

Called after the existing shell → copy → UX → prerender pipeline, which still
builds flat files. This step:

- moves each page (except index.html and 404.html) to <slug>/index.html
- rewrites relative asset and internal links for the new depth
- sets trailing-slash canonicals, og:url and JSON-LD URLs
- writes a static /past/<year>/ page for 1960-2026, each canonicalised to
  https://agecalculator.com/past/ (not listed in the sitemap; no extra noindex)
- writes stub pages only for true legacy URLs GitHub Pages cannot 301
  (/rodent-age-calculator.html, /how-old-am-i, /date-of-birth). Directory
  pages are not also written as slug.html, because that file steals the
  slashless /slug → /slug/ 301 on GitHub Pages.
- rewrites sitemap.xml to trailing-slash loc values (no year URLs)
"""
from __future__ import annotations

import calendar
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
CANON = "https://agecalculator.com"

# Old sitemap and redirect map listed 1960-2024. SEO Manager (16 Nov 2026)
# asked to keep the year pages and extend the range through the current year.
YEAR_MIN, YEAR_MAX = 1960, 2026

# Pages that become /slug/ (not the homepage, not 404).
DIR_PAGES = [
    "past",
    "difference",
    "days-between-dates",
    "chronological-age",
    "birthday-countdown",
    "how-old-will-i-be",
    "korean-age",
    "what-year-was-i-born",
    "dog-age",
    "cat-age",
    "privacy",
    "contact",
    "embed",
    "widget",
]

# Filename (at docs root) or directory slug → destination path on the live root.
# These cannot be 301s on GitHub Pages, so they are stubs.
STUBS = [
    # Apex aliases from the SEO map, plus the university .html backlink.
    # Do not also write DIR_PAGES as slug.html: on GitHub Pages that file is
    # served at slashless /slug and blocks the 301 to /slug/.
    ("how-old-am-i/index.html", "/"),
    ("date-of-birth/index.html", "/"),
    ("how-old-am-i.html", "/"),
    ("date-of-birth.html", "/"),
    ("rodent-age-calculator.html", "/"),
]

# Leftovers from an earlier build that must be deleted, never republished.
DROPPED_STUBS = [f"{slug}.html" for slug in DIR_PAGES]

ASSETS = {
    "styles.css",
    "ux.css",
    "card.css",
    "share.css",
    "unslop.css",
    "apple.css",
    "dates.js",
    "app.js",
    "sheet.js",
    "share.js",
    "favicon.ico",
    "favicon.svg",
    "apple-touch-icon.png",
    "og-image.png",
    "embed.js",
    "robots.txt",
    "sitemap.xml",
}
ASSET_PREFIXES = ("fonts/",)

WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def weekday_name(year: int, month: int = 1, day: int = 1) -> str:
    # calendar.weekday: Monday = 0, matching dates.js WEEKDAYS.
    return WEEKDAYS[calendar.weekday(year, month, day)]


def prod_url(path: str) -> str:
    """Absolute production URL with a trailing slash, except the homepage."""
    if not path or path == "/":
        return CANON + "/"
    if path.startswith("http"):
        if path.startswith(CANON) and not path.endswith("/") and "?" not in path and "#" not in path:
            if path != CANON and not Path(path).suffix:
                return path + "/"
        return path
    if not path.startswith("/"):
        path = "/" + path
    if "." in Path(path).name:
        return CANON + path  # files: /embed.js, /rodent-age-calculator.html
    if not path.endswith("/"):
        path += "/"
    return CANON + path


def depth_of(rel: Path) -> int:
    """Depth of a path relative to docs/ (index.html at root is 0)."""
    return len(rel.parts) - 1


def prefix_for(depth: int) -> str:
    return "../" * depth


def rel_href(dest: str, depth: int) -> str:
    """Relative href from a page at `depth` to a site path like '/', 'past/', 'styles.css'."""
    pre = prefix_for(depth)
    if dest in ("", "/"):
        return "./" if depth == 0 else pre
    dest = dest.lstrip("/")
    return pre + dest


def looks_like_asset(value: str) -> bool:
    v = value.split("?")[0].split("#")[0]
    if v in ASSETS or Path(v).name in ASSETS:
        return True
    return any(v.startswith(p) or v.startswith("../") and p in v for p in ASSET_PREFIXES)


def rewrite_value(value: str, depth: int, current_slug: str | None) -> str:
    if not value or value.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return value
    if value.startswith("http://") or value.startswith("https://") or value.startswith("//"):
        # Production site URLs in snippets, credits, canonicals: trailing slash pages.
        if value.startswith(CANON):
            return prod_url(value)
        return value
    raw, frag = (value.split("#", 1) + [""])[:2]
    q = ""
    if "?" in raw:
        raw, q = raw.split("?", 1)
        q = "?" + q
    suffix = q + (("#" + frag) if frag else "")
    # Strip any existing ../ or ./ so we can re-prefix from the new depth.
    path = raw
    while path.startswith("../"):
        path = path[3:]
    if path.startswith("./"):
        path = path[2:]
    if path == "" or path == ".":
        return rel_href("/", depth) + suffix
    if path in DIR_PAGES or path.rstrip("/") in DIR_PAGES:
        slug = path.rstrip("/")
        return rel_href(slug + "/", depth) + suffix
    if path in ASSETS or any(path.startswith(p) for p in ASSET_PREFIXES):
        return rel_href(path, depth) + suffix
    # Already-directory form "past/" or "past/1990/"
    m = re.fullmatch(r"((?:[A-Za-z0-9._-]+/)+)", path)
    if m and not path.endswith(".html") and not path.endswith(".js") and not path.endswith(".css"):
        return rel_href(path, depth) + suffix
    return value


_ATTR = re.compile(
    r"""\b((?:href|src|action)\s*=\s*)(["'])([^"']+)\2""",
    re.I,
)
_CANONICAL = re.compile(
    r"""(<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>)""",
    re.I,
)
_OGURL = re.compile(
    r"""(<meta\b[^>]*\bproperty\s*=\s*["']og:url["'][^>]*>)""",
    re.I,
)
_JSON_URL = re.compile(
    r"""("url"\s*:\s*")(https://agecalculator\.com[^"]*)(")""",
)


def _set_attr(tag: str, name: str, value: str) -> str:
    if re.search(rf"""\b{name}\s*=""", tag, re.I):
        return re.sub(
            rf"""(\b{name}\s*=\s*)(["'])([^"']*)\2""",
            lambda m: f"{m.group(1)}{m.group(2)}{value}{m.group(2)}",
            tag,
            count=1,
            flags=re.I,
        )
    # insert before /> or >
    if tag.endswith("/>"):
        return tag[:-2] + f' {name}="{value}"/>'
    if tag.endswith(">"):
        return tag[:-1] + f' {name}="{value}">'
    return tag


def rewrite_html(html: str, depth: int, page_path: str) -> str:
    """page_path is the live path, e.g. '/' or '/past/' or '/past/1990/'."""

    def attr_sub(m):
        pre, quote, val = m.group(1), m.group(2), m.group(3)
        new = rewrite_value(val, depth, page_path)
        return f"{pre}{quote}{new}{quote}"

    html = _ATTR.sub(attr_sub, html)

    canon = prod_url(page_path)

    def can_sub(m):
        return _set_attr(m.group(1), "href", canon)

    def og_sub(m):
        return _set_attr(m.group(1), "content", canon)

    html = _CANONICAL.sub(can_sub, html)
    html = _OGURL.sub(og_sub, html)
    html = _JSON_URL.sub(lambda m: m.group(1) + prod_url(m.group(2)) + m.group(3), html)
    return html


def promote_flat_pages(docs: Path = DOCS) -> list[Path]:
    written = []
    for slug in DIR_PAGES:
        src = docs / f"{slug}.html"
        if not src.is_file():
            raise SystemExit(f"missing flat page {src}")
        dest_dir = docs / slug
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "index.html"
        html = rewrite_html(src.read_text(), 1, f"/{slug}/")
        dest.write_text(html)
        src.unlink()
        written.append(dest)
        print(f"promoted {slug}.html -> {slug}/index.html")
    # Homepage stays at docs/index.html, depth 0; still force trailing-slash canonicals
    # on any internal links that need them (assets stay unprefixed).
    home = docs / "index.html"
    home.write_text(rewrite_html(home.read_text(), 0, "/"))
    written.append(home)
    print("rewrote index.html links to trailing-slash form")
    # 404 stays at root (GitHub Pages convention). Relative assets still work
    # for /404.html itself; nested 404s remain an M6 launch gate.
    return written


def year_intro(year: int) -> tuple[str, str, str, str]:
    leap = is_leap(year)
    wd = weekday_name(year, 1, 1)
    days = 366 if leap else 365
    leap_bit = (
        f"{year} was a leap year, with {days} days."
        if leap
        else f"{year} was not a leap year, with {days} days."
    )
    title = f"Age in {year}"
    desc = (
        f"Age on 1 January {year}, a {wd}. {leap_bit} "
        f"Type your date of birth to see your age on that day, or pick another date in {year}."
    )
    h1 = f"Age in {year}"
    lede = (
        f"1 January {year} was a {wd}. {leap_bit} "
        f"The date below is filled in as 1 January {year}. Type your date of birth to see your exact age on that day, "
        f"or change the date to any other day in {year}."
    )
    return title, desc, h1, lede


def _replace_head_text(html: str, title: str, desc: str, h1: str, lede: str, *, jsonld: bool = True) -> str:
    html = re.sub(r"<title>[^<]*</title>", f"<title>{title}</title>", html, count=1)
    html = re.sub(
        r'<meta property="og:title" content="[^"]*">',
        f'<meta property="og:title" content="{title}">',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta name="description" content="[^"]*">',
        f'<meta name="description" content="{desc}">',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta property="og:description" content="[^"]*">',
        f'<meta property="og:description" content="{desc}">',
        html,
        count=1,
    )
    # intro h1 + lede (UX may have wrapped these)
    html, n = re.subn(
        r"(<div class=\"intro\">\s*<h1>)(.*?)(</h1>\s*<p(?: class=\"lede\")?>)(.*?)(</p>)",
        lambda m: m.group(1) + h1 + m.group(3) + lede + m.group(5),
        html,
        count=1,
        flags=re.S,
    )
    if n == 0:
        html, n = re.subn(
            r"(<h1>)(.*?)(</h1>\s*<p(?: class=\"lede\")?>)(.*?)(</p>)",
            lambda m: m.group(1) + h1 + m.group(3) + lede + m.group(5),
            html,
            count=1,
            flags=re.S,
        )
    if jsonld:
        html = re.sub(r'("name":\s*")[^"]*(")', lambda m: m.group(1) + title + m.group(2), html, count=1)
        once = {"n": 0}

        def repl_desc(m):
            once["n"] += 1
            return (m.group(1) + desc + m.group(2)) if once["n"] == 1 else m.group(0)

        html = re.sub(r'("description":\s*")[^"]*(")', repl_desc, html, count=1)
    return html



def _year_unique_body(html: str, year: int) -> str:
    """Drop the cloned /past/ essays and FAQ, leaving the unique intro, the tool,
    and a short note that points back to the hub. Flagged for SEO Manager: these
    pages still share a template and a tool; they are not 65 hand-written articles.
    """
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    for sel in ("details.topic", "section.faq"):
        for el in soup.select(sel):
            el.decompose()
    # Visible FAQ is gone; drop the cloned FAQPage JSON-LD too (it still asks
    # "How old was I in 1990?" on every year page otherwise).
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        if script.string and "FAQPage" in script.string:
            script.decompose()
    content = soup.select_one(".content")
    if content and not soup.select_one(".year-note-more"):
        leap = is_leap(year)
        wd = weekday_name(year, 1, 1)
        note = soup.new_tag("p")
        note["class"] = ["year-note-more"]
        note.append(
            f"This page is for {year}: 1 January was a {wd}"
            + (", and it was a leap year. " if leap else ". ")
        )
        link = soup.new_tag("a", href="../")
        link.string = "How old was I on a certain date?"
        note.append("For any other date, including other years, use the main tool, ")
        note.append(link)
        note.append(".")
        content.append(note)
    return str(soup)


def write_year_pages(docs: Path = DOCS) -> list[Path]:
    src = docs / "past" / "index.html"
    if not src.is_file():
        raise SystemExit("past/index.html missing; promote flat pages first")
    base = src.read_text()
    written = []
    for year in range(YEAR_MIN, YEAR_MAX + 1):
        title, desc, h1, lede = year_intro(year)
        # Depth 2 for assets and internal links. Canonical, og:url and JSON-LD
        # url all point at the /past/ hub (SEO Manager, 16 Nov 2026).
        html = rewrite_html(base, 2, "/past/")
        html = _replace_head_text(html, title, desc, h1, lede, jsonld=False)
        # Mark the year so app.js can prefill even if the path is rewritten.
        html = html.replace("<html", f'<html data-past-year="{year}"', 1)
        # Prefill class, matching the hub's ?year= behaviour.
        if "prefill-year" not in html:
            html = html.replace("<html", '<html class="prefill prefill-year prefill-on"', 1)
        else:
            # ensure classes present
            html = re.sub(
                r'<html([^>]*)>',
                lambda m: m.group(0) if "prefill-year" in m.group(1) else m.group(0).replace("<html", '<html class="prefill prefill-year prefill-on"', 1)
                if "class=" not in m.group(1)
                else re.sub(r'class="([^"]*)"', r'class="\1 prefill prefill-year prefill-on"', m.group(0), count=1),
                html,
                count=1,
            )
        html = _year_unique_body(html, year)
        dest_dir = docs / "past" / str(year)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "index.html"
        dest.write_text(html)
        written.append(dest)
    print(f"wrote {len(written)} year pages /past/{YEAR_MIN}/ … /past/{YEAR_MAX}/")
    return written


def stub_html(dest_path: str, depth: int) -> str:
    target = prod_url(dest_path)
    href = rel_href(dest_path.lstrip("/") if dest_path not in ("/", "") else "/", depth)
    if dest_path in ("/", ""):
        href = rel_href("/", depth)
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en-GB">\n'
        "<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="p:domain_verify" content="734c20818ac93122c641880abc78b9aa"/>\n'
        f"<title>This page has moved</title>\n"
        f'<link rel="canonical" href="{target}">\n'
        f'<meta property="og:url" content="{target}">\n'
        f'<meta http-equiv="refresh" content="0;url={href}">\n'
        f'<link rel="icon" href="{rel_href("favicon.ico", depth)}" sizes="32x32">\n'
        f'<link rel="icon" href="{rel_href("favicon.svg", depth)}" type="image/svg+xml">\n'
        "</head>\n"
        "<body>\n"
        f'<p>This page has moved to <a href="{href}">{target}</a>.</p>\n'
        "<p>This is a fallback (a meta refresh and a canonical link), not a 301 redirect. "
        "GitHub Pages cannot send a per-path 301 for this URL.</p>\n"
        "</body>\n"
        "</html>\n"
    )


def write_stubs(docs: Path = DOCS) -> list[Path]:
    written = []
    for rel, dest in STUBS:
        path = docs / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        depth = depth_of(Path(rel))
        path.write_text(stub_html(dest, depth))
        written.append(path)
        print(f"stub {rel} -> {dest}")
    return written


SITEMAP_PAGES = [
    "/",
    "/difference/",
    "/past/",
    "/days-between-dates/",
    "/chronological-age/",
    "/dog-age/",
    "/cat-age/",
    "/korean-age/",
    "/birthday-countdown/",
    "/how-old-will-i-be/",
    "/what-year-was-i-born/",
    "/privacy/",
    "/contact/",
]


def write_sitemap(docs: Path = DOCS, lastmod: str = "2026-11-16") -> None:
    # Year URLs are omitted (SEO Manager, 16 Nov 2026): keep the pages, canonical
    # to /past/, and do not noindex them at launch. The preview still carries the
    # site-wide noindex until the launch commit.
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path in SITEMAP_PAGES:
        lines.append(f"  <url><loc>{prod_url(path)}</loc><lastmod>{lastmod}</lastmod></url>")
    lines.append("</urlset>\n")
    (docs / "sitemap.xml").write_text("\n".join(lines))
    print(f"wrote sitemap.xml ({len(SITEMAP_PAGES)} URLs, trailing slashes, no year pages)")


def finish_promoted(docs: Path = DOCS) -> None:
    """Check canonical == og:url on real pages (not 404). Stubs canonical to the destination."""
    issues = []
    can_re = re.compile(r"<link[^>]*rel=.canonical.[^>]*>")
    og_re = re.compile(r"<meta[^>]*property=.og:url.[^>]*>")
    href_re = re.compile(r'href="([^"]+)"')
    content_re = re.compile(r'content="([^"]+)"')
    for pth in sorted(docs.rglob("*.html")):
        text = pth.read_text()
        rel = pth.relative_to(docs)
        is_404 = rel.as_posix() == "404.html"
        can_m = can_re.search(text)
        og_m = og_re.search(text)
        can = href_re.search(can_m.group(0)).group(1) if can_m and href_re.search(can_m.group(0)) else None
        og = content_re.search(og_m.group(0)).group(1) if og_m and content_re.search(og_m.group(0)) else None
        if is_404:
            if can or og:
                issues.append("404.html should not have a canonical or og:url")
            continue
        if not can or not og:
            issues.append(f"{rel} missing canonical or og:url")
        elif can != og:
            issues.append(f"{rel} og:url {og} != canonical {can}")
        elif not can.startswith(CANON):
            issues.append(f"{rel} canonical is not the production host: {can}")
        elif can != CANON + "/" and not can.endswith("/") and not Path(can).suffix:
            issues.append(f"{rel} canonical is missing a trailing slash: {can}")
        # Year pages must canonicalise to the hub, not to /past/{year}/.
        parts = rel.parts
        if len(parts) == 3 and parts[0] == "past" and parts[1].isdigit() and parts[2] == "index.html":
            if can != CANON + "/past/":
                issues.append(f"{rel} year page canonical should be {CANON}/past/, got {can}")
        # Legacy stubs: canonical to the target, meta refresh 0, no noindex.
        if rel.as_posix() in {s[0] for s in STUBS}:
            if "noindex" in text:
                issues.append(f"{rel} stub must not have noindex")
            if 'http-equiv="refresh"' not in text or 'content="0;url=' not in text:
                issues.append(f"{rel} stub missing content=\"0\" meta refresh")
    if issues:
        raise SystemExit("share/canonical mismatch:\n  " + "\n  ".join(issues))
    print("canonical and og:url match on every page; 404 has neither")


def run(docs: Path = DOCS) -> None:
    promote_flat_pages(docs)
    write_year_pages(docs)
    write_stubs(docs)
    write_sitemap(docs)
    finish_promoted(docs)


if __name__ == "__main__":
    run()
