/**
 * Shared by checks/uniform.mjs and checks/contrast.mjs: the command line, the
 * page list, the login, the page walk, and the helpers both gates run inside
 * the page (visibility, a short element path, colour parsing, compositing).
 *
 * Nothing here writes to the device. The login is the ordinary form POST;
 * light and dark, and the palette (--palette; each gate sets its default),
 * are chosen
 * through the theme's browser settings (localStorage "aster-theme" and
 * "aster-palette"), as a reader chooses them; the only clicks
 * are the Edit button that opens an interface dialog and the Close button of
 * a dialog luci-app-attendedsysupgrade opens on its own; ui.js's status
 * dialogs are opened in the page, without a request. Nothing is saved.
 *
 * Playwright is not a dependency of this repository. PLAYWRIGHT points at its
 * index.mjs (default: the bare specifier "playwright"); CHROME_PATH, when set,
 * picks the browser binary.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const CHECKS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/* The palette a page shows with no data-palette (design/palettes.mjs). */
export const DEFAULT_PALETTE = 'rose-pine';
export const VIEWPORTS = {desktop: {width: 1440, height: 900}, phone: {width: 390, height: 844}};

/* Flags take one value each; repeatable flags collect into an array. */
export function parseArgs(argv, {flags, repeat = [], usage}) {
  const args = [...argv];
  const out = {};
  for (const f of repeat) out[f] = [];
  const pos = [];
  while (args.length) {
    const a = args.shift();
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const name = a.slice(2);
    if (!(name in flags) && !repeat.includes(name)) die(`unknown option ${a}\n${usage}`);
    if (!args.length) die(`${a} needs a value\n${usage}`);
    const v = args.shift();
    if (repeat.includes(name)) out[name].push(v); else out[name] = v;
  }
  for (const [k, v] of Object.entries(flags)) if (out[k] === undefined) out[k] = v;
  if (pos.length !== 2) die(usage);
  out.base = `${pos[0].replace(/\/+$/, '')}/cgi-bin/luci/`;
  out.url = pos[0];
  out.password = pos[1];
  out.devices = out.viewports.split(',').map((s) => s.trim()).filter(Boolean);
  out.modes = out.modes.split(',').map((s) => s.trim()).filter(Boolean);
  for (const d of out.devices) if (!VIEWPORTS[d]) die(`--viewports: unknown ${d} (desktop, phone)`);
  for (const m of out.modes) if (m !== 'light' && m !== 'dark') die(`--modes: unknown ${m} (light, dark)`);
  if (out.palette !== undefined && !/^[a-z][a-z-]*$/.test(out.palette)) die(`--palette: not a palette slug: ${out.palette}`);
  return out;
}

export function die(msg) {
  console.error(msg);
  process.exit(1);
}

/* One entry a line:  <path> [modal=<name>] [tab=<name>] [fixture=<name>] [require=<class>,<class>...]
 * A class in require= must have at least one sample on that page at every
 * viewport and mode. `<class>@desktop` asks for it on the desktop only;
 * `<class>@rows` on the desktop, and at any other viewport whenever the
 * page's tables hold a data row (an empty table folds to its caption on a
 * phone). A class name matches itself and its dotted children ("button"
 * matches "button.primary.md"). An entry a later file lists again (same
 * path and modal) adds its require= classes to the first one: the 25.12
 * list asks for what only 25.12 draws on a page both versions have.
 * tab= selects a tab of the page's first tab group with that data-tab name
 * (a Lua CBI page's tabs, a JS view's tabs) before measuring; tab=a/b then
 * selects b in the tab group shown inside a (DHCP's nested tabs). The entry
 * is its own page ("<path> #<tab>"). fixture= adds markup LuCI writes on
 * pages the lab boxes lack (FIXTURES); the entry is its own page
 * ("<path> +<fixture>"). */
