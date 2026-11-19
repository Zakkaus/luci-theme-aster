#!/usr/bin/env node
/**
 * Contrast gate: WCAG AA on every page of the list, light and dark, plus an
 * upper bound for separators in dark mode.
 *
 *   node checks/contrast.mjs <base url> <password>
 *        [--user root] [--pages <file>]... [--viewports desktop,phone]
 *        [--modes light,dark] [--palette aster] [--text 4.5] [--large 3] [--ui 3] [--focus 3]
 *        [--separator-max 1.5] [--separator-modes dark] [--focus-limit 3]
 *        [--field-border enforce|waive]
 *        [--json <file>] [--out <file>] [--timeout 60000] [--settle 1500]
 *        [--debug-css <page>=<css>]...
 *
 * Measured against the effective background: every background colour from
 * the root down, alpha composited over white, opacity included.
 *
 *   text       every element with its own words, and the value of every
 *              field: --text (4.5), or --large (3) at 24px, or 18.66px bold.
 *              Disabled controls and placeholders are exempt (WCAG 1.4.3).
 *   ui         the boundary of a checkbox or radio drawn by the theme
 *              (appearance: none), and of a split button (.cbi-dropdown.btn):
 *              border or fill against what is around it, --ui (3).
 *   field-border  the same for a text field, textarea, select or dropdown,
 *              --ui (3), reported as its own rule. Waived by default (owner
 *              2026-11-19: keep Astryx field border, #ccd3db, 1.51:1): its
 *              findings are listed under WAIVED and do not fail the run.
 *              --field-border enforce applies it like any other rule.
 *              Buttons with words are identified by their words (1.4.11).
 *   focus      up to --focus-limit buttons, fields, checkboxes, links and
 *              tabs a page, focused from the keyboard: the ring (outline,
 *              else box shadow) against what is around it, --focus (3). No
 *              ring at all fails.
 *   separator  table cell rules, row and section dividers, <hr>: the line
 *              against the surface it sits on must stay at or under
 *              --separator-max in --separator-modes (Argon, 2026-07-25:
 *              dark table rules too bright).
 *
 * Findings outside #maincontent (top bar, side nav) repeat on every page and
 * are reported once, under [shell]. Exit 1 on any failure, a failed login,
 * a page that is missing or does not render, a page with no text samples, or
 * a viewport and mode with no ui, focus or separator sample at all. Nothing
 * is written to the device.
 */
import path from 'node:path';
import {CHECKS, die, parseArgs, readPages, parseDebugCss, openPage, eachCombo, writeOut} from './lib/gate.mjs';

const usage = 'usage: node checks/contrast.mjs <base url> <password> [--user root] [--pages <file>]... [--viewports desktop,phone] [--modes light,dark] [--palette aster] [--text 4.5] [--large 3] [--ui 3] [--focus 3] [--separator-max 1.5] [--separator-modes dark] [--focus-limit 3] [--field-border enforce|waive] [--json <file>] [--out <file>] [--timeout ms] [--settle ms] [--debug-css <page>=<css>]...';
const opt = parseArgs(process.argv.slice(2), {
  flags: {user: 'root', viewports: 'desktop,phone', modes: 'light,dark', palette: 'aster', text: '4.5', large: '3', ui: '3', focus: '3', 'separator-max': '1.5', 'separator-modes': 'dark', 'field-border': 'waive', 'focus-limit': '3', json: undefined, out: undefined, timeout: '60000', settle: '1500'},
  repeat: ['pages', 'debug-css'],
  usage,
});
opt.timeout = +opt.timeout;
opt.settle = +opt.settle;
const min = {text: +opt.text, large: +opt.large, ui: +opt.ui, focus: +opt.focus, 'field-border': +opt.ui};
if (!['enforce', 'waive'].includes(opt['field-border'])) die(`--field-border must be enforce or waive\n${usage}`);
const waived = opt['field-border'] === 'waive' ? ['field-border'] : [];
const sepMax = +opt['separator-max'];
const sepModes = opt['separator-modes'].split(',');
const pages = readPages(opt.pages.length ? opt.pages : [path.join(CHECKS, 'pages.txt')]);
const debugCss = parseDebugCss(opt['debug-css']);

/* ── In the page ─────────────────────────────────────────────── */

