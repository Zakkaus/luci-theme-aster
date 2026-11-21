#!/usr/bin/env node
/**
 * Measures the Status > Overview page of a LuCI device running the theme and
 * compares it with the reference page's measurements (spec.json, written by
 * lab/new-theme/astryx-ref/scripts/measure.mjs). Adapted from that script:
 * same getComputedStyle readings, same viewports (desktop 1440 x 900, phone
 * 390 x 844), light and dark.
 *
 *   node scripts/measure.mjs <base url> <password> --spec <spec.json>
 *        [--user root] [--palette aster] [--json <out file>]
 *
 *   <base url>  the device, e.g. http://127.0.0.1:18025
 *
 * Box values (widths, heights, paddings, gaps, radii, font sizes) pass within
 * 1px; colours and font weights must match exactly. Exit 1 when any field is
 * outside that, when the login fails, when the overview does not render, or
 * when a field finds nothing to measure. Nothing is written to the device:
 * the login is the ordinary form POST, and light and dark are chosen the way
 * a reader chooses them, through the theme's own browser setting
 * (localStorage "aster-theme"), not through UCI. The palette is chosen the
 * same way ("aster-palette"); it defaults to Aster, not the theme's default
 * Rosé Pine, because the reference colours in spec.json are Aster's blue.
 *
 * Playwright is not a dependency of this repository. Point PLAYWRIGHT at its
 * index.mjs (default: the bare specifier "playwright"); CHROME_PATH, when set,
 * picks the browser binary.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const specPath = opt('--spec');
const user = opt('--user', 'root');
const jsonOut = opt('--json');
const palette = opt('--palette', 'aster');
// Tests only: a stylesheet laid over the overview before it is read.
const cssPath = opt('--css');
const [baseArg, password] = args;
if (!baseArg || password === undefined || !specPath) {
  console.error('usage: measure.mjs <base url> <password> --spec <spec.json> [--user root] [--palette aster] [--json <file>] [--css <file>]');
  process.exit(1);
}
const base = `${baseArg.replace(/\/+$/, '')}/cgi-bin/luci/`;
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const {chromium} = await import(process.env.PLAYWRIGHT ?? 'playwright');

/* Each field names where the reference value lives in spec.json and what the
 * theme's counterpart is. `from` is [section, key, property]; `take` turns a
 * measured element (or two) into the same string form spec.json uses.
 * `devices` limits a field to where the reference measured it; `pseudo` reads
 * a ::before box (the theme's mask icons); `want` replaces a spec value with
 * a constant where the property is a relation, not a size. */
