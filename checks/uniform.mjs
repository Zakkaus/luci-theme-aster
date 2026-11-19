#!/usr/bin/env node
/**
 * Uniform gate: every LuCI page draws the same component the same way.
 *
 *   node checks/uniform.mjs <base url> <password>
 *        [--user root] [--pages <file>]... [--canonical <json>]
 *        [--viewports desktop,phone] [--modes light,dark] [--tolerance 1]
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
 * rows and cells, cards, headings, tabs, form rows, font family) and compares
 * every sample with the canonical value: px values within --tolerance,
 * strings (colours, borders, font family, font weight) exactly. A canonical
 * null means "the majority of this run at that viewport and mode", and the
 * report prints the distribution so a value can be chosen.
 *
 * Exit 1 on any outlier, a failed login, a page that is missing or does not
 * render, a page that yields no samples, or a class the page list requires
 * that has no sample. Nothing is written to the device.
 */
import fs from 'node:fs';
import path from 'node:path';
import {CHECKS, parseArgs, readPages, parseDebugCss, classMatches, openPage, eachCombo, show, writeOut, die} from './lib/gate.mjs';

const usage = 'usage: node checks/uniform.mjs <base url> <password> [--user root] [--pages <file>]... [--canonical <json>] [--viewports desktop,phone] [--modes light,dark] [--tolerance 1] [--json <file>] [--out <file>] [--timeout ms] [--settle ms] [--width-test n] [--debug-css <page>=<css>]...';
const opt = parseArgs(process.argv.slice(2), {
  flags: {user: 'root', canonical: path.join(CHECKS, 'uniform.json'), viewports: 'desktop,phone', modes: 'light,dark', tolerance: '1', json: undefined, out: undefined, timeout: '60000', settle: '1500', 'width-test': '12'},
  repeat: ['pages', 'debug-css'],
  usage,
});
opt.timeout = +opt.timeout;
opt.settle = +opt.settle;
const tol = +opt.tolerance;
const pages = readPages(opt.pages.length ? opt.pages : [path.join(CHECKS, 'pages.txt')]);
const debugCss = parseDebugCss(opt['debug-css']);
let canonical;
try {
  canonical = JSON.parse(fs.readFileSync(opt.canonical, 'utf8')).classes;
} catch (e) {
  die(`--canonical ${opt.canonical}: ${e.message}`);
}

/* ── In the page ─────────────────────────────────────────────── */

/* Returns [class, property, value, where] for every sample. Values are px
 * numbers, arrays of px numbers, or strings compared exactly. */
