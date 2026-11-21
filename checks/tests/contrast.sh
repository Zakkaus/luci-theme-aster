#!/usr/bin/env bash
# Negative tests for checks/contrast.mjs against a running device with the
# theme installed:
#
#   checks/tests/contrast.sh <base url> <password>
#
# Each case names the exit code and the exact set of rules that must fail
# (checks/tests/gate-lib.sh): one rule broken by one injected colour, and
# no other rule failing. Desktop and light unless a case says otherwise.
# Needs Playwright, as the gate does.
set -euo pipefail
source "$(dirname "$0")/gate-lib.sh"
url=$1 password=$2

# The gate fails a run that has no field-border, focus or separator sample
# at all; no single page has all three, so each case runs its page with the
# overview (separators) and Dropbear (fields). Their Astryx field borders
# are listed as waived (waived:field-border), as in every full run.
printf 'admin/status/overview\nadmin/system/admin/dropbear\n' >"$tmp/base.txt"
printf 'admin/status/overview\nadmin/no/such/page\n' >"$tmp/missing.txt"
printf 'admin/status/overview\nadmin/system/system\n' >"$tmp/form.txt"
printf 'admin/status/overview\nadmin/system/admin/dropbear\nadmin/system/admin/uhttpd\n' >"$tmp/uhttpd.txt"
printf 'admin/status/overview\nadmin/system/admin/dropbear\nadmin/status/routes fixture=notices\n' >"$tmp/notices.txt"
# Text fields, selects and dropdowns only: a near-white border on a
# checkbox would break the ui rule as well.
pale='admin/system/system=#view :is(input:not([type="checkbox"], [type="radio"]), select, textarea, .cbi-dropdown:not(.btn)) { border-color: #f8f8f8 !important }'

# Errors.
expect contrast 1 error "page-list entry that 404s" "admin/no/such/page: HTTP 404" -- "$url" "$password" --pages "$tmp/missing.txt"
expect contrast 1 error "wrong password" "(login): login returned 403" -- "$url" "$password-wrong" --pages "$tmp/base.txt"

# The baseline the cases below break: only the waived field border.
expect contrast 0 waived:field-border "baseline: overview and Dropbear" -- "$url" "$password" --pages "$tmp/base.txt"

# Text: body text in table cells, and card titles (22px semibold is body
# size for WCAG), each #dddddd on the default palette's card (Rosé Pine
# Dawn's surface, 1.31:1).
expect contrast 1 text,waived:field-border "low-contrast body text" "#dddddd on #fffaf3" -- "$url" "$password" --pages "$tmp/base.txt" \
	--debug-css 'admin/status/overview=#view .td { color: #ddd !important }'
expect contrast 1 text,waived:field-border "low-contrast card titles" "#dddddd on #fffaf3" -- "$url" "$password" --pages "$tmp/base.txt" \
	--debug-css 'admin/status/overview=#view .cbi-section :is(h2, h3) { color: #ddd !important }'

# Large text: the 26px page title at #cccccc (1.61:1, under 3). (The
# phone case is in tests/uniform.sh: on a phone these pages draw no
# separator, which the run requires.)
expect contrast 1 large,waived:field-border "low-contrast page title" -- "$url" "$password" --pages "$tmp/base.txt" \
	--debug-css 'admin/status/overview=#maincontent h2[name="content"] { color: #ccc !important }'

# UI boundary: an unchecked checkbox with a near-white border on white, and
# a split button (Save & Apply) turned white with a near-white border but
# dark words.
expect contrast 1 ui,waived:field-border "checkbox boundary" -- "$url" "$password" --pages "$tmp/base.txt" \
	--debug-css 'admin/system/admin/dropbear=#view input[type="checkbox"]:not(:checked) { border-color: #f4f4f4 !important; background-color: #fff !important }'
