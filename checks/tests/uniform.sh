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
printf 'admin/system/admin/dropbear\n' >"$tmp/dropbear.txt"
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

# Dark: a card fill that only dark mode gets wrong. (Not the overview: a
# fill there would turn its frameless port band into a card as well.)
expect uniform 1 "card background" "dark card fill changed" -- "$url" "$password" --pages "$tmp/dropbear.txt" --modes dark \
	--debug-css 'admin/system/admin/dropbear=#view .cbi-section { background-color: rgb(0, 0, 0) !important }'

# Content wider than its card: the rule 26d0959 dropped, put back. It made
# the interfaces table 15,200 px wide inside its card; the page itself did
# not overflow, so only the overflow rule sees it.
expect uniform 1 "overflow excess" "interfaces table wider than its card" -- "$url" "$password" --pages "$tmp/network.txt" \
	--debug-css 'admin/network/network=.table:has([style*="min-width"]) { min-inline-size: max-content; }'

# A rule under a card's last row: Diagnostics' tool cells (one row in a
# card-framed table) drawing their row rule again.
printf 'admin/network/diagnostics\n' >"$tmp/diagnostics.txt"
expect uniform 0 "" "no rule under a card's last row" -- "$url" "$password" --pages "$tmp/diagnostics.txt"
expect uniform 1 "card lastRule" "rule under a card's last row" "(want none)" -- "$url" "$password" --pages "$tmp/diagnostics.txt" \
	--debug-css 'admin/network/diagnostics=#view .table .tr > .td { border-block-end: 1px solid rgb(0, 0, 0) !important }'

# Raw glyphs: a Select's ▾ shown again instead of its chevron icon.
printf 'admin/system/system\n' >"$tmp/system.txt"
expect uniform 1 "glyph raw" "raw ▾ glyph shown" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-dropdown > .open { font-size: 15px !important }'
# The save bar over the page again: the main column runs under it.
expect uniform 1 "footer overlap" "save bar covering the page" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.shell-main { margin-block-end: 0 !important }'

# Side nav: rows set flush again (the hovered row touched the selected one).
expect uniform 1 "nav.item gap" "side nav rows with no gap" "0px (want 2px)" -- "$url" "$password" --pages "$tmp/reboot.txt" \
	--debug-css 'admin/system/reboot=.nav, .nav-group { gap: 0 !important }'

# Tooltip: words wider than the box (a route's JSON ran out of it). Needs a
# tooltip on the overview: 25.12's lease rows carry one, 24.10 draws none.
node "$root/checks/uniform.mjs" "$url" "$password" --pages "$tmp/overview.txt" --viewports desktop --modes light --json "$tmp/tip.json" >/dev/null 2>&1 || true
if node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.exit(Object.keys(r.distributions).some((k) => k.startsWith("tooltip overflow")) ? 0 : 1)' "$tmp/tip.json" 2>/dev/null; then
	expect uniform 1 "tooltip overflow" "tooltip text runs out of its box" -- "$url" "$password" --pages "$tmp/overview.txt" \
		--debug-css 'admin/status/overview=.cbi-tooltip { max-inline-size: 40px !important; overflow-wrap: normal !important }'
else
	echo "skip tooltip text runs out of its box: no tooltip on the overview"
fi

# Status dialog: its icon drawn on the first words (the revert notice).
printf 'admin/system/reboot modal=status-notice require=banner.icon\n' >"$tmp/status.txt"
expect uniform 0 "" "status dialog icon before its words" -- "$url" "$password" --pages "$tmp/status.txt"
expect uniform 1 "banner.icon gap" "status dialog icon on its words" -- "$url" "$password" --pages "$tmp/status.txt" \
	--debug-css 'admin/system/reboot=#modal_overlay > .alert-message { padding-inline-start: 16px !important }'

# Lua CBI map (APPS=1: a box with OpenClash, as apps-install.sh leaves it).
# A header table in a Lua map folds on a phone like a JS view's, and the
# gate reads it as a fold; a row drawn as a flex column instead of the
# fold's grid looks the same but is not the component.
if [[ ${APPS:-0} = 1 ]]; then
	printf 'admin/services/openclash/proxy-providers-file-manage require=table@rows\n' >"$tmp/lua.txt"
	expect uniform 0 "" "Lua tables fold on a phone" -- "$url" "$password" --pages "$tmp/lua.txt" --viewports phone
	expect uniform 1 "table.fold.row display" "Lua table row not the fold's grid" -- "$url" "$password" --pages "$tmp/lua.txt" --viewports phone \
		--debug-css 'admin/services/openclash/proxy-providers-file-manage=form > .cbi-map .table .tr:has(> .td) { display: flex !important; flex-direction: column }'
fi
finish
