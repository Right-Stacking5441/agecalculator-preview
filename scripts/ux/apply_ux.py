"""Apply the UX-pass HTML structure to docs/ (see SPEC.md §16 and §16.8).

Called from scripts/build_copy.py after copy is injected into the pre-UX
page shells, so a future markdown rebuild reproduces the same structure.
"""
from __future__ import annotations
import json, re, sys, shutil
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# Allow `import icons` when run from this directory or via build_copy.
HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from bs4 import BeautifulSoup, NavigableString
from icons import icon

COPY = json.loads((HERE / "copy.json").read_text())
P, UI = COPY["pages"], COPY["ui"]
_COPY_TYPOGRAPHED = False


def typograph_loaded_copy():
    """Run typograph() over every copy.json string (intros, FAQ headings, UI, empty states)."""
    global P, UI, _COPY_TYPOGRAPHED
    if _COPY_TYPOGRAPHED:
        return
    if str(HERE.parent) not in sys.path:
        sys.path.insert(0, str(HERE.parent))
    from build_copy import typograph
    def walk(o):
        if isinstance(o, str):
            return typograph(o)
        if isinstance(o, dict):
            for k, v in o.items():
                o[k] = walk(v)
            return o
        if isinstance(o, list):
            for i, v in enumerate(o):
                o[i] = walk(v)
            return o
        return o
    walk(COPY)
    P, UI = COPY["pages"], COPY["ui"]
    _COPY_TYPOGRAPHED = True


def frag(html):
    return BeautifulSoup(html, "html.parser")


def mast(soup, slug, nav):
    old = soup.select_one("header.mast")
    if not old:
        return
    logo = old.select_one(".brand svg")
    cur = "./" if slug == "index" else slug
    items = "".join(
        f'<li><a href="{h}"{" aria-current=\"page\"" if h == cur else ""}>{t}</a></li>'
        for h, t in nav
    )
    logo_html = logo.decode() if logo else ""
    new = frag(
        f'<header class="mast"><div class="wrap"><a class="brand" href="./">{logo_html}<span class="wm">agecalculator<span>.com</span></span></a>'
        f'<nav class="nav-menu"><ul id="nav-menu-list">{items}</ul></nav></div></header>'
    )
    old.replace_with(new)


def foot(soup):
    for s in soup.select(".foot-tools li span"):
        s.decompose()
    for t in soup.select(".foot-tools li"):
        for c in list(t.contents):
            if isinstance(c, NavigableString) and not c.strip():
                c.extract()


def strip_noise(soup, launch=False):
    sels = [".ad", "aside.side", ".dateline", ".tools-link", ".crumbs", ".after-leaf", "script[data-ux-drop]"]
    if launch:
        sels = [".preview-banner"] + sels
    for sel in sels:
        for e in soup.select(sel):
            e.decompose()
    # Drop the d7d71b5 inline mast-date fill script if a shell still has it.
    for sc in list(soup.find_all("script")):
        if sc.string and "getElementById('dateline')" in sc.string:
            sc.decompose()


def datefields(soup, labels):
    for df in soup.select("[data-datefield]"):
        name = df["data-datefield"]
        lab = df.select_one(".df-label")
        if lab and name in labels:
            lab.string = labels[name]
        parts = df.select_one(".parts")
        rb = df.select_one(".readback")
        if parts:
            parts["hidden"] = ""
        if parts and rb:
            foot_el = frag('<div class="df-foot"></div>').div
            rb.wrap(foot_el)
            parts["id"] = name + "-parts"
            parts.extract()
            foot_el.insert_after(parts)


def toggle_html(ids, shared):
    return (
        f'<button type="button" class="textbtn parts-toggle{" shared" if shared else ""}" aria-expanded="false" aria-controls="{" ".join(ids)}">'
        f'{icon("boxes")}<span>{UI["parts_toggle"]}</span></button>'
    )


def today_short():
    n = datetime.now(ZoneInfo("Europe/London"))
    wdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{wdays[n.weekday()]} {n.day} {months[n.month - 1]} {n.year}"