const PORT_UP = '#view .ifacebox:has(> .ifacebox-body > img[src*="/port_"]):not(:has(> .ifacebox-body > img[src*="_down."]))';
const FIELDS = [
  // Side nav: the panel and its rows. On the phone they are the drawer's.
  {name: 'side nav width', from: ['frame', 'Side nav panel (AppShell sidenav)', 'width'], devices: ['desktop'], sel: '#sidebar', prop: 'width'},
  {name: 'side nav width (drawer)', from: ['drawer', 'drawer', 'width'], devices: ['phone'], drawer: true, sel: '#sidebar', prop: 'width'},
  {name: 'side nav item height (group)', from: ['components', 'SideNavItem group row (狀態)', 'height'], devices: ['desktop'], sel: '#mainmenu .nav-label', prop: 'height'},
  {name: 'side nav item height (page)', from: ['components', 'SideNavItem child row (路由)', 'height'], devices: ['desktop'], sel: '#mainmenu .nav-group:not([data-collapsed]) > .nav-item:not([data-active])', prop: 'height'},
  {name: 'side nav item height (drawer)', from: ['drawer', 'item', 'height'], devices: ['phone'], drawer: true, sel: '#mainmenu .nav-group:not([data-collapsed]) > .nav-item:not([data-active])', prop: 'height'},
  {name: 'side nav item radius', from: ['components', 'SideNavItem child row (路由)', 'radius'], devices: ['desktop'], sel: '#mainmenu .nav-item', prop: 'radius'},
  {name: 'side nav selected background', from: ['components', 'SideNavItem selected (概覽)', 'background'], devices: ['desktop'], sel: '#mainmenu .nav-item[data-active]', prop: 'background', exact: true},
  // Not the reference's accent: the accent is 4.2:1 on the accent-muted fill,
  // so the theme pulls it 20 % toward the text colour (shell.css
  // --nav-selected-fg, 2026-11-19 contrast decision). Per mode.
  {name: 'side nav selected colour', from: ['components', 'SideNavItem selected (概覽)', 'color'], devices: ['desktop'], sel: '#mainmenu .nav-item[data-active]', prop: 'color', exact: true,
    want: {light: 'color(srgb 0.123137 0.298824 0.809412)', dark: 'color(srgb 0.366275 0.600784 0.979608)'}},
  // Top bar and page frame.
  {name: 'top bar height', from: ['frame', 'Top bar (AppShell header)', 'height'], sel: '.shell-header', prop: 'height'},
  {name: 'top bar padding', from: ['frame', 'TopNav', 'padding'], sel: '.shell-header', prop: 'padding'},
  {name: 'frame padding', from: ['frame', 'Main content (LayoutContent)', 'padding'], sel: '.shell-content', prop: 'padding'},
  {name: 'section gap', from: ['frame', 'Page VStack (band gap)', 'gap'], measure: 'sectionGap'},
  {name: 'card gap', from: ['frame', 'Grid: 系統 + 記憶體 cards', 'gap'], sel: '#view', prop: 'gap'},
  // A card ends 16 under its content (the spacing contract, owner
  // 2026-11-20) and the cards of a row are one height (Astryx's dashboard
  // template stretches a Grid row, layout/SPEC.md, 2026-11-21): in each row
  // the tallest card ends 16 under its content; the largest such inset of
  // the overview's rows is read.
  {name: 'card content end', from: ['frame', 'Grid: 系統 + 記憶體 cards', 'height'], want: '16px', devices: ['desktop'], measure: 'contentEnd'},
  {name: 'same-row card bottoms', from: ['frame', 'Grid: 系統 + 記憶體 cards', 'height'], want: '0px', devices: ['desktop'], measure: 'rowSpread', edge: 'bottom'},
  // ... and start their first line of content level (型號 and 可用記憶體).
  {name: 'same-row first line', from: ['frame', 'Grid: 系統 + 記憶體 cards', 'height'], want: '0px', devices: ['desktop'], measure: 'rowSpread', edge: 'firstLine'},
  // Cards.
  {name: 'card radius', from: ['components', 'Card (default)', 'radius'], sel: '#view > .cbi-section', prop: 'radius'},
  {name: 'card padding', from: ['components', 'Card (default)', 'padding'], sel: '#view > .cbi-section', prop: 'padding'},
  {name: 'card border', from: ['components', 'Card (default)', 'border'], sel: '#view > .cbi-section', prop: 'border', exact: true},
  // Type.
  {name: 'h1 size', from: ['components', 'Heading h1 (概覽)', 'fontSize'], sel: '.shell-inner > h2, #view > h2', prop: 'fontSize'},
  {name: 'h1 weight', from: ['components', 'Heading h1 (概覽)', 'weight'], sel: '.shell-inner > h2, #view > h2', prop: 'weight', exact: true},
  // Heading 3, not the reference's h2: Astryx's dashboard and settings
  // templates title a section with Heading 3 (layout/SPEC.md, 2026-11-21).
  {name: 'card title size', from: ['components', 'Heading h2 (section)', 'fontSize'], want: '18px', sel: '#view > .cbi-section :is(h2, h3)', prop: 'fontSize'},
  {name: 'base text size', from: ['components', 'Table body cell', 'fontSize'], sel: '#view .td', prop: 'fontSize'},
  // Controls.
  {name: 'button height', from: ['components', 'Button secondary md (top bar)', 'height'], sel: '#indicators > *', prop: 'height'},
  {name: 'button radius', from: ['components', 'Button secondary md (top bar)', 'radius'], sel: '#indicators > *', prop: 'radius'},
  // A data row of a table with a header row; where the overview has none (no
  // DHCP leases, no wireless stations), a row of a key/value table, which the
  // reference draws as a MetadataList row (24 + 8, within the 33's tolerance).
  {name: 'table row height', from: ['components', 'Table body row', 'height'], devices: ['desktop'], sel: '#view .table:has(.th) > .tr:has(> .td):not(.placeholder, :has(button, .btn))', fallback: '#view .table:not(:has(.th)) > .tr:not(:has(.cbi-progressbar))', prop: 'height'},
  // A data row holding a button (DHCP's Reserve IP, a station's Disconnect).
  // COMPONENTS.md C6 (owner Q1 = A): the actions cell pads 8, a row 32 + 16 + 1.
  {name: 'table row height (button)', from: ['components', 'Table body row with sm Button', 'height'], want: '49px', devices: ['desktop'], sel: '#view .table:has(.th) > .tr:has(> .td > :is(button, .btn))', prop: 'height'},
  // The brand mark is the logo at its own size, not an sm icon.
  {name: 'icon size', from: ['components', 'Icon sm', 'width'], sel: '.shell-header .icon-btn:not([hidden]) svg', prop: 'width', visible: true},
  // Port tiles (Port status): the first tile with a link.
  {name: 'port grid gap', from: ['frame', 'Grid: port tiles', 'gap'], sel: '#view div[style*="grid-template-columns"]:has(> .ifacebox)', prop: 'gap'},
  // A tile is COMPONENTS.md C25 (it wins over the reference's Card tile):
  // no border, fill or device icon; the name in body size with its
  // StatusDot trailing it (success with a link), the link state in
  // supporting text, the traffic the value in body size.
  {name: 'port name size', from: ['components', 'Port tile: speed text', 'fontSize'], sel: `${PORT_UP} > .ifacebox-head:first-child`, prop: 'fontSize'},
  {name: 'port state dot', from: ['components', 'Port tile: port icon', 'color'], want: {light: 'rgb(9, 68, 31)', dark: 'rgb(165, 246, 144)'}, sel: `${PORT_UP} > .ifacebox-head:first-child`, pseudo: '::after', prop: 'background', exact: true},
  {name: 'port speed size', from: ['components', 'Port tile: TX/RX text', 'fontSize'], sel: `${PORT_UP} > .ifacebox-body:nth-child(2)`, prop: 'fontSize'},
  {name: 'port traffic size', from: ['components', 'Port tile: speed text', 'fontSize'], sel: `${PORT_UP} > .ifacebox-body > .cbi-tooltip-container`, prop: 'fontSize'},
  // Main colours.
  {name: 'shell background', from: ['frame', 'AppShell root', 'background'], sel: '.shell', prop: 'background', exact: true},
  {name: 'text', from: ['frame', 'AppShell root', 'color'], sel: '.shell', prop: 'color', exact: true},
  {name: 'surface', from: ['components', 'Card (default)', 'background'], sel: '#view > .cbi-section', prop: 'background', exact: true},
  // The reference fills its NavIcon with the accent; the theme draws the
  // mark itself in the accent, on no badge, so nothing shows on-accent here.
  {name: 'accent', from: ['frame', 'NavIcon (brand mark)', 'background'], sel: '.shell-header .brand .mark', prop: 'color', exact: true},
];

