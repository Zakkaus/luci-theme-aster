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
# Raw glyphs: the overview's ▲ / ▼ traffic arrows shown as characters
# again instead of the ArrowUp / ArrowDown icons.
printf 'admin/status/overview\n' >"$tmp/overview.txt"
expect uniform 1 "glyph raw" "raw ▲ glyph shown" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=.aster-glyph { font-size: 13px !important }'
# The save bar over the page again: the main column runs under it.
expect uniform 1 "footer overlap" "save bar covering the page" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.shell-main { margin-block-end: 0 !important }'
# The last line 9 above the save bar: the footer's bottom padding cut (the
# router measure's 9-9.6 was a viewport artifact, normal and read-only
# sessions alike; this is the fault it would be). The margin keeps the
# column scrolling, so the check applies.
expect uniform 1 "space.page.bar gap" "last block 9 above the save bar" "(want 24px)" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.shell-footer { padding-block-end: 9px !important; margin-block-start: 1000px !important }'

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

# Spacing contract (space.*): one region or page-level gap off on one page.
printf 'admin/network/network modal=interface-edit\n' >"$tmp/iface-edit.txt"
printf 'admin/system/flash\n' >"$tmp/flash.txt"
expect uniform 1 "space.page.inset padding" "page inset 32 on top" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=.shell-content { padding-block-start: 32px !important }'
expect uniform 1 "space.title.desc gap" "page title 12 over its description" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-map-descr { margin-block-start: 12px !important }'
expect uniform 1 "space.title.next gap" "page title 40 over the first block" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=.shell-inner > h2 { margin-block-end: 40px !important }'
expect uniform 1 "space.tabs.content gap" "tabs 24 over their content" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-tabmenu { margin-block-end: 24px !important }'
expect uniform 1 "space.tabs.item gap" "tabs 8 apart" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-tabmenu { gap: 8px !important }'
expect uniform 1 "space.block gap" "a Remove row 24 over its section" -- "$url" "$password" --pages "$tmp/dropbear.txt" \
	--debug-css 'admin/system/admin/dropbear=.cbi-section-remove { margin-block-end: 24px !important }'
expect uniform 1 "space.card.pad padding" "card content 8 lower" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#view > .cbi-section > :first-child { margin-block-start: 8px !important }'
# A row of cards (Memory and Storage) is read at its tallest card's end.
expect uniform 1 "space.card.pad padding" "paired cards 16 more under their content" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#view > .cbi-section:has(.cbi-progressbar) > :last-child { margin-block-end: 16px !important }'
# A card alone on its row (System) is not stretched: its own bottom counts.
expect uniform 1 "space.card.pad padding" "lone card 16 more under its content" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#view > .cbi-section:first-of-type > :last-child { margin-block-end: 16px !important }'
# A bare <p> under the title (Routing) is the page's description.
printf 'admin/status/routes\n' >"$tmp/routes.txt"
expect uniform 1 "space.title.desc gap" "Routing's description 12 under the title" -- "$url" "$password" --pages "$tmp/routes.txt" \
	--debug-css 'admin/status/routes=#view > h2 + p { margin-block-start: 12px !important }'
# 25.12 puts the card's h3 in a title row (24 inside it), 24.10 not (24
# under it, over the content's 16).
expect uniform 1 "space.heading.content gap" "card title keeps a margin" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#view > .cbi-section > .cbi-title > h3, #view > .cbi-section > h3 { margin-block-end: 24px !important }'
expect uniform 1 "space.descr.content gap" "section description 24 over its content" -- "$url" "$password" --pages "$tmp/flash.txt" \
	--debug-css 'admin/system/flash=.cbi-section .cbi-section-descr { margin-block-end: 24px !important }'
expect uniform 1 "space.formrow.pad padding" "form rows pad 12" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-value { padding-block: 12px !important }'
expect uniform 1 "space.label.field inline" "label 24 before its field" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-value { column-gap: 24px !important }'
expect uniform 1 "space.label.field stacked" "phone: label 8 over its field" -- "$url" "$password" --pages "$tmp/system.txt" --viewports phone \
	--debug-css 'admin/system/system=.cbi-value > .cbi-value-title { margin-block-end: 8px !important }'
