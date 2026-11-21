#!/usr/bin/env bash
# Negative tests for checks/shell.mjs against a running device with the
# theme installed:
#
#   checks/tests/shell.sh <base url> <password>
#
# The baseline passes; each case breaks one rule with an injected stylesheet
# or script and that rule alone fails (checks/tests/gate-lib.sh).
set -euo pipefail
source "$(dirname "$0")/gate-lib.sh"
url=$1 password=$2

expect shell 0 "" "baseline" -- "$url" "$password"

# shift: the side nav is 16 wider on the second page only.
expect shell 1 shift "side nav moves between pages" -- "$url" "$password" \
	--debug-css 'admin/system/system=.shell { grid-template-columns: calc(var(--aster-sidenav-w) + var(--spacing-4)) minmax(0, 1fr) !important }'

# ssr: the side nav rows are not shown until a second after load.
expect shell 1 ssr "side nav built after the first frame" -- "$url" "$password" \
	--debug-js 'document.addEventListener("DOMContentLoaded", () => { const n = document.querySelector("#mainmenu"); if (n) { n.style.visibility = "hidden"; addEventListener("load", () => setTimeout(() => { n.style.visibility = ""; }, 1000)); } });'

# flash: the stored palette is dropped at DOMContentLoaded and back a second
# after load.
expect shell 1 flash "palette applied after the first frame" -- "$url" "$password" \
	--debug-js 'document.addEventListener("DOMContentLoaded", () => { const r = document.documentElement, p = r.getAttribute("data-palette"); r.removeAttribute("data-palette"); addEventListener("load", () => setTimeout(() => p && r.setAttribute("data-palette", p), 1000)); });'

# keep: the stored side nav state is lost on every page.
expect shell 1 keep "open groups forgotten" -- "$url" "$password" \
	--debug-js 'try { sessionStorage.removeItem("aster-nav"); } catch (e) {}'

# vt: the side nav loses its view-transition name.
expect shell 1 vt "side nav not named" -- "$url" "$password" \
	--debug-css 'admin/status/overview=.shell-aside { view-transition-name: none !important }'

# appearance: the menus open but their rows cannot take the focus.
expect shell 1 appearance "menu rows unfocusable" -- "$url" "$password" \
	--debug-css 'admin/status/overview=.palette-menu > [role="menu"] > li { visibility: hidden !important }'

# stack: on the second page a point on a menu row hits the page under it.
expect shell 1 stack "page drawn over the menu" -- "$url" "$password" \
	--debug-css 'admin/system/system=.palette-menu > [role="menu"] { pointer-events: none !important }'

# rail-tip: no tooltip is drawn.
expect shell 1 rail-tip "rail tooltip hidden" -- "$url" "$password" \
	--debug-css 'admin/status/overview=body > .cbi-tooltip { display: none !important }'

finish
