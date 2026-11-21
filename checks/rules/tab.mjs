/**
 * Gate rules of the M4 "tab" stream (COMPONENTS.md sections 0, 0.1 and 4):
 * Table (C6), FoldedBlock (C7), RowActions (C10), EmptyState (C20), and
 * G4 / G9 inside data tables.
 *
 * uniform.mjs merges `canonical` into its own and adds `collect`'s samples
 * to each page's; a page list entry requires a rule with require=<rule id>,
 * so a rule with no sample on a page that should draw it fails. Every value
 * is symbolic or px, so one canonical holds for every palette and mode.
 */

export const canonical = {
  'c6.table': {
    _source: 'COMPONENTS.md C6 (owner Q1 = A): the actions cell pads 8 (a row with sm buttons 49); its last button ends 16 from the card border; LuCI .right columns end-aligned',
    actionsPad: [8, 8], actionsEnd: 16, rowActions: 49, numAlign: 'end', run: 'ok',
  },
  'c7.when': {_source: 'COMPONENTS.md C7: a table is folded iff its min-content is wider than its room (unfolds with 16 to spare); every data table is measured', state: 'ok'},
  'c7.sig': {
    _source: 'COMPONENTS.md C7: one folded signature: subgrid, gap 16 / 8, blocks 12 / 12, flush at the ends, label 15/500 secondary, value 15/400 primary, title 15/500 primary, Divider 1 on the content box',
    grid: 'subgrid', columnGap: 16, rowGap: 8, blockPad: [12, 12], firstPad: 0, lastPad: 0,
    label: '15/500 secondary', value: '15/400 primary', title: '15/500 primary', divider: '1 border', divStart: 0, divEnd: 0,
  },
  'c7.x': {_source: 'COMPONENTS.md C7: per folded table one label x (= title x) and one value x (counts are strings: a count read as px would pass 2 within the 1px tolerance)', labelXs: 'one', valueXs: 'one', labelToTitle: 0},
  'c7.title': {_source: 'COMPONENTS.md C7: the title is the column that names the row: the first that is not the row\'s interface, network, device or (start) priority, nor one LuCI hides on phones (hide-xs); the same table folds by the same column on every page', column: 'names the row'},
  'c7.labelw': {_source: 'COMPONENTS.md C7: the label column is the longest label, at most half the content width', fit: 0},
  'c7.actions': {_source: 'COMPONENTS.md C7/C10: a folded row\'s actions are on its title line, one line, ending on the content edge, centred on the title line', lines: 'one', end: 0, centre: 0},
  'c10.actions': {_source: 'COMPONENTS.md C10 (doona ActionGroup, Astryx MoreMenu): buttons 8 apart, at most one More menu per row', gap: 8, menus: 'ok'},
  'c20.empty': {_source: 'COMPONENTS.md C20: compact EmptyState in a table: 16 above and below, centred', padding: [16, 16], align: 'center'},
  'g.marker.table': {_source: 'COMPONENTS.md G4 / 0.1: a data table\'s first column (wide) and a folded title start with their text: no marker before it', offset: 0},
  'g.mq': {_source: 'COMPONENTS.md G9: no @media or @container block lays out a table, row or cell', blocks: 'none'},
};

/* In the page (after gate.mjs installHelpers), two frames after the other
 * collectors (they open tooltips in markup), so theme-aster.js has refitted
 * the tables they grew. */