/* Returns findings {kind, ratio, fg, bg, where, text, shell}. */
function collect(cfg) {
  const {rgba, over, ratio, hex, behind, visible, where, ownText} = window.__ag;
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal') : document.body;
  const out = [];
  const inScope = (el) => cfg.modal || !el.closest('#modal_overlay');
  const shell = (el) => !cfg.modal && !el.closest('#maincontent');
  const disabled = (el) => !!el.closest(':disabled, [disabled], .disabled, [aria-disabled="true"]');
  const push = (kind, fgc, bgc, el, text, extra = {}) => out.push({kind, ratio: Math.round(ratio(fgc, bgc) * 100) / 100, fg: hex(fgc), bg: hex(bgc), where: where(el), text: text.slice(0, 40), shell: shell(el), ...extra});
  const FIELD = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="hidden"], [type="image"]), select, textarea, .cbi-dropdown:not(.btn)';

  for (const el of scope.querySelectorAll('*')) {
    if (el.matches('option, script, style, noscript, title')) continue;
    // A checkbox's or radio's value ("1", "on") is never drawn.
    if (el.matches('input:is([type="checkbox"], [type="radio"], [type="hidden"], [type="range"], [type="file"], [type="image"])')) continue;
    const field = el.matches('input, select, textarea');
    const words = field ? (el.matches('select') ? el.selectedOptions[0]?.textContent ?? '' : el.value) : ownText(el);
    if (!words.trim() || !inScope(el) || !visible(el) || disabled(el)) continue;
    const s = getComputedStyle(el);
    const {bg, op} = behind(el);
    const c = rgba(s.color);
    const fg = over([c[0], c[1], c[2], c[3] * op], bg);
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
    push(large ? 'large' : 'text', fg, bg, el, words.trim(), {size});
  }

  // Boundaries: the border over the control's own fill, or the fill,
  // against what surrounds the control; the stronger of the two counts. A
  // split button (.cbi-dropdown.btn, Save & Apply) is a ui control: its
  // edge shows where to press and that its chevron is part of it, so its
  // fill or border (a filled accent button passes on its fill) is held to
  // --ui like a checkbox's.
  const SPLIT = '.cbi-dropdown:is(.btn, .cbi-button)';
  for (const el of scope.querySelectorAll(`${FIELD}, input[type="checkbox"], input[type="radio"], ${SPLIT}`)) {
    if (!inScope(el) || !visible(el) || disabled(el) || el.parentElement.closest('.cbi-dropdown')) continue;
    const s = getComputedStyle(el);
    if (el.matches('[type="checkbox"], [type="radio"]') && s.appearance !== 'none') continue;
    const {bg: around, op} = behind(el, false);
    const f = rgba(s.backgroundColor);
    const fill = over([f[0], f[1], f[2], f[3] * op], around);
    const bw = parseFloat(s.borderTopWidth) && s.borderTopStyle !== 'none';
    const b = rgba(s.borderTopColor);
    const edge = bw ? over([b[0], b[1], b[2], b[3] * op], fill) : fill;
    const use = ratio(edge, around) >= ratio(fill, around) ? edge : fill;
    push(el.matches(`[type="checkbox"], [type="radio"], ${SPLIT}`) ? 'ui' : 'field-border', use, around, el, el.getAttribute('name') ?? (el.matches(SPLIT) ? el.textContent.trim() : el.tagName.toLowerCase()));
  }

  // Separators: the line over the element's own surface.
  const SEP = 'td, .td, th, .th, .cbi-value, hr, .cbi-section .cbi-section, .cbi-section .cbi-section-node, .cbi-section-node .cbi-section-node, .cbi-section-table-row';
  for (const el of scope.querySelectorAll(SEP)) {
    if (!inScope(el) || !visible(el)) continue;
    const s = getComputedStyle(el);
    for (const side of ['Top', 'Bottom']) {
      if (!parseFloat(s[`border${side}Width`]) || s[`border${side}Style`] === 'none') continue;
      const b = rgba(s[`border${side}Color`]);
      if (b[3] === 0) continue;
      const {bg, op} = behind(el);
      push('separator', over([b[0], b[1], b[2], b[3] * op], bg), bg, el, `${el.tagName.toLowerCase()} ${side.toLowerCase()}`);
    }
  }
  return out;
}

/* Marks up to `limit` focusable elements of each kind, content first, then
 * the shell; returns how many. */
