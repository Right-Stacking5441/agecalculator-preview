#!/usr/bin/env python3
"""Rebuild page copy from the approved markdown files. Text/structure only.

Runs from the repo alone, plus the approved copy snapshot at copy-approved/.
No /tmp inputs, no outside Python environment, and no server on port 8777.
"""
from __future__ import annotations
import html as htmllib
import json
import os
import re
import sys
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
COPY = ROOT / "copy-approved"
LAUNCH = os.environ.get("LAUNCH") == "1"
DOCS = Path(os.environ["AGECALC_DOCS"]).resolve() if os.environ.get("AGECALC_DOCS") else ROOT / "docs"
PREVIEW_PREFIX = "/agecalculator-preview"
FRAG = Path(__file__).resolve().parent / "fragments"
DIAGRAM = (FRAG / "home-diagram.html").read_text()
SHEET_INNER = (FRAG / "class-sheet-inner.html").read_text()
YEARS = (FRAG / "birth-years.html").read_text()

PAGE = {
    "home.md": "index.html",
    "past.md": "past.html",
    "difference.md": "difference.html",
    "days-between-dates.md": "days-between-dates.html",
    "chronological-age.md": "chronological-age.html",
    "birthday-countdown.md": "birthday-countdown.html",
    "how-old-will-i-be.md": "how-old-will-i-be.html",
    "korean-age.md": "korean-age.html",
    "what-year-was-i-born.md": "what-year-was-i-born.html",
    "dog-age.md": "dog-age.html",
    "cat-age.md": "cat-age.html",
    "privacy.md": "privacy.html",
    "contact.md": "contact.html",
    "embed.md": "embed.html",
}

APOSTROPHE = {
    "I'm": "I’m", "I've": "I’ve", "I'd": "I’d", "I'll": "I’ll",
    "you're": "you’re", "you've": "you’ve", "you'd": "you’d", "you'll": "you’ll",
    "we're": "we’re", "we've": "we’ve", "we'd": "we’d", "we'll": "we’ll",
    "they're": "they’re", "they've": "they’ve", "they'd": "they’d", "they'll": "they’ll",
    "it's": "it’s", "it'll": "it’ll", "it'd": "it’d",
    "that's": "that’s", "that'll": "that’ll", "there'd": "there’d",
    "what's": "what’s", "where's": "where’s", "who's": "who’s", "here's": "here’s",
    "there's": "there’s", "he's": "he’s", "she's": "she’s", "let's": "let’s",
    "don't": "don’t", "doesn't": "doesn’t", "didn't": "didn’t",
    "can't": "can’t", "couldn't": "couldn’t", "shouldn't": "shouldn’t",
    "wouldn't": "wouldn’t", "won't": "won’t", "isn't": "isn’t",
    "aren't": "aren’t", "wasn't": "wasn’t", "weren't": "weren’t",
    "hasn't": "hasn’t", "haven't": "haven’t", "hadn't": "hadn’t",
    "today's": "today’s", "visitor's": "visitor’s", "dog's": "dog’s",
    "cat's": "cat’s", "child's": "child’s", "browser's": "browser’s",
    "site's": "site’s", "owner's": "owner’s", "operator's": "operator’s",
    "year's": "year’s", "people's": "people’s", "manual's": "manual’s",
    "chart's": "chart’s", "visitor's": "visitor’s",
}

def typograph(s: str, *, in_placeholder=False) -> str:
    # Protect placeholders and inline code / URLs from quote flipping
    holders = []
    def stash(m):
        holders.append(m.group(0))
        return f"\x00H{len(holders)-1}\x00"
    s = re.sub(r"\[PLACEHOLDER:[^\]]*\]", stash, s)
    s = re.sub(r"`[^`]+`", stash, s)
    # William: no en or em dashes in any HTML.
    s = s.replace("\u2013", "-").replace("\u2014", "-").replace("–", "-").replace("—", "-")
    def keep_case(a, b):
        def repl(m):
            src = m.group(0)
            out = []
            for i, ch in enumerate(b):
                if i < len(src) and src[i].isupper() and ch.isalpha():
                    out.append(ch.upper())
                elif i < len(src) and src[i].islower() and ch.isalpha():
                    out.append(ch.lower())
                else:
                    out.append(ch)
            # if the original started with a capital, keep it
            if src[0].isupper() and out:
                out[0] = out[0].upper()
            return "".join(out)
        return re.sub(re.escape(a), repl, s, flags=re.I)
    for a, b in APOSTROPHE.items():
        s = keep_case(a, b)
    s = re.sub(r"(?<=\w)'(?=\w)", "’", s)
    s = re.sub(r"(?<=s)'(?!\w)", "’", s)  # owners'
    # double quotes
    out, even, i = [], True, 0
    while i < len(s):
        if s[i] == '"':
            out.append("“" if even else "”")
            even = not even
        else:
            out.append(s[i])
        i += 1
    s = "".join(out)
    for i, h in enumerate(holders):
        s = s.replace(f"\x00H{i}\x00", h)
    return s