/* In the page: the reference script's box() reduced to the properties above. */
function readAll(fields) {
  const four = (s, p) => {
    const v = ['Top', 'Right', 'Bottom', 'Left'].map((k) => s[`${p}${k}`]);
    return v.every((x) => x === v[0]) ? v[0] : v.join(' ');
  };
  const border = (s) => {
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((k) => (parseFloat(s[`border${k}Width`]) && s[`border${k}Style`] !== 'none'
      ? `${s[`border${k}Width`]} ${s[`border${k}Style`]} ${s[`border${k}Color`]}` : 'none'));
    return sides.every((b) => b === sides[0]) ? sides[0] : sides.join('; ');
  };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const px = (n) => `${Math.round(n * 100) / 100}px`;
  const read = (el, prop, pseudo) => {
    const s = getComputedStyle(el, pseudo ?? null);
    const r = el.getBoundingClientRect();
    switch (prop) {
      case 'width': return pseudo ? s.width : px(r.width);
      case 'height': return pseudo ? s.height : px(r.height);
      case 'padding': return four(s, 'padding');
      case 'gap': return `${s.rowGap} / ${s.columnGap}`;
      case 'radius': return s.borderRadius;
      case 'border': return border(s);
      case 'background': return s.backgroundColor;
      case 'color': return s.color;
      case 'fontSize': return s.fontSize;
      case 'weight': return s.fontWeight;
    }
    return null;
  };
  const out = {};
  for (const f of fields) {
    if (f.measure === 'sectionGap') {
      // From the page title to the first card under it.
      const title = document.querySelector('.shell-inner > h2, #view > h2');
      const card = [...document.querySelectorAll('#view > .cbi-section')].find(shown);
      out[f.name] = title && card ? {value: `${px(card.getBoundingClientRect().top - title.getBoundingClientRect().bottom)}`, count: 1} : {value: null, count: 0};
      continue;
    }
    if (f.measure === 'contentEnd') {
      const rows = new Map();
      for (const c of [...document.querySelectorAll('#view > .cbi-section')].filter(shown)) {
        const kids = [...c.children].filter(shown);
        if (!kids.length) continue;
        const top = Math.round(c.getBoundingClientRect().top);
        const inset = c.getBoundingClientRect().bottom - Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
        rows.set(top, Math.min(rows.get(top) ?? Infinity, inset));
      }
      const ends = [...rows.values()];
      out[f.name] = ends.length ? {value: px(Math.max(...ends)), count: ends.length} : {value: null, count: 0};
      continue;
    }
    if (f.measure === 'rowSpread') {
      // Group the cards by their top edge; count only rows of two or more.
      // An edge is the card's bottom, or the content top of its first cell.
      const edge = (c) => {
        if (f.edge === 'bottom') return c.getBoundingClientRect().bottom;
        const td = c.querySelector('.table .tr > .td');
        return td ? td.getBoundingClientRect().top + parseFloat(getComputedStyle(td).paddingTop) : NaN;
      };
      const rowsByTop = new Map();
      for (const c of [...document.querySelectorAll('#view > .cbi-section')].filter(shown)) {
        const r = c.getBoundingClientRect();
        const top = [...rowsByTop.keys()].find((t) => Math.abs(t - r.top) <= 1) ?? r.top;
        rowsByTop.set(top, [...(rowsByTop.get(top) ?? []), edge(c)]);
      }
      const shared = [...rowsByTop.values()].filter((b) => b.length > 1);
      const spread = Math.max(0, ...shared.map((b) => Math.max(...b) - Math.min(...b)));
      // The cards that must pair (layout/SPEC.md): bar cards, i.e. Memory
      // and Storage with fewer than 7 bar rows; a card with a wide table or
      // interface boxes (Network's connection bar) is not one. With two
      // of them on the page a row of two must exist; with one (24.10 has no
      // Storage) there is nothing to pair and the rule does not apply.
      const pairable = [...document.querySelectorAll('#view > .cbi-section')].filter(shown).filter((c) =>
        c.querySelector('.tr > .td > .cbi-progressbar') && !c.querySelector('.tr > .td:nth-child(3), .th, .ifacebox, .network-status-table') &&
        c.querySelectorAll('.tr:has(> .td > .cbi-progressbar)').length < 7).length;
      out[f.name] = {value: px(spread), count: shared.length, pairable};
      continue;
    }
    let els = [...document.querySelectorAll(f.sel)].filter(shown);
    let via = f.sel;
    if (!els.length && f.fallback) {
      els = [...document.querySelectorAll(f.fallback)].filter(shown);
      via = f.fallback;
    }
    out[f.name] = {value: els.length ? read(els[0], f.prop, f.pseudo) : null, count: els.length, via};
  }
  return out;
}

