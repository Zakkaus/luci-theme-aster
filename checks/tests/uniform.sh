#!/usr/bin/env bash
# Negative tests for checks/uniform.mjs against a running device with the
# theme installed:
#
#   checks/tests/uniform.sh <base url> <password>
#
# Each case names the exit code and the exact set of rules that must fail
# (checks/tests/gate-lib.sh), so a case passes only when the rule it breaks
# is the one that fails. Desktop and light unless a case says otherwise.
# Needs Playwright, as the gate does.
set -euo pipefail
source "$(dirname "$0")/gate-lib.sh"
url=$1 password=$2

printf 'admin/status/overview\nadmin/no/such/page\n' >"$tmp/missing.txt"
printf 'admin/status/overview\n' >"$tmp/overview.txt"
printf 'admin/system/reboot require=button\n' >"$tmp/reboot.txt"
printf 'admin/system/reboot require=button,checkbox\n' >"$tmp/reboot-checkbox.txt"
printf 'admin/network/firewall/rules require=table@rows\n' >"$tmp/rules.txt"
printf 'admin/network/network\n' >"$tmp/network.txt"
node -e '
	const fs = require("fs");
	const [src, out] = process.argv.slice(1);
	const c = JSON.parse(fs.readFileSync(src, "utf8"));
	c.classes.card.radius = 20;
	fs.writeFileSync(out, JSON.stringify(c));
' "$root/checks/uniform.json" "$tmp/canonical.json"

# Errors.
expect uniform 1 error "page-list entry that 404s" "admin/no/such/page: HTTP 404" -- "$url" "$password" --pages "$tmp/missing.txt"
expect uniform 1 error "wrong password" "(login): login returned 403" -- "$url" "$password-wrong" --pages "$tmp/overview.txt"

# The baseline the cases below break: a valid page with every class it requires.
expect uniform 0 "" "valid page, valid list" -- "$url" "$password" --pages "$tmp/reboot.txt"

# A canonical value and a stylesheet: one component off on one page.
expect uniform 1 "card radius" "canonical card radius changed to 20" -- "$url" "$password" --pages "$tmp/overview.txt" --canonical "$tmp/canonical.json"
expect uniform 1 "button.*.md height" "one button 50px high on one page" "50px (want 36px)" -- "$url" "$password" --pages "$tmp/reboot.txt" \
	--debug-css 'admin/system/reboot=#view button:is(.cbi-button, .btn):not(td *, .td *) { block-size: 50px !important; min-block-size: 50px !important }'

# A valid page that does not draw a class the list requires.
expect uniform 1 "missing checkbox" "required class the page lacks" -- "$url" "$password" --pages "$tmp/reboot-checkbox.txt"

# Phone: a table with data rows whose rows the phone CSS hides is missing
# its table (table@rows), though an empty table would be exempt.
expect uniform 1 "missing table" "phone hides a table's data rows" "the page's tables hold" -- "$url" "$password" --pages "$tmp/rules.txt" --viewports phone \
	--debug-css 'admin/network/firewall/rules=#view .table .tr:not(.placeholder):has(> .td) { display: none !important }'

# Dark: a card fill that only dark mode gets wrong.
expect uniform 1 "card background" "dark card fill changed" -- "$url" "$password" --pages "$tmp/overview.txt" --modes dark \
	--debug-css 'admin/status/overview=#view > .cbi-section { background-color: rgb(0, 0, 0) !important }'

# Content wider than its card: the rule 26d0959 dropped, put back. It made
# the interfaces table 15,200 px wide inside its card; the page itself did
# not overflow, so only the overflow rule sees it.
expect uniform 1 "overflow excess" "interfaces table wider than its card" -- "$url" "$password" --pages "$tmp/network.txt" \
	--debug-css 'admin/network/network=.table:has([style*="min-width"]) { min-inline-size: max-content; }'
finish
