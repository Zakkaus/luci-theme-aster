#!/usr/bin/env node
/**
 * Uniform gate: every LuCI page draws the same component the same way.
 *
 *   node checks/uniform.mjs <base url> <password>
 *        [--user root] [--pages <file>]... [--canonical <json>]
 *        [--viewports desktop,phone] [--modes light,dark] [--palette aster] [--tolerance 1]
 *        [--json <file>] [--out <file>] [--timeout 60000] [--settle 1500]
 *        [--width-test 12] [--debug-css <page>=<css>]...
 *
 *   <base url>    the device, e.g. http://127.0.0.1:18025
 *   --pages       page list (default checks/pages.txt; see lib/gate.mjs)
 *   --canonical   one value per class and property (default checks/uniform.json)
 *   --debug-css   adds a stylesheet to one page; for checks/tests/ only
 *
 * On each page and each viewport and mode it reads computed styles per
 * component class (buttons by variant and size, fields, checkboxes, table
 * rows and cells, the phone fold, cards, headings, tabs, form rows, font
 * family, tooltips, banner icons, the side nav's row gap) and layout (a
 * field filling its row, a row its card, content no wider than its card)
 * and compares every sample with the canonical value:
 * px values within --tolerance, strings (colours, borders, font family,
 * font weight, display) exactly. A canonical null means "the majority of
 * this run at that viewport and mode", and the report prints the
 * distribution so a value can be chosen.
 *
 * Exit 1 on any outlier, a failed login, a page that is missing or does not
 * render, a page that yields no samples, or a class the page list requires
 * that has no sample. Nothing is written to the device. The JSON report
 * names each failed rule: an outlier's class and property, a missing class.
 */
import fs from 'node:fs';
import path from 'node:path';
import {CHECKS, parseArgs, readPages, parseDebugCss, classMatches, openPage, eachCombo, show, writeOut, die} from './lib/gate.mjs';
import * as lst from './rules/lst.mjs';
import * as tab from './rules/tab.mjs';
import * as frm from './rules/frm.mjs';

const usage = 'usage: node checks/uniform.mjs <base url> <password> [--user root] [--pages <file>]... [--canonical <json>] [--viewports desktop,phone] [--modes light,dark] [--palette aster] [--tolerance 1] [--json <file>] [--out <file>] [--timeout ms] [--settle ms] [--width-test n] [--debug-css <page>=<css>]...';
const opt = parseArgs(process.argv.slice(2), {
  flags: {user: 'root', canonical: path.join(CHECKS, 'uniform.json'), viewports: 'desktop,phone', modes: 'light,dark', palette: 'aster', tolerance: '1', json: undefined, out: undefined, timeout: '60000', settle: '1500', 'width-test': '12'},
  repeat: ['pages', 'debug-css'],
  usage,
});
opt.timeout = +opt.timeout;
opt.settle = +opt.settle;
const tol = +opt.tolerance;
/* A fixture= entry (gate.mjs FIXTURES) is markup added for the contrast
 * gate's samples, placed without a page's layout around it: not measured. */
const pages = readPages(opt.pages.length ? opt.pages : [path.join(CHECKS, 'pages.txt')]).filter((e) => !e.fixture);
if (!pages.length) die('the page list holds only fixture= entries, which uniform does not measure');
const debugCss = parseDebugCss(opt['debug-css']);
let canonical;
try {
  canonical = JSON.parse(fs.readFileSync(opt.canonical, 'utf8')).classes;
} catch (e) {
  die(`--canonical ${opt.canonical}: ${e.message}`);
}
Object.assign(canonical, lst.canonical);
Object.assign(canonical, tab.canonical);
Object.assign(canonical, frm.canonical);

/* ── In the page ─────────────────────────────────────────────── */

/* Returns [class, property, value, where] for every sample. Values are px
 * numbers, arrays of px numbers, or strings compared exactly. */
