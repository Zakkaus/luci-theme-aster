# Sourced by checks/tests/{uniform,contrast}.sh. expect runs one gate with
# the given arguments and passes when it exits 1 and its output contains the
# given text; anything else is a failed test.
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

# expect <gate> <text the output must contain> <label> -- <gate args...>
expect() {
	local gate=$1 text=$2 label=$3 got=0
	shift 4
	node "$root/checks/$gate.mjs" "$@" --viewports desktop --modes light >"$tmp/out" 2>"$tmp/err" || got=$?
	if [[ $got -ne 1 ]] || ! grep -qF -- "$text" "$tmp/out"; then
		echo "FAIL $label: exit $got (want 1), output:"
		tail -20 "$tmp/out" "$tmp/err" | sed 's/^/    /'
		failures=$((failures + 1))
	else
		echo "ok   $label: exit 1, says \"$text\""
	fi
}

finish() {
	if [[ $failures -ne 0 ]]; then
		echo "$failures test(s) failed"
		exit 1
	fi
	echo "all tests passed"
}