def split_md_link(s: str, start: int = 0):
    """Return (link_start, text, url, end) for the first markdown link at or after start, or None."""
    i = start
    while i < len(s):
        if s[i] == "[":
            close = s.find("](", i)
            if close != -1 and "\n" not in s[i:close]:
                j, depth = close + 2, 1
                while j < len(s) and depth:
                    if s[j] == "(":
                        depth += 1
                    elif s[j] == ")":
                        depth -= 1
                    j += 1
                if depth == 0:
                    return i, s[i + 1:close], s[close + 2:j - 1], j
        i += 1
    return None

def apply_md_links(s: str, fn):
    out, last, i = [], 0, 0
    while True:
        found = split_md_link(s, i)
        if not found:
            break
        a, text, url, b = found
        out.append(s[last:a])
        out.append(fn(text, url))
        last = i = b
    out.append(s[last:])
    return "".join(out)

def href_for(url: str) -> str:
    url = url.strip()
    if url in ("/", "https://agecalculator.com/", "https://agecalculator.com"):
        return "./"
    if url.startswith("https://agecalculator.com/#"):
        return "./" + url[len("https://agecalculator.com/"):]
    m = re.match(r"^https://agecalculator\.com/(.+)$", url)
    if m:
        return m.group(1).rstrip("/")
    if url.startswith("/#"):
        return "./" + url[1:]
    if url.startswith("/") and not url.startswith("//"):
        return url[1:].rstrip("/") or "./"
    return url

def abs_prod_url(url: str) -> str:
    """Absolute production URL for FAQPage JSON-LD (and similar)."""
    url = (url or "").strip()
    if url.startswith("https://") or url.startswith("http://"):
        return url
    if url.startswith("/#"):
        return "https://agecalculator.com" + url
    if url.startswith("#"):
        return "https://agecalculator.com/" + url
    if url.startswith("/"):
        path = url
    else:
        path = "/" + url
    if "?" in path:
        path, q = path.split("?", 1)
        q = "?" + q
    else:
        q = ""
    frag = ""
    if "#" in path:
        path, frag = path.split("#", 1)
        frag = "#" + frag
    if path != "/" and not path.endswith("/") and "." not in path.rsplit("/", 1)[-1]:
        path = path + "/"
    return "https://agecalculator.com" + path + q + frag

def inline(s: str) -> str:
    s = typograph(s)
    s = apply_md_links(s, lambda text, url: f'<a href="{href_for(url)}">{text}</a>')
    def code(m):
        return "<code>" + htmllib.escape(m.group(1)) + "</code>"
    s = re.sub(r"`([^`]+)`", code, s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
    return s

def plain_text(s: str) -> str:
    s = typograph(s)
    s = apply_md_links(s, lambda text, url: text)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = s.replace("**", "")
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", s)
    return s

def plain_text_with_urls(s: str) -> str:
    """Plain text that keeps link URLs, so FAQPage JSON-LD matches the page."""
    s = typograph(s)
    s = apply_md_links(s, lambda text, url: f"{text} ({abs_prod_url(url)})")
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = s.replace("**", "")
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", s)
    return s

def parse_md(text: str):
    meta = {}
    for key, pat in [
        ("title", r"\*\*Title:\*\*\s*(.+)"),
        ("meta", r"\*\*Meta description:\*\*\s*(.+)"),
        ("h1", r"\*\*H1(?:\s*\([^)]*\))?:\*\*\s*(.+)"),
        ("lede", r"\*\*Line under the H1:\*\*\s*(.+)"),
    ]:
        m = re.search(pat, text)
        meta[key] = typograph(m.group(1).strip()) if m else ""
    parts = re.split(r"\n---\s*\n", text)
    if len(parts) >= 3:
        body, faq_chunk = parts[1], parts[2]
    else:
        body, faq_chunk = (parts[-1] if parts else text), ""
    def _split_faq(chunk: str):
        """Split at the FAQ heading: legacy 'Questions people ask' or '… FAQs'."""
        m = re.search(r"^##[^\n]*(?:Questions people ask|\bFAQs)\s*$", chunk, re.M)
        if not m:
            return chunk, ""
        return chunk[:m.start()], chunk[m.end():]
    body, faq_from_body = _split_faq(body)
    _rest, faq_from_chunk = _split_faq(faq_chunk)
    faq_raw = faq_from_chunk or faq_from_body
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r"^## Body\s*\n+", "", body.strip() + "\n")
    faqs = []
    blob = faq_raw.strip() + "\n"
    for m in re.finditer(r"###\s+(.+?)\n(.*?)(?=\n### |\Z)", blob, re.S):
        q = typograph(m.group(1).strip())
        a = " ".join(line.strip() for line in m.group(2).strip().splitlines() if line.strip())
        faqs.append((q, a))
    return meta, body.strip(), faqs