const QUALIFIERS = ['desktop', 'rows'];
export function readPages(files) {
  const pages = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((raw, i) => {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) return;
      const [p, ...rest] = line.split(/\s+/);
      const e = {path: p.replace(/^\/+/, ''), modal: null, tab: null, fixture: null, require: [], src: `${path.basename(file)}:${i + 1}`};
      for (const r of rest) {
        const [k, v] = r.split('=');
        if (k === 'modal') e.modal = v;
        else if (k === 'tab') e.tab = v;
        else if (k === 'fixture') e.fixture = v;
        else if (k === 'require') e.require = v.split(',').filter(Boolean);
        else die(`${e.src}: unknown field ${r}`);
      }
      if (e.modal && !MODALS[e.modal]) die(`${e.src}: unknown modal ${e.modal}`);
      if (e.fixture && !FIXTURES[e.fixture]) die(`${e.src}: unknown fixture ${e.fixture}`);
      for (const req of e.require) {
        const q = req.split('@')[1];
        if (q !== undefined && !QUALIFIERS.includes(q)) die(`${e.src}: unknown qualifier @${q} (${QUALIFIERS.join(', ')})`);
      }
      e.id = (e.modal ? `${e.path} [${e.modal}]` : e.path) + (e.tab ? ` #${e.tab}` : '') + (e.fixture ? ` +${e.fixture}` : '');
      const first = pages.find((x) => x.id === e.id);
      if (first) first.require.push(...e.require.filter((r) => !first.require.includes(r)));
      else pages.push(e);
    });
  }
  if (!pages.length) die('the page list is empty');
  return pages;
}

export const classMatches = (want, cls) => cls === want || cls.startsWith(`${want}.`);

/* --debug-css <page id or path>=<css>: a stylesheet added to that page after
 * it renders. For the negative tests only. */
export function parseDebugCss(list) {
  return list.map((s) => {
    const i = s.indexOf('=');
    if (i < 1) die(`--debug-css wants <page>=<css>, got ${s}`);
    return {page: s.slice(0, i), css: s.slice(i + 1)};
  });
}

/* Dialogs the page list can open. Each returns a description of what it
 * opened, or throws. */
export const MODALS = {
  // Network > Interfaces: the first interface row's Edit button.
  'interface-edit': async (page, timeout) => {
    const btn = page.locator('.cbi-section-actions .cbi-button-edit, .cbi-section-actions button[title="Edit"]').first();
    await btn.waitFor({state: 'visible', timeout});
    const row = await btn.evaluate((b) => b.closest('[data-section-id]')?.getAttribute('data-section-id') ?? '?');
    await btn.click();
    await page.waitForSelector('#modal_overlay .modal :is(.cbi-section, .cbi-map, .cbi-value)', {state: 'visible', timeout});
    return `edit dialog of interface ${row}`;
  },
  // ui.js's status dialogs (ui.changes.displayStatus), as applying, a revert
  // and a failed revert draw them; opened directly, so nothing is sent.
  'status-spinning': (page, timeout) => status(page, timeout, 'notice spinning', 'Applying configuration changes… 9s'),
  'status-notice': (page, timeout) => status(page, timeout, 'notice', 'Changes have been reverted.'),
  'status-warning': (page, timeout) => status(page, timeout, 'warning', 'Revert request failed with status <code>500</code>'),
};
/* Markup LuCI writes on pages the lab boxes do not have, added to a page
 * with LuCI's own calls so its classes and nesting are the real ones. Each
 * returns a description of what it added, or throws. */
