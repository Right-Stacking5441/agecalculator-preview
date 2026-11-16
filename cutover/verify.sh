#!/usr/bin/env bash
# Post-cutover checks for the agecalculator.com redirect map.
# Uses curl -sSI (HEAD, no follow) and asserts a single 301 to the expected target.
# Do not treat a run against today's live zone as a reason to change DNS:
# these assertions describe the *after* state and will fail until cutover is applied.
set -u

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
  location="$(printf '%s' "$out" | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^Location:/{sub(/^Location:[[:space:]]*/,""); print; exit}')"

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

check_200() {
  local url="$1"
  local label="${2:-$url}"
  local out status location
  out="$(curl -sSI --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>&1)" || true
  status="$(printf '%s' "$out" | tr -d '\r' | awk 'BEGIN{s=""} /^HTTP\//{s=$2} END{print s}')"
  location="$(printf '%s' "$out" | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^Location:/{sub(/^Location:[[:space:]]*/,""); print; exit}')"
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


# Email Routing DNS only. hello@agecalculator.com must forward to
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
  ctype="$(curl -sSI --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>/dev/null | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{sub(/^Content-Type:[[:space:]]*/,""); print; exit}')"
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
  ctype="$(curl -sSI --max-redirs 0 --connect-timeout 15 --max-time 25 "$url" 2>/dev/null | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{sub(/^Content-Type:[[:space:]]*/,""); print; exit}')"
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

echo "agecalculator.com cutover verify (single 301 hop, curl -sSI)"
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

# HTTP apex: one hop to HTTPS root, path preserved (not to app)
check_301 "http://agecalculator.com/" "$ROOT/" "http://agecalculator.com/"
check_301 "http://agecalculator.com/difference" "$ROOT/difference" "http://agecalculator.com/difference"
check_301 "http://agecalculator.com/past/1990" "$ROOT/past?year=1990" "http://agecalculator.com/past/1990"

# www (http and https)
check_301 "https://www.agecalculator.com/" "$ROOT/" "https://www.agecalculator.com/"
check_301 "https://www.agecalculator.com/difference" "$ROOT/difference" "https://www.../difference"
check_301 "https://www.agecalculator.com/past/1990" "$ROOT/past?year=1990" "https://www.../past/1990"
check_301 "http://www.agecalculator.com/" "$ROOT/" "http://www.agecalculator.com/"
check_301 "http://www.agecalculator.com/difference" "$ROOT/difference" "http://www.../difference"

# HTTP app: one hop (not http->https app->root)
check_301 "http://app.agecalculator.com/" "$ROOT/" "http://app.agecalculator.com/"
check_301 "http://app.agecalculator.com/difference" "$ROOT/difference" "http://app.../difference"
check_301 "http://app.agecalculator.com/past/1990" "$ROOT/past?year=1990" "http://app.../past/1990"

# Trailing slash on the HTTPS apex (not the homepage)
check_301 "https://agecalculator.com/difference/" "$ROOT/difference" "https://agecalculator.com/difference/"
check_301 "https://agecalculator.com/past/" "$ROOT/past" "https://agecalculator.com/past/"

# Destinations must be 200, not a second redirect
check_200 "https://agecalculator.com/" "https://agecalculator.com/ (final)"
check_200 "https://agecalculator.com/difference" "https://agecalculator.com/difference (final)"
check_200 "https://agecalculator.com/past?year=1990" "https://agecalculator.com/past?year=1990 (final)"

# Email Routing MX and SPF (forwarding itself is a manual test email)
check_email_routing_dns

# M6 gate: nested 404s are HTML 404s with root-relative URLs; assets exist
echo "----  404 page and static assets (M6)"
check_404_page "/past/1990"
check_404_page "/a/b/c"
check_404_page "/nope"
check_asset_200 "/styles.css" "text/css"
check_asset_200 "/fonts/libre-franklin-var.woff2" "font/woff2\|application/font\|octet-stream"
check_asset_200 "/favicon.ico" "image/"
check_asset_200 "/favicon.svg" "image/"

echo "-----------------------------------------------------------"
echo "$passed passed, $failed failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
exit 0