def render_body(md: str, page: str) -> str:
    lines = md.splitlines()
    blocks, i = [], 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        fence = re.match(r"^```(\w+)?\s*$", line)
        if fence:
            lang = fence.group(1) or ""
            i += 1
            code = []
            while i < len(lines) and not re.match(r"^```\s*$", lines[i]):
                code.append(lines[i])
                i += 1
            if i < len(lines):
                i += 1
            blocks.append(("code", "\n".join(code)))
            continue
        if line.startswith("## "):
            blocks.append(("h2", inline(line[3:].strip())))
            i += 1
            continue
        if line.startswith("### "):
            blocks.append(("h3", inline(line[4:].strip())))
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            rows = [r for r in rows if not all(re.match(r"^:?-+:?$", c) for c in r)]
            blocks.append(("table", rows))
            continue
        if re.match(r"^[-*]\s+", line):
            items = []
            while i < len(lines) and re.match(r"^[-*]\s+", lines[i]):
                items.append(inline(re.sub(r"^[-*]\s+", "", lines[i])))
                i += 1
            blocks.append(("ul", items))
            continue
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith("#") and not lines[i].startswith("|") and not re.match(r"^[-*]\s+", lines[i]) and not re.match(r"^```", lines[i]):
            para.append(lines[i])
            i += 1
        blocks.append(("p", inline(" ".join(x.strip() for x in para))))

    html_parts = []
    section_open = False

    def close_section():
        nonlocal section_open
        if section_open:
            html_parts.append("</section>")
            section_open = False

    def open_section(extra=""):
        nonlocal section_open
        close_section()
        html_parts.append(f"<section{extra}>")
        section_open = True

    for kind, data in blocks:
        if kind == "h2":
            extra = ""
            low = re.sub(r"<[^>]+>", "", data).lower()
            if page == "chronological-age.html" and "testing a whole class" in low:
                extra = ' id="class-sheet" class="sheet-section"'
            if page == "index.html" and "born on 29 february" in low:
                extra = ' id="born-on-29-february"'
            if page == "what-year-was-i-born.html" and "age and birth year table" in low:
                extra = ""
                open_section()
                html_parts.append(f'<h2 id="birth-year-heading">{data}</h2>')
                continue
            open_section(extra)
            html_parts.append(f"<h2>{data}</h2>")
            continue
        if kind == "h3":
            if not section_open:
                open_section()
            html_parts.append(f"<h3>{data}</h3>")
            continue
        if kind == "p":
            if not section_open:
                open_section()
            html_parts.append(f"<p>{data}</p>")
            if page == "index.html" and "Plenty of people born on a leap day celebrate on 28 February" in data:
                html_parts.append(DIAGRAM)
            if (
                page == "chronological-age.html"
                and any('id="class-sheet"' in x for x in html_parts)
                and not any("data-sheet" in x for x in html_parts)
                and 'id="class-sheet" class="sheet-section"' in "".join(html_parts[-8:])
            ):
                html_parts.append(SHEET_INNER)
            continue
        if kind == "ul":
            if not section_open:
                open_section()
            html_parts.append("<ul>" + "".join(f"<li>{it}</li>" for it in data) + "</ul>")
            continue
        if kind == "code":
            if not section_open:
                open_section()
            escaped = htmllib.escape(data)
            html_parts.append(f'<pre class="snippet"><code>{escaped}</code></pre>')
            continue
        if kind == "table":
            if not section_open:
                open_section()
            rows = data
            cls = "working" if len(rows[0]) <= 4 and any(h.lower() in ("year", "month", "day") for h in rows[0]) else "chart"
            def cell(c, tag):
                return f"<{tag}>{inline(c)}</{tag}>"
            thead = "<thead><tr>" + "".join(cell(c, "th") for c in rows[0]) + "</tr></thead>"
            tbody = "<tbody>" + "".join("<tr>" + "".join(cell(c, "td") for c in r) + "</tr>" for r in rows[1:]) + "</tbody>"
            html_parts.append(f'<table class="{cls}">{thead}{tbody}</table>')
            continue

    if page == "what-year-was-i-born.html":
        # inject the years table into the open or just-closed table section
        joined = "\n".join(html_parts)
        if "data-years" not in joined:
            # insert before the close of the section that has birth-year-heading
            text = "\n".join(html_parts)
            needle = 'id="birth-year-heading"'
            if needle in text:
                # find that section's closing after we close everything
                pass
            html_parts.append(YEARS)

    close_section()
    html = "\n".join(html_parts)
    # If years table ended up after a later section, move it (handled below in post)
    return html

