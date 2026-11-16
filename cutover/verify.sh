#!/usr/bin/env bash
# Post-cutover checks for the agecalculator.com redirect map.
# Uses curl -sSI (HEAD, no follow). Most HTTPS rules are a single 301 to the
# expected target. HTTP is often two hops on Netlify (same-host HTTP→HTTPS first).
# Do not treat a run against today's live zone as a reason to change DNS:
# these assertions describe the *after* state and will fail until cutover is applied.
set -u

# Portable header lookup. mawk and BSD awk have no ignore-case flag; HTTP/2
# headers are lower-case. Use tolower() so this works everywhere.
header_val() {
  local name="$1" text="$2"
  printf '%s' "$text" | tr -d '\r' | awk -v n="$name" '
    BEGIN { n = tolower(n) }
    tolower($0) ~ "^" n ":" { sub(/^[^:]*:[[:space:]]*/, ""); print; exit }
  '
}



# Fail if any built HTML or approved copy still has a placeholder.
check_no_placeholders() {
  local repo
  repo="$(cd "$(dirname "$0")/.." && pwd)"
  local hits
  hits="$(grep -RInE '\[PLACEHOLDER|PLACEHOLDER:' "$repo/docs" --include='*.html' "$repo/copy-approved" --include='*.md' 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    echo "FAIL  placeholders remain in built HTML or approved copy:"
    printf '%s\n' "$hits" | sed 's/^/      /'
    failed=$((failed + 1))
    return 1
  fi
  echo "ok    no placeholders in docs/*.html or copy-approved/*.md"
  passed=$((passed + 1))
}

ROOT="https://agecalculator.com"
failed=0
passed=0