NOSCRIPT_HIDE = (
    '<noscript><style>.on-date, .on.settings button, .on.settings .tzline, .parts-toggle, .parts-shared, #leaf .ph-msg, #on-label[data-idle], .on.settings:has(#on-label[data-idle]) { display: none !important; }</style></noscript>'
)


def ensure_noscript(soup):
    if not soup.head:
        return
    for ns in soup.head.find_all("noscript"):
        if ns.find("style") and "on-date" in ns.get_text():
            return
    soup.head.append(frag(NOSCRIPT_HIDE))


def parts_toggles(soup):
    form = soup.select_one(".calc form")
    dfs = [d for d in form.select("[data-datefield]") if d.select_one(".parts")] if form else []
    if not dfs:
        return
    ids = [d.select_one(".parts")["id"] for d in dfs]
    if len(dfs) == 1:
        foot_el = dfs[0].select_one(".df-foot")
        if foot_el:
            foot_el.append(frag(toggle_html(ids, False)))
    else:
        last = dfs[-1].find_parent(class_="on-primary") or dfs[-1]
        last.insert_after(frag(f'<div class="parts-shared">{toggle_html(ids, True)}</div>'))


def settings_block(soup, slug):
    on = soup.select_one(".calc .on")
    if not on:
        return
    box = on.select_one("#on-box")
    p = on.find("p", recursive=False)
    if slug == "past":
        del box["hidden"]
        btn = p.select_one("#on-toggle")
        btn["hidden"] = ""
        btn.extract()
        box.append(btn)
        lab = p.select_one("#on-label")
        lab["hidden"] = ""
        lab.clear()
        lab.string = "Age today"
        lab.extract()
        box.append(lab)
        p.decompose()
        on["class"] = ["on", "on-primary"]
        zp = box.select_one(".zone-pick")
        if zp:
            d = frag(
                f'<details class="opt-field tz"><summary>{icon("clock")}<span>{UI["time_zone"]}</span></summary><div class="opt-body"></div></details>'
            ).details
            zp.extract()
            d.div.append(zp)
            soup.select_one(".result #live").insert_after(d)
        return
    if p:
        lab = p.select_one("#on-label")
        btn = p.select_one("#on-toggle")
        future = lab.has_attr("data-idle")
        lab.extract()
        btn.extract()
        p.clear()
        if future:
            lab["data-idle"] = UI["settings_idle_future"]
            lab.string = UI["settings_idle_future"]
            btn["data-label"] = UI["settings_button_future"]
            btn.string = UI["settings_button_future"]
        else:
            btn["data-label"] = UI["settings_button"]
            btn.string = UI["settings_button"]
            # String #22: settings line is "Time zone: Europe/London" and
            # "Change date or time zone". The baked "Age today, <date>" is gone.
            # Height stays one line, so dropping the date does not shift the card.
            lab.clear()
            lab.string = UI["settings_zone"]
            lab.append(" ")
            lab.append(frag('<span id="zone-now">Europe/London</span>'))
        if btn.has_attr("aria-label"):
            del btn["aria-label"]
        p.append(frag(icon("clock")))
        p.append(lab)
        if not future:
            pass
        if slug != "widget":
            p.append(" ")
            p.append(btn)
    on["class"] = ["on", "settings"]
    on.extract()
    soup.select_one(".result #live").insert_after(on)


def opt_names(soup, slug):
    names = soup.select(".calc label.name.inline")
    if not names:
        return
    title = UI["add_names"] if len(names) > 1 else UI["add_name"]
    d = frag(f'<details class="opt-field"><summary>{icon("plus")}<span>{title}</span></summary><div class="opt-body"></div></details>').details
    for n in names:
        d.div.append(n.extract())
    soup.select_one(".calc form").append(d)


def rule_line(soup):
    rl = soup.select_one(".result .rule-line")
    if not rl:
        return
    d = frag(f'<details class="note-d"><summary>{UI["months_note"]}</summary></details>').details
    rl.replace_with(d)
    d.append(rl)
    d.extract()
    soup.select_one(".result #live").insert_after(d)


