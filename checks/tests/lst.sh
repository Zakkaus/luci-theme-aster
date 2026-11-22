#!/usr/bin/env bash
# Negative tests for the lst rules (checks/rules/lst.mjs: C8, C13-C16, G4,
# G5, G10 outside data tables), run inside checks/tests/uniform.sh or alone:
#
#   checks/tests/lst.sh <base url> <password>
#
# The owner's screenshots of 2026-11-21 (OWNER-DEFECTS-2026-11-21.md) are
# put back with a stylesheet where CSS can; each case names the exact set
# of rules that must fail. Desktop and light unless a case says otherwise.
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
	set -euo pipefail
	source "$(dirname "$0")/gate-lib.sh"
	url=$1 password=$2
fi
net='admin/network/network require=c8.ifstatus,c8.kv,c8.x,c8.tracks,g.break,g.colon,c15.dot,c16.icon,c13.badge,c14.token'
printf '%s\n' "$net" >"$tmp/lst-net.txt"
expect uniform 0 "" "Interfaces: status cell one list, own-device dot" -- "$url" "$password" --pages "$tmp/lst-net.txt" --viewports desktop,phone

# Defect 8: the status cell as LuCI's multi-track grid of label-on-top
# items with values breaking anywhere ("2400:a842:f3f9::1/ | 60",
# "(432089 封 | 包)"), on a phone-width cell.
expect uniform 1 "c8.ifstatus *,c8.kv *,c8.x *,g.break broken" "Interfaces status grid breaking tokens (defect 8)" -- "$url" "$password" --pages "$tmp/lst-net.txt" \
	--debug-css 'admin/network/network=[id$="-ifc-description"] { grid-template-columns: repeat(auto-fill, minmax(4rem, 1fr)) !important } [id$="-ifc-description"] > .nowrap { display: block !important } [id$="-ifc-description"] .aster-v { display: block; overflow-wrap: anywhere !important; word-break: normal !important; text-overflow: clip !important }'
# Defect 8: lan grey while up. Every interface's dot neutral.
expect uniform 1 "c8.ifstatus dot,c15.dot ink" "Interfaces dot grey while up (defect 8)" -- "$url" "$password" --pages "$tmp/lst-net.txt" \
	--debug-css 'admin/network/network=#view .ifacebox > .ifacebox-head::before { background: var(--color-icon-secondary) !important }'
# A StatusDot drawn 10 px.
expect uniform 1 "c15.dot size" "StatusDot 10 px" -- "$url" "$password" --pages "$tmp/lst-net.txt" \
	--debug-css 'admin/network/network=#view .ifacebox > .ifacebox-head::before { inline-size: 10px !important; block-size: 10px !important }'
# Defect 8: LuCI's device bitmaps shown again.
expect uniform 1 "c16.icon legacy,icon legacy" "legacy device image shown (defect 8)" -- "$url" "$password" --pages "$tmp/lst-net.txt" \
	--debug-css 'admin/network/network=#view .ifacebox-body > .cbi-tooltip-container > img { display: inline !important; inline-size: 16px }'

# G4 (defects 5, 8): the interface's dot before its name again.
expect uniform 1 "g.marker offset,g.marker.table offset" "Interfaces dot before the name (G4)" -- "$url" "$password" --pages "$tmp/lst-net.txt" \
	--debug-css 'admin/network/network=#view .ifacebox > .ifacebox-head::before { order: -1 !important }'

# Audit2 C8: each interface's list with its own label column (wan6's
# values 26 left of lan's in one table).
expect uniform 1 "c8.x *" "Interfaces lists with their own label columns (audit2 C8)" -- "$url" "$password" --pages "$tmp/lst-net.txt" \
	--debug-css 'admin/network/network=html #view [id$="-ifc-description"] > .nowrap > strong { min-inline-size: 0 !important }'
# Audit2 C13: on a phone the box column 1 % wide and the zone Badge rigid:
# "區域 lan 的部" cut with a square end.
expect uniform 1 "c13.badge clipped" "Interfaces zone Badge cut (audit2 C13)" -- "$url" "$password" --pages "$tmp/lst-net.txt" --viewports phone \
	--debug-css 'admin/network/network=html #view .table .tr:has(> .td > .ifacebox) > .td:first-child { inline-size: 1% !important } html #view .ifacebox > .ifacebox-head::after { flex: none !important }'