def faq_html(faqs):
    if not faqs:
        return ""
    parts = ['<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">Questions people ask</h2><dl class="qa-list">']
    for q, a in faqs:
        parts.append(f'<div class="qa"><dt>{q}</dt><dd><p>{inline(a)}</p></dd></div>')
    parts.append("</dl></section>")
    return "".join(parts)

def faq_jsonld(faqs) -> str:
    if not faqs:
        return ""
    ents = []
    for q, a in faqs:
        ents.append({
            "@type": "Question",
            "name": plain_text(q),
            "acceptedAnswer": {"@type": "Answer", "text": plain_text_with_urls(a)},
        })
    obj = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": ents}
    return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=1) + "\n</script>\n"

def update_head(html: str, meta: dict, faqs) -> str:
    title, desc = meta["title"], meta["meta"]
    if title:
        html = re.sub(r"<title>[^<]*</title>", f"<title>{title}</title>", html, count=1)
        html = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{title}">', html, count=1)
    if desc:
        html = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', html, count=1)
        html = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{desc}">', html, count=1)
    if meta.get("h1") and meta.get("lede") is not None:
        def _intro(m):
            return m.group(1) + meta["h1"] + m.group(3) + (meta["lede"] or m.group(4)) + m.group(5)
        html, n = re.subn(
            r'(<div class="intro">\s*<h1>)(.*?)(</h1>\s*<p(?: class="lede")?>)(.*?)(</p>)',
            _intro, html, count=1, flags=re.S,
        )
        if n == 0 and re.search(r'<div class="intro"><h1>', html):
            html = re.sub(
                r'(<div class="intro"><h1>)(.*?)(</h1><p(?: class="lede")?>)(.*?)(</p></div>)',
                lambda m: m.group(1) + meta["h1"] + '</h1><p class="lede">' + (meta["lede"] or m.group(4)) + m.group(5),
                html, count=1, flags=re.S,
            )
    if title:
        html = re.sub(r'("name":\s*")[^"]*(")', lambda m: m.group(1) + title + m.group(2), html, count=1)
    if desc:
        once = {"n": 0}
        def repl_desc(m):
            once["n"] += 1
            return (m.group(1) + desc + m.group(2)) if once["n"] == 1 else m.group(0)
        html = re.sub(r'("description":\s*")[^"]*(")', repl_desc, html, count=1)

    new_faq = faq_jsonld(faqs)
    faq_pat = re.compile(r'<script type="application/ld\+json">\s*\{[^<]*?"@type": "FAQPage".*?</script>\s*', re.S)
    if faq_pat.search(html):
        html = faq_pat.sub(new_faq, html, count=1)
    elif new_faq:
        html = html.replace("</head>", new_faq + "</head>", 1)
    return html

def replace_tool_page_content(html: str, body_html: str, faqs, page: str) -> str:
    start_tag = '<div class="wrap page"><div class="content">'
    start = html.find(start_tag)
    if start < 0:
        raise SystemExit(f"no content in {page}")
    inner_start = start + len(start_tag)
    rest = html[inner_start:]
    m = re.search(r'</div>(?=<aside class="side"|</div>\s*</main>|</div></main>)', rest)
    if not m:
        raise SystemExit(f"cannot find content end in {page}")
    inner_end = inner_start + m.start()
    extra = ""
    if page == "privacy.html":
        # h1 and lede live in the content, not a tool intro
        pass
    new_inner = "\n" + body_html + "\n" + faq_html(faqs) + "\n"
    return html[:inner_start] + new_inner + html[inner_end:]

def build_privacy(html: str, meta: dict, body_html: str) -> str:
    html = update_head(html, meta, [])
    # Ensure noindex
    if "noindex" not in html:
        html = html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex,nofollow">',
            1,
        )
    lede = meta.get("lede") or ""
    head = f'<h1>{meta["h1"]}</h1>\n<p>{lede}</p>\n' if lede else f'<h1>{meta["h1"]}</h1>\n'
    # skip to main
    html = html.replace('href="#tool"', 'href="#main"')
    start_tag = '<div class="wrap page"><div class="content">'
    # privacy currently has content
    if start_tag not in html:
        raise SystemExit("privacy content missing")
    start = html.find(start_tag) + len(start_tag)
    rest = html[start:]
    m = re.search(r'</div></div></main>', rest) or re.search(r'</div>\s*</div>\s*</main>', rest)
    if not m:
        # looser
        m = re.search(r'</div>(?=\s*</div>\s*</main>)', rest)
    if not m:
        raise SystemExit("privacy end not found")
    end = start + m.start()
    html = html[:start] + "\n" + head + body_html + "\n" + html[end:]
    html = re.sub(r'<p class="placeholder-note">.*?</p>\n?', "", html)
    return html