function collect(cfg) {
  const {rgba, visible, where, ownText} = window.__ag;
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal') : document.querySelector('#maincontent');
  if (!scope) return [];
  const out = [];
  const add = (cls, prop, v, el) => out.push([cls, prop, v, where(el)]);
  const all = (sel) => [...scope.querySelectorAll(sel)].filter((el) => (cfg.modal || !el.closest('#modal_overlay')) && visible(el));
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
  const CARD = '.cbi-section, .cbi-section-node';
  const BTN = 'button, input[type="button"], input[type="submit"], input[type="reset"], .btn, .cbi-button';
  const FIELD = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="hidden"], [type="image"]), select:not([multiple]), .cbi-dropdown';

  // Buttons: variant from luci-base's class, size from where it sits (a
  // table cell holds the small one). A button with no words is an icon one.
  for (const el of all(BTN)) {
    if (el.parentElement?.closest(BTN) || el.closest('.cbi-dropdown')) continue;
    const s = getComputedStyle(el);
    const text = (el.matches('input') ? el.value : el.textContent).trim();
    const variant = el.matches('.cbi-button-link') ? 'link'
      : el.matches('.cbi-button-negative, .cbi-button-remove') ? 'danger'
      : el.matches('.cbi-button-positive, .cbi-button-apply, .cbi-button-save, .cbi-button-action, .btn.important') ? 'primary' : 'secondary';
    const size = el.closest('td, .td') ? 'sm' : 'md';
    const cls = text ? `button.${variant}.${size}` : `button.icon.${size}`;
    add(cls, 'height', px(box(el).height), el);
    add(cls, 'radius', radius(el, s), el);
    add(cls, 'fontSize', px(s.fontSize), el);
    add(cls, 'paddingInline', [px(s.paddingLeft), px(s.paddingRight)], el);
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
    if (el.closest('.cbi-value-field') && !el.closest('td, .td')) add(cls, 'formWidth', px(box(el).width), el);
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
    if (!headerOf.has(table)) headerOf.set(table, [...table.querySelectorAll('tr, .tr')].some((r) => r.closest('table, .table') === table && isHeader(r)));
    // A row holding a progress bar is the progress component (name and
    // value over a track), not a table row: its cells are read, its height
    // is not.
    const progress = !!row.querySelector('.cbi-progressbar');
    const base = progress ? 'table.progress' : headerOf.get(table) ? 'table' : 'table.kv';
    const cells = [...row.children].filter((c) => c.matches('th, td, .th, .td') && visible(c));
    if (!cells.length) continue;
    if (isHeader(row)) add(`${base}.header`, 'height', px(box(row).height), row);
    else if (!progress && cells.every((c) => lines(c) <= 1)) {
      const kind = row.querySelector('input:not([type="hidden"]), select, textarea, .cbi-dropdown') ? 'control' : row.querySelector(BTN) ? 'button' : 'text';
      add(`${base}.row.${kind}`, 'height', px(box(row).height), row);
    }
    for (const c of cells) {
      const s = getComputedStyle(c);
      const cls = c.matches('th, .th') ? `${base}.th` : `${base}.td`;
      add(cls, 'paddingBlock', [px(s.paddingTop), px(s.paddingBottom)], c);
      add(cls, 'paddingInlineStart', px(s.paddingInlineStart), c);
      add(cls, 'fontSize', px(s.fontSize), c);
      if (cls.endsWith('.th')) add(cls, 'fontWeight', s.fontWeight, c);
    }
  }

  // Cards: the outermost .cbi-section / .cbi-section-node. One with neither
  // a border nor a fill is a frameless band (the overview's port status),
  // not a card. Dialog sections are the dialog's, not cards.
  if (!cfg.modal) {
    const cards = all(CARD).filter((el) => !el.parentElement.closest(CARD));
    const framed = new Set();
    for (const el of cards) {
      const s = getComputedStyle(el);
      if (border(s) === 'none' && rgba(s.backgroundColor)[3] === 0) continue;
      framed.add(el);
      add('card', 'radius', radius(el, s), el);
      add('card', 'padding', [px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft)], el);
      add('card', 'background', col(s.backgroundColor), el);
      add('card', 'border', border(s), el);
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

  // Headings by role: the page title, a card's title, anything else.
  for (const el of all('h1, h2, h3, .cbi-section > legend')) {
    const s = getComputedStyle(el);
    const inCard = el.closest(CARD);
    const cls = cfg.modal ? 'heading.modal' : !inCard && el.matches('h1, h2') ? 'heading.page' : inCard ? 'heading.card' : 'heading.sub';
    add(cls, 'fontSize', px(s.fontSize), el);
    add(cls, 'fontWeight', s.fontWeight, el);
  }

  // Tabs: the theme's page tabs and luci-base's section tabs are one
  // component. The active one's indicator: a bottom border, else a box
  // shadow, else an ::after bar, on the tab or its link.
  const indicator = (el) => {
    for (const e of [el, el.querySelector(':scope > a')].filter(Boolean)) {
      const s = getComputedStyle(e);
      if (parseFloat(s.borderBottomWidth) && s.borderBottomStyle !== 'none' && rgba(s.borderBottomColor)[3] > 0) return `border ${px(s.borderBottomWidth)}px ${col(s.borderBottomColor)}`;
      if (s.boxShadow !== 'none') return `shadow ${s.boxShadow}`;
      const a = getComputedStyle(e, '::after');
      if (a.content !== 'none' && rgba(a.backgroundColor)[3] > 0) return `after ${px(a.height)}px ${col(a.backgroundColor)}`;
    }
    return 'none';
  };
  for (const el of all('.tabs > li > .tab, .cbi-tabmenu > li')) {
    add('tab', 'height', px(box(el).height), el);
    if (el.matches('[data-active], .cbi-tab')) add('tab', 'indicator', indicator(el), el);
  }

  // Form rows: the label column and the gap to the next row.
  for (const el of all('.cbi-value')) {
    if (el.closest('td, .td')) continue;
    const t = el.querySelector(':scope > .cbi-value-title');
    if (t && visible(t)) add('form.label', 'width', px(box(t).width), t);
    let n = el.nextElementSibling;
    while (n && !visible(n)) n = n.nextElementSibling;
    if (n && n.matches('.cbi-value')) add('form.row', 'gap', px(box(n).top - box(el).bottom), el);
  }

  // Font family of every element with its own words, and of every control.
  const fam = (f) => f.replace(/["']/g, '').split(',').map((x) => x.trim()).join(', ');
  for (const el of scope.querySelectorAll('*')) {
    if (!el.matches('input, select, textarea, button') && !ownText(el)) continue;
    if (el.matches('option, script, style') || (!cfg.modal && el.closest('#modal_overlay')) || !visible(el)) continue;
    add(el.closest('pre, code, kbd, samp, tt') ? 'font.code' : 'font.body', 'fontFamily', fam(getComputedStyle(el).fontFamily), el);
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
  const sel = '.cbi-value-field :is(input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="hidden"], [type="image"]), select:not([multiple]), .cbi-dropdown)';
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
    const samples = await r.page.evaluate(collect, {modal: !!entry.modal});
    samples.push(...await r.page.evaluate(widthTest, {modal: !!entry.modal, limit: +opt['width-test']}));
    await r.page.close();
    results.push({entry, device, mode, combo, samples, note: r.note, pageErrors: r.errors});
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
    if (only && only !== r.device) continue;
    if (!r.samples.some(([c]) => classMatches(cls, c))) missing.push({page: r.entry.id, combo: r.combo, cls});
  }
  for (const [cls, prop, v, where] of r.samples) {
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
for (const m of missing) L.push(`  ${m.combo}  ${m.page}: no ${m.cls}`);
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
L.push('', `RESULT ${failed ? 'FAIL' : 'OK'}  errors ${errors.length}  missing ${missing.length}  outlier samples ${outList.reduce((a, o) => a + o.count, 0)}  samples ${total}`);
const text = `${L.join('\n')}\n`;
process.stdout.write(text);
writeOut(opt.out, text);
writeOut(opt.json, JSON.stringify({
  gate: 'uniform', base: opt.url, combos, tolerance: tol, canonicalFile: opt.canonical,
  pages: pages.map((p) => ({id: p.id, require: p.require})),
  errors, missing, outliers: outList,
  perPageClass: Object.fromEntries(ranked),
  distributions: distJson,
  pageErrors: results.filter((r) => r.pageErrors.length).map((r) => ({page: r.entry.id, combo: r.combo, errors: r.pageErrors})),
  result: failed ? 'FAIL' : 'OK',
}, null, 1));
process.exit(failed ? 1 : 0);
