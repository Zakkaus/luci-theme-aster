#!/usr/bin/env bash
# Negative tests for the frm rules (checks/rules/frm.mjs: C1-C5, C9, C17-C19,
# C22, G1, G3, G6, G7, G8), run inside checks/tests/uniform.sh or alone:
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
# C19: a 12 bar.
expect uniform 1 "c19.progress conform" "progress bar 12 high (C19)" -- "$url" "$password" --pages "$tmp/frm-ov.txt" \
	--debug-css 'admin/status/overview=#view .cbi-progressbar { block-size: 12px !important }'
# C22: a Divider drawn 2 thick.
expect uniform 1 "c22.divider conform" "Divider 2 thick (C22)" -- "$url" "$password" --pages "$tmp/frm-flash.txt" \
	--debug-css 'admin/system/flash=#view .cbi-value + .cbi-value > .cbi-section { border-block-start-width: 2px }'

[[ ${BASH_SOURCE[0]} == "$0" ]] && finish
true