function collect(cfg) {
  const {rgba, over, behind, ratio, visible, where, ownText} = window.__ag;
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal') : document.querySelector('#maincontent');
  if (!scope) return [];
  const out = [];
  // The path, plus the element's own words when it has any, so a report
  // line can be found on the page.
  const add = (cls, prop, v, el) => {
    const t = ownText(el).slice(0, 24);
    out.push([cls, prop, v, t ? `${where(el)} "${t}"` : where(el)]);
  };
  // Widgets an app draws that are none of the theme's components: the
  // theme maps their colours and radii (luci.css, Third-party apps) but
  // they are not read as a component, nor their overflow.
  const APP_OWN = [
    '.oc .oc-usage-help-float', // OpenClash's floating action buttons (Astryx has no FAB)
    '.oc .icon-pill, .oc .mode-tabs', // OpenClash's segmented controls (statistics view, config editor's original/runtime switch)
    '.oc [id^="tab-header-"] > .cbi-tabmenu', // OpenClash tblsection's group filter: a segmented control on .cbi-tabmenu markup
    '.oix-pwd-toggle', // OpenClash's password reveal, an adornment inside the field
    '#announcement-banner', // OpenClash's announcement marquee: its text scrolls by design
    '.oc .addr-list-scroll', // OpenClash's address list: a scroller by design
  ].join(', ');
  const all = (sel) => [...scope.querySelectorAll(sel)].filter((el) => (cfg.modal || !el.closest('#modal_overlay')) && !el.closest(APP_OWN) && visible(el));
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const col = (s) => {
    const c = rgba(s);
    const [r, g, b] = c.map(Math.round);
    return c[3] >= 0.999 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+c[3].toFixed(3)})`;
  };
  const border = (s) => {
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((k) => (parseFloat(s[`border${k}Width`]) && s[`border${k}Style`] !== 'none'
      ? `${px(s[`border${k}Width`])}px ${s[`border${k}Style`]} ${col(s[`border${k}Color`])}` : 'none'));
    return sides.every((x) => x === sides[0]) ? sides[0] : sides.join(' | ');
  };
  // A radius of half the short side or more is a pill, reported as 9999.
  const radius = (el, s) => {
    const r = el.getBoundingClientRect();
    const raw = s.borderTopLeftRadius;
    const v = raw.endsWith('%') ? (parseFloat(raw) >= 50 ? 9999 : px(raw)) : px(raw);
    return v > 0 && v >= Math.min(r.width, r.height) / 2 - 0.5 ? 9999 : v;
  };
  const box = (el) => el.getBoundingClientRect();
  // The width of a container's content box that el leaves empty.
  const fill = (el, outer) => {
    const s = getComputedStyle(outer);
    return outer.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - box(el).width;
  };
  // 24.10 writes the log view, a view's tab panes and an nftables chain
  // without the .cbi-section 25.12 gives them; the theme frames them alike.
  const CARD = '.cbi-section, .cbi-section-node, #content_syslog, #view > div:not(.cbi-map) > div > [data-tab], .nft-chain, .nft-table';
  const FRAME = `${CARD}, #view > :is(table, .table), #view > .cbi-map > :is(table, .table)`;
  const BTN = 'button, input[type="button"], input[type="submit"], input[type="reset"], .btn, .cbi-button';
  // A data table folds where it does not fit its card, at any width
  // (theme-aster.js data-fold, components.css FoldedBlock), in a JS view
  // and in a Lua CBI map (form > .cbi-map), whose parser writes real
  // <thead>/<tbody>.
  const FOLD = ':is(#view, form > .cbi-map) :is(.table, table)[data-fold="fold"]';
  // The card a node is drawn in: its outermost frame; in a dialog, the dialog.
  const frameOf = (el) => {
    if (cfg.modal) return scope;
    let f = null;
    for (let e = el; e && e !== scope; e = e.parentElement) if (e.matches(FRAME)) f = e;
    return f;
  };
  // An element's content box, left and right edge.
  const content = (el) => {
    const s = getComputedStyle(el);
    const l = box(el).left + el.clientLeft + parseFloat(s.paddingLeft);
    return [l, l + el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)];
  };
  // What a control leaves empty of its container's content box, left of it
  // and right of its line; buttons on the same line after it (a dynlist's
  // add, a password's reveal) take their share. 0: the line fills the box.
  const after = (el, outer) => [...outer.querySelectorAll(BTN)].filter((b) => {
    if (b === el || !visible(b)) return false;
    const q = box(b), r = box(el);
    return q.left >= r.right - 1 && q.top < r.bottom - 1 && q.bottom > r.top + 1;
  }).sort((a, b) => box(a).left - box(b).left);
  const lineFill = (el, outer) => {
    const [l, r] = content(outer);
    const end = Math.max(box(el).right, ...after(el, outer).map((b) => box(b).right));
    return box(el).left - l + (r - end);
  };
  // A .cbi-dropdown.btn is a split button (Diagnostics, page actions).
  const FIELD = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="hidden"], [type="image"]), select:not([multiple]), .cbi-dropdown:not(.btn)';

  // Buttons: variant from luci-base's class, size from where it sits (a
  // table cell holds the small one). A button with no words is an icon one.
  for (const el of all(BTN)) {
    if (el.parentElement?.closest(BTN) || el.parentElement?.closest('.cbi-dropdown')) continue;
    const s = getComputedStyle(el);
    // Words set at size 0 are not drawn (OpenClash hides an icon button's
    // label that way): such a button shows only its icon.
    const text = parseFloat(s.fontSize) > 0 ? (el.matches('input') ? el.value : el.textContent).trim() : '';
    const variant = el.matches('.cbi-dropdown') ? 'dropdown'
      : el.matches('.cbi-button-link') ? 'link'
      : el.matches('.cbi-button-negative, .cbi-button-remove') ? 'danger'
      : el.matches('.cbi-button-positive, .cbi-button-apply, .cbi-button-save, .cbi-button-action, .btn.important') ? 'primary' : 'secondary';
    const size = el.closest('td, .td, .cbi-section-remove, :is(.cbi-section, .cbi-section-node):not(#modal_overlay *) > .right') ? 'sm' : 'md';
    // A label of one or two glyphs and no letter or digit (a pager's « and
    // », the drag handle, a dynlist's +) draws an icon, so the button is an
    // icon one: square, so its width is read too.
    const icon = !text || /^[^\p{L}\p{N}]{1,2}$/u.test(text);
    const cls = icon ? `button.icon.${size}` : `button.${variant}.${size}`;
    add(cls, 'height', px(box(el).height), el);
    if (icon) add(cls, 'width', px(box(el).width), el);
    add(cls, 'radius', radius(el, s), el);
    // An icon button with no words draws an image (an SVG): it has no
    // label size to read.
    if (text) add(cls, 'fontSize', px(s.fontSize), el);
    // A split button's label is its chosen item, which holds the inline
    // padding; the button's own box has none, the chevron segment ends it.
    const pad = el.matches('.cbi-dropdown') ? getComputedStyle(el.querySelector(':scope > ul > li[display]') ?? el) : s;
    add(cls, 'paddingInline', el.matches('.cbi-dropdown') ? [px(pad.paddingLeft), px(pad.paddingRight)] : [px(s.paddingLeft), px(s.paddingRight)], el);
  }

  // One primary per group, by meaning (Astryx ButtonGroup): a form row's
  // own action is secondary; a save bar, dialog footer, cell or section
  // holds at most one filled button. Filled = the accent fill.
  {
    const probe = document.body.appendChild(document.createElement('i'));
    probe.style.background = 'var(--color-accent)';
    const accent = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const per = new Map();
    for (const el of all(BTN)) {
      if (!visible(el) || el.parentElement?.closest(BTN) || el.parentElement?.closest('.cbi-dropdown')) continue;
      const filled = getComputedStyle(el).backgroundColor === accent;
      if (el.closest('.cbi-value-field') && !el.matches('.cbi-dropdown')) add('button.field', 'variant', filled ? 'primary' : 'secondary', el);
      if (!filled) continue;
      const g = el.closest('.cbi-page-actions, .modal, td, .td, .cbi-section, #view') ?? document.body;
      per.set(g, (per.get(g) ?? 0) + 1);
    }
    for (const [g, n] of per) add('button.primary', 'perGroup', n === 1 ? 'one' : `${n}`, g); // a string, as table.actions
  }

  // Single-line fields: text inputs, selects and luci-base's dropdown widget.
  for (const el of all(FIELD)) {
    if (el.parentElement?.closest('.cbi-dropdown')) continue;
    const s = getComputedStyle(el);
    const cls = `field.${el.matches('select') ? 'select' : el.matches('.cbi-dropdown') ? 'dropdown' : 'input'}`;
    add(cls, 'height', px(box(el).height), el);
    add(cls, 'radius', radius(el, s), el);
    add(cls, 'border', border(s), el);
    add(cls, 'fontSize', px(s.fontSize), el);
    const field = el.closest('.cbi-value-field');
    if (field && !el.closest('td, .td')) {
      // On a phone a field fills its row, whose width depends on the frame
      // around it (a card, a dialog): read what the field itself leaves of
      // the row, less the buttons on its line (a dynlist's add, a
      // password's reveal). That the row fills its frame is form.row fill.
      // A dynlist's add field shares its row with the + (Dynlist): the
      // list is the field, as wide as any other.
      const list = el.closest('.cbi-dynlist');
      // A read-only value (System's Local Time) sizes to itself, never
      // narrower than a field (C5): read its floor, not its text.
      const w = box(list ?? el).width;
      if (cfg.device === 'phone') add(cls, 'formFill', px(lineFill(list ?? el, field)), el);
      else add(cls, 'formWidth', px(el.matches('input[readonly]') ? Math.min(w, parseFloat(s.minInlineSize) || w) : w), el);
      if (list && el.parentElement.matches('.add-item')) {
        const b = el.parentElement.querySelector(':scope > .cbi-button-add');
        if (b && visible(b)) add('dynlist', 'add', box(b).top < box(el).bottom - 1 ? 'beside' : 'below', b);
      }
    }
    // The space between a field and the button on its line.
    const next = after(el, field ?? el.parentElement)[0];
    if (next) add(cls, 'buttonGap', px(box(next).left - box(el).right), el);
  }

  for (const el of all('input[type="checkbox"], input[type="radio"]')) {
    const r = box(el);
    add(el.type, 'size', [px(r.width), px(r.height)], el);
  }

  // Tables. A table with no header row is a key/value list (MetadataList on
  // the overview), reported apart. Row height is read only where every
  // cell holds one line, so a wrapped value is not an outlier.
  const lines = (cell) => {
    const tops = [];
    const tw = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.data.trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width > 0 && !tops.some((t) => Math.abs(t - r.top) < 6)) tops.push(r.top);
      if (tops.length > 1) break;
    }
    return tops.length;
  };
  const headerOf = new Map();
  const isHeader = (row) => {
    const cells = [...row.children].filter((c) => c.matches('th, td, .th, .td'));
    return cells.length > 0 && cells.every((c) => c.matches('th, .th'));
  };
  for (const row of all('tr, .tr')) {
    if (row.matches('.placeholder, .cbi-section-table-descr')) continue;
    const table = row.closest('table, .table');
    if (!table) continue;
    const cells = [...row.children].filter((c) => c.matches('th, td, .th, .td') && visible(c));
    if (!cells.length) continue;
    // No cell cuts its text: a cell, or anything in it, that hides or
    // clips what does not fit (the router's station rates cut mid-word at
    // the card's edge) instead of wrapping it. An ellipsis marks a
    // truncation and is not read (the overflow rule's exception); a field
    // scrolls its own text.
    for (const c of cells) {
      if (c.matches('th, .th')) continue;
      let cut = 0, worst = c;
      for (const e of [c, ...c.querySelectorAll('*')]) {
        if (e.matches('input, select, textarea') || !visible(e)) continue;
        const s = getComputedStyle(e);
        if (s.overflowX === 'visible' || s.textOverflow === 'ellipsis') continue;
        const x = e.scrollWidth - e.clientWidth;
        if (x > cut) { cut = x; worst = e; }
      }
      add('table.cell', 'clip', px(cut), worst);
    }
    // Diagnostics lays its three tools out as the cells of one row: layout,
    // not data, so its row height is not read. Its cells keep the table
    // cell's inset, and each tool's field fills its cell less the button on
    // its line (luci.css puts the button under it).
    if (table.querySelector('.diag-action')) {
      for (const c of cells) {
        const s = getComputedStyle(c);
        add('table.layout.td', 'paddingBlock', [px(s.paddingTop), px(s.paddingBottom)], c);
        add('table.layout.td', 'paddingInlineStart', px(s.paddingInlineStart), c);
        for (const f of c.querySelectorAll(FIELD)) if (visible(f) && !f.parentElement.closest('.cbi-dropdown')) add(`field.${f.matches('select') ? 'select' : f.matches('.cbi-dropdown') ? 'dropdown' : 'input'}`, 'cellFill', px(lineFill(f, c)), f);
      }
      continue;
    }
    if (!headerOf.has(table)) headerOf.set(table, [...table.querySelectorAll('tr, .tr')].some((r) => r.closest('table, .table') === table && isHeader(r)));
    // A row holding a progress bar is the progress component (name and
    // value over a track), not a table row: its cells are read, its height
    // is not.
    const progress = !!row.querySelector('.cbi-progressbar');
    // A folded table (COMPONENTS.md C7 FoldedBlock): each row a grid, its
    // cells on the card's content edge in body text, the actions on the
    // title line (checks/rules/tab.mjs reads the block). Which tables fold
    // is their fit (data-fold), not how the row happens to be drawn, so a
    // fold that breaks is read as one. Row heights vary with the number of
    // columns and are not read.
    // A row's actions share one line (doona ActionGroup), never stacked:
    // those that do not fit are in the "more" menu (theme-aster.js).
    for (const c of cells) {
      const acts = [...c.querySelectorAll(':scope > :is(.btn, .cbi-button, button), :scope > div > :is(.btn, .cbi-button, button)')].filter((b) => visible(b) && !b.closest('.cbi-dropdown'));
      if (acts.length < 2) continue;
      const n = new Set(acts.map((b) => Math.round(box(b).top))).size; // a string: a count read as px would pass 2 within the 1px tolerance
      add('table.actions', 'lines', n === 1 ? 'one' : `${n} lines`, c);
    }
    if (!progress && table.matches(FOLD)) {
      add('table.fold.row', 'display', getComputedStyle(row).display, row);
      // Nothing under the row's last line but its padding: an empty cell
      // (an actions cell with no button, LuCI's "-") or a height kept from
      // the wide layout leaves a blank band over the row's rule. A cell's
      // content is its elements' boxes and its text's line boxes (the
      // glyph box plus the half-leading), an inline box's margin (it is in
      // its line: a badge's margin) and a cell's ::before key line (a key
      // whose value is empty, Routes' Protocol). Not the cells' own boxes: a
      // grid stretches them to a taller row.
      const rs = getComputedStyle(row);
      const end = box(row).bottom - parseFloat(rs.paddingBottom) - parseFloat(rs.borderBottomWidth);
      let last = box(row).top + parseFloat(rs.paddingTop) + parseFloat(rs.borderTopWidth);
      for (const c of cells) {
        const kb = getComputedStyle(c, '::before');
        if (visible(c) && kb.display !== 'none' && !/^(none|normal|""|'')$/.test(kb.content)) {
          const cs = getComputedStyle(c);
          const lh = parseFloat(kb.lineHeight) || parseFloat(kb.fontSize) * 1.2;
          last = Math.max(last, box(c).top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) + lh);
        }
        for (const e of c.querySelectorAll('*')) {
          if (!visible(e) || !(box(e).height > 0)) continue;
          const es = getComputedStyle(e);
          last = Math.max(last, box(e).bottom + (es.display.startsWith('inline') ? Math.max(0, parseFloat(es.marginBottom)) : 0));
        }
        const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) {
          if (!n.data.trim()) continue;
          const lh = parseFloat(getComputedStyle(n.parentElement).lineHeight);
          const rg = document.createRange();
          rg.selectNodeContents(n);
          for (const r of rg.getClientRects()) if (r.height > 0) last = Math.max(last, r.bottom + (lh > r.height ? (lh - r.height) / 2 : 0));
        }
      }
      add('table.fold.row', 'trail', px(Math.max(0, end - last)), row);
      cells.forEach((c, i) => {
        const s = getComputedStyle(c);
        if (c.matches('.cbi-section-actions')) {
          // Inset like the cells, and every button inside the card.
          add('table.fold.td.actions', 'paddingInline', [px(s.paddingInlineStart), px(s.paddingInlineEnd)], c);
          const f = frameOf(c);
          if (!f) return;
          const fb = box(f);
          const [l, r] = [fb.left + f.clientLeft, fb.left + f.clientLeft + f.clientWidth];
          const out = Math.max(0, ...[...c.querySelectorAll(BTN)].filter(visible).map((b) => Math.max(l - box(b).left, box(b).right - r)));
          add('table.fold.td.actions', 'overflow', px(out), c);
          return;
        }
        const cls = i === 0 ? 'table.fold.td.first' : 'table.fold.td.stacked';
        add(cls, 'paddingInlineStart', px(s.paddingInlineStart), c);
        add(cls, 'fontSize', px(s.fontSize), c);
      });
      continue;
    }
    // A form section's table (.cbi-section-table) is a data table even with
    // its header row left out (Interfaces); only a plain headerless table is
    // a key/value list.
    const base = progress ? 'table.progress' : headerOf.get(table) || table.matches('.cbi-section-table') ? 'table' : 'table.kv';
    // A row's height as the collapsed border model draws it: in the
    // separate model (a table framed as a card) the row's box also holds
    // its cells' bottom rule, which the collapsed model puts on the grid
    // line between rows. At most the Table's rule (1px) is taken off, so a
    // thicker border still shows in the height.
    const rule = getComputedStyle(table).borderCollapse === 'separate' ? Math.min(1, Math.max(0, ...cells.map((c) => parseFloat(getComputedStyle(c).borderBottomWidth) || 0))) : 0;
    const rowH = () => px(box(row).height - rule);
    // A key/value row a phone layout stacks (luci.css: the realtime
    // legends) is not a table row: its cells are read, its height is not,
    // and it may be stacked only as the layout says (never on the desktop).
    const wrapped = base === 'table.kv' && getComputedStyle(row).display !== 'table-row';
    if (wrapped) add('table.kv.row.wrap', 'display', getComputedStyle(row).display, row);
    if (isHeader(row)) add(`${base}.header`, 'height', rowH(), row);
    // (A textarea is as tall as its lines: its row has no one height.)
    else if (!progress && !wrapped && cells.every((c) => lines(c) <= 1) && !row.querySelector('textarea')) {
      const kind = row.querySelector('input:not([type="hidden"], [type="button"], [type="submit"], [type="reset"], [type="image"]), select, textarea, .cbi-dropdown') ? 'control' : row.querySelector(BTN) ? 'button' : 'text';
      add(`${base}.row.${kind}`, 'height', rowH(), row);
    }
    for (const c of cells) {
      const s = getComputedStyle(c);
      // A key/value list's first cell is the key, flush with the card
      // (MetadataList); the value cells are table cells. A stacked legend's
      // pairs sit on the card's content edge; an actions cell pads 8 (C6).
      const cls = c.matches('th, .th') ? `${base}.th` : wrapped ? 'table.kv.wrap.td' : base === 'table.kv' && c === cells[0] && cells.length > 1 ? 'table.kv.td.key'
        : c.matches('.cbi-section-actions, :not([data-title]):has(> .cbi-button:only-child)') ? `${base}.td.actions`
        // A cell holding a field pads 8 too (G7: 8 off the row lines).
        : c.matches('.cbi-value-field:has(select, .cbi-dropdown, textarea, input:not([type="hidden"], [type="checkbox"], [type="radio"]))') ? `${base}.td.field`
        // A cell aligned to the top of a row of buttons (Interfaces) puts its
        // first line where the middle of a 49 row would (C6).
        : s.verticalAlign === 'top' && row.querySelector(BTN) ? `${base}.td.top` : `${base}.td`;
      add(cls, 'paddingBlock', [px(s.paddingTop), px(s.paddingBottom)], c);
      add(cls, 'paddingInlineStart', px(s.paddingInlineStart), c);
      add(cls, 'fontSize', px(s.fontSize), c);
      if (cls.endsWith('.th')) add(cls, 'fontWeight', s.fontWeight, c);
    }
  }

  // Cards: the outermost .cbi-section / .cbi-section-node, and a table
  // standing alone in the view (24.10 writes Processes and others that way).
  // One with neither a border nor a fill is not a card: a frameless band
  // (the overview's port status) or a table not framed yet. Dialog sections
  // are the dialog's, not cards.
  // A card has no rule under its last row (Astryx Card; Table drops the
  // last body row's divider): a bottom border, or an <hr>, inside the card
  // with nothing drawn below it. A box framed on both sides (a field, a
  // button, an interface box) is not a rule. The rule's border, or none
  // (a string, so a 1px rule is not within --tolerance of none).
  const lastRule = (card) => {
    const els = [...card.querySelectorAll('*')].filter((e) => !e.closest(APP_OWN) && visible(e));
    const bottom = Math.max(...els.map((e) => box(e).bottom));
    for (const e of els) {
      const s = getComputedStyle(e);
      const side = e.matches('hr') ? 'Top' : 'Bottom';
      const bw = parseFloat(s[`border${side}Width`]);
      if (!bw || s[`border${side}Style`] === 'none' || rgba(s[`border${side}Color`])[3] === 0) continue;
      if (parseFloat(s.borderLeftWidth) && parseFloat(s.borderRightWidth)) continue;
      if (box(e).bottom >= bottom - 0.5) return add('card', 'lastRule', `${px(bw)}px ${s[`border${side}Style`]} ${col(s[`border${side}Color`])}`, e);
    }
    add('card', 'lastRule', 'none', card);
  };
  const framed = new Set();
  if (!cfg.modal) {
    const cards = all(FRAME).filter((el) => !el.parentElement.closest(CARD));
    for (const el of cards) {
      const s = getComputedStyle(el);
      if (border(s) === 'none' && rgba(s.backgroundColor)[3] === 0) continue;
      framed.add(el);
      add('card', 'radius', radius(el, s), el);
      // A wide table that is the card leaves the inline 16 to its cells (C2).
      add(el.matches(':is(table, .table)[data-fold="wide"]') ? 'card.table' : 'card', 'padding', [px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft)], el);
      add('card', 'background', col(s.backgroundColor), el);
      add('card', 'border', border(s), el);
      lastRule(el);
    }
    // The gap to the next card under the same parent: across when it sits on
    // the same row, else down from the bottom of the row this card ends.
    for (const el of framed) {
      let n = el.nextElementSibling;
      while (n && !visible(n)) n = n.nextElementSibling;
      if (!n || !framed.has(n)) continue;
      const a = box(el), b = box(n);
      if (Math.abs(a.top - b.top) < 1 && b.left >= a.right) add('card', 'gap', px(b.left - a.right), el);
      else {
        const rowBottom = Math.max(...[...framed].filter((c) => c.parentElement === el.parentElement && Math.abs(box(c).top - a.top) < 1).map((c) => box(c).bottom));
        if (b.top >= rowBottom - 0.5) add('card', 'gap', px(b.top - rowBottom), el);
      }
    }
  }

  // Content wider than its card: a card, a table, or anything that scrolls
  // inside a card (or a dialog) whose content does not fit it. The 26d0959
  // regression: a 15,200 px interfaces table scrolled inside its card while
  // the page itself did not overflow. Components designed to scroll are
  // named here and skipped; each frame reports its widest excess (0: fits).
  const SCROLLS = [
    'input, select, textarea', // Field: scrolls its own text
    '.tabs, .cbi-tabmenu', // Tabs: one line that scrolls sideways on a phone
  ].join(', ');
  // Text cut short with an ellipsis (nftables' set list) is truncated, not
  // scrolled: what it hides is marked.
  const excess = (e) => (e.matches(SCROLLS) || getComputedStyle(e).textOverflow === 'ellipsis' ? 0 : Math.max(0, e.scrollWidth - e.clientWidth));
  for (const f of cfg.modal ? [scope] : [...framed]) {
    const wide = [f, ...f.querySelectorAll('*')].filter((e) => e === f || e.matches('table, .table') || !['visible', 'clip'].includes(getComputedStyle(e).overflowX));
    let worst = f, most = -1;
    for (const e of wide) {
      if (e.closest(SCROLLS) || e.closest(APP_OWN) || !visible(e)) continue;
      const x = excess(e);
      if (x > most) { most = x; worst = e; }
    }
    add('overflow', 'excess', px(Math.max(0, most)), worst);
  }

  // Headings by role: the page title, a card's title, anything else.
  for (const el of all('h1, h2, h3, .cbi-section > legend')) {
    const s = getComputedStyle(el);
    const inCard = el.closest(CARD);
    // A heading inside a card's content under its title (Heading 4: the
    // overview's leases and stations) is not the card's title: not its
    // first heading. In a card without a title a table's own heading is
    // a title too (components.css; audit3 B1).
    const inner = !el.matches(':is(.cbi-section > div:not(.cbi-title), .cbi-section) > h3 ~ h3:has(+ :is(table, .table)):not(.cbi-section:has(> :is(h2, h3, legend, .cbi-title)) > div > h3)') && (el.matches('.cbi-section > div:not(.cbi-title) > h3') && el.closest('.cbi-section').querySelector('h1, h2, h3, h4, h5, h6, legend') !== el || el.matches('.cbi-value > .cbi-section > h3, .cbi-section > h3 ~ h3'));
    const cls = cfg.modal ? 'heading.modal' : !inCard && el.matches('h1, h2') ? 'heading.page' : inner ? 'heading.inner' : inCard ? 'heading.card' : 'heading.sub';
    add(cls, 'fontSize', px(s.fontSize), el);
    add(cls, 'fontWeight', s.fontWeight, el);
  }

  // Tabs: the theme's page tabs and luci-base's section tabs are one
  // component. The active one's indicator: a bottom border, else a box
  // shadow, else a ::before or ::after bar, on the tab or its link.
  const indicator = (el) => {
    for (const e of [el, el.querySelector(':scope > a')].filter(Boolean)) {
      const s = getComputedStyle(e);
      if (parseFloat(s.borderBottomWidth) && s.borderBottomStyle !== 'none' && rgba(s.borderBottomColor)[3] > 0) return `border ${px(s.borderBottomWidth)}px ${col(s.borderBottomColor)}`;
      if (s.boxShadow !== 'none') return `shadow ${s.boxShadow}`;
      for (const pseudo of ['::before', '::after']) {
        const a = getComputedStyle(e, pseudo);
        if (a.content !== 'none' && rgba(a.backgroundColor)[3] > 0) return `bar ${px(a.height)}px ${col(a.backgroundColor)}`;
      }
    }
    return 'none';
  };
  for (const el of all('.tabs > li > .tab, .cbi-tabmenu > li')) {
    add(el.matches('.cbi-tabmenu > li') && el.parentElement.closest('[data-tab]:not(li), #view:has(> #tabmenu, > .cbi-map > #tabmenu)') ? 'tab.sm' : 'tab', 'height', px(box(el).height), el);
    if (el.matches('[data-active], .cbi-tab')) add('tab', 'indicator', indicator(el), el);
  }
  // The strip is one line at every width (Astryx TabList scrolls).
  for (const ul of all('.tabs, .cbi-tabmenu')) {
    const n = new Set([...ul.children].filter(visible).map((li) => Math.round(box(li).top))).size;
    if (n) add('tabs.list', 'lines', n === 1 ? 'one' : `${n} lines`, ul); // a string, as table.actions
  }

  // Form rows: the label column and the gap to the next row.
  for (const el of all('.cbi-value')) {
    if (el.closest('td, .td')) continue;
    const t = el.querySelector(':scope > .cbi-value-title');
    if (t && visible(t)) {
      if (cfg.device === 'phone') add('form.label', 'fill', px(fill(t, el)), t);
      else add('form.label', 'width', px(box(t).width), t);
    }
    // The row fills its card's (or the dialog's) content box, so a field
    // that fills its row is as wide as the frame allows.
    const f = frameOf(el);
    if (f) add('form.row', 'fill', px(lineFill(el, f)), el);
    let n = el.nextElementSibling;
    while (n && !visible(n)) n = n.nextElementSibling;
    if (n && n.matches('.cbi-value')) add('form.row', 'gap', px(box(n).top - box(el).bottom), el);
  }

  // Spacing contract (space.*; lab spacing audit 2026-11-20): box to box
  // distances by role, as a container owns them. Page inset 24, page title
  // -> description 4, title or description -> what follows 24, tabs ->
  // content 16, block -> block in a column 16, card padding 16, heading
  // (its own box) -> content 16, section description -> content 16, form
  // row padding 8, label -> field 16 inline / 4 stacked, field -> help 4,
  // controls on a line 8, dialog padding, title and footer 16, tab -> tab
  // 2. An app's own widget (APP_OWN) is reported (report.space.*), not
  // judged. Touching boxes (0) are a gap of 0, not skipped.
  {
    const put = (cls, prop, v, el) => add(el.closest(APP_OWN) ? `report.${cls}` : cls, prop, v, el);
    const inPage = (e) => cfg.modal || !e.closest('#modal_overlay');
    const shown = (e) => e && visible(e) && !['absolute', 'fixed'].includes(getComputedStyle(e).position) && !e.matches('script, style, br, input[type="hidden"]');
    const sib = (e, dir) => { let n = e[dir]; while (n && !shown(n)) n = n[dir]; return n; };
    // The bottom of the row a block ends: blocks before it on the same line
    // (a grid of cards) end with it.
    const rowEnd = (a) => {
      let b = box(a).bottom;
      for (let p = sib(a, 'previousElementSibling'); p && Math.abs(box(p).top - box(a).top) < 1; p = sib(p, 'previousElementSibling')) b = Math.max(b, box(p).bottom);
      return b;
    };
    const HEAD = 'h2, h3, h4, legend';
    // A bare <p> right under the page title (Routing, Reboot) is its description.
    const DESCR = '.cbi-map-descr, .cbi-section-descr, h2 + p';
    const TABS = '.cbi-tabmenu, #tabmenu';
    const CTRL = `${BTN}, ${FIELD}, input[type="checkbox"], input[type="radio"], .control-group`;
    const FOOT = ':is(.right, .button-row, div:has(> .left + .right))';
    const title = cfg.modal ? null : [...scope.querySelectorAll('h2')].find((h) => shown(h) && inPage(h) && !h.closest(CARD));
    const pageDescr = title && sib(title, 'nextElementSibling')?.matches(DESCR) ? sib(title, 'nextElementSibling') : null;

    // Page inset: content to #maincontent's edges, top and sides; the
    // bottom (to the save bar on a wide screen) where the page is longer
    // than the main column, so the column does not stretch.
    if (!cfg.modal) {
      const inner = scope.querySelector(':scope > .shell-inner') ?? scope;
      const tops = [...inner.querySelectorAll(':scope > *, :scope > * > *, :scope > * > * > *')].filter((e) => shown(e) && !e.closest('.cbi-page-actions'));
      if (tops.length) {
        const m = box(scope);
        const v = [px(Math.min(...tops.map((e) => box(e).top)) - m.top), px(box(inner).left - m.left), px(m.right - box(inner).right)];
        const main = document.querySelector('.shell-main');
        if (cfg.device === 'phone' || (main && main.scrollHeight > main.clientHeight + 1)) v.push(px(m.bottom - Math.max(...tops.map((e) => box(e).bottom))));
        put('space.page.inset', 'padding', v, inner);
      }
    }

    // Neighbours in a column: each container's shown children, in order.
    const COLUMN = '.shell-inner, #view, #view > div:not([class]), form, .cbi-map, .cbi-section, .cbi-section-node, .cbi-tabcontainer, [data-tab]:not(li), #content_syslog, .nft-table, .cbi-value';
    const columns = [...(cfg.modal ? [scope] : []), ...scope.querySelectorAll(COLUMN)].filter((c) => shown(c) && inPage(c) && !c.closest('td, .td'));
    for (const c of columns) {
      const kids = [...c.children].filter(shown);
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1], b = kids[i];
        const end = rowEnd(a);
        if (box(b).top < end - 0.5) continue; // beside it, not under it
        if (a.matches('.cbi-value-title') || b.matches('.cbi-value-title, .cbi-value-field')) continue; // label.field
        if (a.matches('.cbi-value') && b.matches('.cbi-value')) continue; // rows abut: formrow.pad
        if (a.matches(CTRL) && b.matches(CTRL)) continue; // a wrapped line of controls
        const gap = px(box(b).top - end);
        if (cfg.modal && c === scope) {
          if (a.matches('h4') || b.matches(FOOT)) put('space.dialog', 'gap', gap, b);
          continue;
        }
        if (a === title) put(b.matches(DESCR) ? 'space.title.desc' : 'space.title.next', 'gap', gap, b);
        else if (a === pageDescr) put('space.title.next', 'gap', gap, b);
        else if (a.matches(TABS)) put('space.tabs.content', 'gap', gap, b);
        else if (a.matches(`${HEAD}, .cbi-title`)) {
          const h = a.matches('.cbi-title') ? a.querySelector(HEAD) ?? a : a;
          put('space.heading.content', 'gap', px(box(b).top - box(h).bottom), b);
        } else if (a.matches(DESCR)) put('space.descr.content', 'gap', gap, b);
        else if (b.matches('.cbi-page-actions')) put('space.page.inset', 'padding', gap, b);
        else put('space.block', 'gap', gap, b);
      }
    }

    // Dialog: 16 inside its edge, top and bottom.
    if (cfg.modal && !scope.matches('.alert-message')) {
      const kids = [...scope.children].filter(shown);
      if (kids.length) put('space.dialog', 'gap', [px(box(kids[0]).top - box(scope).top), px(box(scope).bottom - Math.max(...kids.map((e) => box(e).bottom)))], scope);
    }

    // Card padding: the outer edge to the content, top and bottom (the
    // inline side is the card's padding, which tables bleed over).
    // Cards side by side stretch to one height (the overview's Memory and
    // Storage, Astryx's dashboard rows): the bottom is read per row, from
    // the card whose content ends lowest (as measure's 'card content end').
    const ends = new Map();
    for (const el of framed) {
      const kids = [...el.children].filter(shown);
      if (kids.length) ends.set(el, box(el).bottom - Math.max(...kids.map((e) => box(e).bottom)));
    }
    const rowEndInset = (el) => Math.min(...[...ends.keys()].filter((o) => o.parentElement === el.parentElement && Math.abs(box(o).top - box(el).top) < 1 && Math.abs(box(o).bottom - box(el).bottom) < 1).map((o) => ends.get(o)));
    for (const el of framed) {
      if (el.matches('table, .table')) continue;
      const kids = [...el.children].filter(shown);
      if (!kids.length) continue;
      put('space.card.pad', 'padding', [px(Math.min(...kids.map((e) => box(e).top)) - box(el).top), px(rowEndInset(el))], el);
    }

    // Form rows: 8 above and below (16 between two rows); the label 16
    // before its field on a line, 4 above it stacked; help 4 under the
    // field. A toolbar's label (System Log, Software) is a label too.
    for (const el of all('.cbi-value')) {
      if (el.closest('td, .td')) continue;
      const s = getComputedStyle(el);
      put('space.formrow.pad', 'padding', [px(s.paddingTop), px(s.paddingBottom)], el);
    }
    // On a toolbar's line a label is one of its controls (8 apart).
    // A progress bar's value text sits a line over its track: it starts
    // there; on the label's own line it is the line's end, not a field.
    const labelGap = (t, f, el, bar) => {
      const a = box(t), b = {left: box(f).left, top: box(f).top};
      const v = getComputedStyle(f, '::before');
      if (f.matches('.cbi-progressbar') && v.content !== 'none') {
        // Its height: a value that wraps (Software's disk space on a phone) is two lines.
        b.top = box(f).bottom - parseFloat(v.bottom) - (parseFloat(v.height) || parseFloat(v.lineHeight));
        if (b.top < a.bottom - 1) return;
      }
      if (b.top < a.bottom - 1) put(bar ? 'space.control.row' : 'space.label.field', bar ? 'gap' : 'inline', px(b.left - a.right), el);
      else put('space.label.field', 'stacked', px(b.top - a.bottom), el);
    };
    for (const el of all('.cbi-value:not(.aster-same-label)')) {
      if (el.closest('td, .td')) continue;
      const t = el.querySelector(':scope > .cbi-value-title'), f = el.querySelector(':scope > .cbi-value-field');
      if (shown(t) && shown(f) && t.textContent.trim()) labelGap(t, f, el);
    }
    for (const el of all('label:not(.cbi-value-title, .cbi-value *, td *, .td *)')) {
      const p = sib(el, 'previousElementSibling'), n = sib(el, 'nextElementSibling');
      if (p?.matches('input[type="checkbox"], input[type="radio"]') || !n?.matches(`${CTRL}, .cbi-progressbar`)) continue;
      labelGap(el, n, el, true);
    }
    for (const el of all('.cbi-value-description')) {
      const prev = [];
      for (let p = sib(el, 'previousElementSibling'); p; p = sib(p, 'previousElementSibling')) prev.push(p);
      if (prev.length) put('space.field.help', 'gap', px(box(el).top - Math.max(...prev.map((e) => box(e).bottom))), el);
    }

    // Controls on one line, and tabs.
    for (const el of all(CTRL)) {
      if (el.parentElement.closest('.cbi-dropdown, .tabs, .cbi-tabmenu')) continue;
      const n = sib(el, 'nextElementSibling');
      if (!n || !n.matches(CTRL)) continue;
      const a = box(el), b = box(n);
      // The save bar is ordered against the DOM (C11): a neighbour on the left counts too.
      if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) {
        if (b.left >= a.right - 0.5) put('space.control.row', 'gap', px(b.left - a.right), n);
        else if (a.left >= b.right - 0.5 && n.parentElement.matches('.cbi-page-actions')) put('space.control.row', 'gap', px(a.left - b.right), n);
      }
    }
    for (const el of all('.tabs > li, .cbi-tabmenu > li')) {
      const n = sib(el, 'nextElementSibling');
      if (n && Math.abs(box(n).top - box(el).top) < 1) put('space.tabs.item', 'gap', px(box(n).left - box(el).right), n);
    }
  }

  // Side nav (outside the page's content): the space between two rows that
  // follow each other, so a hovered row never touches the selected one.
  // Logout sits apart at the foot of the list and is not read.
  if (!cfg.modal) {
    const rows = [...document.querySelectorAll('#mainmenu :is(.nav-label, .nav-item)')].filter(visible);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].closest('.nav > .nav-group:last-child:has(> .nav-item:only-child)')) continue;
      add('nav.item', 'gap', px(box(rows[i]).top - box(rows[i - 1]).bottom), rows[i]);
    }
  }

  // Tooltips. ui.js's (a [data-tooltip] trigger; one node it fills and
  // places on mouseover) is opened on up to three triggers: its words must
  // fit its box, with no arrow glyph before them, and it stands the
  // Tooltip's gap from its trigger. A .cbi-tooltip in markup is shown the
  // way ui.js shows one (an inline style) and its words must fit it.
  const tipRead = (tip, el) => {
    const s = getComputedStyle(tip);
    add('tooltip', 'overflow', px(Math.max(0, tip.scrollWidth - tip.clientWidth)), el);
    add('tooltip', 'padding', [px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft)], el);
    // As declared: a one-line tooltip is as high as twice its radius, which
    // the pill rule would read as 9999.
    add('tooltip', 'radius', px(s.borderTopLeftRadius), el);
    add('tooltip', 'fontSize', px(s.fontSize), el);
    // Its words are in its own ink: every text against the fill under it
    // (the tooltip's, and a chip's tint over it), WCAG AA 4.5. The fill is
    // read as declared, not through the fade-in's opacity.
    const fill = (e) => {
      let c = over(rgba(s.backgroundColor), behind(tip, false).bg);
      for (const a of [...tip.querySelectorAll('*')].filter((x) => x.contains(e))) c = over(rgba(getComputedStyle(a).backgroundColor), c);
      return c;
    };
    let low = null;
    for (const e of [tip, ...tip.querySelectorAll('*')]) {
      if (!ownText(e) || !visible(e)) continue;
      const f = fill(e);
      const r = ratio(over(rgba(getComputedStyle(e).color), f), f);
      if (r < 4.5 && (!low || r < low.r)) low = {r, e};
    }
    add('tooltip', 'ink', low ? `${low.r.toFixed(2)}:1` : 'AA', low ? low.e : el);
    // The box is as wide as its words up to the Tooltip's 300: no word that
    // would fit on a line is broken over two (a tooltip shrunk to its
    // min-content stood one letter a line).
    const room = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--aster-tooltip-max-w')) - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    let broken = null;
    const tw = document.createTreeWalker(tip, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n && !broken; n = tw.nextNode()) {
      for (const m of n.data.matchAll(/[^\s\-\/]+/g)) { // a hyphen or slash is a break opportunity
        const rg = document.createRange();
        rg.setStart(n, m.index);
        rg.setEnd(n, m.index + m[0].length);
        const rects = [...rg.getClientRects()].filter((q) => q.width > 0);
        const w = rects.reduce((a, q) => a + q.width, 0);
        if (new Set(rects.map((q) => Math.round(q.top))).size > 1 && w <= room) { broken = m[0]; break; }
      }
    }
    add('tooltip', 'words', broken ? `"${broken.slice(0, 24)}" broken over lines` : 'whole', el);
    // A key/value line is one line, two where a value wraps: never taller.
    const lines = [...tip.querySelectorAll('.nowrap')].filter(visible).map((n) => Math.round(box(n).height / parseFloat(getComputedStyle(n).lineHeight)));
    if (lines.length) add('tooltip', 'lines', Math.max(...lines) <= 2 ? '<= 2' : `${Math.max(...lines)} lines`, el);
  };
  for (const el of all('[data-tooltip]').slice(0, 3)) {
    el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    const tip = [...document.body.children].find((c) => c.matches('.cbi-tooltip[style]'));
    if (!tip) continue;
    tipRead(tip, el);
    add('tooltip', 'arrow', /^\s*[▲▼]/.test(tip.textContent) ? 'glyph' : 'none', el);
    const t = box(tip), r = box(el);
    add('tooltip', 'gap', px(t.bottom <= r.top + 0.5 ? r.top - t.bottom : t.top - r.bottom), el);
    el.dispatchEvent(new MouseEvent('mouseout', {bubbles: true}));
  }
  // A key/value list in a tooltip, as 30_network.js puts the DHCPv6
  // statistics in an upstream box (ui.itemlist inside a .cbi-tooltip), is
  // built in the overview's first upstream box when the device has none
  // (the lab has no DHCPv6 upstream) and taken out after the read.
  const host = cfg.modal ? null : scope.querySelector('.network-status-table .ifacebox-body');
  let probe = null;
  if (host && !host.querySelector('.cbi-tooltip-container .cbi-tooltip .nowrap')) {
    const list = (pairs) => {
      const sp = document.createElement('span');
      pairs.forEach(([k, v], i) => {
        const n = Object.assign(document.createElement('span'), {className: 'nowrap'});
        const st = document.createElement('strong');
        st.textContent = `${k}: `;
        n.append(st, v);
        if (i) sp.append(document.createElement('br'));
        sp.append(n);
      });
      return sp;
    };
    const tip = Object.assign(document.createElement('span'), {className: 'cbi-tooltip'});
    tip.append(list(['solicit', 'advertise', 'request', 'renew', 'reply', 'information_request', 'discarded_packets'].map((k, i) => [`DHCPv6 ${k}`, `${i * 7} pkts`])));
    const c = Object.assign(document.createElement('span'), {className: 'cbi-tooltip-container'});
    c.append('📊', tip);
    probe = list([['DHCPv6 Statistics', c]]);
    host.append(probe);
  }
  for (const tip of scope.querySelectorAll('.cbi-tooltip-container > .cbi-tooltip:not(:empty, [style])')) {
    if ((!cfg.modal && tip.closest('#modal_overlay')) || tip.closest(APP_OWN) || !visible(tip.parentElement)) continue;
    tip.setAttribute('style', 'transition: none'); // shown at once, not fading in from opacity 0
    if (visible(tip)) tipRead(tip, tip.parentElement);
    tip.removeAttribute('style');
  }
  probe?.remove();

  // Headings: every title is one of Astryx's Heading sizes the theme
  // uses (1, 2, 3, 4), and an <abbr> in it carries no dotted rule.
  const probe2 = document.body.appendChild(document.createElement('div'));
  const levels = [1, 2, 3, 4].map((n) => { probe2.style.fontSize = `var(--text-heading-${n}-size)`; return px(getComputedStyle(probe2).fontSize); });
  probe2.remove();
  for (const h of scope.querySelectorAll('h1, h2, h3, h4, h5, h6, legend')) {
    if (!visible(h) || h.closest(APP_OWN) || (!cfg.modal && h.closest('#modal_overlay')) || !ownText(h)) continue;
    const f = px(getComputedStyle(h).fontSize);
    add('heading', 'level', levels.includes(f) ? 'astryx' : `${f}px`, h);
    for (const ab of h.querySelectorAll('abbr')) add('heading', 'abbr', getComputedStyle(ab).textDecorationLine, ab);
  }

  // Tabs: one pane of a group shows, the active one (Astryx TabPanel).
  const groups = new Map();
  for (const p of scope.querySelectorAll('[data-tab-title]')) {
    if ((!cfg.modal && p.closest('#modal_overlay')) || p.closest(APP_OWN) || !visible(p.parentElement)) continue;
    groups.set(p.parentElement, (groups.get(p.parentElement) ?? 0) + (visible(p) ? 1 : 0));
  }
  for (const [g, n] of groups) add('tabs.pane', 'shown', n === 1 ? 'one' : `${n} panes`, g); // a string, as table.actions

  // Frames: no frame inside a frame (Astryx Card: "Don't nest cards inside
  // other cards"; layout/structure: no Cards inside Cards). A frame draws
  // its own edge: a border on all four sides, a shadow, or a rounded fill
  // of its own. What Astryx puts in a card by design is not a frame here
  // (FRAME_OK): controls (Field, Select, Button), Badge and Token chips,
  // ProgressBar, code, Banner, Tooltip, Menu, and a tab's hover fill. A
  // dynlist's value is a Token only while it is one: no block padding and
  // a Token's height (md - 8); a padded row is a filled box in the card
  // (router measure 2026-11-21, 4/36/4/12). A save bar in the page's flow
  // (a phone) that keeps its divider or its fill is a band: inside a card
  // it is a second frame (Startup, Backup); fixed under the column it is
  // the layout's footer, not in the card. A dialog is a frame over the page.
  const FRAME_OK = [
    'input', 'select', 'textarea', 'button', '.btn', '.cbi-button', '.cbi-dropdown', '.cbi-dropdown *',
    '.label', '.zonebadge', '.ifacebadge', '.cbi-progressbar', '.cbi-progressbar *', 'code', 'kbd', 'pre', 'samp',
    '.alert-message', '.cbi-tooltip', '.cbi-tooltip *', '.cbi-tabmenu > li > a', 'img', 'svg', 'canvas',
  ].join(', ');
  const tokenH = (() => {
    const d = document.body.appendChild(document.createElement('div'));
    d.style.blockSize = 'calc(var(--size-element-md) - var(--spacing-2))';
    const h = d.getBoundingClientRect().height;
    d.remove();
    return h;
  })();
  // An Astryx Token or Badge inside a field (a dynlist value, a chip in a
  // cell) has its own fill or border by design, as a Badge does: no block
  // padding, no taller than the md Token, and as wide as its words (a
  // Token's icon or remove mark adds less than its height). A filled row
  // (padded, taller, or the field's width around short words) is a frame
  // in the card. A flex item's display is blockified, so the width, not
  // the display, tells a chip from a row.
  const isToken = (el, s) => {
    if (!el.closest('.cbi-value-field, .cbi-dynlist, td, .td') || parseFloat(s.paddingTop) !== 0 || parseFloat(s.paddingBottom) !== 0 || box(el).height > tokenH + 0.5) return false;
    const r = document.createRange();
    r.selectNodeContents(el);
    const inner = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((w, k) => w + parseFloat(s[k]), r.getBoundingClientRect().width);
    return box(el).width <= inner + tokenH;
  };
  const edgeOf = new Map();
  const edge = (el) => {
    if (edgeOf.has(el)) return edgeOf.get(el);
    let k = null;
    const s = getComputedStyle(el);
    const seen = (c) => rgba(c)[3] > 0.04;
    if (el.matches('.cbi-page-actions') && !['fixed', 'absolute'].includes(s.position)) {
      const under = behind(el, false).bg, mine = over(rgba(s.backgroundColor), under);
      const rule = ['Top', 'Right', 'Bottom', 'Left'].some((d) => parseFloat(s[`border${d}Width`]) > 0 && s[`border${d}Style`] !== 'none' && seen(s[`border${d}Color`]));
      if (rule || [0, 1, 2].some((i) => Math.abs(mine[i] - under[i]) > 3)) k = 'band';
    } else if (!el.matches(FRAME_OK) && !isToken(el, s) && !/^(contents|inline)$/.test(s.display)) {
      const shadows = s.boxShadow === 'none' ? [] : s.boxShadow.match(/(?:rgba?|oklch|oklab|color)\([^)]*\)/g) ?? [];
      if (['Top', 'Right', 'Bottom', 'Left'].every((d) => parseFloat(s[`border${d}Width`]) > 0 && s[`border${d}Style`] !== 'none' && seen(s[`border${d}Color`]))) k = 'border';
      else if (shadows.some(seen)) k = 'shadow';
      else if (seen(s.backgroundColor) && parseFloat(s.borderTopLeftRadius) > 0) {
        const under = behind(el, false).bg, mine = over(rgba(s.backgroundColor), under);
        if ([0, 1, 2].some((i) => Math.abs(mine[i] - under[i]) > 3)) k = 'fill';
      }
    }
    edgeOf.set(el, k);
    return k;
  };
  for (const el of all('*')) {
    if (!edge(el)) continue;
    for (let a = el.parentElement; a && (scope.contains(a)); a = a.parentElement) {
      if (edge(a)) { add('frame', 'nested', `${edge(el)} in ${edge(a)}: ${where(a)}`, el); break; }
    }
  }

  // Dialog: a tall one stops at Astryx Dialog's height, so its footer is
  // in the window. Under it, the scrim covers the save bar.
  if (cfg.modal && !scope.matches('.alert-message')) add('dialog', 'fits', box(scope).bottom <= innerHeight + 0.5 ? 'yes' : `${px(box(scope).bottom - innerHeight)}px past the window`, scope);
  const under = cfg.modal ? [...document.querySelectorAll('.cbi-page-actions')].find(visible) : null;
  if (under) {
    const b = box(under);
    const hit = document.elementFromPoint(Math.min(b.right - 2, innerWidth - 2), Math.min(b.bottom, innerHeight) - 2);
    add('dialog', 'scrim', hit?.closest('#modal_overlay') ? 'over the save bar' : `under ${hit ? where(hit) : 'nothing'}`, scope);
  }

  // Banner and status dialog: the icon (::before) stands the Banner's gap
  // before the words, never on them. The words are the text outside buttons.
  // A status dialog is the .alert-message itself.
  for (const el of [scope, ...all('.alert-message')].filter((e, i) => i || e.matches('.alert-message'))) {
    const a = getComputedStyle(el, '::before');
    if (a.content === 'none' || a.position !== 'absolute') continue;
    const icon = box(el).left + el.clientLeft + parseFloat(a.left) + parseFloat(a.width);
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let left = Infinity;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.data.trim() || n.parentElement.closest('button, .btn, .cbi-button, .right, .button-row')) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 0) left = Math.min(left, q.left);
    }
    if (left < Infinity) add('banner.icon', 'gap', px(left - icon), el);
  }

  // Raw glyphs: an element whose own words are only a character LuCI draws
  // as an icon (▾ ⇒ ∗ + × ··· ▲ ▼) shows it; the theme draws the Heroicon
  // and hides the character (font-size 0). A ▲ or ▼ still in running text
  // ("▲ 1.5 GiB": theme-aster.js did not take it out) is raw as well. Only
  // showing ones are listed.
  for (const el of scope.querySelectorAll('*')) {
    const t = ownText(el).trim();
    const inText = /(^|\s)[▲▼]\s/.test(t) && !el.closest('.cbi-tooltip');
    if ((!/^(▾|⇒|∗|\+|×|···|▲|▼)$/.test(t) && !inText) || (!cfg.modal && el.closest('#modal_overlay')) || el.closest(APP_OWN) || !visible(el)) continue;
    if (inText || parseFloat(getComputedStyle(el).fontSize) > 0) add('glyph', 'raw', inText ? t.match(/[▲▼]/)[0] : t, el);
  }
  // LuCI's device images (resources/icons/*.svg) are drawn as Heroicons,
  // the image hidden (tooltips keep theirs); a showing one is listed. A
  // zone's inline colour is mapped to palette tokens, never shown as is.
  for (const im of scope.querySelectorAll('img[src*="/icons/"]')) {
    if (visible(im) && !im.closest('.cbi-tooltip, ' + APP_OWN) && (cfg.modal || !im.closest('#modal_overlay'))) add('icon', 'legacy', im.getAttribute('src').replace(/.*\//, ''), im);
  }
  for (const z of scope.querySelectorAll('.zonebadge[style*="--zone-color-rgb"]')) {
    if (!visible(z) || z.closest('.cbi-tooltip') || (!cfg.modal && z.closest('#modal_overlay'))) continue;
    const inline = `rgb(${z.style.getPropertyValue('--zone-color-rgb').trim().split(/\s*,\s*/).join(', ')})`;
    add('zone', 'fill', getComputedStyle(z).backgroundColor === inline ? `inline ${inline}` : 'token', z);
  }

  // The save bar is the layout's footer: on a wide screen it sits under
  // the main column, which ends above it, so it covers none of the page.
  const bar = cfg.modal ? null : [...document.querySelectorAll('.cbi-page-actions')].find(visible);
  if (bar && getComputedStyle(bar).position === 'fixed') {
    const main = document.querySelector('.shell-main');
    add('footer', 'overlap', px(Math.max(0, box(main).bottom - box(bar).top)), bar);
    // The last block 24 above the bar (Astryx LayoutFooter; spacing
    // contract), read with the column scrolled to its end. That block is
    // the page footer's line when it shows (its own bottom padding is the
    // 24), else the page's last block; a tooltip floats over the page and
    // ends nothing. A page shorter than the column ends in free space, not
    // a gap.
    if (main.scrollHeight > main.clientHeight + 1) {
      const st = main.scrollTop;
      main.scrollTop = main.scrollHeight;
      const foot = main.querySelector(':scope > .shell-footer');
      const ends = [...scope.querySelectorAll('#view *')]
        .filter((e) => !bar.contains(e) && !e.closest('#modal_overlay, .cbi-tooltip') && visible(e) && getComputedStyle(e).position !== 'fixed')
        .map((e) => box(e).bottom);
      if (foot && visible(foot)) ends.push(box(foot).bottom - parseFloat(getComputedStyle(foot).paddingBlockEnd));
      if (ends.length) add('space.page.bar', 'gap', px(box(bar).top - Math.max(...ends)), bar);
      main.scrollTop = st;
    }
  }

  // Font family of every element with its own words, and of every control.
  const fam = (f) => f.replace(/["']/g, '').split(',').map((x) => x.trim()).join(', ');
  for (const el of scope.querySelectorAll('*')) {
    if (!el.matches('input, select, textarea, button') && !ownText(el)) continue;
    if (el.matches('option, script, style') || (!cfg.modal && el.closest('#modal_overlay')) || el.closest(APP_OWN) || !visible(el)) continue;
    // A textarea is the Field's code variant (logs, keys, crontab, rc.local);
    // so is a CodeMirror editor (.cm-editor) an app puts in its place.
    add(el.closest('pre, code, kbd, samp, tt, textarea, .cm-editor') ? 'font.code' : 'font.body', 'fontFamily', fam(getComputedStyle(el).fontFamily), el);
  }
  return out;
}

/* The Argon regression: a field's width must not follow its placeholder or
 * its option text. For up to `limit` fields in form rows, the width with a
 * one-letter and a 60-letter placeholder / option / shown item, as the
 * largest change from the width before. Everything is put back. */
function widthTest(cfg) {
  const {visible, where} = window.__ag;
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal') : document.querySelector('#maincontent');
  if (!scope) return [];
  const out = [];
  const long = 'W'.repeat(60);
  const sel = '.cbi-value-field :is(input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="hidden"], [type="image"]), select:not([multiple]), .cbi-dropdown:not(.btn))';
  const fields = [...scope.querySelectorAll(sel)]
    .filter((el) => !el.closest('td, .td') && !el.parentElement.closest('.cbi-dropdown') && (cfg.modal || !el.closest('#modal_overlay')) && visible(el))
    .slice(0, cfg.limit);
  for (const el of fields) {
    const w = () => el.getBoundingClientRect().width;
    const w0 = w();
    const ws = [];
    let cls;
    if (el.matches('select')) {
      cls = 'field.select';
      const o = new Option(long);
      el.add(o);
      ws.push(w());
      o.remove();
    } else if (el.matches('.cbi-dropdown')) {
      cls = 'field.dropdown';
      const item = el.querySelector(':scope > ul > li[display], :scope > ul > li[placeholder]') ?? el.querySelector(':scope > ul > li');
      if (!item) continue;
      const old = item.textContent;
      for (const t of ['x', long]) { item.textContent = t; ws.push(w()); }
      item.textContent = old;
    } else {
      cls = 'field.input';
      const old = el.getAttribute('placeholder');
      for (const t of ['x', long]) { el.setAttribute('placeholder', t); ws.push(w()); }
      if (old === null) el.removeAttribute('placeholder'); else el.setAttribute('placeholder', old);
    }
    out.push([cls, 'textWidth', Math.round(Math.max(...ws.map((x) => Math.abs(x - w0))) * 100) / 100, where(el)]);
  }
  return out;
}

/* How many data rows the page's tables hold, drawn or not: a row with a
 * data cell that is not the empty message or a description. The DOM is the
 * same at every viewport, so a phone that folds a table away still counts
 * its rows (table@rows in the page list). */
function dataRows(cfg) {
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal') : document.querySelector('#maincontent');
  if (!scope) return 0;
  return [...scope.querySelectorAll('tr, .tr')].filter((row) => (cfg.modal || !row.closest('#modal_overlay'))
    && !row.matches('.placeholder, .cbi-section-table-descr') && row.closest('table, .table')
    && !row.closest('table, .table').querySelector('.diag-action')
    && [...row.children].some((c) => c.matches('td, .td'))).length;
}

/* ── Run ─────────────────────────────────────────────────────── */

const errors = [];
const results = [];
await eachCombo(opt, async (ctx, device, mode, combo) => {
  for (const entry of pages) {
    const r = await openPage(ctx, opt, entry, mode, debugCss);
    if (r.error) {
      errors.push({page: entry.id, combo, error: r.error});
      process.stderr.write(`${combo} ${entry.id}: ERROR ${r.error}\n`);
      continue;
    }
    // The tab rules first: the collectors after them open tooltips in
    // markup, which grows the tables they measure.
    const samples = await r.page.evaluate(tab.collect, {modal: !!entry.modal, device});
    samples.push(...await r.page.evaluate(collect, {modal: !!entry.modal, device}));
    samples.push(...await r.page.evaluate(widthTest, {modal: !!entry.modal, limit: +opt['width-test']}));
    samples.push(...await r.page.evaluate(lst.collect, {modal: !!entry.modal, device}));
    samples.push(...await r.page.evaluate(frm.collect, {modal: !!entry.modal, device}));
    const rows = await r.page.evaluate(dataRows, {modal: !!entry.modal});
    await r.page.close();
    results.push({entry, device, mode, combo, samples, rows, note: r.note, pageErrors: r.errors});
    process.stderr.write(`${combo} ${entry.id}: ${samples.length} samples\n`);
  }
}, (combo, page, error) => errors.push({page, combo, error}));

/* Canonical lookup: the exact class first, then patterns with * standing
 * for one dotted segment, fewest * first, then the one whose first * comes
 * later (button.icon.* before button.*.md). A value may be split by device,
 * mode, or device-mode. undefined: the file does not mention it. */
const firstStar = (p) => { const i = p.split('.').indexOf('*'); return i < 0 ? 99 : i; };
const patterns = Object.keys(canonical).sort((a, b) => a.split('*').length - b.split('*').length || firstStar(b) - firstStar(a));
function lookup(cls, prop, device, mode) {
  const seg = cls.split('.');
  for (const p of patterns) {
    const ps = p.split('.');
    if (ps.length !== seg.length || !ps.every((x, i) => x === '*' || x === seg[i])) continue;
    if (!(prop in canonical[p])) continue;
    let v = canonical[p][prop];
    if (v && typeof v === 'object' && !Array.isArray(v)) v = v[`${device}-${mode}`] ?? v[device] ?? v[mode] ?? null;
    return v;
  }
  return undefined;
}
const norm = (v) => (typeof v === 'string' ? v.replace(/["']/g, '').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim() : v);
function same(got, want) {
  if (typeof want === 'string' || typeof got === 'string') return norm(String(got)) === norm(String(want));
  const g = Array.isArray(got) ? got : [got];
  const w = Array.isArray(want) ? want : g.map(() => want);
  if (g.length !== w.length) return false;
  return g.every((x, i) => (x >= 9999 && w[i] >= 9999) || Math.abs(x - w[i]) <= tol);
}

// Distribution per viewport-mode, class and property: value -> samples, pages.
const dist = new Map();
for (const r of results) {
  for (const [cls, prop, v] of r.samples) {
    const k = `${r.combo}|${cls}|${prop}`;
    if (!dist.has(k)) dist.set(k, new Map());
    const m = dist.get(k);
    const sv = show(v);
    if (!m.has(sv)) m.set(sv, {value: v, n: 0, pages: new Set()});
    const e = m.get(sv);
    e.n++;
    e.pages.add(r.entry.id);
  }
}
const majority = (k) => [...dist.get(k).values()].sort((a, b) => b.n - a.n || b.pages.size - a.pages.size)[0].value;

const outliers = new Map();
const unlisted = new Set();
const missing = [];
for (const r of results) {
  if (!r.samples.length) errors.push({page: r.entry.id, combo: r.combo, error: 'measured nothing'});
  for (const req of r.entry.require) {
    const [cls, only] = req.split('@');
    if (only === 'desktop' && r.device !== 'desktop') continue;
    if (only === 'rows' && r.device !== 'desktop' && !r.rows) continue;
    if (!r.samples.some(([c]) => classMatches(cls, c))) missing.push({page: r.entry.id, combo: r.combo, cls, ...(only === 'rows' ? {rows: r.rows} : {})});
  }
  for (const [cls, prop, v, where] of r.samples) {
    if (cls.startsWith('report.')) continue; // an app's own widget: in the distributions only
    let want = lookup(cls, prop, r.device, r.mode);
    if (want === undefined) unlisted.add(`${cls} ${prop}`);
    if (want == null) want = majority(`${r.combo}|${cls}|${prop}`);
    if (same(v, want)) continue;
    const k = `${r.entry.id}|${r.combo}|${cls}|${prop}|${show(v)}`;
    if (!outliers.has(k)) outliers.set(k, {page: r.entry.id, combo: r.combo, cls, prop, got: show(v), want: show(want), count: 0, examples: []});
    const o = outliers.get(k);
    o.count++;
    if (o.examples.length < 3) o.examples.push(where);
  }
}

/* ── Report ──────────────────────────────────────────────────── */

const L = [];
const combos = opt.devices.flatMap((d) => opt.modes.map((m) => `${d}-${m}`));
L.push(`uniform  ${opt.url}  ${pages.length} pages  ${combos.join(' ')}  canonical ${path.relative(process.cwd(), opt.canonical)}  tolerance ${tol}px`);
L.push('', `ERRORS (${errors.length})`);
for (const e of errors) L.push(`  ${e.combo}  ${e.page}: ${e.error}`);
L.push('', `MISSING REQUIRED CLASSES (${missing.length})`);
for (const m of missing) L.push(`  ${m.combo}  ${m.page}: no ${m.cls}${m.rows ? ` (the page's tables hold ${m.rows} data rows)` : ''}`);
const outList = [...outliers.values()];
L.push('', `OUTLIERS (${outList.reduce((a, o) => a + o.count, 0)} samples in ${outList.length} groups), page by page`);
for (const p of pages) {
  const mine = outList.filter((o) => o.page === p.id);
  if (!mine.length) continue;
  L.push(`${p.id}`);
  mine.sort((a, b) => a.cls.localeCompare(b.cls) || a.prop.localeCompare(b.prop) || a.combo.localeCompare(b.combo));
  for (const o of mine) L.push(`  ${o.combo.padEnd(13)} ${`${o.cls} ${o.prop}`.padEnd(32)} ${o.got} (want ${o.want}) x${o.count}  ${o.examples[0]}`);
}
const byPageClass = new Map();
for (const o of outList) {
  const k = `${o.page}  ${o.cls}`;
  byPageClass.set(k, (byPageClass.get(k) ?? 0) + o.count);
}
const ranked = [...byPageClass].sort((a, b) => b[1] - a[1]);
L.push('', `OUTLIER SAMPLES PER PAGE AND CLASS (top 10 of ${ranked.length})`);
for (const [k, n] of ranked.slice(0, 10)) L.push(`  ${String(n).padStart(5)}  ${k}`);
L.push('', 'CANONICAL VALUES AND DISTRIBUTIONS (value xsamples/pages; majority first)');
const keys = [...new Set([...dist.keys()].map((k) => k.split('|').slice(1).join('|')))].sort();
const distJson = {};
for (const ck of keys) {
  const [cls, prop] = ck.split('|');
  for (const combo of combos) {
    const m = dist.get(`${combo}|${ck}`);
    if (!m) continue;
    const [device, mode] = combo.split('-');
    const want = lookup(cls, prop, device, mode);
    const vals = [...m.values()].sort((a, b) => b.n - a.n);
    const label = want === undefined ? 'unlisted, majority' : want === null ? 'majority' : `canonical ${show(want)}`;
    L.push(`  ${`${cls} ${prop}`.padEnd(32)} ${combo.padEnd(13)} [${label}] ${vals.slice(0, 6).map((v) => `${show(v.value)} x${v.n}/${v.pages.size}`).join(', ')}${vals.length > 6 ? `, +${vals.length - 6} more` : ''}`);
    distJson[`${cls} ${prop} ${combo}`] = {canonical: want ?? null, values: vals.map((v) => ({value: show(v.value), samples: v.n, pages: [...v.pages]}))};
  }
}
if (unlisted.size) L.push('', `NOT IN THE CANONICAL FILE (judged by majority): ${[...unlisted].sort().join('; ')}`);
const notes = results.filter((r) => r.note).map((r) => `${r.combo} ${r.entry.id}: ${r.note}`);
if (notes.length) L.push('', 'NOTES', ...notes.map((n) => `  ${n}`));
const total = results.reduce((a, r) => a + r.samples.length, 0);
const failed = errors.length || missing.length || outList.length;
L.push('', `RESULT ${failed ? 'FAIL' : 'OK'}  palette ${opt.palette}  errors ${errors.length}  missing ${missing.length}  outlier samples ${outList.reduce((a, o) => a + o.count, 0)}  samples ${total}`);
const text = `${L.join('\n')}\n`;
process.stdout.write(text);
writeOut(opt.out, text);
writeOut(opt.json, JSON.stringify({
  gate: 'uniform', base: opt.url, palette: opt.palette, combos, tolerance: tol, canonicalFile: opt.canonical,
  pages: pages.map((p) => ({id: p.id, require: p.require})),
  errors, missing, outliers: outList,
  perPageClass: Object.fromEntries(ranked),
  distributions: distJson,
  pageErrors: results.filter((r) => r.pageErrors.length).map((r) => ({page: r.entry.id, combo: r.combo, errors: r.pageErrors})),
  result: failed ? 'FAIL' : 'OK',
}, null, 1));
process.exit(failed ? 1 : 0);