def build_embed(html: str, meta: dict, body_html: str) -> str:
    html = update_head(html, meta, [])
    if "noindex" not in html:
        html = html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex,nofollow">',
            1,
        )
    # Replace embed-copy innards, keep crumbs and keep the preview column
    m = re.search(r'(<div class="embed-copy">)(.*?)(</div>\s*<div class="embed-preview">)', html, re.S)
    if not m:
        raise SystemExit("embed-copy block not found")
    crumbs = '<p class="crumbs"><a href="./">Age calculator</a> <span aria-hidden="true">/</span> Embed</p>\n'
    inner = crumbs + f'<h1>{meta["h1"]}</h1>\n' + body_html + "\n"
    # After each snippet, keep a copy button if a snippet is followed by another h2 or end
    # Re-insert copy buttons after each pre.snippet
    def add_buttons(text: str) -> str:
        parts = text.split('<pre class="snippet">')
        if len(parts) == 1:
            return text
        out = [parts[0]]
        labels = ["Copy the iframe code", "Copy the script code"]
        for i, chunk in enumerate(parts[1:]):
            cls = "btn" if i == 0 else "btn btn-quiet"
            label = labels[i] if i < len(labels) else "Copy the code"
            # insert button after </pre>
            chunk = chunk.replace(
                "</pre>",
                f'</pre>\n<button type="button" class="{cls}" data-copy-snippet="{i}">{label}</button>',
                1,
            )
            out.append('<pre class="snippet">' + chunk)
        return "".join(out)
    inner = add_buttons(inner)
    html = html[:m.start()] + m.group(1) + "\n" + inner + m.group(3) + html[m.end():]
    return html

def fix_birth_year_placement(html: str) -> str:
    if "data-years" not in html or 'id="birth-year-heading"' not in html:
        return html
    # If the years table is not immediately after the table section intro, move it
    # Extract years div
    s = html.find('<div class="years"')
    if s < 0:
        return html
    depth, k = 0, s
    while k < len(html):
        if html.startswith("<div", k):
            depth += 1
            k += 4
            continue
        if html.startswith("</div>", k):
            depth -= 1
            k += 6
            if depth == 0:
                break
            continue
        k += 1
    years = html[s:k]
    html_wo = html[:s] + html[k:]
    # insert after the heading section's last <p> before </section>
    h = html_wo.find('id="birth-year-heading"')
    if h < 0:
        return html
    close = html_wo.find("</section>", h)
    # if years already in this interval, ok
    if s > h and s < close + (s - len(html_wo) + len(html)):
        # messy; just insert before this </section> after removing
        return html_wo[:close] + "\n" + years + "\n" + html_wo[close:]
    return html_wo[:close] + "\n" + years + "\n" + html_wo[close:]

def fix_sheet_labels(html: str) -> str:
    html = html.replace(
        '<label>Test date <input type="text" id="sheet-date" placeholder="e.g. 16 November 2026"></label>',
        '<label>Test date (day/month/year) <input type="text" id="sheet-date" placeholder="e.g. 4/7/2018 or 16 November 2026"></label>',
    )
    # may already be labelled
    if "Test date (day/month/year)" not in html and 'id="sheet-date"' in html:
        html = re.sub(
            r'<label>Test date(?: \(day/month/year\))? <input type="text" id="sheet-date"',
            '<label>Test date (day/month/year) <input type="text" id="sheet-date"',
            html,
            count=1,
        )
    html = html.replace(
        '<th scope="col">Date of birth</th>',
        '<th scope="col">Date of birth (day/month/year)</th>',
    )
    return html

def replace_footer(html: str) -> str:
    return html.replace(
        "The site is paid for by the adverts on it.",
        "Free to use.",
    )

