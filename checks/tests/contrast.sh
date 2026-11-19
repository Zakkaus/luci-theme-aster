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

printf 'admin/status/overview\n' >"$tmp/overview.txt"
printf 'admin/status/overview\nadmin/no/such/page\n' >"$tmp/missing.txt"
printf 'admin/system/system\n' >"$tmp/form.txt"
printf 'admin/system/admin/dropbear\n' >"$tmp/dropbear.txt"
printf 'admin/system/admin/uhttpd\n' >"$tmp/uhttpd.txt"
# Text fields, selects and dropdowns only: a near-white border on a
# checkbox would break the ui rule as well.
pale='admin/system/system=#view :is(input:not([type="checkbox"], [type="radio"]), select, textarea, .cbi-dropdown:not(.btn)) { border-color: #f8f8f8 !important }'

# Errors.
expect contrast 1 error "page-list entry that 404s" "admin/no/such/page: HTTP 404" -- "$url" "$password" --pages "$tmp/missing.txt"
expect contrast 1 error "wrong password" "(login): login returned 403" -- "$url" "$password-wrong" --pages "$tmp/overview.txt"

# Text: body text in table cells, and card titles (22px semibold is body
# size for WCAG), each #dddddd on the white card (1.36:1).
expect contrast 1 text "low-contrast body text" "#dddddd on #ffffff" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#view .td { color: #ddd !important }'
expect contrast 1 text "low-contrast card titles" "#dddddd on #ffffff" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#view .cbi-section :is(h2, h3) { color: #ddd !important }'

# Large text, on a phone: the 26px page title at #cccccc (1.61:1, under 3).
expect contrast 1 large "low-contrast page title on a phone" -- "$url" "$password" --pages "$tmp/overview.txt" --viewports phone \
	--debug-css 'admin/status/overview=#maincontent h2[name="content"] { color: #ccc !important }'

# UI boundary: an unchecked checkbox with a near-white border on white, and
# a split button (Save & Apply) turned white with a near-white border but
# dark words.
expect contrast 1 ui "checkbox boundary" -- "$url" "$password" --pages "$tmp/dropbear.txt" \
	--debug-css 'admin/system/admin/dropbear=#view input[type="checkbox"]:not(:checked) { border-color: #f4f4f4 !important; background-color: #fff !important }'
expect contrast 1 ui "split button boundary" -- "$url" "$password" --pages "$tmp/uhttpd.txt" \
	--debug-css 'admin/system/admin/uhttpd=#maincontent .cbi-dropdown:is(.btn, .cbi-button) { background-color: #fff !important; border: 1px solid #fafafa !important } #maincontent .cbi-dropdown:is(.btn, .cbi-button), #maincontent .cbi-dropdown:is(.btn, .cbi-button) * { color: #222 !important }'

# Focus: no ring at all on the page's controls.
expect contrast 1 focus "no focus ring" "no focus ring" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#maincontent :is(:focus, :focus-visible) { outline: none !important; box-shadow: none !important }'

# Separator, in dark mode as the rule applies by default: white cell rules.
expect contrast 1 separator "bright separator in dark mode" -- "$url" "$password" --pages "$tmp/overview.txt" --modes dark \
	--debug-css 'admin/status/overview=#view .td { border-block-end: 1px solid #fff !important }'

# Field border alone: waived by default (exit 0, listed as waived), and a
# failure when enforced.
expect contrast 0 waived:field-border "near-white field border, rule waived by default" "WAIVED (field-border" -- "$url" "$password" --pages "$tmp/form.txt" --debug-css "$pale"
expect contrast 1 field-border "near-white field border, rule enforced" -- "$url" "$password" --pages "$tmp/form.txt" --debug-css "$pale" \
	--field-border enforce
finish