function markFocusables(cfg) {
  const {visible} = window.__ag;
  const kinds = {
    button: 'button, input[type="button"], input[type="submit"], input[type="reset"], .btn, .cbi-button',
    field: 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="hidden"], [type="image"]), select, textarea',
    checkbox: 'input[type="checkbox"], input[type="radio"]',
    link: 'a[href]',
    tab: '.tabs .tab, .cbi-tabmenu > li > a',
  };
  const roots = cfg.modal ? [document.querySelector('#modal_overlay .modal')] : [document.querySelector('#maincontent'), document.body];
  let n = 0;
  for (const sel of Object.values(kinds)) {
    roots.forEach((root, i) => {
      if (!root) return;
      const els = [...root.querySelectorAll(sel)].filter((el) => (cfg.modal || !el.closest('#modal_overlay')) && (i === 0 || !el.closest('#maincontent'))
        && !el.closest(':disabled, [disabled]') && !el.hasAttribute('data-ag-focus') && visible(el) && el.tabIndex >= 0);
      for (const el of els.slice(0, cfg.limit)) el.setAttribute('data-ag-focus', n++);
    });
  }
  return n;
}

/* Focuses each marked element and reads its ring. Run after a Tab press so
 * the browser is in keyboard modality and :focus-visible applies. */
function readFocus(count) {
  const {rgba, over, ratio, hex, behind, where} = window.__ag;
  const out = [];
  for (let i = 0; i < count; i++) {
    const el = document.querySelector(`[data-ag-focus="${i}"]`);
    if (!el) continue;
    el.focus({focusVisible: true, preventScroll: true});
    if (document.activeElement !== el) continue;
    const s = getComputedStyle(el);
    let ring = null;
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ring = s.outlineColor;
    else if (s.boxShadow !== 'none') ring = (s.boxShadow.match(/(?:rgba?|oklch|oklab|color|lab|lch)\([^)]*\)/g) ?? []).find((c) => rgba(c)[3] > 0) ?? null;
    const {bg: around, op} = behind(el, false);
    const label = (el.textContent || el.getAttribute('name') || el.tagName).trim().slice(0, 40);
    const base = {kind: 'focus', where: where(el), text: label, shell: !el.closest('#maincontent') && !el.closest('#modal_overlay')};
    if (!ring) { out.push({...base, ratio: 0, fg: 'none', bg: hex(around), note: 'no focus ring'}); continue; }
    const c = rgba(ring);
    const fg = over([c[0], c[1], c[2], c[3] * op], around);
    out.push({...base, ratio: Math.round(ratio(fg, around) * 100) / 100, fg: hex(fg), bg: hex(around)});
    el.blur();
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
    const found = await r.page.evaluate(collect, {modal: !!entry.modal});
    const n = await r.page.evaluate(markFocusables, {modal: !!entry.modal, limit: +opt['focus-limit']});
    await r.page.keyboard.press('Tab');
    found.push(...await r.page.evaluate(readFocus, n));
    await r.page.close();
    results.push({entry, device, mode, combo, found});
    process.stderr.write(`${combo} ${entry.id}: ${found.length} samples\n`);
  }
}, (combo, page, error) => errors.push({page, combo, error}));

const failsRule = (f, mode) => {
  if (f.kind === 'separator') return sepModes.includes(mode) && f.ratio > sepMax;
  return f.ratio < min[f.kind];
};
const rule = (f) => (f.kind === 'separator' ? `<= ${sepMax}` : `>= ${min[f.kind]}`);

// Group failures by page (or [shell]), viewport-mode, kind and colour pair.
const groups = new Map();
const minRatio = {};
const counts = {};
for (const r of results) {
  const kinds = {};
  for (const f of r.found) {
    kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
    const mk = `${r.combo} ${f.kind}`;
    if (f.kind === 'separator') minRatio[mk] = Math.max(minRatio[mk] ?? 0, f.ratio);
    else minRatio[mk] = Math.min(minRatio[mk] ?? Infinity, f.ratio);
    if (!failsRule(f, r.mode)) continue;
    const page = f.shell ? '[shell]' : r.entry.id;
    const k = `${page}|${r.combo}|${f.kind}|${f.fg}|${f.bg}|${f.ratio}`;
    if (!groups.has(k)) groups.set(k, {page, combo: r.combo, kind: f.kind, ratio: f.ratio, fg: f.fg, bg: f.bg, rule: rule(f), count: 0, pages: new Set(), examples: []});
    const g = groups.get(k);
    g.count++;
    g.pages.add(r.entry.id);
    if (g.examples.length < 3 && !g.examples.some((e) => e.where === f.where)) g.examples.push({where: f.where, text: f.text, note: f.note});
  }
  counts[`${r.combo} ${r.entry.id}`] = kinds;
  if (!kinds.text && !kinds.large) errors.push({page: r.entry.id, combo: r.combo, error: 'no text samples'});
}
const combos = opt.devices.flatMap((d) => opt.modes.map((m) => `${d}-${m}`));
for (const combo of combos) {
  const mine = results.filter((r) => r.combo === combo);
  if (!mine.length) continue;
  for (const kind of ['field-border', 'focus', 'separator']) {
    if (!mine.some((r) => r.found.some((f) => f.kind === kind))) errors.push({page: '(all pages)', combo, error: `no ${kind} samples`});
  }
}

