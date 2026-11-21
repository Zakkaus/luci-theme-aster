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

[[ ${BASH_SOURCE[0]} == "$0" ]] && finish
true
