'use strict';
'require baseclass';

function tableChanges(rs, view, sel, touch, add) {
	const targets = new Set(), roots = new Set();
	for (const {target: t, addedNodes: a, removedNodes: r} of rs) {
		if (!r.length && a.length == 1 && a[0].classList?.contains('aster-more')) continue;
		const n = t.nodeType == 1 ? t : t.parentElement;
		if (!targets.has(n) && view.contains(n)) targets.add(n), touch(n, roots);
		for (const c of a) if (c.nodeType == 1) roots.add(c);
	}
	for (const n of roots) {
		if (!view.contains(n))
			continue;
		if (n.matches(sel))
			add(n);
		n.querySelectorAll(sel).forEach(add);
	}
}

function tableFrame(run) {
	const shell = document.querySelector('.shell');
	let frame, moving, ended;
	const schedule = () => {
		if (!moving && !frame)
			frame = requestAnimationFrame(() => {
				frame = 0;
				if (!moving)
					run(ended), ended = false;
			});
	};
	for (const type of ['transitionrun', 'transitionend', 'transitioncancel'])
		shell?.addEventListener(type, (e) => {
			if (e.target !== shell || e.propertyName !== 'grid-template-columns')
				return;
			moving = type === 'transitionrun';
			if (!moving) {
				ended = true;
				schedule();
			}
		});
	return schedule;
}

/* The appearance control and the page marks, on their own so both shells
 * can use them: the admin pages get this through menu-aster.js, and the login
 * page (blank_page, no menu module) through its own view. */