ov='admin/status/overview require=c8.kv,c8.x,c8.bar,g.colon,g.marker,c16.icon,c13.badge,c25.tile'
printf '%s\n' "$ov" >"$tmp/lst-ov.txt"
expect uniform 0 "" "Overview: port tiles, upstream and radio lists" -- "$url" "$password" --pages "$tmp/lst-ov.txt"
# C25 / G4 (defect 10): a dot before a port's or a radio's name (the
# port's state is its start icon, in its own column; no dot follows).
expect uniform 1 "g.marker offset" "Overview dot before a port or radio name (G4)" -- "$url" "$password" --pages "$tmp/lst-ov.txt" \
	--debug-css 'admin/status/overview=#view .ifacebox > .ifacebox-head:first-child::before { content: "" !important; display: inline-block !important; inline-size: 8px !important; margin-inline-end: 8px !important }'
# C25 (owner 2026-11-23): a port's name 3 px below its row's (lan1 under
# wan); a tile padded off the small Card's 12 16 (a bare one: any).
expect uniform 1 "c25.tile lines" "Overview port name off its tile's top (C25)" -- "$url" "$password" --pages "$tmp/lst-ov.txt" \
	--debug-css 'admin/status/overview=#view .ifacebox:has(img[src*="/port_"]) > .ifacebox-head:first-child { margin-block-start: 3px !important }'
expect uniform 1 "c25.tile surface" "Overview port tile padded 6 (C25)" -- "$url" "$password" --pages "$tmp/lst-ov.txt" \
	--debug-css 'admin/status/overview=#view .ifacebox:has(img[src*="/port_"]) { padding-block-start: 6px !important }'

nft='admin/status/nftables require=c8.kv,c8.x,g.colon,c13.badge,c16.icon'
printf '%s\n' "$nft" >"$tmp/lst-nft.txt"
expect uniform 0 "" "nftables: hook list, clauses as text" -- "$url" "$password" --pages "$tmp/lst-nft.txt"
# Defect 3: every clause a filled pill.
expect uniform 1 "c13.badge *" "nftables clauses as filled pills (defect 3)" -- "$url" "$password" --pages "$tmp/lst-nft.txt" \
	--debug-css 'admin/status/nftables=.nft-rules .td > .ifacebadge { background: var(--color-background-muted) !important; border-radius: 999px !important }'
# Defect 7's shape: the hook line as one sentence, no label column.
expect uniform 1 "c8.kv *,c8.x *" "nftables hook as one line (C8)" -- "$url" "$password" --pages "$tmp/lst-nft.txt" \
	--debug-css 'admin/status/nftables=.nft-chain-hook > ul { display: block !important }'

# Audit2 C19 in C8: the value right-aligned over a bar under the name too.
expect uniform 1 "c8.bar layout" "Overview bar value at the end (audit2 C19)" -- "$url" "$password" --pages "$tmp/lst-ov.txt" \
	--debug-css 'admin/status/overview=html #view .cbi-progressbar::before { text-align: end !important }'

bw='admin/status/realtime/bandwidth require=c8.kv,g.colon'
printf '%s\n' "$bw" >"$tmp/lst-bw.txt"
expect uniform 0 "" "Realtime legend as a list" -- "$url" "$password" --pages "$tmp/lst-bw.txt"
# Audit #4: a legend value off its label's line.
expect uniform 1 "c8.kv layout,c8.kv align" "Realtime legend value off its label (audit #4)" -- "$url" "$password" --pages "$tmp/lst-bw.txt" \
	--debug-css 'admin/status/realtime/bandwidth=#view .table:not(:has(.th)) .td:nth-child(even) { position: relative; top: 12px }'

ssh='admin/system/admin/sshkeys require=c7.keys'
printf '%s\n' "$ssh" >"$tmp/lst-ssh.txt"
expect uniform 0 "" "SSH keys: C7 blocks, name over type and key" -- "$url" "$password" --pages "$tmp/lst-ssh.txt" --viewports desktop,phone
# Audit2 (A): each key a Token chip, name glued to its type, the key to the
# chip's edge, chips as wide as their words.
expect uniform 1 "c7.keys *" "SSH keys as Tokens (audit2 A)" -- "$url" "$password" --pages "$tmp/lst-ssh.txt" \
	--debug-css 'admin/system/admin/sshkeys=[data-page] .cbi-dynlist > .item { display: inline-flex !important; align-self: start !important; background: var(--color-background-muted) !important } [data-page] .cbi-dynlist > .item > small > code { text-overflow: clip !important; overflow: visible !important }'