const nums = (v) => String(v).match(/-?\d+(\.\d+)?(?=px)/g)?.map(Number) ?? [];
/* "24px / 24px" against "24px": a single value stands for all of them. */
function compare(got, want, exact) {
  if (got == null) return false;
  if (exact) return got.replace(/\s+/g, ' ') === want.replace(/\s+/g, ' ');
  const g = nums(got);
  const w = nums(want);
  if (!g.length || !w.length) return got === want;
  const len = Math.max(g.length, w.length);
  for (let i = 0; i < len; i++) {
    const a = g[Math.min(i, g.length - 1)];
    const b = w[Math.min(i, w.length - 1)];
    // A radius of 9999px and the 50% / huge value a browser reports for a pill
    // both mean "fully round".
    if (a >= 9999 && b >= 9999) continue;
    if (Math.abs(a - b) > 1) return false;
  }
  return true;
}

const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {});
const rows = [];
let failures = 0;
const fail = (msg) => { console.log(`FAIL ${msg}`); failures++; };

for (const [device, viewport] of Object.entries({desktop: {width: 1440, height: 900}, phone: {width: 390, height: 844}})) {
  for (const mode of ['light', 'dark']) {
    const key = `${device}-${mode}`;
    const ref = spec[key];
    if (!ref) { fail(`${key}: not in ${specPath}`); continue; }
    const ctx = await browser.newContext({viewport, deviceScaleFactor: 1, colorScheme: mode});
    await ctx.addInitScript(([m, p]) => {
      try { localStorage.setItem('aster-theme', m); localStorage.setItem('aster-palette', p); } catch (e) {}
    }, [mode, palette]);
    const page = await ctx.newPage();

    const r = await ctx.request.post(base, {form: {luci_username: user, luci_password: password}, maxRedirects: 0});
    if (r.status() !== 302) { fail(`${key}: login returned ${r.status()}, want 302`); await ctx.close(); continue; }
    const resp = await page.goto(`${base}admin/status/overview`, {waitUntil: 'load'});
    if (!resp || resp.status() !== 200) { fail(`${key}: overview returned ${resp?.status()}`); await ctx.close(); continue; }
    // The overview polls, so the network never idles: wait for its cards.
    const ok = await page.waitForSelector('#view > .cbi-section:not([style*="display: none"])', {timeout: 150000}).then(() => true, () => false);
    if (!ok) { fail(`${key}: overview rendered no card`); await ctx.close(); continue; }
    await page.waitForSelector('#mainmenu .nav-item', {timeout: 15000}).catch(() => {});
    await page.waitForTimeout(1500);
    // luci-app-attendedsysupgrade asks on the overview whether to check for
    // upgrades. Its last button, Close, dismisses the dialog and saves nothing.
    if (await page.locator('#modal_overlay .modal').isVisible().catch(() => false)) {
      await page.locator('#modal_overlay .modal button, #modal_overlay .modal .btn').last().click();
      await page.waitForTimeout(500);
    }
    if (cssPath) { await page.addStyleTag({content: fs.readFileSync(cssPath, 'utf8')}); await page.waitForTimeout(300); }
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (theme !== mode) fail(`${key}: data-theme is ${theme}`);
    // Rosé Pine, the theme's default palette, carries no attribute.
    const pal = await page.evaluate(() => document.documentElement.getAttribute('data-palette') ?? 'rose-pine');
    if (pal !== palette) fail(`${key}: data-palette is ${pal}, want ${palette}`);

    const plain = FIELDS.filter((f) => !f.drawer && (!f.devices || f.devices.includes(device)));
    const got = await page.evaluate(readAll, plain);
    const drawerFields = FIELDS.filter((f) => f.drawer && (!f.devices || f.devices.includes(device)));
    if (drawerFields.length) {
      await page.click('#sidebar-toggle');
      await page.waitForTimeout(500);
      Object.assign(got, await page.evaluate(readAll, drawerFields));
    }

    for (const f of [...plain, ...drawerFields]) {
      const [section, k, prop] = f.from;
      const want = (typeof f.want === 'object' ? f.want[key.split('-')[1]] : f.want) ?? ref[section]?.[k]?.[prop];
      const m = got[f.name];
      if (want == null) { fail(`${key} ${f.name}: spec has no ${f.from.join(' > ')}`); continue; }
      // A same-row field with fewer than two cards that pair has no row to
      // read: not applicable, reported as such; with two it needs a row.
      const na = f.measure === 'rowSpread' && m.count === 0 && m.pairable < 2;
      const pass = na || (m.count > 0 && compare(m.value, want, f.exact));
      rows.push({key, field: f.name, measured: na ? `n/a (${m.pairable} bar card)` : m.value ?? '(none)', expected: want, samples: m.count, via: m.via, pass});
      if (f.fallback && m.via === f.fallback) console.log(`note ${key} ${f.name}: no header table, measured ${f.fallback}`);
      if (!pass) fail(`${key} ${f.name}: ${m.count ? `measured ${m.value}` : f.measure === 'rowSpread' ? `no row of two cards, ${m.pairable} bar cards` : 'no sample'}, expected ${want}`);
    }
    await ctx.close();
  }
}
await browser.close();

const w = (s, n) => String(s).padEnd(n);
console.log(`\n${w('view', 14)}${w('field', 32)}${w('measured', 34)}${w('expected', 34)}result`);
for (const r of rows) console.log(`${w(r.key, 14)}${w(r.field, 32)}${w(r.measured, 34)}${w(r.expected, 34)}${r.pass ? 'ok' : 'FAIL'}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 2));
console.log(failures ? `\nRESULT FAIL ${failures}` : `\nRESULT OK ${rows.length} fields`);
process.exit(failures ? 1 : 0);
