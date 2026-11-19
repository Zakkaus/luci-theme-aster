#!/usr/bin/env bash
# Negative tests for checks/contrast.mjs against a running device with the
# theme installed:
#
#   checks/tests/contrast.sh <base url> <password>
#
# Each case must exit 1 and say why: card titles injected in a pale grey
# (#dddddd on the white card, 1.36:1), a separator injected too bright in
# dark mode, a page-list entry that does not exist, and a wrong password.
# Desktop only. Needs Playwright, as the gate does.
set -euo pipefail
source "$(dirname "$0")/gate-lib.sh"
url=$1 password=$2

printf 'admin/status/overview\n' >"$tmp/overview.txt"
printf 'admin/status/overview\nadmin/no/such/page\n' >"$tmp/missing.txt"

expect contrast "#dddddd on #ffffff" "low-contrast card titles" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--debug-css 'admin/status/overview=#view .cbi-section :is(h2, h3) { color: #ddd !important }'
expect contrast "separator" "bright separator with the bound applied in light mode" -- "$url" "$password" --pages "$tmp/overview.txt" \
	--separator-modes light --debug-css 'admin/status/overview=#view .td { border-block-end: 1px solid #000 !important }'
expect contrast "admin/no/such/page: HTTP 404" "page-list entry that 404s" -- "$url" "$password" --pages "$tmp/missing.txt"
expect contrast "(login): login returned 403" "wrong password" -- "$url" "$password-wrong" --pages "$tmp/overview.txt"
finish
