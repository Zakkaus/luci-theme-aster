#!/usr/bin/env bash
# Tests for scripts/tokens.mjs: the committed tokens.css passes --check, and
# each way of breaking it fails with exit 1 and names the cause. Works on
# copies in a temporary directory; the repository is not modified.
# Needs node_modules (npm ci) for the core defaults.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
styles="$root/htdocs/luci-static/aster"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

# expect <exit code> <text the output must contain, or ""> <label> -- <args...>
expect() {
	local want=$1 text=$2 label=$3 got=0
	shift 4
	node "$root/scripts/tokens.mjs" "$@" >"$tmp/out" 2>&1 || got=$?
	if [[ $got -ne $want ]] || { [[ -n $text ]] && ! grep -qF -- "$text" "$tmp/out"; }; then
		echo "FAIL $label: exit $got (want $want), output:"
		sed 's/^/    /' "$tmp/out"
		failures=$((failures + 1))
	else
		echo "ok   $label: exit $got${text:+, says \"$text\"}"
	fi
}

copy() {
	mkdir -p "$tmp/$1"
	cp "$styles"/{tokens,components,shell,theme,luci}.css "$tmp/$1/"
}

expect 0 "up to date" "committed tokens.css" -- --check

copy nosuch
printf '\n.tokens-test { color: var(--no-such); }\n' >>"$tmp/nosuch/luci.css"
expect 1 "undefined: --no-such (read in luci.css)" "var(--no-such) in luci.css" -- --check --styles "$tmp/nosuch"

copy palettegap
printf '\n.tokens-test { color: var(--color-text-blue); }\n' >>"$tmp/palettegap/luci.css"
expect 1 "palette relay lacks colour tokens the stylesheets read: --color-text-blue" "a colour token no palette defines" -- --styles "$tmp/palettegap"

copy nofill
expect 1 "undefined: --font-weight-semibold" "core fill disabled" -- --skip-core-fill --styles "$tmp/nofill"

copy stale
sed -i 's/--spacing-4: 1rem;/--spacing-4: 1.1rem;/' "$tmp/stale/tokens.css"
expect 1 "is out of date" "hand-edited tokens.css" -- --check --styles "$tmp/stale"

copy deadlayout
cp "$root/design/layout.css" "$tmp/dead-layout.css"
sed -i 's/^:root {$/:root {\n  --aster-tokens-test-unused: 1px;/' "$tmp/dead-layout.css"
expect 1 "layout entries nothing reads (delete them): --aster-tokens-test-unused" "unread layout entry" -- --styles "$tmp/deadlayout" --layout "$tmp/dead-layout.css"

copy clash
cp "$root/design/layout.css" "$tmp/clash-layout.css"
sed -i 's/^:root {$/:root {\n  --spacing-4: 16px;/' "$tmp/clash-layout.css"
expect 1 "layout redefines theme tokens: --spacing-4" "layout redefining a theme token" -- --styles "$tmp/clash" --layout "$tmp/clash-layout.css"

if [[ $failures -ne 0 ]]; then
	echo "$failures test(s) failed"
	exit 1
fi
echo "all tests passed"