def patch_widget():
    p = DOCS / "widget.html"
    t = p.read_text()
    t = t.replace(
        "<title>Age calculator widget</title>",
        "<title>Age calculator widget</title>",
    )
    # already has title/meta from widget.md
    t = re.sub(r"<title>[^<]*</title>", "<title>Age calculator widget</title>", t, count=1)
    t = re.sub(
        r'<meta name="description" content="[^"]*">',
        '<meta name="description" content="Embeddable age calculator from agecalculator.com.">',
        t, count=1,
    )
    t = re.sub(
        r'<meta property="og:description" content="[^"]*">',
        '<meta property="og:description" content="Embeddable age calculator from agecalculator.com.">',
        t, count=1,
    )
    if "noindex" not in t:
        raise SystemExit("widget lost noindex")
    # empty result helper
    t = t.replace(
        '<p class="rest">Type a date and the result appears here as you go.</p>',
        '<p class="rest">Type a date of birth to see your age in years, months and days.</p>',
    )
    t = t.replace(
        '<noscript><p class="hint">This calculator needs JavaScript to work the result out. The method is written out below the tool if you’d rather do it on paper.</p></noscript>',
        '<noscript><p class="hint">This calculator needs JavaScript to work out the result. You can use it at agecalculator.com.</p></noscript>',
    )
    # credit already correct
    if 'href="https://agecalculator.com/">Age calculator by agecalculator.com' not in t:
        raise SystemExit("widget credit missing")
    t = replace_footer(t)
    p.write_text(t)
    print("patched widget.html")

def patch_app_widget_hint():
    p = DOCS / "app.js"
    t = p.read_text()
    old = "if (needs(b)) return errOf(b, 'date') || emptyToday('Type your date of birth. Your age, next birthday and the same figure in months, weeks and days appear here as you type.');"
    new = """if (needs(b)) return errOf(b, 'date') || emptyToday(document.body.classList.contains('widget')
        ? 'Type a date of birth to see your age in years, months and days.'
        : 'Type your date of birth. Your age, next birthday and the same figure in months, weeks and days appear here as you type.');"""
    if old not in t:
        if "document.body.classList.contains('widget')" in t or "Your age will appear here." in t:
            print("app.js widget hint already present (or UX empty state)")
            return
        raise SystemExit("age empty hint not found")
    p.write_text(t.replace(old, new, 1))
    print("patched app.js widget empty hint")

CHRONO_RULE_LINE = (
    '<p class="rule-line">A completed month lands on the same date next month. '
    "If that date doesn’t exist (31 January to 1 March, or a 29 February birthday in a common year), "
    "it rolls to the 1st of the next month. Some other calculators stop at the last day of the month instead, "
    "so they can be a day out around month ends.</p>"
)

def ensure_chrono_rule_line(html: str) -> str:
    """Keep the month-end rule line under the chronological-age tool only."""
    if 'class="rule-line"' in html:
        return html
    pat = re.compile(
        r'(<p class="sr-only" id="live" aria-live="polite"></p>)'
    )
    html2, n = pat.subn(r"\1\n" + CHRONO_RULE_LINE, html, count=1)
    if n != 1:
        raise SystemExit("could not insert chronological-age rule-line")
    return html2



SHELLS = Path(__file__).resolve().parent / "page_shells"

def clean_promoted():
    """Remove directory pages and stubs from a previous promote, so restore_shells starts clean."""
    from promote_dirs import DIR_PAGES, STUBS, DROPPED_STUBS
    for slug in DIR_PAGES:
        d = DOCS / slug
        if d.is_dir():
            shutil.rmtree(d)
    for rel in [s[0] for s in STUBS] + list(DROPPED_STUBS):
        path = DOCS / rel
        if path.is_file():
            path.unlink()
        # also drop empty stub dirs such as how-old-am-i/
        parent = path.parent
        if parent != DOCS and parent.is_dir() and not any(parent.rglob("*")):
            parent.rmdir()


def restore_shells():
    """Reset HTML to the pre-UX shells so the UX transform is reproducible."""
    if not SHELLS.exists():
        raise SystemExit(f"page shells missing at {SHELLS}")
    for src in sorted(SHELLS.glob("*.html")):
        (DOCS / src.name).write_text(src.read_text())
        print("restored shell", src.name)

def apply_ux_pass():
    ux = Path(__file__).resolve().parent / "ux"
    if str(ux) not in sys.path:
        sys.path.insert(0, str(ux))
    from apply_ux import apply_ux
    from prerender import prerender
    n = apply_ux(DOCS, launch=LAUNCH)
    print(f"applied UX structure to {n} pages")
    prerender(DOCS)
    print("prerendered calculator pages")


def ensure_footer_links(html: str) -> str:
    if re.search(r'href=["\']contact["\']', html):
        return html
    html2, n = re.subn(
        r'(<a href="privacy">Privacy</a>)',
        r'\1 · <a href="contact">Contact</a>',
        html,
        count=1,
    )
    return html2 if n else html


def fix_404_share(html: str) -> str:
    """A 404 is served for any unknown path, so a specific og:url would mis-attribute a share."""
    return re.sub(r'\n?<meta[^>]*property="og:url"[^>]*>\n?', "\n", html, count=1)