/* ── Report ──────────────────────────────────────────────────── */

const allFails = [...groups.values()];
const fails = allFails.filter((g) => !waived.includes(g.kind));
const waivedFails = allFails.filter((g) => waived.includes(g.kind));
const L = [];
L.push(`contrast  ${opt.url}  ${pages.length} pages  ${combos.join(' ')}  text ${min.text}  large ${min.large}  ui ${min.ui}  focus ${min.focus}  field-border ${min['field-border']} (${opt['field-border']})  separator <= ${sepMax} in ${sepModes.join(',')}`);
L.push('', `ERRORS (${errors.length})`);
for (const e of errors) L.push(`  ${e.combo}  ${e.page}: ${e.error}`);
L.push('', `FAILURES (${fails.reduce((a, g) => a + g.count, 0)} samples in ${fails.length} groups), page by page`);
for (const page of ['[shell]', ...pages.map((p) => p.id)]) {
  const mine = fails.filter((g) => g.page === page);
  if (!mine.length) continue;
  L.push(page === '[shell]' ? '[shell] (top bar, side nav: counted once per page it appears on)' : page);
  mine.sort((a, b) => a.kind.localeCompare(b.kind) || a.ratio - b.ratio);
  for (const g of mine) {
    const e = g.examples[0];
    L.push(`  ${g.combo.padEnd(13)} ${g.kind.padEnd(12)} ${g.ratio.toFixed(2)} (want ${g.rule})  ${g.fg} on ${g.bg}  x${g.count}${g.page === '[shell]' ? ` on ${g.pages.size} pages` : ''}  ${e.where}${e.text ? ` "${e.text}"` : ''}${e.note ? ` (${e.note})` : ''}`);
  }
}
if (waivedFails.length) {
  const n = waivedFails.reduce((a, g) => a + g.count, 0);
  const worst = Math.min(...waivedFails.map((g) => g.ratio));
  L.push('', `WAIVED (${waived.join(', ')}: ${n} samples in ${waivedFails.length} groups, lowest ${worst.toFixed(2)}; not counted in RESULT)`);
  for (const g of waivedFails.sort((a, b) => a.ratio - b.ratio).slice(0, 20)) L.push(`  ${g.combo.padEnd(13)} ${g.page}  ${g.ratio.toFixed(2)} (want ${g.rule})  ${g.fg} on ${g.bg}  x${g.count}  ${g.examples[0].where}`);
}
const byPageKind = new Map();
for (const g of fails) {
  const k = `${g.page}  ${g.kind}`;
  byPageKind.set(k, (byPageKind.get(k) ?? 0) + g.count);
}
const ranked = [...byPageKind].sort((a, b) => b[1] - a[1]);
L.push('', `FAILED SAMPLES PER PAGE AND KIND (top 10 of ${ranked.length})`);
for (const [k, n] of ranked.slice(0, 10)) L.push(`  ${String(n).padStart(5)}  ${k}`);
L.push('', 'LOWEST RATIO PER VIEWPORT-MODE AND KIND (separator: highest)');
for (const [k, v] of Object.entries(minRatio).sort()) L.push(`  ${k.padEnd(24)} ${v.toFixed(2)}`);
const failed = errors.length || fails.length;
const total = results.reduce((a, r) => a + r.found.length, 0);
L.push('', `RESULT ${failed ? 'FAIL' : 'OK'}  palette ${opt.palette}  errors ${errors.length}  failed samples ${fails.reduce((a, g) => a + g.count, 0)}  samples ${total}`);
const text = `${L.join('\n')}\n`;
process.stdout.write(text);
writeOut(opt.out, text);
writeOut(opt.json, JSON.stringify({
  gate: 'contrast', base: opt.url, palette: opt.palette, combos, thresholds: {...min, separatorMax: sepMax, separatorModes: sepModes},
  pages: pages.map((p) => p.id),
  fieldBorder: opt['field-border'],
  errors, failures: fails.map((g) => ({...g, pages: [...g.pages]})),
  waived: waivedFails.map((g) => ({...g, pages: [...g.pages]})),
  perPageKind: Object.fromEntries(ranked), extremes: minRatio, counts,
  result: failed ? 'FAIL' : 'OK',
}, null, 1));
process.exit(failed ? 1 : 0);