export const FIXTURES = {
  // ui.addNotification's banners (luci-app-nlbw's notice, routesj's error
  // pre, a warning and a success), WireGuard's instance line (luci-proto-wireguard status.js: a
  // chip, then port and key faded by an inline opacity) and inline code
  // in a paragraph.
  notices: async (page, timeout) => {
    await page.waitForFunction(() => window.L && window.E, null, {timeout});
    await page.evaluate(async () => {
      const ui = await L.require('ui');
      (L.ui ?? ui).addNotification(null, E('div', 'The nlbwmon daemon is not running.'));
      (L.ui ?? ui).addNotification(null, E('pre', 'Unable to execute ip: Connection refused'), 'danger');
      (L.ui ?? ui).addNotification(null, E('p', 'Device is running a release candidate.'), 'warning');
      (L.ui ?? ui).addNotification(null, E('p', 'Configuration has been applied.'), 'success');
      document.querySelector('#view').append(
        E('h3', 'Instance "wg0"'),
        E('p', {style: 'cursor:pointer'}, [
          E('span', {class: 'ifacebadge'}, [E('img', {src: L.resource('icons', 'wireguard.svg'), style: 'width:32px;height:32px'}), '\xa0', 'wg0']),
          E('span', {style: 'opacity:.8'}, [' · ', 'Port 51820', ' · ', E('code', {click: ''}, ['bW9kZSBvZiB0aGUgZml4dHVyZSBrZXkgYmFzZTY0PQ=='])]),
        ]),
        E('p', ['Run ', E('code', 'wg show'), ' on the device for the handshakes.']));
    });
    await page.waitForSelector('#maincontent > .alert-message.danger pre', {state: 'visible', timeout});
    return 'notice, error, warning and success banners, a WireGuard instance line, inline code';
  },
};
async function status(page, timeout, type, html) {
  await page.waitForFunction(() => window.L && window.E, null, {timeout});
  await page.evaluate(async ([t, h]) => {
    const ui = await L.require('ui');
    (L.ui ?? ui).changes.displayStatus(t, E('p', h));
  }, [type, html]);
  await page.waitForSelector('#modal_overlay > .alert-message', {state: 'visible', timeout});
  return `${type} status dialog`;
}

export async function launch() {
  const {chromium} = await import(process.env.PLAYWRIGHT ?? 'playwright');
  return chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {});
}

/* A logged-in browser context for one viewport and mode. Throws on a failed
 * login: LuCI answers a good one with 302 and a sysauth cookie. */
export async function session(browser, opt, device, mode) {
  const ctx = await browser.newContext({viewport: VIEWPORTS[device], deviceScaleFactor: 1, colorScheme: mode});
  /* oc_guide_done and oc_guide_autostart keep OpenClash's first-visit tour
   * and hint bubble (guide.js, status.js) from covering its pages. */
  await ctx.addInitScript(([m, p]) => {
    try {
      localStorage.setItem('aster-theme', m); localStorage.setItem('aster-palette', p);
      localStorage.setItem('oc_guide_done', '1'); localStorage.setItem('oc_guide_autostart', '0');
    } catch (e) {}
  }, [mode, opt.palette ?? DEFAULT_PALETTE]);
  const r = await ctx.request.post(opt.base, {form: {luci_username: opt.user, luci_password: opt.password}, maxRedirects: 0});
  const cookie = (await ctx.cookies()).some((c) => c.name.startsWith('sysauth'));
  if (r.status() !== 302 || !cookie) {
    await ctx.close();
    throw new Error(`login returned ${r.status()}${cookie ? '' : ' and no sysauth cookie'}, want 302`);
  }
  return ctx;
}

/* Opens one page-list entry and leaves it ready to measure. Returns
 * {page, note, errors} or {error}. A page that answers anything but 200,
 * says it does not exist, shows a view error, never finishes rendering, or
 * renders without the requested theme is an error. */