def _attr(tag: str, name: str):
    m = re.search(rf'{name}="([^"]+)"', tag or "")
    return m.group(1) if m else None


def _link_canonical(html: str):
    m = re.search(r'<link[^>]*rel="canonical"[^>]*>', html)
    return _attr(m.group(0) if m else "", "href")


def _meta_og_url(html: str):
    m = re.search(r'<meta[^>]*property="og:url"[^>]*>', html)
    return _attr(m.group(0) if m else "", "content")


def finish_pages():
    for pth in sorted(DOCS.glob("*.html")):
        t = pth.read_text()
        if pth.name == "404.html":
            t = fix_404_share(t)
            if 'property="og:url"' in t:
                raise SystemExit("404.html still has og:url")
        t = ensure_footer_links(t)
        pth.write_text(t)
    # Every non-404 page should have matching canonical and og:url.
    issues = []
    for pth in sorted(DOCS.glob("*.html")):
        t = pth.read_text()
        can = _link_canonical(t)
        og = _meta_og_url(t)
        if pth.name == "404.html":
            if can:
                issues.append("404.html should not have a canonical")
            if og:
                issues.append("404.html should not have og:url")
            continue
        if not can or not og:
            issues.append(f"{pth.name} missing canonical or og:url")
        elif can != og:
            issues.append(f"{pth.name} og:url {og} != canonical {can}")
    if issues:
        raise SystemExit("share/canonical mismatch:\n  " + "\n  ".join(issues))
    print("canonical and og:url match on every page; 404 has neither")


DIR_LINK_SLUGS = {
    "difference", "past", "how-old-will-i-be", "days-between-dates",
    "chronological-age", "birthday-countdown", "korean-age",
    "what-year-was-i-born", "dog-age", "cat-age", "embed", "privacy",
    "contact", "widget",
}
ASSET_NAMES = {"favicon.ico", "favicon.svg", "styles.css", "ux.css", "app.js", "dates.js", "sheet.js", "embed.js"}
_404_ATTR = re.compile(r"""\b((?:href|src)\s*=\s*)(["'])([^"']+)\2""", re.I)


def _site_path(url: str) -> str | None:
    """Turn a relative or root-absolute URL into a site path starting with /."""
    url = (url or "").strip()
    if not url or url.startswith(("#", "mailto:", "tel:", "data:", "javascript:", "http://", "https://", "//")):
        return None
    if url.startswith(PREVIEW_PREFIX + "/"):
        url = url[len(PREVIEW_PREFIX):]
    elif url == PREVIEW_PREFIX:
        url = "/"
    raw, frag = (url.split("#", 1) + [""])[:2]
    q = ""
    if "?" in raw:
        raw, q = raw.split("?", 1)
        q = "?" + q
    path = raw
    while path.startswith("../"):
        path = path[3:]
    if path.startswith("./"):
        path = path[2:]
    if path.startswith("/"):
        path = path[1:]
    if path == "" or path == ".":
        out = "/"
    else:
        out = "/" + path
    slug = out.strip("/")
    name = path.split("/")[-1] if path else ""
    if slug in DIR_LINK_SLUGS or (out.endswith("/") and slug):
        if not out.endswith("/"):
            out = out + "/"
    elif name in ASSET_NAMES or path.startswith("fonts/") or path.startswith("past/"):
        pass
    elif out != "/" and not out.endswith("/") and "." not in name:
        out = out + "/"
    suffix = q + (("#" + frag) if frag else "")
    return out + suffix


def finalize_404(docs: Path, launch: bool) -> None:
    """Nested 404s must work with JS off: no <base>, no document.write, absolute root paths."""
    pth = docs / "404.html"
    html = pth.read_text()
    html = re.sub(r"<script>\s*\(function\(\)\s*\{[^<]*document\.write\([^<]*<base[^<]*</script>\s*", "", html, flags=re.I)
    html = re.sub(r"<base\b[^>]*>\s*", "", html, flags=re.I)
    if "document.write" in html or re.search(r"<base\b", html, re.I):
        raise SystemExit("404.html still has document.write or a <base>")
    prefix = "" if launch else PREVIEW_PREFIX

    def repl(m):
        attr, quote, url = m.group(1), m.group(2), m.group(3)
        if url.startswith(("#", "mailto:", "tel:", "data:", "javascript:", "http://", "https://", "//")):
            return m.group(0)
        path = _site_path(url)
        if path is None:
            return m.group(0)
        return f"{attr}{quote}{prefix}{path}{quote}"

    html = _404_ATTR.sub(repl, html)
    if launch:
        html = re.sub(r'\n?<div class="preview-banner">.*?</div>\n?', "\n", html, flags=re.S)
    pth.write_text(html)
    print(f"finalized 404.html ({'launch' if launch else 'preview'} root paths)")