expect uniform 1 "space.field.help gap" "help 8 under its field" -- "$url" "$password" --pages "$tmp/dropbear.txt" \
	--debug-css 'admin/system/admin/dropbear=.cbi-value-description { margin-block-start: 8px !important }'
expect uniform 1 "space.control.row gap" "save bar buttons 16 apart" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-page-actions { gap: 16px !important }'
expect uniform 1 "space.dialog gap" "dialog footer 8 under the form" -- "$url" "$password" --pages "$tmp/iface-edit.txt" \
	--debug-css 'admin/network/network=#modal_overlay .button-row { margin-block-start: 8px !important }'

# Tooltip contents: a key/value list (the DHCPv6 statistics; the gate
# builds one in the overview's upstream box) in the tooltip's ink, a line
# at most two lines high.
expect uniform 1 "tooltip ink" "a page key colour inside a tooltip" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=.cbi-tooltip strong { color: var(--color-text-secondary) !important }'
expect uniform 1 "tooltip lines" "a tooltip line three lines high" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=.cbi-tooltip .nowrap { display: block !important; padding-block: 24px !important }'

expect uniform 1 "tooltip words" "a tooltip at its min-content width, a letter a line" -- "$url" "$password" --pages "$tmp/rules.txt" \
	--debug-css 'admin/network/firewall/rules=.cbi-tooltip { inline-size: min-content !important; min-inline-size: 0 !important }'

# Tabs: only the active pane shows (the JS tab panes stacked on first load).
expect uniform 1 "tabs.pane shown" "every tab pane shown" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=[data-tab-title]:not([data-tab-active="true"]) { display: block !important }'

# Tabs: the strip wrapping onto two lines (24.10 DHCP's 14 at 1440).
expect uniform 1 "tabs.list lines" "the tab strip on two lines" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-tabmenu { flex-wrap: wrap !important; max-inline-size: 240px }'

# Dynlist: the + under its field (the add row wrapping).
printf 'admin/system/system tab=timesync\n' >"$tmp/timesync.txt"
expect uniform 1 "dynlist add" "dynlist + under its field" -- "$url" "$password" --pages "$tmp/timesync.txt" \
	--debug-css 'admin/system/system=.cbi-dynlist > .add-item { flex-wrap: wrap !important } .cbi-dynlist > .add-item > input { flex: 0 0 100% !important }'

# Button variants by meaning: Sync with browser filled; Save filled beside Save & Apply.
printf 'admin/system/system\n' >"$tmp/system-only.txt"
expect uniform 1 "button.field variant" "a form row's action filled" -- "$url" "$password" --pages "$tmp/system-only.txt" \
	--debug-css 'admin/system/system=.cbi-value-field .cbi-button-apply:first-child { --button-bg: var(--color-accent) !important }'
expect uniform 1 "button.primary perGroup" "Save filled beside Save & Apply" -- "$url" "$password" --pages "$tmp/system-only.txt" \
	--debug-css 'admin/system/system=.cbi-page-actions > .cbi-button-save { --button-bg: var(--color-accent) !important }'

# Row actions: a row's buttons stacked (Interfaces' Restart, Stop, Edit, Delete).
printf 'admin/status/processes\n' >"$tmp/processes.txt"
expect uniform 1 "table.actions lines" "a row's actions on two lines" -- "$url" "$password" --pages "$tmp/processes.txt" \
	--debug-css 'admin/status/processes=.td > div:has(> :is(.btn, .cbi-button)) { flex-wrap: wrap !important; max-inline-size: 100px }'
printf 'admin/system/startup\n' >"$tmp/startup.txt"
expect uniform 1 "table.actions lines" "phone: Startup's five wrapped, no more menu" -- "$url" "$password" --pages "$tmp/startup.txt" --viewports phone \
	--debug-css 'admin/system/startup=#view .cbi-section-actions > div { flex-wrap: wrap !important } #view .cbi-section-actions > div > * { display: inline-flex !important } #view .aster-more { display: none !important }'

