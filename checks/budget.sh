#!/usr/bin/env bash
# Size budget of what the package ships.
#
#   checks/budget.sh [htdocs dir]      (default htdocs)
#
# The five stylesheets together <= 151,000 bytes as shipped: each is measured
# after scripts/strip-css-comments.pl, the step the package build runs, so a
# comment costs nothing and a rule costs its bytes (plan decision 13). The
# three theme scripts together <= 35,300 bytes as they are. Exit 1 over either.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
htdocs=${1:-$root/htdocs}
css_max=151000
js_max=35300

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

total=0
for f in theme menu progressbar; do
	total=$((total + $(wc -c <"$htdocs/luci-static/resources/$f-aster.js")))
done
if [ "$total" -gt "$js_max" ]; then
	echo "FAIL scripts: $total B > $js_max"
	fail=1
else
	echo "ok   scripts: $total B <= $js_max"
fi
exit $fail
