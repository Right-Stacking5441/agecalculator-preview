# Namecheap BasicDNS cutover plan for agecalculator.com

**Documents only. Do not apply this plan until William approves the launch in the HC CEO chat.** Nothing here has been applied to live DNS, the Namecheap registrar, Cloudflare, GitHub Pages custom-domain settings, Netlify sites, or any account.

Prepared 16 November 2026, Europe/London, and revised the same day after HC CEO chose **option (c)**: the live root is **GitHub Pages**, and **Netlify handles only `app.agecalculator.com` path 301s**, on the existing dino.game Netlify account. Namecheap BasicDNS and Namecheap free Email Forwarding replace Cloudflare DNS and Cloudflare Email Routing.

This supersedes the earlier drafts that would have put the live root on Cloudflare Pages, or the whole site on Netlify.

The noindex preview at `Right-Stacking5441/agecalculator-preview` stays a preview, on GitHub Pages, until the launch commit. Do not attach the custom domain to it while it is still noindex.

---

## What needs William

None of the following is approved by this document.

- **His go-ahead**, in the chat with HC CEO, before any live DNS, nameserver, GitHub custom-domain, Netlify custom-domain, or indexing change.
- **The Namecheap login saved in the vault.** Do not put passwords in chat.
- **Approval to use the existing Netlify account that already hosts dino.game** to add a **redirect-only** site for `app.`, or a separate free Netlify account if he prefers the two sites not to share a credit pool. Do not add a site until he says so.
- **Approval to create a new public GitHub repository** for the live site (recommended name: `agecalculator`), separate from the noindex preview. GitHub Pages is free for a public repository.
- **Anything paid:** nothing in this plan requires a paid product. Do not buy PremiumDNS, Private Email, a Cloudflare plan, a GitHub paid plan, or a Netlify paid plan unless William later chooses to.

---

## Recommended option, in short

**GitHub Pages at `agecalculator.com` and `www`, plus one free Netlify site whose only job is to 301 `app.agecalculator.com` to the new trailing-slash root URLs.** The redirect rules are already in `netlify-app-redirects/`. They must stay in place for at least a year (SEO Manager: preferably for the life of the site).

The root build uses directory indexes (`docs/past/index.html` is `/past/`). GitHub Pages 301s `/past` to `/past/`. Legacy `/past.html`, `/how-old-am-i` and `/rodent-age-calculator.html` are stub pages (canonical, meta refresh, visible link), **not** true 301s. Flag that for SEO Manager.

Credits: the `app.` site will share the dino.game team's Free-plan pool (300 credits/month on a credit-based plan; accounts created before 4 September 2025 may still be Legacy). Redirects count as web requests. Check credit use a week after launch. If `app.` traffic is heavy, ask William before moving that site to its own free account. When Free credits run out, **all** projects on the team pause and visitors see “Site not available.” Sources: [Credit-based pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [Pricing](https://www.netlify.com/pricing/).

---

## Current DNS inventory

Looked up on Monday 16 November 2026, Europe/London, via Cloudflare and Google DNS-over-HTTPS.