def seo_and_pets(soup):
    for j in soup.select('script[type="application/ld+json"]'):
        if '"BreadcrumbList"' in (j.string or ""):
            j.decompose()
    py, pm = soup.select_one("#pet-y"), soup.select_one("#pet-m")
    if py:
        py["placeholder"] = UI["pet_years_placeholder"]
    if pm:
        pm.attrs.pop("placeholder", None)
        lab = pm.find_parent("label")
        cap = lab.find("span") if lab else None
        if cap is not None:
            cap.string = "Months (optional)"
    oq = soup.select_one("#on-q")
    if oq and soup.body and soup.body.get("data-page") == "past":
        oq["placeholder"] = "e.g. 1 June 2010"


def intro_into_calc(soup, intro):
    i = soup.select_one(".band .intro")
    calc = soup.select_one(".band .calc")
    if not i or not calc:
        return
    lede = i.select_one(".lede")
    if lede is not None and not lede.get_text(strip=True) and intro:
        lede.string = intro
    elif lede is None and intro:
        h1 = i.find("h1")
        tag = soup.new_tag("p")
        tag["class"] = ["lede"]
        tag.string = intro
        if h1:
            h1.insert_after(tag)
        else:
            i.append(tag)
    col = frag('<div class="entry-col"></div>').div
    form = calc.select_one("form")
    i.extract()
    form.insert_before(col)
    col.append(i)
    col.append(form.extract())


def related(soup, slug, nav):
    cont = soup.select_one(".content")
    if not cont:
        return
    for s in cont.select(":scope > section"):
        if s.h2 and s.h2.get_text().strip() == "More calculators":
            s.decompose()
    links = [tuple(x) for x in COPY["related_home"]] if slug == "index" else [(h, t) for h, t in nav if h != slug]
    items = "".join(f'<li><a href="{h}">{t}</a></li>' for h, t in links)
    nav_el = frag(f'<nav class="related" aria-labelledby="rel-h"><h2 id="rel-h">More calculators</h2><ul>{items}</ul></nav>')
    cont.insert(0, nav_el)


def collapse(soup, cfg):
    cont = soup.select_one(".content")
    if not cont:
        return
    for s in list(cont.select(":scope > section")):
        if "faq" in (s.get("class") or []):
            qs = s.select(".qa")
            heading = cfg.get("faq")
            if not heading or not qs:
                s.decompose()
                continue
            out = f'<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">{heading}</h2>'
            for q in qs:
                dd = q.dd.decode_contents() if q.dd else ""
                dt = q.dt.decode_contents() if q.dt else ""
                out += f'<details class="qa"><summary><h3>{dt}</h3>{icon("chev", "chev")}</summary><div class="qa-a">{dd}</div></details>'
            s.replace_with(frag(out + "</section>"))
            continue
        h2 = s.find("h2", recursive=False)
        title = h2.decode_contents() if h2 else cfg["howto"]
        hid = h2.get("id") if h2 else None
        if h2:
            h2.extract()
        body = s.decode_contents()
        sid = s.get("id")
        cls = " ".join(c for c in (s.get("class") or []) if c != "tight")
        opened = " open" if sid == "class-sheet" else ""
        d = (
            f'<details class="topic{(" " + cls) if cls else ""}"{f" id=\"{sid}\"" if sid else ""}{opened}>'
            f'<summary><h2{f" id=\"{hid}\"" if hid else ""}>{title}</h2>{icon("chev", "chev")}</summary>'
            f'<div class="topic-body">{body}</div></details>'
        )
        s.replace_with(frag(d))


def nav_from_home(docs: Path):
    nav = [("./", "Age calculator")]
    home = BeautifulSoup((docs / "index.html").read_text(), "html.parser")
    for a in home.select(".foot-tools a"):
        nav.append((a["href"], a.get_text().strip()))
    # De-dupe while keeping order (shells list home first; we already have it).
    seen, out = set(), []
    for h, t in nav:
        if h in seen:
            continue
        seen.add(h)
        out.append((h, t))
    return out



