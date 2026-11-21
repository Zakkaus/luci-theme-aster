/**
 * Page-frame conformance rules (COMPONENTS.md section 4): page header,
 * cards, section headings, tabs, form rows, buttons, banners, dialogs,
 * progress bars, dividers, and the global rules G1 (token lengths), G3 (one
 * left edge), G6 (nothing wider than its container), G7 (controls clear of
 * lines) and G8 (no card in a card).
 *
 * uniform.mjs merges `canonical` into its own and adds `collect`'s samples
 * to each page's. A rule yields one sample [rule, 'conform', 'ok'] for a
 * page on which everything it measured conforms, and one sample per
 * offender, whose value names the property, what it got and what it wants;
 * canonical wants 'ok'. A page-list entry requires a rule with
 * require=<rule id> (checks/pages.txt), so a rule that measures nothing on
 * a page that draws its component fails as missing.
 *
 * Table rows, their cells and markers belong to the table rules
 * (rules/tab.mjs): g.inset reads every line but a table's row lines, and
 * g.textx every text start but a table's first column.
 */

const RULES = {
  'g.px': 'G1: paddings, gaps and radii of the components are tokens',
  'g.overflow': 'G6: no page scrolls sideways; nothing crosses its card',
  'g.inset': 'G7: controls keep 8 from every line and 16 from a card border',
  'g.nested': 'G8: no box or fill inside a card but controls, Badges, Banners, code',
  'g.textx': 'G3: headings, descriptions, form labels and button rows start on the card content edge',
  'c2.card': 'C2: radius 16, border 1, card fill, padding 16',
  'c3.heading': 'C3: page 26/600, card 18/600, inner 16/600; heading box -> content 16; actions end on the content end',
  'c4.tabs': 'C4: tabs 36 (second level 32), 2 apart, one line, 2 accent bar, list -> pane 16',
  'c5.form': 'C5: label 200 + 16 (stacked 4), row padding 8, fields 36, help 4',
  'c9.button': 'C9: md 36 in toolbars/forms/save bar/dialogs, sm 32 in tables/cards/heading rows; one primary; red only in a dialog',
  'c17.banner': 'C17: padding 12, radius 12, icon gap 8',
  'c18.dialog': 'C18: padding 16, title/footer gaps 16, button gap 8, width 400/560/800 or window - 32, fits',
  'c19.progress': 'C19: bar 8 high, 4 under its text',
  'c22.divider': 'C22: 1 thick, spans the card content box',
};
export const canonical = Object.fromEntries(Object.entries(RULES).map(([id, src]) => [id, {_source: `COMPONENTS.md ${src}`, conform: 'ok'}]));
// uniform.mjs's tab rule: a second tab level is Astryx TabList sm (C4).
canonical['tab.sm'] = {_source: 'COMPONENTS.md C4: a tab list under another (nlbwmon, realtime graphs, DHCP) is TabList size=sm, 32 high', height: 32};