| Name | Type | TTL | Value | Notes |
|---|---|---|---|---|
| `agecalculator.com` | NS | 86400 (Google DoH showed 21600) | `alexia.ns.cloudflare.com`, `christian.ns.cloudflare.com` | Zone is on Cloudflare. Registrar is Namecheap, with Custom DNS. |
| `agecalculator.com` | A | 300 | `172.67.150.9`, `104.21.79.236` | Cloudflare anycast. |
| `agecalculator.com` | AAAA | 300 | `2606:4700:3035::ac43:9609`, `2606:4700:3036::6815:4fec` | Cloudflare anycast. |
| `agecalculator.com` | MX | 300 | `route1` / `route2` / `route3.mx.cloudflare.net` | Cloudflare Email Routing. |
| `agecalculator.com` | TXT | 300 | `v=spf1 include:_spf.mx.cloudflare.net ~all` | Email Routing SPF. |
| `agecalculator.com` | CAA / DS / DNSKEY | — | none | Let's Encrypt is not blocked. DNSSEC is off. No DS to remove before the NS switch. |
| `www.agecalculator.com` | — | — | **NXDOMAIN** | `https://www` cannot 301 until `www` has DNS. |
| `app.agecalculator.com` | A | 60 | `34.111.179.208` | Replit / Google Frontend. HSTS `max-age=63072000; includeSubDomains` (two years). |
| `app.agecalculator.com` | TXT | 60 | Google site verification and Replit verification | Keep a copy of the Google token; drop Replit after the move. |
| `cf2024-1._domainkey` | TXT | 300 | Cloudflare DKIM | Do not copy to Namecheap. |
| `_dmarc` | — | — | **NXDOMAIN** | Do not add a restrictive policy in this cutover. |

**HTTP, same day:** `https://agecalculator.com/` is still a Cloudflare 301 to `https://app.agecalculator.com/` (path discarded). `http://app` 301s to HTTPS on `app.` (port sometimes included in `Location`). After cutover, HTTPS on `app.` must go to the HTTPS root in one hop; HTTP on `app.` will be two hops on Netlify (same-host HTTP→HTTPS first).

---

## (a) Hosting the apex on GitHub Pages

