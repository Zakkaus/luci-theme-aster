/**
 * Gate rules of the M4 "lst" stream (COMPONENTS.md sections 0, 0.1 and 4):
 * MetadataLists and status grids (C8), Badge (C13), Token (C14), StatusDot
 * (C15), Icon (C16), and G4 / G5 / G10 outside data tables.
 *
 * uniform.mjs merges `canonical` into its own and adds `collect`'s samples
 * to each page's; a page list entry requires a rule with require=<rule id>
 * (e.g. require=c8.ifstatus), so a rule with no sample on a page that
 * should draw it fails. Every value is symbolic or px, so one canonical
 * holds for every palette and mode.
 */

export const canonical = {
  'c8.kv': {
    _source: 'COMPONENTS.md C8: Astryx MetadataList columns=single, label start (grid auto minmax(0,1fr), gap 8 16); label 15/500 secondary, value 15/400 primary, baseline; no underline on a label or value that is not a link',
    layout: 'rows', columnGap: 16, rowGap: 8, labelSize: 15, labelWeight: '500', labelInk: 'secondary', valueSize: 15, valueInk: 'primary', align: 'baseline', underline: 'none',
  },
  'c8.x': {_source: 'COMPONENTS.md C8: one value x per list (Interfaces: per table, the label column at least --aster-label-w); label column = longest label, capped at 50% (nlbw\'s shrink-wrapped summary: uncapped)', valueXs: 1, tableXs: 1, labelFit: 0},
  'c8.bar': {_source: 'COMPONENTS.md C19 in C8: label | value text at the value column\'s start, the bar under it as wide as the value column; one value x per list; label 500 secondary', layout: 'value column', valueXs: 1, labelWeight: '500', labelInk: 'secondary'},
  'c8.tracks': {_source: 'COMPONENTS.md C8: no value column narrower than its longest token (unless truncated with a title)', narrow: 0},
  'c8.ifstatus': {
    _source: 'COMPONENTS.md C8 Interfaces status cell: one single-column list (2 tracks); values wrap at spaces only (keep-all holds CJK words: "(432089 封包)" stays whole); dot neutral iff the own device image is _disabled or missing',
    tracks: 2, valueWrap: 'normal/keep-all', dot: 'ok',
  },
  'g.break': {_source: 'COMPONENTS.md G5: an identifier or value token never breaks across lines (or is truncated with a title)', broken: 0},
  'g.colon': {_source: 'COMPONENTS.md G10: labels carry no trailing colon', trailing: 'none'},
  'g.marker': {_source: 'COMPONENTS.md G4 / 0.1: a box title (name) starts at its list labels\' x; markers trail the text', offset: 0},
  'c13.badge': {_source: 'COMPONENTS.md C13: filled pills only for zones, action-needed status, Tokens, buttons; .ifacebadge is text (no fill, no border); an interface\'s zone Badge is never cut (ellipsis inside it)', stray: 0, ifacebadge: 'plain', clipped: 0},
  'c14.token': {_source: 'COMPONENTS.md C14: Astryx Token md, dynamic lists only', height: 28, radius: 8, stray: 0},
  'c15.dot': {_source: 'COMPONENTS.md C15: StatusDot 8 px; up = success, down = neutral, on every page', size: '8x8', ink: 'ok'},
  'c16.icon': {_source: 'COMPONENTS.md C16: no LuCI image from /resources/icons/ visible; icon glyphs 16 or 20; an interface\'s port icons all shown (they wrap)', legacy: 0, size: 'ok', clipped: 0},
};

