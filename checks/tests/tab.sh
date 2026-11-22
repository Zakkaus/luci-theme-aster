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
printf '%s\n' 'admin/status/processes require=g.break.table' >"$tmp/tab-proc-word.txt"
printf '%s\n' 'admin/status/routes require=c7.sig,c7.x,c7.labelw,c7.when' >"$tmp/tab-routes.txt"
printf '%s\n' 'admin/network/firewall/ipsets require=c20.empty' >"$tmp/tab-empty.txt"
printf '%s\n' 'admin/status/routes require=c7.when' >"$tmp/tab-when.txt"
printf '%s\n' 'admin/status/nftables require=c7.when,c20.empty' >"$tmp/tab-nft.txt"
printf '%s\n' 'admin/network/firewall/zones require=c6.table' >"$tmp/tab-zones.txt"
printf '%s\n' 'admin/system/startup require=c7.title' 'admin/status/routes require=c7.title' >"$tmp/tab-title.txt"
expect uniform 0 "" "Processes: a wide Table on the desktop" -- "$url" "$password" --pages "$tmp/tab-proc.txt"
expect uniform 0 "" "Processes: one FoldedBlock layout on a phone" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone
expect uniform 0 "" "IP sets: the compact EmptyState" -- "$url" "$password" --pages "$tmp/tab-empty.txt"
expect uniform 0 "" "Startup, Routes: folded by the column naming the row" -- "$url" "$password" --pages "$tmp/tab-title.txt" --viewports phone

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
expect uniform 1 "c7.when state,overflow excess,g.overflow conform" "wide table that does not fit" -- "$url" "$password" --pages "$tmp/tab-when.txt" \
	--debug-css 'admin/status/routes=#view .table:not([style*="min-content"]) .tr > .td:nth-child(2) { min-inline-size: 1600px }'
# C7 when, G5: nftables on a phone measured with CJK breaking after any
# character, so its tables "fit" and stay wide, one glyph a line (a); its
# clauses may wrap too (wide, they are one line). The table overflows its
# card and the broken rows grow past one text line. The chain's 1px ::after
# resizes it, so theme-aster.js measures again.
expect uniform 1 "c7.when state,g.overflow conform,overflow excess,table.row.text height" "table measured with words broken (CJK)" -- "$url" "$password" --pages "$tmp/tab-nft.txt" --viewports phone \
	--debug-css 'admin/status/nftables=html #view .table[style*="min-content"] :is(.td, .th, .td .ifacebadge) { word-break: break-all !important; white-space: normal !important } html #view .nft-chain::after { content: ""; display: block; block-size: 1px }'
# C7 when (audit 2, C7 A): Overview's leases kept on one line, so a host
# name that wraps at its spaces on DHCP's page folds the table here.
printf '%s\n' 'admin/status/overview require=c7.when' >"$tmp/tab-ov.txt"
expect uniform 1 "c7.when state" "lease host names measured unbroken (audit 2)" -- "$url" "$password" --pages "$tmp/tab-ov.txt" --viewports desktop \
	--debug-css 'admin/status/overview=html #view .table:is(.leases, .lases) .td:first-child { white-space: nowrap !important } html #view .table:is(.leases, .lases) .td:first-child::after { content: " wraps at every space of this long host name like a lease with its DNS name in parentheses, which DHCP shows wide and Overview should too (example.lan)" }'
# C6: LuCI's 60 % / 40 % nftables columns (audit 2, C6 B); squeezed, a
# rule's cells wrap and its row grows past one text line.
printf '%s\n' 'admin/status/nftables require=c6.table' >"$tmp/tab-nft-wide.txt"
expect uniform 1 "c6.table inlineWidth,table.row.text height" "nftables columns split 60 / 40 (audit 2)" -- "$url" "$password" --pages "$tmp/tab-nft-wide.txt" --viewports desktop \
	--debug-css 'admin/status/nftables=html body #view .nft-rules :is(.th, .td)[style*="60%"]:not(.cbi-section-actions) { width: 60% !important } html body #view .nft-rules :is(.th, .td)[style*="40%"]:not(.cbi-section-actions) { width: 40% !important }'