normalize() {
  # Lower-case scheme/host, drop default ports, drop a trailing slash except for "/"
  local u="${1%%$'\r'}"
  u="${u//$'\r'/}"
  u="${u%"${u##*[![:space:]]}"}"
  u="$(printf '%s' "$u" | tr '[:upper:]' '[:lower:]')"
  u="${u#http://}"; set -- "http://$u"
  # pull apart
  local url="$1"
  # strip :443 and :80
  url="${url//:443\//\/}"
  url="${url//:80\//\/}"
  printf '%s' "$url"
}

expect_eq() {
  local a="$1" b="$2"
  local na nb
  na="$(normalize "$a")"
  nb="$(normalize "$b")"
  # homepage must keep its slash; everywhere else either form of the last path is compared after normalize
  # normalize() lowercases the whole URL including path/query. Fine for this host.
  # Accept a missing trailing slash on the homepage only if the expected target is the homepage with slash:
  if [ "$nb" = "https://agecalculator.com/" ] || [ "$nb" = "http://agecalculator.com/" ]; then
    [ "$na" = "$nb" ] && return 0
    # also accept without trailing slash for home? map says https://agecalculator.com/
    return 1
  fi
  # For non-home, also accept an accidental trailing slash on Location
  local na2="${na%/}"
  local nb2="${nb%/}"
  [ "$na2" = "$nb2" ]
}

# First hop only: no -L. Prints status and Location.
check_301() {
  local url="$1"
  local expected="$2"
  local label="${3:-$url}"
  local out status location
  out="$(curl -sSI --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>&1)" || true
  status="$(printf '%s' "$out" | tr -d '\r' | awk 'BEGIN{s=""} /^HTTP\//{s=$2} END{print s}')"
  location="$(header_val Location "$out")"

  if [ "$status" != "301" ]; then
    echo "FAIL  $label"
    echo "      expected: 301 -> $expected"
    echo "      got:      status=${status:-?} location=${location:-<none>}"
    # Hint for the known box HTTP intercept
    if printf '%s' "$out" | grep -qi 'Pingora'; then
      echo "      note:     Server is Pingora (plain HTTP may be intercepted on this network)."
    fi
    failed=$((failed + 1))
    return 1
  fi
  if ! expect_eq "$location" "$expected"; then
    echo "FAIL  $label"
    echo "      expected: 301 -> $expected"
    echo "      got:      301 -> ${location:-<empty>}"
    failed=$((failed + 1))
    return 1
  fi
  echo "ok    $label  ->  $location"
  passed=$((passed + 1))
}

# Two hops, each asserted without -L, then the final URL must be 200.
# Used where Netlify's automatic same-host HTTP→HTTPS upgrade runs first.
check_301_two_hops() {
  local url="$1"
  local hop1="$2"
  local final="$3"
  local label="${4:-$url}"
  check_301 "$url" "$hop1" "$label (hop 1 of 2)" || return 1
  check_301 "$hop1" "$final" "$label (hop 2 of 2)" || return 1
  check_200 "$final" "$final (final after $label)"
}

check_200() {
  local url="$1"
  local label="${2:-$url}"
  local out status location
  out="$(curl -sSI --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>&1)" || true
  status="$(printf '%s' "$out" | tr -d '\r' | awk 'BEGIN{s=""} /^HTTP\//{s=$2} END{print s}')"
  location="$(header_val Location "$out")"
  if [ "$status" != "200" ] || [ -n "$location" ]; then
    echo "FAIL  $label"
    echo "      expected: 200 with no Location"
    echo "      got:      status=${status:-?} location=${location:-<none>}"
    failed=$((failed + 1))
    return 1
  fi
  echo "ok    $label  200 (no redirect)"
  passed=$((passed + 1))
}


# Email DNS only. At launch, replace the Cloudflare MX/SPF assertions
# below with the Namecheap forwarding values copied from the dashboard.
# Email Routing DNS only (current function, pre-cutover). hello@agecalculator.com must forward to
# hurrellcapital@gmail.com; that forward cannot be proved from DNS, so after
# cutover send a test message and confirm it arrives. These checks only assert
# that MX points at Cloudflare Email Routing and that the SPF TXT record is present.
# The zone already had matching MX and SPF records on 16 November 2026 (Europe/London).
dns_query() {
  python3 - "$1" "$2" <<'PY'
import json, sys, urllib.request
name, typ = sys.argv[1], sys.argv[2]
url = f"https://cloudflare-dns.com/dns-query?name={name}&type={typ}"
req = urllib.request.Request(url, headers={"Accept": "application/dns-json"})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.load(r)
except Exception as e:
    print(f"ERROR {e}", file=sys.stderr)
    sys.exit(2)
for a in data.get("Answer") or []:
    print(a.get("data", ""))
PY
}

check_email_routing_dns() {
  local domain="agecalculator.com"
  local mx spf ok_mx=0 ok_spf=0
  echo "----  Email Routing DNS (hello@${domain} -> hurrellcapital@gmail.com; DNS only)"
  mx="$(dns_query "$domain" MX 2>&1)" || true
  spf="$(dns_query "$domain" TXT 2>&1)" || true
  if printf '%s\n' "$mx" | grep -qiE '(^|[[:space:]])([0-9]+[[:space:]]+)?[a-z0-9.-]*mx\.cloudflare\.net\.?$'; then
    ok_mx=1
  fi
  # DoH TXT answers are often quoted: "v=spf1 include:_spf.mx.cloudflare.net ~all"
  if printf '%s\n' "$spf" | grep -q 'v=spf1 include:_spf.mx.cloudflare.net'; then
    ok_spf=1
  fi
  if [ "$ok_mx" -eq 1 ] && [ "$ok_spf" -eq 1 ]; then
    echo "ok    MX + SPF TXT for ${domain} (Cloudflare Email Routing)"
    printf '%s\n' "$mx" | sed 's/^/      MX  /'
    passed=$((passed + 1))
    echo "      note:     confirm hello@${domain} forwards to hurrellcapital@gmail.com with a test email."
    return 0
  fi
  echo "FAIL  Email Routing DNS for ${domain}"
  echo "      expected: MX to *.mx.cloudflare.net and TXT v=spf1 include:_spf.mx.cloudflare.net"
  echo "      MX got:   ${mx:-<none>}"
  echo "      TXT got:  ${spf:-<none>}"
  failed=$((failed + 1))
  return 1
}


# 404 page at nested paths (M6 gate): HTML 404, root-relative asset/nav URLs only.
# Also confirm the assets those URLs point at actually exist.
check_404_page() {
  local path="$1"
  local url="$ROOT$path"
  local tmp status ctype
  tmp="$(mktemp)"
  status="$(curl -sS -o "$tmp" -w '%{http_code}' --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>/dev/null || true)"
  ctype="$(header_val Content-Type "$(curl -sSI --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>/dev/null || true)")"
  if [ "$status" != "404" ] || ! printf '%s' "$ctype" | grep -qi 'text/html'; then
    echo "FAIL  404 $path"
    echo "      expected: 404 text/html"
    echo "      got:      status=${status:-?} type=${ctype:-<none>}"
    failed=$((failed + 1))
    rm -f "$tmp"
    return 1
  fi
  local rel
  rel="$(grep -Eo '(href|src)="[^"]*"' "$tmp" | grep -Ev '="(/|#|https://|mailto:)' || true)"
  if [ -n "$rel" ]; then
    echo "FAIL  404 $path has relative URLs:"
    printf '%s\n' "$rel" | sed 's/^/      /'
    failed=$((failed + 1))
    rm -f "$tmp"
    return 1
  fi
  if grep -q '<base' "$tmp" || grep -q 'document.write' "$tmp"; then
    echo "FAIL  404 $path still has a <base> or document.write"
    failed=$((failed + 1))
    rm -f "$tmp"
    return 1
  fi
  echo "ok    404 $path  (404 text/html, root-relative URLs)"
  passed=$((passed + 1))
  rm -f "$tmp"
}

check_asset_200() {
  local path="$1"
  local expect_type="$2"
  local url="$ROOT$path"
  local status ctype
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>/dev/null || true)"
  ctype="$(header_val Content-Type "$(curl -sSI --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>/dev/null || true)")"
  if [ "$status" != "200" ] || ! printf '%s' "$ctype" | grep -qi "$expect_type"; then
    echo "FAIL  asset $path"
    echo "      expected: 200 $expect_type"
    echo "      got:      status=${status:-?} type=${ctype:-<none>}"
    failed=$((failed + 1))
    return 1
  fi
  echo "ok    asset $path  200 $ctype"
  passed=$((passed + 1))
}

echo "agecalculator.com cutover verify (curl -sSI, no follow; some HTTP URLs are two hops)"
echo "-----------------------------------------------------------"

# Year pages from app (map rows, including 2025 which is not in the old sitemap)
check_301 "https://app.agecalculator.com/past/1960" "$ROOT/past?year=1960" "https://app.../past/1960"
check_301 "https://app.agecalculator.com/past/1990" "$ROOT/past?year=1990" "https://app.../past/1990"
check_301 "https://app.agecalculator.com/past/2024" "$ROOT/past?year=2024" "https://app.../past/2024"
check_301 "https://app.agecalculator.com/past/2025" "$ROOT/past?year=2025" "https://app.../past/2025"

# Path-preserving app paths
check_301 "https://app.agecalculator.com/difference" "$ROOT/difference" "https://app.../difference"
check_301 "https://app.agecalculator.com/past" "$ROOT/past" "https://app.../past"
check_301 "https://app.agecalculator.com/" "$ROOT/" "https://app.../"
check_301 "https://app.agecalculator.com/privacy" "$ROOT/privacy" "https://app.../privacy"
check_301 "https://app.agecalculator.com/robots.txt" "$ROOT/robots.txt" "https://app.../robots.txt"

# HTTP apex: Netlify upgrades HTTP to HTTPS on the same host first.
# Paths that are already the canonical HTTPS URL are one hop (scheme only).
# Paths that then need a further rule are two hops. See namecheap-plan.md.
check_301 "http://agecalculator.com/" "$ROOT/" "http://agecalculator.com/"
check_301 "http://agecalculator.com/difference" "$ROOT/difference" "http://agecalculator.com/difference"
check_301_two_hops "http://agecalculator.com/past/1990" "https://agecalculator.com/past/1990" "$ROOT/past?year=1990" "http://agecalculator.com/past/1990"

# www HTTPS: one hop to the apex (automatic primary-domain redirect, path kept).
# www HTTP: two hops (HTTP→HTTPS on www, then www→apex).
check_301 "https://www.agecalculator.com/" "$ROOT/" "https://www.agecalculator.com/"
check_301 "https://www.agecalculator.com/difference" "$ROOT/difference" "https://www.../difference"
check_301 "https://www.agecalculator.com/past/1990" "$ROOT/past?year=1990" "https://www.../past/1990"
check_301_two_hops "http://www.agecalculator.com/" "https://www.agecalculator.com/" "$ROOT/" "http://www.agecalculator.com/"
check_301_two_hops "http://www.agecalculator.com/difference" "https://www.agecalculator.com/difference" "$ROOT/difference" "http://www.../difference"

# HTTP app: two hops (HTTP→HTTPS on app, then the app host rule to the apex).
check_301_two_hops "http://app.agecalculator.com/" "https://app.agecalculator.com/" "$ROOT/" "http://app.agecalculator.com/"
check_301_two_hops "http://app.agecalculator.com/difference" "https://app.agecalculator.com/difference" "$ROOT/difference" "http://app.../difference"
check_301_two_hops "http://app.agecalculator.com/past/1990" "https://app.agecalculator.com/past/1990" "$ROOT/past?year=1990" "http://app.../past/1990"

# Trailing slash on the HTTPS apex (not the homepage)
check_301 "https://agecalculator.com/difference/" "$ROOT/difference" "https://agecalculator.com/difference/"
check_301 "https://agecalculator.com/past/" "$ROOT/past" "https://agecalculator.com/past/"


# /rodent-age-calculator.html (SEO Manager, 16 Nov 2026).
# A university page links to http://agecalculator.com/rodent-age-calculator.html.
# All 6 combinations (http/https × apex/www/app). curl without -L on each hop.
# HTTPS: one 301, Location https://agecalculator.com/, then that URL returns 200.
# HTTP: two hops — same-host HTTP→HTTPS first, then the HTTPS rule to the apex.
echo "----  /rodent-age-calculator.html (6 combinations)"
check_301 "https://agecalculator.com/rodent-age-calculator.html" "$ROOT/" "https://agecalculator.com/rodent-age-calculator.html"
check_301 "https://www.agecalculator.com/rodent-age-calculator.html" "$ROOT/" "https://www.../rodent-age-calculator.html"
check_301 "https://app.agecalculator.com/rodent-age-calculator.html" "$ROOT/" "https://app.../rodent-age-calculator.html"
check_200 "$ROOT/" "https://agecalculator.com/ (final after HTTPS rodent)"
check_301_two_hops "http://agecalculator.com/rodent-age-calculator.html" "https://agecalculator.com/rodent-age-calculator.html" "$ROOT/" "http://agecalculator.com/rodent-age-calculator.html"
check_301_two_hops "http://www.agecalculator.com/rodent-age-calculator.html" "https://www.agecalculator.com/rodent-age-calculator.html" "$ROOT/" "http://www.../rodent-age-calculator.html"
check_301_two_hops "http://app.agecalculator.com/rodent-age-calculator.html" "https://app.agecalculator.com/rodent-age-calculator.html" "$ROOT/" "http://app.../rodent-age-calculator.html"

# Destinations must be 200, not a second redirect
check_200 "https://agecalculator.com/" "https://agecalculator.com/ (final)"
check_200 "https://agecalculator.com/difference" "https://agecalculator.com/difference (final)"
check_200 "https://agecalculator.com/past?year=1990" "https://agecalculator.com/past?year=1990 (final)"

# Email Routing MX and SPF (forwarding itself is a manual test email)
check_email_routing_dns

# M6 gate: nested 404s are HTML 404s with root-relative URLs; assets exist.
# Do not use /past/1990 here: on Netlify that path 301s to /past?year=1990.
echo "----  404 page and static assets (M6)"
check_404_page "/a/b/c"
check_404_page "/nope"
check_404_page "/no-such/nested/path"
check_asset_200 "/styles.css" "text/css"
check_asset_200 "/fonts/libre-franklin-var.woff2" "font/woff2\|application/font\|octet-stream"
check_asset_200 "/favicon.ico" "image/"
check_asset_200 "/favicon.svg" "image/"

echo "----  Placeholders (local files)"
check_no_placeholders

echo "-----------------------------------------------------------"
echo "$passed passed, $failed failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
exit 0
