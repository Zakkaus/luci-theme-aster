#!/usr/bin/env bash
# Tests for scripts/strip-css-comments.pl and checks/budget.sh: the stripper
# removes comments and keeps "/*" inside strings, url() and data: URIs; the
# budget counts a large rule and not a large comment. Works on copies; the
# repository is not modified.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
strip="$root/scripts/strip-css-comments.pl"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; failures=$((failures + 1)); }

# stripped <label> <input> <expected output>
stripped() {
	local got
	got=$(printf '%s' "$2" | perl "$strip")
	if [[ $got == "$3" ]]; then
		pass "$1"
	else
		fail "$1: got"
		printf '%s\n' "$got" | sed 's/^/    /'
	fi
}

stripped "whole-line comment and its line" \
	$'/* head */\n.a { color: red; }\n' $'.a { color: red; }'
stripped "multi-line comment" \
	$'.a {}\n/* one\n   two */\n.b {}\n' $'.a {}\n.b {}'
stripped "comment after a declaration" \
	$'.a { color: red; } /* why */\n' $'.a { color: red; }'
stripped "blank lines left behind collapse" \
	$'.a {}\n\n/* x */\n\n.b {}\n' $'.a {}\n\n.b {}'
stripped "/* in a double-quoted string" \
	$'.a::before { content: "/*"; }\n.b { color: red; }\n' $'.a::before { content: "/*"; }\n.b { color: red; }'
stripped "comment in a single-quoted string" \
	$'.a::before { content: \'/* x */\'; }\n' $'.a::before { content: \'/* x */\'; }'
stripped "escaped quote before /* in a string" \
	$'.a::before { content: "\\"/*"; } /* x */\n' $'.a::before { content: "\\"/*"; }'
stripped "/* in an unquoted url()" \
	$'.a { background: url(/a/*/b.png); }\n' $'.a { background: url(/a/*/b.png); }'
stripped "/* in an unquoted data: URI" \
	$'.a { --i: url(data:image/svg+xml;utf8,<svg>/*</svg>); } /* x */\n' $'.a { --i: url(data:image/svg+xml;utf8,<svg>/*</svg>); }'
stripped "comment in a quoted data: URI" \
	$'.a { --i: url("data:image/svg+xml,<svg>/* x */</svg>"); }\n' $'.a { --i: url("data:image/svg+xml,<svg>/* x */</svg>"); }'
stripped "quote inside a comment" \
	$'/* don\'t */\n.a { content: "x"; }\n' $'.a { content: "x"; }'
stripped "comment between two tokens stays a boundary" \
	$'.a { border: 1px/* w */solid; }\n' $'.a { border: 1px/**/solid; }'

# The shipped sheets equal the source with only comments gone: same bytes
# outside comments (perl's own comment removal, which ignores strings, agrees
# because no source string holds "/*"), and no "/*" left.
for f in "$root"/htdocs/luci-static/aster/*.css; do
	got=$(perl "$strip" <"$f" | tr -d ' \t\n')
	want=$(perl -0777 -pe 's{/\*.*?\*/}{}gs' <"$f" | tr -d ' \t\n')
	if [[ $got == "$want" ]] && ! grep -qF '/*' <<<"$got"; then
		pass "$(basename "$f"): only comments and blank space removed"
	else
		fail "$(basename "$f"): stripped output differs outside comments"
	fi
done

# expect <exit code> <text the output must contain> <label> <htdocs>
expect() {
	local want=$1 text=$2 label=$3 dir=$4 got=0
	bash "$root/checks/budget.sh" "$dir" >"$tmp/out" 2>&1 || got=$?
	if [[ $got -ne $want ]] || ! grep -qF -- "$text" "$tmp/out"; then
		fail "$label: exit $got (want $want), output:"
		sed 's/^/    /' "$tmp/out"
	else
		pass "$label: exit $got, says \"$text\""
	fi
}

copy() {
	mkdir -p "$tmp/$1/luci-static"
	cp -r "$root/htdocs/luci-static/aster" "$root/htdocs/luci-static/resources" "$tmp/$1/luci-static/"
}

expect 0 "ok   stylesheets" "committed stylesheets" "$root/htdocs"
base=$(bash "$root/checks/budget.sh" | sed -n 's/^ok   stylesheets: \([0-9]*\) B.*/\1/p')

# 200,000 bytes of comment: the source grows past the budget, shipped does not.
copy comment
{ printf '/*'; head -c 200000 /dev/zero | tr '\0' 'c'; printf '*/\n'; } >>"$tmp/comment/luci-static/aster/luci.css"
expect 0 "ok   stylesheets: $base B shipped" "a large comment does not count" "$tmp/comment"

# A rule as large as the room left: shipped goes past the budget.
copy rule
room=$((151000 - base + 1))
{ printf '.budget-test{--x:"'; head -c "$room" /dev/zero | tr '\0' 'r'; printf '"}\n'; } >>"$tmp/rule/luci-static/aster/luci.css"
expect 1 "FAIL stylesheets" "a large rule counts" "$tmp/rule"

copy js
head -c 35300 /dev/zero | tr '\0' ' ' >>"$tmp/js/luci-static/resources/theme-aster.js"
expect 1 "FAIL scripts" "a script over the budget" "$tmp/js"

if [[ $failures -ne 0 ]]; then
	echo "$failures test(s) failed"
	exit 1
fi
echo "all passed"
