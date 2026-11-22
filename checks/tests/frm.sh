#!/usr/bin/env bash
# Negative tests for the frm rules (checks/rules/frm.mjs: C1-C5, C9, C17-C20,
# C22, G1, G3, G6, G7, G8, G10), run inside checks/tests/uniform.sh or alone:
#
#   checks/tests/frm.sh <base url> <password>
#
# Each case breaks one rule on one page with a stylesheet and names the
# exact set of rules that must fail; the owner's and the visual audit's
# defects of 2026-11-21 are put back where CSS can. Desktop and light
# unless a case says otherwise.
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
	set -euo pipefail
	source "$(dirname "$0")/gate-lib.sh"
	url=$1 password=$2
fi
printf 'admin/system/system require=g.px,g.overflow,g.inset,g.nested,g.textx,c2.card,c3.heading,c4.tabs,c5.form,c9.button\n' >"$tmp/frm-sys.txt"
printf 'admin/network/network\n' >"$tmp/frm-net.txt"
printf 'admin/status/realtime/bandwidth require=c4.tabs\n' >"$tmp/frm-bw.txt"
printf 'admin/status/overview require=c19.progress\n' >"$tmp/frm-ov.txt"
printf 'admin/system/flash require=c22.divider\n' >"$tmp/frm-flash.txt"
printf 'admin/network/network modal=interface-edit require=c18.dialog\n' >"$tmp/frm-dialog.txt"
printf 'admin/status/nftables require=c2.card,g.nested\n' >"$tmp/frm-nft.txt"
printf 'admin/system/crontab require=c1.descr\n' >"$tmp/frm-cron.txt"
printf 'admin/system/admin/dropbear require=c3.heading\n' >"$tmp/frm-drop.txt"
printf 'admin/network/firewall/zones require=c9.button\n' >"$tmp/frm-zones.txt"
printf 'admin/status/routes require=c3.heading\n' >"$tmp/frm-routes.txt"
printf 'admin/status/realtime/connections require=c1.header\n' >"$tmp/frm-conn.txt"
expect uniform 0 "" "System: every frame rule measures and holds" -- "$url" "$password" --pages "$tmp/frm-sys.txt" --viewports desktop,phone

# G1: a form row's gap off the spacing scale.
expect uniform 1 "g.px conform" "row gap 6 (G1)" "row-gap 6px" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-value { row-gap: 6px !important }'
# G6: a field wider than its card.
expect uniform 1 "g.overflow conform,overflow *" "card title wider than its card (G6)" "card" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-section > h3 { min-inline-size: 1600px }'
# G7, owner defect 11: the Add button 4 above its card's border.
expect uniform 1 "g.inset conform,space.block gap,space.card.pad padding" "Add button on the card border (defect 11)" "card 4px" -- "$url" "$password" --pages "$tmp/frm-net.txt" \
	--debug-css 'admin/network/network=#view .cbi-section-create { position: relative; top: 12px }'
# G8: a form row drawn as a box inside the card.
expect uniform 1 "g.nested conform,frame nested" "form row filled inside a card (G8)" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-value { background: rgb(200, 0, 0); border-radius: 8px }'
# G3: a card heading 8 in from the content edge.
expect uniform 1 "g.textx conform" "heading off the card edge (G3)" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-section > h3 { padding-inline-start: 8px }'
# C2: a card 12 round.
expect uniform 1 "c2.card conform,card radius" "card radius 12 (C2)" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-section { border-radius: 12px !important }'
# C3: a card title at 20.
expect uniform 1 "c3.heading conform,heading.card *,heading level" "card title 20 (C3)" "card size" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-section > h3 { font-size: 20px !important }'
# C9, audit #12: a form row's button at the small height.
expect uniform 1 "c9.button conform,button.*.md height" "form button 32 (C9, audit #12)" "height md" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-value-field .cbi-button { block-size: 32px !important; min-block-size: 32px !important }'
# C4, audit #8: the second tab level drawn as large as the page's tabs
# (two rows that read as one double menu).
expect uniform 1 "c4.tabs conform,tab.sm height" "second tab level md (audit #8)" -- "$url" "$password" --pages "$tmp/frm-bw.txt" \
	--debug-css 'admin/status/realtime/bandwidth=#view .cbi-tabmenu > li > a { min-block-size: 36px !important }'
# C4, audit #7: the fade mask back at the list ends.
expect uniform 1 "c4.tabs conform" "tab list fade mask (audit #7)" "mask" -- "$url" "$password" --pages "$tmp/frm-bw.txt" \
	--debug-css 'admin/status/realtime/bandwidth=#view .cbi-tabmenu { mask-image: linear-gradient(to right, black 90%, transparent) }'
