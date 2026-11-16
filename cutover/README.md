# Cutover pack for agecalculator.com

**Do not apply this pack until William approves the launch.** Nothing here has been applied to live DNS, Cloudflare rules, or app.agecalculator.com.

Prepared 16 November 2026, Europe/London, from SEO Manager’s redirect map (`/workspace/marketing/seo/2026-11-16-agecalculator-redirect-map.csv`, 81 rows) and the noindex preview in this repo.

| File | What it is |
|---|---|
| `README.md` | This index |
| `hosting.md` | Recommended host (Cloudflare Pages, $0), why not GitHub Pages, how the build is laid out |
| `redirects-and-dns.md` | Exact Cloudflare Redirect Rules and DNS changes, in order |
| `conflicts.md` | CSV rows that conflict with the host, the build, or current DNS |
| `verify.sh` | `curl -sSI` checks: one 301 hop to the mapped target |
| `rollback.md` | How to undo the cutover |
| `date-rules.md` | Date maths rules and worked examples from the test suite |

The preview on GitHub Pages stays noindex. After approval, noindex and `robots.txt` `Disallow: /` must be removed in a separate, reviewed change before the apex is pointed at Pages.