return baseclass.extend({
	__init__() {
		this.bind();
		this.lua();
		this.tooltip();
		this.marks();
		this.actions();
		this.fold();
	},

	/* A data table folds when, unfolded at min-content, it is wider than
	 * its card; it reopens only with 16 to spare (the fold's scroll bar).
	 * Refitted when the card's width or the table's size changes. */
	fold() {
		const view = document.getElementById('maincontent'), q = new Set(),
			sel = ':is(#view,form>.cbi-map) :is(.table,table):is(:has(>.tr>.th,>:is(.thead,thead,tbody)>.tr>.th),.cbi-section-table):not(:has(.diag-action))';
		if (!view)
			return;
		const memo = new Map();

		const width = (p) => {
			const s = getComputedStyle(p);
			return p.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
		};
		const fit = (t) => {
			const p = t.parentElement;
			if (!p?.clientWidth || !t.checkVisibility() || !t.matches(sel)) return sz.delete(t), q.delete(t);
			const {id, dataset: d} = t;
			/* LuCI rebinds data-idref. Keep data-fold in the key for hysteresis. */
			const k = /^(status_leases6?|lease6?_status_table)$/.test(id) &&
				[innerWidth, width(p), t.outerHTML.replace(/ data-idref="[^"]*"/g, '')].join('\0'), old = memo.get(id);
			if (old?.p === p && old.k === k) return d.fold = old.fold;
			const s = getComputedStyle(t), gap = parseFloat(s.marginLeft) + parseFloat(s.marginRight), h = d.fold == 'fold' ? -15.5 : 0.5;
			d.fold = 'wide';
			t.classList.add('aster-probe');
			/* Not an inline style: [style] rules stay put. */
			const probe = t.animate([{ width: 'min-content' }], { fill: 'forwards' });
			const fold = t.scrollWidth > width(p) - gap + h;
			probe.cancel();
			t.classList.remove('aster-probe');
			if (fold) d.fold = 'fold';
			if (k) memo.set(id, {p, k, fold: d.fold});
		};
		const format = (t) => {
			/* nftables' comment mark follows the rule's words. */
			t.querySelectorAll('.td > .nft-comment:not(:last-child)').forEach((c) => c.parentNode.append(c));
			t.querySelectorAll('.tr:not(.placeholder) > .td.center[colspan]:only-child').forEach((c) => c.parentNode.classList.add('placeholder'));

			/* Folded cells need a label, an empty marker and one value. */
			if (t.dataset.fold == 'wide')
				return t.querySelectorAll('.tr > * > div.aster-v').forEach((v) => v.replaceWith(...v.childNodes));

			/* Title: the row's name, not a checkbox or signal (C7). */
			const hs = [...(t.querySelector('.tr:has(> .th)')?.children || [])], h = hs.map((c) => c.textContent.trim()),
				rs = t.querySelectorAll('.tr:not(:has(> .th))'), mark = (c) => c?.querySelector('[type=checkbox],[data-signal]'),
				ti = h.findIndex((x, i) => !hs[i].matches('.hide-xs') && !mark(rs[0]?.children[i]) && ![_('Interface'), _('Network'), _('Device'), _('Priority'), _('Start priority')].includes(x));
			rs.forEach((r) => [...r.children].forEach((c, i, a) => {
				const n = [...c.childNodes].filter((x) => x.nodeType == 1 || x.data.trim());

				c.toggleAttribute('data-head', i == (hs[0] ? ti : a.findIndex((x) => !mark(x))));
				c.hasAttribute('data-title') || !h[i] || c.setAttribute('data-title', h[i]);
				c.toggleAttribute('data-empty', /^-?$/.test(c.textContent.trim()) && !c.querySelector('input, select, button, img'));
				(n[1] || n[0]?.nodeType == 3) && !c.matches('.cbi-section-actions') && c.replaceChildren(E('div', { class: 'aster-v' }, n));
			}));
		};
		const sz = new WeakMap(), dim = t => `${t.offsetWidth}x${t.offsetHeight}`;
		const ro = new ResizeObserver((es) => {
			for (const {target: t, contentRect: {width: w}} of es) {
				if (!view.contains(t)) ro.unobserve(t);
				else if (t.matches(sel)) {
					if (sz.get(t) != dim(t)) q.add(t);
				} else {
					/* add() already queued the children for the first delivery. */
					if (w != (sz.get(t) ?? w)) for (const c of t.children) if (c.matches(sel)) q.add(c);
					sz.set(t, w);
				}
			}
			q.size && schedule();
		});
		const add = (t) => {
			if (!t) return;
			ro.observe(t.parentElement);
			ro.observe(t);
			q.add(t);
		};
		const collect = rs => tableChanges(rs, view, sel, n => add(n.closest(sel)), add);
		const schedule = tableFrame(() => {
			collect(mo.takeRecords());
			q.forEach(fit);
			/* Batch row mutations so :has() restyles the view once. */
			q.forEach(format);
			q.forEach((t) => sz.set(t, dim(t)));
			q.clear();
			/* Drop this fit's own cell and comment moves. */
			mo.takeRecords();
		});

		const mo = new MutationObserver((rs) => {
			collect(rs);
			q.size && schedule();
		});
		mo.observe(view, { childList: true, characterData: true, subtree: true });
		view.querySelectorAll(sel).forEach(add);
		q.size && schedule();
	},

	/* Row actions (doona ActionGroup): one line, else a "more" Menu. */
	actions() {
		const view = document.getElementById('view'), neg = '.cbi-button-remove, .cbi-button-negative', table = '.table, table', cell = ':is(.td, td) > div';
		let owner;

		if (!view?.showPopover)
			return;

		const acts = (g) => g.querySelectorAll(':scope > :not(.drag-handle, .aster-more)');
		const wide = (e) => e.scrollWidth > e.clientWidth + 1;
		const menu = document.body.appendChild(E('ul', { id: 'aster-more-menu', role: 'menu', popover: 'auto',
			beforetoggle: (ev) => {
				owner.ariaExpanded = ev.newState == 'open';
				/* The rest in DOM order, Remove/Negative last in red after a Divider. */
				ev.newState == 'open' && menu.replaceChildren(...[...acts(owner.parentNode)].filter((b) => !b.hasAttribute('data-keep')).sort((x, y) => x.matches(neg) - y.matches(neg)).flatMap((b, i, l) => [
					...(b.matches(neg) && i && !l[i - 1].matches(neg) ? [E('li', { role: 'separator' })] : []),
					E('li', { role: 'menuitem', tabindex: -1, class: b.matches(neg) ? 'negative' : null, 'aria-disabled': b.disabled || null, autofocus: !i || null,
						click: b.disabled ? null : () => (menu.hidePopover(), b.click()) }, (b.textContent || b.value).trim())]));
			},
			keydown: (ev) => {
				const k = ev.key, a = ev.target, f = menu.firstChild, l = menu.lastChild;
				let go = { ArrowDown: a.nextSibling || f, ArrowUp: a.previousSibling || l, Home: f, End: l }[k];
				go?.role == 'separator' && (go = k == 'ArrowUp' ? go.previousSibling : go.nextSibling);
				if (go)
					go.focus();
				else if (k == 'Enter' || k == ' ')
					a.click();
				else
					return k == 'Tab' && menu.hidePopover();
				ev.preventDefault();
			}
		}));
		const fit = (t) => {
			const gs = [...t.querySelectorAll('.aster-more')].map((b) => b.parentElement);
			if (!gs.length || !t.offsetWidth)
				return;
			widths.set(t, t.parentElement.clientWidth);
			const on = (v) => gs.forEach((g) => g.toggleAttribute('data-collapsed', v));
			for (const g of gs) {
				const a = [...acts(g)], keep = a.find((b) => b.matches('.cbi-button-edit, .important')) || a.find((b) => !b.matches(neg)) || a[0];
				a.forEach((b) => b.toggleAttribute('data-keep', b == keep));
			}

			/* Collapsed where the line does not fit; folded, also where that
			 * saves a title line a wrap (the actions collapse before the
			 * title wraps; they never take a line of their own). */
			const folded = t.dataset.fold == 'fold';
			if (folded)
				on(true);
			const h = folded && t.offsetHeight;
			on(false);
			const over = () => {
				const b = t.getBoundingClientRect();
				return gs.some((g) => {
					const r = g.getBoundingClientRect();
					return wide(g) || g.offsetWidth > g.parentNode.clientWidth || r.left < b.left - 1 || r.right > b.right + 1;
				});
			};
			on(wide(t.parentElement) || wide(t) || [...t.querySelectorAll('.tr > *, [data-head] > .aster-v')].some(wide) || over() || folded && h < t.offsetHeight);
		};
		/* The parent's room, or the table's own size (it folds), read on the
		 * next frame. */
		const q = new Set(), resized = new Set(), widths = new WeakMap();
		const ro = new ResizeObserver((es) => {
			for (const { target } of es) {
				if (!view.contains(target))
					ro.unobserve(target);
				else if (target.matches(table))
					resized.add(target);
				else
					target.querySelectorAll(':scope > :is(.table, table)').forEach((t) => resized.add(t));
			}
			schedule();
		});
		const add = (g) => {
			const t = g.closest(table);
			if (!t || g.querySelector('.aster-more') || !acts(g)[1] || g.querySelector(':scope > :not(.btn, .cbi-button, button, .drag-handle)'))
				return;
			g.appendChild(E('button', { type: 'button', class: 'btn cbi-button aster-more',
				'aria-haspopup': 'menu', 'aria-expanded': false, 'aria-label': _('Actions'), popovertarget: 'aster-more-menu',
				click: (ev) => owner = ev.currentTarget }));
			ro.observe(t.parentElement);
			ro.observe(t);
			q.add(t);
		};
		const schedule = tableFrame((ended) => {
			for (const t of resized)
				if (!ended || widths.get(t) !== t.parentElement?.clientWidth)
					q.add(t);
			resized.clear();
			q.forEach(fit);
			q.clear();
		});

		view.querySelectorAll(cell).forEach(add);
		q.size && schedule();
		new MutationObserver((rs) => {
			tableChanges(rs, view, cell, (n, roots) => {
				const t = n.closest(table), r = n.closest('.tr, tr, .td, td');
				if (t)
					q.add(t);
				if (r)
					roots.add(r);
			}, add);
			q.size && schedule();
		}).observe(view, { childList: true, subtree: true });
	},

	/* Marks for what LuCI says only in its words, kept as views re-render:
	 *  - ▲ / ▼ before a traffic count become an .aster-glyph span, drawn
	 *    as the ArrowUp / ArrowDown icon (components.css);
	 *  - a URL in a cell is an .aster-id (G5); a station rate's or a
	 *    command's word does not break after its hyphen (a word joiner);
	 *  - a view with no title (Interfaces, nftables) gets an h2 with its
	 *    menu entry's name;
	 *  - a card title repeating the page title or a tab is .aster-said, not
	 *    drawn (C1; a pane shows only under its own tab);
	 *  - an interface's "<strong>Error:</strong>" entry is .aster-error;
	 *  - list keys ("<strong>Protocol:</strong>": overview boxes, Interfaces,
	 *    realtime legends) and labels (fields, toolbars, nft clauses, the
	 *    changes legend) lose LuCI's colon (G10); the overview's upstreams
	 *    share one label column (--aster-kv-w); an interface's value is
	 *    .aster-v, titled, "(N 封包)" kept whole by a no-break space;
	 *  - "K: <b>v</b>, …" (nft hook, nlbw kpi) and WireGuard's " · Port N
	 *    · key", wireless' "K: v | K: v" become rows. */
	marks() {
		const v = document.getElementById('view'), shell = v?.closest('.shell-inner');
		const roots = document.querySelectorAll('#view,#modal_overlay');
		const labels = 'label,.cbi-value-title,.nft-rules .ifacebadge,.modal .cbi-section>strong', rows = ':is(.nft-chain-hook,.kpi) li:not(.aster-row)';
		const h3 = '.cbi-section>h3', net = '.network-status-table', table = '.table:not(:has(.th))';
		const local = `${labels},${rows},${h3},${net},${table},.ifacebadge,#view>p,.nowrap,span:has(>strong)`;
		const kv = '--aster-kv-w';
		const pending = new WeakSet(), tables = '.table,table';
		// Read after layout; a lease-table replacement otherwise forces a full layout here.
		const ro = new ResizeObserver(es => es.forEach(({target: n, contentRect: r}) => {
			if (!(r.width || r.height)) return;
			if (pending.delete(n)) return ro.unobserve(n), scan(mo.takeRecords(), [n]);
			const w = Math.max(...Array.from(n.querySelectorAll('.nowrap:not(.cbi-tooltip *)>strong:first-child'), (s) => s.getBoundingClientRect().width));
			if (w > 0) ro.unobserve(n), queueMicrotask(() => n.style.setProperty(kv, `${Math.ceil(w)}px`));
		}));
		let said;
		const error = _('Error'), id = /(\S+:\/\/\S+)/, arrow = /([▲▼])/, colon = /\s*[:：]\s*$/;
		// nlbw later sets display on the value's new parent, not the row.
		const hide = (v) => v.parentNode.toggleAttribute('hidden', v.style.display != 'list-item');
		const kpi = new MutationObserver((rs) => rs.forEach(({ target }) => hide(target)));
		const span = (c, v, a) => E('span', { class: `aster-${c}`, ...a }, v);
		const row = (k, v, li) => {
			const r = E('li', { class: 'aster-row' }, v ? [span('k', [k]), span('v', v)] : k);
			if (v && li?.closest('.kpi')) {
				const p = r.lastChild;
				p.style.display = li.style.display;
				hide(p);
				kpi.observe(p, { attributeFilter: ['style'] });
			}
			return r;
		};
		// A copy drops the word joiners put after hyphens below.
		document.addEventListener('copy', (ev) => { const s = `${getSelection()}`; /⁠/.test(s) && (ev.clipboardData.setData('text/plain', s.replace(/⁠/g, '')), ev.preventDefault()); });
		const scan = (rs, ns) => {
			const q = new Set(ns);
			for (const { target: t, addedNodes: a } of rs) {
				let n = t.nodeType == 1 ? t : t.parentElement, p;
				for (; n && n !== v && n.id != 'modal_overlay'; n = n.parentElement)
					if (n.matches(local)) p = n;
				if (n) p || t.nodeType == 3 ? q.add(p || t) : a.forEach(e => e.parentNode == t && q.add(e));
			}
			const defer = t => t?.checkVisibility() === false && (ro.observe(t), pending.add(t));
			for (const n of q) {
				let p = n.parentElement;
				while (p && !q.has(p)) p = p.parentElement;
				if (p || defer((n.nodeType == 1 ? n : n.parentElement)?.closest(tables))) q.delete(n);
				else n.querySelectorAll?.(tables).forEach(defer);
			}
			const visible = (n) => !pending.has(n.closest(tables));
			const each = (s, f, set = q) => set.forEach((n) => {
				n.matches?.(s) && visible(n) && f(n);
				n.querySelectorAll?.(s).forEach((e) => visible(e) && f(e));
			});
			for (const root of q) {
				const walk = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
				for (let n; n = walk.nextNode();) {
					const p = n.parentNode;
					/-\b/.test(n.data) && p.matches('.assoclist .td>:not(.ifacebadge)>span,.td>[style*=word-break]') && visible(p) && (n.data = n.data.replace(/-\b/g, '-\u2060'));
					const s = n.data, a = arrow.test(s);
					if ((a || id.test(s) && p.closest('.td,td')) && visible(p) && !p.closest('.aster-glyph,.aster-id,.cbi-tooltip,textarea,option'))
						n.replaceWith(...s.split(a ? arrow : id).flatMap((t, i) => i % 2
							? (a ? span('glyph', t, { 'data-glyph': t == '▲' ? 'up' : 'down' }) : span('id', [t], { title: t }))
							: (!a ? t : t ? t.trim() : [])));
				}
			}

			if (shell?.querySelector('h2:not(.aster-title)'))
				v.querySelector('.aster-title')?.remove();
			else if (v?.firstElementChild && !v.querySelector('.aster-title,.spinning')) {
				const cur = document.querySelector('#mainmenu [aria-current=page]');
				cur && v.prepend(E('h2', { class: 'aster-title' }, [cur.textContent.trim()]));
			}
			// Only duplicate titles depend on the titles and tabs of the whole page.
			const names = Array.from(document.querySelectorAll('.shell-inner h2,.cbi-tabmenu>li,.tab[data-active]'), (e) => e.textContent.trim());
			const all = said != (said = names.join('\0'));
			each(h3, (h) => h.classList.toggle('aster-said', names.includes(h.textContent.trim())), all ? roots : q);
			each(labels, (l) => l.childNodes.forEach((n) => colon.test(n.data) && (n.data = n.data.replace(colon, ''))));
			each('span:not(.aster-error)>strong:first-child', (s) => s.textContent.trim().replace(/[:：]$/, '') == error && s.parentNode.classList.add('aster-error'));

			each(`:is(.ifacebox-body .nowrap,:is([id$="-ifc-description"],.ifacebadge.large>span)>.nowrap)>strong:first-child,${table} .td>strong:only-child,[data-name="_stat"] .nowrap>strong`, (s) => {
				const t = s.textContent.replace(colon, '');
				t != s.textContent && (s.textContent = t);

				const p = s.parentNode, v = p.textContent.slice(t.length).replace(/\((\S+) /g, '($1\xa0');

				/\|/.test(p.previousSibling?.data) && p.previousSibling.remove();

				if (p.matches('.nowrap:not(.cbi-tooltip *)') && !p.querySelector('.aster-v,.cbi-tooltip'))
					p.replaceChildren(s, span('v', [v], { title: v }));
			});

			each(rows, (li) => li.replaceWith(...li.innerHTML.split(/[，,] *(?=[^<]*[:：] *<)/).map((h) => {
				const [k, v] = h.split(/[:：] *(.*)/s);

				return row(v ? k : h, v, li);
			})));

			each('.ifacebadge:has(img,em)', ({ firstChild: t }) => /:\s*$/.test(t.data) && (t.data = t.data.split(':')[0]));

			each('#view>p>.ifacebadge+span', (s) => {
				const [, k, n] = s.textContent.match(/([^\s·\d][^·\d]*?) *(\d+)/) || [], c = s.querySelector('code');

				n && c && (c.title = c.textContent, s.parentNode.replaceChildren(E('ul', { class: 'aster-kv' }, [row(k, n), row(_('Public Key'), c)])));
			});
			each(net, (n) => {
				n.style.removeProperty(kv);
				ro.observe(n);
			});
			// Only records from this scan's writes remain.
			mo.takeRecords();
		};
		const mo = new MutationObserver(rs => scan(rs));
		roots.forEach((r) => mo.observe(r === v && shell || r, { childList: true, subtree: true, characterData: true, attributeFilter: ['data-active'] }));
		scan([], roots);
	},

	/* ui.js's tooltip (one node it fills and moves on hover) is the Tooltip
	 * component (components.css): no arrow, so the "▲ " or "▼ " it writes
	 * before the text goes, and it sits --tooltip-gap above its trigger,
	 * centred, kept --tooltip-inset inside the window; below the trigger
	 * when there is no room above. A side nav row's sits at its end side,
	 * centred on it, as Astryx's collapsed SideNav places it. */
	tooltip() {
		document.addEventListener('tooltip-open', (ev) => {
			const tip = ev.target;
			const target = ev.detail && ev.detail.target;
			const text = tip.firstChild;

			if (!target || !tip.classList || !tip.classList.contains('cbi-tooltip'))
				return;

			if (text && text.nodeType === 3)
				text.data = text.data.replace(/^[\u25B2\u25BC] /, '');

			/* The spacing tokens are rem; a custom property computes to them as written. */
			const css = getComputedStyle(tip);
			const px = (name) => {
				const v = css.getPropertyValue(name).trim();
				return (parseFloat(v) || 0) * (v.endsWith('rem') ? parseFloat(getComputedStyle(document.documentElement).fontSize) : 1);
			};
			const gap = px('--tooltip-gap');
			const inset = px('--tooltip-inset');
			const r = target.getBoundingClientRect();
			const w = tip.offsetWidth;
			const h = tip.offsetHeight;
			const side = target.closest('#sidebar');
			const x = side ? r.right + gap : Math.max(inset, Math.min(r.left + (r.width - w) / 2, document.documentElement.clientWidth - inset - w));
			const y = side ? r.top + (r.height - h) / 2 : (r.top - gap - h >= inset) ? r.top - gap - h : r.bottom + gap;

			tip.style.left = `${x + window.pageXOffset}px`;
			tip.style.top = `${y + window.pageYOffset}px`;

			/* nlbwmon moves its bubble after this: back into the window (G6). */
			requestAnimationFrame(() => {
				const b = tip.getBoundingClientRect();

				tip.style.left = `${parseFloat(tip.style.left) + (Math.min(0, document.documentElement.clientWidth - inset - b.right) || Math.max(0, inset - b.left))}px`;
			});
		});
	},

	/* Lua CBI pages (a <form> around the .cbi-map) are in the document by
	 * the time this runs; form.js views render later and need none of it.
	 * A Button option whose label repeats the button's words (PassWall's
	 * "Delete All Subscribe Node" over the same button) is marked
	 * .aster-same-label: the label is kept for screen readers and not
	 * drawn, so the row shows the button once (components.css, Form row). */
	lua() {
		document.querySelectorAll('form > .cbi-map .cbi-value').forEach((row) => {
			const label = row.querySelector(':scope > .cbi-value-title');
			const ctl = row.querySelectorAll(':scope > .cbi-value-field :is(input:not([type="hidden"]), select, textarea, button)');

			if (label && ctl.length === 1 && ctl[0].matches('input[type="submit"], input[type="button"], button') &&
			    (ctl[0].value || ctl[0].textContent).trim() === label.textContent.trim())
				row.classList.add('aster-same-label');
		});
	},

	/* The appearance controls (header.ut): the scheme button, the scheme in
	 * force on it, with a Menu of Auto, Light and Dark, and the palette
	 * button with a Menu of the palettes, in the top bar and in the login
	 * page's corner. Menu pattern: a button opens its list (Enter, Space or
	 * a click) and focuses the checked row; arrows, Home and End move, Enter
	 * or Space picks, Escape or Tab closes, a click outside closes; a pick
	 * or Escape closes and puts the focus back on the button.
	 *
	 * Two layers for the scheme, and the difference matters:
	 *   - the device default, from which of the three media paths served the
	 *     page, on the body as data-theme-default (System - Language and
	 *     Style);
	 *   - this browser's override, localStorage "aster-theme". "Auto" drops
	 *     the override and follows the device default, which is why it is
	 *     one of the three choices rather than the absence of one.
	 * The palette is localStorage "aster-palette"; Rosé Pine, the default, is
	 * the absence of data-palette. The head script in header.ut applied both
	 * before the first stylesheet; this reflects them and writes new ones. */
	bind() {
		const menus = document.querySelectorAll('.palette-menu');
		const root = document.documentElement;

		/* The choice is held here first and persisted second: a browser with
		   site data blocked throws on both read and write, and reading the
		   store back meant the menu reported Auto right after Dark. */
		let override = null;

		try {
			const v = localStorage.getItem('aster-theme');

			if (v === 'auto' || v === 'light' || v === 'dark')
				override = v;
		}
		catch (e) { /* private window: this session keeps its choice in memory */ }

		const now = {
			scheme: () => override || document.body.getAttribute('data-theme-default') || 'auto',
			palette: () => root.getAttribute('data-palette') || 'rose-pine',
		};

		/* The phone paints its chrome from these, and in auto mode there are
		   two because the answer depends on the device. An explicit choice
		   pins both; auto puts each back on its own side. The colours are the
		   palette's shell, read from the stylesheet, as the head script in
		   header.ut does on load. */
		const bar = () => {
			this.icon();

			const m = /light-dark\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/.exec(getComputedStyle(root).getPropertyValue('--color-background-body'));
			const l = document.getElementById('aster-bar-light');
			const d = document.getElementById('aster-bar-dark');
			const t = root.getAttribute('data-theme');

			if (!m || !l || !d)
				return;

			l.setAttribute('content', t === 'dark' ? m[2] : m[1]);
			d.setAttribute('content', t === 'light' ? m[1] : m[2]);
		};

		const reflect = () => {
			root.setAttribute('data-scheme', now.scheme());
			menus.forEach((m) => m.querySelectorAll('[role="menuitemradio"]').forEach((r) =>
				r.setAttribute('aria-checked', String(r.dataset.value === now[r.dataset.group]()))));
		};

		const set = {
			scheme(v) {
				const dflt = document.body.getAttribute('data-theme-default');
				const t = (v === 'auto') ? dflt : v;

				override = v;

				if (t === 'light' || t === 'dark')
					root.setAttribute('data-theme', t);
				else
					root.removeAttribute('data-theme');

				try { localStorage.setItem('aster-theme', v); }
				catch (e) { /* private window: the choice lasts this page only */ }
			},
			palette(v) {
				if (v === 'rose-pine')
					root.removeAttribute('data-palette');
				else
					root.setAttribute('data-palette', v);

				try { localStorage.setItem('aster-palette', v); }
				catch (e) { /* private window: the choice lasts this page only */ }
			},
		};

		/* Each menu is a popover (header.ut): the browser keeps it in the top
		   layer, closes it on Escape or a click outside, closes the other one
		   when it opens, and puts the focus back on its button. Opening
		   focuses the checked row; a menu opened by the pointer shows no
		   focus ring until a key moves in it (data-pointer, shell.css). The
		   button's tooltip gives way to the open menu. Without CSS anchor
		   positioning the menu is placed under its button here. */
		menus.forEach((m) => {
			const btn = m.querySelector('button');
			const list = m.querySelector('[role="menu"]');
			const rows = Array.from(list.querySelectorAll('[role="menuitemradio"]'));
			const label = btn.getAttribute('aria-label');

			btn.addEventListener('click', (ev) => m.toggleAttribute('data-pointer', ev.detail > 0));

			list.addEventListener('beforetoggle', (ev) => {
				const open = ev.newState === 'open';

				const on = rows.find((r) => r.getAttribute('aria-checked') === 'true') || rows[0];

				m.toggleAttribute('open', open);
				btn.setAttribute('aria-expanded', String(open));
				rows.forEach((r) => r.toggleAttribute('autofocus', open && r === on));

				if (!open)
					return btn.setAttribute('data-tooltip', label);

				btn.removeAttribute('data-tooltip');
				window.L?.hideTooltip?.({});

				if (!CSS.supports('position-area', 'block-end')) {
					const r = btn.getBoundingClientRect();
					list.style.inset = `${r.bottom}px ${document.documentElement.clientWidth - r.right}px auto auto`;
				}
			});

			list.addEventListener('click', (ev) => {
				const r = ev.target.closest('[role="menuitemradio"]');

				if (!r)
					return;

				set[r.dataset.group](r.dataset.value);
				reflect();
				bar();
				list.hidePopover();
				btn.focus();
			});

			list.addEventListener('keydown', (ev) => {
				const i = rows.indexOf(document.activeElement);
				const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: rows.length - 1 }[ev.key];

				m.removeAttribute('data-pointer');

				if (go !== undefined)
					rows[(go + rows.length) % rows.length].focus();
				else if ((ev.key === 'Enter' || ev.key === ' ') && i >= 0)
					rows[i].click();
				else
					return ev.key === 'Tab' && list.hidePopover();

				ev.preventDefault();
			});
		});

		reflect();
		this.icon();
		matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.icon());
	},

	/* The tab icon: logo.svg's mark redrawn in the accent the page resolves
	 * for its palette and scheme (a probe's computed colour resolves the
	 * token's light-dark()). */
	icon() {
		const link = document.querySelector('link[rel="icon"]');
		const probe = document.createElement('i');

		if (!link)
			return;

		probe.style.color = 'var(--color-accent)';
		document.body.appendChild(probe);
		const c = getComputedStyle(probe).color;
		probe.remove();

		const q = [0, 60, 120, 180, 240, 300].map((a) => `<use href="#q" transform="rotate(${a} 12 12)"/>`).join('');

		link.href = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${c}"><defs><path id="q" d="M10.1 8.8C8.4 6.1 10.2 3 13.6 1.2C15.3 4.5 14.5 7.7 13.1 9.3Z"/></defs>${q}</svg>`);
	},
});