# C5: form rows 4 above and below.
expect uniform 1 "c5.form conform,space.formrow.pad padding" "form row padding 4 (C5)" "padding-top 4px" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-value { padding-block: 4px !important }'
# C18: a dialog 24 inside.
expect uniform 1 "c18.dialog conform,space.dialog gap" "dialog padding 24 (C18)" -- "$url" "$password" --pages "$tmp/frm-dialog.txt" \
	--debug-css 'admin/network/network=#modal_overlay > .modal { padding: 24px !important }'
# C19: a 12 track (Overview's is the ::after under its text).
expect uniform 1 "c19.progress conform" "progress bar 12 high (C19)" -- "$url" "$password" --pages "$tmp/frm-ov.txt" \
	--debug-css 'admin/status/overview=#view .cbi-progressbar::after { block-size: 12px !important }'
# AUDIT5 B2: a phone's value text cut with an ellipsis ("247.23 MiB /
# 6.98 GiB (…"; spaced out so every value is too long for its column).
expect uniform 1 "c19.progress conform" "bar value text ellipsized (AUDIT5 B2)" "cut" -- "$url" "$password" --pages "$tmp/frm-ov.txt" --viewports phone \
	--debug-css 'admin/status/overview=#view .cbi-progressbar::before { white-space: nowrap !important; overflow: hidden; text-overflow: ellipsis; letter-spacing: 4px }'
# C22: a Divider drawn 2 thick.
expect uniform 1 "c22.divider conform" "Divider 2 thick (C22)" -- "$url" "$password" --pages "$tmp/frm-flash.txt" \
	--debug-css 'admin/system/flash=#view .cbi-value + .cbi-value > .cbi-section { border-block-start-width: 2px }'
# C22, audit R5: the Divider of Flash's flat sections back 24 under the
# row above (its row's 8 not taken back).
expect uniform 1 "c22.divider conform" "Flash Divider 24 under the row above (C22)" "above" -- "$url" "$password" --pages "$tmp/frm-flash.txt" \
	--debug-css 'admin/system/flash=#view .cbi-value:has(> .cbi-section) + .cbi-value > .cbi-section { margin-block-start: 0 !important }'
# C2/G8, audit R5: nftables' chains framed again inside the table's card.
# 25.12's chain is a padded section, so its border also puts its padding
# off the scale (g.px); 24.10's is not (g.* conform admits both).
expect uniform 1 "g.nested conform,g.* conform,frame nested" "nft chain framed in its table card (C2, G8)" -- "$url" "$password" --pages "$tmp/frm-nft.txt" \
	--debug-css 'admin/status/nftables=#view .nft-chain { border: 1px solid rgb(200, 0, 0) !important; border-radius: 16px !important }'
# C1, audit #14 / R5: a card title repeating the selected tab drawn again;
# it is no SectionHeading either, nor spaced as one from the content.
expect uniform 1 "c1.header conform,c3.heading conform,space.heading.content gap" "card title repeats the tab (C1)" "repeats" -- "$url" "$password" --pages "$tmp/frm-net.txt" \
	--debug-css 'admin/network/network=#view .cbi-section > h3.aster-said { display: block !important }'
# C1, audit R5: the page description at the card description's size.
expect uniform 1 "c1.descr conform" "page description 13/20 (C1)" "page size" -- "$url" "$password" --pages "$tmp/frm-cron.txt" \
	--debug-css 'admin/system/crontab=#view h2 + .cbi-section-descr { font-size: 13px !important; line-height: 20px !important }'
# G10 (g.label) and C20 (c20.upright) have no negative here: the colon is
# text theme-aster.js removes, and the lab pages are English.

# C11, audit2: the save bar in LuCI's order, Save & Apply first.
expect uniform 1 "c9.button conform" "save bar Save & Apply first (C11, audit2)" "save bar last" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=.cbi-page-actions > * { order: 0 !important }'
# C18, audit2: a dialog's confirm before its secondaries.
expect uniform 1 "c18.dialog conform" "dialog confirm first (C18, audit2)" "confirm last" -- "$url" "$password" --pages "$tmp/frm-dialog.txt" \
	--debug-css 'admin/network/network=#modal_overlay .button-row { flex-direction: row-reverse }'
# C10, audit2: a section's Remove alone on a row under its heading.
expect uniform 1 "c3.heading conform,space.heading.content gap" "Remove on its own row (C10, audit2)" "remove row" -- "$url" "$password" --pages "$tmp/frm-drop.txt" \
	--debug-css 'admin/system/admin/dropbear=#view .cbi-section { display: block !important }'
# C5, audit2: the local time's buttons wrapped 4 under it (phone).
expect uniform 1 "c5.form conform" "buttons 4 under their field (C5, audit2)" "button wrap gap" -- "$url" "$password" --pages "$tmp/frm-sys.txt" --viewports phone \
	--debug-css 'admin/system/system=#view .cbi-value > .cbi-value-field { row-gap: 4px !important }'