# Headings: a size outside Astryx's levels; an <abbr>'s dotted rule.
printf 'admin/status/nftables\n' >"$tmp/nftables.txt"
printf 'admin/system/leds\n' >"$tmp/leds.txt"
expect uniform 1 "heading level" "a chain title at 17" -- "$url" "$password" --pages "$tmp/nftables.txt" \
	--debug-css 'admin/status/nftables=.nft-chain h4 { font-size: 17px !important }'
expect uniform 1 "heading abbr" "a dotted <abbr> in the LED title" -- "$url" "$password" --pages "$tmp/leds.txt" \
	--debug-css 'admin/system/leds=h2 abbr { text-decoration: underline dotted !important }'

# Icons: LuCI's device image showing; a zone's inline colour.
expect uniform 1 "icon legacy" "the editor's Status image" -- "$url" "$password" --pages "$tmp/iface-edit.txt" \
	--debug-css 'admin/network/network=#modal_overlay .ifacebadge.large > img { display: inline !important }'
printf 'admin/network/firewall/zones\n' >"$tmp/zones.txt"
expect uniform 1 "zone fill" "zone chips in LuCI's inline colours" -- "$url" "$password" --pages "$tmp/zones.txt" \
	--debug-css 'admin/network/firewall/zones=html .zonebadge[style] { background-color: rgb(var(--zone-color-rgb)) !important }'

# Frames: a form row framed inside its card.
expect uniform 1 "frame nested" "a form row framed inside its card" -- "$url" "$password" --pages "$tmp/system.txt" \
	--debug-css 'admin/system/system=.cbi-value { box-shadow: 0 0 0 1px var(--color-border) !important }'

# A dynlist value as a padded full-width row again (the router's 4/36/4/12
# box), not a Token; a graph's black frame back inside its card; a card's
# own save bar keeping its divider and fill on a phone (Startup).
printf 'admin/system/system tab=timesync\n' >"$tmp/timesync.txt"
expect uniform 1 "frame nested" "dynlist value as a filled row" -- "$url" "$password" --pages "$tmp/timesync.txt" \
	--debug-css 'admin/system/system=html .cbi-dynlist > .item { display: block !important; block-size: auto !important; min-block-size: 32px !important; padding: 4px 36px 4px 12px !important }'
# The same value as a filled row the field's width, with no block padding
# and the Token's height: still a frame (a Token is as wide as its words).
expect uniform 1 "frame nested" "dynlist value as a full-width row" -- "$url" "$password" --pages "$tmp/timesync.txt" \
	--debug-css 'admin/system/system=html .cbi-dynlist > .item { display: flex !important; flex: 1 0 100% !important }'
printf 'admin/status/realtime/load\n' >"$tmp/load.txt"
expect uniform 1 "frame nested" "graph framed inside its card" -- "$url" "$password" --pages "$tmp/load.txt" \
	--debug-css 'admin/status/realtime/load=#view#view#view div[style*="border:1px solid #000"] { border: 1px solid rgb(0, 0, 0) !important }'
printf 'admin/system/startup tab=rc\n' >"$tmp/startup-rc.txt"
expect uniform 1 "frame nested" "card's save bar a band on a phone" -- "$url" "$password" --pages "$tmp/startup-rc.txt" --viewports phone \
	--debug-css 'admin/system/startup=#view .cbi-page-actions { border-block-start: 1px solid rgb(0, 0, 0) !important }'

# Dialog: a tall one runs past the window; the save bar over the scrim.
expect uniform 1 "dialog fits" "dialog taller than the window" -- "$url" "$password" --pages "$tmp/iface-edit.txt" \
	--debug-css 'admin/network/network=#modal_overlay > .modal { max-block-size: none !important }'
expect uniform 1 "dialog scrim" "save bar over the dialog's scrim" -- "$url" "$password" --pages "$tmp/iface-edit.txt" \
	--debug-css 'admin/network/network=.cbi-page-actions { z-index: 200 !important }'

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
