#!/usr/bin/env bash
# Negative tests for the tab rules (checks/rules/tab.mjs: C6 Table, C7
# FoldedBlock, C10 RowActions, C20 EmptyState, G4 and G9 in data tables),
# run inside checks/tests/uniform.sh or alone:
#
#   checks/tests/tab.sh <base url> <password>
#
# The owner's screenshots of 2026-11-21 (OWNER-DEFECTS-2026-11-21.md) are
# put back with a stylesheet where CSS can; each case names the exact set
# of rules that must fail. Desktop and light unless a case says otherwise.
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
	set -euo pipefail
	source "$(dirname "$0")/gate-lib.sh"
	url=$1 password=$2
fi
printf '%s\n' 'admin/status/processes require=c6.table,c7.when,c10.actions,g.marker.table,g.mq' >"$tmp/tab-proc.txt"
printf '%s\n' 'admin/status/processes require=c7.sig,c7.x,c7.labelw,c7.actions,c7.when,g.marker.table' >"$tmp/tab-proc-phone.txt"
printf '%s\n' 'admin/status/routes require=c7.sig,c7.x,c7.labelw,c7.when' >"$tmp/tab-routes.txt"
printf '%s\n' 'admin/network/firewall/ipsets require=c20.empty' >"$tmp/tab-empty.txt"
printf '%s\n' 'admin/status/routes require=c7.when' >"$tmp/tab-when.txt"
printf '%s\n' 'admin/status/nftables require=c7.when,c20.empty' >"$tmp/tab-nft.txt"
printf '%s\n' 'admin/network/firewall/zones require=c6.table' >"$tmp/tab-zones.txt"
expect uniform 0 "" "Processes: a wide Table on the desktop" -- "$url" "$password" --pages "$tmp/tab-proc.txt"
expect uniform 0 "" "Processes: one FoldedBlock layout on a phone" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone
expect uniform 0 "" "IP sets: the compact EmptyState" -- "$url" "$password" --pages "$tmp/tab-empty.txt"

# Defect 11: row actions on the row line (no padding in the actions cell).
expect uniform 1 "c6.table *,table.row.button height,table.td.actions paddingBlock" "row actions on the row lines (defect 11)" -- "$url" "$password" --pages "$tmp/tab-proc.txt" \
	--debug-css 'admin/status/processes=#view .td.cbi-section-actions { padding-block: 0 !important }'
# C10: buttons 2 apart.
expect uniform 1 "c10.actions gap,space.control.row gap" "row actions 2 apart" -- "$url" "$password" --pages "$tmp/tab-proc.txt" \
	--debug-css 'admin/status/processes=#view .td.cbi-section-actions > div { gap: 2px !important } #view .td.cbi-section-actions > div > * { margin: 0 !important }'
# G4: a marker drawn before the first column's text.
expect uniform 1 "g.marker.table offset,table.row.button height" "marker before the identifier (defect 1, 5)" -- "$url" "$password" --pages "$tmp/tab-proc.txt" \
	--debug-css 'admin/status/processes=#view .tr > .td:first-child::before { content: ""; display: inline-block; inline-size: 8px; block-size: 8px; margin-inline-end: 8px }'
# C7 when: a table wider than its card left wide (the cell grows only
# outside theme-aster.js's measuring, which sets an inline width).
expect uniform 1 "c7.when state,overflow excess" "wide table that does not fit" -- "$url" "$password" --pages "$tmp/tab-when.txt" \
	--debug-css 'admin/status/routes=#view .table:not([style*="min-content"]) .tr > .td:nth-child(2) { min-inline-size: 1600px }'
# C7 when, G5: nftables on a phone measured with CJK breaking after any
# character, so its tables "fit" and stay wide, one glyph a line (a). The
# chain's 1px ::after resizes it, so theme-aster.js measures again.
expect uniform 1 "c7.when state,overflow excess,table.row.text height" "table measured with words broken (CJK)" -- "$url" "$password" --pages "$tmp/tab-nft.txt" --viewports phone \
	--debug-css 'admin/status/nftables=html #view .table[style*="min-content"] :is(.td, .th) { word-break: break-all !important } html #view .nft-chain::after { content: ""; display: block; block-size: 1px }'
