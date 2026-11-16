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

## Launch checklist (do not apply until William approves)

Do these in a reviewed launch commit and the cutover window, not on the preview. The preview stays noindex on GitHub Pages.

1. **Privacy “Last updated” date.** Fill `[PLACEHOLDER: date this policy is published]` in `privacy.md` and `docs/privacy.html`.
2. **Swap the hosting paragraph to Cloudflare Pages.** Use the exact after-text in `hosting.md` (“Launch-time privacy hosting sentence”). The preview’s GitHub Pages sentence must not ship on the live root.
3. **Test email.** Send a message to `hello@agecalculator.com` from a different account and confirm it arrives at `hurrellcapital@gmail.com`. `verify.sh` only checks Email Routing MX and SPF; the forward itself needs this test. Steps are in `redirects-and-dns.md` §6.
4. **Remove noindex, open `robots.txt`, take off the preview banner**, following `hosting.md` (tool pages indexable; `/widget` and `/embed` stay `noindex` only).
5. **M6 is a hard cutover gate** (also clears N4 and N5). In `docs/404.html`:
   - Remove the `document.write` `<base>` script.
   - Make every asset and nav URL root-relative: `/styles.css`, `/fonts/libre-franklin-var.woff2`, `/favicon.ico`, `/favicon.svg`, `/`, `/difference`, `/past`, and the other tool links (not `./` or `difference`).
   - Leave `#main` and `#all-tools` as bare fragments (no base).
   - Change the skip link label; “Skip to the calculator” is wrong on a page with no calculator (for example, “Skip to the page”).
6. After the apex is on Pages, run:
   - `cutover/verify.sh` (redirects, Email Routing DNS, and the 404 / asset checks below)
   - `LAUNCH=1 python3 tests/test_404_urls.py` (fails if `404.html` still has relative URLs, a `<base>`, or `document.write`)
   - `python3 cutover/verify-404-nojs.py` (Playwright, JavaScript off, against `https://agecalculator.com/past/1990`)
