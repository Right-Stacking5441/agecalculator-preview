# Cloudflare Redirect Rules and DNS changes (not applied)

> **Superseded for the live root.** HC CEO chose option (c) on 16 November 2026: the apex is GitHub Pages, with Namecheap BasicDNS and Namecheap free Email Forwarding. On 17 November 2026, HC CEO (speaking for William on Hurrell Capital work) moved `app.` 301s from Netlify to a free Vercel Hobby project; Netlify is dropped. Follow `namecheap-plan.md` and `hosting.md`. This file is kept as earlier working notes and must not be applied as written.

Apply these only after William approves. Do them in this order. First match wins for Single Redirects, so the year rule must sit above the general path-preserving rule.

These four Single Redirects plus one deletion fit the Free plan (10 Single Redirects per zone). They use wildcard matching, not regex (regex needs Business). They cover both `http` and `https` in one rule each, so you do not get a chain such as `http://app` → `https://app` → `https://agecalculator.com`.

Bulk Redirects are not required. A CSV of the explicit year rows is omitted on purpose: one wildcard rule handles 1960–2024, 2025, and any other year.

## 0. Before any DNS change, have the Pages project ready

The new root origin should already be serving the flattened `docs/` output on a `*.pages.dev` preview, with `/past?year=1990` working and `noindex` still on. Do not attach the live apex yet.

## 1. Add the missing proxied `www` record

`www.agecalculator.com` currently has no DNS (NXDOMAIN). Redirect Rules never fire on a host that is not proxied.

In the agecalculator.com zone, DNS → Add record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `www` | `agecalculator.com` | **Proxied** (orange cloud) |

CNAME flattening at the zone apex is fine. Wait until the record is live and orange-clouded before testing `https://www`.

## 2. Delete the current root catch-all to `app`

This is row 81 of the map, status `REMOVE`. Today every HTTPS path on the apex, including `/past`, `/difference` and `/robots.txt`, is a Cloudflare 301 to `https://app.agecalculator.com/` (the homepage, path discarded). `http://agecalculator.com/` was also observed (via the zone’s anycast IPs) 301ing to `https://app.agecalculator.com`.

Find that rule (Redirect Rule, Bulk Redirect, or leftover Page Rule) and **delete or disable it first**. If you only add new rules below a catch-all that still matches first, the new rules never run.

There will be a short window where the apex may 404 or hit Pages/the wrong origin. Do not linger here; go straight to steps 3 and 4.

## 3. Proxy `app` through Cloudflare

Today `app.agecalculator.com` is `A 34.111.179.208` (Google / Replit). That is not a Cloudflare anycast address, so zone Redirect Rules **do not apply** to `app` until the record is proxied.

Change the `app` record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `app` | `agecalculator.com` | **Proxied** (orange cloud) |

(Alternatively a proxied A to a documentation address such as 192.0.2.1 is enough, because the origin should never be reached: the 301 fires at the edge.)

Do this in the same change window as step 4. If you proxy `app` before the new Redirect Rules exist, visitors could hit the apex origin without a 301. If you add rules before `app` is proxied, `app` still goes to Replit.

Leave the Replit/Google A value written down for rollback (see `rollback.md`).

## 4. Attach the apex to Cloudflare Pages, then add Redirect Rules

Attach `agecalculator.com` as the production custom domain for the Pages project (output directory `docs`). Cloudflare will want to manage the apex as a flattened CNAME to the Pages host. The apex is already orange-clouded.

Then create four **Single Redirects**, in this order, all **301**, on the agecalculator.com zone. In the dashboard: Rules → Redirect Rules → Create rule → Custom filter expression (or the wildcard editor, if you prefer, with one rule per scheme — that burns more of the 10-rule quota).

### Rule 1 — `/past/{year}` to the hub, from any of the three hosts, one hop

This covers the 65 sitemap years, the map’s `{any other year}` row (e.g. 2025), `http://app`, `www`, and the same path on the apex (so `/past/1990` does not 404 on the new root).

- **Name:** `past year URLs to hub`
- **Expression:**

```
(http.host in {"app.agecalculator.com" "www.agecalculator.com" "agecalculator.com"} and http.request.uri.path wildcard "/past/*")
```

- **Target URL (dynamic):**

```
concat("https://agecalculator.com/past?year=", wildcard_replace(http.request.uri.path, "/past/*", "${1}"))
```

- **Status:** 301
- **Preserve query string:** off (the target already has `?year=`; turning this on can drop or replace that parameter)

`/past/1990` → `https://agecalculator.com/past?year=1990`. `/past/` (no year) is a trailing slash, not a year, and is handled by Rule 4.

### Rule 2 — reserved homepage aliases

The map marks these “only if slug exists”. This preview does **not** create `/how-old-am-i` or `/date-of-birth` pages. The rule is still safe: it 301s guesses and typo traffic to `/` in one hop, including from `app` and `www`.

- **Name:** `how-old-am-i and date-of-birth to home`
- **Expression:**

```
(http.host in {"app.agecalculator.com" "www.agecalculator.com" "agecalculator.com"} and http.request.uri.path in {"/how-old-am-i" "/how-old-am-i/" "/date-of-birth" "/date-of-birth/"})
```

