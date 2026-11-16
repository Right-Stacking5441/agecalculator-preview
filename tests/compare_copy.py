#!/usr/bin/env python3
"""Compare the visible text of each docs page (directory index or homepage) to its approved markdown file."""
from __future__ import annotations
import html as htmllib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPY = ROOT / "copy-approved"
DOCS = ROOT / "docs"

MAP = {
    "home.md": "index.html",
    "past.md": "past/index.html",
    "difference.md": "difference/index.html",
    "days-between-dates.md": "days-between-dates/index.html",
    "chronological-age.md": "chronological-age/index.html",
    "birthday-countdown.md": "birthday-countdown/index.html",
    "how-old-will-i-be.md": "how-old-will-i-be/index.html",
    "korean-age.md": "korean-age/index.html",
    "what-year-was-i-born.md": "what-year-was-i-born/index.html",
    "dog-age.md": "dog-age/index.html",
    "cat-age.md": "cat-age/index.html",
    "privacy.md": "privacy/index.html",
    "contact.md": "contact/index.html",
    "embed.md": "embed/index.html",
    "widget.md": "widget/index.html",
}

def page_key(html_name: str) -> str:
    """Map directory indexes back to the old flat filename (privacy/index.html -> privacy.html)."""
    path = Path(html_name)
    if path.name == "index.html" and path.parent.as_posix() not in (".", ""):
        return path.parent.name + ".html"
    return path.name


STALE = [
    "The site is paid for by the adverts on it",
    "hides it for dogs under one year",
    "about 9 to 23 kg medium",
    "Draft copy",
    "placeholder-note",
]


def fold(s: str) -> str:
    s = htmllib.unescape(s)
    trans = str.maketrans({
        "’": "'", "‘": "'", "“": '"', "”": '"',
        "–": "-", "—": "-", "\u00a0": " ", "×": "x",
    })
    s = s.translate(trans)
    return re.sub(r"\s+", " ", s).strip()


def strip_md_links(s: str) -> str:
    out, i = [], 0
    while i < len(s):
        if s[i] == "[":
            close = s.find("](", i)
            if close != -1:
                j, depth = close + 2, 1
                while j < len(s) and depth:
                    if s[j] == "(":
                        depth += 1
                    elif s[j] == ")":
                        depth -= 1
                    j += 1
                if depth == 0:
                    out.append(s[i + 1 : close])
                    i = j
                    continue
        out.append(s[i])
        i += 1
    return "".join(out)


def md_plain(s: str) -> str:
    s = strip_md_links(s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = s.replace("**", "")
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", s)
    return fold(s)


def parse_md(text: str):
    meta = {}
    for key, pat in [
        ("title", r"\*\*Title:\*\*\s*(.+)"),
        ("meta", r"\*\*Meta description:\*\*\s*(.+)"),
        ("h1", r"\*\*H1(?:\s*\([^)]*\))?:\*\*\s*(.+)"),
        ("lede", r"\*\*Line under the H1:\*\*\s*(.+)"),
    ]:
        m = re.search(pat, text)
        meta[key] = m.group(1).strip() if m else ""
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
    body = re.sub(r"^## Body\s*\n+", "", body.strip() + "\n")
    faqs = []
    for m in re.finditer(r"###\s+(.+?)\n(.*?)(?=\n### |\Z)", faq_raw.strip() + "\n", re.S):
        q = m.group(1).strip()
        a = " ".join(line.strip() for line in m.group(2).strip().splitlines() if line.strip())
        faqs.append((q, a))
    units = []
    lines = body.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if re.match(r"^```", line):
            i += 1
            code = []
            while i < len(lines) and not re.match(r"^```\s*$", lines[i]):
                code.append(lines[i])
                i += 1
            if i < len(lines):
                i += 1
            units.append(("code", "\n".join(code)))
            continue
        if line.startswith("## "):
            units.append(("h2", md_plain(line[3:].strip())))
            i += 1
            continue
        if line.startswith("|"):
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.match(r"^:?-+:?$", c) for c in cells):
                    for c in cells:
                        units.append(("cell", md_plain(c)))
                i += 1
            continue
        if re.match(r"^[-*]\s+", line):
            while i < len(lines) and re.match(r"^[-*]\s+", lines[i]):
                units.append(("li", md_plain(re.sub(r"^[-*]\s+", "", lines[i]))))
                i += 1
            continue
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith("#") and not lines[i].startswith("|") and not re.match(r"^[-*]\s+", lines[i]) and not re.match(r"^```", lines[i]):
            para.append(lines[i])
            i += 1
        units.append(("p", md_plain(" ".join(x.strip() for x in para))))
    return meta, units, faqs