# Zones: "lan => wan REJECT all others" as LuCI's column of boxes, three
# lines in a 360 column (c).
expect uniform 1 "c6.table run" "zone forwards stacked (c)" -- "$url" "$password" --pages "$tmp/tab-zones.txt" \
	--debug-css 'admin/network/firewall/zones=html #view .zone-forwards, html #view .zone-forwards > * { display: block !important }'
# C7 title: Startup folded by its start priority instead of the script's
# name (g); the 15/400 number is no title, and the actions centre on it.
expect uniform 1 "c7.title column,c7.sig title,c7.actions centre" "folded by the start priority (g)" -- "$url" "$password" --pages "$tmp/tab-title.txt" --viewports phone \
	--debug-css 'admin/system/startup=#view [data-fold="fold"] .tr > .td[data-head] { display: grid !important; grid-row: auto !important; grid-column: 1 / -1 !important } #view [data-fold="fold"] .tr > .td:first-child { display: block !important; grid-row: 1 !important; grid-column: 1 / -2 !important }'
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
# Repository keys (d): the header's line stops over the actions column;
# the key scrolls inside its box (wide, and folded on a phone).
printf '%s\n' 'admin/system/admin/repokeys require=c6.table' >"$tmp/tab-keys.txt"
expect uniform 1 "c6.table headLine" "header line short of the card border (d)" -- "$url" "$password" --pages "$tmp/tab-keys.txt" --viewports desktop \
	--debug-css 'admin/system/admin/repokeys=html #view .cbi-section-table-titles::after { content: none !important }'
expect uniform 1 "c6.table read" "key cut in its box (d)" -- "$url" "$password" --pages "$tmp/tab-keys.txt" \
	--debug-css 'admin/system/admin/repokeys=html #view .td textarea[readonly] { field-sizing: fixed !important; inline-size: 8rem !important; block-size: 3rem !important }'
# G9: a media query laying out table rows.
expect uniform 1 "g.mq blocks" "table layout by a media query" -- "$url" "$password" --pages "$tmp/tab-proc.txt" \
	--debug-css 'admin/status/processes=@media (min-width: 1px) { #view .table .tr { color: inherit } }'

# Defects 4 and 6: a block's top padding unlike its bottom.
expect uniform 1 "c7.sig blockPad,c7.sig firstPad" "block padding 24 / 12 (defects 4, 6)" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone \
	--debug-css 'admin/status/processes=#view [data-fold="fold"] .tr { padding-block-start: 24px !important }'
# Defect 6: the Divider drawn to the card edge.
expect uniform 1 "c7.sig divStart,c7.sig divEnd,g.overflow conform" "Divider to the card edge (defect 6)" -- "$url" "$password" --pages "$tmp/tab-proc-phone.txt" --viewports phone \
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

# R5 (AUDIT2): identifiers whole in cells (G5), numbers end-aligned (C6),
# fields 8 off the row lines (G7).
printf '%s\n' 'admin/system/package-manager require=g.break.table,c6.table' >"$tmp/tab-pkg.txt"
printf '%s\n' 'admin/system/package-manager require=g.break.table' >"$tmp/tab-pkg0.txt"
expect uniform 0 "" "Packages: names whole" -- "$url" "$password" --pages "$tmp/tab-pkg0.txt" --viewports desktop
expect uniform 1 "g.break.table token" "package names broken at their hyphens (AUDIT2 G5)" -- "$url" "$password" --pages "$tmp/tab-pkg.txt" --viewports desktop \
	--debug-css 'admin/system/package-manager=#view #packages .td:first-child { white-space: normal !important } #view #packages .td.col-10 { overflow-wrap: normal !important }'
expect uniform 1 "c6.table numAlign" "CPU and memory shares start-aligned (AUDIT2 C6)" -- "$url" "$password" --pages "$tmp/tab-proc.txt" --viewports desktop \
	--debug-css 'admin/status/processes=#view .tr > .td:nth-child(4) { text-align: start !important }'
