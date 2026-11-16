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

echo "-----------------------------------------------------------"
echo "$passed passed, $failed failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
exit 0
