# Conflicts and gaps in the 81-row redirect map

> **Superseded for the live root.** HC CEO chose option (c) on 16 November 2026: the apex is GitHub Pages, and Netlify handles only `app.` 301s, with Namecheap BasicDNS and Namecheap free Email Forwarding. Follow `namecheap-plan.md` and `hosting.md`. This file is kept as earlier working notes and must not be applied as written.

None of these block the pack, but they should be read before anyone applies it.

## 1. `app` is not on Cloudflare today (Rules will not fire)

`app.agecalculator.com` is `A 34.111.179.208` (Google / Replit), not a Cloudflare anycast address. Single Redirects only run on **proxied** records. The map’s `app` rows cannot work until step 3 in `redirects-and-dns.md` orange-clouds `app`. The same is true of `http://app`.

## 2. `www` has no DNS

DoH for `www.agecalculator.com` is NXDOMAIN (A, AAAA, CNAME). Rows 76–77 (`https://www` and `http://www` → root) need the proxied CNAME in step 1. Until then, `https://www` fails TLS and does not 301.

## 3. Row 81 is a deletion, not a 301

`https://agecalculator.com/*` (current catch-all to `app`) is marked `REMOVE`. It is the existing Cloudflare 301 that sends every apex path, including `/robots.txt` and `/past`, to the app **homepage**. It must be deleted (step 2) or the new rules never win. `verify.sh` does not treat this row as a 301 to assert.

## 4. The map does not list `https://agecalculator.com/past/{year}`

It only lists `app /past/{year}` → `/past?year={year}`. After cutover, a request for `https://agecalculator.com/past/1990` would 404 if we only path-preserve. Rule 1 also matches the apex (and `www`) so that path is one hop to `/past?year=1990`. That is an intentional tightening, not a contradiction of the “for any year” requirement.

## 5. Rows 79–80 (“only if slug exists”)

`/how-old-am-i` and `/date-of-birth` are not in the build and will not be added. Rule 2 still 301s those paths to `/`, which is harmless and stops them ever becoming thin copies of the homepage.

## 6. Wildcard years are not limited to `YYYY`

Free-plan rules cannot use regex. Rule 1 maps any `/past/*` path, so `/past/foo` becomes `/past?year=foo`. The hub will not pre-fill an invalid year. This is slightly broader than “any year” (row 69) and is noted here rather than left implicit.

## 7. Cloudflare Pages’ own HTML redirects are 307s

If a trailing-slash or `.html` request reaches Pages, Pages may 307 to the slashless URL. The map wants 301. Rule 4 is there so `/difference/` is a 301 at the zone and never depends on that 307. Flag this if someone later disables Rule 4.

## 8. GitHub Pages (the current preview host) cannot serve the slashless URLs

This is why the live root should be Cloudflare Pages, not GitHub Pages. After flattening, the noindex preview at `https://right-stacking5441.github.io/agecalculator-preview/` still works as `/past.html`, but `/past` 404s there. That is expected and only affects the preview.

## 9. Bulk Redirects quotas are not relied on

The official Free allowance is 10,000 Bulk Redirect URLs, but some accounts were still capped at 20 as late as mid-2026. This pack uses four Single Redirects instead. Do not import 65 year rows into Bulk Redirects unless you have checked the account’s actual cap, and do not use Bulk Redirects for the year rule if you also have Rule 1 (double rules, risk of a chain).

## 10. Plain HTTP may be untestable from some networks

From the development box, `curl` to `http://agecalculator.com/` was intercepted by a Pingora proxy and returned 500, while a direct request to the zone’s Cloudflare A records showed the real 301. `verify.sh` uses `curl -sSI` as specified; if HTTP tests fail with 500 and `Server: Pingora`, re-run them from a network that can reach the origin, or with `--resolve` against the zone’s A records.

## 11. `http://app` will chain if only TLS is upgraded on Replit

Until `app` is proxied (conflict 1), Replit may 301 `http://app` to `https://app` and only then would a later rule send you to the root. That would be two hops, against row 75. Proxying `app` and using Rule 3 (both schemes in one rule) is what makes it one hop.

## Directory slug.html stubs (resolved)

An earlier preview build wrote `docs/past.html` (and the same for every directory page) as a stub. On GitHub Pages that file is served at slashless `/past`, so `/past` was a 200 stub instead of a 301 to `/past/`. Those `slug.html` files have been dropped. The redirect map has no apex `.html` rows. Ahrefs (16 November 2026 export) and the GSC notes show one real apex `.html` backlink, `http://agecalculator.com/rodent-age-calculator.html`, which is still a stub. There is no conflict that would require bringing `difference.html` or similar back.
