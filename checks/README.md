# Checks

| Check | What it proves | Negative tests |
|---|---|---|
| `literals.sh` | Colour and px literals live only in `tokens.css` and unported sections | `tests/literals.sh` |
| `uniform.mjs` | Every page draws each component with the same size, spacing and type as the M2 overview | `tests/uniform.sh` |
| `contrast.mjs` | WCAG AA on every page, light and dark; dark separators stay faint | `tests/contrast.sh` |
| `shell.mjs` | The top bar and the side nav are in the first frame and stand still across page loads (no move, no layout shift, open groups kept, stored scheme and palette before the first paint, view-transition names); the appearance menu works by keyboard in the top bar and on the login page; the collapsed rail shows its labels as tooltips | `tests/shell.sh` |
| `budget.sh` | The five stylesheets as shipped (comments stripped by `scripts/strip-css-comments.pl`, as the package build does) total <= 150,000 B; the three theme scripts <= 35,000 B | `tests/budget.sh` |

`scripts/measure.mjs` compares the overview itself with the reference page.

## shell

Desktop and light, against a device with the theme installed; the side nav
pages are opened by clicking their links on a throttled connection.

```sh
node checks/shell.mjs http://127.0.0.1:18025 <password> --json shell.json
bash checks/tests/shell.sh http://127.0.0.1:18025 <password>
```

## uniform and contrast

Both run against a device with the theme installed and walk the same page
list, at desktop 1440 and phone 390, light and dark. They need Playwright,
which is not a dependency of this repository: `PLAYWRIGHT` points at its
`index.mjs`, `CHROME_PATH` at the browser.

```sh
node checks/uniform.mjs http://127.0.0.1:18025 <password> \
  --pages checks/pages.txt --pages checks/pages-25.12.txt \
  --json uniform.json --out uniform.txt
node checks/contrast.mjs http://127.0.0.1:18025 <password> \
  --pages checks/pages.txt --pages checks/pages-25.12.txt \
  --json contrast.json --out contrast.txt
bash checks/tests/uniform.sh http://127.0.0.1:18025 <password>
bash checks/tests/contrast.sh http://127.0.0.1:18025 <password>
# on a box with OpenClash installed, add the Lua CBI fold cases:
APPS=1 bash checks/tests/uniform.sh http://127.0.0.1:18025 <password>
```

Every rule is a command-line parameter; a bad option prints the usage and exits 1.

