'use strict';
'require baseclass';

/* The appearance control and the page marks, on their own so both shells
 * can use them: the admin pages get this through menu-aster.js, and the login
 * page — which renders with blank_page and therefore has no menu module —
 * through its own view. The head script in header.ut has already applied the
 * stored choices before the first stylesheet; bind() reflects them and writes
 * new ones.
 */
return baseclass.extend({
	__init__() {
		this.bind();
		this.lua();
		this.tooltip();
		this.marks();
		this.actions();
		this.fold();
	},

	/* Tables whose lines never break (leases, stations, Wireless' radios)
	 * fold where they do not fit their card (components.css, luci.css):
	 * each is measured unfolded (data-fold "wide") at its narrowest
	 * (min-content) and folds when that is wider than its room; folded, it
	 * opens again only with 16 to spare, so the scroll bar a taller fold
	 * brings does not flip it back. Resizes are read on the next frame, as a
	 * fold resizes the card being observed. */
	fold() {
		const view = document.getElementById('view'), seen = new WeakSet(),
			sel = '.table:is(.leases, .lases, .leases6, .assoclist, :has(.tr > [data-name="_badge"]))';
		let frame;

		if (!view)
			return;

		const fit = (t) => {
			const p = t.parentNode, ps = getComputedStyle(p), ts = getComputedStyle(t), was = t.dataset.fold == 'fold';

			if (!p.clientWidth)
				return;

			const w = t.style.width;
			t.dataset.fold = 'wide';
			t.style.width = 'min-content';
			const need = t.scrollWidth, room = p.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight) - parseFloat(ts.marginLeft) - parseFloat(ts.marginRight);
			t.style.width = w;
			t.dataset.fold = need > room + 0.5 - (was ? 16 : 0) ? 'fold' : 'wide';
		};
		const ro = new ResizeObserver(() => frame ||= requestAnimationFrame(() => (frame = 0, view.querySelectorAll(sel).forEach(fit))));
		const run = () => view.querySelectorAll(sel).forEach((t) => (seen.has(t.parentNode) || (seen.add(t.parentNode), ro.observe(t.parentNode)), fit(t)));

		run();
		new MutationObserver(run).observe(view, { childList: true, subtree: true });
	},

	/* Row actions (doona ActionGroup): one line, else a "more" Menu. */
	actions() {
		const view = document.getElementById('view'), neg = '.cbi-button-remove, .cbi-button-negative';
		let owner;

		if (!view?.showPopover)
			return;

		const acts = (g) => g.querySelectorAll(':scope > :not(.drag-handle, .aster-more)');
		const groups = (r) => [...r.querySelectorAll(':is(.td, td) > div')].filter((g) =>
			acts(g)[1] && !g.querySelector(':scope > :not(.btn, .cbi-button, button, .drag-handle)'));
		const wide = (e) => e.scrollWidth > e.clientWidth + 1;
		const menu = document.body.appendChild(E('ul', { id: 'aster-more-menu', role: 'menu', popover: 'auto',
			beforetoggle: (ev) => {
				owner.ariaExpanded = ev.newState == 'open';
				ev.newState == 'open' && menu.replaceChildren(...[...acts(owner.parentNode)].slice(1).sort((x, y) => x.matches(neg) - y.matches(neg)).map((b, i) =>
					E('li', { role: 'menuitem', tabindex: -1, class: b.matches(neg) ? 'negative' : null, 'aria-disabled': b.disabled || null, autofocus: !i || null,
						click: b.disabled ? null : () => (menu.hidePopover(), b.click()) }, (b.textContent || b.value).trim())));
			},
			keydown: (ev) => {
				const k = ev.key, a = ev.target, f = menu.firstChild, l = menu.lastChild,
					go = { ArrowDown: a.nextSibling || f, ArrowUp: a.previousSibling || l, Home: f, End: l }[k];
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
			const gs = groups(t), on = (v) => gs.forEach((g) => g.toggleAttribute('data-collapsed', v));

			if (t.offsetWidth) {
				on(false);
				on(wide(t.parentNode) || wide(t) || gs.some((g) => wide(g) || g.offsetWidth > g.parentNode.clientWidth));
			}
		};
		const ro = new ResizeObserver((es) => es.forEach((e) => e.target.querySelectorAll(':scope > :is(.table, table)').forEach(fit)));
		const run = () => new Set(groups(view).map((g) => {
			g.querySelector('.aster-more') || g.appendChild(E('button', { type: 'button', class: 'btn cbi-button aster-more',
				'aria-haspopup': 'menu', 'aria-expanded': false, 'aria-label': _('Actions'), popovertarget: 'aster-more-menu',
				click: (ev) => owner = ev.currentTarget }));
			return g.closest('.table, table');
		})).forEach((t) => (ro.observe(t.parentNode), fit(t)));

		run();
		new MutationObserver(run).observe(view, { childList: true, subtree: true });
	},

	/* Marks for what LuCI says only in its words, kept as views re-render:
	 *  - a ▲ or ▼ before a traffic count (the overview's ports) goes into a
	 *    .aster-glyph span, which components.css draws as the ArrowUp or
	 *    ArrowDown icon (Icon glyphs);
	 *  - a view that draws no title (Interfaces, nftables) gets an h2 with
	 *    its menu entry's name, as every other page has one;
	 *  - an interface's Error entry (interfaces.js render_status: a
	 *    "<strong>Error:</strong> text" item) gets .aster-error, set in the
	 *    error ink (luci.css, Network pages);
	 *  - a key in an interface's list ("<strong>Protocol:</strong>": the
	 *    overview's boxes, Interfaces' status) loses LuCI's colon: both are
	 *    drawn as a MetadataList, whose labels carry no colons; the
	 *    overview's upstreams share one label column, as wide as their
	 *    longest label (--aster-kv-w; luci.css caps it). */
	marks() {
		const roots = ['view', 'modal_overlay'].map((id) => document.getElementById(id)).filter(Boolean);
		const error = _('Error');
		const glyph = (s) => {
			const g = document.createElement('span');

			g.className = 'aster-glyph';
			g.dataset.glyph = (s === '▲') ? 'up' : 'down';
			g.textContent = s;

			return g;
		};
		const run = () => roots.forEach((root) => {
			const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
				acceptNode: (n) => (/[▲▼]/.test(n.data) && !n.parentNode.closest('.aster-glyph, .cbi-tooltip')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
			});
			const hits = [];

			while (walk.nextNode())
				hits.push(walk.currentNode);

			hits.forEach((n) => n.replaceWith(...n.data.split(/([▲▼])/).filter(Boolean).map((s) => /^[▲▼]$/.test(s) ? glyph(s) : s)));

			const v = document.getElementById('view');
			const cur = [...document.querySelectorAll('#mainmenu [aria-current="page"]')].pop();

			if (root === v && document.querySelector('.shell-inner h2:not(.aster-title)'))
				v.querySelectorAll(':scope > .aster-title').forEach((h) => h.remove());
			else if (root === v && cur && v.firstElementChild && !document.querySelector('.aster-title, #view .spinning')) {
				const h = document.createElement('h2');

				h.className = 'aster-title';
				h.textContent = cur.textContent.trim();
				v.prepend(h);
			}

			root.querySelectorAll('span:not(.aster-error) > strong:first-child').forEach((s) => {
				if (s.textContent.trim().replace(/[:：]$/, '') === error)
					s.parentNode.classList.add('aster-error');
			});

			root.querySelectorAll('.ifacebox-body .nowrap > strong:first-child, [id$="-ifc-description"] > .nowrap > strong:first-child, .ifacebadge.large > span > .nowrap > strong:first-child').forEach((s) => {
				const t = s.textContent.replace(/\s*[:：]\s*$/, '');

				if (t !== s.textContent)
					s.textContent = t;
			});

			root.querySelectorAll('.network-status-table').forEach((n) => {
				n.style.removeProperty('--aster-kv-w');
				const w = Math.max(...[...n.querySelectorAll('.nowrap > strong:first-child')].map((s) => s.getBoundingClientRect().width));

				if (w > 0)
					n.style.setProperty('--aster-kv-w', `${Math.ceil(w)}px`);
			});
		});
		let queued = false;
		const observer = new MutationObserver(() => {
			if (!queued)
				queued = requestAnimationFrame(() => { queued = false; run(); });
		});

		run();
		roots.forEach((root) => observer.observe(root, { childList: true, subtree: true, characterData: true }));
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
		});
	},

	/* Lua CBI pages (a <form> around the .cbi-map) are in the document by
	 * the time this runs; form.js views render later and need none of it.
	 *  - A Button option whose label repeats the button's words (PassWall's
	 *    "Delete All Subscribe Node" over the same button) is marked
	 *    .aster-same-label: the label is kept for screen readers and not
	 *    drawn, so the row shows the button once (components.css, Form row).
	 *  - A table cell with no data-title takes its column header's own words,
	 *    which the phone fold prints before it, as form.js tables carry;
	 *    again when the page's own script moves rows (PassWall's node
	 *    groups). */
	lua() {
		const words = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();

		document.querySelectorAll('form > .cbi-map .cbi-value').forEach((row) => {
			const label = row.querySelector(':scope > .cbi-value-title');
			const ctl = row.querySelectorAll(':scope > .cbi-value-field :is(input:not([type="hidden"]), select, textarea, button)');

			if (label && ctl.length === 1 && ctl[0].matches('input[type="submit"], input[type="button"], button') &&
			    (ctl[0].value || ctl[0].textContent).trim() === label.textContent.trim())
				row.classList.add('aster-same-label');
		});

		const titles = () => document.querySelectorAll('form > .cbi-map :is(table, .table)').forEach((t) => {
			const head = Array.from(t.querySelectorAll(':scope > .tr, :scope > :is(.thead, thead, tbody) > .tr')).find((r) => r.querySelector(':scope > .th'));

			if (!head)
				return;

			const names = Array.from(head.children).map(words);

			t.querySelectorAll(':scope > .tr, :scope > :is(.tbody, tbody) > .tr').forEach((r) => Array.from(r.children).forEach((c, i) => {
				if (c.matches('.td, td') && !c.hasAttribute('data-title') && names[i])
					c.setAttribute('data-title', names[i]);
			}));
		});
		let queued = false;
		const observer = new MutationObserver(() => {
			if (!queued)
				queued = requestAnimationFrame(() => { queued = false; titles(); });
		});

		titles();
		document.querySelectorAll('form > .cbi-map').forEach((m) => observer.observe(m, { childList: true, subtree: true }));
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