export async function collect(cfg) {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const {visible, where, ownText} = window.__ag;
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal') : document.querySelector('#maincontent');
  if (!scope) return [];
  const out = [];
  const at = (el) => { const t = ownText(el).slice(0, 24); return t ? `${where(el)} "${t}"` : where(el); };
  const add = (cls, prop, v, el) => out.push([cls, prop, v, typeof el === 'string' ? el : at(el)]);
  const cs = (e, p) => getComputedStyle(e, p);
  const px = (v) => Math.round(parseFloat(v) * 2) / 2 || 0;
  const box = (e) => e.getBoundingClientRect();
  const shown = (e) => e && e.getClientRects().length && cs(e).visibility !== 'hidden' && (!visible || visible(e));
  const probe = document.createElement('span');
  document.body.append(probe);
  const ink = (v) => { probe.style.color = `var(${v})`; return cs(probe).color; };
  const INK = {secondary: ink('--color-text-secondary'), primary: ink('--color-text-primary')};
  const inkName = (c) => Object.keys(INK).find((k) => INK[k] === c) || c;
  const font = (s) => `${px(s.fontSize)}/${s.fontWeight} ${inkName(s.color)}`;
  // A text's first glyph box (skipping tooltips and hidden boxes); a zone
  // Badge's text starts at its pill (C13: the zone is the title).
  const firstText = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode;
      if (!n.data.trim() || n.parentNode.closest('.cbi-tooltip') || !shown(n.parentNode)) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const rs = [...r.getClientRects()].filter((x) => x.width > 0.5);
      const pill = n.parentNode.closest('.zonebadge');
      if (rs.length) return pill && root.contains(pill) ? box(pill) : rs[0];
    }
    return null;
  };
  const BTN = ':is(.btn, .cbi-button, button, .drag-handle)';
  const TABLES = ':is(#view, form > .cbi-map) :is(.table, table):is(:has(> .tr > .th, > :is(.thead, thead, tbody) > .tr > .th), .cbi-section-table):not(:has(.diag-action))';
  const rowsOf = (t) => [...t.querySelectorAll('.tr, tr')].filter((r) => r.closest('.table, table') === t && !r.matches('.placeholder, .cbi-section-table-descr') && r.querySelector(':scope > :is(.td, td)') && shown(r));
  const cellsOf = (r) => [...r.children].filter((c) => c.matches('.td, td') && shown(c));
  // The card a table sits in: its border box, content edges (border + 16).
  const cardOf = (t) => {
    for (let e = t.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = cs(e);
      if (parseFloat(s.borderLeftWidth) > 0 && parseFloat(s.borderRadius) > 0) return e;
    }
    return null;
  };

  // G9: no @media / @container block lays out a table, a row or a cell.
  let mq = 0, mqAt = 'none';
  const TBL = /(^|[\s>+~(,])(\.table|\.tr|\.td|\.th|\.cbi-section-table|table|tr|td|th)(?![-\w])/;
  const walk = (rules, inCond) => {
    for (const r of rules) {
      const cond = r instanceof CSSMediaRule || (window.CSSContainerRule && r instanceof CSSContainerRule);
      if (r.selectorText && (inCond || cond) && TBL.test(r.selectorText)) { mq++; mqAt = `${r.parentRule?.conditionText || ''} ${r.selectorText}`.slice(0, 80); }
      if (r.cssRules) walk(r.cssRules, inCond || cond);
    }
  };
  // The theme's stylesheets, and a <style> outside the view (the theme's
  // own, a gate's --debug-css); a view's own <style> is LuCI's.
  for (const sh of document.styleSheets) {
    if (!/\/luci-static\/aster\/(components|luci)\.css/.test(sh.href || '') && !(sh.ownerNode?.matches?.('style') && !sh.ownerNode.closest('#maincontent'))) continue;
    try { walk(sh.cssRules, false); } catch {}
  }
  add('g.mq', 'blocks', mq ? `${mq} blocks` : 'none', mqAt);

  for (const t of scope.querySelectorAll(TABLES)) {
    if (!shown(t) || t.closest('.cbi-tooltip')) continue;
    const fold = t.dataset.fold;
    // C7 when: re-measure as theme-aster.js does.
    {
      const p = t.parentNode, ps = cs(p), ts = cs(t);
      let state = 'ok';
      if (fold !== 'fold' && fold !== 'wide') state = 'unmeasured';
      else if (p.clientWidth) {
        const w = t.style.width;
        t.dataset.fold = 'wide';
        t.style.width = 'min-content';
        // With its words whole (G5), whatever the theme's stylesheet says:
        // CJK breaks only where words do, a rule's name not at a hyphen.
        const cells = [...t.querySelectorAll('.td, .th, td, th')].filter((c) => c.closest('.table, table') === t);
        // A list (", ": a station's addresses and rates) breaks after its
        // commas, whatever nowrap the theme puts on it (C7, f).
        const lists = cells.flatMap((c) => [c, ...c.querySelectorAll('*')]).filter((e) => !e.closest('.cbi-section-actions') && [...e.childNodes].some((n) => n.nodeType === 3 && n.data.includes(', ')));
        const set = (on) => cells.forEach((c) => {
          on ? c.style.setProperty('word-break', 'keep-all', 'important') : c.style.removeProperty('word-break');
          c.matches('.cbi-section-table .td:is(.cbi-section-table-titles, [data-name="name"])') && (on ? c.style.setProperty('white-space', 'nowrap', 'important') : c.style.removeProperty('white-space'));
        });
        set(true);
        lists.forEach((e) => e.style.setProperty('white-space', 'normal', 'important'));
        const need = t.scrollWidth, room = p.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight) - parseFloat(ts.marginLeft) - parseFloat(ts.marginRight);
        set(false);
        lists.forEach((e) => e.style.removeProperty('white-space'));
        t.style.width = w;
        t.dataset.fold = fold;
        if (fold === 'fold' && need <= room - 16.5) state = `folded, fits (${Math.round(need)} in ${Math.round(room)})`;
        if (fold === 'wide' && need > room + 0.5) state = `wide, words do not fit (${Math.round(need)} in ${Math.round(room)})`;
        // Wide, the table as drawn (its content box, as theme-aster.js
        // measures it): wider than its room.
        const drawn = t.scrollWidth;
        if (fold === 'wide' && drawn > room + 0.5) state = `wide, overflows (${Math.round(drawn)} in ${Math.round(room)})`;
      }
      add('c7.when', 'state', state, t);
    }
    const rows = rowsOf(t);
    const card = cardOf(t);

    // C20: the table's message row.
    for (const c of t.querySelectorAll('.tr.placeholder > .td')) {
      if (!shown(c) || c.closest('.table, table') !== t) continue;
      const s = cs(c);
      add('c20.empty', 'padding', [px(s.paddingTop), px(s.paddingBottom)], c);
      add('c20.empty', 'align', s.textAlign, c);
    }

    // C10: every row's action group.
    for (const r of rows) {
      const g = r.querySelector(':scope > :is(.td, td).cbi-section-actions > div');
      if (!g) continue;
      const bs = [...g.querySelectorAll(`:scope > ${BTN}`)].filter(shown);
      // Gaps on a line (a second line is table.actions' lines).
      bs.sort((x, y) => box(x).top - box(y).top || box(x).left - box(y).left);
      for (let i = 1; i < bs.length; i++) if (Math.abs(box(bs[i]).top - box(bs[i - 1]).top) < 1) add('c10.actions', 'gap', px(box(bs[i]).left - box(bs[i - 1]).right), bs[i]);
      const menus = g.querySelectorAll(':scope > .aster-more').length;
      if (bs.length) add('c10.actions', 'menus', menus <= 1 ? 'ok' : `${menus} menus`, g);
    }

    // Zone => Forwards (C13 Badges in a cell): one run, wrapping only
    // where it does not fit, never a column of boxes.
    for (const z of t.querySelectorAll('.zone-forwards')) {
      const it = [...z.querySelectorAll('.zonebadge, :scope > span')].filter(shown);
      if (it.length < 2 || !shown(z)) continue;
      const w = it.reduce((a, e) => a + box(e).width, 0) + 8 * (it.length - 1);
      const lines = 1 + it.filter((e, i) => i && box(e).top >= box(it[i - 1]).bottom - 1).length;
      add('c6.table', 'run', lines > 1 && w <= z.clientWidth + 1 ? `${lines} lines` : 'ok', z);
    }

    if (fold === 'wide') {
      for (const r of rows) {
        const cells = cellsOf(r);
        if (!cells.length) continue;
        // G4: the first column starts with its text.
        const c0 = cells[0], f = firstText(c0);
        if (f && !c0.querySelector('input, select, .cbi-dropdown, .cbi-checkbox')) {
          const s = cs(c0), b = box(c0);
          const x0 = b.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
          const lead = s.textAlign === 'center' || s.textAlign === 'end' || s.textAlign === 'right' ? 0 : f.left - x0;
          add('g.marker.table', 'offset', px(Math.max(0, lead)), c0);
        }
        for (const c of cells) {
          if (c.matches('.right') && !c.matches('.cbi-section-actions')) add('c6.table', 'numAlign', cs(c).textAlign === 'right' ? 'end' : cs(c).textAlign, c);
          if (!c.matches('.cbi-section-actions')) continue;
          const bs = [...c.querySelectorAll(BTN)].filter(shown);
          if (!bs.length) continue;
          const s = cs(c);
          add('c6.table', 'actionsPad', [px(s.paddingTop), px(s.paddingBottom)], c);
          if (card && new Set(bs.map((b) => Math.round(box(b).top))).size === 1) add('c6.table', 'actionsEnd', px(box(card).right - parseFloat(cs(card).borderRightWidth) - Math.max(...bs.map((b) => box(b).right))), c);
          if (!r.querySelector('input:not([type="hidden"], [type="button"], [type="submit"]), select, textarea, .cbi-dropdown:not(.btn)') && cells.every((x) => x.getClientRects().length === 1 && box(x).height <= 50)) {
            add('c6.table', 'rowActions', px(box(r).height), r);
          }
        }
      }
      continue;
    }
    if (fold !== 'fold') continue;

    // C7: the folded signature, per table.
    const ts = cs(t);
    add('c7.sig', 'columnGap', px(ts.columnGap), t);
    const blocks = rows;
    if (!blocks.length) continue;
    const titleOf = (r) => cellsOf(r).find((c) => cs(c).gridRowStart === '1' && !c.matches('.cbi-section-actions') && !(cs(c).gridColumnStart === '-2'));
    const actsOf = (r) => cellsOf(r).find((c) => c.matches('.cbi-section-actions') || cs(c).gridColumnStart === '-2');
    const labelled = (r) => cellsOf(r).filter((c) => c !== titleOf(r) && c !== actsOf(r) && !/^(none|normal)$/.test(cs(c, '::before').content));
    // C7 title: read from the header as COMPONENTS.md words it.
    const ths = [...(t.querySelector('.tr:has(> .th)')?.children || [])];
    const skip = ['Interface', 'Network', 'Device', 'Priority', 'Start priority'].map((x) => (typeof _ === 'function' ? _(x) : x));
    const head = Math.max(0, ths.findIndex((c) => !c.matches('.hide-xs') && !skip.includes(c.textContent.trim())));
    const contentL = box(t).left + parseFloat(ts.paddingLeft), contentR = box(t).right - parseFloat(ts.paddingRight);
    const lxs = new Set(), vxs = new Set();
    let titleX = null, labelW = 0, longest = 0;
    const meas = document.createElement('span');
    meas.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    document.body.append(meas);
    blocks.forEach((r, i) => {
      const s = cs(r);
      add('c7.sig', 'grid', /^subgrid/.test(s.gridTemplateColumns) ? 'subgrid' : s.display === 'grid' ? 'grid' : s.display, r);
      add('c7.sig', 'rowGap', px(s.rowGap), r);
      if (i === 0) add('c7.sig', 'firstPad', px(s.paddingTop), r);
      if (i === blocks.length - 1) add('c7.sig', 'lastPad', px(s.paddingBottom), r);
      if (i > 0 && i < blocks.length - 1) add('c7.sig', 'blockPad', [px(s.paddingTop), px(s.paddingBottom)], r);
      if (i > 0) {
        const bw = parseFloat(s.borderTopWidth);
        add('c7.sig', 'divider', bw ? `${px(bw)} ${s.borderTopColor === ink('--color-border') ? 'border' : s.borderTopColor}` : 'none', r);
        add('c7.sig', 'divStart', px(box(r).left - contentL), r);
        add('c7.sig', 'divEnd', px(contentR - box(r).right), r);
      }
      const tc = titleOf(r);
      add('c7.title', 'column', tc && tc === r.children[head] ? 'names the row' : `column ${[...r.children].indexOf(tc) + 1}, not ${head + 1}`, tc || r);
      const tf = tc && firstText(tc);
      if (tc && tf) {
        add('c7.sig', 'title', font(cs(tc)), tc);
        titleX ??= tf.left;
        add('g.marker.table', 'offset', px(Math.max(0, tf.left - contentL)), tc);
      }
      for (const c of labelled(r)) {
        const b = box(c), k = cs(c, '::before');
        lxs.add(Math.round(b.left));
        add('c7.sig', 'label', font(k), c);
        meas.style.font = k.font;
        meas.textContent = c.dataset.title || '';
        longest = Math.max(longest, meas.getBoundingClientRect().width);
        const v = [...c.children].find((e) => shown(e)) || c;
        const vf = firstText(v);
        if (vf) {
          vxs.add(Math.round(vf.left));
          if (v !== c && !v.querySelector('input, select, .cbi-dropdown, .ifacebadge')) add('c7.sig', 'value', font(cs(v.matches('.aster-v') || !v.matches('*') ? v : vf ? v : c)), v);
        }
      }
      // C7 actions: one line, at the content end, centred on the title line.
      const a = actsOf(r);
      const bs = a ? [...a.querySelectorAll(BTN)].filter(shown) : [];
      if (bs.length && tc) {
        const tops = new Set(bs.map((b) => Math.round(box(b).top)));
        add('c7.actions', 'lines', tops.size === 1 ? 'one' : `${tops.size} lines`, a);
        if (tops.size === 1) add('c7.actions', 'end', px(contentR - Math.max(...bs.map((b) => box(b).right))), a);
        // The title line: the identifier's first line (a subline follows).
        const mid = (box(bs[0]).top + box(bs[0]).bottom) / 2, tb = box(tc);
        add('c7.actions', 'centre', px(Math.abs(mid - (tf ? (tf.top + tf.bottom) / 2 : (tb.top + tb.bottom) / 2))), a);
      }
    });
    meas.remove();
    if (lxs.size) {
      const n = (k) => (k === 1 ? 'one' : `${k} x`);
      add('c7.x', 'labelXs', n(lxs.size), t);
      if (vxs.size) add('c7.x', 'valueXs', n(vxs.size), t);
      if (titleX != null) add('c7.x', 'labelToTitle', px(Math.min(...lxs) - Math.round(titleX)), t);
      const track = parseFloat(ts.gridTemplateColumns.split(' ')[0]);
      labelW = Math.min(longest, (contentR - contentL) / 2);
      add('c7.labelw', 'fit', Math.abs(track - labelW) <= 1 || (longest > track && track >= (contentR - contentL) / 2 - 1) ? 0 : px(track - labelW), t);
    }
  }
  probe.remove();
  return out;
}
