# agecalculator.com preview (not live)

A static, no-build preview of a new site for the root domain agecalculator.com, structured to the 16 November 2026 SEO spec. It is **not** the live site and must not be pointed at the live domain.

- Published (no custom domain): GitHub Pages from `main` `/docs`
- Intended production host: **Cloudflare Pages** (free). See `cutover/` — not applied.
- Pages are flat `docs/*.html` files so Cloudflare Pages can serve `/past` (no trailing slash). Canonicals and internal links have no trailing slash.
- On this GitHub Pages preview, extensionless paths 404; use `/past.html` (and so on) until cutover. `/past?year=` works on Cloudflare Pages at `/past?year=`.
- Every page has `<meta name="robots" content="noindex,nofollow">`
- `docs/robots.txt` disallows all crawlers (the live root robots.txt is a later, approved change)
- Unique pre-rendered title, meta description, self-canonical (`https://agecalculator.com/…`) and JSON-LD in the first HTML
- `/past/{year}` is not a set of pages; `past.html` reads `?year=` and pre-fills 1 January
- Date maths live in `docs/js/age.js` (29 February civil anniversary = 1 March in a common year; 31 January plus one month = last day of February)
- Unit tests (Node, no dependencies): `node tests/age.test.js`

Do not change live DNS, redirects or app.agecalculator.com from this repository. The ready-to-apply cutover pack is in `cutover/` and must not be applied until William says so.
