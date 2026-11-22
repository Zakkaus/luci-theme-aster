# Sourced by checks/tests/{uniform,contrast}.sh. expect runs one gate and
# passes when its exit code is the one wanted and the JSON report's failed
# rules are exactly the ones named: the named rule failed and no other did.
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

# The failed rule ids in a gate's JSON report, one a line:
#   uniform   "<class> <property>" per outlier, "missing <class>" per
#             required class with no sample, "error" for any error;
#   contrast  the failure's kind (text, large, ui, field-border, focus,
#             separator), "waived:<kind>" for a waived one, "error".
rules() {
	node -e '
		const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
		const ids = new Set();
		if (r.errors.length) ids.add("error");
		if (r.gate === "uniform") {
			for (const o of r.outliers) ids.add(`${o.cls} ${o.prop}`);
			for (const m of r.missing) ids.add(`missing ${m.cls}`);
		} else {
			for (const f of r.failures) ids.add(f.kind);
			for (const f of r.waived) ids.add(`waived:${f.kind}`);
		}
		console.log([...ids].sort().join("\n"));
	' "$1"
}

# expect <gate> <exit> <rules> <label> [<text>] -- <gate args...>
#   <rules>  the failed rule ids, comma-separated, "" for none; * in one
#            stands for one dotted segment ("button.*.md height").
#   <text>   optional: the text report must also contain it.
# Desktop and light unless the arguments say otherwise.
expect() {
	local gate=$1 want=$2 rules_want=$3 label=$4 text='' got=0
	shift 4
	if [[ $1 != -- ]]; then text=$1; shift; fi
	shift
	rm -f "$tmp/json"
	node "$root/checks/$gate.mjs" --viewports desktop --modes light "$@" --json "$tmp/json" >"$tmp/out" 2>"$tmp/err" || got=$?
	local have='(no JSON report)'
	[[ -s $tmp/json ]] && have=$(rules "$tmp/json" | paste -sd, -)
	local ok=1
	[[ $got -eq $want ]] || ok=0
	[[ -z $text ]] || grep -qF -- "$text" "$tmp/out" || ok=0
	node -e '
		const [want, have] = process.argv.slice(1).map((s) => (s ? s.split(",") : []));
		const re = (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^. ]+")}$`);
		const pats = want.map(re);
		const ok = have.every((h) => pats.some((p) => p.test(h))) && pats.every((p) => have.some((h) => p.test(h)));
		process.exit(ok ? 0 : 1);
	' "$rules_want" "$have" || ok=0
	if [[ $ok -eq 1 ]]; then
		echo "ok   $label: exit $got, failed rules {$have}${text:+, says \"$text\"}"
	else
		echo "FAIL $label: exit $got (want $want), failed rules {$have} (want {$rules_want})${text:+, want \"$text\"}"
				tail -n 20 "$tmp/out" "$tmp/err" | sed 's/^/    /' || true
		failures=$((failures + 1))
	fi
}

# has_page <path>: the page answers 200 when logged in (LuCI drops a page
# whose package or config the box lacks, e.g. Wireless with no wireless
# config: 404). Box-dependent cases run only where it exists.
has_page() {
	[[ $(curl -s -o /dev/null -w '%{http_code}' -c "$tmp/jar" -b "$tmp/jar" -L -d luci_username=root --data-urlencode "luci_password=$password" "$url/cgi-bin/luci/$1") = 200 ]]
}

finish() {
	if [[ $failures -ne 0 ]]; then
		echo "$failures test(s) failed"
		exit 1
	fi
	echo "all tests passed"
}
