# agecalculator.com preview (not live)

A static preview of a new site for the root domain agecalculator.com, structured to the 16 November 2026 SEO spec, then adjusted for GitHub Pages directory URLs. It is **not** the live site and must not be pointed at the live domain.

- Published (no custom domain): GitHub Pages from `main` `/docs`
- Intended production host: **GitHub Pages** at the apex, with a **redirect-only Vercel Hobby project** for `app.agecalculator.com` 301s (private repo `Right-Stacking5441/agecalculator-app-redirects`, to be imported in the Vercel dashboard; not connected yet). See `cutover/namecheap-plan.md`. Nothing live has been applied. Flag: Vercel Hobby is for personal or non-commercial use only.
- Pages are directory indexes (`docs/past/index.html` is `/past/`). Canonicals, internal links, og:url, JSON-LD URLs and the sitemap use a trailing slash (the homepage stays `https://agecalculator.com/`).
- On this GitHub Pages preview, `/past` (no slash) 301s to `/past/`. There is no `/past.html` stub: a `slug.html` file next to a `slug/` directory makes GitHub Pages serve the file at `/slug` and blocks that 301. The only stubs are the true legacy URLs: `/how-old-am-i`, `/date-of-birth` and `/rodent-age-calculator.html` (canonical to `/`, meta refresh 0, no noindex).
- `/past/{year}/` is a static page for **1960-2026**. Titles are the plain form “Age in 1985”. Every year page canonicalises to `https://agecalculator.com/past/`, and none are in the sitemap. The hub `/past/` still honours `?year=` as a prefill. Years outside that range are not prebuilt; the app. 301 for e.g. `/past/2027` goes to `/past/?year=2027`.
- The default (preview) build has `<meta name="robots" content="noindex,nofollow">` on every real page, and `docs/robots.txt` disallows all crawlers. Stubs have no noindex.
- A `LAUNCH=1` build (do not deploy from this preview repo) drops the site-wide noindex, writes `robots.txt` with `Allow: /` and a Sitemap line, keeps `noindex` only on `/embed/` and `/widget/`, and removes the preview banner. The privacy "Last updated" placeholder is still required and is caught by `LAUNCH=1 python3 tests/test_placeholders.py`.
- Unique pre-rendered title, meta description, self-canonical (`https://agecalculator.com/…/`) and JSON-LD in the first HTML
- Design: torn desk-calendar leaf, self-hosted Libre Franklin, no adverts. Shared date module is `docs/dates.js`. A completed month lands on the same date next month; if that date does not exist it rolls to the 1st of the next month. Worked examples: `cutover/date-rules.md`.
- Unit tests (Node, no dependencies): `node --test tests/age.test.js`
- Copy check: `python3 tests/compare_copy.py`
- Local URL check (no 404s on sitemap, year and stub paths): `python3 cutover/verify_preview.py --docs docs`

Do not change live DNS, redirects or app.agecalculator.com from this repository. The ready-to-apply cutover pack is in `cutover/` and must not be applied until William says so.