def _insert_robots(html: str, content: str) -> str:
    html = re.sub(r'\n?<meta[^>]*name=["\']robots["\'][^>]*>\n?', "\n", html, flags=re.I)
    if re.search(r'<meta[^>]*name=["\']viewport["\']', html, re.I):
        return re.sub(
            r'(<meta[^>]*name=["\']viewport["\'][^>]*>)',
            r'\1\n<meta name="robots" content="' + content + '">',
            html,
            count=1,
            flags=re.I,
        )
    return html.replace("</title>", '</title>\n<meta name="robots" content="' + content + '">', 1)


def _strip_robots(html: str) -> str:
    return re.sub(r'\n?<meta[^>]*name=["\']robots["\'][^>]*>\n?', "\n", html, flags=re.I)


def _strip_banner(html: str) -> str:
    return re.sub(r'\n?<div class="preview-banner">.*?</div>\n?', "\n", html, flags=re.S)


STUB_RELS = {
    "how-old-am-i.html",
    "date-of-birth.html",
    "rodent-age-calculator.html",
    "how-old-am-i/index.html",
    "date-of-birth/index.html",
}


def apply_robots(docs: Path, launch: bool) -> None:
    if launch:
        (docs / "robots.txt").write_text(
            "User-agent: *\nAllow: /\nSitemap: https://agecalculator.com/sitemap.xml\n"
        )
    else:
        (docs / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
    for pth in sorted(docs.rglob("*.html")):
        rel = pth.relative_to(docs).as_posix()
        html = pth.read_text()
        is_stub = rel in STUB_RELS
        is_embed = rel in ("embed/index.html", "embed.html")
        is_widget = rel in ("widget/index.html", "widget.html")
        if launch:
            html = _strip_banner(html)
            if is_stub:
                html = _strip_robots(html)
            elif is_embed or is_widget:
                html = _insert_robots(html, "noindex")
            else:
                html = _strip_robots(html)
            if "preview-banner" in html:
                raise SystemExit(f"launch build still has the preview banner on {rel}")
        else:
            if is_stub:
                html = _strip_robots(html)
            else:
                html = _insert_robots(html, "noindex,nofollow")
        pth.write_text(html)
    mode = "launch" if launch else "preview"
    print(f"applied {mode} robots.txt and robots meta")


def main():
    clean_promoted()
    restore_shells()
    for md_name, html_name in PAGE.items():
        raw = (COPY / md_name).read_text()
        meta, body, faqs = parse_md(raw)
        if not meta["title"]:
            raise SystemExit(f"no title in {md_name}")
        body_html = render_body(body, html_name)
        html = (DOCS / html_name).read_text()
        if html_name in ("privacy.html", "contact.html"):
            html = build_privacy(html, meta, body_html)
        elif html_name == "embed.html":
            html = build_embed(html, meta, body_html)
        else:
            html = update_head(html, meta, faqs)
            html = replace_tool_page_content(html, body_html, faqs, html_name)
            if html_name == "chronological-age.html":
                html = fix_sheet_labels(html)
            if html_name == "what-year-was-i-born.html":
                html = fix_birth_year_placement(html)
        html = re.sub(r'<p class="placeholder-note">.*?</p>\n?', "", html)
        html = replace_footer(html)
        if html_name == "chronological-age.html":
            html = ensure_chrono_rule_line(html)
        if "noindex,nofollow" not in html and html_name in ("privacy.html", "contact.html", "embed.html", "widget.html"):
            raise SystemExit(f"noindex missing on {html_name}")
        if html_name not in ("privacy.html", "embed.html") and "noindex,nofollow" not in html:
            raise SystemExit(f"preview noindex missing on {html_name}")
        (DOCS / html_name).write_text(html)
        print(f"built {html_name}: faqs={len(faqs)} body={len(body_html)}")

    # remaining footers (404, pages without md rebuild this turn already done except 404)
    for name in ["404.html"]:
        p = DOCS / name
        t = replace_footer(p.read_text())
        p.write_text(t)
        print("footer", name)

    patch_widget()
    patch_app_widget_hint()
    apply_ux_pass()
    from promote_dirs import run as promote_run
    promote_run(DOCS)
    finalize_404(DOCS, launch=LAUNCH)
    apply_robots(DOCS, launch=LAUNCH)

    # confirm embed.js URL untouched in snippets
    emb = (DOCS / "embed" / "index.html").read_text()
    if "https://agecalculator.com/embed.js" not in emb:
        raise SystemExit("embed.js URL missing from embed.html")
    if "https://agecalculator.com/widget/" not in emb:
        raise SystemExit("widget URL missing from snippets")

if __name__ == "__main__":
    main()