# Zones: "lan => wan REJECT all others" as LuCI's column of boxes, three
# lines in a 360 column (c).
expect uniform 1 "c6.table run" "zone forwards stacked (c)" -- "$url" "$password" --pages "$tmp/tab-zones.txt" \
	--debug-css 'admin/network/firewall/zones=html #view .zone-forwards, html #view .zone-forwards > * { display: block !important }'
# WireGuard peers (e): a title's box with 1em margins, the first block 35
# above its title and 14 below (Interfaces' box here: a core page).
printf '%s\n' 'admin/network/network require=c7.sig' >"$tmp/tab-net.txt"
expect uniform 1 "c7.actions centre,c7.sig titleMargin" "title box with margins (e)" -- "$url" "$password" --pages "$tmp/tab-net.txt" --viewports phone \
	--debug-css 'admin/network/network=html #view [data-fold="fold"] .td > .ifacebox { margin-block: 15px !important }'
# Interfaces wide (b): the row's text 4 under its line beside buttons 8
# under it, so the row is 4 above its first line and 12 under its last.
printf '%s\n' 'admin/network/network' >"$tmp/tab-net-wide.txt"
expect uniform 1 "table.td.top paddingBlock" "interface row text off the buttons' centre (b)" -- "$url" "$password" --pages "$tmp/tab-net-wide.txt" --viewports desktop \
	--debug-css 'admin/network/network=html #view .tr:has(> .td > .ifacebox) > .td:not(.cbi-section-actions) { padding-block: 4px !important }'
# G9: a media query laying out table rows.
expect uniform 1 "g.mq blocks" "table layout by a media query" -- "$url" "$password" --pages "$tmp/tab-proc.txt" \
	--debug-css 'admin/status/processes=@media (min-width: 1px) { #view .table .tr { color: inherit } }'

# Defects 4 and 6: a block's top padding unlike its bottom.
expect uniform 1 "c7.sig blockPad,c7.sig firstPad" "block padding 24 / 12 (defects 4, 6)" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone \
	--debug-css 'admin/status/processes=#view [data-fold="fold"] .tr { padding-block-start: 24px !important }'
# Defect 6: the Divider drawn to the card edge.
expect uniform 1 "c7.sig divStart,c7.sig divEnd" "Divider to the card edge (defect 6)" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone \
	--debug-css 'admin/status/processes=#view [data-fold="fold"] .tr { margin-inline: -16px; padding-inline: 16px }'
# Defect 2: labels inline before their values ("目標 127.0.0.1").
expect uniform 1 "c7.x valueXs,c7.labelw fit" "inline labels, no label column (defect 2)" -- "$url" "$password" --pages "$tmp/tab-routes.txt" --viewports phone \
	--debug-css 'admin/status/routes=#view [data-fold="fold"] .tr > .td:not(:first-child) { display: block !important } #view [data-fold="fold"] .tr > .td .aster-v { display: inline !important } #view [data-fold="fold"] .tr > .td::before { margin-inline-end: 4px }'
# Defect 1: a label column wider than the table's longest label.
expect uniform 1 "c7.labelw fit" "label column 192 wide (defect 1)" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone \
	--debug-css 'admin/status/processes=#view [data-fold="fold"] { grid-template-columns: 192px minmax(0, 1fr) auto !important }'
# Defects 4 and 8: the actions on a line of their own under the block.
expect uniform 1 "c7.actions *" "actions on their own line (defects 4, 8)" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone \
	--debug-css 'admin/status/processes=#view [data-fold="fold"] .tr > .cbi-section-actions { grid-row: auto !important; grid-column: 1 / -1 !important; justify-self: start !important }'
# C20: the table's message 24 above and below, start-aligned.
expect uniform 1 "c20.empty *" "EmptyState padded 24, start-aligned" -- "$url" "$password" --pages "$tmp/tab-empty.txt" \
	--debug-css 'admin/network/firewall/ipsets=#view .tr.placeholder > .td { padding-block: 24px !important; text-align: start !important }'

[[ ${BASH_SOURCE[0]} == "$0" ]] && finish
true