export async function openPage(ctx, opt, entry, mode, debugCss) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).split('\n')[0].slice(0, 160)));
  const fail = async (error) => { await page.close(); return {error}; };
  let resp;
  try {
    resp = await page.goto(opt.base + entry.path, {waitUntil: 'load', timeout: opt.timeout});
  } catch (e) {
    return fail(`did not load: ${String(e.message).split('\n')[0]}`);
  }
  if (!resp || resp.status() !== 200) return fail(`HTTP ${resp?.status()}`);
  // A view replaces its "Loading view…" spinner when it renders; the overview
  // is a template whose #view fills with cards.
  const rendered = await page.waitForFunction(() => {
    const v = document.querySelector('#view');
    if (!v) return !!document.querySelector('#maincontent');
    return v.children.length > 0 && !v.querySelector(':scope > .spinning');
  }, null, {timeout: opt.timeout}).then(() => true, () => false);
  if (!rendered) return fail(`did not render within ${opt.timeout} ms`);
  const missing = await page.evaluate(() => {
    const main = document.querySelector('#maincontent') ?? document.body;
    const head = main.innerText.slice(0, 3000);
    if (/No page is registered at|Page not found/i.test(head)) return head.split('\n').find((l) => /registered|not found/i.test(l));
    const err = document.querySelector('#view > .alert-message.error, #view > .alert-message.danger');
    if (err && /Failed to execute|Unable to|TypeError|ReferenceError|error/i.test(err.innerText)) return err.innerText.split('\n').slice(0, 2).join(' ');
    return null;
  });
  if (missing) return fail(`page error: ${missing.slice(0, 200)}`);
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme !== mode) return fail(`data-theme is ${theme}, want ${mode} (theme not installed or not selected?)`);
  // Rosé Pine, the theme's default palette, is the absence of the attribute.
  const palette = await page.evaluate((d) => document.documentElement.getAttribute('data-palette') ?? d, DEFAULT_PALETTE);
  if (palette !== (opt.palette ?? DEFAULT_PALETTE)) return fail(`data-palette is ${palette}, want ${opt.palette} (unknown palette, or a theme without palettes?)`);
  await page.waitForTimeout(opt.settle);
  // luci-app-attendedsysupgrade (25.12) asks on the overview whether to check
  // for upgrades. Its Close button dismisses the dialog and saves nothing.
  if (await page.locator('#modal_overlay .modal').isVisible().catch(() => false)) {
    const close = page.locator('#modal_overlay .modal :is(button, .btn)', {hasText: /^\s*(Close|Dismiss)\s*$/});
    await ((await close.count()) ? close.first() : page.locator('#modal_overlay .modal :is(button, .btn)').last()).click();
    await page.waitForTimeout(500);
  }
  // A test stylesheet changes colours the theme transitions: wait for them.
  const mine = debugCss.filter((d) => d.page === entry.id || d.page === entry.path);
  for (const d of mine) await page.addStyleTag({content: d.css});
  if (mine.length) await page.waitForTimeout(opt.settle);
  let note = '';
  if (entry.modal) {
    try {
      note = await MODALS[entry.modal](page, opt.timeout);
    } catch (e) {
      return fail(`modal ${entry.modal}: ${String(e.message).split('\n')[0]}`);
    }
    await page.waitForTimeout(opt.settle);
  }
  if (entry.fixture) {
    try {
      const added = await FIXTURES[entry.fixture](page, opt.timeout);
      note = note ? `${note}, ${added}` : added;
    } catch (e) {
      return fail(`fixture ${entry.fixture}: ${String(e.message).split('\n')[0]}`);
    }
    await page.waitForTimeout(opt.settle);
  }
  if (entry.tab) {
    // a/b: tab a, then tab b of the group shown inside it (DHCP's nested tabs).
    for (const name of entry.tab.split('/')) {
      const tab = page.locator(`.cbi-tabmenu > li[data-tab="${name}"]:visible`).first();
      try {
        await tab.waitFor({state: 'visible', timeout: opt.timeout});
        await tab.locator('a').first().click();
        await page.waitForFunction((t) => [...document.querySelectorAll(`.cbi-tabmenu > li[data-tab="${t}"]`)].some((l) => l.offsetParent && l.classList.contains('cbi-tab')), name, {timeout: opt.timeout});
      } catch (e) {
        return fail(`tab ${entry.tab}: ${String(e.message).split('\n')[0]}`);
      }
    }
    note = note ? `${note}, tab ${entry.tab}` : `tab ${entry.tab}`;
    await page.waitForTimeout(opt.settle);
  }
  await page.evaluate(installHelpers);
  return {page, note, errors};
}

/* Runs fn(ctx, device, mode) for every viewport and mode the run covers. A
 * failed login is recorded and the run goes on to the next combination. */
export async function eachCombo(opt, fn, onError) {
  const browser = await launch();
  try {
    for (const device of opt.devices) {
      for (const mode of opt.modes) {
        const combo = `${device}-${mode}`;
        let ctx;
        try {
          ctx = await session(browser, opt, device, mode);
        } catch (e) {
          onError(combo, '(login)', e.message);
          continue;
        }
        try { await fn(ctx, device, mode, combo); } finally { await ctx.close(); }
      }
    }
  } finally {
    await browser.close();
  }
}

