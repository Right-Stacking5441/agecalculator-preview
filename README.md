# agecalculator.com preview (not live)

A static, no-build preview of a new site for the root domain agecalculator.com, structured to the 16 November 2026 SEO spec. It is **not** the live site and must not be pointed at the live domain.

- Published (no custom domain): GitHub Pages from `main` `/docs`
- Intended production host: **Cloudflare Pages** (free). See `cutover/` — not applied.
- Pages are flat `docs/*.html` files so Cloudflare Pages can serve `/past` (no trailing slash). Canonicals and internal links have no trailing slash.
- On this GitHub Pages preview, `past.html` is also served at `/past` (no trailing slash). `/past/` and other trailing-slash paths 404. `/past?year=` is the same page; the year only pre-fills the form.
- Every page has `<meta name="robots" content="noindex,nofollow">`
- `docs/robots.txt` disallows all crawlers (the live root robots.txt is a later, approved change)
- Unique pre-rendered title, meta description, self-canonical (`https://agecalculator.com/…`) and JSON-LD in the first HTML
- `/past/{year}` is not a set of pages; `past.html` reads `?year=` and pre-fills 1 January
- Design: torn desk-calendar leaf, self-hosted Libre Franklin, no adverts. Shared date module is `docs/dates.js` (designer SPEC §8). A completed month lands on the same date next month; if that date does not exist it rolls to the 1st of the next month, so 31 January plus one month is 1 March (in leap years and common years) and a 29 February birthday in a common year is counted on 1 March. This site does not use the last day of February. The rule is shown in a short line under the chronological-age tool, and in that page’s FAQ and the home FAQ where the copy mentions it. Worked examples: `cutover/date-rules.md`.
- `/past?year=` reads the year in JS to pre-fill the form. The static canonical and og:url stay `https://agecalculator.com/past` with no query string; no script rewrites them.
- Unit tests (Node, no dependencies): `node --test tests/age.test.js`

Do not change live DNS, redirects or app.agecalculator.com from this repository. The ready-to-apply cutover pack is in `cutover/` and must not be applied until William says so.
