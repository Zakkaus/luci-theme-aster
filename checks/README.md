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
  (`<class>@desktop` for the desktop only).
- `uniform.json` holds one canonical value per component class and
  property. Values with a source in `lab/new-theme/astryx-ref/spec.json`
  are written out; `null` means "the majority of the run", and the report
  prints each distribution so a value can be chosen and written in.
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
