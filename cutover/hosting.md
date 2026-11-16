# Recommended hosting for the root

**Recommendation: Cloudflare Pages, on the existing Cloudflare zone, at $0 a month.**

The Free plan includes Pages (custom domain, 500 builds a month, HTTPS). The zone for agecalculator.com is already on Cloudflare (nameservers `alexia` and `christian`), so the apex can be attached as a Pages custom domain without a new registrar or a paid host. There is no monthly Pages fee on Free. Confirm the Hurrell Capital Cloudflare account’s plan in the dashboard before cutover; nothing here requires a paid upgrade if Single Redirects still allow at least four wildcard rules (Free allows 10 per zone).

## Why not GitHub Pages for the live root

The preview is on GitHub Pages (`Right-Stacking5441/agecalculator-preview`, `main` `/docs`) and should stay there as a noindex preview. It is the wrong host for the live root:

- A `docs/past/index.html` file is served as `/past/` with a trailing slash. The SEO map wants no trailing slash except `/`.
- This preview does serve `past.html` at `/past`, but `/past/` 404s, and GitHub Pages will not give the 301 trailing-slash behaviour the map wants. Prefer Cloudflare Pages for the live root.
- The zone already sits on Cloudflare. Putting the root on GitHub Pages would mean new DNS, a custom-domain setup, and a second place to hang 301s.

## How Cloudflare Pages gives clean, slashless URLs

Cloudflare Pages’ own serving rules (docs updated 11 November 2026):

- `past.html` is served at `/past` (no trailing slash).
- `/past.html` is redirected to `/past`.
- A folder `past/index.html` would be served at `/past/` (with a slash) — so this build does **not** use folders for HTML pages.

The preview build was flattened to match that: `docs/past.html`, `docs/difference.html`, and so on. Canonicals are already `https://agecalculator.com/past` (no slash). Internal links use relative, extensionless, slashless hrefs (`past`, `difference`, `./` for home). `/past?year=1990` is the path `/past` plus a query string; Pages passes the query through, and `docs/app.js` reads `?year=` and pre-fills 1 January. The static canonical stays `https://agecalculator.com/past` with no query string.

A `wrangler.toml` sits at the repo root with `pages_build_output_dir = "docs"`. Do not connect this project to the live apex until approval. `404.html` is present, so Pages will 404 unknown paths instead of falling back to the homepage (this matches the map’s “root 404s if no page”).

## Trailing-slash 301s should be zone rules, not Pages defaults

If a request for `/difference/` reaches Pages, Pages may 307 (temporary) to `/difference`. The map wants a **301**. The zone Redirect Rule in `redirects-and-dns.md` (trailing slash, except `/`) should run first so that hop is a 301 and never depends on Pages’ 307.



## Launch-time robots (do not apply yet)

The preview keeps `<meta name="robots" content="noindex,nofollow">` on every page, and `docs/robots.txt` still disallows all crawlers. Do not change that until William says the root may be indexed.

At launch, in a reviewed commit:

- **Tool pages are indexable.** Remove the noindex/nofollow meta from the calculators (home, `/past`, `/difference`, `/days-between-dates`, `/chronological-age`, `/birthday-countdown`, `/how-old-will-i-be`, `/korean-age`, `/what-year-was-i-born`, `/dog-age`, `/cat-age`) and from `/privacy` if SEO Manager agrees it should be indexed. Open `robots.txt` to allow those URLs (the live root robots.txt is a later, approved change).
- **`/widget` and `/embed` stay noindex**, with `noindex` only (not `nofollow`), so the credit link on those pages still counts. They are an iframe target and an instructions page, not landing pages.
- Take the preview banner off every page, including `/widget` (it already has no banner, so it would not appear inside a third-party embed).

## Launch-time privacy hosting sentence (do not apply yet)

The preview is still on GitHub Pages, so `privacy.md` and `docs/privacy.html` keep the GitHub hosting paragraph below. Do not swap it until the live root is on Cloudflare Pages. The publish-date placeholder stays until launch day, when it is filled in the same reviewed commit as this swap.

### Before (leave this on the preview)

```
These pages are hosted on GitHub Pages. According to [GitHub's own documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), when a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes, whether or not the visitor is signed in to GitHub.
```

### After (use this on the live root, once it is on Cloudflare Pages)

Drawn from Cloudflare's own wording. The Privacy Policy (effective 4 November 2025) says that when End Users access a customer's websites that use Cloudflare's services, "The information processed may include but is not limited to IP addresses, traffic routing data, system configuration information, and other information about traffic to and from Customers’ websites, devices, applications, and/or networks." Cloudflare's GDPR documentation says: "Cloudflare maintains log data about events on our network. Some of this log data will include information about visitors to and/or authorized users of a customer's domains, networks, websites, application programming interfaces ("APIs"), or applications… This metadata contains extremely limited personal data, most often in the form of IP addresses. We process this type of information on behalf of our customers in our data centers in the U.S. and Europe for a limited period of time." Sources: https://www.cloudflare.com/privacypolicy/ and https://www.cloudflare.com/trust-hub/gdpr/. Do not invent retention periods or purposes beyond that.

Replacement paragraph for `privacy.md` (typograph apostrophes the same way as the rest of the page when building the HTML):

```
These pages are hosted on Cloudflare Pages. According to [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/), when people visit a customer's website that uses Cloudflare's services, Cloudflare processes information about that visit that may include the visitor's IP address, traffic routing data, system configuration information, and other information about traffic to and from the site. Cloudflare's [GDPR documentation](https://www.cloudflare.com/trust-hub/gdpr/) says it maintains log data about events on its network, that some of this log data includes information about visitors to a customer's websites, most often in the form of IP addresses, and that it processes this information on behalf of its customers in data centers in the U.S. and Europe for a limited period of time.
```

At launch, in the same reviewed commit that attaches the apex and opens indexing: replace the GitHub paragraph in `privacy.md` and `docs/privacy.html` with the after paragraph, and fill `[PLACEHOLDER: date this policy is published]`. Leave the HTML comment `<!-- Hosting will switch to Cloudflare Pages at launch. -->` out of the live page once the swap is done.

## After approval (not now)

1. Keep this repo noindex until the go-ahead to index.
2. Create a Cloudflare Pages project from this repository, output directory `docs`, no production custom domain yet if you want a `*.pages.dev` dry run first.
3. When William says go: attach `agecalculator.com` as the production domain, apply the DNS, Redirect Rules, and Email Routing steps in `redirects-and-dns.md`, swap the privacy hosting paragraph to the Cloudflare Pages sentence in this file, fill the privacy publish date, then remove noindex / open `robots.txt` in a reviewed commit.
4. Leave the GitHub Pages preview up as a fallback until you are sure, or delete its Pages custom-domain settings (it has none today).
