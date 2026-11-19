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

copy nofill
expect 1 "undefined: --font-weight-semibold" "core fill disabled" -- --skip-core-fill --styles "$tmp/nofill"

copy stale
sed -i 's/--spacing-4: 1rem;/--spacing-4: 1.1rem;/' "$tmp/stale/tokens.css"
expect 1 "is out of date" "hand-edited tokens.css" -- --check --styles "$tmp/stale"

copy dead
cp "$root/design/bridge.css" "$tmp/dead-bridge.css"
sed -i 's/^:root {$/:root {\n  --tokens-test-unused: 1px;/' "$tmp/dead-bridge.css"
expect 1 "nothing reads (delete them): --tokens-test-unused" "unread bridge entry" -- --styles "$tmp/dead" --bridge "$tmp/dead-bridge.css"

if [[ $failures -ne 0 ]]; then
	echo "$failures test(s) failed"
	exit 1
fi
echo "all tests passed"