def visible_text(html: str) -> str:
    # keep noscript (widget no-JS line is in there)
    html = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", html)
    html = re.sub(r"(?is)</?(p|div|section|h[1-6]|li|ul|ol|tr|td|th|table|thead|tbody|blockquote|pre|br|hr|aside|header|footer|nav|main|article|figure|figcaption|fieldset|legend|details|summary)[^>]*>", " ", html)
    html = re.sub(r"<[^>]+>", "", html)
    return fold(html)


def visible_faqs(html: str):
    out = []
    # UX-pass FAQ: <details class="qa"><summary><h3>Q</h3>…</summary><div class="qa-a">A</div>
    for m in re.finditer(
        r'<details class="qa">\s*<summary>\s*<h3>(.*?)</h3>.*?</summary>\s*<div class="qa-a">(.*?)</div>\s*</details>',
        html,
        re.S,
    ):
        q = fold(re.sub(r"<[^>]+>", "", m.group(1)))
        a = fold(re.sub(r"<[^>]+>", "", m.group(2)))
        out.append((q, a))
    if out:
        return out
    for m in re.finditer(
        r"<details>\s*<summary>(.*?)</summary>\s*<div>\s*<p>(.*?)</p>\s*</div>\s*</details>",
        html,
        re.S,
    ):
        q = fold(re.sub(r"<[^>]+>", "", m.group(1)))
        a = fold(re.sub(r"<[^>]+>", "", m.group(2)))
        out.append((q, a))
    for m in re.finditer(
        r'<div class="qa">\s*<dt>(.*?)</dt>\s*<dd>\s*<p>(.*?)</p>\s*</dd>\s*</div>',
        html,
        re.S,
    ):
        q = fold(re.sub(r"<[^>]+>", "", m.group(1)))
        a = fold(re.sub(r"<[^>]+>", "", m.group(2)))
        out.append((q, a))
    return out

def jsonld_faqs(html: str):
    out = []
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            obj = json.loads(m.group(1))
        except Exception:
            continue
        if obj.get("@type") != "FAQPage":
            continue
        for e in obj.get("mainEntity") or []:
            out.append((
                fold(e.get("name") or ""),
                fold((e.get("acceptedAnswer") or {}).get("text") or ""),
            ))
    return out


