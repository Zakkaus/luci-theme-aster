#!/usr/bin/env bash
# Size budget of what the package ships.
#
#   checks/budget.sh [htdocs dir]      (default htdocs)
#
# The five stylesheets together <= 154,000 bytes as shipped: each is measured
# after scripts/strip-css-comments.pl, the step the package build runs, so a
# comment costs nothing and a rule costs its bytes (plan decision 13). The
# two theme scripts together <= 23,000 bytes as shipped: luci.mk runs every
# script through LuCI's jsmin (LUCI_MINIFY_JS, on by default), so this
# measures jsmin's output too. jsmin is not in this repository (its licence
# is not Apache-2.0): build LuCI's modules/luci-base/src/jsmin.c and put it
# on PATH or name it in JSMIN. Exit 1 over either, or without jsmin.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
htdocs=${1:-$root/htdocs}
css_max=154000
js_max=23000
jsmin=${JSMIN:-$(command -v jsmin || true)}

fail=0
src=0
total=0
for f in tokens theme shell components luci; do
	file="$htdocs/luci-static/aster/$f.css"
	s=$(wc -c <"$file")
	n=$(perl "$root/scripts/strip-css-comments.pl" <"$file" | wc -c)
	printf '     %-15s %7d B shipped (%d B source)\n' "$f.css" "$n" "$s"
	src=$((src + s))
	total=$((total + n))
done
if [ "$total" -gt "$css_max" ]; then
	echo "FAIL stylesheets: $total B shipped > $css_max ($src B source)"
	fail=1
else
	echo "ok   stylesheets: $total B shipped <= $css_max ($src B source)"
fi

if [ -z "$jsmin" ] || [ ! -x "$jsmin" ]; then
	echo "FAIL scripts: no jsmin (build LuCI's modules/luci-base/src/jsmin.c; PATH or JSMIN)"
	exit 1
fi
src=0
total=0
for f in theme menu; do
	file="$htdocs/luci-static/resources/$f-aster.js"
	s=$(wc -c <"$file")
	n=$("$jsmin" <"$file" | wc -c)
	printf '     %-15s %7d B shipped (%d B source)\n' "$f-aster.js" "$n" "$s"
	src=$((src + s))
	total=$((total + n))
done
if [ "$total" -gt "$js_max" ]; then
	echo "FAIL scripts: $total B shipped > $js_max ($src B source)"
	fail=1
else
	echo "ok   scripts: $total B shipped <= $js_max ($src B source)"
fi
exit $fail
