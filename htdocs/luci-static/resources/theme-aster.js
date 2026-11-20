'use strict';
'require baseclass';

/* The theme switch, on its own so both shells can use it: the admin pages get
 * it through menu-aster.js, and the login page — which renders with
 * blank_page and therefore has no top bar and no menu module — gets it through
 * its own view.
 *
 * The head script in header.ut has already applied the stored choice before
 * the first stylesheet. This module only reflects the current state onto the
 * buttons and writes a new choice.
 *
 * Two layers, and the difference matters:
 *   - the device default, from which of the three media paths served the page.
 *     It is on the body as data-theme-default and an administrator sets it in
 *     System - Language and Interface.
 *   - this browser's override, in localStorage.
 * "Auto" means drop the override and fall back to the device default, which is
 * why it has to be one of the three choices rather than the absence of one.
 */
return baseclass.extend({
	__init__() {
		this.bind();
		this.lua();
		this.tooltip();
	},

	/* ui.js's tooltip (one node it fills and moves on hover) is the Tooltip
	 * component (components.css): no arrow, so the "▲ " or "▼ " it writes
	 * before the text goes, and it sits --tooltip-gap above its trigger,
	 * centred, kept --tooltip-inset inside the window; below the trigger
	 * when there is no room above. */
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
			const x = Math.max(inset, Math.min(r.left + (r.width - w) / 2, document.documentElement.clientWidth - inset - w));
			const y = (r.top - gap - h >= inset) ? r.top - gap - h : r.bottom + gap;

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

	bind() {
		/* Two copies: the top bar's, and the drawer's on a phone. One state. */
		const opts = document.querySelectorAll('.theme-switch [role="radio"][value]');
		const root = document.documentElement;

		/* The choice is held here first and persisted second. A browser with
		   site data blocked throws on both read and write, and reading the
		   store back to decide what is checked meant the radio reported Auto
		   immediately after the reader picked Dark — the page was dark and the
		   control said otherwise. */
		let override = null;

		try {
			const v = localStorage.getItem('aster-theme');

			if (v === 'auto' || v === 'light' || v === 'dark')
				override = v;
		}
		catch (e) { /* private window: this session keeps its choice in memory */ }

		const current = () => override || document.body.getAttribute('data-theme-default') || 'auto';

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
			const now = current();

			opts.forEach((o) => o.setAttribute('aria-checked', String(o.value === now)));
		};

		opts.forEach((o) => {
			o.addEventListener('click', () => {
				override = o.value;

				try { localStorage.setItem('aster-theme', o.value); }
				catch (e) { /* private window: the choice lasts this page only */ }

				if (o.value === 'auto') {
					const dflt = document.body.getAttribute('data-theme-default');

					if (dflt === 'light' || dflt === 'dark')
						root.setAttribute('data-theme', dflt);
					else
						root.removeAttribute('data-theme');
				}
				else {
					root.setAttribute('data-theme', o.value);
				}

				bar();

				reflect();
			});
		});

		reflect();
		this.icon();
		matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.icon());
		this.palettes(bar);
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

	/* The palette menus: the top bar's, and the drawer's on a phone. Menu
	 * pattern: the button opens the list (Enter, Space or a click) and
	 * focuses the checked row; arrows, Home and End move, Enter or Space
	 * picks, Escape or Tab closes, a click outside closes. The choice goes to
	 * localStorage "aster-palette"; Rosé Pine, the default, is the absence
	 * of data-palette. */
	palettes(bar) {
		const menus = document.querySelectorAll('.palette-menu');
		const root = document.documentElement;
		const current = () => root.getAttribute('data-palette') || 'rose-pine';

		const reflect = () => menus.forEach((m) => m.querySelectorAll('[role="menuitemradio"]').forEach((r) =>
			r.setAttribute('aria-checked', String(r.dataset.value === current()))));

		const close = (m, refocus) => {
			if (!m.hasAttribute('open'))
				return;

			m.removeAttribute('open');
			m.querySelector('[role="menu"]').hidden = true;
			m.querySelector('button').setAttribute('aria-expanded', 'false');

			if (refocus)
				m.querySelector('button').focus();
		};

		const pick = (m, value) => {
			if (value === 'rose-pine')
				root.removeAttribute('data-palette');
			else
				root.setAttribute('data-palette', value);

			try { localStorage.setItem('aster-palette', value); }
			catch (e) { /* private window: the choice lasts this page only */ }

			reflect();
			bar();
			close(m, true);
		};

		menus.forEach((m) => {
			const btn = m.querySelector('button');
			const list = m.querySelector('[role="menu"]');
			const rows = Array.from(list.querySelectorAll('[role="menuitemradio"]'));

			btn.addEventListener('click', () => {
				if (m.hasAttribute('open'))
					return close(m, false);

				menus.forEach((o) => close(o, false));
				m.setAttribute('open', '');
				list.hidden = false;
				btn.setAttribute('aria-expanded', 'true');
				(rows.find((r) => r.getAttribute('aria-checked') === 'true') || rows[0]).focus();
			});

			list.addEventListener('click', (ev) => {
				const r = ev.target.closest('[role="menuitemradio"]');

				if (r)
					pick(m, r.dataset.value);
			});

			list.addEventListener('keydown', (ev) => {
				const i = rows.indexOf(document.activeElement);
				const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: rows.length - 1 }[ev.key];

				if (go !== undefined)
					rows[(go + rows.length) % rows.length].focus();
				else if ((ev.key === 'Enter' || ev.key === ' ') && i >= 0)
					pick(m, rows[i].dataset.value);
				else if (ev.key === 'Escape')
					close(m, true);
				else if (ev.key === 'Tab')
					close(m, false);
				else
					return;

				if (ev.key !== 'Tab')
					ev.preventDefault();
			});
		});

		document.addEventListener('click', (ev) => menus.forEach((m) => {
			if (!m.contains(ev.target))
				close(m, false);
		}));

		reflect();
	},
});