# C5, audit2: the read-only local time held at the field width and cut
# (a box's time is short: spaced out to the router's length).
expect uniform 1 "c5.form conform" "read-only value cut (C5, audit2)" "read-only value" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view #localtime { field-sizing: fixed !important; inline-size: 256px !important; letter-spacing: 6px }'
# C5, audit2: the Notes text area across the row.
expect uniform 1 "c5.form conform" "labelled text area full row (C5, audit2)" "textarea width" -- "$url" "$password" --pages "$tmp/frm-sys.txt" \
	--debug-css 'admin/system/system=#view .cbi-value-field > div:has(> textarea) { inline-size: 100% !important; flex-basis: 100% !important }'
# C9, audit2: the drag handle a filled secondary.
expect uniform 1 "c9.button conform" "drag handle filled (C9, audit2)" "drag handle fill" -- "$url" "$password" --pages "$tmp/frm-zones.txt" \
	--debug-css 'admin/network/firewall/zones=#view .drag-handle { --button-bg: var(--color-neutral) }'
# C3, audit3 B1: Routing's tables, one card without a title, headed at
# two sizes (Neighbours 18, Routes and Rules Heading 4).
expect uniform 1 "c3.heading conform,heading.card *" "routing table headings at two sizes (C3, audit3 B1)" "card size" -- "$url" "$password" --pages "$tmp/frm-routes.txt" \
	--debug-css 'admin/status/routes=#view .cbi-section > h3 ~ h3 { font-size: var(--text-heading-4-size) !important }'
# G5, audit3 B2: a dialog title broken inside a word.
expect uniform 1 "c18.dialog conform" "dialog title broken in a word (G5, audit3 B2)" "title word" -- "$url" "$password" --pages "$tmp/frm-dialog.txt" --viewports phone \
	--debug-css 'admin/network/network=#modal_overlay > .modal > h4 { inline-size: 24px; word-break: break-all !important }'
# C1, audit3 B3: Connections' filter against its DNS switch (phone).
expect uniform 1 "c1.header conform" "toolbar controls touching (C1, audit3 B3)" "toolbar gap" -- "$url" "$password" --pages "$tmp/frm-conn.txt" --viewports phone \
	--debug-css 'admin/status/realtime/connections=#settings-row { gap: 0 !important }'

# C1, audit4 C2: a range as wide as the pager less one arrow (zh-TW on a
# phone) takes its own line and the arrows wrap as a pair; without Prev's
# reserve, Next wraps alone.
printf '%s\n' 'admin/system/package-manager require=c1.header' >"$tmp/frm-pager.txt"
pager='admin/system/package-manager=#view .pager > .text { min-inline-size: calc(100% - 60px) }'
expect uniform 0 "" "pager arrows wrap as a pair" -- "$url" "$password" --pages "$tmp/frm-pager.txt" --viewports phone --debug-css "$pager"
expect uniform 1 "c1.header conform" "Next page alone under Previous (audit4 C2)" "pager arrows" -- "$url" "$password" --pages "$tmp/frm-pager.txt" --viewports phone \
	--debug-css "$pager" --debug-css 'admin/system/package-manager=#view .pager > :is(.prev, .next) { margin-inline: 0 !important }'

# C3, audit4 C1: an inner heading (Flash's Backup, Restore, Flash image;
# the overview's leases on 25.12) is 16, not the body's 15 (Heading 4 as
# the scale's base size).
printf 'admin/system/flash require=c3.heading\n' >"$tmp/frm-inner.txt"
expect uniform 0 "" "inner headings 16 (C3)" -- "$url" "$password" --pages "$tmp/frm-inner.txt" --viewports desktop,phone
expect uniform 1 "c3.heading conform" "inner headings at the body's 15 (audit4 C1)" "inner size" -- "$url" "$password" --pages "$tmp/frm-inner.txt" \
	--debug-css 'admin/system/flash=:root { --text-heading-4-size: var(--font-size-base) !important }'

# C5, audit5 C1: Router Password's reveal buttons wrapped alone under their
# fields (phone).
printf 'admin/system/admin require=c5.form\n' >"$tmp/frm-pw.txt"
expect uniform 0 "" "reveal beside its password field (C5)" -- "$url" "$password" --pages "$tmp/frm-pw.txt" --viewports desktop,phone
expect uniform 1 "c5.form conform" "reveal wrapped under its field (audit5 C1)" "reveal line" -- "$url" "$password" --pages "$tmp/frm-pw.txt" --viewports phone \
	--debug-css 'admin/system/admin=#view .control-group { flex-wrap: wrap !important }'

[[ ${BASH_SOURCE[0]} == "$0" ]] && finish
true