export function collect(cfg) {
  const {rgba, visible, where} = window.__ag;
  const scope = cfg.modal ? document.querySelector('#modal_overlay .modal, #modal_overlay > .alert-message') : document.querySelector('#maincontent');
  const n = {};
  const bad = [];
  if (!scope) return [];
  const r2 = (v) => Math.round(v * 100) / 100;
  const count = (id) => { n[id] = (n[id] ?? 0) + 1; };
  const fail = (id, prop, got, want, el) => bad.push([id, prop, typeof got === 'number' ? `${r2(got)}px` : String(got), typeof want === 'number' ? `${r2(want)}px` : String(want), el ? where(el) : '']);
  const check = (id, prop, got, want, el, tol = 0.5) => {
    count(id);
    const ok = Array.isArray(want) ? want.some((w) => Math.abs(got - w) <= tol) : typeof want === 'number' ? Math.abs(got - want) <= tol : got === want;
    if (!ok) fail(id, prop, got, Array.isArray(want) ? want.join('|') : want, el);
    return ok;
  };
  const box = (el) => el.getBoundingClientRect();
  const css = (el, pseudo) => getComputedStyle(el, pseudo);
  const f = (v) => parseFloat(v) || 0;
  const seen = (c) => rgba(c)[3] > 0.04;
  const inScope = (el) => scope.contains(el) && (cfg.modal || !el.closest('#modal_overlay')) && !el.closest('.cbi-tooltip, #aster-more-menu, .cbi-dropdown > ul');
  const all = (sel) => [...scope.querySelectorAll(sel)].filter((el) => inScope(el) && visible(el));
  const side = (s, d) => f(s[`border${d}Width`]) > 0 && s[`border${d}Style`] !== 'none' && seen(s[`border${d}Color`]);
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const radius = (el, s) => { const v = f(s.borderTopLeftRadius); const r = box(el); return v > 0 && v >= Math.min(r.width, r.height) / 2 - 0.5 ? 9999 : v; };
  // A token value the page can read: what a property computes to.
  const tok = (() => {
    const p = document.createElement('div');
    p.style.cssText = 'position:absolute;visibility:hidden;border-style:solid';
    document.body.append(p);
    const t = (prop, v) => { p.style[prop] = v; const out = css(p)[prop]; p.style[prop] = ''; return out; };
    t.remove = () => p.remove();
    return t;
  })();
  const cardBg = tok('backgroundColor', 'var(--color-background-card)');
  const borderCol = tok('borderTopColor', 'var(--color-border)');
  const accent = tok('backgroundColor', 'var(--color-accent)');

  const BTN = 'button, input[type="button"], input[type="submit"], input[type="reset"], .btn, .cbi-button';
  const FIELD = 'input:not([type="hidden"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="image"], [type="range"]), select, .cbi-dropdown:not(.btn, .cbi-button)';
  const TOKEN = '.cbi-dynlist > .item';
  const CTRL = `${BTN}, ${FIELD}, ${TOKEN}`;
  const CODE = 'textarea, pre, #syslog, #dmesg';
  const TABLE = 'table, .table, tr, .tr, td, .td, th, .th, thead, tbody, .thead';
  const CARD_SEL = '.cbi-section, .cbi-section-node, #content_syslog, #view > div:not(.cbi-map) > div > [data-tab], .nft-chain, .nft-table';
  const FRAME = `${CARD_SEL}, #view > :is(table, .table), #view > .cbi-map > :is(table, .table)`;
  const isCtrl = (el) => el.matches(CTRL) || !!el.closest(`${BTN}, .cbi-dropdown, ${TOKEN}`);
  // A fixed or sticky box (the save bar) sits over the page, not in it.
  const pinned = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) if (/fixed|sticky/.test(css(a).position)) return a; return null; };
  const boxed = (el) => { const s = css(el); return SIDES.every((d) => side(s, d)); };
  // Cards: the outermost frame that draws a border; in a dialog, the dialog.
  const cards = cfg.modal ? [scope] : all(FRAME).filter((el) => boxed(el) && ![...all(FRAME)].some((o) => o !== el && o.contains(el) && boxed(o)));
  const cardOf = (el) => cards.find((c) => c.contains(el)) ?? null;
  const content = (el) => {
    const s = css(el), b = box(el);
    const l = b.left + el.clientLeft + f(s.paddingLeft), t = b.top + el.clientTop + f(s.paddingTop);
    return {l, t, r: l + el.clientWidth - f(s.paddingLeft) - f(s.paddingRight), b: t + el.clientHeight - f(s.paddingTop) - f(s.paddingBottom), il: b.left + el.clientLeft, ir: b.left + el.clientLeft + el.clientWidth};
  };
  // Where the first words of an element start.
  const textX = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {acceptNode: (t) => (t.data.trim() && visible(t.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)});
    const t = w.nextNode();
    if (!t) return null;
    const r = document.createRange();
    r.setStart(t, t.data.length - t.data.trimStart().length);
    r.setEnd(t, t.data.length);
    const rect = [...r.getClientRects()].find((q) => q.width > 0);
    return rect ? rect.left : null;
  };

  /* G6: the page never scrolls sideways; nothing crosses its card. Code
     blocks, charts and anything inside a scroll region scroll by design. */
  check('g.overflow', 'page', document.documentElement.scrollWidth - innerWidth, 0, document.documentElement, 0.5);
  for (const c of cards) {
    const k = content(c);
    let worst = 0, at = null;
    for (const el of c.querySelectorAll('*')) {
      if (!inScope(el) || !visible(el) || el.closest(`${CODE}, svg, canvas, .cbi-tooltip`) || pinned(el)) continue;
      let clipped = false;
      for (let a = el.parentElement; a && a !== c; a = a.parentElement) if (css(a).overflowX !== 'visible') { clipped = true; break; }
      if (clipped) continue;
      const b = box(el);
      if (!b.width) continue;
      const over = Math.max(b.right - k.ir, k.il - b.left);
      if (over > worst) { worst = over; at = el; }
    }
    check('g.overflow', 'card', worst, 0, at ?? c, 0.5);
  }

  /* G1: paddings (with the border they sit inside), gaps and radii of the
     theme's components are tokens. */
  const PADS = [0, 2, 4, 8, 12, 16, 24, 32];
  const RADII = [0, 8, 12, 16, 9999];
  const COMP = `${BTN}, ${FIELD}, ${TOKEN}, .cbi-section, .cbi-value, .cbi-tabmenu > li, .alert-message, .modal, .cbi-page-actions, .cbi-progressbar, .cbi-section-create, .cbi-title, .cbi-dynlist, .button-row, textarea`;
  for (const el of all(COMP)) {
    if (el.closest('.cbi-dropdown') && !el.matches('.cbi-dropdown')) continue;
    const s = css(el);
    // A box's inset counts its border (a card: 15 + 1); a control's padding
    // is inside its outline (Astryx Field: 8). A one-line field's height
    // sets its block padding; a select keeps its chevron's room at the end.
    const ctrl = el.matches(`${CTRL}, textarea`);
    const framed = el.matches('.cbi-section, .modal') && boxed(el);
    const line = el.matches(FIELD);
    SIDES.forEach((d, i) => {
      if (line && (i % 2 === 0 || (i === 1 && el.matches('select, .cbi-dropdown')))) return;
      if (i % 2 === 1 && el.matches('.cbi-section .cbi-tblsection')) return; // a table section's bleed (rules/tab.mjs)
      check('g.px', `padding-${d.toLowerCase()}`, f(s[`padding${d}`]) + (framed ? f(s[`border${d}Width`]) : 0), PADS, el);
    });
    if (/flex|grid/.test(s.display)) for (const g of ['rowGap', 'columnGap']) if (s[g] !== 'normal') check('g.px', g === 'rowGap' ? 'row-gap' : 'column-gap', f(s[g]), PADS, el);
    check('g.px', 'radius', radius(el, s), RADII, el);
  }

  /* G7: a control keeps 8 from every line that is not its own outline and 16
     from its card's border. Lines: a border side or an hr; a table's row
     lines are the table's (c6.table). */
  const lines = [];
  for (const el of scope.querySelectorAll('*')) {
    if (!inScope(el) || !visible(el) || isCtrl(el) || el.closest(TABLE) || el.closest(CODE) || el.matches('input, select, textarea, label:has(> input)') || el.closest('.cbi-checkbox')) continue;
    const s = css(el), b = box(el);
    const card = cards.includes(el);
    if (el.matches('hr')) { lines.push({h: true, y0: b.top, y1: b.bottom, x0: b.left, x1: b.right, el, min: 8}); continue; }
    for (const d of SIDES) {
      if (!side(s, d)) continue;
      // A card border is measured from the card's outer edge (card border + 16).
      const w = card ? 0 : f(s[`border${d}Width`]);
      if (d === 'Top') lines.push({h: true, y0: b.top, y1: b.top + w, x0: b.left, x1: b.right, el, min: card ? 16 : 8});
      if (d === 'Bottom') lines.push({h: true, y0: b.bottom - w, y1: b.bottom, x0: b.left, x1: b.right, el, min: card ? 16 : 8});
      if (d === 'Left') lines.push({h: false, x0: b.left, x1: b.left + w, y0: b.top, y1: b.bottom, el, min: card ? 16 : 8});
      if (d === 'Right') lines.push({h: false, x0: b.right - w, x1: b.right, y0: b.top, y1: b.bottom, el, min: card ? 16 : 8});
    }
  }
  for (const el of all(`${BTN}, ${FIELD}, ${TOKEN}`)) {
    if (el.parentElement.closest(`${BTN}, .cbi-dropdown`) || el.closest(CODE) || el.closest(TABLE)) continue;
    const b = box(el), pin = pinned(el);
    // A control in a scroll region (a dialog's body) passes under lines outside it.
    let sc = el.parentElement;
    while (sc && sc !== document.body && !/auto|scroll/.test(css(sc).overflowY)) sc = sc.parentElement;
    if (!b.width || !b.height) continue;
    let worst = null;
    for (const L of lines) {
      if (L.el.contains(el) && !cards.includes(L.el) && L.el.closest(BTN)) continue;
      if (('pin' in L ? L.pin : (L.pin = pinned(L.el))) !== pin) continue;
      if (sc && sc !== document.body && !sc.contains(L.el) && !L.el.contains(sc)) continue;
      let d;
      if (L.h) {
        if (L.x1 <= b.left + 0.5 || L.x0 >= b.right - 0.5) continue;
        d = L.y1 <= b.top + 0.5 ? b.top - L.y1 : L.y0 >= b.bottom - 0.5 ? L.y0 - b.bottom : -1;
      } else {
        if (L.y1 <= b.top + 0.5 || L.y0 >= b.bottom - 0.5) continue;
        d = L.x1 <= b.left + 0.5 ? b.left - L.x1 : L.x0 >= b.right - 0.5 ? L.x0 - b.right : -1;
      }
      const short = d - L.min;
      if (short < -0.5 && (!worst || short < worst.short)) worst = {short, d, L};
    }
    count('g.inset');
    if (worst) {
      fail('g.inset', worst.L.min === 16 ? 'card' : 'line', worst.d, worst.L.min, el);
      bad[bad.length - 1][4] += ` | line: ${where(worst.L.el)}`;
    }
  }

  /* G8: inside a card nothing draws a box (four borders) or a fill but the
     controls, Badges, Tokens, Banners, code blocks, bars and charts. */
  const OK = `${CTRL}, input, .cbi-dropdown *, .zonebadge, .label, .alert-message, .alert-message *, ${CODE}, code, kbd, .cbi-progressbar, .cbi-progressbar *, svg, svg *, canvas, .cbi-tooltip, .cbi-tooltip *, .cbi-checkbox, .cbi-checkbox *, label:has(> input), .ifacebadge, .ifacebadge *, img, .aster-glyph, [class*="spinning"]`;
  for (const c of cards) {
    if (cfg.modal) break;
    for (const el of c.querySelectorAll('*')) {
      if (!inScope(el) || !visible(el) || el.matches(OK)) continue;
      const s = css(el);
      if (/^(contents|inline)$/.test(s.display)) continue;
      count('g.nested');
      if (SIDES.every((d) => side(s, d))) { fail('g.nested', 'border', 'box', 'none', el); continue; }
      if (seen(s.backgroundColor) && s.backgroundColor !== cardBg && f(s.borderTopLeftRadius) > 0) fail('g.nested', 'fill', s.backgroundColor, 'none', el);
    }
  }

  /* C2: one card signature: radius 16, a 1 border in the border colour, the
     card fill, 16 from the outer edge to the content on every side. A table
     that bleeds to the border, or a wide table that is the card, owns that
     16 in its cells. */
  for (const c of cards) {
    if (cfg.modal) break;
    const s = css(c);
    check('c2.card', 'radius', f(s.borderTopLeftRadius), 16, c);
    for (const d of SIDES) check('c2.card', `border-${d.toLowerCase()}`, `${f(s[`border${d}Width`])} ${s[`border${d}Style`]} ${s[`border${d}Color`]}`, `1 solid ${borderCol}`, c);
    check('c2.card', 'background', s.backgroundColor, cardBg, c);
    const bleed = c.matches(':is(table, .table)[data-fold="wide"]') || c.querySelector(':scope > :is(table, .table), :scope > .cbi-section-node > :is(table, .table)');
    for (const d of ['Top', 'Bottom', ...(bleed ? [] : ['Left', 'Right'])]) check('c2.card', `padding-${d.toLowerCase()}`, f(s[`padding${d}`]) + f(s[`border${d}Width`]), 16, c);
  }

  /* C3: headings by role; a heading's box to what follows 16; a heading
     row's actions end on the content end. */
  const H1 = f(tok('fontSize', 'var(--text-heading-1-size)')), H3 = f(tok('fontSize', 'var(--text-heading-3-size)')), H4 = f(tok('fontSize', 'var(--text-heading-4-size)'));
  const HEAD = cfg.modal ? [] : all(':is(#view, .cbi-map) > h2, .aster-title');
  for (const h of HEAD) {
    if (h.closest(CARD_SEL)) continue;
    const s = css(h);
    check('c3.heading', 'page size', f(s.fontSize), H1, h);
    check('c3.heading', 'page weight', s.fontWeight, '600', h);
  }
  for (const c of cards) {
    if (cfg.modal) break;
    const hs = [...c.querySelectorAll(':is(h3, h4)')].filter((h) => inScope(h) && visible(h) && !h.closest('.alert-message, .cbi-tooltip, .ifacebox, .modal'));
    for (const h of hs) {
      const s = css(h);
      // The card's title: its first heading, unless that names a flat section
      // inside it (24.10's leases card has no title but its first heading).
      const top = h === hs[0] && h.matches('h3') && h.parentElement.closest(CARD_SEL) === c;
      const want = top ? H3 : H4;
      check('c3.heading', top ? 'card size' : 'inner size', f(s.fontSize), want, h);
      check('c3.heading', 'weight', s.fontWeight, '600', h);
      const row = h.parentElement.matches('.cbi-title') ? h.parentElement : h;
      let next = row.nextElementSibling;
      while (next && (!visible(next) || css(next).position === 'absolute')) next = next.nextElementSibling;
      // From the heading's own box: 25.12's title row grows with its margin.
      if (next) check('c3.heading', 'next gap', box(next).top - box(h).bottom, 16, h);
      if (row !== h) {
        const acts = [...row.querySelectorAll(BTN)].filter(visible);
        if (acts.length) check('c3.heading', 'actions end', content(cardOf(row) ?? row).r - Math.max(...acts.map((a) => box(a).right)), 0, row);
      }
    }
  }

  /* C4: tabs 36 high (a second level 32), 2 apart, one line; the selected one has a 2 accent
     bar; the list is 16 over its pane. */
  for (const ul of all('ul.cbi-tabmenu, #tabmenu ul.tabs')) {
    const li = [...ul.children].filter(visible);
    if (!li.length) continue;
    // No fade at the ends: it cut the labels at 390 (audit #7).
    check('c4.tabs', 'mask', css(ul).maskImage, 'none', ul);
    const top = box(li[0]).top;
    // A second tab level (under the menu's tabs, or inside a tab pane) is sm.
    const sm = ul.matches('.cbi-tabmenu') && (!!ul.closest('[data-tab]') || !!document.querySelector('#view > #tabmenu, #view > .cbi-map > #tabmenu'));
    li.forEach((t, i) => {
      check('c4.tabs', 'height', box(t).height, sm ? 32 : 36, t);
      check('c4.tabs', 'line', box(t).top, top, t);
      if (i) check('c4.tabs', 'gap', box(t).left - box(li[i - 1]).right, 2, t);
    });
    const sel = li.find((t) => t.matches('.cbi-tab, .active'));
    if (sel) {
      const lab = sel.querySelector(':scope > a, :scope > .tab') ?? sel;
      const a = css(lab, '::before');
      const bar = a.content !== 'none' && f(a.height) ? `${f(a.height)} ${a.backgroundColor}` : 'none';
      check('c4.tabs', 'indicator', bar, `2 ${accent}`, sel);
    }
    let pane = ul.nextElementSibling;
    while (pane && (!visible(pane) || pane.matches('ul.cbi-tabmenu'))) pane = pane.nextElementSibling;
    if (pane) {
      const p = pane.matches('[data-tab]') ? pane : [...pane.querySelectorAll(':scope > [data-tab]')].find(visible) ?? pane;
      check('c4.tabs', 'pane gap', box(p).top - box(ul).bottom, 16, ul);
    }
  }

  /* C5: label column 200, 16 to the field (4 above it when stacked), row
     padding 8, fields 36, help 4 under the field. */
  for (const row of all('.cbi-value')) {
    const lab = row.querySelector(':scope > .cbi-value-title'), fld = row.querySelector(':scope > .cbi-value-field');
    if (!lab || !fld || !visible(lab) || !visible(fld) || row.closest(TABLE)) continue;
    const s = css(row);
    check('c5.form', 'padding-top', f(s.paddingTop), 8, row);
    check('c5.form', 'padding-bottom', f(s.paddingBottom), 8, row);
    const lb = box(lab), fb = box(fld);
    if (fb.top >= lb.bottom - 0.5) check('c5.form', 'stacked gap', fb.top - lb.bottom, 4, row);
    else {
      check('c5.form', 'label width', lb.width, 200, lab);
      check('c5.form', 'label gap', fb.left - lb.right, 16, row);
    }
    for (const c of fld.querySelectorAll(FIELD)) {
      if (!visible(c) || c.parentElement.closest('.cbi-dropdown') || c.closest('.cbi-dynlist, textarea')) continue;
      check('c5.form', 'field height', box(c).height, 36, c);
    }
    const help = fld.querySelector(':scope > .cbi-value-description');
    if (help && visible(help)) {
      const above = [...fld.children].filter((x) => x !== help && visible(x) && box(x).bottom <= box(help).top + 0.5);
      if (above.length) check('c5.form', 'help gap', box(help).top - Math.max(...above.map((x) => box(x).bottom)), 4, help);
    }
  }

  /* C9: md 36 in toolbars, form rows, the save bar, dialogs; sm 32 in
     tables, cards and heading rows; one primary a view; red only in a
     dialog. */
  let primaries = 0;
  for (const b of all(BTN)) {
    if (b.parentElement.closest(BTN) || b.closest('.cbi-dropdown:not(.btn, .cbi-button)')) continue;
    const s = css(b);
    // md: the save bar, a dialog, a form row, a toolbar (a row that also
    // holds a field), anything outside a card; sm: tables, heading rows and
    // a card's own button rows.
    const row = b.parentElement, row2 = row.parentElement;
    const md = !b.closest(TABLE) && (b.closest('.cbi-page-actions, #modal_overlay, .cbi-value-field, .cbi-dynlist, .controls, .cbi-section-create, #content_syslog') || !cardOf(b)
      || [row, row2].some((r) => r && r !== cardOf(b) && [...r.querySelectorAll(FIELD)].some(visible)));
    const ctx = md ? 'md' : 'sm';
    check('c9.button', `height ${ctx}`, box(b).height, md ? 36 : 32, b);
    const fill = rgba(s.backgroundColor);
    if (s.backgroundColor === accent && !b.closest('.cbi-page-actions .cbi-dropdown')) primaries++;
    const red = tok('backgroundColor', 'var(--color-background-error, var(--color-error))');
    if (fill[3] > 0.5 && s.backgroundColor === red && !b.closest('.modal')) fail('c9.button', 'red', 'red outside a dialog', 'none', b);
  }
  if (!cfg.modal && primaries > 1) { count('c9.button'); fail('c9.button', 'primaries', primaries, 1, scope); }

  /* C17: Banner padding 12 16, icon gap 8, radius 12. */
  for (const a of [...(scope.matches('.alert-message:not(.modal)') ? [scope] : []), ...all('.alert-message:not(.modal)')]) {
    const s = css(a), i = css(a, '::before');
    check('c17.banner', 'padding-block', f(s.paddingTop), 12, a);
    check('c17.banner', 'radius', f(s.borderTopLeftRadius), 12, a);
    if (i.content !== 'none' && f(i.width)) {
      const ib = box(a).left + f(s.borderLeftWidth) + f(i.left);
      const tx = textX(a);
      if (tx != null) check('c17.banner', 'icon gap', tx - (ib + f(i.width)), 8, a);
    }
  }

  /* C18: Dialog padding 16, title to content 16, content to footer 16,
     footer buttons 8 apart, widths 400/560/800 or the window less 32. */
  if (cfg.modal && scope.matches('.modal') && !scope.matches('.alert-message')) {
    const s = css(scope);
    for (const d of SIDES) check('c18.dialog', `padding-${d.toLowerCase()}`, f(s[`padding${d}`]) + f(s[`border${d}Width`]), 16, scope);
    check('c18.dialog', 'width', box(scope).width, [400, 560, 800, innerWidth - 32], scope);
    check('c18.dialog', 'fits', box(scope).bottom <= innerHeight + 0.5 && box(scope).right <= innerWidth + 0.5 ? 'yes' : 'no', 'yes', scope);
    const kids = [...scope.children].filter(visible);
    const title = kids.find((k) => k.matches('h4, h3'));
    if (title && kids[kids.indexOf(title) + 1]) check('c18.dialog', 'title gap', box(kids[kids.indexOf(title) + 1]).top - box(title).bottom, 16, title);
    const foot = kids.find((k) => k.matches('.button-row, .right:last-child'));
    if (foot && kids[kids.indexOf(foot) - 1]) {
      check('c18.dialog', 'footer gap', box(foot).top - box(kids[kids.indexOf(foot) - 1]).bottom, 16, foot);
      const bs = [...foot.querySelectorAll(BTN)].filter(visible).sort((a, b) => box(a).left - box(b).left);
      for (let i = 1; i < bs.length; i++) if (Math.abs(box(bs[i]).top - box(bs[i - 1]).top) < 1) check('c18.dialog', 'button gap', box(bs[i]).left - box(bs[i - 1]).right, 8, bs[i]);
    }
  }

  /* C19: the bar 8 high, 4 under its text. */
  for (const p of all('.cbi-progressbar')) {
    check('c19.progress', 'height', box(p).height, 8, p);
    const t = css(p, '::before');
    if (t.content !== 'none' && t.content !== '""' && f(t.height)) { check('c19.progress', 'text gap', f(t.bottom) - box(p).height, 4, p); continue; }
    let tx = p.previousSibling;
    while (tx && tx.nodeType === 3 && !tx.data.trim()) tx = tx.previousSibling;
    if (tx && tx.nodeType === 1 && !visible(tx)) tx = null;
    if (tx) {
      const r = document.createRange();
      r.selectNode(tx);
      const tb = r.getBoundingClientRect();
      if (tb.height && tb.bottom <= box(p).top + 0.5) check('c19.progress', 'text gap', box(p).top - tb.bottom, 4, p);
    }
  }

  /* C22: a Divider is 1 high and spans its card's content box. */
  const DIV = all('hr');
  for (const c of cards) {
    if (cfg.modal) break;
    for (const el of c.querySelectorAll('*')) {
      if (cards.includes(el) || !inScope(el) || !visible(el) || isCtrl(el) || el.closest(`${TABLE}, ${CODE}, .alert-message, .cbi-tooltip, .cbi-tabmenu, .ifacebox`) || pinned(el)) continue;
      const s = css(el);
      if (side(s, 'Top') && !side(s, 'Bottom') && !side(s, 'Left') && !side(s, 'Right')) DIV.push(el);
    }
  }
  for (const hr of DIV) {
    check('c22.divider', 'thickness', hr.matches('hr') ? box(hr).height : f(css(hr).borderTopWidth), 1, hr);
    const c = cardOf(hr);
    if (c) {
      const k = content(c);
      check('c22.divider', 'start', box(hr).left - k.l, 0, hr);
      check('c22.divider', 'end', k.r - box(hr).right, 0, hr);
    }
  }

  /* G3: in a card, headings, descriptions, form labels and button rows
     start on the card's content edge. */
  for (const c of cards) {
    if (cfg.modal) break;
    const k = content(c);
    const starts = [...c.querySelectorAll(':scope > :is(h3, h4, .cbi-section-descr, p), :scope > .cbi-title > :is(h3, h4), :scope > .cbi-section-node > :is(h3, h4, .cbi-section-descr, p), .cbi-value > .cbi-value-title, :scope > .cbi-section-create, :scope > .cbi-section-node > .cbi-section-create')];
    for (const el of starts) {
      if (!inScope(el) || !visible(el) || cardOf(el) !== c || el.closest(TABLE)) continue;
      const x = el.matches('.cbi-section-create') ? Math.min(...[...el.querySelectorAll(CTRL)].filter(visible).map((q) => box(q).left)) : textX(el);
      if (x == null || !Number.isFinite(x)) continue;
      check('g.textx', 'start', x - k.l, 0, el);
    }
  }
  tok.remove();
  const out = bad.map(([id, prop, got, want, at]) => [id, 'conform', `${prop} ${got} (want ${want})`, at]);
  for (const id of Object.keys(n)) if (!bad.some(([b]) => b === id)) out.push([id, 'conform', 'ok', 'all']);
  return out;
}
