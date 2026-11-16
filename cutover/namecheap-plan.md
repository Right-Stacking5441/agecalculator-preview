# Namecheap BasicDNS cutover plan for agecalculator.com

**Documents only. Do not apply this plan until William approves the launch in the HC CEO chat.** Nothing here has been applied to live DNS, the Namecheap registrar, Cloudflare, GitHub Pages custom-domain settings, or any account. No accounts or paid services have been created.

Prepared 16 November 2026, Europe/London, from the existing cutover pack in this folder, SEO Manager’s redirect map and root SEO spec (`/workspace/marketing/seo/2026-11-16-agecalculator-redirect-map.csv` and `2026-11-16-agecalculator-root-seo-spec.md`), live DNS and HTTP checks the same day, and current GitHub, Namecheap and Netlify documentation (URLs in the sections below).

This plan replaces the earlier recommendation to keep the zone on Cloudflare and host the live root on Cloudflare Pages. William, via HC CEO, said he is happy to change the DNS on Namecheap and cut out Cloudflare. The live root is therefore planned on **GitHub Pages**, with **Namecheap BasicDNS**, **Namecheap free email forwarding**, and a **free Netlify (or Vercel) project only for `app.` 301s**.

The noindex preview at `Right-Stacking5441/agecalculator-preview` stays a preview until the launch commit. Do not point the apex at it while it is still noindex.

---

## What needs William

None of the following is approved by this document.

- **His go-ahead**, in the chat with HC CEO (not an agent’s say-so), before any live DNS, nameserver, GitHub custom-domain, or indexing change.
- **The Namecheap login saved in the vault**, so the nameserver switch and records can be entered when he says go. Do not put passwords in chat.
- **Approval to create a free Netlify account** (or a free Vercel account, if he prefers that) if he does not already have one, used only for `app.` 301s. No paid plan is required. Do not create the account until he says so.
- **Approval to create a new public GitHub repository** for the live site (recommended name: `agecalculator`), separate from the noindex preview repo. GitHub Pages is free for a public repository. A private repository would need a paid GitHub plan; do not do that unless he chooses it.
- **Anything paid:** nothing in this plan requires a paid product. Namecheap BasicDNS and free Email Forwarding are included with the domain. GitHub Pages (public), Netlify’s free HTTPS, and Let’s Encrypt certificates are free. Do not buy PremiumDNS, Private Email, a Cloudflare plan, or a GitHub paid plan for this cutover.

The Cloudflare login (already to be saved in the vault) is still needed during the switch and for rollback, then can be left unused. The Replit app can stay up as a rollback origin; it is not hit once `app` DNS points at Netlify.

---

## Recommended option for (b), in short

**A free Netlify site whose only job is to 301 `app.agecalculator.com` to `https://agecalculator.com{path}`, with a more specific rule for `/past/{year}`.** It must stay in place for at least a year (SEO Manager: preferably for the life of the site). Cost: $0. This is the only option that is a real path-preserving 301, serves HTTPS on `app.` (required because `app.` already has HSTS), and does not keep Cloudflare.

Namecheap URL Redirect records are not usable here: they have no SSL certificate for the source host, and browsers that have already visited `https://app.agecalculator.com` will refuse HTTP for two years. A Cloudflare Worker would keep Cloudflare, against William’s wish. A GitHub Pages meta-refresh or JavaScript fallback is not a 301.

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
- `http://app.agecalculator.com/` is a **301** to `https://app.agecalculator.com:443/` (port included in `Location`). `http://app.agecalculator.com/past/1990` is a **301** to `https://app.agecalculator.com:443/past/1990`. After cutover, HTTP and HTTPS on `app.` must go to the HTTPS root in **one hop**.

**GitHub Pages preview, same day** (`https://right-stacking5441.github.io/agecalculator-preview/`): `/past` and `/difference` return **200** (extensionless URLs work). `/past.html` and `/difference.html` also return **200** (duplicates; no 301 to the slashless URL). `/past/` and `/difference/` return **404**, not a 301. This updates an older note in `conflicts.md` that `/past` 404ed on the preview; the flattened build now serves the slashless path. Trailing-slash and `.html` 301s are still something GitHub Pages will not do.

---

## (a) Hosting the apex on GitHub Pages