- **Target URL (static):** `https://agecalculator.com/`
- **Status:** 301

### Rule 3 — `app`, `www`, and HTTP apex, path preserved

Replaces the current `http://agecalculator.com/{path}` → `app` behaviour. `https://app/…` and `http://app/…` go straight to the HTTPS root with the same path, one hop. Homepage becomes `https://agecalculator.com/`. `/difference`, `/past`, `/privacy`, `/robots.txt` and `/sitemap.xml` keep their paths. Unknown `app` paths become the same path on the root, which 404s if no page exists.

- **Name:** `app www and http apex to https root`
- **Expression:**

```
(http.host in {"app.agecalculator.com" "www.agecalculator.com"} or (http.host eq "agecalculator.com" and http.request.scheme eq "http"))
```

- **Target URL (dynamic):**

```
concat("https://agecalculator.com", http.request.uri.path)
```

- **Status:** 301
- **Preserve query string:** on

Rule 1 must stay above this rule, or `/past/1990` would land on `https://agecalculator.com/past/1990` and need a second hop.

### Rule 4 — trailing slash on the HTTPS apex, except `/`

- **Name:** `drop trailing slash except homepage`
- **Expression:**

```
(http.host eq "agecalculator.com" and http.request.scheme eq "https" and http.request.uri.path ne "/" and ends_with(http.request.uri.path, "/"))
```

- **Target URL (dynamic):**

```
concat("https://agecalculator.com", substring(http.request.uri.path, 0, sub(len(http.request.uri.path), 1)))
```

- **Status:** 301
- **Preserve query string:** on

If `sub` / `len` / `substring` are rejected by the editor, use this equivalent target:

```
concat("https://agecalculator.com", wildcard_replace(http.request.uri.path, "/*/", "/${1}"))
```

## 5. What you should now see

`cutover/verify.sh` should pass (run from a network that is not intercepting plain HTTP; see `conflicts.md`). A sample of expected first hops:

| Request | First hop |
|---|---|
| `https://app.agecalculator.com/past/1960` | 301 → `https://agecalculator.com/past?year=1960` |
| `https://app.agecalculator.com/past/1990` | 301 → `https://agecalculator.com/past?year=1990` |
| `https://app.agecalculator.com/past/2024` | 301 → `https://agecalculator.com/past?year=2024` |
| `https://app.agecalculator.com/past/2025` | 301 → `https://agecalculator.com/past?year=2025` |
| `https://app.agecalculator.com/difference` | 301 → `https://agecalculator.com/difference` |
| `http://agecalculator.com/` | 301 → `https://agecalculator.com/` |
| `http://agecalculator.com/difference` | 301 → `https://agecalculator.com/difference` |
| `http://www.agecalculator.com/difference` | 301 → `https://agecalculator.com/difference` |
| `https://www.agecalculator.com/difference` | 301 → `https://agecalculator.com/difference` |
| `https://www.agecalculator.com/past/1990` | 301 → `https://agecalculator.com/past?year=1990` |
| `http://app.agecalculator.com/past` | 301 → `https://agecalculator.com/past` |
| `https://agecalculator.com/difference/` | 301 → `https://agecalculator.com/difference` |
| `https://agecalculator.com/` | 200 (no redirect) |
| `https://agecalculator.com/past?year=1990` | 200 (no redirect) |

## 6. Email Routing for hello@agecalculator.com (at cutover)

`hello@agecalculator.com` must forward to `hurrellcapital@gmail.com`. Set this up with [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/) at cutover. Do not change live DNS until William approves.

Enabling Email Routing adds the MX and TXT records the service needs (MX to Cloudflare's mail exchangers, plus a TXT SPF record; the dashboard also shows any DKIM TXT records it will add). Official docs: https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/ (Cloudflare may redirect that page to the Email Service route-emails guide).

Observed on Monday 16 November 2026 (Europe/London): the zone already has Cloudflare Email Routing MX records (`route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net`) and the SPF TXT record `v=spf1 include:_spf.mx.cloudflare.net ~all`. Keep those in place. MX hostnames can vary (`route1` / `route2` / `route3`, or names such as `amir` / `linda` / `isaac` in Cloudflare's examples); any `*.mx.cloudflare.net` exchangers are fine.

The remaining work at cutover is to add or confirm the forwarding rule itself:

1. In the Cloudflare dashboard, open Email Routing for the agecalculator.com zone (under Email or Compute > Email Service, depending on the dashboard). If Email Routing is not already enabled, enable it and accept the MX and TXT records Cloudflare adds. If other providers' MX records are present, Email Routing will not enable until those are removed.
2. Add `hurrellcapital@gmail.com` as a destination address and verify it if it is not already verified (Cloudflare sends a verification email).
3. Create a custom address / routing rule: `hello@agecalculator.com` forwards to `hurrellcapital@gmail.com`.
4. Send a test message to `hello@agecalculator.com` from a different account and confirm it arrives at `hurrellcapital@gmail.com`. The forward cannot be proved from DNS alone.
5. `cutover/verify.sh` checks that MX points at `*.mx.cloudflare.net` and that a TXT record includes `v=spf1 include:_spf.mx.cloudflare.net`.
