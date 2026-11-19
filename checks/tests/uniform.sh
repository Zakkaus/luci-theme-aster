#!/usr/bin/env bash
# Negative tests for checks/uniform.mjs against a running device with the
# theme installed:
#
#   checks/tests/uniform.sh <base url> <password>
#
# Each case must exit 1 and say why: a page-list entry that does not exist,
# a wrong password, a canonical file with one value changed, and a
# stylesheet that changes one button's height on one page. Desktop, light
# only, to keep it short. Needs Playwright, as the gate does.
set -euo pipefail
source "$(dirname "$0")/gate-lib.sh"
url=$1 password=$2

printf 'admin/status/overview\nadmin/no/such/page\n' >"$tmp/missing.txt"
printf 'admin/status/overview require=card\n' >"$tmp/overview.txt"
printf 'admin/system/reboot require=button\n' >"$tmp/reboot.txt"
node -e '
	const fs = require("fs");
	const [src, out] = process.argv.slice(1);
	const c = JSON.parse(fs.readFileSync(src, "utf8"));
	c.classes.card.radius = 20;
	fs.writeFileSync(out, JSON.stringify(c));
' "$root/checks/uniform.json" "$tmp/canonical.json"

expect uniform "admin/no/such/page: HTTP 404" "page-list entry that 404s" -- "$url" "$password" --pages "$tmp/missing.txt"
expect uniform "(login): login returned 403" "wrong password" -- "$url" "$password-wrong" --pages "$tmp/overview.txt"
expect uniform "card radius" "canonical card radius changed to 20" -- "$url" "$password" --pages "$tmp/overview.txt" --canonical "$tmp/canonical.json"
expect uniform "50px (want 36px)" "one button 50px high on one page" -- "$url" "$password" --pages "$tmp/reboot.txt" \
	--debug-css 'admin/system/reboot=#view button:is(.cbi-button, .btn):not(td *, .td *) { block-size: 50px !important; min-block-size: 50px !important }'
finish