NAV_MENU = """<script>
(function(){
  try {
  if (document.documentElement.getAttribute('data-menu-fallback') === '1') return;
  var menu = document.querySelector('.nav-menu');
  if (!menu) return;
  var list = menu.querySelector('ul');
  if (!list) return;
  if (!list.id) list.id = 'nav-menu-list';

  menu.classList.add('is-enhanced');

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', list.id);
  btn.setAttribute('aria-label', 'Calculators');
  btn.innerHTML = '<svg class="ic ic-menu" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 7.2c5.4-.3 10.7-.2 16 .1M4 12.1c5.3-.2 10.6-.1 16 0M4 16.9c3.6-.2 7.2-.2 10.8 0"/></svg><span>Calculators</span>';
  menu.insertBefore(btn, list);

  var back = document.createElement('button');
  back.type = 'button';
  back.className = 'nav-menu-back';
  back.setAttribute('tabindex', '-1');
  back.setAttribute('aria-label', 'Close menu');
  back.hidden = true;
  document.body.appendChild(back);

  var debug = /(?:^|[?&])debug=1(?:&|$)/.test(location.search);
  var logEl = null;
  var logLines = [];
  function pad(n, w) { n = String(n); return n.length >= w ? n : ('000' + n).slice(-w); }
  function stamp() {
    var d = new Date();
    return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + '.' + pad(d.getMilliseconds(), 3);
  }
  function targetName(t) {
    if (!t || !t.tagName) return String(t || 'unknown');
    var id = t.id ? '#' + t.id : '';
    var cls = (typeof t.className === 'string' && t.className.trim()) ? '.' + t.className.trim().split(/\\s+/).join('.') : '';
    return t.tagName.toLowerCase() + id + cls;
  }
  if (debug) {
    logEl = document.createElement('pre');
    logEl.id = 'nav-menu-debug';
    logEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(logEl);
  }
  function log(type, target, open) {
    if (!debug || !logEl) return;
    logLines.push(stamp() + ' ' + type + ' ' + targetName(target) + ' open=' + open);
    if (logLines.length > 15) logLines = logLines.slice(-15);
    // Use fromCharCode so a \\n escape cannot be turned into a raw newline by the HTML pipeline.
    logEl.textContent = logLines.join(String.fromCharCode(10));
  }
  function related(t) {
    if (!t || !t.tagName) return false;
    return t === btn || btn.contains(t) || t === back || t === list || list.contains(t) || t === menu || menu.contains(t);
  }
  if (debug) {
    ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown'].forEach(function (type) {
      document.addEventListener(type, function (e) {
        if (type === 'keydown' && e.key !== 'Escape' && e.key !== 'Esc' && !related(e.target)) return;
        if (type !== 'keydown' && !related(e.target)) return;
        var tgt = e.target;
        setTimeout(function () { log(e.type, tgt, isOpen()); }, 0);
      }, true);
    });
  }

  function isOpen() { return !list.hasAttribute('hidden'); }
  function setOpen(open) {
    open = !!open;
    if (open) {
      list.removeAttribute('hidden');
      back.removeAttribute('hidden');
    } else {
      list.setAttribute('hidden', '');
      back.setAttribute('hidden', '');
    }
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  setOpen(false);

  /* One click handler on the button. It does not toggle on pointerdown, and
     there is no native details toggle left to fight with. */
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!isOpen());
  });

  back.addEventListener('click', function (e) {
    e.preventDefault();
    setOpen(false);
  });

  list.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && list.contains(a)) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!isOpen()) return;
    setOpen(false);
    btn.focus({ preventScroll: true });
  });

  menu.addEventListener('focusout', function (e) {
    if (!isOpen()) return;
    var next = e.relatedTarget;
    if (!next) return;
    if (menu.contains(next)) return;
    setOpen(false);
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) setOpen(false);
  });
  window.addEventListener('popstate', function () { setOpen(false); });
  menu.setAttribute('data-menu-ready', '1');
  } catch (err) {
    if (typeof window.agecalcMenuFailsafe === 'function') window.agecalcMenuFailsafe();
  }
})();

(function(){
  function openHash() {
    var id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var d = (el.matches && el.matches('details')) ? el : (el.closest ? el.closest('details') : null);
    if (d) d.open = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openHash);
  else openHash();
  window.addEventListener('hashchange', openHash);
})();
</script>"""



