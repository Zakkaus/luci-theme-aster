#!/usr/bin/env bash
# tokens.css is the only stylesheet that may hold colour literals or px values.
#
#   checks/literals.sh [stylesheet dir]      (default htdocs/luci-static/aster)
#
# Strict, exit 1 on any literal: components.css and shell.css as a whole, and
# every luci.css section whose header line ("/* ── Name") carries [ported].
# Reported only: theme.css and the luci.css sections not yet ported (M3).
#
# Comments are ignored. Only declaration values are scanned, so a selector
# such as #view or an attribute selector naming a colour is not counted.
# A literal is a hex colour, an rgb()/rgba()/hsl()/hsla()/hwb()/lab()/lch()/
# oklab()/oklch()/color() call, or a number with the px unit.
set -euo pipefail
dir=${1:-htdocs/luci-static/aster}

count() {  # stdin: CSS; prints "<n>\t<first literals>"
	perl -0777 -ne '
		s{/\*.*?\*/}{}gs;
		my @hits;
		while (/(?<![-\w])([-\w]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/g) {
			my ($p, $v) = ($1, $2);
			$v =~ s{url\([^)]*\)}{url()}g;   # data: URIs carry their own SVG attributes
			push @hits, "$p: $1" while $v =~ /(#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|(?<![-\w.])-?\d*\.?\d+px\b)/g;
		}
		printf "%d\t%s\n", scalar @hits, join(" | ", @hits[0 .. ($#hits < 2 ? $#hits : 2)]);
	'
}

fail=0
for f in components.css shell.css; do
	read -r n ex < <(count < "$dir/$f")
	if [ "$n" -gt 0 ]; then echo "FAIL $f: $n literal(s): $ex"; fail=1; else echo "ok   $f: 0"; fi
done

# luci.css, section by section.
total=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
awk -v d="$tmp" '
	/^\/\* ── / { i++; name = $0; sub(/^\/\* ── /, "", name); sub(/ *[─]+.*$/, "", name); print name "\t" d "/" i > d "/index" }
	{ print > (d "/" (i + 0)) }
' "$dir/luci.css"
[ -s "$tmp/0" ] && printf 'preamble\t%s\n' "$tmp/0" >> "$tmp/index"
while IFS=$'\t' read -r name file; do
	read -r n ex < <(count < "$file")
	if [[ $name == *"[ported]"* ]]; then
		if [ "$n" -gt 0 ]; then echo "FAIL luci.css $name: $n literal(s): $ex"; fail=1; else echo "ok   luci.css $name: 0"; fi
	elif [ "$n" -gt 0 ]; then
		echo "todo luci.css $name: $n"
		total=$((total + n))
	fi
done < "$tmp/index"

read -r n _ < <(count < "$dir/theme.css")
echo "todo theme.css: $n"
total=$((total + n))
echo "remaining literals outside ported sections: $total"
exit $fail
