# Hosting for the root

**Recommendation (revised 17 November 2026): GitHub Pages for the live root, and a redirect-only Vercel Hobby project for `app.agecalculator.com` 301s.** HC CEO chose GitHub Pages for the apex on 16 November 2026. On 17 November 2026, HC CEO (speaking for William on Hurrell Capital work) moved the `app.` 301s from Netlify to a free Vercel Hobby project. Netlify is dropped.

This is option (c). The preview stays on GitHub Pages (`Right-Stacking5441/agecalculator-preview`, `main` `/docs`) and stays noindex. The live root should be a **new public production repo**, also published from `/docs`, with the custom domain attached only there. Do not attach `agecalculator.com` to this preview repo.

The redirect rules live in `netlify-app-redirects/` (the original 303-rule set) and in the private GitHub repo `Right-Stacking5441/agecalculator-app-redirects`, which has been pushed but **not** connected to Vercel. Import that repo in the Vercel dashboard when William is ready; do not attach `app.agecalculator.com` or change DNS until he approves.

**Flag:** Vercel's Terms of Service, Hobby Plan section (https://vercel.com/legal/terms, last updated 19 October 2026) say: "You shall only use the Services under a Hobby plan for your personal or non-commercial use." The same section says Vercel may disable or remove Hobby projects with or without notice. Agecalculator.com is a Hurrell Capital site; Hobby may be the wrong plan. Vercel's Data Processing Addendum (https://vercel.com/legal/dpa) applies to Pro and Enterprise plans, not Hobby.

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

Legal Manager supplied the GitHub Pages wording on 16 November 2026. The `app.` paragraph was rewritten on 17 November 2026 after the host for those redirects moved from Netlify to a Vercel Hobby project, and only from Vercel's published terms: the DPA applies to Pro and Enterprise, not Hobby, so the earlier "processor under its data processing agreement" sentence is not used. The text is in `copy-approved/privacy.md` and the built `docs/privacy/index.html`. There is no later "swap the hosting sentence" step for Cloudflare Pages or for Netlify-as-root. At launch, fill only `[PLACEHOLDER: date this policy is published]`. Flag the Hobby paragraph for Legal if they want a further pass.

The approved paragraphs are:

```
These pages are hosted on GitHub Pages, a service of GitHub, Inc. in the United States. According to [GitHub's documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), when a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes, whether or not the visitor is signed in to GitHub. We rely on our legitimate interest in keeping the site secure and available. GitHub handles this data under the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement), which does not give a fixed retention period. Transfers to the United States are covered by GitHub's certification under the EU-U.S. Data Privacy Framework and its UK Extension (the UK-US data bridge).

Old links on app.agecalculator.com are redirected to this site through Vercel Inc., which may record visitors' IP addresses in its server logs. According to [Vercel's Privacy Notice](https://vercel.com/legal/privacy-policy), Vercel collects end-user IP addresses, location derived from those addresses, and service-generated log files from traffic to and from customers' websites, and under that notice it acts as a controller for the personal information it processes. [Vercel's Data Processing Addendum](https://vercel.com/legal/dpa), under which Vercel acts as a processor, applies to Pro and Enterprise plans and does not apply to the Hobby plan. We use Vercel because of our legitimate interest in keeping old links working (Article 6(1)(f)). Vercel may process this data in the United States, protected by its certification under the EU-U.S. Data Privacy Framework and the UK Extension to that framework.
```

The preview itself remains on GitHub Pages until cutover; the Vercel paragraph describes the planned `app.` redirect host. Flag for Legal if they want a further pass, especially because the DPA does not apply to Hobby. The example of a year link in “Links with dates in them” was updated from `/past?year=1990` to `/past/1990/` to match the new URLs. There is no separate recipients or retention section; GitHub and Vercel are described in these two paragraphs only.

## After approval (not now)

1. Keep this repo noindex until the go-ahead to index.
2. Create a new public production GitHub repo, publish from `/docs`, add `docs/CNAME` with `agecalculator.com`, and attach the custom domain only there (verify the domain first).
3. Import `Right-Stacking5441/agecalculator-app-redirects` as a Vercel Hobby project in the dashboard (do not connect it from this machine), and attach only `app.agecalculator.com` when William says to. Flag the Hobby personal-or-non-commercial clause first.
4. When William says go: switch Namecheap to BasicDNS, enter the record table in `namecheap-plan.md`, wait for certificates on GitHub Pages and on the Vercel `app.` domain, turn **Enforce HTTPS** on for Pages, confirm `www` 301s to the apex, test mail, then remove noindex / open `robots.txt` in a reviewed production commit (year pages included: no noindex, still off the sitemap), and fill the privacy date. Unknown apex paths must return a real HTTP 404 from `404.html`.
5. A week after launch: confirm the Vercel Hobby project is still serving the `app.` 301s, and raise the Hobby commercial-use clause with William if the site should move to Pro.
6. Leave this GitHub Pages preview up as a fallback until you are sure.
