#!/usr/bin/env bash
# Push the local launch build at /workspace/agecalculator-launch/ to the
# empty production repo Right-Stacking5441/agecalculator.
#
# Do not run this until William has approved cutover, Tester has passed,
# and Pages should be turned on. This script does not enable GitHub Pages.
set -euo pipefail

LAUNCH_DIR="${LAUNCH_DIR:-/workspace/agecalculator-launch}"
REPO="${DEPLOY_REPO:-https://github.com/Right-Stacking5441/agecalculator.git}"
BRANCH="${DEPLOY_BRANCH:-main}"

if [[ ! -d "$LAUNCH_DIR" ]]; then
  echo "launch build missing at $LAUNCH_DIR" >&2
  exit 1
fi
if [[ ! -f "$LAUNCH_DIR/CNAME" ]]; then
  echo "CNAME missing in $LAUNCH_DIR (should contain agecalculator.com)" >&2
  exit 1
fi
if grep -R --include='*.html' -l 'preview-banner' "$LAUNCH_DIR" >/dev/null 2>&1; then
  echo "refusing to deploy: preview banner still present in $LAUNCH_DIR" >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

git clone --depth 1 "$REPO" "$WORKDIR/repo"
# The production repo should be empty (or only a README) before the first cutover.
rsync -a --delete --exclude '.git/' "$LAUNCH_DIR"/ "$WORKDIR/repo"/
# Keep a CNAME at the repo root AND in the Pages source. GitHub Pages
# from / (or /docs) needs the CNAME in the published tree.
if [[ ! -f "$WORKDIR/repo/CNAME" ]]; then
  echo "agecalculator.com" > "$WORKDIR/repo/CNAME"
fi

cd "$WORKDIR/repo"
git add -A
if git diff --cached --quiet; then
  echo "nothing to deploy"
  exit 0
fi
git -c user.name="Right-Stacking5441" -c user.email="Right-Stacking5441@users.noreply.github.com" \
  commit -m "Publish agecalculator.com launch build."
git push origin "$BRANCH"
echo "pushed launch build to $REPO ($BRANCH). Enable Pages separately; this script does not."
