# Namecheap BasicDNS cutover plan for agecalculator.com

**Documents only. Do not apply this plan until William approves the launch in the HC CEO chat.** Nothing here has been applied to live DNS, the Namecheap registrar, Cloudflare, GitHub Pages custom-domain settings, Netlify sites, or any account. No accounts or paid services have been created, and no existing Netlify account (including the one that hosts dino.game) has been changed.

Prepared 16 November 2026, Europe/London, from the existing cutover pack in this folder, SEO Manager’s redirect map and root SEO spec (`/workspace/marketing/seo/2026-11-16-agecalculator-redirect-map.csv` and `2026-11-16-agecalculator-root-seo-spec.md`), live DNS and HTTP checks the same day, and current Namecheap and Netlify documentation (URLs in the sections below).

This plan replaces the earlier recommendation to keep the zone on Cloudflare and host the live root on Cloudflare Pages, and it also replaces the 16 November draft that would have put the apex on GitHub Pages with a separate Netlify site only for `app.` 301s. William, via HC CEO, said he is happy to change the DNS on Namecheap and cut out Cloudflare. HC CEO then proposed hosting the **whole** new site on Netlify, on the **same Netlify account as dino.game**, so that one host can issue real per-path 301s (including apex trailing-slash behaviour and `/past/{year}`). **No blocker was found that would stop that approach.** Risks that are not blockers are listed at the end, in particular the shared Free-plan credit limit with dino.game.

The live root is therefore planned on **one Netlify site**, with **Namecheap BasicDNS** and **Namecheap free email forwarding**. `agecalculator.com` is the primary domain; `www` is the automatic alternate; `app.agecalculator.com` is a domain alias on the same site, with host-based 301s in `netlify.toml`.

The noindex preview at `Right-Stacking5441/agecalculator-preview` stays a preview, still on GitHub Pages, until the launch commit. Do not attach the custom domain to it while it is still noindex. The `netlify.toml` committed in this repo is configuration only; it does not create a Netlify site.

---

## What needs William

None of the following is approved by this document.

- **His go-ahead**, in the chat with HC CEO (not an agent’s say-so), before any live DNS, nameserver, Netlify custom-domain, or indexing change.
- **The Namecheap login saved in the vault**, so the nameserver switch and records can be entered when he says go. Do not put passwords in chat.
- **Approval to use the existing Netlify account that already hosts dino.game** (HC CEO’s proposal) to add a new site for agecalculator.com, or to create a separate free Netlify account if he prefers the two sites not to share a credit pool. Do not add a site or change that account until he says so. No paid plan is required for the configuration in this document. See the credit-limit risk below: on a credit-based Free team, exhausting the monthly credits pauses **every** site on the team, including dino.game.
- **Approval to create a new public GitHub repository** for the live site (recommended name: `agecalculator`), separate from the noindex preview repo, which Netlify would then build or publish from. A private repository on a free GitHub account is also usable with Netlify, but a new public production repo is still the cleanest split from the preview. Do not attach `agecalculator.com` to the preview repo.
- **Anything paid:** nothing in this plan requires a paid product. Namecheap BasicDNS and free Email Forwarding are included with the domain. Netlify’s Free plan includes custom domains with SSL, and Let’s Encrypt certificates are provisioned automatically. Do not buy PremiumDNS, Private Email, a Cloudflare plan, a GitHub paid plan, or a Netlify paid plan for this cutover unless William later chooses to, for example to raise the credit limit.

The Cloudflare login (already to be saved in the vault) is still needed during the switch and for rollback, then can be left unused. The Replit app can stay up as a rollback origin; it is not hit once `app` DNS points at Netlify.

---

## Recommended option, in short

**One free Netlify site, publish directory `docs/`, primary domain `agecalculator.com`, with `www` and `app` as aliases on that same site.** `netlify.toml` (already in this repo) holds the `/rodent-age-calculator.html` host rules (listed first), the `app.` host-based 301s, the `/past/:year` → `/past?year=` rules, and the `/how-old-am-i` and `/date-of-birth` aliases. Trailing-slash normalisation is left to Netlify’s own behaviour for `*.html` files (see below), not to a slash-stripping redirect rule, which official docs say would loop. `www` → apex is Netlify’s automatic primary-domain redirect.

This is simpler than a second, app-only Netlify site, and it is what fixes the GitHub Pages gaps (apex `/past/{year}` 404s, trailing-slash 404s, and `/page.html` duplicates) as well as the `app.` 301s. Cost: $0, subject to the Free-plan credit limit. The `app.` 301s must stay in place for at least a year (SEO Manager: preferably for the life of the site).

Namecheap URL Redirect records remain unusable for `app.`: they have no SSL certificate for the source host, and browsers that have already visited `https://app.agecalculator.com` will refuse HTTP for two years. A Cloudflare Worker would keep Cloudflare, against William’s wish. GitHub Pages cannot do per-path 301s.

---

## Current DNS inventory

Looked up on Monday 16 November 2026, Europe/London, via Cloudflare and Google DNS-over-HTTPS (this box’s default resolver is not reliable; earlier cutover notes recorded a `198.18.0.1` intercept). HTTP checks used `curl --resolve` to the real addresses below.

| Name | Type | TTL | Value | Notes |
|---|---|---|---|---|
| `agecalculator.com` | NS | 86400 (Google DoH showed 21600) | `alexia.ns.cloudflare.com`, `christian.ns.cloudflare.com` | Zone is on Cloudflare. Registrar is Namecheap, with Custom DNS. |
| `agecalculator.com` | SOA | 1800 | `alexia.ns.cloudflare.com` / `dns.cloudflare.com`, serial 2420286063, minimum 1800 | |
| `agecalculator.com` | A | 300 | `172.67.150.9`, `104.21.79.236` | Cloudflare anycast (orange cloud). |
| `agecalculator.com` | AAAA | 300 | `2606:4700:3035::ac43:9609`, `2606:4700:3036::6815:4fec` | Cloudflare anycast. |
| `agecalculator.com` | MX | 300 | `21 route3.mx.cloudflare.net`, `53 route2.mx.cloudflare.net`, `82 route1.mx.cloudflare.net` | Cloudflare Email Routing (priorities vary by design). |
| `agecalculator.com` | TXT | 300 | `v=spf1 include:_spf.mx.cloudflare.net ~all` | Email Routing SPF. |
| `agecalculator.com` | CAA | — | none (NOERROR, empty) | No CAA record. Let’s Encrypt is not blocked. |
| `agecalculator.com` | DS / DNSKEY | — | none | DNSSEC is not on. No DS to remove at the registry before the NS switch. |
| `www.agecalculator.com` | A/AAAA/CNAME | — | **NXDOMAIN** | Matches `conflicts.md`. `https://www` cannot 301 until `www` has DNS. |
| `app.agecalculator.com` | A | 60 | `34.111.179.208` | Google / Replit, not Cloudflare-proxied. |
| `app.agecalculator.com` | TXT | 60 | `google-site-verification=uXbL8uBwZBT_ZicneBa3xcr-2JImqEhCoxEe4S_IH0E` | Keep a copy; do not put this on the apex unless GSC still needs it. |
| `app.agecalculator.com` | TXT | 60 | `replit-verify=4f9df0c0-7eb6-43a6-ab0e-0c825848eac9` | Replit verification. Not required once `app` leaves Replit. |
| `cf2024-1._domainkey.agecalculator.com` | TXT | 300 | Cloudflare Email Routing DKIM (`v=DKIM1; h=sha256; k=rsa; p=…`) | Do not copy this to Namecheap. It will be stale once mail leaves Cloudflare. |
| `_dmarc.agecalculator.com` | — | — | **NXDOMAIN** | No DMARC today. |
| Other probes (`hello`, `mail`, `ftp`, `_acme-challenge`, `autoconfig`, `autodiscover`, `cdn`, `api`, `staging`, `dev`, `www.app`, `origin`, `default._domainkey`) | — | — | **NXDOMAIN** | |

