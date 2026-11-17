"""Apply the UX-pass HTML structure to docs/ (see SPEC.md §16 and §16.8).

Called from scripts/build_copy.py after copy is injected into the pre-UX
page shells, so a future markdown rebuild reproduces the same structure.
"""
from __future__ import annotations
import json, re, sys
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
            # Date sits in .on-date so first paint reserves the settings-line
            # width. A noscript rule hides it when JavaScript is off.
            lab.clear()
            lab.append("Age today")
            lab.append(frag(f'<span class="on-date">, <b>{today_short()}</b></span>'))
        if btn.has_attr("aria-label"):
            del btn["aria-label"]
        p.append(frag(icon("clock")))
        p.append(lab)
        if not future:
            p.append(frag("""<script>
(function(){
  var el=document.getElementById('on-label');
  if(!el || el.hidden || el.getAttribute('data-idle')) return;
  var M=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var W=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var n=new Date(), mon=M[n.getMonth()].slice(0,3);
  var dspan=el.querySelector('.on-date');
  if(!dspan){ dspan=document.createElement('span'); dspan.className='on-date'; el.appendChild(dspan); }
  dspan.innerHTML=', <b>'+W[n.getDay()].slice(0,3)+' '+n.getDate()+' '+mon+' '+n.getFullYear()+'</b>';
})();
</script>"""))
            if slug != "widget":
                p.append(frag(f' <span class="tzline">{UI["settings_zone"]} <span id="zone-now">Europe/London</span></span>'))
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
        pm["placeholder"] = UI["pet_months_placeholder"]
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
JS_FLAG = "<script>document.documentElement.classList.add('js');</script>"


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
    for sc in list(soup.find_all("script")):
        if sc.string and ("is-enhanced" in sc.string and "nav-menu-list" in sc.string or "details.nav-menu" in sc.string):
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
    return n


if __name__ == "__main__":
    docs = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/workspace/agecalculator/docs")
    n = apply_ux(docs)
    print("applied UX structure to", n, "pages in", docs)
