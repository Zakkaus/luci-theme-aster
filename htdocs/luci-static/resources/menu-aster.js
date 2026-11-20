'use strict';
'require baseclass';
'require ui';
'require theme-aster';
'require progressbar-aster';

/* The menu tree, its ACL filtering and its ordering all come from luci-base:
 * ui.menu.load() fetches it, ui.menu.getChildren() drops what this session may
 * not see and sorts the rest. Walking the tree directly would render entries
 * the reader is not allowed to open.
 *
 * The shape is Astryx's SideNav as the reference page draws it: a group row
 * per top-level entry (icon, label, chevron) and its pages under it, indented
 * to the label and without icons of their own; a top-level page with no
 * children (Logout) is a row with an icon. Rendered as .nav-group /
 * .nav-label / .nav-item, styled by shell.css.
 *
 * State lives on attributes: data-active, aria-current, aria-expanded,
 * data-collapsed. Nothing here adds a styling class.
 */

/* Heroicons 2.2.0 outline, MIT — https://github.com/tailwindlabs/heroicons
 * Each entry is the path data of the icon in @heroicons/react/24/outline,
 * copied verbatim; the stroke width 1.5 is the set's own. The licence is in
 * LICENSES/heroicons-MIT.txt. */
const HEROICONS = {
	ChartBarSquare: 'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z',
	CpuChip: 'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z',
	Squares2X2: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
	GlobeAlt: 'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
	ShieldCheck: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
	CircleStack: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
	ArrowRightStartOnRectangle: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
	ChevronDown: 'm19.5 8.25-7.5 7.5-7.5-7.5',
};

/* Top-level LuCI path segment -> icon, as the reference's luci:* keys. A
 * group that is not here (a third-party package's own top-level entry) gets
 * the services grid. */
const ICON_FOR = {
	status: 'ChartBarSquare',
	system: 'CpuChip',
	services: 'Squares2X2',
	network: 'GlobeAlt',
	vpn: 'ShieldCheck',
	nas: 'CircleStack',
	storage: 'CircleStack',
	logout: 'ArrowRightStartOnRectangle',
};

/* Built through innerHTML rather than E(). LuCI's element factory calls
 * document.createElement, so an <svg> it creates is an HTML element with an
 * svg tag name, not an element in the SVG namespace, and draws nothing.
 * innerHTML runs the HTML parser, which puts it in the right namespace. The
 * markup is a constant from the table above, never anything a request
 * carried. */
function icon(name, cls) {
	const host = E('span', { 'class': cls || 'ico-host', 'aria-hidden': 'true' });

	host.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" ' +
		'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
		'stroke-linejoin="round"><path d="' + HEROICONS[name] + '"/></svg>';

	return host;
}

const groupIcon = (segment) => icon(ICON_FOR[segment] ?? 'Squares2X2');

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));
		this.bindSidebarToggle();
	},

	render(tree) {
		this.renderModeMenu(tree);

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

	/* aria-label carries the name when the rail hides the text. It is set
	 * unconditionally rather than only in the rail: the attribute changes
	 * nothing while the label is visible, and adding it on a media query would
	 * mean the accessible name of a link depended on the window width.
	 * Only a top-level page carries an icon; a page under a group is indented
	 * to the group's label instead. */
	item(url, name, title, active, topLevel) {
		const a = E('a', { 'class': 'nav-item', 'href': L.url(url, name),
			'aria-label': _(title)
		}, [
			topLevel ? groupIcon(name) : '',
			E('span', {}, [ _(title) ]),
		]);

		if (active) {
			a.setAttribute('data-active', '');
			a.setAttribute('aria-current', 'page');
		}

		return a;
	},

	renderMainMenu(tree, base) {
		const host = document.querySelector('#mainmenu');
		const groups = ui.menu.getChildren(tree);

		if (!host)
			return;

		groups.forEach((group) => {
			const children = ui.menu.getChildren(group);
			const isCurrentGroup = (L.env.dispatchpath[1] === group.name);

			/* A top-level entry with no children of its own is a page, not a
			 * group, so it renders as one item rather than as a heading with
			 * nothing under it. */
			if (children.length === 0) {
				host.appendChild(E('div', { 'class': 'nav-group' }, [
					this.item(base, group.name, group.title, isCurrentGroup, true),
				]));

				return;
			}

			const items = children.map((child) => this.item(
				base + '/' + group.name,
				child.name,
				child.title,
				isCurrentGroup && L.env.dispatchpath[2] === child.name,
				false
			));

			/* Collapsed unless it holds the current page. Four groups with
			 * twenty-five items measured 1368px of nav against a 900px
			 * viewport on a GL-BE9300, and seven groups with fifty-nine items
			 * measured 3196px on a box with services installed — at that
			 * length every entry is at the same volume and the eye has nowhere
			 * to land. material (menu-material.js:47) and openwrt-2020
			 * (menu-openwrt2020.js:35) both keep one group open for the same
			 * reason. The state is an attribute on the group rather than
			 * `hidden` on each item so the rail, which hides the labels and
			 * therefore offers no way to expand, can ignore it in CSS. */
			const label = E('div', {
				'class': 'nav-label',
				'role': 'button',
				'tabindex': '0',
				'aria-expanded': isCurrentGroup ? 'true' : 'false',
				'aria-label': _(group.title),
			}, [
				groupIcon(group.name),
				E('span', {}, [ _(group.title) ]),
				icon('ChevronDown', 'ico-host chevron'),
			]);

			/* A div with a role rather than a real button: a <button> would
			 * pick up the component layer's button look. The role and tabindex
			 * keep it operable from the keyboard. */
			label.addEventListener('click', () => this.toggleGroup(label));
			label.addEventListener('keydown', (ev) => {
				if (ev.key !== 'Enter' && ev.key !== ' ')
					return;

				ev.preventDefault();
				this.toggleGroup(label);
			});

			host.appendChild(E('div', {
				'class': 'nav-group',
				'data-collapsed': isCurrentGroup ? null : '',
			}, [ label, ...items ]));
		});
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

	/* The mode row only earns its place when there is more than one mode,
	 * which on a stock install there is not. */
	renderModeMenu(tree) {
		const ul = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);

		if (!ul)
			return;

		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length
				? child.name === L.env.requestpath[0]
				: index === 0;
			/* The text goes in a span so the rail can hide it the same way it
			 * hides every other label, and the accessible name is on the link
			 * so hiding it takes nothing away. A bare text node cannot be
			 * selected by CSS — that is recorded in findings.md — so without
			 * the wrapper this one menu would have stayed spelled out in a
			 * 60px rail. */
			const a = E('a', {
				'class': 'nav-item',
				'href': L.url(child.name),
				'aria-label': _(child.title)
			}, [ E('span', {}, [ _(child.title) ]) ]);

			if (isActive) {
				a.setAttribute('data-active', '');
				a.setAttribute('aria-current', 'true');
			}

			ul.appendChild(E('li', {}, a));

			if (isActive)
				this.renderMainMenu(child, child.name);
		});

		if (ul.children.length > 1)
			ul.hidden = false;
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
			const reflect = () => railBtn.setAttribute('aria-expanded',
				root.hasAttribute('data-rail') ? 'false' : 'true');

			this.setRail = (on) => {
				root.toggleAttribute('data-rail', on);
				reflect();

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