fw='admin/network/firewall/zones require=c13.badge
admin/network/firewall/rules require=c13.badge'
printf '%s\n' "$fw" >"$tmp/lst-fw.txt"
expect uniform 0 "" "Firewall: verdicts and this device as text" -- "$url" "$password" --pages "$tmp/lst-fw.txt"
# Audit2 (B): "REJECT all others" and "this device" drawn as zone pills.
head -1 "$tmp/lst-fw.txt" >"$tmp/lst-fwz.txt"; tail -1 "$tmp/lst-fw.txt" >"$tmp/lst-fwr.txt"
expect uniform 1 "c13.badge stray" "Firewall zone verdicts as pills (audit2 B)" -- "$url" "$password" --pages "$tmp/lst-fwz.txt" \
	--debug-css 'admin/network/firewall/zones=html body .zonebadge.zonebadge.zonebadge-empty { background: var(--color-neutral) !important; padding-inline: 8px !important }'
expect uniform 1 "c13.badge stray" "Firewall rules' this device as a pill (audit2 B)" -- "$url" "$password" --pages "$tmp/lst-fwr.txt" \
	--debug-css 'admin/network/firewall/rules=html body .zonebadge.zonebadge:has(> em:only-child) { background: var(--color-neutral) !important; padding-inline: 8px !important }'

edit='admin/network/network modal=interface-edit require=g.marker,c16.icon'
printf '%s\n' "$edit" >"$tmp/lst-edit.txt"
expect uniform 0 "" "Interface editor: Status list on the field's edge" -- "$url" "$password" --pages "$tmp/lst-edit.txt" --viewports desktop,phone
# Audit3 B5: the device icon before the Status list again, a 28 px gutter
# the other fields do not have.
expect uniform 1 "g.marker offset" "Interface editor Status icon in a leading gutter (audit3 B5)" -- "$url" "$password" --pages "$tmp/lst-edit.txt" --viewports phone \
	--debug-css 'admin/network/network=html body .ifacebadge.large { display: flex !important; gap: var(--spacing-3) } html body .ifacebadge.large::before { content: ""; flex: none; inline-size: var(--aster-icon-md); block-size: var(--aster-icon-md); background: var(--color-icon-secondary) }'

# The changes dialog on a phone: a quoted value that fits its line moves
# whole after the "=" (audit4 B5), not "'Allow-" | "Audit'". The dialog is
# in no page list yet; its legend and buttons are hidden here, and the list's
# code face and filled lines are its other hits (not judged here).
chg='admin/network/network=html body .uci-dialog > .cbi-section > :not(.uci-change-list) { display: none !important }'
printf '%s\n' 'admin/network/network modal=changes require=g.break' >"$tmp/lst-chg.txt"
expect uniform 1 "font.body fontFamily,frame nested" "Changes dialog: values whole" -- "$url" "$password" --pages "$tmp/lst-chg.txt" --viewports desktop,phone --debug-css "$chg"
expect uniform 1 "font.body fontFamily,frame nested,g.break value" "Changes dialog value split at its hyphen (audit4 B5)" -- "$url" "$password" --pages "$tmp/lst-chg.txt" --viewports phone \
	--debug-css "$chg" --debug-css 'admin/network/network=html body .uci-change-list strong { display: inline !important }'

# nlbw's summary below its pies on a phone starts at the card content edge
# (audit4 B4), not centred 114 px in. Only on a box whose nlbw page exists;
# the page is in no page list yet, so its host table is hidden here, and
# English's "4 hosts" sentences are an inline list.
if has_page admin/services/nlbw/display; then
	nlbw='admin/services/nlbw/display=html body #view :is(table, .table) { display: none !important }'
	printf '%s\n' 'admin/services/nlbw/display require=c8.x' >"$tmp/lst-nlbw.txt"
	expect uniform 1 "c8.kv layout" "nlbw summary on the card edge" -- "$url" "$password" --pages "$tmp/lst-nlbw.txt" --viewports phone --debug-css "$nlbw"
	expect uniform 1 "c8.kv layout,c8.x edge" "nlbw summary centred below the pies (audit4 B4)" -- "$url" "$password" --pages "$tmp/lst-nlbw.txt" --viewports phone \
		--debug-css "$nlbw" --debug-css 'admin/services/nlbw/display=html body .head > div.kpi { justify-content: center !important }'
else
	echo "skip nlbw summary (audit4 B4): no nlbw page on this box"
fi

[[ ${BASH_SOURCE[0]} == "$0" ]] && finish
true