/* Installed into the page as window.__ag before either gate collects. */
export function installHelpers() {
  if (window.__ag) return;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', {willReadFrequently: true});
  const cache = new Map();
  const num = (s, pct = 1) => (s === 'none' ? 0 : s.endsWith('%') ? (parseFloat(s) / 100) * pct : parseFloat(s));
  const enc = (c) => 255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  const oklab = (L, a, b) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
  };
  /* Any computed colour as [r, g, b, a] with r, g, b in 0..255 (unrounded)
   * and a in 0..1. rgb(), color(srgb), oklch() and oklab() are converted
   * exactly; anything else goes through a canvas, which is 8-bit. */
  const rgba = (str) => {
    if (cache.has(str)) return cache.get(str);
    let v;
    const fn = /^([a-z-]+)\((.*)\)$/.exec(str.trim());
    const parts = fn ? fn[2].replace(/[,/]/g, ' ').trim().split(/\s+/) : [];
    const alpha = (i) => (parts[i] === undefined ? 1 : num(parts[i], 1));
    if (str === 'transparent') v = [0, 0, 0, 0];
    else if (fn && (fn[1] === 'rgb' || fn[1] === 'rgba')) v = [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha(3)];
    else if (fn && fn[1] === 'color' && parts[0] === 'srgb') v = [num(parts[1], 1) * 255, num(parts[2], 1) * 255, num(parts[3], 1) * 255, alpha(4)];
    else if (fn && fn[1] === 'oklch') {
      const L = num(parts[0], 1), C = num(parts[1], 0.4), h = (num(parts[2], 1) * Math.PI) / 180;
      v = [...oklab(L, C * Math.cos(h), C * Math.sin(h)), alpha(3)];
    } else if (fn && fn[1] === 'oklab') v = [...oklab(num(parts[0], 1), num(parts[1], 0.4), num(parts[2], 0.4)), alpha(3)];
    else {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#000';
      cx.fillStyle = str;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      v = [d[0], d[1], d[2], d[3] / 255];
    }
    cache.set(str, v);
    return v;
  };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = (c) => {
    const f = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => `#${c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
  /* The opaque colour behind an element's content: every background colour
   * from the root down to the element itself, composited over white, with
   * each layer's alpha scaled by the opacity above it. Background images and
   * content painted by siblings or pseudo-elements are not seen. Returns the
   * colour and the opacity the element's own content is drawn with. */
  const behind = (el, self = true) => {
    const chain = [];
    for (let e = self ? el : el.parentElement; e; e = e.parentElement) chain.unshift(e);
    let bg = [255, 255, 255, 1];
    let op = 1;
    for (const e of chain) {
      const s = getComputedStyle(e);
      op *= parseFloat(s.opacity);
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) bg = over([c[0], c[1], c[2], c[3] * op], bg);
    }
    return {bg, op};
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.right <= 0 || r.left >= innerWidth) return false;
    if (el.checkVisibility && !el.checkVisibility({opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true})) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  };
  /* A short path for the report: up to four steps, stopping at an id. */
  const where = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e !== document.body && i < 4; i++, e = e.parentElement) {
      let p = e.tagName.toLowerCase();
      if (e.id && !/^(?:widget|cbid)\./.test(e.id)) { parts.unshift(`${p}#${e.id}`); break; }
      const c = [...e.classList].filter((k) => !/^(?:hidden|active)$/.test(k)).slice(0, 2);
      if (c.length) p += `.${c.join('.')}`;
      const n = e.getAttribute('data-name') ?? e.getAttribute('data-section-id') ?? (i === 0 ? e.getAttribute('name') : null);
      if (n) p += `[${n.slice(0, 30)}]`;
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  /* Elements with their own words: a non-blank text node as a child. */
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()).map((n) => n.data.trim()).join(' ');
  window.__ag = {rgba, over, lum, ratio, hex, behind, visible, where, ownText};
}

/* "36px" for a number, the string itself otherwise; arrays joined. */
export const show = (v) => (Array.isArray(v) ? v.map(show).join(' ') : typeof v === 'number' ? `${+v.toFixed(2)}px` : String(v));

export function writeOut(file, text) {
  if (file) fs.writeFileSync(file, text);
}