# No backslash escapes in this snippet, so the HTML pipeline cannot mangle it.
JS_FLAG_SRC = "document.documentElement.classList.add('js')"
# Fail-safe lives in the head, separate from the footer enhancer: if the
# enhancer is blocked or throws, this still runs and shows the list.
# The 3s timer starts as soon as the head script runs, not at DOMContentLoaded.
# Fallback keeps html.js so the compact header does not shift; the list is
# taken out of flow. A late enhancer must bail if data-menu-fallback is set.
# No backslash escapes, so the HTML pipeline cannot mangle it.
JS_FLAG = """<script>document.documentElement.classList.add('js');
(function () {
  function failsafe() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', failsafe);
      return;
    }
    var menu = document.querySelector('.nav-menu');
    if (!menu) return;
    if (menu.getAttribute('data-menu-ready') === '1') return;
    if (document.documentElement.getAttribute('data-menu-fallback') === '1') return;
    document.documentElement.setAttribute('data-menu-fallback', '1');
    menu.classList.remove('is-enhanced');
    var list = document.getElementById('nav-menu-list');
    if (list) list.removeAttribute('hidden');
    var btn = menu.querySelector('button[aria-controls]');
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    var back = document.querySelector('.nav-menu-back');
    if (back && back.parentNode) back.parentNode.removeChild(back);
  }
  setTimeout(failsafe, 3000);
  window.agecalcMenuFailsafe = failsafe;
})();
</script>"""


def ensure_js_flag(soup):
    """Add a tiny head script, before any stylesheet, so first paint can hide the no-JS list."""
    if not soup.head:
        return
    for sc in list(soup.head.find_all("script")):
        src = sc.string or ""
        if JS_FLAG_SRC in src and "prefill" not in src:
            sc.decompose()
    node = frag(JS_FLAG)
    insert_before = None
    for child in soup.head.children:
        name = getattr(child, "name", None)
        if name in ("link", "style"):
            insert_before = child
            break
        if name == "script":
            insert_before = child
            break
    if insert_before is not None:
        insert_before.insert_before(node)
    else:
        metas = soup.head.find_all("meta")
        if metas:
            metas[-1].insert_after(node)
        else:
            soup.head.append(node)


def ensure_nav_menu(soup):
    if not soup.body:
        return
    # Only remove a previous enhancer (it adds is-enhanced). The head fail-safe
    # also mentions is-enhanced and nav-menu-list, but never adds the class.
    for sc in list((soup.body or soup).find_all("script")):
        if sc.string and (
            "classList.add('is-enhanced')" in sc.string and "nav-menu-list" in sc.string
            or "details.nav-menu" in sc.string
        ):
            sc.decompose()
    soup.body.append(frag(NAV_MENU))



def fix_skip(soup, slug):
    """Pages with no calculator should not say 'Skip to the calculator'."""
    skip = soup.select_one("a.skip")
    if not skip:
        return
    has_calc = soup.select_one("[data-calc], .calc")
    if slug == "404" or not has_calc:
        skip["href"] = "#main"
        skip.clear()
        skip.string = "Skip to content"



COPY_ACT = {
    "difference": "Copy gap",
    "days-between-dates": "Copy days",
    "birthday-countdown": "Copy days",
    "korean-age": "Copy ages",
    "what-year-was-i-born": "Copy year",
}