Verified against [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [Verifying your custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages), and [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

Apex A records, all four required:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

Apex AAAA records, all four required:

- `2606:50c0:8000::153`
- `2606:50c0:8001::153`
- `2606:50c0:8002::153`
- `2606:50c0:8003::153`

`www` CNAME must point at `right-stacking5441.github.io` (**no repository path**). If the custom domain is `agecalculator.com` and both apex and `www` records are in place, GitHub Pages automatically redirects `www` to the apex. Confirm that hop is a 301 and that the path is kept (`/difference/` stays `/difference/`).

Do **not** add a wildcard (`*.agecalculator.com`).

**TXT for GitHub domain verification**, in the account or organization Pages settings, **before** adding the custom domain and **before** pointing the apex at GitHub:

| Type | Host | Value |
|---|---|---|
| TXT | `_github-pages-challenge-right-stacking5441` | the token shown in the GitHub UI (do not invent it) |

**`docs/CNAME`** in the **production** repo only, one line: `agecalculator.com`. The preview has no `CNAME`, which is correct. `scripts/build_copy.py` must leave this file alone.

**New production repo**, published from `main` `/docs`. Do not set the custom domain on `agecalculator-preview`. Do not rename the preview repo unless William prefers that.

**Enforce HTTPS** on the production Pages settings after Let's Encrypt has been issued (can take up to 24 hours). Confirm HTTP → HTTPS is a 301.

---

## (b) Path-preserving 301s from `app.`, on Netlify only

A redirect-only site, publish directory `cutover/netlify-app-redirects/`, attached only to `app.agecalculator.com`. DNS: CNAME `app` to `<redirect-site>.netlify.app`. Let's Encrypt is provisioned automatically once DNS is correct.

Rules (host-based, HTTPS and HTTP, forced 301s; first match wins):

- `/rodent-age-calculator.html`, `/how-old-am-i`, `/date-of-birth` → `https://agecalculator.com/`
- `/past/1960` … `/past/2024` (and slash variants after normalisation) → `https://agecalculator.com/past/{year}/`
- `/past` → `https://agecalculator.com/past/`
- Any other `/past/{year}` (e.g. 2025) → `https://agecalculator.com/past/?year={year}`
- Known tool slugs (and their `.html` forms) → `https://agecalculator.com/{slug}/`
- Catch-all: `https://agecalculator.com/:splat`

A single hop on **HTTP** is not possible on Netlify: the automatic same-host HTTP→HTTPS upgrade runs first. HTTPS `app.` rules should be one hop. See the earlier sources in the 16 November Netlify notes (`redirect-options` and Netlify Support threads on HTTP→HTTPS).

Namecheap URL Redirect records remain unusable for `app.` because of the two-year HSTS policy and the lack of a certificate on the Namecheap redirect host.

---

## (c) Email: Namecheap free forwarding for hello@

Unchanged in substance. Official setup: [How to set up Free Email Forwarding](https://www.namecheap.com/support/knowledgebase/article.aspx/308/2214/how-to-set-up-free-email-forwarding/).

Available only when the domain is on BasicDNS, PremiumDNS or FreeDNS. Mail Settings → Email Forwarding sets MX and SPF automatically. Then add Alias `hello`, Forward to `hurrellcapital@gmail.com`. Allow about an hour. Test from an address that is **not** `hurrellcapital@gmail.com`. This is a virtual address only (no outgoing mail as `hello@`).

**Do not invent MX or SPF hostnames.** Copy them from the Advanced DNS tab after Email Forwarding is enabled. There must be one `v=spf1` TXT, not two. Remove, do not copy, Cloudflare MX, SPF and `cf2024-1._domainkey`. Do not add a restrictive `_dmarc` policy in this cutover.

**No-downtime mail:** leave Cloudflare Email Routing on until Namecheap forwarding has been created and a test message has arrived. The forwarder may only be creatable after the nameserver switch. During the NS cache window (up to 24 hours) resolvers still on Cloudflare keep using Routing; resolvers already on BasicDNS need the Namecheap forwarder immediately. Do not delete the Cloudflare zone or Routing until the test has passed and public DNS has shown Namecheap MX for a day.

---

## (d) Launch-check items

1. **Privacy “Last updated” date.** Fill the placeholder on launch day.
2. **Hosting wording — already approved, already on the preview.** Legal Manager's GitHub Pages + Netlify-processor paragraphs are in `copy-approved/privacy.md` and `docs/privacy/index.html`. Do not swap them. See `hosting.md` for the exact text and sources. The year-link example in “Links with dates in them” was changed from `/past?year=1990` to `/past/1990/`.
3. **Test email**, as in (c).
4. **Remove noindex, open `robots.txt`, take off the preview banner**, on the production repo only. `/widget/` and `/embed/` stay noindex (noindex only, not nofollow).
5. **M6** is still a hard cutover gate for `docs/404.html` (root-relative asset and nav URLs, no `document.write` `<base>`). Point `verify-404-nojs.py` at a path that should 404, **not** `/past/1990/`.
6. **`LAUNCH=1` tests** and `cutover/verify.sh` once DNS is live. The local preview check is `python3 cutover/verify_preview.py --docs docs` (already run: 180 passed, 0 failed) and, against the hosted preview, the same script with `--base https://right-stacking5441.github.io/agecalculator-preview`.
7. **A week after launch:** check Netlify credit use on the shared team.

### `verify.sh` (already updated for this plan; still describes the *after* state)

- Apex A/AAAA are the eight GitHub Pages addresses, not Cloudflare and not Netlify's `75.2.60.5`.
- NS are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`.
- MX and SPF are the Namecheap values copied from the dashboard (the current function still has the Cloudflare assertions until those values are known).
- `www` CNAME is `right-stacking5441.github.io`; HTTPS `www` 301s to the matching `https://agecalculator.com{path}`.
- `app` CNAME is `<redirect-site>.netlify.app`; HTTPS `app` 301s in one hop, including `/past/1990` → `/past/1990/` and `/rodent-age-calculator.html` → `/`. HTTP `app` is two hops.
- Path sweep: no 404 on sitemap URLs, year URLs or stubs, with and without a trailing slash.
- Stubs (`/past.html`, `/how-old-am-i/`, `/rodent-age-calculator.html`, …) are **200** with a canonical and meta refresh, not 301s.

---

## Namecheap record table (exact, to enter on BasicDNS)

Nameservers: `dns1.registrar-servers.com`, `dns2.registrar-servers.com`. Delete parking records Namecheap may add for `@` or `www`. No leftover Cloudflare A/AAAA/MX/SPF, and no Netlify ALIAS, once this zone is authoritative.

| Type | Host | Value | TTL | Purpose |
|---|---|---|---|---|
| A | `@` | `185.199.108.153` | 300 | GitHub Pages apex |
| A | `@` | `185.199.109.153` | 300 | GitHub Pages apex |
| A | `@` | `185.199.110.153` | 300 | GitHub Pages apex |
| A | `@` | `185.199.111.153` | 300 | GitHub Pages apex |
| AAAA | `@` | `2606:50c0:8000::153` | 300 | GitHub Pages apex |
| AAAA | `@` | `2606:50c0:8001::153` | 300 | GitHub Pages apex |
| AAAA | `@` | `2606:50c0:8002::153` | 300 | GitHub Pages apex |
| AAAA | `@` | `2606:50c0:8003::153` | 300 | GitHub Pages apex |
| CNAME | `www` | `right-stacking5441.github.io` | 300 | www → Pages (GitHub then 301s to the apex) |
| CNAME | `app` | `<redirect-site>.netlify.app` | 300 | app 301 site; copy the exact host from the Netlify UI |
| TXT | `_github-pages-challenge-right-stacking5441` | `<token from GitHub UI>` | 300 | Domain verification; confirm the label if the repo is under an organization |
| MX | `@` | *(set automatically by Email Forwarding)* | 300 or Automatic | Copy hosts and priorities from the dashboard |
| TXT | `@` | *(SPF set automatically; do not delete)* | 300 or Automatic | Must be the only `v=spf1` record |

Optional: keep the existing Google site-verification TXT if Search Console still needs it (do not create a second SPF). Do not add a restrictive `_dmarc`, a wildcard, a URL Redirect for `app` or `@`, Replit A for `app`, or a CAA that omits `letsencrypt.org`.

---

## TTL advice and the nameserver switch

Apex records are already TTL 300; `app` is 60. **NS TTL is up to 24 hours.** Leave the Cloudflare zone, with Email Routing still on, until public DNS shows Namecheap NS and MX and mail has been tested.

Switch at Namecheap: Domain List → Manage → Nameservers, Custom DNS → **BasicDNS**. Treat pre-entry of Advanced DNS records while still on Custom DNS as something to try, not a guarantee. If the tab is locked, switch and enter the whole table immediately, including Email Forwarding.

---

## Step order, with checkpoints

Do nothing in the live DNS steps without William's go-ahead.

1. **Prepare, no live DNS.** Approvals above. Create the production GitHub repo and, once approved, the redirect-only Netlify site from `netlify-app-redirects/`. Keep the preview noindex. Confirm whether the Netlify team is credit-based or Legacy.
2. **Launch commit on the production repo only:** fill the privacy date (keep the approved hosting paragraphs); remove noindex, open `robots.txt`, remove the banner; fix M6 on `docs/404.html`; add `docs/CNAME`; pin it so the build cannot delete it.
3. **Verify the domain on GitHub** (TXT). If Namecheap cannot yet hold that TXT, put it on Cloudflare first and recreate it on Namecheap at the switch.
4. **Add the custom domain** `agecalculator.com` on the **production** repo only. Add `app.agecalculator.com` as a domain alias on the Netlify redirect site only.
5. **Checkpoint:** production Pages URL and the Netlify `*.netlify.app` host (with `Host: app.agecalculator.com`) already behave. Cloudflare is still live.
6. **William's go-ahead.** Namecheap login in the vault.
7. **Enter the Namecheap table** (or in the same sitting as step 8). Set Email Forwarding and `hello` → `hurrellcapital@gmail.com` as soon as BasicDNS will accept it.
8. **Switch nameservers** Custom DNS → BasicDNS. Delete parking records. Confirm the eight GitHub addresses, `www` and `app` CNAMEs, verification TXT, and no Cloudflare leftovers.
9. **Checkpoint — DNS and HTTPS.** Wait for GitHub and Netlify certificates, then Enforce HTTPS on Pages.
10. **Checkpoint — HTTP.** Run `verify.sh` from a network that is not intercepting plain HTTP. Confirm the old apex catch-all to `app` is gone, `app` year URLs are one HTTPS hop, stubs are 200, `/past/` is 200, `/past` 301s to `/past/`, and nested 404s still satisfy M6.
11. **Checkpoint — mail.** Test `hello@` from a third-party account. Only then stop relying on Cloudflare Email Routing.
12. **Search Console and aftercare.** Domain property for `agecalculator.com`; submit `https://agecalculator.com/sitemap.xml`; keep any `app.` property for a few months; leave `app` 301s for at least a year; do not delete Cloudflare or Replit on day one.
13. **A week after launch:** check Netlify credit use on the shared team. If `app.` traffic is heavy, ask William before moving it to its own free account.

---

## Rollback

Until NS has fully left Cloudflare, switching Namecheap nameservers back to Custom DNS (`alexia.ns.cloudflare.com`, `christian.ns.cloudflare.com`) restores the pre-cutover zone. Keep that zone unchanged during the window.

If live content is wrong but DNS is right: revert the production GitHub repo. Do not delete `docs/CNAME` while the apex still points at GitHub.

If `app` 301s are wrong: point `app` back to `A 34.111.179.208` (Replit), or fix `netlify-app-redirects/` and redeploy.

If the Netlify site is paused because Free credits ran out, that also pauses dino.game on the same team. Rolling DNS back to Cloudflare restores the old agecalculator origin; it does not unpause dino.game. Raising the limit is a paid change and needs William.

Do not delete `agecalculator-preview`. Do not change the Namecheap registration (only nameservers and records). Do not reconfigure the dino.game site as part of this rollback.

---

## Flags for SEO Manager

- **Trailing-slash canonicals** are now the rule, because GitHub Pages directory indexes 301 `/page` to `/page/`. This is the opposite of SEO spec §1 (recommend no trailing slash except `/`).
- **Year pages 1960-2024** are real, unique-title, unique-canonical pages with a factual lede (weekday of 1 January, leap year or not), a prefilled tool, and a short note linking to `/past/`. They are **not** 65 hand-written articles. The SEO spec §1.4 said to consolidate year URLs, 301 them to `/past?year=`, and **not** put them in the sitemap. They are omitted from the sitemap for that reason. Please decide whether to keep them indexable, add them to the sitemap, or go back to a hub-only model.
- **Years outside 1960-2024** are not prebuilt. `app /past/2025` 301s to `/past/?year=2025`. The calculator accepts 1000-2999 as typed dates; that is not a published URL range.
- **Stubs are not 301s.** `/page.html`, `/how-old-am-i`, `/date-of-birth` and `/rodent-age-calculator.html` use `rel=canonical`, an instant meta refresh and a visible link.

---

## Open risks

- Shared Free-plan credits with dino.game (pause-all-sites if the cap is hit).
- GitHub Pages certificate / Enforce HTTPS can take up to 24 hours.
- Nameserver TTL up to 24 hours, and a possible short mail gap for resolvers that have already switched.
- Forwarded mail can land in Gmail's spam when the original sender's DMARC is strict.
- Two-year HSTS on `app.` makes a mistaken or early removal of the Netlify CNAME break `https://app`.
- Confirm after the preview is hosted that GitHub Pages still 301s `/past` to `/past/` when `past.html` (the stub) also exists. Local Python's `http.server` does.
- This environment's HTTP proxy can make plain-HTTP tests look like 500s. Run `verify.sh` from a normal network.
- No CAA and no DNSSEC today; do not add a restrictive CAA or turn on DNSSEC mid-window.
