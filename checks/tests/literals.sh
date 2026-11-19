#!/usr/bin/env bash
# Tests for checks/literals.sh: the committed stylesheets pass, and a colour
# or px literal in a strict place fails with exit 1 and names it, while one in
# a section not yet ported is only counted. Works on copies; the repository is
# not modified.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
styles="$root/htdocs/luci-static/aster"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

# expect <exit code> <text the output must contain> <label> <dir>
expect() {
	local want=$1 text=$2 label=$3 dir=$4 got=0
	bash "$root/checks/literals.sh" "$dir" >"$tmp/out" 2>&1 || got=$?
	if [[ $got -ne $want ]] || ! grep -qF -- "$text" "$tmp/out"; then
		echo "FAIL $label: exit $got (want $want), output:"
		sed 's/^/    /' "$tmp/out"
		failures=$((failures + 1))
	else
		echo "ok   $label: exit $got, says \"$text\""
	fi
}

copy() {
	mkdir -p "$tmp/$1"
	cp "$styles"/{tokens,components,shell,theme,luci}.css "$tmp/$1/"
}

expect 0 "ok   shell.css: 0" "committed stylesheets" "$styles"
base=$(bash "$root/checks/literals.sh" "$styles" | sed -n 's/^remaining literals outside ported sections: //p')

copy hex
printf '\n.literals-test { color: #fff; }\n' >>"$tmp/hex/shell.css"
expect 1 "FAIL shell.css: 1 literal(s): color: #fff" "hex colour in shell.css" "$tmp/hex"

copy px
printf '\n.literals-test { padding: 3px; }\n' >>"$tmp/px/components.css"
expect 1 "FAIL components.css: 1 literal(s): padding: 3px" "px in components.css" "$tmp/px"

copy rgb
sed -i 's|^\(/\* ── Tables \[ported\].*\)$|\1\n.literals-test { background: rgb(0 0 0 / 10%); }|' "$tmp/rgb/luci.css"
expect 1 "FAIL luci.css Tables [ported]: 1 literal(s): background: rgb(" "rgb() in a ported luci.css section" "$tmp/rgb"

copy todo
printf '\n/* ── Literals test ─── */\n.literals-test { margin: 5px; }\n' >> "$tmp/todo/luci.css"
expect 0 "remaining literals outside ported sections: $((base + 1))" "px in a section not yet ported is counted" "$tmp/todo"

copy comment
printf '\n/* .literals-test { color: #fff; padding: 3px; } */\n#fff { color: inherit; }\n' >>"$tmp/comment/shell.css"
expect 0 "ok   shell.css: 0" "comments and selectors are not values" "$tmp/comment"

if [[ $failures -ne 0 ]]; then
	echo "$failures test(s) failed"
	exit 1
fi
echo "all tests passed"
