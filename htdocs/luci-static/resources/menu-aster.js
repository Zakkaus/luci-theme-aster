'use strict';
'require baseclass';
'require ui';
'require theme-aster';
'require progressbar-aster';

/* The side nav and the mode row are in the page already: header.ut renders
 * them from the same menu tree, so they are part of the first paint and stand
 * still from one page to the next. This module adds their behaviour (a group
 * opens and closes, the rail, the phone drawer, the rail's tooltips), turns
 * luci-base's top bar indicators into IconButtons, and builds the tab row,
 * which lives in the content.
 *
 * State lives on attributes: data-active, aria-current, aria-expanded,
 * data-collapsed. Nothing here adds a styling class.
 */

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));
		this.bindSidebarToggle();
		this.bindGroups();
		this.indicators();
	},

	render(tree) {
		/* LuCI's own path shape: mode / category / page, and anything below
		 * that is a tab. The 3 is that fixed shape, not an arbitrary depth —
		 * the tab menu starts where the sidebar stops. */
		const TAB_DEPTH = 3;
		let node = tree;
		let url = '';

		if (L.env.dispatchpath.length >= TAB_DEPTH) {
			for (let i = 0; i < TAB_DEPTH && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}
	},

	/* The group rows header.ut rendered. A div with a role rather than a
	 * real button: a <button> would pick up the component layer's button
	 * look; the role and tabindex keep it operable from the keyboard. */
	bindGroups() {
		document.querySelectorAll('#mainmenu .nav-label').forEach((label) => {
			label.addEventListener('click', () => this.toggleGroup(label));
			label.addEventListener('keydown', (ev) => {
				if (ev.key !== 'Enter' && ev.key !== ' ')
					return;

				ev.preventDefault();
				this.toggleGroup(label);
			});
		});
	},

	/* luci-base's indicators ("Refreshing", "Unsaved Changes: 7"), which
	 * ui.js writes as bare spans with a click handler, as the top bar's
	 * IconButtons (shell.css): a button role, a focus stop, Enter and Space,
	 * the words as the name and the tooltip, the change count as data-count.
	 * ui.js rewrites the words in place, so this follows them. */
	indicators() {
		const host = document.querySelector('#indicators');

		if (!host)
			return;

		const sync = () => host.querySelectorAll(':scope > span[data-indicator]').forEach((s) => {
			const words = s.textContent.trim();
			const n = /(\d+)\s*$/.exec(words);

			s.setAttribute('role', 'button');
			s.setAttribute('tabindex', '0');
			s.setAttribute('aria-label', words);
			s.setAttribute('data-tooltip', words);

			if (n)
				s.setAttribute('data-count', n[1]);
			else
				s.removeAttribute('data-count');
		});

		host.addEventListener('keydown', (ev) => {
			if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-indicator]')) {
				ev.preventDefault();
				ev.target.click();
			}
		});

		new MutationObserver(sync).observe(host, { childList: true, subtree: true, characterData: true });
		sync();
	},

	/* Each group opens and closes on its own. material (menu-material.js:47)
	 * and openwrt-2020 (menu-openwrt2020.js:35) close the others so the nav is
	 * always one screen, but that also takes away the arrangement someone set
	 * up — two groups they move between — and puts it back on every click.
	 * Opening what you need is the reader's call; the group holding the current
	 * page is open to begin with so the common case costs nothing. */
	toggleGroup(label) {
		const group = label.parentNode;
		/* In the rail a group has no room to open, so its row widens the side
		 * nav again and opens the group there. */
		const rail = document.documentElement.hasAttribute('data-rail') &&
			window.matchMedia('(min-width: 48.0625rem)').matches;
		const opening = rail || group.hasAttribute('data-collapsed');

		if (rail)
			this.setRail?.(false);

		group.toggleAttribute('data-collapsed', !opening);
		label.setAttribute('aria-expanded', opening ? 'true' : 'false');
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const children = ui.menu.getChildren(tree);
		const depth = level || 0;

		if (!container || children.length === 0)
			return;

		const ul = E('ul', { 'class': 'tabs' });
		let activeNode = null;

		children.forEach((child) => {
			const isActive = (L.env.dispatchpath[3 + depth] === child.name);
			const a = E('a', { 'class': 'tab', 'href': L.url(url, child.name) }, [ _(child.title) ]);

			if (isActive) {
				a.setAttribute('data-active', '');
				a.setAttribute('aria-current', 'page');
				activeNode = child;
			}

			ul.appendChild(E('li', {}, a));
		});

		container.appendChild(ul);
		container.hidden = false;

		if (activeNode)
			this.renderTabMenu(activeNode, url + '/' + activeNode.name, depth + 1);

		if (!depth)
			this.placeTabMenu(container);
	},

	/* One page header everywhere (Astryx PageHeader): the title, its
	 * description, then the tabs. The tab row is rendered before the view,
	 * whose title the view writes later; once it is there the row moves
	 * under it (and its description), and back if a re-render drops it. */
	placeTabMenu(tabs) {
		const view = document.querySelector('#view');

		if (!view)
			return;

		const place = () => {
			const title = view.querySelector('h2:not(.cbi-section *, .cbi-tabmenu *)');

			if (!title || title.closest('#modal_overlay'))
				return;

			const after = title.nextElementSibling?.matches('.cbi-map-descr') ? title.nextElementSibling : title;

			if (after.nextElementSibling !== tabs)
				after.after(tabs);
		};

		place();
		new MutationObserver(place).observe(view, { childList: true, subtree: true });
	},

	/* Two controls for two layouts. On a phone the side nav is a drawer over
	 * the page: #sidebar-toggle in the top bar owns its state, which the
	 * stylesheet reads off aria-expanded, and #sidebar-close, Escape, a link
	 * or a click outside close it. On a wide screen the side nav collapses to
	 * a rail of group icons with #rail-toggle at its foot; that state belongs
	 * on the document and is remembered, because someone who narrowed the
	 * navigation to read a wide table wants it still narrow on the next page.
	 * Escape does not undo the rail: it is a saved preference, not a mode
	 * anyone is stuck in. */
	bindSidebarToggle() {
		const btn = document.querySelector('#sidebar-toggle');
		const close = document.querySelector('#sidebar-close');
		const railBtn = document.querySelector('#rail-toggle');
		const root = document.documentElement;
		const wide = window.matchMedia('(min-width: 48.0625rem)');

		if (railBtn) {
			/* The rail hides the labels, so each of its rows names itself in a
			 * tooltip on hover and focus, at the rail's end side
			 * (theme-aster.js); a wide side nav shows the words and no tip. */
			const reflect = () => {
				const rail = root.hasAttribute('data-rail') && wide.matches;

				railBtn.setAttribute('aria-expanded', root.hasAttribute('data-rail') ? 'false' : 'true');
				document.querySelectorAll('#mainmenu > .nav-group > :is(.nav-label, .nav-item:only-child)').forEach((el) => {
					if (rail)
						el.setAttribute('data-tooltip', el.getAttribute('aria-label'));
					else
						el.removeAttribute('data-tooltip');
				});
			};

			wide.addEventListener('change', reflect);

			this.setRail = (on) => {
				root.toggleAttribute('data-rail', on);
				reflect();
				ui.hideTooltip({});

				try { localStorage.setItem('aster-rail', on ? '1' : '0'); }
				catch (e) { /* private window: the choice lasts this page only */ }
			};

			reflect();
			railBtn.addEventListener('click', () => this.setRail(!root.hasAttribute('data-rail')));
		}

		if (!btn)
			return;

		const set = (open) => btn.setAttribute('aria-expanded', open ? 'true' : 'false');

		/* A drawer left open on a phone must not survive a rotation to a
		 * width where there is no drawer. */
		wide.addEventListener('change', () => set(false));

		btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));

		close?.addEventListener('click', () => {
			set(false);
			btn.focus();
		});

		document.addEventListener('keydown', (ev) => {
			if (ev.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
				set(false);
				btn.focus();
			}
		});

		document.querySelector('#sidebar')?.addEventListener('click', (ev) => {
			if (ev.target.closest('.nav-item'))
				set(false);
		});

		/* The scrim is a ::after on the body, which cannot receive a click.
		 * Anything outside the drawer closes it; the toggle is excluded because
		 * its own handler already flips the state. */
		document.addEventListener('click', (ev) => {
			if (wide.matches || btn.getAttribute('aria-expanded') !== 'true')
				return;

			if (ev.target.closest('#sidebar') || ev.target.closest('#sidebar-toggle'))
				return;

			set(false);
		});
	}
});
