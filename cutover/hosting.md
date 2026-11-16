# Hosting for the root

**Recommendation (HC CEO, 16 November 2026): GitHub Pages for the live root, and a redirect-only Netlify site for `app.agecalculator.com` 301s, on the existing dino.game Netlify account.**

This is option (c). The preview stays on GitHub Pages (`Right-Stacking5441/agecalculator-preview`, `main` `/docs`) and stays noindex. The live root should be a **new public production repo**, also published from `/docs`, with the custom domain attached only there. Do not attach `agecalculator.com` to this preview repo.

Netlify is **not** the live root. Putting the whole site on the dino.game Free team would share a 300-credit monthly cap with dino.game; when that cap is hit, **every** site on the team pauses. Using Netlify only for `app.` 301s keeps credit use small. Check credit use a week after launch. If `app.` traffic is heavy, move that redirect site to its own free Netlify account, with William's OK.

The redirect-only site lives in `netlify-app-redirects/` in this folder. Do not create the Netlify site or change DNS until William approves.

## Why directory indexes (trailing slashes)

GitHub Pages serves `docs/past/index.html` as `/past/` and 301s `/past` (no slash) to `/past/`. The build now uses that form throughout: canonicals, internal links, og:url, JSON-LD and sitemap entries all have a trailing slash (the homepage is `https://agecalculator.com/`). This is the opposite of the earlier “no trailing slash except `/`” SEO recommendation, which assumed Cloudflare Pages or Netlify slashless URLs. Flag that change for SEO Manager.

GitHub Pages cannot issue per-path 301s for `/how-old-am-i`, `/date-of-birth` or `/rodent-age-calculator.html`. Those are prebuilt stub pages with `rel=canonical` to `/`, an instant meta refresh (`content="0"`) and a visible link. They are **not** true 301s. They do not have noindex (SEO Manager, 16 November 2026). Do not also publish `slug.html` for directory pages: that file is served at slashless `/slug` and blocks the 301 to `/slug/`. The redirect map and the 16 November Ahrefs/GSC notes have no apex `/difference.html` (and similar) backlinks; the only real apex `.html` URL is `/rodent-age-calculator.html`.

## Launch-time robots (do not apply yet)

The preview keeps `<meta name="robots" content="noindex,nofollow">` on every page, and `docs/robots.txt` still disallows all crawlers. Do not change that until William says the root may be indexed.

At launch, in a reviewed commit on the **production** repo:

- **Tool pages are indexable.** Remove the noindex/nofollow meta from the calculators (home, `/past/`, `/difference/`, `/days-between-dates/`, `/chronological-age/`, `/birthday-countdown/`, `/how-old-will-i-be/`, `/korean-age/`, `/what-year-was-i-born/`, `/dog-age/`, `/cat-age/`) and from `/privacy/` and `/contact/` if SEO Manager agrees they should be indexed. `/contact/` belongs in the root sitemap. Open `robots.txt` to allow those URLs.
- **Year pages (`/past/1960/`–`/past/2026/`):** keep them. Titles are the plain form “Age in 1985”. All of them canonicalise to `https://agecalculator.com/past/` (and the same og:url / JSON-LD url). They stay **out of the sitemap**. At launch they must **not** be noindexed (only the preview’s site-wide noindex applies today). App. `/past/YYYY` 301s to `/past/YYYY/` in one hop; years outside 1960-2026 go to `/past/?year=`.
- **`/widget/` and `/embed/` stay noindex**, with `noindex` only (not `nofollow`), so the credit link still counts.
- Take the preview banner off every page.

## Sitemap (do not apply changes to live until launch)

`docs/sitemap.xml` lists indexable root pages only, with trailing slashes: the tool hubs, plus `/privacy/` and `/contact/`. It does not list `/widget/`, `/embed/`, stubs, or the 65 year pages.

## Privacy hosting wording (approved; already on the preview)

Legal Manager supplied the live wording on 16 November 2026. It is already in `copy-approved/privacy.md` and the built `docs/privacy/index.html`. There is no later “swap the hosting sentence” step for Cloudflare Pages or for Netlify-as-root. At launch, fill only `[PLACEHOLDER: date this policy is published]`.

The approved paragraphs are:

```
These pages are hosted on GitHub Pages, a service of GitHub, Inc. in the United States. According to [GitHub's documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), when a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes, whether or not the visitor is signed in to GitHub. We rely on our legitimate interest in keeping the site secure and available. GitHub handles this data under the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement), which does not give a fixed retention period. Transfers to the United States are covered by GitHub's certification under the EU-U.S. Data Privacy Framework and its UK Extension (the UK-US data bridge).

Old links on app.agecalculator.com are redirected to this site by Netlify, Inc., which acts as our processor. When you follow one of those links, Netlify logs your IP address and request details. According to [Netlify's Data Processing Agreement](https://www.netlify.com/pdf/netlify-dpa.pdf) (last updated 13 November 2026), its CDN traffic and access logs are kept online for 30 days and in archival storage for up to 13 months, and logs used to investigate security or abuse can be kept for up to 6 years. Transfers are covered by the EU-U.S. Data Privacy Framework or the European Commission's Standard Contractual Clauses and, for UK data, the UK International Data Transfer Addendum.
```

The preview itself remains on GitHub Pages until cutover; the Netlify paragraph describes the planned `app.` redirect host. Flag for Legal only if they want a further pass. The example of a year link in “Links with dates in them” was updated from `/past?year=1990` to `/past/1990/` to match the new URLs. There was no separate recipients or retention section; GitHub and Netlify are described in these two paragraphs only.

## After approval (not now)

1. Keep this repo noindex until the go-ahead to index.
2. Create a new public production GitHub repo, publish from `/docs`, add `docs/CNAME` with `agecalculator.com`, and attach the custom domain only there (verify the domain first).
3. Create the redirect-only Netlify site from `cutover/netlify-app-redirects/`, on the dino.game account, and attach only `app.agecalculator.com`.
4. When William says go: switch Namecheap to BasicDNS, enter the record table in `namecheap-plan.md`, wait for Let's Encrypt on GitHub Pages and on the Netlify `app.` alias, turn **Enforce HTTPS** on, confirm `www` 301s to the apex, test mail, then remove noindex / open `robots.txt` in a reviewed production commit (year pages included: no noindex, still off the sitemap), and fill the privacy date. Unknown apex paths must return a real HTTP 404 from `404.html`.
5. A week after launch: check Netlify credit use on the shared team. If the pool is running low, ask William before moving `app.` to its own free account.
6. Leave this GitHub Pages preview up as a fallback until you are sure.
