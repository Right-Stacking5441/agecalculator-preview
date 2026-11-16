"""UX pass build: take Developer's current pages (read-only repo), apply the UX-pass structure, write ux/site/.
   python build_ux.py   (needs bs4: /tmp/fvenv/bin/python)"""
import shutil, re, pathlib, subprocess, json
from bs4 import BeautifulSoup, NavigableString
from icons import icon
REPO = pathlib.Path('/workspace/agecalculator-ui-wip/ux/base/docs'); OUT = pathlib.Path(__file__).parent / 'site'
if OUT.exists(): shutil.rmtree(OUT)
shutil.copytree(REPO, OUT)

# Page settings. intro = ONE line under the H1 (15-40 words, uses the page's main phrase). DRAFT copy for Copywriter.
# All drafted copy lives in copy.json (hooks for Copywriter).
COPY = json.load(open(pathlib.Path(__file__).parent / 'copy.json'))
P, UI = COPY['pages'], COPY['ui']
NAV = [('./', 'Age calculator')]  # filled from the footer index below

def frag(html):
    return BeautifulSoup(html, 'html.parser')

def mast(soup, slug):
    old = soup.select_one('header.mast')
    if not old: return
    logo = old.select_one('.brand svg')
    cur = './' if slug == 'index' else slug
    items = ''.join(f'<li><a href="{h}"{" aria-current=\"page\"" if h == cur else ""}>{t}</a></li>' for h, t in NAV)
    new = frag(f'<header class="mast"><div class="wrap"><a class="brand" href="./">{logo}<span class="wm">agecalculator<span>.com</span></span></a>'
               f'<details class="nav-menu"><summary>{icon("menu")}<span>Calculators</span></summary><ul>{items}</ul></details></div></header>')
    old.replace_with(new)

def foot(soup):
    for s in soup.select('.foot-tools li span'): s.decompose()
    for t in soup.select('.foot-tools li'):
        for c in list(t.contents):
            if isinstance(c, NavigableString) and not c.strip(): c.extract()

def strip_noise(soup):
    for sel in ['.preview-banner', '.ad', 'aside.side', '.dateline', '.tools-link', '.crumbs', '.after-leaf', 'script[data-ux-drop]']:
        for e in soup.select(sel): e.decompose()

def datefields(soup, labels):
    for df in soup.select('[data-datefield]'):
        name = df['data-datefield']
        lab = df.select_one('.df-label')
        if lab and name in labels: lab.string = labels[name]
        parts = df.select_one('.parts')
        rb = df.select_one('.readback')
        if parts: parts['hidden'] = ''
        if parts and rb:
            foot = frag('<div class="df-foot"></div>').div
            rb.wrap(foot)
            parts['id'] = name + '-parts'
            parts.extract(); foot.insert_after(parts)

def toggle_html(ids, shared):
    return (f'<button type="button" class="textbtn parts-toggle{" shared" if shared else ""}" aria-expanded="false" aria-controls="{" ".join(ids)}" '
            f'aria-label="{UI["parts_toggle_aria"]}">{icon("boxes")}<span>{UI["parts_toggle"]}</span></button>')

def parts_toggles(soup):
    """One quiet toggle: in the field's footer on one-date pages, shared after the last date on two-date pages.
       Date boxes in the settings panel get none (they still open by themselves on a parse error)."""
    form = soup.select_one('.calc form')
    dfs = [d for d in form.select('[data-datefield]') if d.select_one('.parts')] if form else []
    if not dfs: return
    ids = [d.select_one('.parts')['id'] for d in dfs]
    if len(dfs) == 1:
        dfs[0].select_one('.df-foot').append(frag(toggle_html(ids, False)))
    else:
        last = dfs[-1].find_parent(class_='on-primary') or dfs[-1]
        last.insert_after(frag(f'<div class="parts-shared">{toggle_html(ids, True)}</div>'))

def settings_block(soup, slug):
    on = soup.select_one('.calc .on')
    if not on: return
    box = on.select_one('#on-box'); p = on.find('p', recursive=False)
    if slug == 'past':
        # The second date is a primary input on this page: always shown, no toggle text.
        del box['hidden']
        btn = p.select_one('#on-toggle'); btn['hidden'] = ''; btn.extract(); box.append(btn)
        lab = p.select_one('#on-label'); lab['hidden'] = ''; lab.extract(); box.append(lab)
        p.decompose(); on['class'] = ['on', 'on-primary']
        zp = box.select_one('.zone-pick')
        if zp:
            d = frag(f'<details class="opt-field tz"><summary>{icon("clock")}<span>{UI["time_zone"]}</span></summary><div class="opt-body"></div></details>').details
            zp.extract(); d.div.append(zp); soup.select_one('.result #live').insert_after(d)
        return
    if p:
        lab = p.select_one('#on-label'); btn = p.select_one('#on-toggle')
        future = lab.has_attr('data-idle')
        lab.extract(); btn.extract(); p.clear()
        if future:
            lab['data-idle'] = UI['settings_idle_future']; lab.string = UI['settings_idle_future']
            btn['data-label'] = UI['settings_button_future']; btn.string = UI['settings_button_future']
        else:
            btn['data-label'] = UI['settings_button']; btn.string = UI['settings_button']
        if btn.has_attr('aria-label'): del btn['aria-label']
        p.append(frag(icon('clock'))); p.append(lab)
        if not future:
            p.append(frag(f' <span class="tzline">{UI["settings_zone"]} <span id="zone-now">Europe/London</span></span>'))
        p.append(' '); p.append(btn)
    on['class'] = ['on', 'settings']
    on.extract()
    soup.select_one('.result #live').insert_after(on)

