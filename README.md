# agecalculator.com preview (not live)

A static, no-build preview of a new site for the root domain agecalculator.com, structured to the 16 November 2026 SEO spec. It is **not** the live site and must not be pointed at the live domain.

- Published (no custom domain): GitHub Pages from `main` `/docs`
- Every page has `<meta name="robots" content="noindex,nofollow">`
- `docs/robots.txt` disallows all crawlers (the live root robots.txt is a later, approved change)
- Unique pre-rendered title, meta description, self-canonical (https://agecalculator.com/…) and JSON-LD in the first HTML
- `/past/{year}` is not a set of pages; the `/past` hub reads `?year=` and pre-fills 1 January
- Date maths live in `docs/js/age.js` (29 February civil anniversary = 1 March in a common year; 31 January plus one month = last day of February)
- Unit tests (Node, no dependencies): `node tests/age.test.js`

Do not change live DNS, redirects or app.agecalculator.com from this repository.