def acts_block(soup, slug):
    """Quiet copy/share/print row under the result card (27 UI strings)."""
    leaf = soup.select_one(".result #leaf")
    if not leaf or slug in ("widget", "embed", "privacy", "contact"):
        return
    if soup.select_one(".acts"):
        return
    label = COPY_ACT.get(slug, "Copy age")
    # Chronological age already has Copy/Print on the slip; the mock row is details + link only.
    if slug == "chronological-age":
        buttons = (
            '<button class="act" data-act="all" type="button">' + icon("copy") + '<span class="act-l">Copy details</span></button>'
            '<button class="act" data-act="link" type="button">' + icon("copy") + '<span class="act-l">Copy link</span></button>'
        )
    else:
        buttons = (
            '<button class="act" data-act="age" type="button">' + icon("copy") + '<span class="act-l">' + label + "</span></button>"
            '<button class="act" data-act="all" type="button">' + icon("copy") + '<span class="act-l">Copy details</span></button>'
            '<button class="act" data-act="link" type="button">' + icon("copy") + '<span class="act-l">Copy link</span></button>'
            '<button class="act act-print" data-act="print" type="button">' + icon("printer") + '<span class="act-l">Print</span></button>'
        )
    html = (
        '<div aria-label="Copy or share this result" class="acts" role="group">'
        + buttons +
        '</div>'
        '<p aria-live="polite" class="sr-only" id="copy-live"></p>'
    )
    node = frag(html)
    result = leaf.parent
    live = soup.select_one(".result #live")
    if result and not result.select_one(".print-meta.pm-top"):
        leaf.insert_before(frag('<div class="print-meta pm-top"></div>'))
    insert_at = leaf
    children = list(node.contents) if getattr(node, "name", None) in (None, "[document]") else [node]
    for child in children:
        if getattr(child, "name", None) is None and not str(child).strip():
            continue
        insert_at.insert_after(child)
        insert_at = child
    if result and not result.select_one(".print-meta.pm-bottom"):
        bottom = frag('<div class="print-meta pm-bottom"></div>')
        if live:
            live.insert_before(bottom)
        else:
            insert_at.insert_after(bottom)


def ensure_viewport(soup):
    vp = soup.find("meta", attrs={"name": "viewport"})
    content = "width=device-width, initial-scale=1, viewport-fit=cover"
    if vp:
        vp["content"] = content
    elif soup.head:
        soup.head.append(frag('<meta name="viewport" content="' + content + '">'))


def ensure_share_head(soup):
    """color-scheme, twitter:card, og:image and the apple-touch-icon, on every page."""
    if not soup.head:
        return
    if not soup.find("meta", attrs={"name": "color-scheme"}):
        soup.head.append(frag('<meta name="color-scheme" content="light">'))
    if not soup.find("meta", attrs={"name": "twitter:card"}):
        soup.head.append(frag('<meta name="twitter:card" content="summary">'))
    if not soup.find("meta", attrs={"property": "og:image"}):
        soup.head.append(frag('<meta property="og:image" content="https://agecalculator.com/og-image.png">'))
    if not soup.find("meta", attrs={"name": "twitter:image"}):
        soup.head.append(frag('<meta name="twitter:image" content="https://agecalculator.com/og-image.png">'))
    if not soup.select_one('link[rel="apple-touch-icon"]'):
        soup.head.append(frag('<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">'))


def rewrite_dog_tiles(soup, slug):
    if slug != "dog-age":
        return
    fieldset = soup.select_one("fieldset.opts")
    if not fieldset or fieldset.select_one(".opt-t"):
        return
    tiles = frag(
        '<fieldset class="opts"><legend>Adult size</legend>'
        '<label class="opt"><input type="radio" name="size" value="small"/>'
        '<span class="opt-t"><b>Small<span class="opt-c">:</span></b> <span class="opt-r"><span class="nw opt-kg">up to 9.5 kg</span> <span class="nw opt-lb">(20 lb)</span></span></span></label>'
        '<label class="opt"><input checked="checked" type="radio" name="size" value="medium"/>'
        '<span class="opt-t"><b>Medium<span class="opt-c">:</span></b> <span class="opt-r"><span class="nw opt-kg">9.5 to 23.1 kg</span> <span class="nw opt-lb">(21 to 50 lb)</span></span></span></label>'
        '<label class="opt"><input type="radio" name="size" value="large"/>'
        '<span class="opt-t"><b>Large<span class="opt-c">:</span></b> <span class="opt-r"><span class="nw opt-kg">23.1 to 40.8 kg</span> <span class="nw opt-lb">(51 to 90 lb)</span></span></span></label>'
        '<label class="opt"><input type="radio" name="size" value="giant"/>'
        '<span class="opt-t"><b>Giant<span class="opt-c">:</span></b> <span class="opt-r"><span class="nw opt-kg">over 40.8 kg</span> <span class="nw opt-lb">(over 90 lb)</span></span></span></label></fieldset>'
    )
    fs = tiles if getattr(tiles, "name", None) == "fieldset" else tiles.find("fieldset")
    if fs:
        fieldset.replace_with(fs)