def main() -> int:
    mismatches = []
    for md_name, html_name in MAP.items():
        raw = (COPY / md_name).read_text()
        html = (DOCS / html_name).read_text()
        meta, units, faqs = parse_md(raw)
        title = re.search(r"<title>([^<]*)</title>", html)
        desc = re.search(r'<meta[^>]*name="description"[^>]*content="([^"]*)"', html) or re.search(r'<meta[^>]*content="([^"]*)"[^>]*name="description"', html)
        h1m = re.search(r"<h1>([^<]*)</h1>", html) or re.search(r'<p class="w-title">([^<]*)</p>', html)
        lede = ""
        m = re.search(r'<div class="intro"><h1>[^<]*</h1><p(?: class="lede")?>(.*?)</p></div>', html, re.S)
        if m:
            lede = fold(re.sub(r"<[^>]+>", "", m.group(1)))
        elif page_key(html_name) == "privacy.html":
            m = re.search(r"<h1>[^<]*</h1>\s*<p>(.*?)</p>", html, re.S)
            lede = fold(re.sub(r"<[^>]+>", "", m.group(1))) if m else ""
        page_title = title.group(1) if title else ""
        page_desc = desc.group(1) if desc else ""
        page_h1 = h1m.group(1) if h1m else ""
        issues = []
        if meta["title"] and fold(page_title) != fold(meta["title"]):
            issues.append(f"TITLE md={meta['title']!r} html={page_title!r}")
        if meta["meta"] and fold(page_desc) != fold(meta["meta"]):
            issues.append(f"META md={meta['meta']!r} html={page_desc!r}")
        if meta["h1"] and fold(page_h1) != fold(meta["h1"]):
            issues.append(f"H1 md={meta['h1']!r} html={page_h1!r}")
        if meta["lede"] and page_key(html_name) != "widget.html" and fold(lede) != fold(meta["lede"]):
            issues.append(f"LEDE md={meta['lede']!r} html={lede!r}")

        hay = visible_text(html)

        if page_key(html_name) == "widget.html":
            for needle in [
                "Date of birth",
                "e.g. 15 March 1995",
                "Age on this date",
                'Time zone for "today"',
                "Your age will appear here.",
                "This calculator needs JavaScript to work out the result. You can use it at agecalculator.com.",
                "Age calculator by agecalculator.com",
            ]:
                if fold(needle) not in hay and needle not in html:
                    issues.append(f"WIDGET missing: {needle!r}")
        else:
            for kind, text in units:
                if kind == "code":
                    codes = re.findall(r"<pre class=\"snippet\"><code>(.*?)</code></pre>", html, re.S)
                    codes_plain = [htmllib.unescape(c) for c in codes]
                    if text not in codes_plain:
                        issues.append(f"CODE missing:\n--- expected ---\n{text}\n--- found ---\n" + "\n---\n".join(codes_plain))
                    continue
                if text and text not in hay:
                    issues.append(f"{kind.upper()} missing: {text[:240]!r}")

        vis = visible_faqs(html)
        md_faqs = [(fold(q), md_plain(a)) for q, a in faqs]
        if vis != md_faqs:
            if len(vis) != len(md_faqs):
                issues.append(f"FAQ count md={len(md_faqs)} visible={len(vis)}")
            n = max(len(vis), len(md_faqs))
            for i in range(n):
                a = md_faqs[i] if i < len(md_faqs) else ("<missing>", "<missing>")
                b = vis[i] if i < len(vis) else ("<missing>", "<missing>")
                if a != b:
                    if a[0] != b[0]:
                        issues.append(f"FAQ Q{i+1} md={a[0]!r} vis={b[0]!r}")
                    if a[1] != b[1]:
                        issues.append(f"FAQ A{i+1} md={a[1]!r} vis={b[1]!r}")
        ld = jsonld_faqs(html)
        if ld != vis:
            if vis or ld:
                issues.append(f"JSON-LD FAQs != visible FAQs (ld={len(ld)} vis={len(vis)})")
                for i, (a, b) in enumerate(zip(vis, ld)):
                    if a != b:
                        if a[0] != b[0]:
                            issues.append(f"JSON-LD Q{i+1} vis={a[0]!r} ld={b[0]!r}")
                        if a[1] != b[1]:
                            issues.append(f"JSON-LD A{i+1} vis={a[1]!r} ld={b[1]!r}")
                if len(ld) != len(vis):
                    issues.append(f"JSON-LD count mismatch extra vis={vis[len(ld):]} extra ld={ld[len(vis):]}")

        for stale in STALE:
            if stale in html:
                issues.append(f"STALE: {stale!r}")

        if page_key(html_name) == "privacy.html":
            if "[PLACEHOLDER: date this policy is published]" not in html:
                issues.append("PRIVACY placeholder missing: [PLACEHOLDER: date this policy is published]")
            if "[PLACEHOLDER: contact email address]" in html:
                issues.append("PRIVACY contact email placeholder should be filled with hello@agecalculator.com")
            if "hello@agecalculator.com" not in html:
                issues.append("PRIVACY contact email hello@agecalculator.com missing")
            if "Hurrell Capital Limited, a company registered in England and Wales (company number 15158828)" not in html:
                issues.append("PRIVACY operator details missing")
            if "hosted on GitHub Pages" not in html or "docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages" not in html:
                issues.append("PRIVACY GitHub Pages hosting sentence or docs link missing")
            if "docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" not in html:
                issues.append("PRIVACY GitHub General Privacy Statement link missing")
            if "www.netlify.com/pdf/netlify-dpa.pdf" not in html or "Netlify, Inc." not in html:
                issues.append("PRIVACY Netlify app-redirect processor paragraph or DPA link missing")
            if "30 days" not in html or "13 months" not in html:
                issues.append("PRIVACY Netlify log retention periods missing")
            if "noindex" not in html:
                issues.append("PRIVACY missing noindex")

        if page_key(html_name) == "contact.html":
            if "hello@agecalculator.com" not in html:
                issues.append("CONTACT email hello@agecalculator.com missing")
            if "mailto:hello@agecalculator.com" not in html:
                issues.append("CONTACT mailto:hello@agecalculator.com missing")
            if "noindex" not in html:
                issues.append("CONTACT missing noindex")
            if not re.search(r'href=["\'](?:\./|\.\./)*contact/?["\']', html):
                issues.append("CONTACT footer (or page) missing contact href — expected on every page")

        if page_key(html_name) == "embed.html":
            if "https://agecalculator.com/embed.js" not in html:
                issues.append("EMBED script URL missing")

        if issues:
            mismatches.append((html_name, issues))
            print(f"\n===== {html_name} ({len(issues)} issues) =====")
            for iss in issues:
                print("-", iss)
        else:
            print(f"OK  {html_name}")

    print("\n==== SUMMARY ====")
    if not mismatches:
        print("No copy-vs-file drift.")
        return 0
    print(f"{len(mismatches)} pages with issues:")
    for name, issues in mismatches:
        print(f"  {name}: {len(issues)}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
