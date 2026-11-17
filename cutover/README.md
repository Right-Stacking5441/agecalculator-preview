# Cutover pack for agecalculator.com

**Do not apply this pack until William approves the launch.** Nothing here has been applied to live DNS, Cloudflare rules, or app.agecalculator.com.

Prepared 16 November 2026, Europe/London, from SEO Manager’s redirect map (`/workspace/marketing/seo/2026-11-16-agecalculator-redirect-map.csv`, 81 rows) and the noindex preview in this repo.

| File | What it is |
|---|---|
| `README.md` | This index |
| `hosting.md` | Recommended host (GitHub Pages, $0), why directory indexes, how the build is laid out |
| `redirects-and-dns.md` | Exact Cloudflare Redirect Rules and DNS changes, in order |
| `conflicts.md` | CSV rows that conflict with the host, the build, or current DNS |
| `verify.sh` | After-cutover checks (GitHub Pages apex, Vercel `app.` 301s, Namecheap mail DNS) |
| `verify_preview.py` | Local or hosted preview: no 404 on sitemap, year and stub URLs |
| `netlify-app-redirects/` | Source rule set for the `app.` 301s (same 303 rules as the Vercel project; Netlify is no longer the planned host) |
| `rollback.md` | How to undo the cutover |
| `date-rules.md` | Date maths rules and worked examples from the test suite |

The preview on GitHub Pages stays noindex. After approval, noindex and `robots.txt` `Disallow: /` must be removed in a separate, reviewed change before the apex is pointed at Pages.

## Launch checklist (do not apply until William approves)

Do these in a reviewed launch commit and the cutover window, not on the preview. The preview stays noindex on GitHub Pages.

1. **Privacy “Last updated” date.** Fill `[PLACEHOLDER: date this policy is published]` in `copy-approved/privacy.md` and `docs/privacy/index.html`.
2. **Privacy hosting wording** is in `copy-approved/privacy.md` (and the built `docs/privacy/index.html`): GitHub Pages is the root host. We don't receive or have access to these logs. GitHub handles this data as an independent controller under the GitHub General Privacy Statement, which explains its legal basis and does not give a fixed retention period. We chose GitHub Pages because of our legitimate interest in running a secure, reliable site (Article 6(1)(f)). Old `app.agecalculator.com` links are redirected to this site through Vercel Inc., which may record visitors' IP addresses in its server logs. According to [Vercel's Privacy Notice](https://vercel.com/legal/privacy-policy), Vercel collects end-user IP addresses, location derived from those addresses, and service-generated log files from traffic to and from customers' websites, and under that notice it acts as a controller for the personal information it processes. [Vercel's Data Processing Addendum](https://vercel.com/legal/dpa), under which Vercel acts as a processor, applies to Pro and Enterprise plans and does not apply to the Hobby plan. We use Vercel because of our legitimate interest in keeping old links working (Article 6(1)(f)). Vercel may process this data in the United States, protected by its certification under the EU-U.S. Data Privacy Framework and the UK Extension to that framework. Do not swap this for a Cloudflare or Netlify-as-root sentence, and do not claim that Vercel's DPA applies to the Hobby plan. The policy date is already set (17 November 2026). To hash a built launch tree, run this inside the tree folder (for example `/workspace/agecalculator-launch`): `find . -type f -printf '%P\n' | LC_ALL=C sort | xargs sha256sum | sha256sum`. Report that digest with the file count (`find . -type f | wc -l`).
3. **Test email.** Send a message to `hello@agecalculator.com` from a different account and confirm it arrives at `hurrellcapital@gmail.com`. `verify.sh` checks the MX/SPF once they have been copied from the Namecheap dashboard; the forward itself needs this test. Steps are in `namecheap-plan.md`.
4. **Remove noindex, open `robots.txt`, take off the preview banner**, following `hosting.md` (tool pages indexable; `/privacy/` and `/contact/` indexable like each other; `/widget/` and `/embed/` stay `noindex` only). Add `/contact/` is already in the root sitemap with the other indexable root pages.
5. **M6 is a hard cutover gate** (also clears N4 and N5). In `docs/404.html`:
   - Remove the `document.write` `<base>` script.
   - Make every asset and nav URL root-relative: `/styles.css`, `/fonts/libre-franklin-var.woff2`, `/favicon.ico`, `/favicon.svg`, `/`, `/difference/`, `/past/`, and the other tool links (not `./` or `difference`).
   - Leave `#main` and `#all-tools` as bare fragments (no base).
   - Change the skip link label; “Skip to the calculator” is wrong on a page with no calculator (for example, “Skip to the page”).
6. After the apex is on Pages, run:
   - `cutover/verify.sh` (redirects, Email Routing DNS, and the 404 / asset checks below)
   - `LAUNCH=1 python3 tests/test_404_urls.py` (fails if `404.html` still has relative URLs, a `<base>`, or `document.write`)
   - `LAUNCH=1 python3 tests/test_placeholders.py` (fails if any built HTML or approved copy still contains `[PLACEHOLDER` or `PLACEHOLDER:`)
   - `python3 cutover/verify-404-nojs.py` (Playwright, JavaScript off, against a nested path that should 404 (not `/past/1990/`, which is now a real page))

8. **A week after launch:** confirm the Vercel Hobby project is still serving the `app.` 301s. Vercel Hobby terms allow only personal or non-commercial use, and Vercel may disable or remove Hobby projects with or without notice. Flag this with William if the site should move to a Pro plan.

9. **Enforce HTTPS** on the production GitHub Pages settings once the certificate is issued.
10. **www 301s to the apex**, path preserved (`/difference/` stays `/difference/`).
11. **Unknown apex paths** return HTTP 404 from `docs/404.html` (confirm with `curl -o /dev/null -w '%{http_code}'` after cutover, and already on the hosted preview).
12. **Year pages at launch:** remove the preview noindex with the other tool pages (do not leave a year-specific noindex). Keep them out of the sitemap. They already canonicalise to `/past/`.
13. **Legacy stubs** keep the meta refresh `content="0"` and the canonical to `/`. Do not add noindex back.