expect uniform 1 "c6.table fieldGap,table.td.field paddingBlock" "zone selects 6 from the row lines (AUDIT2 G7)" -- "$url" "$password" --pages "$tmp/tab-zones.txt" --viewports desktop \
	--debug-css 'admin/network/firewall/zones=#view .td.cbi-value-field { padding-block: 4px !important }'

# R6 (AUDIT3): an identifier whole in its cell (G5: A1 a lease's br-lan,
# a rule's name; A2 an nftables set member), a URL clipped to one line
# with its title (B4), a folded nftables match's clauses 8 apart (A2).
printf '%s\n' 'admin/status/overview require=g.break.table' >"$tmp/tab-leases.txt"
printf '%s\n' 'admin/network/firewall/rules require=g.break.table' >"$tmp/tab-fwr.txt"
printf '%s\n' 'admin/status/nftables require=g.break.table,c7.clause' >"$tmp/tab-nft-phone.txt"
expect uniform 0 "" "Leases: hosts and interfaces whole" -- "$url" "$password" --pages "$tmp/tab-leases.txt" --viewports desktop,phone
expect uniform 0 "" "Traffic rules: names whole on a phone" -- "$url" "$password" --pages "$tmp/tab-fwr.txt" --viewports phone
expect uniform 0 "" "nftables: clauses apart, set members whole on a phone" -- "$url" "$password" --pages "$tmp/tab-nft-phone.txt" --viewports phone
# A1: br-lan as "br-" over "lan", Pixel-10-Pro at its hyphens (spaced out
# so they do not fit their line).
expect uniform 1 "g.break.table word" "a lease's identifiers broken at their hyphens (AUDIT3 A1)" -- "$url" "$password" --pages "$tmp/tab-leases.txt" --viewports phone \
	--debug-css 'admin/status/overview=#view [id*="lease"] .td > .aster-v { white-space: normal !important; letter-spacing: 40px }'
# 25.12 only (it ships uqr.js): 24.10's rules have no names and its
# package descriptions no URL.
if curl -fsI "$url/luci-static/resources/uqr.js" >/dev/null 2>&1; then
	# A1: Allow-ICMPv6-Forward as "Allow-ICMPv6-" over "Forward" (the
	# owner's Allow-WireGuard-wgserver; spaced out so it does not fit).
	expect uniform 1 "g.break.table word" "a rule's name broken at its hyphens (AUDIT3 A1)" -- "$url" "$password" --pages "$tmp/tab-fwr.txt" --viewports phone \
		--debug-css 'admin/network/firewall/rules=#view [data-fold="fold"] .td.cbi-section-table-titles > .aster-v { white-space: normal !important; letter-spacing: 6px }'
	# B4: a description's URL broken inside its last path segment
	# (".../uci/ne" over "twork").
	expect uniform 1 "g.break.table word" "a URL broken inside a path segment (AUDIT3 B4)" -- "$url" "$password" --pages "$tmp/tab-pkg0.txt" --viewports phone \
		--debug-css 'admin/system/package-manager=#view .aster-id { display: inline !important; -webkit-line-clamp: none !important }'
fi
# A2: "0 B" run into the clause after it, set members broken after "mld-".
expect uniform 1 "c7.clause gap" "nftables clauses run together (AUDIT3 A2)" -- "$url" "$password" --pages "$tmp/tab-nft-phone.txt" --viewports phone \
	--debug-css 'admin/status/nftables=html #view .nft-rules[data-fold="fold"] .td .ifacebadge:not(.large) { margin-inline-end: 0 !important } html #view .nft-rules[data-fold="fold"] .td .ifacebadge:not(.large)::after { content: none !important }'
expect uniform 1 "g.break.table word" "nftables set members broken at their hyphens (AUDIT3 A2)" -- "$url" "$password" --pages "$tmp/tab-nft-phone.txt" --viewports phone \
	--debug-css 'admin/status/nftables=#view .nft-set-item { white-space: normal !important }'