**HTTP, same day:**

- `https://agecalculator.com/` (via Cloudflare `104.21.79.236`) is still a Cloudflare **301** to `https://app.agecalculator.com/` (path discarded).
- `https://app.agecalculator.com/` and the paths `/past`, `/past/1990`, `/difference`, `/privacy`, `/robots.txt`, `/sitemap.xml`, `/how-old-am-i` all return **200** from Express behind `Google Frontend`.
- `app.` sends `strict-transport-security: max-age=63072000; includeSubDomains` (two years). That policy applies to `app.agecalculator.com` and hosts under it, not to the apex or `www`. Browsers that have already visited `https://app.` will use HTTPS only for `app.` until the policy expires.
- `http://app.agecalculator.com/` is a **301** to `https://app.agecalculator.com:443/` (port included in `Location`). `http://app.agecalculator.com/past/1990` is a **301** to `https://app.agecalculator.com:443/past/1990`. After cutover, HTTPS on `app.` must go to the HTTPS root in **one hop**. HTTP on `app.` will be **two hops** on Netlify (HTTP → HTTPS on `app.`, then the host rule to the HTTPS root).

**GitHub Pages preview, same day** (`https://right-stacking5441.github.io/agecalculator-preview/`): `/past` and `/difference` return **200** (extensionless URLs work). `/past.html` and `/difference.html` also return **200** (duplicates; no 301 to the slashless URL). `/past/` and `/difference/` return **404**, not a 301. Those GitHub Pages gaps are a reason for moving the live root to Netlify; they do not need to be fixed on the preview host.

---

## Free-plan limits, commercial use, HTTPS, and traffic fit

Verified 16 November 2026 against:

- [Credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- [Netlify Pricing](https://www.netlify.com/pricing/)
- [Self-Serve Subscription Agreement](https://www.netlify.com/pdf/self-serve-subscription-agreement.pdf/) (last updated 4 November 2026)
- [HTTPS / SSL](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)

**Current Free plan (credit-based, since 4 September 2025):**

- **300 credits per month**, a hard limit. The Free plan does not auto-recharge. Unused Free credits do not roll over.
- Published credit costs (same figures on the pricing page and in the credit-based pricing docs): production deploys **15 credits each**; bandwidth **20 credits per GB**; web requests **2 credits per 10,000** (the docs say this includes redirects and assets); compute **10 credits per GB-hour**. Deploy Previews and branch deploys are **0** credits. **1** concurrent build.
- The pricing page lists Free at **$0 forever**, audience **Individual**, and includes **“Add Custom domains with SSL”**.
- Official docs: accounts created **before 4 September 2025** may still be on a **Legacy** plan with different limits. The dino.game account’s billing page must be checked at cutover; this document does not assume which plan that team is on, because that has not been looked up (and looking it up would mean signing in, which this task does not do).

**What happens when the limit is hit:** yes, the site is paused. The credit docs say that when Free-plan credits run out, **all web projects on the team** pause and visitors see **“Site not available.”** The Self-Serve Subscription Agreement §4.1 says “Customer will not be charged for use on the Free Usage Tier, and Netlify may pause the affected Services if that use exceeds the capacity included in the Free Usage Tier.” §5.1 also says Netlify may suspend, disable, or remove a Free Usage Tier site at any time, and that the Free Usage Tier may run on shared infrastructure with no service-level commitments.

Because credits are **team-wide**, putting agecalculator.com on the same Free team as dino.game means a spike or a busy month of production deploys on either site can pause **both**. Twenty production deploys in a month would consume the entire 300-credit allowance (20 × 15) with nothing left for bandwidth or requests. This is a material shared-account risk, not a reason to reject the proposal, provided William accepts it or chooses a separate free account.

**Commercial use:** the Self-Serve Subscription Agreement §2.5 says the customer may not “resell, sublicense, or otherwise make the Services available to third parties as a standalone service, **except that Customer may use the Services to build, deploy, and host sites and applications for third parties.**” There is no official clause forbidding a commercial site we operate ourselves on the Free Usage Tier. The pricing page’s “Audience: Individual” label is noted for William; it is not, on its own, a documented ban. The Acceptable Use Policy still applies.

**Custom domains and free HTTPS:** the pricing page includes custom domains with SSL on Free. Official HTTPS docs: once a custom domain is assigned and DNS is correctly pointed at Netlify, Netlify provisions a **Let’s Encrypt** certificate automatically. There is no CAA record on the zone today, so issuance is not blocked. After the NS switch, do not add a CAA record that omits `letsencrypt.org`. Docs also say to wait up to a day for DNS and the certificate. HTTPS is then served on the custom domains; confirm after cutover that HTTP → HTTPS is a **301** (not 302/307) and that the path is kept.

**Does agecalculator traffic fit?** There are **no bandwidth or request-count figures** in the HC CEO or SEO Manager documents, so a fit cannot be asserted and none is invented. The only published traffic numbers found are search clicks and impressions, plus an Ahrefs organic-traffic figure of **0**:

- Google Search Console, 11 August–10 November 2026, agecalculator `app.` property: **58 clicks**, **43,588 impressions**, 0.13% CTR. `/past*` accounted for about 42,000 of those impressions. These are search clicks and impressions, not visits, pageviews, or bytes.
- The 14 November dino.game action-plan snapshot, same GSC window: **324 clicks**, **12,772 impressions**. Also not bandwidth.
- Ahrefs current organic keywords and traffic for the agecalculator property were **0** at the last recorded check.

If those search clicks were the whole story, 300 credits would be ample, but they are not a traffic census (bots, direct visits, assets per page, and dino.game’s own usage are all unknown). Watch the team’s credit dashboard after launch. Prefer Deploy Previews over repeated production deploys.

---

## (a) Hosting the whole site on one Netlify site

Verified 16 November 2026 against:

- [Configure external DNS for a custom domain](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/) (docs updated 28 October 2025)
- [Manage multiple domains](https://docs.netlify.com/manage/domains/manage-domains/manage-multiple-domains/)
- [Redirect options](https://docs.netlify.com/manage/routing/redirects/redirect-options/) (domain-level redirects and trailing-slash note)
- [Redirects and rewrites](https://docs.netlify.com/manage/routing/redirects/overview/)
- [File-based configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [HTTPS / SSL](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)
- [How to create an ALIAS record (Namecheap)](https://www.namecheap.com/support/knowledgebase/article.aspx/10128/2237/how-to-create-an-alias-record/) (updated 9 April 2025)

### Exact Namecheap records for Netlify external DNS

Official Netlify external-DNS docs:

- **Apex, recommended** if the DNS provider supports ALIAS, ANAME, or flattened CNAME: point `@` at **`apex-loadbalancer.netlify.com`**.
- **Apex, fallback** if the provider does not support those types: an A record on `@` to Netlify’s load-balancer IP **`75.2.60.5`**. That is the IP in the current official docs (the same address has been documented since March 2021; confirm it again in the Netlify UI at cutover, in case a High-Performance Edge load balancer is ever used — this site will not be on that product).
- **`www`:** a CNAME to **`<site-name>.netlify.app`**, using the exact hostname Netlify shows for the site.
- **`app` (domain alias):** the same kind of subdomain CNAME, to the same **`<site-name>.netlify.app`**.

**Namecheap BasicDNS supports ALIAS.** Official article: “It is possible to set up an ALIAS record on domains that are using our BasicDNS, FreeDNS or PremiumDNS.” Host `@`, value the target hostname. Default TTL is 5 minutes; only **1 minute or 5 minutes** can be selected. **Do not also set an A or AAAA on `@`:** the same article says to check there are no CNAME, URL Redirect, A or AAAA records for the same host, because they conflict with ALIAS. MX and TXT on `@` can coexist with ALIAS (that is the point of ALIAS versus CNAME).

So the apex record in the table below is **ALIAS `@` → `apex-loadbalancer.netlify.com`**, not the GitHub Pages A/AAAA set, and not both ALIAS and `75.2.60.5`. If ALIAS later fails to resolve, replace it with the fallback A record `75.2.60.5` only.

### Primary domain, `www` redirect, and Let’s Encrypt

When either the apex or `www` is assigned, Netlify **automatically adds both**. The one entered as the primary domain is kept; the other is redirected to it automatically:

- Apex as primary → `www` redirects to the apex.
- `www` as primary → the apex redirects to `www`.

Official docs: “If you're using external DNS, we strongly recommend setting the `www` subdomain (or another subdomain) as your primary domain. If you want to set an apex domain as your primary domain, we recommend using Netlify DNS.” The reason given in the external-DNS article is that an apex on external DNS is reached through the single load-balancer name or IP and does not get the same direct CDN DNS routing as a subdomain.

**This plan still sets `agecalculator.com` (the apex) as the primary domain**, because the SEO spec’s canonical host is the apex, not `www`. That is a documented trade-off, not a blocker: the official docs still allow the apex as primary. Do not follow the `www`-as-primary recommendation here, or the automatic redirect would send the apex to `www` and fight the canonicals.

Netlify does **not** automatically redirect other subdomains. `app.` is handled with domain-level redirects in `netlify.toml`. The alias **must be assigned to the site** (official caution: “For Netlify to redirect from a domain that is not the site’s main custom domain, the domain must be assigned to the site — probably as a domain alias or a branch subdomain”).

Let’s Encrypt: after the custom domains are assigned and the Namecheap records point at Netlify, the certificate is provisioned automatically for the apex and `www` together, and for `app` once that alias is assigned and its CNAME is in place. Wait until the certificate is issued before treating HTTP → HTTPS as complete. Confirm `server: Netlify` on each hostname.

### Publish directory

`netlify.toml` sets `[build] publish = "docs"`. There is no Netlify build command: the site is already built into `docs/` (same as the preview). Do not point Netlify at the repo root. The leftover `wrangler.toml` (Cloudflare Pages `pages_build_output_dir = "docs"`) is unused under this plan; leave it unless a later, approved cleanup removes it.

`scripts/build_copy.py` must not be required on Netlify’s builders. Continue to build locally (or in CI) and push the reviewed `docs/` tree.

### New production repo, not a rename of the preview

**Recommend a new public repository** (for example `Right-Stacking5441/agecalculator`) and attach the Netlify production site and custom domains only there.

Do **not** attach `agecalculator.com` (or `www` / `app`) to `agecalculator-preview`. The preview must stay noindex on GitHub Pages at `https://right-stacking5441.github.io/agecalculator-preview/` until launch.

Do **not** rename `agecalculator-preview` to be the live repo unless William prefers that. A rename would still leave a single repo doing two jobs, and the current preview URL would break.

At launch: copy or push the reviewed launch commit (noindex off, robots open, banner off, privacy date filled, M6 404 fixed, `netlify.toml` present) to the production repo. Keep the preview repo noindex. There is no `docs/CNAME` to maintain for Netlify (that file was a GitHub Pages requirement and must not be added to the preview).

### Why not a separate site only for `app.`

A second Netlify site that only 301s `app.` would work, and was the previous draft, but it does not fix apex `/past/{year}` or trailing-slash behaviour, and it uses a second project on the same credit pool. One site with `app` as a domain alias and host-based redirects is the simpler option that meets the SEO map. Official support for this pattern is the “Domain-level redirects” section, with `force` / `!` so existing files do not shadow the 301s.

---

## (b) Redirect rules

The rules live in `/workspace/agecalculator/netlify.toml` (repo root). They are not also copied to `docs/_redirects`, so `scripts/build_copy.py` cannot wipe them. Official processing order would have preferred `_redirects` first if both existed; one file is enough.

SEO Manager: every rule is a **single 301** to the final root URL, path kept, year URLs to `/past?year={year}`, keep the 301s for **at least 12 months**, preferably for the life of the site. No `www` → `app` → root chain, and no leftover root → `app` catch-all.

### `app.` (domain alias on the same site)

HTTP and HTTPS are listed separately, as official examples require if TLS is not already forced:

| from | to | status |
|---|---|---|
| `https://app.agecalculator.com/past/:year` (and the `http://` twin) | `https://agecalculator.com/past?year=:year` | 301, forced |
| `https://app.agecalculator.com/how-old-am-i` (and `http://`) | `https://agecalculator.com/` | 301, forced |
| `https://app.agecalculator.com/date-of-birth` (and `http://`) | `https://agecalculator.com/` | 301, forced |
| `https://app.agecalculator.com/*` (and `http://`) | `https://agecalculator.com/:splat` | 301, forced |

The year and alias rules are listed before the catch-all so `/past/1990` is one hop to `/past?year=1990`, not two.

### Apex (and `www`, once redirected to the apex)

| from | to | status |
|---|---|---|
| `/how-old-am-i` | `/` | 301, forced |
| `/date-of-birth` | `/` | 301, forced |
| `/past/:year` | `/past?year=:year` | 301, forced |

`www` → `https://agecalculator.com{path}` is **not** written as a rule. It is the automatic primary-domain redirect when the apex is primary. Confirm after cutover that the hop is a **301** and that the path is kept.

### `/rodent-age-calculator.html` (SEO Manager, 16 November 2026)

A university page links to `http://agecalculator.com/rodent-age-calculator.html`. Add a **301** to `https://agecalculator.com/` on the apex, `www` and `app.`, over both HTTP and HTTPS. These are full-URL host rules in `netlify.toml`, listed **before any generic rules**.

| from | to | status |
|---|---|---|
| `https://agecalculator.com/rodent-age-calculator.html` | `https://agecalculator.com/` | 301, forced |
| `http://agecalculator.com/rodent-age-calculator.html` | `https://agecalculator.com/` | 301, forced (likely inert — see below) |
| `https://www.agecalculator.com/rodent-age-calculator.html` | `https://agecalculator.com/` | 301, forced |
| `http://www.agecalculator.com/rodent-age-calculator.html` | `https://agecalculator.com/` | 301, forced (likely inert — see below) |
| `https://app.agecalculator.com/rodent-age-calculator.html` | `https://agecalculator.com/` | 301, forced |
| `http://app.agecalculator.com/rodent-age-calculator.html` | `https://agecalculator.com/` | 301, forced (likely inert — see below) |

**A single hop on HTTP is not possible on Netlify.** Official redirect docs still say “[http and https need separate rules if you don't force_ssl!](https://docs.netlify.com/manage/routing/redirects/redirect-options/)”, and the API documents a `force_ssl` site setting that “will force SSL on the site if SSL is enabled” ([Get started with the Netlify API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)). Current Netlify Support guidance is firmer than that comment: the automatic HTTP → HTTPS upgrade runs **first**, on the **same host**, with no other change to the URL, and only then are `_redirects` / `netlify.toml` rules evaluated. Staff have said `http://…` host rules “will never trigger” once that upgrade is in place, that “we intentionally redirect http → https before doing the domain redirect,” and that combining the scheme change with a host or path change into one hop “will never happen at Netlify” because the [HSTS preload](https://hstspreload.org/) requirement is “Redirect from HTTP to HTTPS on the same host, if you are listening on port 80.” Sources: [HTTP links not triggering netlify.toml redirect rules](https://answers.netlify.com/t/http-links-not-triggering-netliy-toml-redirect-rules/114952), [Eliminate multiple redirects for www. and https](https://answers.netlify.com/t/eliminate-multiple-redirects-for-www-and-https/4468), [How to group HTTPS and WWW redirects to one redirect?](https://answers.netlify.com/t/how-to-group-https-and-www-redirects-to-one-redirect/117170).

So the university’s `http://` link is **two hops**:

1. `http://agecalculator.com/rodent-age-calculator.html` → `https://agecalculator.com/rodent-age-calculator.html` (automatic, same host)
2. `https://agecalculator.com/rodent-age-calculator.html` → `https://agecalculator.com/` (our rule)

The same two-hop pattern applies to `http://www…/rodent-age-calculator.html` and `http://app…/rodent-age-calculator.html`. The three **HTTPS** URLs should be a **single** 301 to `https://agecalculator.com/`. The `http://` rules are still in `netlify.toml` (as official docs still show them, and as requested) but should be treated as inert once HTTPS is on. Confirm all six at the first deploy preview. If the automatic `www` → apex redirect were ever to run *before* the `https://www…/rodent-age-calculator.html` host rule, that HTTPS `www` URL would also become two hops; the host rule is listed first so that should not happen — verify it.

### Trailing-slash normalisation

**Do not add** a rule such as `/difference/` → `/difference`. Official redirect options: “You cannot use a redirect rule to add or remove a trailing slash.” CDN edge nodes normalise URLs before redirect rules, so those two paths are treated as the same, and a slash-stripping rule “will cause an infinite redirect.”

Instead, rely on file layout plus Pretty URLs:

- The site publishes flat files (`docs/difference.html`, `docs/past.html`, and so on), not `difference/index.html`.
- Netlify’s official Support Guide [How can I alter trailing slash behaviour in my URLs?](https://answers.netlify.com/t/support-guide-how-can-i-alter-trailing-slash-behaviour-in-my-urls-will-enabling-pretty-urls-help/31191) (last reviewed by Netlify Support, July 2025): with a file at `/blog.html`, “Navigating to `/blog/` will 301 redirect and serve `/blog`.” With Pretty URLs on, `/blog.html` also 301s to `/blog`. Turning Pretty URLs **off** is documented to serve the same content at both `/blog` and `/blog.html` (a duplicate). `netlify.toml` therefore sets `[build.processing.html] pretty_urls = true`, which overrides the UI.
- The post-processing overview’s example that Pretty URLs “rewrites `/about` to `/about/`” is the directory-style case (`about/index.html`). That is not this site’s layout.

**Confirm this on the first Netlify deploy preview**, before the NS switch: `/difference/` and `/past/` should 301 to the slashless URLs; `/difference.html` should 301 to `/difference`; `/difference` and `/past` should 200. If a future Netlify change inverts this, do not “fix” it with a slash-stripping `_redirects` rule.

`/past/:year` is a different path from `/past/` and is covered by the year rule above, so apex `/past/1990` should 301 to `/past?year=1990` rather than 404 (the GitHub Pages gap).

### M6 nested 404s

Netlify serves `docs/404.html` for paths that do not match a file or a redirect. After the M6 fix in the launch commit (root-relative asset and nav URLs, no `document.write` `<base>`), a nested path such as `/no-such/nested/path` should still render that page correctly. `verify-404-nojs.py` should be pointed at a path that **should** 404 (not `/past/1990`, which will now 301). Do not apply the M6 HTML fix on the noindex preview.

---

## (c) Email: Namecheap free forwarding for hello@

Today, Cloudflare Email Routing MX and SPF are already in the zone (see the inventory). The remaining cutover step in the old pack was to confirm the `hello@` → `hurrellcapital@gmail.com` rule and send a test. Under this plan, Routing is **replaced**, not kept. This section is unchanged in substance from the previous draft.

Official setup: [How to set up Free Email Forwarding](https://www.namecheap.com/support/knowledgebase/article.aspx/308/2214/how-to-set-up-free-email-forwarding/).

- Available only for domains **pointed at BasicDNS, PremiumDNS or FreeDNS** (not Custom DNS / Cloudflare).
- Domain List → Manage → **Advanced DNS** → Mail Settings → **Email Forwarding** → Save. “The MX records will be set automatically.”
- “The SPF record shown in the screenshot above is needed for free email forwarding to function, thus, it cannot be deleted.”
- Then **Domain** tab → Redirect Email → Add Forwarder: Alias `hello`, Forward to `hurrellcapital@gmail.com`.
- “Please allow about an hour for the newly created mailboxes to be completely set up.”
- “Delivery of test emails sent from the same email address that is set as Forwarded to will most likely fail. Thus, please use another email address when testing.”
- This is a virtual address only: you cannot send outgoing mail as `hello@agecalculator.com`. (Namecheap’s paid Private Email would, and it is **not** required here.)
- Up to 100 forwarders; do not combine this with Private Email or another mail service at the same time.

**Exact MX and SPF hostnames:** the official article does not print them in text (they appear in a screenshot and are applied automatically). Do **not** invent them in advance. After Mail Settings is set to Email Forwarding, copy the MX and SPF values from the Advanced DNS tab into `verify.sh` and into the live record table. Third-party write-ups often cite `eforward1.registrar-servers.com` (and `eforward2` / `eforward3`) or a newer `mailfeed.registrar-servers.com` / `mailfeed2.registrar-servers.com`, and an SPF include of `spf.efwd.registrar-servers.com`. Treat those as unverified until the dashboard shows them.

**Remove, do not copy, the Cloudflare mail records:**

- MX `route1` / `route2` / `route3.mx.cloudflare.net`
- TXT `v=spf1 include:_spf.mx.cloudflare.net ~all`
- TXT on `cf2024-1._domainkey` (Cloudflare DKIM)

There must be **one** SPF TXT record, not two (a second `v=spf1` is a permanent SPF error). ALIAS on `@` must be left in place when Email Forwarding adds MX and SPF.

**SPF, DKIM, DMARC and Gmail:**

- There is no `_dmarc` record today. Do not add a `p=reject` or `p=quarantine` policy as part of this cutover. Free forwarding does not give us DKIM for `agecalculator.com`, and a strict DMARC would make legitimate forwarded mail worse, not better.
- Forwarded mail often fails the original sender’s SPF unless the forwarder uses SRS. Namecheap’s [SRS article](https://www.namecheap.com/support/knowledgebase/article.aspx/10204/2214/email-forwarding-why-its-important-to-have-srs-configured) says their own forwarding servers “are properly configured to get your emails delivered.” Still, Gmail may place some forwarded messages in spam, especially when the *original* domain has a strict DMARC policy. That is a residual risk, not a reason to keep Cloudflare.
- After cutover, send a test to `hello@agecalculator.com` from an account that is **not** `hurrellcapital@gmail.com`, and confirm it arrives.

**No-downtime mail:** Cloudflare Email Routing should stay enabled until Namecheap forwarding has been created **and** a test message has arrived. Official docs say forwarding is for domains already pointed at BasicDNS, so assume the forwarder can only be created **after** the nameserver switch. During the NS cache window (up to 24 hours, see below), resolvers that still use Cloudflare will keep delivering to Routing. Resolvers that already use BasicDNS need the Namecheap forwarder to be in place. Add it immediately after the switch, allow up to an hour, then test. There may be a short gap for those early resolvers; that should be said plainly. Do not delete the Cloudflare zone or Routing until the test has passed and public DNS has shown Namecheap MX for a day.

---

## (d) Launch-check items

These stay in a reviewed launch commit and the cutover window, not as live-domain or indexing changes on the noindex preview. They follow the existing `README.md` checklist. The privacy hosting sentence on the preview has already been updated to name Netlify (see below); the “Last updated” date is still a placeholder.

1. **Privacy “Last updated” date.** Fill `[PLACEHOLDER: date this policy is published]` in `copy-approved/privacy.md` and `docs/privacy.html` on launch day.
2. **Hosting sentence — Netlify, for Legal Manager to review.** The preview now names Netlify as the host, using only wording taken from Netlify’s own documents. **Flag for Legal Manager before launch.** Sources (all fetched 16 November 2026, Europe/London):

   - [Netlify Privacy Statement](https://www.netlify.com/privacy/), last updated 4 November 2026. It applies when Netlify acts as a **controller**. It says it “does not apply to data we process as a service provider or data processor on behalf of our enterprise customers. Such data processing activities are governed by our Data Processing Agreement.” The DPA itself (opening paragraph) “forms part of the Enterprise Master Subscription Agreement **and the Self-Serve Subscription Agreement**, as applicable,” so processor terms are not limited to the Enterprise agreement. Legal should note that “enterprise customers” wording in the Privacy Statement.
   - [Netlify Data Processing Agreement](https://www.netlify.com/pdf/netlify-dpa.pdf), last updated **13 November 2026** (“Netlify_DPA_Nov 2026”). §2.1: Netlify processes Customer Data as a **Processor** on behalf of Customer. Exhibit I, data importer: **Netlify, Inc.**, 101 2nd Street, San Francisco, CA 94105. Categories of data subjects include “Customers’ own website visitors, where the website is hosted by Netlify.” Categories of personal data include “IP address” and “Device, browser, and request metadata (such as user agent, request headers, and timestamps) contained in request and function logs.” Purpose: “Netlify will Process Customer Data as necessary to perform the Services pursuant to the Agreement.” Duration (Exhibit I §8): “for the duration of the Agreement, unless otherwise agreed upon in writing.” **No more specific retention period for visitor request logs is stated**; that is why the public sentence leaves a bracket rather than inventing one.
   - Transfers, DPA §14: the parties anticipate processing **outside the EEA, Switzerland, and the UK**; Netlify is the importer, the customer the exporter. §14.2: Netlify has certified to the **EU-U.S. Data Privacy Framework** and the **Swiss-U.S. DPF** ([dataprivacyframework.gov](https://www.dataprivacyframework.gov/s)); transfers of data protected by the GDPR or Swiss law take place on that basis, with the **EU Standard Contractual Clauses** if those frameworks are invalid, suspended, or Netlify fails to re-certify. “Restricted Transfers of Customer Data protected by the UK GDPR will be subject to the provisions below” — §14.4 applies the **UK International Data Transfer Addendum (IDTA)** together with the EU SCCs.

   Current preview text:

   > These pages are hosted on Netlify. According to [Netlify's Data Processing Agreement](https://www.netlify.com/pdf/netlify-dpa.pdf) (last updated 13 November 2026), Netlify, Inc. processes personal data on behalf of the site operator when it hosts a website. That personal data may include the visitor's IP address and device, browser and request metadata (such as user agent, request headers and timestamps) in request and function logs. Netlify says it processes this data as necessary to perform its services. For transfers of this data from the EEA or Switzerland, Netlify relies on its certification under the EU-U.S. and Swiss-U.S. Data Privacy Frameworks, and on the EU Standard Contractual Clauses if those frameworks are not available; transfers protected by the UK GDPR are subject to the UK International Data Transfer Addendum. [The DPA does not state a specific retention period for visitor request logs, other than that Netlify processes customer data for the duration of its agreement with the site operator.]

   The HTML comment above that paragraph in `copy-approved/privacy.md` also flags this for Legal. The preview itself remains on GitHub Pages until cutover; the sentence describes the planned live host. Do not invent sub-processors, retention, or a transfer basis beyond the citations. Leave the old Cloudflare Pages “after” paragraph out of the live page.

3. **Test email**, as in (c), from a different account.
4. **Remove noindex, open `robots.txt`, take off the preview banner**, as in `hosting.md`: tool pages indexable; `/privacy` and `/contact` indexable like each other; `/widget` and `/embed` stay `noindex` only. Keep `/contact` in the root sitemap. Do this only in the production repo’s launch commit, not on the preview.
5. **M6 is still a hard cutover gate** (also clears N4 and N5). In `docs/404.html`: remove the `document.write` `<base>` script; make every asset and nav URL root-relative (`/styles.css`, `/fonts/…`, `/favicon.ico`, `/`, `/difference`, and so on, not `./` or `difference`); leave `#main` and `#all-tools` as bare fragments; fix the skip-link label on a page with no calculator.
6. **`LAUNCH=1` tests**, after the apex is on Netlify:

   - `LAUNCH=1 python3 tests/test_404_urls.py`
   - `LAUNCH=1 python3 tests/test_placeholders.py`
   - `python3 cutover/verify-404-nojs.py` against a nested path that should **404** (for example `https://agecalculator.com/no-such/nested/path`), **not** `/past/1990`, which should now 301
   - `cutover/verify.sh` once it has been updated (below)

### `verify.sh` updates (do not apply until the launch commit)

The script today still describes the Cloudflare Pages + Email Routing world, and the previous draft’s GitHub Pages expectations. Before using it on this cutover, change it to assert:

- Apex is an **ALIAS** (or flattened CNAME) to `apex-loadbalancer.netlify.com`, resolving through Netlify’s load balancer — not Cloudflare anycast, and not the GitHub Pages A/AAAA set. If the fallback A record was used instead, it must be **only** `75.2.60.5`. There must be no A/AAAA + ALIAS pair on `@`.
- NS are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`, not `alexia` / `christian`.
- MX and SPF are the Namecheap forwarding values copied from the dashboard, not `*.mx.cloudflare.net` / `_spf.mx.cloudflare.net`.
- `www` is a CNAME to `<site-name>.netlify.app`, and `https://www` / `http://www` **301** (one hop if possible) to the matching `https://agecalculator.com` path.
- `app` is a CNAME to the same `<site-name>.netlify.app`, and the `app` 301 table still holds (including `/past/1990` → `https://agecalculator.com/past?year=1990` in one hop, and `/difference` → `https://agecalculator.com/difference`).
- HTTP behaviour on Netlify is often **two hops**, because the automatic same-host HTTP → HTTPS upgrade runs before `_redirects` (see the rodent section). `verify.sh` now uses `check_301_two_hops` for those cases. Specifically:
  - `http://agecalculator.com/` and `http://agecalculator.com/difference` are still one hop (scheme only; the HTTPS URL is already canonical).
  - `http://agecalculator.com/past/1990` is two hops: first to `https://agecalculator.com/past/1990`, then to `https://agecalculator.com/past?year=1990`.
  - `http://www…` and `http://app…` are two hops: first to the same path on HTTPS, then to the HTTPS apex URL.
- HTTPS apex, `www` and `app` stay one hop where a host or path rule (or the automatic `www` → apex redirect) goes straight to the final URL. Response headers include `server: Netlify` on the apex, `www`, and `app` (on `app`, after the 301, also check the redirecting response).
- **`/rodent-age-calculator.html`, all 6 combinations** (http/https × apex/www/app), already added to `verify.sh`:
  - HTTPS: `curl -sSI` (no `-L`) must be **301** with `Location: https://agecalculator.com/`; then a separate request to that Location must be **200** with no further redirect.
  - HTTP: **two hops** — first 301 to `https://<same-host>/rodent-age-calculator.html`, second 301 to `https://agecalculator.com/`, then that URL is 200. Do not assert a single hop on HTTP.
- **Keep** (these are no longer expected to 404): trailing-slash 301s such as `/difference/` → `/difference`; `/difference.html` → `/difference`; apex `/past/1990` → `/past?year=1990`. Confirm them rather than dropping them. The M6 404 probe must **not** use `/past/1990`; use a true missing path such as `/no-such/nested/path`.
- There is **no** `_github-pages-challenge-*` TXT, and no GitHub Pages A/AAAA, in the live table.
- Keep the M6 404 / root-relative checks (against a true 404 path), and the placeholder check.

---

## Namecheap record table (exact, to enter on BasicDNS)

Namecheap BasicDNS nameservers, from [Using default nameservers vs hosting nameservers](https://www.namecheap.com/support/knowledgebase/article.aspx/9434/32/using-default-nameservers-vs-hosting-nameservers/):

- `dns1.registrar-servers.com`
- `dns2.registrar-servers.com`

Host `@` is the apex. Delete any default parking CNAME or URL Redirect Namecheap may add for `@` or `www` (commonly a `www` CNAME to `parkingpage.namecheap.com`). There must be no leftover Cloudflare A/AAAA/MX/SPF on this zone once it is authoritative. There must be no GitHub Pages A/AAAA and no `_github-pages-challenge-*` TXT.

| Type | Host | Value | TTL | Purpose |
|---|---|---|---|---|
| ALIAS | `@` | `apex-loadbalancer.netlify.com` | 5 min (Namecheap ALIAS allows only 1 or 5 min) | Netlify apex, recommended official target. Do not also add A/AAAA on `@`. |
| CNAME | `www` | `<site-name>.netlify.app` | 300 | www → the Netlify site; Netlify then 301s to the apex because the apex is primary |
| CNAME | `app` | `<site-name>.netlify.app` | 300 | app alias on the same site; use the exact host Netlify shows |
| MX | `@` | *(set automatically by Mail Settings → Email Forwarding)* | 300 (or Automatic) | Copy the hosts and priorities from the dashboard |
| TXT | `@` | *(SPF set automatically for Email Forwarding; do not delete)* | 300 (or Automatic) | Must be the only `v=spf1` record |

**Fallback only**, if ALIAS cannot be created or does not resolve (do not use together with the ALIAS row):

| Type | Host | Value | TTL | Purpose |
|---|---|---|---|---|
| A | `@` | `75.2.60.5` | 300 | Official Netlify load-balancer IP, current in the external-DNS docs |

Optional, not required for launch:

| Type | Host | Value | Notes |
|---|---|---|---|
| TXT | `@` or `app` | existing Google site verification, if Search Console still needs it | Only if GSC fails without it. Do not create a second SPF TXT. |
| TXT | `_dmarc` | — | Do not add a restrictive policy in this cutover. |

Do not add: Cloudflare MX/SPF/DKIM; Replit A for `app`; a URL Redirect for `app` or `@`; a wildcard `*`; GitHub Pages A/AAAA or a `_github-pages-challenge-*` TXT; CAA unless it explicitly allows `letsencrypt.org`; an A/AAAA on `@` alongside the ALIAS.

`<site-name>.netlify.app` is a placeholder until the Netlify site is created after William’s approval. Copy the hostname from the Netlify UI; do not invent it.

---

## TTL advice and the nameserver switch

Apex A/AAAA/MX/TXT are already **300 seconds**. `app` is already **60 seconds**. Those are low enough; no further lowering is required on the Cloudflare side for those records.

**NS TTL is 86400 seconds (24 hours)** in Cloudflare DoH (Google DoH showed 21600). That cannot be assumed to drop just because other records are at 300. After the nameserver switch, some resolvers may keep asking Cloudflare for up to a day (rarely longer). Leave the Cloudflare zone, Pages-unattached, with Email Routing still on, until public DNS has shown Namecheap NS and MX everywhere and mail has been tested. That overlap is what keeps mail alive.

**Switch at Namecheap:** Domain List → Manage → Nameservers, from **Custom DNS** (`alexia.ns.cloudflare.com`, `christian.ns.cloudflare.com`) to **BasicDNS** (Namecheap’s “default nameservers”: `dns1.registrar-servers.com`, `dns2.registrar-servers.com`). Official articles describe this as the way to use Advanced DNS, URL forwarding, and free Email Forwarding. Namecheap’s API docs also say those value-added services “will not work for domains using custom nameservers.”

**Can BasicDNS records be pre-entered before the switch?** Advanced DNS only *serves* records while the domain is on BasicDNS, PremiumDNS or FreeDNS. The URL-redirect article says that if you cannot edit host records, it may be because of third-party nameservers. **Treat pre-entry as something to try in the dashboard, not as a documented guarantee.** If the Advanced DNS tab is editable while still on Custom DNS, enter the whole table (and delete parking defaults) **before** flipping nameservers, so the zone is complete at the moment BasicDNS becomes authoritative. If the tab is locked, have the table in hand, switch to BasicDNS, and enter every record immediately, including Mail Settings → Email Forwarding and the `hello` forwarder.

Namecheap warns that host records are not copied automatically when moving between Custom DNS and BasicDNS. Do not expect the Cloudflare zone to appear in Advanced DNS on its own.

---

## Step order, with checkpoints

Do nothing in steps 6–12 without William’s go-ahead. Compared with the previous GitHub Pages draft, GitHub domain verification, `docs/CNAME`, Pages “Enforce HTTPS”, and a separate app-only Netlify site are gone. In their place: one Netlify site on the approved account, apex + `www` + `app` domains, ALIAS/CNAME records, Let’s Encrypt from Netlify, and trailing-slash / year-URL checks on the apex.

1. **Prepare, no live DNS.** Get William’s approval items above, including use of the dino.game Netlify account (or a separate free account) and a new production GitHub repo. Create the production repo (public, recommended) and, once approved, a new Netlify site on that account, linked to the production repo, publish directory `docs/`, no custom domain attached yet. Keep the preview repo noindex on GitHub Pages. Confirm on the Netlify billing page whether the team is credit-based Free or Legacy.
2. **Launch commit on the production repo only** (still not pointed at the apex): fill the privacy date; keep the Netlify privacy sentence once Legal has reviewed it; remove noindex, open `robots.txt`, remove the banner; add `/contact` to the sitemap if not already; fix M6 on `docs/404.html`; keep `netlify.toml` (publish `docs/`, Pretty URLs on, redirect rules above); update `verify.sh` as above. Run `LAUNCH=1` tests against the built tree.
3. **Add the custom domains on the Netlify site only** (not on the preview): set **`agecalculator.com` as the primary domain** (this auto-adds `www`). Add **`app.agecalculator.com` as a domain alias**. Do not make `www` primary. Copy the `<site-name>.netlify.app` hostname for the record table. Do not point public DNS yet.
4. **Checkpoint:** production site is reachable at `https://<site-name>.netlify.app` with launch content; deploy-preview or `curl` with the right `Host` header already shows `app` 301s, `/past/1990` → `/past?year=1990`, `/difference/` → `/difference`, `/how-old-am-i` → `/`, and `/rodent-age-calculator.html` on HTTPS apex/`www`/`app` as one 301 to `https://agecalculator.com/` (HTTP on that path is two hops). Trailing-slash and `.html` behaviour match the Support Guide. Cloudflare is still serving the live domain.
5. **William’s go-ahead.** Namecheap login in the vault.
6. **Enter the Namecheap table** if Advanced DNS is editable; otherwise do this in the same sitting as step 7. ALIAS `@` → `apex-loadbalancer.netlify.com` (or the fallback A, not both). CNAME `www` and `app` to `<site-name>.netlify.app`. Set Mail Settings to Email Forwarding and add `hello` → `hurrellcapital@gmail.com` as soon as BasicDNS will accept it.
7. **Switch nameservers** Custom DNS → BasicDNS. Delete parking records if they appeared. Confirm `@` has the ALIAS (or the single fallback A) plus the mail/TXT records, no GitHub or Cloudflare addresses, and that `www` and `app` CNAMEs are correct.
8. **Checkpoint — DNS.** `NS` begins to show `dns1` / `dns2.registrar-servers.com`. Apex ALIAS (or A `75.2.60.5`) is in public DNS. `www` and `app` CNAMEs match. MX/SPF match the dashboard. Wait for Netlify to issue the Let’s Encrypt certificates for the apex, `www`, and `app`.
9. **Checkpoint — HTTP.** Run the updated `verify.sh` from a network that is not intercepting plain HTTP. Confirm in particular: `https://agecalculator.com/` is **200** with `server: Netlify` (the old catch-all to `app` is gone because those Cloudflare rules are no longer authoritative); `https://app…/past/1990` is one 301 to `https://agecalculator.com/past?year=1990`; `https://app…/difference` is one 301 to `https://agecalculator.com/difference`; HTTPS `www` goes to the HTTPS root in one hop; HTTP `www` and HTTP `app` are two hops (scheme first, then the host rule); HTTP apex `/` is one hop to HTTPS `/`; `/difference/` 301s to `/difference`; `/past/1990` on the HTTPS apex 301s to `/past?year=1990`; all six `/rodent-age-calculator.html` combinations match the verify.sh rules (HTTPS one hop, HTTP two hops) to `https://agecalculator.com/`; 404s at nested paths still satisfy M6.
10. **Checkpoint — mail.** Wait up to an hour after the forwarder was created. Send a test to `hello@` from a third-party account. Confirm it arrives at `hurrellcapital@gmail.com`. Only then is it safe to stop relying on Cloudflare Email Routing.
11. **Search Console and aftercare** (SEO Manager’s list): confirm the Domain property for `agecalculator.com`; submit `https://agecalculator.com/sitemap.xml`; keep any existing `app.` property for a few months; do not delete Cloudflare or the Replit app on day one. Leave `app` 301s in place for at least a year. After a day or two of clean public DNS and mail, Cloudflare can be left as a rollback or removed in a later, approved step. Watch the Netlify credit dashboard, especially because it is shared with dino.game if the same team is used.

---

## Rollback

Until NS has fully left Cloudflare, switching Namecheap nameservers **back to Custom DNS** (`alexia.ns.cloudflare.com`, `christian.ns.cloudflare.com`) restores the pre-cutover zone: apex catch-all 301 to `app`, `app` A `34.111.179.208`, Email Routing MX/SPF, `www` NXDOMAIN. Keep that zone unchanged during the window so this is possible.

If NS has already propagated but the Cloudflare zone was left intact: the same nameserver flip still rolls DNS back; cached BasicDNS answers expire with their TTLs (300s for most records; 1 or 5 minutes for the ALIAS; up to 24 hours for NS).

If the live content is wrong but DNS is right: revert the production GitHub repo (Netlify will redeploy) or roll back the deploy in the Netlify UI. Do not delete the custom domains in Netlify while the apex still points at it, or HTTP will break and a certificate may be dropped.

If `app` 301s are wrong: point `app` back to `A 34.111.179.208` (Replit) as in `rollback.md`, or fix `netlify.toml` and redeploy.

If the Netlify site is paused because Free credits ran out: that also pauses other sites on the same team (including dino.game, if shared). Rollback of DNS to Cloudflare restores the old agecalculator origin; it does not, by itself, unpause dino.game. Raising the limit is a paid change and needs William.

Do not delete `agecalculator-preview`. Do not change the Namecheap *registration* (only nameservers and records). Do not edit the Replit app unless also rolling back an application change. Do not delete or reconfigure the dino.game Netlify site as part of this rollback.

---

## Open risks

- **HTTP is two hops on Netlify** whenever a further host or path change is needed, including the university link `http://agecalculator.com/rodent-age-calculator.html`. This cannot be collapsed to a single hop. HTTPS on that path should be one hop.
- **Shared Free-plan credits with dino.game.** On a credit-based Free team, exhausting the 300 monthly credits pauses **all** projects, visitors see “Site not available,” and there is no auto-recharge. Production deploys cost 15 credits each. Confirm whether the existing account is credit-based or Legacy before launch. This is the main residual risk, not a blocker, provided William accepts it or uses a separate free account.
- **Apex as primary on external DNS.** Netlify recommends `www` (or Netlify DNS) when the apex is primary, because the apex is reached through one load-balancer name or IP. SEO requires the apex as canonical, so this plan accepts that trade-off.
- **Trailing-slash 301s depend on Netlify’s file-layout behaviour and Pretty URLs**, not on a redirect rule. Confirm on a deploy preview before the NS switch. Do not add a slash-stripping rule if this ever changes; official docs say it will loop.
- **`app.` HSTS (two years)** makes Namecheap URL Redirect unusable; the Netlify alias and its CNAME must stay in place, with a valid certificate, or `https://app` breaks rather than silently falling back.
- **Nameserver TTL up to 24 hours**, and Namecheap email forwarding may only be creatable after the switch, with up to an hour before the mailbox is live. Mail is protected for resolvers still on Cloudflare; there may be a short gap for those that have already switched. Test before turning Routing off.
- **Forwarded mail to Gmail** can land in spam when the original sender’s DMARC is strict, even with Namecheap SPF/SRS. No outgoing mail as `hello@` on the free forwarder.
- **Cannot pre-enter BasicDNS records while on Custom DNS** may prove true in the dashboard; the switch then depends on entering the whole table immediately. Namecheap ALIAS cannot coexist with A/AAAA on `@`.
- **Let’s Encrypt issuance** can take up to a day after DNS is correct. A typo in the ALIAS or `www` / `app` CNAMEs can block issuance.
- **A new production repo and use of the existing Netlify account** need William’s approval; the preview repo must not receive the custom domain.
- **This environment’s HTTP proxy** can still make plain-HTTP tests look like 500s. Run `verify.sh` from a normal network, or with `--resolve` against the new answers.
- **No CAA and no DNSSEC today** is convenient for Let’s Encrypt and for the NS switch; do not add a restrictive CAA or turn on DNSSEC mid-window.
- **Privacy sentence** is drafted from the DPA and Privacy Statement and still needs Legal Manager review; the retention period for visitor request logs is bracketed because it is not specifically stated.