/* In the page (after gate.mjs installHelpers). */
export function collect(cfg) {
  const {visible, where, ownText} = window.__ag;
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal') : document.querySelector('#maincontent');
  if (!scope) return [];
  const out = [];
  const at = (el) => { const t = ownText(el).slice(0, 24); return t ? `${where(el)} "${t}"` : where(el); };
  const add = (cls, prop, v, el) => out.push([cls, prop, v, typeof el === 'string' ? el : at(el)]);
  // A count's offenders, named in its sample's place.
  const seen = {};
  const note = (k, s, el) => (seen[k] ??= []).length < 3 && seen[k].push(`${s} @ ${at(el)}`);
  const named = (k, el) => (seen[k]?.length ? seen[k].join('; ') : at(el));
  const cs = (e, p) => getComputedStyle(e, p);
  const px = (v) => Math.round(parseFloat(v) * 2) / 2 || 0;
  const probe = document.createElement('span');
  document.body.append(probe);
  const ink = (v) => { probe.style.color = `var(${v})`; return cs(probe).color; };
  const INK = {secondary: ink('--color-text-secondary'), primary: ink('--color-text-primary'), error: ink('--color-text-error'), success: ink('--color-icon-success'), neutral: ink('--color-icon-secondary')};
  const fills = {muted: (() => { probe.style.background = 'var(--color-background-muted)'; return cs(probe).backgroundColor; })()};
  probe.remove();
  const inkName = (c) => Object.keys(INK).find((k) => INK[k] === c) || c;
  const clear = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
  const shown = (e) => e && e.getClientRects().length && cs(e).visibility !== 'hidden' && (!visible || visible(e));
  const inTable = (e) => e.closest('td, .td, th, .th');

  // Text rects of a node list (first line, all lines).
  const range = (nodes) => {
    const r = document.createRange();
    r.setStartBefore(nodes[0]);
    r.setEndAfter(nodes[nodes.length - 1]);
    const rs = [...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5);
    return rs;
  };
  const textNodes = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const a = [];
    while (w.nextNode()) if (w.currentNode.data.trim() && !w.currentNode.parentNode.closest('.cbi-tooltip')) a.push(w.currentNode);
    return a;
  };
  // G5: tokens split at ordinary white space only; a no-break space joins.
  const brokenTokens = (root) => {
    let n = 0;
    const host = root.nodeType === 1 ? root : root.parentNode;
    const trunc = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const s = cs(x); if (s.textOverflow === 'ellipsis' && s.overflow !== 'visible' && (x.title || x.closest('[title]'))) return true; } return false; };
    for (const t of root.nodeType === 3 ? [root] : textNodes(root)) {
      if (trunc(t.parentNode)) continue;
      const re = /[^ \t\n\r]+/g;
      let m;
      while ((m = re.exec(t.data))) {
        // A run of 4+ ideographs is prose (CJK breaks between them), not an identifier.
        if (/\p{Script=Han}{4}/u.test(m[0])) continue;
        const r = document.createRange();
        r.setStart(t, m.index);
        r.setEnd(t, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0.5).map((x) => Math.round(x.top)));
        if (tops.size > 1) { n++; note('break', m[0], host); }
      }
    }
    return n;
  };

  /* C8 lists: {el, kind, pairs: [[label element, [value nodes]]]}. */
  const lists = [];
  const fromNowrap = (el, kind, rows) => {
    const pairs = rows.map((nw) => {
      const k = nw.querySelector(':scope > strong:first-child');
      const v = k ? [...nw.childNodes].filter((n) => n !== k && (n.nodeType === 1 || n.data.trim())) : [];
      return k && v.length ? [k, v] : null;
    }).filter(Boolean);
    if (pairs.length) lists.push({el, kind, pairs});
  };
  scope.querySelectorAll('[id$="-ifc-description"]').forEach((el) => shown(el) && fromNowrap(el, 'ifstatus', [...el.querySelectorAll(':scope > .nowrap')]));
  scope.querySelectorAll('.network-status-table > .ifacebox > .ifacebox-body').forEach((el) => shown(el) && fromNowrap(el, 'upstream', [...el.querySelectorAll('.nowrap')].filter((n) => !n.closest('.cbi-tooltip'))));
  scope.querySelectorAll('.table:not(:has(.th, th)), table:not(:has(th, .th))').forEach((t) => {
    // A row whose value is a C19 bar (Memory, Storage) is the Progress component's.
    if (!shown(t) || t.closest('.cbi-tooltip, .cbi-section-table, .ifacebox') || t.querySelector('.cbi-progressbar')) return;
    const rows = [...t.querySelectorAll(':scope > .tr, :scope > tbody > tr, :scope > .tbody > .tr, :scope > tr')].filter(shown);
    const pairs = rows.map((r) => {
      const c = [...r.children].filter((x) => x.matches('td, .td'));
      if (c.length !== 2) return null;
      const v = textNodes(c[1]);
      return v.length && textNodes(c[0]).length ? [c[0], [c[1]]] : null;
    }).filter(Boolean);
    if (pairs.length && pairs.length === rows.length) lists.push({el: t, kind: 'table', pairs});
    // A realtime legend: label | value pairs, several to a row.
    else if (rows.length && rows.every((r) => r.children.length > 2 && r.children.length % 2 === 0)) {
      const lp = rows.flatMap((r) => [...r.children].flatMap((c, i, a) => (i % 2 ? [] : [[c, [a[i + 1]]]])));
      lists.push({el: t, kind: 'legend', pairs: lp});
    }
  });
  scope.querySelectorAll('.nft-chain-hook > ul, .kpi > ul, .aster-kv').forEach((el) => {
    if (!shown(el)) return;
    const pairs = [...el.querySelectorAll(':scope > li, :scope > .aster-row')].filter((li) => li.getClientRects().length || cs(li).display === 'contents').map((li) => {
      const k = li.querySelector(':scope > .aster-k');
      const v = li.querySelector(':scope > .aster-v, :scope > big');
      if (k && v) return [k, [v]];
      return [li, []]; // not split: an inline "Label: value" sentence
    });
    if (pairs.length) lists.push({el, kind: el.matches('.kpi > ul') ? 'nlbw' : el.matches('.nft-chain-hook > ul') ? 'nft' : 'kv', pairs});
  });

  const ifs = [];
  for (const {el, kind, pairs} of lists) {
    // Text rects (a grid item's own box is its whole line box).
    const texts = (nodes) => nodes.flatMap((n) => (n.nodeType === 3 ? [n] : textNodes(n)));
    const lr = pairs.map(([k]) => range(texts([k])));
    const vr = pairs.map(([, v]) => (texts(v).length ? range(texts(v)) : []));
    if (vr.some((r) => !r.length)) { add('c8.kv', 'layout', 'inline', el); continue; }
    const lx = lr.map((r) => r[0].left), vx = vr.map((r) => r[0].left);
    const rows = pairs.every((p, i) => Math.abs(lr[i][0].bottom - vr[i][0].bottom) <= 1 && vx[i] > Math.max(...lr[i].map((r) => r.right)));
    add('c8.kv', 'layout', rows ? 'rows' : 'stacked', el);
    add('c8.kv', 'align', rows ? 'baseline' : 'off', el);
    // The label's own text box (a legend's <strong>, not its cell).
    const k0 = textNodes(pairs[0][0])[0]?.parentNode || pairs[0][0], v0 = pairs[0][1][0].nodeType === 1 ? pairs[0][1][0] : pairs[0][1][0].parentNode;
    // An underline (text decoration or a bottom border, LuCI's legend
    // series colour) on a label's or value's text that is not a link;
    // a cell's own row line is the table's.
    const lined = (n, cell) => {
      for (let x = n.nodeType === 3 ? n.parentNode : n; x && x !== document.body; x = x.parentElement) {
        if (x.closest('a')) return false;
        if (x === cell && x.matches('td, .td')) return false;
        const t = cs(x);
        if (/underline/.test(t.textDecorationLine) || (t.borderBottomStyle !== 'none' && parseFloat(t.borderBottomWidth) > 0)) { note('line', x.textContent.trim().slice(0, 16), x); return true; }
        if (x === cell) return false;
      }
      return false;
    };
    const ul = pairs.filter(([k, v]) => [k, ...v].some((c) => texts([c]).some((t) => lined(t, c)))).length;
    add('c8.kv', 'underline', ul ? 'underlined' : 'none', named('line', el));
    delete seen.line;
    add('c8.kv', 'labelSize', px(cs(k0).fontSize), k0);
    add('c8.kv', 'labelWeight', cs(k0).fontWeight, k0);
    add('c8.kv', 'labelInk', inkName(cs(k0).color), k0);
    if (!el.querySelector('.aster-error')) {
      const vInk = inkName(cs(v0).color);
      add('c8.kv', 'valueSize', px(cs(v0).fontSize), v0);
      add('c8.kv', 'valueInk', vInk, v0);
    }
    const s = cs(el);
    if (kind === 'table') {
      const r0 = pairs[0][1][0], k = pairs[0][0];
      add('c8.kv', 'columnGap', px(cs(r0).paddingInlineStart) + px(cs(k).paddingInlineEnd), r0);
      if (pairs.length > 1) add('c8.kv', 'rowGap', px(cs(k).paddingBlockEnd) + px(cs(pairs[1][0]).paddingBlockStart), k);
    } else if (kind === 'legend') {
      // Cells pad the gaps (table rows, or LuCI's phone grid of pairs).
      const tr = cs(pairs[0][0].parentNode), g = (v) => (/grid/.test(tr.display) ? px(v) : 0);
      const [k, [v]] = pairs[0], k2 = pairs[1]?.[0];
      add('c8.kv', 'columnGap', px(cs(k).paddingInlineEnd) + px(cs(v).paddingInlineStart) + g(tr.columnGap), el);
      if (k2) add('c8.kv', 'rowGap', px(cs(k).paddingBlockEnd) + px(cs(k2).paddingBlockStart) + g(tr.rowGap), el);
    } else if (/grid/.test(s.display)) {
      add('c8.kv', 'columnGap', px(s.columnGap), el);
      if (pairs.length > 1) add('c8.kv', 'rowGap', px(s.rowGap), el);
    } else add('c8.kv', 'columnGap', `display ${s.display}`, el);
    if (kind === 'legend') {
      // One list per series (a LuCI row): its values on one x.
      const rowXs = new Map();
      pairs.forEach(([k], i) => rowXs.set(k.parentNode, [...(rowXs.get(k.parentNode) || []), Math.round(vx[i])]));
      rowXs.forEach((xs, r) => add('c8.x', 'valueXs', new Set(xs).size, r));
      pairs.forEach(([k]) => add('g.colon', 'trailing', /[:：]\s*$/.test(k.textContent) ? 'colon' : 'none', k));
      let broken = 0;
      pairs.forEach(([, v]) => v.forEach((n) => { broken += brokenTokens(n); }));
      add('g.break', 'broken', broken, named('break', el));
      delete seen.break;
      continue;
    }
    const xs = new Set(vx.map((x) => Math.round(x)));
    add('c8.x', 'valueXs', xs.size, el);
    const box = el.getBoundingClientRect();
    const left = Math.min(...lx);
    const widest = Math.max(...lr.map((r) => Math.max(...r.map((x) => x.right)) - r[0].left));
    const gap = kind === 'table' ? px(cs(pairs[0][1][0]).paddingInlineStart) : px(s.columnGap);
    const col = Math.min(...vx) - gap - left;
    // Interfaces' lists share their table's column (checked below); nlbw's
    // summary is as wide as its words, so half of it is no cap.
    if (kind === 'ifstatus') ifs.push({el, t: el.closest('table, .table'), col, widest, half: (box.right - left) / 2, x: Math.round(Math.min(...vx))});
    else {
      const want = kind === 'nlbw' ? widest : Math.min(widest, (box.right - left) / 2);
      add('c8.x', 'labelFit', Math.abs(col - want) <= 1 ? 0 : px(col - want), el);
    }
    // c8.tracks: each value's longest token against the value column.
    const room = box.right - Math.min(...vx);
    let narrow = 0;
    pairs.forEach(([, v]) => v.forEach((n) => textNodes(n.nodeType === 3 ? n.parentNode : n).forEach((t) => {
      for (const m of t.data.matchAll(/[^ \t\n\r]+/g)) {
        const r = document.createRange();
        r.setStart(t, m.index);
        r.setEnd(t, m.index + m[0].length);
        const w = [...r.getClientRects()].reduce((a, x) => a + x.width, 0);
        const p = t.parentNode;
        if (w > room + 1 && !(cs(p).textOverflow === 'ellipsis' && p.title)) narrow++;
      }
    })));
    add('c8.tracks', 'narrow', narrow, el);
    // G5 on every value; G10 on every label.
    let broken = 0;
    pairs.forEach(([, v]) => v.forEach((n) => { broken += brokenTokens(n); }));
    add('g.break', 'broken', broken, named('break', el));
    delete seen.break;
    pairs.forEach(([k]) => add('g.colon', 'trailing', /[:：]\s*$/.test(k.textContent) ? 'colon' : 'none', k));
    if (kind === 'ifstatus') {
      add('c8.ifstatus', 'tracks', s.gridTemplateColumns.split(' ').filter(Boolean).length, el);
      const v = pairs[0][1][0].nodeType === 1 ? pairs[0][1][0] : pairs[0][1][0].parentNode;
      add('c8.ifstatus', 'valueWrap', `${cs(v).overflowWrap}/${cs(v).wordBreak}`, v);
    }
    // G4: a box's title text starts at its labels' x (overview upstreams).
    const head = el.closest('.ifacebox')?.querySelector(':scope > .ifacebox-head');
    if (kind === 'upstream' && head && textNodes(head).length) add('g.marker', 'offset', px(range(textNodes(head))[0].left - left), head);
  }
  // Interfaces: one label column down a table, the longest label of any
  // of its lists and at least --aster-label-w (Astryx dt 112).
  if (ifs.length) {
    const p = document.createElement('div');
    p.style.inlineSize = 'var(--aster-label-w)';
    document.body.append(p);
    const min = p.getBoundingClientRect().width;
    p.remove();
    for (const t of new Set(ifs.map((i) => i.t))) {
      const g = ifs.filter((i) => i.t === t), widest = Math.max(min, ...g.map((i) => i.widest));
      add('c8.x', 'tableXs', new Set(g.map((i) => i.x)).size, t);
      g.forEach((i) => { const want = Math.min(widest, i.half); add('c8.x', 'labelFit', Math.abs(i.col - want) <= 1 ? 0 : px(i.col - want), i.el); });
    }
  }
  /* C19 in C8 (overview Memory, Storage, Active Connections): the bar's
     value text starts its list's value column, the bar as wide as the
     column, both after the name. */
  scope.querySelectorAll('.table, table').forEach((t) => {
    const bars = [...t.querySelectorAll(':scope > .tr > .td > .cbi-progressbar, :scope > tbody > tr > td > .cbi-progressbar')].filter((b) => shown(b) && !b.closest('.cbi-tooltip'));
    if (!bars.length) return;
    let off = 0;
    for (const b of bars) {
      const cell = b.parentNode, k = cell.previousElementSibling, br = b.getBoundingClientRect();
      const why = !/^(start|left)$/.test(cs(b, '::before').textAlign) ? 'value text not at the column start'
        : Math.abs(br.width - cell.getBoundingClientRect().width) > 1 ? 'bar not the value column'
        : k && k.getBoundingClientRect().right > br.left + 0.5 ? 'bar under the name' : '';
      if (why) { off++; note('bar', why, b); }
    }
    const k0 = bars[0].parentNode.previousElementSibling;
    add('c8.bar', 'layout', off ? 'off' : 'value column', named('bar', t));
    delete seen.bar;
    add('c8.bar', 'valueXs', new Set(bars.map((b) => Math.round(b.getBoundingClientRect().left))).size, t);
    if (k0) {
      add('c8.bar', 'labelWeight', cs(k0).fontWeight, k0);
      add('c8.bar', 'labelInk', inkName(cs(k0).color), k0);
    }
  });
  // An unsplit label/value sentence ("主機數: 17") is a list of no rows.
  for (const {el, pairs} of lists) if (pairs.some(([, v]) => !v.length)) add('g.colon', 'trailing', /[:：]/.test(el.textContent) ? 'colon' : 'none', el);

  /* G4: an interface's, port's or radio's name starts on its head's
     content edge and its device name on its body's (dot, Badge and icons
     trail them). */
  if (document.querySelector('[data-page="admin-status-overview"], [data-page="admin-network-network"]')) {
    const edge = (e) => e.getBoundingClientRect().left + parseFloat(cs(e).paddingLeft) + parseFloat(cs(e).borderLeftWidth);
    scope.querySelectorAll('.ifacebox > .ifacebox-head:first-child, .td > .ifacebox > .ifacebox-body > small').forEach((h) => {
      if (!shown(h) || h.closest('.cbi-tooltip') || !textNodes(h).length) return;
      add('g.marker', 'offset', px(range(textNodes(h))[0].left - edge(h.matches('small') ? h.parentNode : h)), h);
    });
  }

  /* C13 / C16 Interfaces: a head (name, dot, zone Badge) and a device
     line (name, icons) show all they hold: nothing cut at the box. */
  if (document.querySelector('[data-page="admin-network-network"]')) {
    scope.querySelectorAll('.td > .ifacebox').forEach((b) => {
      if (!shown(b)) return;
      // The head's Badge is its ::after (its overflow is the head's); the
      // device line's icons are elements (its hidden tooltips are not).
      const h = b.querySelector(':scope > .ifacebox-head'), d = b.querySelector(':scope > .ifacebox-body');
      if (h && shown(h)) add('c13.badge', 'clipped', Math.max(0, px(h.scrollWidth - h.clientWidth)), h);
      const ends = d ? [...d.querySelectorAll(':scope > *, :scope > span > *')].filter((x) => !x.matches('.cbi-tooltip, br') && x.getClientRects().length).map((x) => x.getBoundingClientRect().right) : [];
      if (ends.length) add('c16.icon', 'clipped', Math.max(0, px(Math.max(...ends) - b.getBoundingClientRect().right)), d);
    });
  }

  /* C8 Interfaces: the dot is the interface's own device. */
  if (document.body.dataset.page === 'admin-network-network' || document.querySelector('[data-page="admin-network-network"]')) {
    scope.querySelectorAll('.td > .ifacebox').forEach((b) => {
      const head = b.querySelector(':scope > .ifacebox-head');
      if (!head || !shown(head)) return;
      const img = b.querySelector(':scope > .ifacebox-body > .cbi-tooltip-container:first-child > img');
      const up = !!img && !/_disabled\.svg$/.test(img.getAttribute('src'));
      const c = cs(head, '::before').backgroundColor;
      add('c8.ifstatus', 'dot', c === (up ? INK.success : INK.neutral) ? 'ok' : `${up ? 'up' : 'down'} drawn ${inkName(c)}`, head);
    });
  }

  /* C15: StatusDots (8 round fills, elements or ::before/::after) whose
     box carries LuCI's state image: up = success, down = neutral. */
  const all = [...scope.querySelectorAll('*')].filter((e) => !e.closest('.cbi-tooltip, #modal_overlay') || cfg.modal);
  const stateOf = (e) => {
    const b = e.closest('.ifacebox');
    if (!b || b.querySelector('img[src*="/signal-"]')) return null;
    const img = b.closest('.td') && document.querySelector('[data-page="admin-network-network"]')
      ? b.querySelector(':scope > .ifacebox-body > .cbi-tooltip-container:first-child > img')
      : b.querySelector('img[src*="/port_"], img[src*="/ethernet"], img[src*="/wifi"]');
    return img ? !/(_disabled|_down)\.svg$/.test(img.getAttribute('src')) : false;
  };
  for (const e of all) {
    if (!e.getClientRects().length) continue;
    for (const p of [null, '::before', '::after']) {
      const s = cs(e, p);
      if (p && (s.content === 'none' || s.display === 'none')) continue;
      const w = px(s.width), h = px(s.height);
      if (!(w >= 4 && w <= 12 && Math.abs(w - h) <= 0.5) || clear(s.backgroundColor) || parseFloat(s.borderTopLeftRadius) < w / 2 - 0.5) continue;
      const up = stateOf(e);
      if (up === null) continue;
      add('c15.dot', 'size', `${w}x${h}`, e);
      add('c15.dot', 'ink', s.backgroundColor === (up ? INK.success : INK.neutral) ? 'ok' : `${up ? 'up' : 'down'} drawn ${inkName(s.backgroundColor)}`, e);
    }
  }

  /* C13 / C14: filled pills and Tokens. */
  let stray = 0, tokens = 0;
  for (const e of all) {
    // Inline code (C24's face in a sentence) is not a Badge.
    if (e.closest('button, .btn, .cbi-button, input, select, textarea, .cbi-dropdown, [role="button"], .cbi-tooltip, .shell-nav, code, kbd, samp')) continue;
    const s = cs(e);
    if (clear(s.backgroundColor) || !shown(e)) continue;
    const r = e.getBoundingClientRect();
    const rad = parseFloat(s.borderTopLeftRadius) || 0;
    if (r.height >= 12 && r.height <= 24 && r.width > r.height && rad >= r.height / 2 - 0.5 && !e.matches('.zonebadge, .label:is(.warning, .error, .important), .cbi-dynlist > .item, .cbi-progressbar, .cbi-progressbar *')) { stray++; note('pill', `${px(r.height)} ${e.className}`.trim(), e); }
    if (s.backgroundColor === fills.muted && Math.abs(r.height - 28) <= 1 && Math.abs(rad - 8) <= 0.5 && !e.closest('.cbi-dynlist, .cbi-dropdown')) { tokens++; note('token', e.className || e.tagName, e); }
  }
  add('c13.badge', 'stray', stray, named('pill', scope));
  add('c14.token', 'stray', tokens, named('token', scope));
  scope.querySelectorAll('.ifacebadge:not(.large)').forEach((e) => {
    if (!shown(e) || e.closest('.cbi-tooltip')) return;
    const s = cs(e);
    add('c13.badge', 'ifacebadge', clear(s.backgroundColor) && !parseFloat(s.borderTopWidth) ? 'plain' : `fill ${s.backgroundColor} border ${s.borderTopWidth}`, e);
  });
  scope.querySelectorAll('.cbi-dynlist > .item').forEach((e) => {
    if (!shown(e)) return;
    add('c14.token', 'height', px(e.getBoundingClientRect().height), e);
    add('c14.token', 'radius', px(cs(e).borderTopLeftRadius), e);
  });

  /* C16: no legacy image shown; glyphs drawn by mask are 16 or 20. */
  let legacy = 0;
  for (const e of all) {
    const s = cs(e);
    if ((e.matches('img[src*="/resources/icons/"]') && shown(e) && e.getBoundingClientRect().width > 0) || /\/resources\/icons\//.test(s.backgroundImage)) { legacy++; note('legacy', e.getAttribute('src') || s.backgroundImage.slice(0, 60), e); }
    for (const p of ['::before', '::after']) {
      const q = cs(e, p);
      if (q.content === 'none' || q.display === 'none' || q.maskImage === 'none' || !q.maskImage) continue;
      // A Token's remove glyph is the Token's own (C14: xsm 12 in its strip).
      if (p === '::after' && e.matches('.cbi-dynlist > .item')) continue;
      // The glyph is the mask's size when the mask is sized, else the box's.
      const ms = q.maskSize.split(' ').map(parseFloat);
      const w = /px/.test(q.maskSize) ? px(ms[0]) : px(q.width), h = /px/.test(q.maskSize) ? px(ms[1] ?? ms[0]) : px(q.height);
      if (!e.getClientRects().length || w === 0) continue;
      add('c16.icon', 'size', [16, 20].includes(w) && w === h ? 'ok' : `${w}x${h}`, e);
    }
  }
  add('c16.icon', 'legacy', legacy, named('legacy', scope));
  return out;
}
