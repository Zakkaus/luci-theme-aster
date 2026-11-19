# Checks

| Check | What it proves | Negative tests |
|---|---|---|
| `literals.sh` | Colour and px literals live only in `tokens.css` and unported sections | `tests/literals.sh` |
| `uniform.mjs` | Every page draws each component with the same size, spacing and type as the M2 overview | `tests/uniform.sh` |
| `contrast.mjs` | WCAG AA on every page, light and dark; dark separators stay faint | `tests/contrast.sh` |

`scripts/measure.mjs` compares the overview itself with the reference page.

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
```

Every rule is a command-line parameter; a bad option prints the usage and exits 1.

- `pages.txt` lists the core pages both 24.10 and 25.12 have;
  `pages-25.12.txt` the ones only 25.12 has. A line is
  `<path> [modal=interface-edit] [require=<class>,...]`; a required class
  must have a sample on that page at every viewport and mode
  (`<class>@desktop` for the desktop only; `<class>@rows` on the desktop,
  and on a phone whenever the page's tables hold a data row). A page that
  `pages-25.12.txt` lists again adds its classes to the `pages.txt` entry.
- `uniform.mjs` also reads layout: a field fills its row (less the buttons
  on its line), a form row fills its card or dialog, the phone fold's rows
  are grids with their actions inside the card, and no card, table or
  scroll box inside a card is wider than it (`overflow excess`). Components
  that scroll by design (Field, the phone Tabs list) are named in
  `SCROLLS` and skipped.
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
the attended-sysupgrade dialog on 25.12.

The report is a text table and a JSON file, page by page, so the page that
breaks a rule and the element that does it are both named.