expect contrast 1 ui,waived:field-border "split button boundary" -- "$url" "$password" --pages "$tmp/uhttpd.txt" \
	--debug-css 'admin/system/admin/uhttpd=#maincontent .cbi-dropdown:is(.btn, .cbi-button) { background-color: #fff !important; border: 1px solid #fafafa !important } #maincontent .cbi-dropdown:is(.btn, .cbi-button), #maincontent .cbi-dropdown:is(.btn, .cbi-button) * { color: #222 !important }'

# Focus: no ring at all on the page's controls.
expect contrast 1 focus,waived:field-border "no focus ring" "no focus ring" -- "$url" "$password" --pages "$tmp/base.txt" \
	--debug-css 'admin/status/overview=#maincontent :is(:focus, :focus-visible) { outline: none !important; box-shadow: none !important }'

# Focus: an outline over a field's inset accent ring (the doubled ring).
expect contrast 1 focus,waived:field-border "double focus ring on a field" "double focus ring" -- "$url" "$password" --pages "$tmp/base.txt" \
	--debug-css 'admin/system/admin/dropbear=#view input:focus-visible { outline: 2px solid #286983 !important; outline-offset: 3px !important }'
# Separator, in dark mode as the rule applies by default: white cell rules.
expect contrast 1 separator,waived:field-border "bright separator in dark mode" -- "$url" "$password" --pages "$tmp/base.txt" --modes dark \
	--debug-css 'admin/status/overview=#view .td { border-block-end: 1px solid #fff !important }'

# The notices fixture (gate.mjs FIXTURES): its banners, WireGuard line (the
# theme's Port / Public key list) and code pass; LuCI's own 80 % fade on
# that line (port 4.2:1, the
# key 4.0:1 on its fill), and the Dawn info and error inks the router
# measure found (4.4:1 on their fills over the body), fail.
expect contrast 0 waived:field-border "baseline: banners, WireGuard line, code" -- "$url" "$password" --pages "$tmp/notices.txt"
expect contrast 1 text,waived:field-border "WireGuard line at LuCI's 80 % fade" "#787290 on #faf4ed" -- "$url" "$password" --pages "$tmp/notices.txt" \
	--debug-css 'admin/status/routes=html body #view > p > .aster-kv { opacity: .8 !important }'
expect contrast 1 text,waived:field-border "notice banner ink" "#6d5d80 on #e5dcdf" -- "$url" "$password" --pages "$tmp/notices.txt" \
	--debug-css 'admin/status/routes=:root { --color-on-info-muted: light-dark(#6D5D80, #C4A7E7) !important }'
expect contrast 1 text,waived:field-border "error banner pre ink" "#8f4f61 on #ead6d5" -- "$url" "$password" --pages "$tmp/notices.txt" \
	--debug-css 'admin/status/routes=:root { --color-on-error-muted: light-dark(#8F4F61, #F19DB5) !important }'

# Palettes: the run picks one as a reader does (localStorage), a slug that
# is not a palette is an error, and a palette block whose ink is pale fails
# the text rule under that palette (the secondary ink: body-size labels
# only, where the primary would fail the large page title too).
expect contrast 1 error "unknown palette" "data-palette is rose-pine, want nosuch" -- "$url" "$password" --pages "$tmp/base.txt" --palette nosuch
expect contrast 0 waived:field-border "baseline: Relay Blue" -- "$url" "$password" --pages "$tmp/base.txt" --palette relay
expect contrast 1 text,waived:field-border "palette block with a pale ink" "#dddddd on #ffffff" -- "$url" "$password" --pages "$tmp/base.txt" --palette relay \
	--debug-css 'admin/status/overview=:root[data-palette="relay"] { --color-text-secondary: light-dark(#ddd, #ddd) !important }'

# Field border alone: waived by default (exit 0, listed as waived), and a
# failure when enforced.
expect contrast 0 waived:field-border "near-white field border, rule waived by default" "WAIVED (field-border" -- "$url" "$password" --pages "$tmp/form.txt" --debug-css "$pale"
expect contrast 1 field-border "near-white field border, rule enforced" -- "$url" "$password" --pages "$tmp/form.txt" --debug-css "$pale" \
	--field-border enforce
finish