def opt_names(soup, slug):
    names = soup.select('.calc label.name.inline')
    if not names: return
    title = UI['add_names'] if len(names) > 1 else UI['add_name']
    d = frag(f'<details class="opt-field"><summary>{icon("plus")}<span>{title}</span></summary><div class="opt-body"></div></details>').details
    for n in names: d.div.append(n.extract())
    soup.select_one('.calc form').append(d)

def rule_line(soup):
    rl = soup.select_one('.result .rule-line')
    if not rl: return
    d = frag(f'<details class="note-d"><summary>{UI["months_note"]}</summary></details>').details
    rl.replace_with(d); d.append(rl)
    d.extract(); soup.select_one('.result #live').insert_after(d)

def seo_and_pets(soup):
    for j in soup.select('script[type="application/ld+json"]'):
        if '"BreadcrumbList"' in (j.string or ''): j.decompose()
    py, pm = soup.select_one('#pet-y'), soup.select_one('#pet-m')
    if py: py['placeholder'] = UI['pet_years_placeholder']
    if pm: pm['placeholder'] = UI['pet_months_placeholder']
    oq = soup.select_one('#on-q')  # /past looks back: a past example, not 2030
    if oq and soup.body.get('data-page') == 'past': oq['placeholder'] = 'e.g. 1 June 2010'

def intro_into_calc(soup, intro):
    i = soup.select_one('.band .intro'); calc = soup.select_one('.band .calc')
    if not i or not calc: return
    i.select_one('.lede').string = intro
    col = frag('<div class="entry-col"></div>').div
    form = calc.select_one('form')
    i.extract(); form.insert_before(col); col.append(i); col.append(form.extract())

def related(soup, slug):
    cont = soup.select_one('.content')
    if not cont: return
    for s in cont.select(':scope > section'):
        if s.h2 and s.h2.get_text().strip() == 'More calculators': s.decompose()
    # Homepage: Copywriter's home.md "More calculators" list, rendered once as this row. Tool pages: every other tool.
    links = [tuple(x) for x in COPY['related_home']] if slug == 'index' else [(h, t) for h, t in NAV if h != slug]
    items = ''.join(f'<li><a href="{h}">{t}</a></li>' for h, t in links)
    nav = frag(f'<nav class="related" aria-labelledby="rel-h"><h2 id="rel-h">More calculators</h2><ul>{items}</ul></nav>')
    cont.insert(0, nav)

def collapse(soup, cfg):
    cont = soup.select_one('.content')
    if not cont: return
    for s in cont.select(':scope > section'):
        if 'faq' in (s.get('class') or []):
            qs = s.select('.qa')
            out = f'<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">{cfg["faq"]}</h2>'
            for q in qs:
                dd = q.dd.decode_contents()
                out += f'<details class="qa"><summary><h3>{q.dt.decode_contents()}</h3>{icon("chev", "chev")}</summary><div class="qa-a">{dd}</div></details>'
            s.replace_with(frag(out + '</section>'))
            continue
        h2 = s.find('h2', recursive=False)
        title = h2.decode_contents() if h2 else cfg['howto']
        hid = (h2.get('id') if h2 else None)
        if h2: h2.extract()
        body = s.decode_contents()
        sid = s.get('id'); cls = ' '.join(c for c in (s.get('class') or []) if c != 'tight')
        d = f'<details class="topic{(" " + cls) if cls else ""}"{f" id=\"{sid}\"" if sid else ""}><summary><h2{f" id=\"{hid}\"" if hid else ""}>{title}</h2>{icon("chev", "chev")}</summary><div class="topic-body">{body}</div></details>'
        s.replace_with(frag(d))

# nav list from the homepage footer index (the repo's names)
home = BeautifulSoup((REPO / 'index.html').read_text(), 'html.parser')
for a in home.select('.foot-tools a'): NAV.append((a['href'], a.get_text().strip()))

for f in sorted(OUT.glob('*.html')):
    slug = f.stem
    raw = f.read_text()
    for page, before, after in COPY['copy_fixes']:
        if page == slug:
            assert before in raw, (slug, before[:40]); raw = raw.replace(before, after)
    raw = re.sub(r'Ages (\d+)–(\d+)', r'Ages \1 to \2', raw)  # no dashes in the UI (16.8)
    soup = BeautifulSoup(raw, 'html.parser')
    strip_noise(soup); mast(soup, slug); foot(soup); seo_and_pets(soup)
    cfg = P.get(slug)
    if cfg or slug == 'widget':
        datefields(soup, (cfg or {}).get('label', {}))
        settings_block(soup, slug)
        parts_toggles(soup)
        opt_names(soup, slug)
    if cfg:
        rule_line(soup)
        intro_into_calc(soup, cfg['intro'])
        related(soup, slug)
        collapse(soup, cfg)
    for sc in soup.select('head script:not([type])'):
        if 'prefill-on' in sc.string:
            sc.string = sc.string.replace("if(/[?&](on|year)=/.test(q))", "if(/[?&]year=/.test(q))document.documentElement.classList.add('prefill-year');if(/[?&](on|year)=/.test(q))")
    for l in soup.select('link[rel=stylesheet]'): l['href'] = 'styles.css'
    if not soup.select_one('link[href="ux.css"]') and soup.head:
        soup.head.append(frag('<link rel="stylesheet" href="ux.css">'))
    f.write_text(str(soup))
(OUT / 'ux.css').write_text((pathlib.Path(__file__).parent / 'ux.css').read_text() + ((pathlib.Path(__file__).parent / 'leafh.css').read_text() if (pathlib.Path(__file__).parent / 'leafh.css').exists() else ''))
print('built', len(list(OUT.glob('*.html'))), 'pages into', OUT)