def apply_ux(docs: Path, launch: bool = False) -> int:
    typograph_loaded_copy()
    docs = Path(docs)
    nav = nav_from_home(docs)
    n = 0
    for f in sorted(docs.glob("*.html")):
        slug = f.stem
        raw = f.read_text()
        # copy_fixes are for old preview wording. New markdown already has the
        # approved lines, so only apply a fix when the "before" string is still there.
        for page, before, after in COPY["copy_fixes"]:
            if page == slug and before in raw:
                raw = raw.replace(before, after)
        raw = re.sub(r"Ages (\d+)–(\d+)", r"Ages \1 to \2", raw)
        soup = BeautifulSoup(raw, "html.parser")
        strip_noise(soup, launch=launch)
        mast(soup, slug, nav)
        fix_skip(soup, slug)
        foot(soup)
        seo_and_pets(soup)
        cfg = P.get(slug)
        if cfg or slug == "widget":
            datefields(soup, (cfg or {}).get("label", {}))
            settings_block(soup, slug)
            parts_toggles(soup)
            opt_names(soup, slug)
            acts_block(soup, slug)
            rewrite_dog_tiles(soup, slug)
        ensure_viewport(soup)
        ensure_share_head(soup)
        if cfg:
            rule_line(soup)
            intro_into_calc(soup, cfg["intro"])
            related(soup, slug, nav)
            collapse(soup, cfg)
        for sc in soup.select("head script:not([type])"):
            if sc.string and "prefill-on" in sc.string:
                sc.string = sc.string.replace(
                    "if(/[?&](on|year)=/.test(q))",
                    "if(/[?&]year=/.test(q))document.documentElement.classList.add('prefill-year');if(/[?&](on|year)=/.test(q))",
                )
        for l in soup.select("link[rel=stylesheet]"):
            href = l.get("href") or ""
            if href.endswith("ux.css"):
                continue
            if href.endswith("styles.css") or href == "styles.css":
                l["href"] = "styles.css"
        if soup.head and not soup.select_one('link[href="ux.css"]'):
            soup.head.append(frag('<link rel="stylesheet" href="ux.css">'))
        if soup.head and not soup.select_one('link[href="share.css"]'):
            soup.head.append(frag('<link rel="stylesheet" href="share.css">'))
        if soup.head and not soup.select_one('link[href="card.css"]'):
            soup.head.append(frag('<link rel="stylesheet" href="card.css">'))
        if soup.head and not soup.select_one('link[href="unslop.css"]'):
            soup.head.append(frag('<link rel="stylesheet" href="unslop.css">'))
        if soup.head and not soup.select_one('link[href="apple.css"]'):
            soup.head.append(frag('<link rel="stylesheet" href="apple.css">'))
        app = soup.select_one('script[src^="app.js"], script[src="app.js"]')
        if app and not soup.select_one('script[src^="share.js"], script[src="share.js"]'):
            app.insert_after(frag('<script src="share.js" defer></script>'))
        elif soup.body and not soup.select_one('script[src^="share.js"], script[src="share.js"]') and soup.select_one("#leaf"):
            soup.body.append(frag('<script src="share.js" defer></script>'))
        ensure_js_flag(soup)
        ensure_noscript(soup)
        ensure_nav_menu(soup)
        f.write_text(str(soup))
        n += 1
    css = (HERE / "ux.css").read_text()
    leafh = HERE / "leafh.css"
    if leafh.exists():
        css += leafh.read_text()
    (docs / "ux.css").write_text(css)
    for name in ("card.css", "share.css", "share.js", "unslop.css", "apple.css"):
        src = HERE / name
        if src.is_file():
            shutil.copyfile(src, docs / name)
    brand = HERE.parent / "brand"
    for name in ("og-image.png", "apple-touch-icon.png"):
        src = brand / name
        if src.is_file():
            shutil.copyfile(src, docs / name)
    return n