Verified 16 November 2026 against [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [Verifying your custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages), and [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

### Exact GitHub Pages addresses (current docs)

Apex A records, all four required:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

Apex AAAA records, all four required (docs also recommend keeping the A records alongside them):

- `2606:50c0:8000::153`
- `2606:50c0:8001::153`
- `2606:50c0:8002::153`
- `2606:50c0:8003::153`

`www` CNAME must point at `right-stacking5441.github.io` (**no repository path**). Official docs: the CNAME “should always point to `USERNAME.github.io` or `ORGANIZATION.github.io`, excluding the repository name,” and must not point at the unique `*.pages.github.io` host shown in the Pages settings.

If the custom domain in the repository is set to `agecalculator.com`, and both the apex A/AAAA records and the `www` CNAME are in place, GitHub Pages automatically redirects `www` to the apex (and not the other way around). Confirm after cutover that this hop is a **301** and that the path is kept (`/difference` stays `/difference`). `verify.sh` should assert that.

**Do not add a wildcard (`*.agecalculator.com`).** GitHub’s docs warn that wildcard records allow subdomain takeovers even if the apex is verified.

### TXT for GitHub domain verification

Verification is done in the **account or organization Pages settings**, not in the repository. GitHub asks for a TXT record:

| Type | Host | Value |
|---|---|---|
| TXT | `_github-pages-challenge-right-stacking5441` | the token shown in the GitHub UI |

The host is `_github-pages-challenge-USERNAME.agecalculator.com` for a user account, or `_github-pages-challenge-ORGANIZATION` if the production repo is under an organization. Confirm the account type in the UI. **Do not invent the token.** Copy the value GitHub displays, and keep the TXT record in place after verification.

Official advice: verify the domain **before** adding it as a custom domain on a repository, and add the custom domain on the repository **before** pointing the apex A/AAAA records at GitHub, to avoid a takeover window.

There is no verification TXT today (those names are NXDOMAIN).

### The `CNAME` file in `/docs`

The preview publishes from `main` `/docs`. When a custom domain is saved on a branch-published Pages site, GitHub creates a `CNAME` file at the root of the publishing source — here, `docs/CNAME`. There is **no** `docs/CNAME` in the preview repo today, which is correct.

For the live root, that file must contain a single line:

```
agecalculator.com
```

Not `www.agecalculator.com` (that would make `www` the canonical host, against the SEO spec). If `scripts/build_copy.py` rewrites `docs/`, it must leave this file alone, or the next build will drop the custom domain. Pin `docs/CNAME` in the production repo and in the build so it is not deleted.

If the site were later published by a GitHub Actions workflow, official docs say the `CNAME` file is ignored; we are not using that.

### New production repo, not a rename of the preview

**Recommend a new public repository** (for example `Right-Stacking5441/agecalculator`), published from `main` `/docs`, and attach the custom domain only there.

Do **not** set `agecalculator.com` as the custom domain on `agecalculator-preview`. Once a custom domain is saved, the default `username.github.io/repo/` URL redirects to that domain, so the noindex preview would disappear as a separate URL and mixed preview/live deploys would be unsafe.

Do **not** rename `agecalculator-preview` to be the live repo unless William prefers that. A rename would still leave a single repo doing two jobs, and the current preview URL would break.

At launch: copy or push the reviewed launch commit (noindex off, robots open, banner off, privacy date filled, M6 404 fixed, `docs/CNAME` present) to the production repo. Keep the preview repo noindex.

### Custom domain and Enforce HTTPS

On the **production** repo only, after the verification TXT is in DNS:

1. Settings → Pages → Custom domain: `agecalculator.com` → Save (this creates or updates `docs/CNAME`).
2. Wait until GitHub can see the apex A/AAAA and `www` CNAME and has provisioned a Let’s Encrypt certificate (the docs say this can take a while; “Enforce HTTPS” can take up to 24 hours to become available). GitHub Pages uses Let’s Encrypt. There is no CAA record today, so issuance is not blocked. After the NS switch, do not add a CAA record that omits `letsencrypt.org`.
3. Tick **Enforce HTTPS**. Official docs: this “transparently redirect[s] all HTTP requests to HTTPS.” Confirm the status is **301** (not 302/307) in `verify.sh`.
4. Extra `A` / `AAAA` / `ALIAS` records on `@`, or a `www` CNAME that does not point at `right-stacking5441.github.io`, can stop the certificate from being issued. After the switch, `@` must be only the eight GitHub addresses, plus the MX/TXT/email records in the table below.

### GitHub Pages gaps versus the SEO map

These are inherent if the apex is on GitHub Pages and are no longer covered by Cloudflare Redirect Rules:

- `/difference/` and other trailing-slash URLs (except `/`) **404**, instead of a 301 to the slashless URL. SEO Manager wanted a 301.
- `/difference.html` returns **200** as well as `/difference`. Canonicals already use the slashless URL; it is still a duplicate, not a 301.
- `/past/1990` on the **apex** or **www** **404s**. The SEO map’s year-to-`?year=` rule is written for `app.`; the earlier Cloudflare pack also applied it to the apex and `www` as a tightening. After this plan, only `app.` year URLs get that 301 (via Netlify). Apex `/past?year=1990` itself is a 200.

Do not try to paper over those with a meta-refresh on `404.html`. If William later wants the apex trailing-slash and year 301s as well, the free Netlify (or Vercel) project can be expanded to host the whole site; that would be a separate, approved change, not this cutover.

---

## (b) Path-preserving 301s from `app.`

SEO Manager: every rule is a **single 301** to the final root URL, path kept, year URLs to `/past?year={year}` (or to `/past`, but not to `/`), keep the 301s for **at least 12 months**, preferably for the life of the site. No `www` → `app` → root chain, and no leftover root → `app` catch-all.

GitHub Pages cannot attach per-path 301s to `app.agecalculator.com`. Options, with verified facts:

### 1. Namecheap URL Redirect records — not usable

Official article: [How to set up a URL redirect for a domain](https://www.namecheap.com/support/knowledgebase/article.aspx/385/2237/how-do-i-set-up-a-url-redirect-for-a-domain) (page dated 1/20/2025).

- A **Permanent (301)** type exists (the default “Unmasked” type is a **302**; it would have to be changed).
- Path preservation: Namecheap’s own explanation (quoted in public discussions of that article) is that a destination **with** a trailing slash, such as `https://agecalculator.com/`, keeps the path; a destination **without** the slash drops it and sends every URL to the homepage. Query strings are reported to be kept. Even then, you cannot map `/past/1990` to `/past?year=1990` with these records; official text says that kind of specific-page redirect “only works on hosting.”
- **HTTPS on the source host is the deal-breaker.** Official: “redirecting from `https://domain1.tld` to `https://domain2.tld` will also require both domains to have SSL certificates installed.” A URL Redirect record only creates a hidden A record to Namecheap’s forwarding server; there is nowhere to install a certificate for `app.`. You can forward **HTTP** on your domain to an `https://` destination, but not serve HTTPS on `app.` itself.
- `app.` already has HSTS for two years (`max-age=63072000; includeSubDomains`). Browsers that have seen `https://app.agecalculator.com` will not fall back to HTTP. They will fail the certificate check and never see a redirect.

Reject this option for `app.`.

### 2. A free Netlify or Vercel project on `app.` — recommended (Netlify)

Both can do path-preserving **301s**, provision **free Let’s Encrypt** certificates on a custom domain, and stay at **$0**.

- Netlify: [HTTPS (SSL)](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/) (updated 3 October 2026) — “If you add a custom domain, we will automatically provision a certificate with Let’s Encrypt.” Redirects: [Redirect options](https://docs.netlify.com/manage/routing/redirects/redirect-options/) — default status is **301**; splats (`/*` → `/:splat`) are documented. External DNS: [Configure external DNS for a custom domain](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns) — for a subdomain, a **CNAME** whose host is `app` and whose value is the site’s `something.netlify.app` host.
- Vercel’s Hobby plan can do the same with `vercel.json` redirects and a CNAME to `cname.vercel-dns.com`. It is an equally free alternative if William already has a Vercel account.

**Recommend Netlify** unless William prefers Vercel: the `_redirects` file is explicit about 301 and splat order, and SSL is documented as free and automatic. Creating the account needs William’s approval. No paid plan, no card is required for this use.

Exact config, in a tiny public repo or a `app-redirects` folder, published as a Netlify site with no other pages (the `!` forces the redirect even if a file exists):

```
# More specific first: year URLs (row 69 of the map, including years not in the old sitemap)
/past/*  https://agecalculator.com/past?year=:splat  301!

# Optional aliases, same as the earlier pack’s Rule 2 (harmless if the slugs never existed on app.)
/how-old-am-i   https://agecalculator.com/  301!
/how-old-am-i/  https://agecalculator.com/  301!
/date-of-birth  https://agecalculator.com/  301!
/date-of-birth/ https://agecalculator.com/  301!

# Everything else, path preserved, including /, /difference, /privacy, /robots.txt, /sitemap.xml
/*  https://agecalculator.com/:splat  301!
```

Netlify preserves query strings on redirects by default; confirm with a test such as `/difference?x=1`. `/past/1990` must be **one** 301 to `https://agecalculator.com/past?year=1990`, not to `/past/1990`. `/past/` becomes `/past?year=` (empty); that is acceptable. HTTP and HTTPS on `app.` should both 301 in one hop once the certificate is issued (Netlify also serves HTTPS at the `*.netlify.app` URL immediately).

DNS, only after the Netlify site exists and the UI shows the exact target:

| Type | Host | Value |
|---|---|---|
| CNAME | `app` | `<site-name>.netlify.app` |

Use the hostname Netlify displays. Do not invent it. Do not leave the Replit A record `34.111.179.208` in place alongside the CNAME.

Keep this site (and the `app` CNAME) for at least a year.

### 3. A Cloudflare Worker — rejected for this plan

It would work, and the zone is already on Cloudflare, but it means keeping Cloudflare DNS or at least the Cloudflare proxy, which is what William wants to cut out. Do not use this unless he changes that decision.

### 4. GitHub Pages meta-refresh or JavaScript on `app.` — rejected

`app.` is not on GitHub Pages today, and a meta-refresh or `window.location` is not a 301. SEO Manager required a single 301.

---

## (c) Email: Namecheap free forwarding for hello@

Today, Cloudflare Email Routing MX and SPF are already in the zone (see the inventory). The remaining cutover step in the old pack was to confirm the `hello@` → `hurrellcapital@gmail.com` rule and send a test. Under this plan, Routing is **replaced**, not kept.

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

There must be **one** SPF TXT record, not two (a second `v=spf1` is a permanent SPF error).

**SPF, DKIM, DMARC and Gmail:**

- There is no `_dmarc` record today. Do not add a `p=reject` or `p=quarantine` policy as part of this cutover. Free forwarding does not give us DKIM for `agecalculator.com`, and a strict DMARC would make legitimate forwarded mail worse, not better.
- Forwarded mail often fails the original sender’s SPF unless the forwarder uses SRS. Namecheap’s [SRS article](https://www.namecheap.com/support/knowledgebase/article.aspx/10204/2214/email-forwarding-why-its-important-to-have-srs-configured) says their own forwarding servers “are properly configured to get your emails delivered.” Still, Gmail may place some forwarded messages in spam, especially when the *original* domain has a strict DMARC policy. That is a residual risk, not a reason to keep Cloudflare.
- After cutover, send a test to `hello@agecalculator.com` from an account that is **not** `hurrellcapital@gmail.com`, and confirm it arrives.

**No-downtime mail:** Cloudflare Email Routing should stay enabled until Namecheap forwarding has been created **and** a test message has arrived. Official docs say forwarding is for domains already pointed at BasicDNS, so assume the forwarder can only be created **after** the nameserver switch. During the NS cache window (up to 24 hours, see below), resolvers that still use Cloudflare will keep delivering to Routing. Resolvers that already use BasicDNS need the Namecheap forwarder to be in place. Add it immediately after the switch, allow up to an hour, then test. There may be a short gap for those early resolvers; that should be said plainly. Do not delete the Cloudflare zone or Routing until the test has passed and public DNS has shown Namecheap MX for a day.

---

## (d) Launch-check items

These stay in a reviewed launch commit and the cutover window, not on the noindex preview. They follow the existing `README.md` checklist, with the hosting sentence changed as below.

1. **Privacy “Last updated” date.** Fill `[PLACEHOLDER: date this policy is published]` in `copy-approved/privacy.md` and `docs/privacy.html` on launch day.
2. **Hosting sentence — keep GitHub Pages, do not swap to Cloudflare.** The preview already has the correct host. The old pack’s “after” paragraph for Cloudflare Pages must **not** ship. Current approved text, which already matches [GitHub’s own Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) (“When a GitHub Pages site is visited, the visitor’s IP address is logged and stored for security purposes, regardless of whether the visitor has signed into GitHub or not”):

   > These pages are hosted on GitHub Pages. According to [GitHub's own documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), when a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes, whether or not the visitor is signed in to GitHub.

   No new legal wording is proposed. **Flag for Legal** only if they want this paragraph revisited before launch; do not invent retention periods or purposes beyond GitHub’s sentence. Leave the HTML comment about switching to Cloudflare Pages out of the live page.
3. **Test email**, as in (c), from a different account.
4. **Remove noindex, open `robots.txt`, take off the preview banner**, as in `hosting.md`: tool pages indexable; `/privacy` and `/contact` indexable like each other; `/widget` and `/embed` stay `noindex` only. Keep `/contact` in the root sitemap. Do this only in the production repo’s launch commit, not on the preview.
5. **M6 is still a hard cutover gate** (also clears N4 and N5). In `docs/404.html`: remove the `document.write` `<base>` script; make every asset and nav URL root-relative (`/styles.css`, `/fonts/…`, `/favicon.ico`, `/`, `/difference`, and so on, not `./` or `difference`); leave `#main` and `#all-tools` as bare fragments; fix the skip-link label on a page with no calculator.
6. **`LAUNCH=1` tests**, after the apex is on Pages:

   - `LAUNCH=1 python3 tests/test_404_urls.py`
   - `LAUNCH=1 python3 tests/test_placeholders.py`
   - `python3 cutover/verify-404-nojs.py` against `https://agecalculator.com/past/1990` (this path will **404** on GitHub Pages; the script must be pointed at a nested path that should 404, which this still is, or updated if the check assumed a year 301 on the apex)
   - `cutover/verify.sh` once it has been updated (below)

### `verify.sh` updates (do not apply until the launch commit)

The script today still describes the Cloudflare Pages + Email Routing world. Before using it on this cutover, change it to assert:

- Apex A/AAAA are the eight GitHub Pages addresses, not Cloudflare anycast.
- NS are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`, not `alexia` / `christian`.
- MX and SPF are the Namecheap forwarding values copied from the dashboard, not `*.mx.cloudflare.net` / `_spf.mx.cloudflare.net`.
- `www` is a CNAME to `right-stacking5441.github.io`, and `https://www` / `http://www` 301 (one hop if possible) to the matching `https://agecalculator.com` path.
- `app` is a CNAME to the Netlify host, and the `app` 301 table in the current script still holds (including `/past/1990` → `/past?year=1990` in one hop).
- HTTP apex 301s to HTTPS apex (Enforce HTTPS), path kept.
- Trailing-slash and apex `/past/1990` checks that expected a 301 must be **rewritten or dropped**: those will 404 on GitHub Pages. Do not leave them as false failures, and do not pretend they 301.
- Keep the M6 404 / root-relative checks, and the placeholder check.

---

## Namecheap record table (exact, to enter on BasicDNS)

Namecheap BasicDNS nameservers, from [Using default nameservers vs hosting nameservers](https://www.namecheap.com/support/knowledgebase/article.aspx/9434/32/using-default-nameservers-vs-hosting-nameservers/):

- `dns1.registrar-servers.com`
- `dns2.registrar-servers.com`

Host `@` is the apex. Delete any default parking CNAME or URL Redirect Namecheap may add for `@` or `www` (commonly a `www` CNAME to `parkingpage.namecheap.com`). There must be no leftover Cloudflare A/AAAA/MX/SPF on this zone once it is authoritative.

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
| CNAME | `app` | `<site-name>.netlify.app` | 300 | app 301 site; use the exact host Netlify shows |
| TXT | `_github-pages-challenge-right-stacking5441` | `<token from GitHub UI>` | 300 | Domain verification; confirm the label if the repo is under an organization |
| MX | `@` | *(set automatically by Mail Settings → Email Forwarding)* | 300 (or Automatic) | Copy the hosts and priorities from the dashboard |
| TXT | `@` | *(SPF set automatically for Email Forwarding; do not delete)* | 300 (or Automatic) | Must be the only `v=spf1` record |

Optional, not required for launch:

| Type | Host | Value | Notes |
|---|---|---|---|
| TXT | `@` or `app` | existing Google site verification, if Search Console still needs it | Only if GSC fails without it. Do not create a second SPF TXT. |
| TXT | `_dmarc` | — | Do not add a restrictive policy in this cutover. |

Do not add: Cloudflare MX/SPF/DKIM; Replit A for `app`; a URL Redirect for `app` or `@`; a wildcard `*`; CAA unless it explicitly allows `letsencrypt.org`.

---

## TTL advice and the nameserver switch

Apex A/AAAA/MX/TXT are already **300 seconds**. `app` is already **60 seconds**. Those are low enough; no further lowering is required on the Cloudflare side for those records.

**NS TTL is 86400 seconds (24 hours)** in Cloudflare DoH (Google DoH showed 21600). That cannot be assumed to drop just because other records are at 300. After the nameserver switch, some resolvers may keep asking Cloudflare for up to a day (rarely longer). Leave the Cloudflare zone, Pages-unattached, with Email Routing still on, until public DNS has shown Namecheap NS and MX everywhere and mail has been tested. That overlap is what keeps mail alive.

**Switch at Namecheap:** Domain List → Manage → Nameservers, from **Custom DNS** (`alexia.ns.cloudflare.com`, `christian.ns.cloudflare.com`) to **BasicDNS** (Namecheap’s “default nameservers”: `dns1.registrar-servers.com`, `dns2.registrar-servers.com`). Official articles describe this as the way to use Advanced DNS, URL forwarding, and free Email Forwarding. Namecheap’s API docs also say those value-added services “will not work for domains using custom nameservers.”

**Can BasicDNS records be pre-entered before the switch?** Advanced DNS only *serves* records while the domain is on BasicDNS, PremiumDNS or FreeDNS. The URL-redirect article says that if you cannot edit host records, it may be because of third-party nameservers. **Treat pre-entry as something to try in the dashboard, not as a documented guarantee.** If the Advanced DNS tab is editable while still on Custom DNS, enter the whole table (and delete parking defaults) **before** flipping nameservers, so the zone is complete at the moment BasicDNS becomes authoritative. If the tab is locked, have the table in hand, switch to BasicDNS, and enter every record immediately, including Mail Settings → Email Forwarding and the `hello` forwarder.

Namecheap warns that host records are not copied automatically when moving between Custom DNS and BasicDNS. Do not expect the Cloudflare zone to appear in Advanced DNS on its own.

---

## Step order, with checkpoints

Do nothing in steps 6–12 without William’s go-ahead.

1. **Prepare, no live DNS.** Get William’s approval items above. Create the production GitHub repo (public) and the free Netlify `app` 301 site with the `_redirects` file, both left unpublished from the live domain. Keep the preview repo noindex.
2. **Launch commit on the production repo only** (still not pointed at the apex): fill the privacy date; keep the GitHub Pages privacy sentence; remove noindex, open `robots.txt`, remove the banner; add `/contact` to the sitemap if not already; fix M6 on `docs/404.html`; add `docs/CNAME` (`agecalculator.com`) and stop the build from deleting it; update `verify.sh` as above. Run `LAUNCH=1` tests against the built tree.
3. **Verify the domain on GitHub** with the TXT record. If Advanced DNS cannot yet hold that TXT, add the same TXT on **Cloudflare** first (still authoritative), complete GitHub verification, and plan to recreate the TXT on Namecheap in step 7 so verification survives the switch.
4. **Add the custom domain** `agecalculator.com` on the **production** repo’s Pages settings. Do not do this on the preview repo. Pull or pin `docs/CNAME`.
5. **Checkpoint:** production site is reachable at its `*.github.io` URL (or the Pages URL GitHub shows), launch content is correct, Netlify `*.netlify.app` already 301s a sample of `app` paths (you can test the Netlify URL with `Host: app.agecalculator.com` or by temporarily using the Netlify host in `curl`). Cloudflare is still serving the live domain.
6. **William’s go-ahead.** Namecheap login in the vault.
7. **Enter the Namecheap table** if Advanced DNS is editable; otherwise do this in the same sitting as step 8. Set Mail Settings to Email Forwarding and add `hello` → `hurrellcapital@gmail.com` as soon as BasicDNS will accept it.
8. **Switch nameservers** Custom DNS → BasicDNS. Delete parking records if they appeared. Confirm `@` has only the eight GitHub addresses plus the mail/TXT records, `www` and `app` CNAMEs are correct, and Cloudflare MX/SPF are not present on the Namecheap zone.
9. **Checkpoint — DNS.** `NS` begins to show `dns1` / `dns2.registrar-servers.com`. Apex A/AAAA match GitHub. `www` CNAME matches. `app` CNAME matches Netlify. MX/SPF match the dashboard. Verification TXT is present. Wait for GitHub to issue the certificate, then enable **Enforce HTTPS**.
10. **Checkpoint — HTTP.** Run the updated `verify.sh` from a network that is not intercepting plain HTTP. Confirm in particular: `https://agecalculator.com/` is **200** (the old catch-all to `app` is gone because those Cloudflare rules are no longer authoritative); `https://app…/past/1990` is one 301 to `/past?year=1990`; `https://app…/difference` is one 301 to `/difference`; `www` and HTTP apex go to HTTPS root; 404s at nested paths still satisfy M6.
11. **Checkpoint — mail.** Wait up to an hour after the forwarder was created. Send a test to `hello@` from a third-party account. Confirm it arrives at `hurrellcapital@gmail.com`. Only then is it safe to stop relying on Cloudflare Email Routing.
12. **Search Console and aftercare** (SEO Manager’s list): confirm the Domain property for `agecalculator.com`; submit `https://agecalculator.com/sitemap.xml`; keep any existing `app.` property for a few months; do not delete Cloudflare or the Replit app on day one. Leave `app` 301s in place for at least a year. After a day or two of clean public DNS and mail, Cloudflare can be left as a rollback or removed in a later, approved step.

---

## Rollback

Until NS has fully left Cloudflare, switching Namecheap nameservers **back to Custom DNS** (`alexia.ns.cloudflare.com`, `christian.ns.cloudflare.com`) restores the pre-cutover zone: apex catch-all 301 to `app`, `app` A `34.111.179.208`, Email Routing MX/SPF, `www` NXDOMAIN. Keep that zone unchanged during the window so this is possible.

If NS has already propagated but the Cloudflare zone was left intact: the same nameserver flip still rolls DNS back; cached BasicDNS answers expire with their TTLs (300s for most records; up to 24 hours for NS).

If the live content is wrong but DNS is right: revert the production GitHub repo (and, if needed, disable Enforce HTTPS only if a certificate problem requires it). Do not delete `docs/CNAME` while the apex still points at GitHub, or the domain can be taken over.

If `app` 301s are wrong: point `app` back to `A 34.111.179.208` (Replit) as in `rollback.md`, or fix the Netlify `_redirects` file.

Do not delete `agecalculator-preview`. Do not change the Namecheap *registration* (only nameservers and records). Do not edit the Replit app unless also rolling back an application change.

---

## Open risks

- **`app.` HSTS (two years)** makes Namecheap URL Redirect unusable; the Netlify (or Vercel) 301 site is required for HTTPS on `app.`. If that site or its CNAME is removed too soon, `https://app` breaks rather than silently falling back.
- **GitHub Pages will not 301 trailing slashes or `/past/{year}` on the apex or `www`.** Those requests 404. Most historical year URLs and backlinks are on `app.`, which Netlify will 301 correctly. This is a known gap versus the earlier Cloudflare pack and versus SEO Manager’s tightening for apex year URLs.
- **`/page.html` and `/page` both 200** on GitHub Pages. Canonicals are slashless; it is still duplicate.
- **Nameserver TTL up to 24 hours**, and Namecheap email forwarding may only be creatable after the switch, with up to an hour before the mailbox is live. Mail is protected for resolvers still on Cloudflare; there may be a short gap for those that have already switched. Test before turning Routing off.
- **Forwarded mail to Gmail** can land in spam when the original sender’s DMARC is strict, even with Namecheap SPF/SRS. No outgoing mail as `hello@` on the free forwarder.
- **Cannot pre-enter BasicDNS records while on Custom DNS** may prove true in the dashboard; the switch then depends on entering the whole table immediately.
- **GitHub certificate / Enforce HTTPS** can take up to 24 hours after DNS is correct. A typo in A/AAAA/`www` records can block issuance.
- **A new production repo and a Netlify account** need William’s approval; the preview repo must not receive the custom domain.
- **This environment’s HTTP proxy** can still make plain-HTTP tests look like 500s. Run `verify.sh` from a normal network, or with `--resolve` against the new A records.
- **No CAA and no DNSSEC today** is convenient for Let’s Encrypt and for the NS switch; do not add a restrictive CAA or turn on DNSSEC mid-window.

