#!/usr/bin/env python3
"""Patch /past/YYYY/ pages and sitemap.xml for the self-canonical year-page spec.

Re-runnable. Safe to apply to a live-site root or to preview docs/.

Without a fact-checked CSV this script:
  - sets canonical, og:url and JSON-LD url to https://agecalculator.com/past/YYYY/
  - sets og:title and JSON-LD name to the existing <title> (Age in YYYY)
    so they no longer advertise the hub
  - leaves <title>, meta description, og:description and JSON-LD description
    as they are (do not invent copy)
  - leaves the H1 as "Age in YYYY"
  - removes noindex/nofollow from the 67 year pages (and does not touch the hub)
  - adds the 67 year URLs to sitemap.xml with --year-lastmod, keeping the
    existing 13 locs and their lastmod values

CSV application (Copywriter + Fact Checker) is a second, optional step:

    python3 scripts/apply_past_year_meta.py --root docs \\
        --csv /workspace/marketing/seo/agecalculator/copy/past-year-meta.csv

Titles and metas are applied only when:
  - the CSV exists, has one row per year 1960-2026, and every title and
    meta_description is present, unique, free of em/en dashes, and titles
    are not question-style, AND
  - Fact Checker has passed it, shown by one of:
      * --fact-checked
      * a sidecar next to the CSV named past-year-meta.fact-checked,
        past-year-meta.approved or past-year-meta.ok

A "hub" row applies title and meta to /past/. The H1 is set to
"Your age on a past date" (addendum 24 Nov). Year-page closing links to
the hub use that same phrase in place of "How old was I on a certain date?".
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

YEAR_MIN, YEAR_MAX = 1960, 2026
YEARS = list(range(YEAR_MIN, YEAR_MAX + 1))
CANON = "https://agecalculator.com"
DEFAULT_CSV = Path("/workspace/marketing/seo/agecalculator/copy/past-year-meta.csv")
FACT_CHECK_SIDECARS = (
    "past-year-meta.fact-checked",
    "past-year-meta.approved",
    "past-year-meta.ok",
)
HUB_H1 = "Your age on a past date"
OLD_HUB_LINK = "How old was I on a certain date?"
# Also accept a Fact Checker report in the neighbouring factcheck/ folder.
FACT_CHECK_REPORTS = (
    Path("/workspace/marketing/seo/agecalculator/factcheck/past-year-meta-factcheck.md"),
)
DASHES = ("\u2014", "\u2013")  # em dash, en dash
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
# Lastmods as on the live sitemap at 2c9e511 (24 Nov 2026). Used when a loc
# is missing from the file being patched.
DEFAULT_LASTMODS = {
    "/": "2026-11-16",
    "/difference/": "2026-11-16",
    "/past/": "2026-11-16",
    "/days-between-dates/": "2026-11-16",
    "/chronological-age/": "2026-11-16",
    "/dog-age/": "2026-11-16",
    "/cat-age/": "2026-11-16",
    "/korean-age/": "2026-11-16",
    "/birthday-countdown/": "2026-11-16",
    "/how-old-will-i-be/": "2026-11-16",
    "/what-year-was-i-born/": "2026-11-16",
    "/privacy/": "2026-11-19",
    "/contact/": "2026-11-16",
}

_TITLE_RE = re.compile(r"<title>([^<]*)</title>", re.I)
_H1_RE = re.compile(r"<h1[^>]*>([^<]*)</h1>", re.I)
_JSON_BLOCK_RE = re.compile(
    r'(<script type="application/ld\+json">)(.*?)(</script>)',
    re.I | re.S,
)
_NOINDEX_RE = re.compile(
    r'\n?<meta[^>]*name=["\']robots["\'][^>]*>\n?',
    re.I,
)
# Attribute-order-agnostic meta/link tag matchers.
def _tag_with_attr(tag: str, attr: str, value: str) -> re.Pattern[str]:
    return re.compile(
        rf"<{tag}\b(?=[^>]*\b{attr}\s*=\s*[\"']{re.escape(value)}[\"'])[^>]*>",
        re.I,
    )


def year_url(year: int) -> str:
    return f"{CANON}/past/{year}/"


def set_attr(tag: str, name: str, value: str) -> str:
    if re.search(rf"""\b{name}\s*=""", tag, re.I):
        return re.sub(
            rf"""(\b{name}\s*=\s*)(["'])([^"']*)\2""",
            lambda m: f"{m.group(1)}{m.group(2)}{value}{m.group(2)}",
            tag,
            count=1,
            flags=re.I,
        )
    if tag.endswith("/>"):
        return tag[:-2] + f' {name}="{value}"/>'
    if tag.endswith(">"):
        return tag[:-1] + f' {name}="{value}">'
    return tag


def set_canonical(html: str, url: str) -> str:
    pat = _tag_with_attr("link", "rel", "canonical")
    if pat.search(html):
        return pat.sub(lambda m: set_attr(m.group(0), "href", url), html, count=1)
    # Insert before </head> if missing.
    return re.sub(
        r"</head>",
        f'<link href="{url}" rel="canonical"/>\n</head>',
        html,
        count=1,
        flags=re.I,
    )


def set_meta_property(html: str, prop: str, value: str) -> str:
    pat = _tag_with_attr("meta", "property", prop)
    if pat.search(html):
        return pat.sub(lambda m: set_attr(m.group(0), "content", value), html, count=1)
    return re.sub(
        r"</head>",
        f'<meta content="{value}" property="{prop}"/>\n</head>',
        html,
        count=1,
        flags=re.I,
    )


def set_meta_name(html: str, name: str, value: str) -> str:
    pat = _tag_with_attr("meta", "name", name)
    if pat.search(html):
        return pat.sub(lambda m: set_attr(m.group(0), "content", value), html, count=1)
    return re.sub(
        r"</head>",
        f'<meta content="{value}" name="{name}"/>\n</head>',
        html,
        count=1,
        flags=re.I,
    )


def set_jsonld_field(html: str, field: str, value: str) -> str:
    """Replace the first JSON-LD "field" string (the WebApplication block)."""

    def repl_block(m: re.Match[str]) -> str:
        block = m.group(2)
        # Skip FAQPage leftovers if any remain.
        if "FAQPage" in block and "WebApplication" not in block:
            return m.group(0)
        new_block, n = re.subn(
            rf'("{field}"\s*:\s*")([^"]*)(")',
            lambda mm: mm.group(1) + value + mm.group(3),
            block,
            count=1,
        )
        if n == 0:
            return m.group(0)
        return m.group(1) + new_block + m.group(3)

    return _JSON_BLOCK_RE.sub(repl_block, html, count=1)


def strip_year_robots(html: str) -> str:
    return _NOINDEX_RE.sub("\n", html)


def read_title(html: str) -> str | None:
    m = _TITLE_RE.search(html)
    return m.group(1) if m else None


def read_h1(html: str) -> str | None:
    m = _H1_RE.search(html)
    return m.group(1) if m else None


def has_noindex(html: str) -> bool:
    return re.search(r"noindex", html, re.I) is not None


def patch_year_page(html: str, year: int, csv_row: dict[str, str] | None) -> str:
    want = year_url(year)
    html = set_canonical(html, want)
    html = set_meta_property(html, "og:url", want)
    html = set_jsonld_field(html, "url", want)
    html = strip_year_robots(html)

    if csv_row:
        title = csv_row["title"]
        desc = csv_row["meta_description"]
        html = _TITLE_RE.sub(f"<title>{title}</title>", html, count=1)
        html = set_meta_name(html, "description", desc)
        html = set_meta_property(html, "og:title", title)
        html = set_meta_property(html, "og:description", desc)
        html = set_jsonld_field(html, "name", title)
        html = set_jsonld_field(html, "description", desc)
    else:
        title = read_title(html) or f"Age in {year}"
        html = set_meta_property(html, "og:title", title)
        html = set_jsonld_field(html, "name", title)
    html = replace_hub_link_text(html)
    return html


def replace_hub_link_text(html: str) -> str:
    """Year-page closing link to the hub: new plain-statement wording."""
    return html.replace(f">{OLD_HUB_LINK}</a>", f">{HUB_H1}</a>")


def patch_hub(html: str, row: dict[str, str]) -> str:
    # Addendum: H1 is the plain statement, not the CSV title (which is longer).
    html = _H1_RE.sub(lambda m: m.group(0).replace(m.group(1), HUB_H1, 1), html, count=1)
    title = (row.get("title") or "").strip()
    desc = (row.get("meta_description") or "").strip()
    if title:
        html = _TITLE_RE.sub(f"<title>{title}</title>", html, count=1)
        html = set_meta_property(html, "og:title", title)
        html = set_jsonld_field(html, "name", title)
    if desc:
        html = set_meta_name(html, "description", desc)
        html = set_meta_property(html, "og:description", desc)
        html = set_jsonld_field(html, "description", desc)
    return html


def read_sitemap_lastmods(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    text = path.read_text(encoding="utf-8")
    for m in re.finditer(
        r"<url>\s*<loc>([^<]+)</loc>\s*(?:<lastmod>([^<]*)</lastmod>)?",
        text,
    ):
        loc, lastmod = m.group(1), m.group(2)
        path_part = loc[len(CANON) :] if loc.startswith(CANON) else loc
        if not path_part.startswith("/"):
            path_part = "/" + path_part
        if lastmod:
            out[path_part] = lastmod
    return out


def write_sitemap(root: Path, year_lastmod: str) -> None:
    path = root / "sitemap.xml"
    existing = read_sitemap_lastmods(path)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for page in SITEMAP_PAGES:
        lastmod = existing.get(page) or DEFAULT_LASTMODS.get(page) or year_lastmod
        lines.append(f"  <url><loc>{CANON}{page if page != '/' else '/'}</loc><lastmod>{lastmod}</lastmod></url>")
    for year in YEARS:
        loc = f"/past/{year}/"
        lastmod = year_lastmod
        # If we re-run after go-live with a new --year-lastmod, always use the
        # argument for year rows (they belong to this change).
        lines.append(f"  <url><loc>{CANON}{loc}</loc><lastmod>{lastmod}</lastmod></url>")
    lines.append("</urlset>\n")
    path.write_text("\n".join(lines), encoding="utf-8")


def contains_dash(text: str) -> bool:
    return any(d in text for d in DASHES)


def question_style(title: str) -> bool:
    """A question title is one that contains a question mark (addendum 24 Nov).

    Statement titles that begin "How old you were…" without a "?" are allowed;
    those are in the fact-checked CSV.
    """
    return "?" in title


def load_csv(path: Path) -> tuple[dict[int, dict[str, str]], dict[str, str] | None, list[str]]:
    issues: list[str] = []
    if not path.is_file():
        return {}, None, [f"CSV not found: {path}"]
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        if not reader.fieldnames:
            return {}, None, ["CSV has no header"]
        fields = [f.strip() for f in reader.fieldnames]
        lower = {f.lower(): f for f in fields}
        for needed in ("year", "title", "meta_description"):
            if needed not in lower:
                issues.append(f"CSV missing column {needed!r} (got {fields})")
        if issues:
            return {}, None, issues
        ycol, tcol, dcol = lower["year"], lower["title"], lower["meta_description"]
        hcol = lower.get("h1")
        rows: dict[int, dict[str, str]] = {}
        hub: dict[str, str] | None = None
        titles: list[str] = []
        descs: list[str] = []
        for i, raw in enumerate(reader, start=2):
            year_raw = (raw.get(ycol) or "").strip()
            title = (raw.get(tcol) or "").strip()
            desc = (raw.get(dcol) or "").strip()
            h1 = (raw.get(hcol) or "").strip() if hcol else ""
            if year_raw.lower() == "hub":
                hub = {"title": title, "meta_description": desc, "h1": h1 or title}
                continue
            try:
                year = int(year_raw)
            except ValueError:
                issues.append(f"line {i}: bad year {year_raw!r}")
                continue
            if year < YEAR_MIN or year > YEAR_MAX:
                issues.append(f"line {i}: year {year} is outside {YEAR_MIN}-{YEAR_MAX}")
                continue
            if year in rows:
                issues.append(f"line {i}: duplicate year {year}")
                continue
            if not title or not desc:
                issues.append(f"line {i}: empty title or meta_description for {year}")
                continue
            for label, val in (("title", title), ("meta_description", desc), ("h1", h1)):
                if val and contains_dash(val):
                    issues.append(f"line {i}: {label} contains an em or en dash")
            if question_style(title):
                issues.append(f"line {i}: question-style title {title!r}")
            if h1 and question_style(h1):
                issues.append(f"line {i}: question-style h1 {h1!r}")
            rows[year] = {"title": title, "meta_description": desc, "h1": h1}
            titles.append(title)
            descs.append(desc)
    missing = [y for y in YEARS if y not in rows]
    if missing:
        issues.append(f"CSV missing years: {missing[0]}…{missing[-1]} ({len(missing)} years)")
    if len(titles) != len(set(titles)):
        issues.append("CSV titles are not unique")
    if len(descs) != len(set(descs)):
        issues.append("CSV meta_descriptions are not unique")
    return rows, hub, issues


def fact_checked(csv_path: Path, flagged: bool) -> bool:
    if flagged:
        return True
    parent = csv_path.parent
    return any((parent / name).is_file() for name in FACT_CHECK_SIDECARS)


def verify_root(root: Path) -> list[str]:
    issues: list[str] = []
    for year in YEARS:
        p = root / "past" / str(year) / "index.html"
        if not p.is_file():
            issues.append(f"missing {p}")
            continue
        html = p.read_text(encoding="utf-8")
        want = year_url(year)
        can = re.search(
            r"""<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>""",
            html,
            re.I,
        )
        href = None
        if can:
            hm = re.search(r"""href=["']([^"']+)["']""", can.group(0), re.I)
            href = hm.group(1) if hm else None
        if href != want:
            issues.append(f"{year} canonical {href!r} != {want}")
        h1 = read_h1(html)
        if h1 != f"Age in {year}":
            issues.append(f"{year} H1 {h1!r}")
        if has_noindex(html):
            issues.append(f"{year} still has noindex")
        if f'"url": "{want}"' not in html and f'"url":"{want}"' not in html:
            # allow flexible spacing
            if not re.search(rf'"url"\s*:\s*"{re.escape(want)}"', html):
                issues.append(f"{year} JSON-LD url is not self")
        if not re.search(
            rf"""property=["']og:url["'][^>]*content=["']{re.escape(want)}["']|content=["']{re.escape(want)}["'][^>]*property=["']og:url["']""",
            html,
        ):
            issues.append(f"{year} og:url is not self")
    sm = (root / "sitemap.xml").read_text(encoding="utf-8")
    locs = re.findall(r"<loc>([^<]+)</loc>", sm)
    if len(locs) != 13 + len(YEARS):
        issues.append(f"sitemap has {len(locs)} locs, expected {13 + len(YEARS)}")
    for year in (YEAR_MIN, YEAR_MAX, 2010):
        if f"{CANON}/past/{year}/" not in sm:
            issues.append(f"sitemap missing {year}")
    if f"{CANON}/past/" not in sm:
        issues.append("sitemap missing hub /past/")
    year_locs = [loc for loc in locs if re.fullmatch(rf"{re.escape(CANON)}/past/\d{{4}}/", loc)]
    if len(year_locs) != len(YEARS):
        issues.append(f"sitemap year locs {len(year_locs)} != {len(YEARS)}")
    # each year loc should have a lastmod
    for year in YEARS:
        if not re.search(
            rf"<loc>{re.escape(CANON)}/past/{year}/</loc>\s*<lastmod>[^<]+</lastmod>",
            sm,
        ):
            issues.append(f"sitemap {year} missing lastmod")
    extra = [y for y in range(1900, 2035) if y not in YEARS and (root / "past" / str(y) / "index.html").is_file()]
    if extra:
        issues.append(f"unexpected year pages: {extra}")

    # Addendum: no "?" in title, H1, og:title, JSON-LD name, or hub link text
    # on /past/ and every year page. Nav labels are out of scope.
    def og_title(html: str) -> str | None:
        pat = _tag_with_attr("meta", "property", "og:title")
        m = pat.search(html)
        if not m:
            return None
        c = re.search(r"""content\s*=\s*(["'])(.*?)\1""", m.group(0), re.I | re.S)
        return c.group(2) if c else None

    def jsonld_name(html: str) -> str | None:
        m = re.search(r'"name"\s*:\s*"([^"]*)"', html)
        return m.group(1) if m else None

    pages = [(root / "past" / "index.html", "hub")] + [
        (root / "past" / str(y) / "index.html", str(y)) for y in YEARS
    ]
    for path, label in pages:
        if not path.is_file():
            continue
        html = path.read_text(encoding="utf-8")
        fields = {
            "title": read_title(html),
            "h1": read_h1(html),
            "og:title": og_title(html),
            "jsonld name": jsonld_name(html),
        }
        for name, val in fields.items():
            if val and "?" in val:
                issues.append(f"{label} {name} contains '?': {val!r}")
        if label == "hub":
            if fields["h1"] != HUB_H1:
                issues.append(f"hub H1 {fields['h1']!r} != {HUB_H1!r}")
        else:
            if OLD_HUB_LINK in html:
                issues.append(f"{label} still has old hub link text")
            if f">{HUB_H1}</a>" not in html:
                issues.append(f"{label} missing new hub link text")
    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, required=True, help="Site root (live clone or preview docs/)")
    parser.add_argument("--csv", type=Path, default=None, help="past-year-meta.csv (optional)")
    parser.add_argument(
        "--fact-checked",
        action="store_true",
        help="Confirm Fact Checker has passed the CSV (or place a sidecar file)",
    )
    parser.add_argument(
        "--year-lastmod",
        default="2026-11-24",
        help="lastmod for the 67 year URLs (go-live date). Default: 2026-11-24",
    )
    parser.add_argument(
        "--skip-csv",
        action="store_true",
        help="Do not apply titles/metas even if a CSV is present",
    )
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if not (root / "past").is_dir():
        print(f"error: {root} has no past/ directory", file=sys.stderr)
        return 2

    csv_path = args.csv or (DEFAULT_CSV if DEFAULT_CSV.is_file() else None)
    csv_rows: dict[int, dict[str, str]] = {}
    hub_row: dict[str, str] | None = None
    csv_applied = False
    csv_status = "not applied (no CSV)"

    if args.skip_csv:
        csv_status = "not applied (--skip-csv)"
    elif csv_path is not None:
        csv_rows, hub_row, issues = load_csv(csv_path)
        if issues:
            csv_status = "not applied (CSV failed checks): " + "; ".join(issues)
            print("CSV not applied:", file=sys.stderr)
            for item in issues:
                print(f"  - {item}", file=sys.stderr)
            csv_rows, hub_row = {}, None
        elif not fact_checked(csv_path, args.fact_checked):
            csv_status = (
                f"not applied (CSV present at {csv_path}, but no Fact Checker "
                "pass marker; titles and metas left unchanged)"
            )
            print(csv_status, file=sys.stderr)
            csv_rows, hub_row = {}, None
        else:
            csv_applied = True
            csv_status = f"applied from {csv_path}"

    changed = 0
    for year in YEARS:
        p = root / "past" / str(year) / "index.html"
        if not p.is_file():
            print(f"error: missing {p}", file=sys.stderr)
            return 2
        before = p.read_text(encoding="utf-8")
        after = patch_year_page(before, year, csv_rows.get(year) if csv_applied else None)
        if after != before:
            p.write_text(after, encoding="utf-8")
            changed += 1

    if csv_applied and hub_row:
        hub = root / "past" / "index.html"
        before = hub.read_text(encoding="utf-8")
        after = patch_hub(before, hub_row)
        if after != before:
            hub.write_text(after, encoding="utf-8")
            changed += 1
            csv_status += " (including hub row)"

    write_sitemap(root, args.year_lastmod)

    issues = verify_root(root)
    print(f"patched {changed} year pages under {root}")
    print(f"sitemap year lastmod: {args.year_lastmod}")
    print(f"CSV: {csv_status}")
    if issues:
        print("VERIFY FAIL:")
        for item in issues:
            print(f"  - {item}")
        return 1
    print("VERIFY ok: 67 self-canonical year pages, no noindex, sitemap 80 locs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