WORKED_EXAMPLES = {
    "index": "Born on 14 March 1988, you were 37 years, 9 months and 18 days old on New Year's Day 2026.",
    "past": "At the London 2012 opening ceremony, on Friday 27 July 2012, someone born on 3 May 1990 was 22 years, 2 months and 24 days old.",
    "difference": "Sam, born 2 June 1990, is 3 years, 3 months and 18 days older than Alex, born 20 September 1993. That's 1,206 days.",
    "days-between-dates": "Bonfire Night to Christmas Day 2026 is 50 days. 36 of them are weekdays.",
    "chronological-age": "Born 4 July 2018 and tested on 16 November 2026, the child goes on the form as 8;4;12.",
    "dog-age": "At 10, a small dog is 56 on the chart and a giant breed is 78.",
    "cat-age": "A 12-year-old cat is 64 in human years, and counts as a senior.",
    "korean-age": "A baby born on 31 December 2025 was Korean age 2 the next morning, and still 0 in international age.",
    "birthday-countdown": "On Christmas Day 2026, a 14 February birthday was 51 days away. It fell on a Sunday.",
    "how-old-will-i-be": "Born on 9 October 1980? You're 69 at the start of 2050 and turn 70 on Sunday 9 October.",
    "what-year-was-i-born": "A newspaper in June 1990 calls someone 42. They were born in 1947 or 1948, depending on whether their birthday had come yet.",
}


def inject_empty_examples(docs: Path) -> None:
    """Add the approved worked-example line to each empty card, and an #empty-tpl for app.js."""
    typograph_loaded_copy()
    if str(HERE.parent) not in sys.path:
        sys.path.insert(0, str(HERE.parent))
    from build_copy import typograph
    docs = Path(docs)
    n = 0
    for slug, text in WORKED_EXAMPLES.items():
        path = docs / "index.html" if slug == "index" else docs / slug / "index.html"
        if not path.is_file():
            # Flat shells, before promotion.
            path = docs / f"{slug if slug != 'index' else 'index'}.html"
        if not path.is_file():
            continue
        soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
        leaf = soup.select_one("#leaf")
        if leaf is None:
            continue
        example = typograph(text)
        say = leaf.select_one(".es-say") or leaf.select_one(".ph-msg")
        empty_key = {
            "index": "age", "past": "past", "difference": "difference",
            "days-between-dates": "between", "chronological-age": "chrono",
            "dog-age": "dog", "cat-age": "cat", "korean-age": "korean",
            "birthday-countdown": "countdown", "what-year-was-i-born": "birthyear",
        }.get(slug)
        empty_msg = UI.get("empty", {}).get(empty_key) if empty_key else None
        if say is None and empty_msg:
            node = frag('<p class="ph-msg es-say"></p>').p
            node.append(empty_msg)
            # Keep existing first-paint chrome (e.g. the chronological slip); put the prompt first.
            if leaf.contents:
                leaf.contents[0].insert_before(node)
            else:
                leaf.append(node)
            say = node
        if say is not None:
            if empty_msg:
                say.clear()
                say.append(empty_msg)
            if say.has_attr("class") and "es-say" not in say.get("class", []):
                say["class"] = list(say.get("class", [])) + ["es-say"]
            elif not say.has_attr("class"):
                say["class"] = ["es-say"]
            eg = say.find_next_sibling("p", class_="es-eg")
            if eg is None:
                # insert immediately after the say/ph-msg paragraph
                node = frag(f'<p class="es-eg">{example}</p>').p
                say.insert_after(node)
            else:
                eg.clear()
                eg.append(example)
        # Template used by ph() so a later empty render keeps the example.
        tpl = soup.select_one("#empty-tpl")
        say_html = str(say) if say is not None else ""
        eg_el = leaf.select_one(".es-eg")
        eg_html = str(eg_el) if eg_el is not None else f'<p class="es-eg">{example}</p>'
        inner = say_html + eg_html
        if tpl is None and soup.body:
            soup.body.append(frag(f'<template id="empty-tpl">{inner}</template>'))
        elif tpl is not None:
            tpl.clear()
            # frag of inner children
            piece = frag(inner)
            for child in list(piece.contents):
                tpl.append(child)
        path.write_text(str(soup), encoding="utf-8")
        n += 1
    print(f"injected worked examples on {n} empty cards")



if __name__ == "__main__":
    docs = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/workspace/agecalculator/docs")
    n = apply_ux(docs)
    print("applied UX structure to", n, "pages in", docs)