# B4: a description's URL one line, clipped with its title.
expect uniform 0 "" "Packages: URLs one line on a phone" -- "$url" "$password" --pages "$tmp/tab-pkg0.txt" --viewports phone

# R7 (AUDIT4): a wide lease's identifiers whole (A1: 25.12's host broke
# in "(switchbot-hubminimatter-" over "6847c8.lan)"), a folded network's
# title its name, not its "SSID" label (B3).
# A1: the host column 64 wide, so its name breaks at its hyphens while the
# table stays wide.
expect uniform 1 "g.break.table token,g.break.table word" "a wide lease's host broken at its hyphens (AUDIT4 A1)" -- "$url" "$password" --pages "$tmp/tab-leases.txt" --viewports desktop \
	--debug-css 'admin/status/overview=#view #status_leases .td:first-child { white-space: normal !important; max-width: 64px }'
# B3, only on a box with a wireless config (LuCI has no Wireless page
# without one: 404): the "SSID" label back before the name.
if has_page admin/network/wireless; then
	# The lab's radios are absent, so their short rows fit a phone: a wide
	# status 400 wide folds the table.
	printf '%s\n' 'admin/network/wireless require=c7.title' >"$tmp/tab-wifi.txt"
	fold='#view [data-fold="wide"] .td[data-name="_stat"] > div { min-width: 400px }'
	expect uniform 0 "" "Wireless: a network's title is its name on a phone" -- "$url" "$password" --pages "$tmp/tab-wifi.txt" --viewports phone \
		--debug-css "admin/network/wireless=$fold"
	expect uniform 1 "c7.title lead" "a network's title led by its SSID label (AUDIT4 B3)" -- "$url" "$password" --pages "$tmp/tab-wifi.txt" --viewports phone \
		--debug-css "admin/network/wireless=$fold #view .td[data-name=\"_stat\"] .nowrap > strong { display: inline !important }"
else
	echo "skip Wireless network titles (AUDIT4 B3): no Wireless page on this box"
fi

# AUDIT5 known (AUDIT4 B2): a process' command keeps a hyphenated word
# (an option, pppoe-wan, /lib/netifd/ppp6-up) whole on a phone; squeezed
# to 1ch and broken anywhere, its words (uhttpd's "-f") break. A station's
# rate (HE-MCS) is the same rule; the lab's radios have no stations.
expect uniform 0 "" "Processes: hyphenated words whole on a phone" -- "$url" "$password" --pages "$tmp/tab-proc-word.txt" --viewports phone
expect uniform 1 "g.break.table word" "a command broken inside its hyphenated words (AUDIT4 B2)" -- "$url" "$password" --pages "$tmp/tab-proc-word.txt" --viewports phone \
	--debug-css 'admin/status/processes=#view .td > [style*=word-break] { display: inline-block; max-width: 1ch; overflow-wrap: anywhere }'

# AUDIT5 B1: a static lease with no hostname is titled by its IPv4 address
# (else its MAC), not by LuCI's "none" placeholder. 25.12 lists static
# leases on the first tab, 24.10 on its "leases" tab. LEASES=1: the box has
# such a lease (one host section with ip and mac but no name).
if curl -fsI "$url/luci-static/resources/uqr.js" >/dev/null 2>&1; then lt=''; else lt=' tab=leases'; fi
printf 'admin/network/dhcp%s require=c7.title\n' "$lt" >"$tmp/tab-static.txt"
expect uniform 0 "" "static leases: each title names its lease" -- "$url" "$password" --pages "$tmp/tab-static.txt" --viewports phone
if [[ ${LEASES:-0} = 1 ]]; then
	expect uniform 1 "c7.title column" "an unnamed lease titled by its placeholder (AUDIT5 B1)" -- "$url" "$password" --pages "$tmp/tab-static.txt" --viewports phone \
		--debug-css 'admin/network/dhcp=#view [data-fold="fold"] .tr > [data-name=name] { display: block !important } #view [data-fold="fold"] .tr > [data-name=ip] { grid-row: auto !important }'
fi

[[ ${BASH_SOURCE[0]} == "$0" ]] && finish
true
