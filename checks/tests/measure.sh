#!/usr/bin/env bash
# Negative tests for scripts/measure.mjs against a running device:
#
#   checks/tests/measure.sh <base url> <password> <spec.json>
#
# A spec copy with one box value moved by 6px, a spec copy with one colour
# changed, a wrong password, bar cards on rows of their own and a pair not
# stretched must each exit 1 and say why. (The passing run is measure.mjs
# itself.) Needs Playwright, as measure.mjs does.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
url=$1 password=$2 spec=$3
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

# expect <text the output must contain> <label> -- <measure.mjs args...>
expect() {
	local text=$1 label=$2 got=0
	shift 3
	node "$root/scripts/measure.mjs" "$@" >"$tmp/out" 2>&1 || got=$?
	if [[ $got -ne 1 ]] || ! grep -qF -- "$text" "$tmp/out"; then
		echo "FAIL $label: exit $got (want 1), output:"
		tail -20 "$tmp/out" | sed 's/^/    /'
		failures=$((failures + 1))
	else
		echo "ok   $label: exit 1, says \"$text\""
	fi
}

node -e '
	const fs = require("fs");
	const [src, box, colour] = process.argv.slice(1);
	const s = JSON.parse(fs.readFileSync(src, "utf8"));
	s["desktop-light"].frame["Top bar (AppShell header)"].height = "70px";
	fs.writeFileSync(box, JSON.stringify(s));
	const c = JSON.parse(fs.readFileSync(src, "utf8"));
	c["desktop-dark"].components["Card (default)"].background = "rgb(32, 31, 34)";
	fs.writeFileSync(colour, JSON.stringify(c));
' "$spec" "$tmp/box.json" "$tmp/colour.json"

expect "desktop-light top bar height: measured 64px, expected 70px" "top bar height moved by 6px in the spec" -- "$url" "$password" --spec "$tmp/box.json"
expect "desktop-dark surface: measured rgb(31, 31, 34), expected rgb(32, 31, 34)" "surface colour off by one in the spec" -- "$url" "$password" --spec "$tmp/colour.json"
expect "login returned" "wrong password" -- "$url" "$password-wrong" --spec "$spec"
# Memory and Storage each forced onto a row of their own: two bar cards and
# no row of two must fail, not pass on zero samples.
printf '%s\n' '#view > .cbi-section { flex-basis: 100% !important; }' > "$tmp/solo.css"
expect "desktop-light same-row card bottoms: no row of two cards, 2 bar cards" "bar cards on rows of their own" -- "$url" "$password" --spec "$spec" --css "$tmp/solo.css"
# The pair kept but not stretched: Memory and Storage end at different heights.
printf '%s\n' '#view:has(> .cbi-section) { align-items: flex-start !important; }' > "$tmp/start.css"
expect "desktop-light same-row card bottoms: measured" "paired cards not stretched" -- "$url" "$password" --spec "$spec" --css "$tmp/start.css"

if [[ $failures -ne 0 ]]; then
	echo "$failures test(s) failed"
	exit 1
fi
echo "all tests passed"
