# Rollback

> **Superseded for the live root.** HC CEO chose option (c) on 16 November 2026: the apex is GitHub Pages, and Netlify handles only `app.` 301s, with Namecheap BasicDNS and Namecheap free Email Forwarding. Follow `namecheap-plan.md` and `hosting.md`. This file is kept as earlier working notes and must not be applied as written.

Use this if the cutover misbehaves. It restores the situation observed on 16 November 2026, Europe/London: the tool on `app.agecalculator.com` (Replit / Google Frontend at `34.111.179.208`), the apex catch-all 301 to the app homepage, and no `www` record.

Do not apply a rollback “just in case” before anything has been changed.

## 1. Put `app` back on Replit

Restore the `app` DNS record to what it was:

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `app` | `34.111.179.208` | DNS only (grey cloud), as it is today |

TTL can be low (300s) during the window, then returned to whatever the zone used before.

## 2. Restore the apex catch-all to the app homepage

Re-create the Cloudflare 301 that currently exists (or re-enable it if you only disabled it):

- Match: `https://agecalculator.com/*` (and the HTTP equivalent, which today goes to `https://app.agecalculator.com`)
- Target: `https://app.agecalculator.com/` (homepage, path not preserved — this is the pre-cutover behaviour)
- Status: 301

Disable or delete the four new Single Redirects from `redirects-and-dns.md` so they cannot fire first.

## 3. Apex origin

If the apex was attached to the Cloudflare Pages project, remove the production custom domain from Pages (or leave Pages connected but unreachable behind the catch-all). The catch-all from step 2 is what visitors will hit.

## 4. `www`

Either:

- delete the `www` CNAME, returning to NXDOMAIN, or
- keep the proxied `www` record and add a 301 from `www` to `https://app.agecalculator.com/` if you would rather not drop `www` on the floor.

Pre-cutover, `www` did not resolve, so deleting the record is the true rollback.

## 5. Check

- `https://app.agecalculator.com/` returns 200 from Express / Google Frontend.
- `https://agecalculator.com/` and `https://agecalculator.com/difference` 301 to `https://app.agecalculator.com/`.
- The Pages project can stay in the account, unpublished from the apex, as a fallback.

## 6. Do not change this during rollback

- Do not delete the GitHub Pages preview (`Right-Stacking5441/agecalculator-preview`).
- Do not change the Namecheap registration or the Cloudflare nameservers.
- Do not edit the Replit app unless you are also rolling back an application change (this pack does not make one).