- `pages.txt` lists the core pages both 24.10 and 25.12 have;
  `pages-25.12.txt` the ones only 25.12 has. A line is
  `<path> [modal=interface-edit] [tab=<name>] [require=<class>,...]`
  (`tab=` selects that tab of the page's first tab group, `tab=a/b` then
  tab b of the group inside a); a required class
  must have a sample on that page at every viewport and mode
  (`<class>@desktop` for the desktop only; `<class>@rows` on the desktop,
  and on a phone whenever the page's tables hold a data row). A page that
  `pages-25.12.txt` lists again adds its classes to the `pages.txt` entry.
- `pages-apps-24.10.txt` and `pages-apps-25.12.txt` list third-party app
  pages (OpenClash, PassWall), every menu entry and tab; run each alone
  on a box the lab's apps-install.sh prepared.
- `uniform.mjs` also reads layout: a field fills its row (less the buttons
  on its line), a form row fills its card or dialog, the phone fold's rows
  are grids with their actions inside the card, and no card, table or
  scroll box inside a card is wider than it (`overflow excess`). Components
  that scroll by design (Field, the phone Tabs list) are named in
  `SCROLLS` and skipped.
- `uniform.mjs` reads a rule under a card's last row (`card lastRule`): a
  bottom border or an `<hr>` inside a card with nothing drawn below it
  (Astryx drops the last row's divider; the card's edge closes it).
- `uniform.mjs` reads the spacing contract (`space.*`, values in
  `uniform.json`): box-to-box distances by role, as each container owns
  them. Page inset 24 (and the last block to an in-flow save bar), page
  title to its description 4, title or description to what follows 24,
  tabs to content 16, tab to tab 2, block to block in a column 16, card
  padding 16 (top and bottom, to the content), a heading's own box to its
  content 16, a section description to its content 16, form row padding 8,
  label to field 16 on one line and 4 stacked, field to help 4, controls on
  a line 8 (a toolbar's label is one of them), dialog padding, title and
  footer 16. An app's own widget (`APP_OWN`) is reported as
  `report.space.*` in the distributions and not judged.
- `uniform.mjs` reads the side nav's row gap (`nav.item gap`), so a
  hovered row never touches the selected one.
- It opens ui.js's tooltip on up to three `[data-tooltip]` triggers a page
  and shows each `.cbi-tooltip` in markup: `tooltip overflow` is text wider
  than the box, `tooltip arrow` a ▲/▼ glyph before the text, `tooltip gap`
  the space to the trigger.
- Tooltip contents: every word in the tooltip's ink against its fill
  (`tooltip ink`, AA), a key/value line at most two lines (`tooltip
  lines`), and no word that fits a line broken over two (`tooltip words`:
  the box shrunk to its min-content). On the overview the gate builds a
  ui.itemlist tooltip in the first upstream box, as 30_network.js does for
  the DHCPv6 statistics, and takes it out after the read.
- `tabs.pane shown`: one pane of a tab group shows. `frame nested`: a frame
  (four-sided border, shadow, or a rounded fill of its own) inside another,
  outside what Astryx puts in a card (controls, chips, progress, code,
  Banner, Tooltip, Menu); only offenders are listed. `dialog fits`: a
  dialog ends inside the window; `dialog scrim`: the scrim covers the save
  bar. `dynlist add`: the + on its field's line. `table.actions lines`: a
  row's buttons on one line (the rest in its "more" menu). `button.field
  variant`: a form row's own action is the secondary Button;
  `button.primary perGroup`: at most one filled Button in a save bar,
  dialog, table cell or section. `tabs.list lines`: a tab strip on one
  line (it scrolls).
- `heading level`: every title at one of the Heading sizes the tokens give
  (1-4); `heading abbr`: an `<abbr>` in a title without its dotted rule.
  `icon legacy`: a showing LuCI device image (`resources/icons/*.svg`,
  outside tooltips); `zone fill`: a zone chip in LuCI's inline colour
  instead of the palette's.
- It reads a Banner's or status dialog's icon (`banner.icon gap`: from the
  icon to the first words, never negative). The `status-*` modals in
  `pages.txt` open ui.js's status dialogs (applying, reverted, a failed
  revert) with `ui.changes.displayStatus`; nothing is sent.
- `uniform.json` holds one canonical value per component class and
  property. Values with a source in `lab/new-theme/astryx-ref/spec.json`
  are written out; `null` means "the majority of the run", and the report
  prints each distribution so a value can be chosen and written in.
- `contrast.mjs` reports a text field's, textarea's, select's or dropdown's
  boundary as its own rule, `field-border` (3:1, WCAG 1.4.11). It is
  waived by default (owner 2026-11-19: keep Astryx field border, the
  emphasized #ccd3db at 1.51:1 on the surface): its findings are listed
  under WAIVED and do not fail the run. `--field-border enforce` applies it
  like every other rule, which stay enforced.
- Both take `--palette <slug>` (`rose-pine`, `aster`, `relay`, `teal`,
  `plum`), set like the mode through the theme's browser setting
  (`aster-palette`); a page whose `data-palette` is not the one asked for
  is an error (Rosé Pine, the theme's default, is the absence of the
  attribute). Contrast defaults to `rose-pine`, the theme's default; run it
  once per palette: the field border (Astryx's #ccd3db, or a palette's own
  emphasized border) is waived under every palette. Uniform defaults to
  `aster` and checks only that palette: its colour canonicals in
  `uniform.json` are Aster's colours, and the palettes change colour tokens
  only, so their sizes and spacing are the same under each.
  `scripts/measure.mjs` takes `--palette` too and defaults to `aster`,
  because its colours come from the blue reference's `spec.json`.
- `contrast.mjs` holds a split button's (`.cbi-dropdown.btn`) fill or
  border to `--ui`, as it does a checkbox's.
- The negative tests assert the exit code and the exact set of failed rule
  ids in the JSON report (`tests/gate-lib.sh`), so a case passes only when
  the rule it breaks fails and no other does.
- `contrast.mjs` takes `--text 4.5 --large 3 --ui 3 --focus 3` (WCAG AA)
  and `--separator-max 1.5 --separator-modes dark` (Argon's dark table rules,
  2026-07-25). The reference page's dark separators measure 1.32.

Both exit 1 on any outlier or failure, a failed login, a page that is
missing or does not render, a page with no samples, or a required class
with no sample. Neither writes to the device: light and dark are chosen
through the theme's browser setting, and the only clicks are an interface's
Edit button (the dialog is measured, never saved) and the Close button of
the attended-sysupgrade dialog on 25.12; the status dialogs and tooltips
are opened in the page, without a request.

The report is a text table and a JSON file, page by page, so the page that
breaks a rule and the element that does it are both named.
