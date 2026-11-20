/**
 * The shell gate: the top bar and the side nav stand still across page
 * loads, and the appearance control works from the keyboard.
 *
 *   node checks/shell.mjs <base url> <password> [--user root]
 *        [--pages a,b,c] [--json <file>] [--out <file>] [--timeout ms]
 *        [--settle ms] [--debug-css <page>=<css>]... [--debug-js <js>]
 *
 * Desktop (1440 x 900), light, the default palette. Rules (a failure's kind):
 *   ssr         every side nav row is laid out and visible at the first frame after
 *               DOMContentLoaded, on a throttled load (the nav is in the
 *               HTML, not built by script);
 *   flash       data-theme, data-palette and the body colour at that first
 *               frame are the ones the page ends with (a stored dark scheme
 *               and a stored palette applied before the first paint);
 *   shift       the top bar, the side nav, the brand, the appearance button
 *               and the nav rows do not move: within a page (first frame vs
 *               settled) and from one page to the next over the --pages,
 *               opened by clicking their side nav links (a row is compared
 *               while every group above it has the same open state), and
 *               no layout-shift entry has a source in the shell;
 *   keep        a group open on one page is still open on the next;
 *   vt          a side nav link runs a view transition (pagereveal), the
 *               top bar and the side nav carry their view-transition names
 *               and the cross-document @view-transition sits in a media
 *               rule that does not match under reduced motion;
 *   appearance  the top bar's and the login page's appearance control, by
 *               keyboard only: Tab reaches the button, Enter opens it with
 *               the checked row focused, arrows move, Enter and Space pick
 *               a scheme and a palette (attributes and storage follow,
 *               focus returns to the button), Escape and Tab close;
 *   rail-tip    in the collapsed rail, hovering a row shows its label in a
 *               tooltip at the row's end side.
 * --debug-css and --debug-js are for the negative tests (checks/tests/
 * shell.sh): the stylesheet is in the page from its first byte, the script
 * runs before the page's own.
 */
import {parseArgs, launch, session, writeOut, die} from './lib/gate.mjs';

const usage = 'usage: node checks/shell.mjs <base url> <password> [--user root] [--pages a,b,c] [--json <file>] [--out <file>] [--timeout ms] [--settle ms] [--debug-css <page>=<css>]... [--debug-js <js>]';
const opt = parseArgs(process.argv.slice(2), {
  flags: {user: 'root', pages: 'admin/status/overview,admin/system/system,admin/network/network', viewports: 'desktop', modes: 'light', json: undefined, out: undefined, timeout: '60000', settle: '1500', 'debug-js': ''},
  repeat: ['debug-css'],
  usage,
});
opt.timeout = +opt.timeout;
opt.settle = +opt.settle;
const pages = opt.pages.split(',').map((s) => s.trim()).filter(Boolean);
if (pages.length < 2) die('--pages needs at least two pages');
const debugCss = opt['debug-css'].map((s) => {
  const i = s.indexOf('=');
  if (i < 1) die(`--debug-css wants <page>=<css>, got ${s}`);
  return {page: s.slice(0, i), css: s.slice(i + 1)};
});
const TOL = 0.5;
const failures = [];
const errors = [];
const lines = [];
const fail = (kind, msg) => { failures.push({kind, msg}); lines.push(`FAIL ${kind}: ${msg}`); };
const note = (msg) => lines.push(`     ${msg}`);

/* Runs in the page before its own scripts: the debug stylesheet and script,
 * the layout-shift log, and window.__shell.sample(), which records the
 * shell's boxes and colours; the first sample is taken at the first frame
 * after DOMContentLoaded. */
function probe([css, js]) {
  const path = location.pathname;
  const mine = css.filter((d) => path.endsWith('/' + d.page));
  if (mine.length) {
    const st = document.createElement('style');
    const add = () => !!document.documentElement && !!document.documentElement.appendChild(st);
    st.textContent = mine.map((d) => d.css).join('\n');
    if (!add()) new MutationObserver((m, o) => { if (add()) o.disconnect(); }).observe(document, {childList: true});
  }
  if (js) (0, eval)(js);
  const shifts = [];
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      const src = (e.sources || []).filter((s) => s.node && s.node.nodeType === 1 && s.node.closest('.shell-header, .shell-aside'));
      if (src.length) shifts.push({value: e.value, nodes: src.map((s) => s.node.className || s.node.tagName)});
    })).observe({type: 'layout-shift', buffered: true});
  } catch (e) { /* no Layout Instability API: the box samples still count */ }
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return (r.width || r.height) ? [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 100) / 100) : null;
  };
  const sample = () => {
    const root = document.documentElement;
    const out = {
      boxes: {
        header: box(document.querySelector('.shell-header')),
        aside: box(document.querySelector('.shell-aside')),
        brand: box(document.querySelector('.shell-header .brand')),
        appearance: box(document.querySelector('.shell-header .palette-menu > button')),
        nav: box(document.querySelector('#mainmenu'))?.slice(0, 3),
      },
      rows: [...document.querySelectorAll('#mainmenu > .nav-group > :first-child')].map((el) => ({
        name: el.parentNode.getAttribute('data-name') || el.getAttribute('aria-label'),
        open: !el.parentNode.hasAttribute('data-collapsed'),
        box: (el.checkVisibility?.({visibilityProperty: true, opacityProperty: true}) ?? true) ? box(el) : null,
      })),
      theme: root.getAttribute('data-theme'),
      palette: root.getAttribute('data-palette'),
      bg: document.body ? getComputedStyle(document.body).backgroundColor : null,
    };
    return out;
  };
  window.__shell = {shifts, sample, first: null, navAt: null, vt: null};
  addEventListener('pagereveal', (e) => { window.__shell.vt = !!e.viewTransition; });
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => { window.__shell.first = sample(); }));
  const seen = () => {
    if (document.querySelector('#mainmenu .nav-item')) window.__shell.navAt = Math.round(performance.now());
    else requestAnimationFrame(seen);
  };
  requestAnimationFrame(seen);
}

const delta = (a, b) => (a && b ? Math.max(...a.map((v, i) => Math.abs(v - b[i]))) : null);

async function throttle(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: 150, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024});
}

/* luci-app-attendedsysupgrade (25.12) asks on the overview whether to check
 * for upgrades; its Close button dismisses the dialog and saves nothing. */
async function dismiss(page) {
  await page.waitForTimeout(300);
  if (await page.locator('#modal_overlay .modal').isVisible().catch(() => false)) {
    const close = page.locator('#modal_overlay .modal :is(button, .btn)', {hasText: /^\s*(Close|Dismiss)\s*$/});
    await ((await close.count()) ? close.first() : page.locator('#modal_overlay .modal :is(button, .btn)').last()).click();
    await page.waitForTimeout(500);
  }
}

async function settled(page) {
  await page.waitForLoadState('load', {timeout: opt.timeout});
  await page.waitForFunction(() => window.__shell && window.__shell.first && document.querySelector('#mainmenu .nav-item'), null, {timeout: opt.timeout});
  await page.waitForTimeout(opt.settle);
  await dismiss(page);
  return page.evaluate(() => ({first: window.__shell.first, last: window.__shell.sample(), shifts: window.__shell.shifts, navAt: window.__shell.navAt, vt: window.__shell.vt,
    fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1)}));
}

/* ssr, flash, shift, keep: open the pages one after the other through the side nav. */
async function walk(browser) {
  const ctx = await session(browser, opt, 'desktop', 'light');
  await ctx.addInitScript(() => { try { localStorage.setItem('aster-theme', 'dark'); localStorage.setItem('aster-palette', 'teal'); } catch (e) {} });
  await ctx.addInitScript(probe, [debugCss, opt['debug-js']]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${String(e.message).split('\n')[0]}`));
  await throttle(page);
  const runs = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (i === 0) {
      const r = await page.goto(opt.base + p, {waitUntil: 'commit', timeout: opt.timeout});
      if (!r || r.status() !== 200) { errors.push(`${p}: HTTP ${r?.status()}`); break; }
    } else {
      const link = page.locator(`#mainmenu a.nav-item[href$="/${p}"]`).first();
      if (!(await link.count())) { errors.push(`${p}: no side nav link`); break; }
      if (!(await link.isVisible())) await link.locator('xpath=ancestor::div[contains(@class,"nav-group")]/div[contains(@class,"nav-label")]').click();
      await Promise.all([page.waitForURL((u) => u.pathname.endsWith('/' + p), {timeout: opt.timeout}), link.click()]);
    }
    const s = await settled(page);
    s.page = p;
    runs.push(s);
    const late = s.last.rows.filter((r, j) => r.box && !s.first.rows[j]?.box);
    if (!s.first.rows.length || late.length) fail('ssr', `${p}: ${s.first.rows.filter((r) => r.box).length} of ${s.last.rows.length} nav rows laid out at the first frame`);
    for (const k of ['theme', 'palette', 'bg'])
      if (s.first[k] !== s.last[k]) fail('flash', `${p}: ${k} ${s.first[k]} at the first frame, ${s.last[k]} settled`);
    let within = 0;
    for (const [k, b] of Object.entries(s.last.boxes)) { const d = delta(s.first.boxes[k], b); if (d !== null) within = Math.max(within, d); }
    s.last.rows.forEach((r, j) => { const d = delta(s.first.rows[j]?.box, r.box); if (d !== null) within = Math.max(within, d); });
    if (within > TOL) fail('shift', `${p}: the shell moved ${within}px between the first frame and settled`);
    if (i > 0 && s.vt !== true) fail('vt', `${p}: the link from ${pages[i - 1]} ran no view transition`);
    const cls = s.shifts.reduce((a, e) => a + e.value, 0);
    if (s.shifts.length) fail('shift', `${p}: layout shift ${cls.toFixed(4)} from ${[...new Set(s.shifts.flatMap((e) => e.nodes))].join(', ')}`);
    note(`${p}: within-page shell move ${within}px, shell layout shift ${cls.toFixed(4)}, rows at first frame ${s.first.rows.filter((r) => r.box).length}/${s.last.rows.length}, nav at ${s.navAt} ms, first contentful paint ${s.fcp} ms, view transition ${s.vt}`);
  }
  for (let i = 1; i < runs.length; i++) {
    const a = runs[0].last, b = runs[i].last;
    let across = 0;
    const moved = [];
    for (const [k, v] of Object.entries(b.boxes)) {
      const d = delta(a.boxes[k], v);
      if (d !== null && d > across) across = d;
      if (d > TOL) moved.push(k);
    }
    for (let j = 0; j < Math.min(a.rows.length, b.rows.length); j++) {
      if (a.rows[j].name !== b.rows[j].name) break;
      const d = delta(a.rows[j].box, b.rows[j].box);
      if (d !== null && d > across) across = d;
      if (d > TOL) moved.push(`row ${a.rows[j].name}`);
      if (a.rows[j].open !== b.rows[j].open) break;
    }
    if (moved.length) fail('shift', `${runs[i].page}: ${moved.join(', ')} moved up to ${across}px from ${runs[0].page}`);
    note(`${runs[0].page} -> ${runs[i].page}: shell move ${across}px`);
    const prev = runs[i - 1].last.rows.filter((r) => r.open).map((r) => r.name);
    const gone = prev.filter((n) => !runs[i].last.rows.some((r) => r.name === n && r.open));
    if (gone.length) fail('keep', `${runs[i].page}: ${gone.join(', ')} open on ${runs[i - 1].page}, closed here`);
  }
  await ctx.close();
}

/* vt: the names, and the @view-transition rule's media under both motion settings. */
async function transitions(browser) {
  for (const motion of ['no-preference', 'reduce']) {
    const ctx = await session(browser, opt, 'desktop', 'light');
    await ctx.addInitScript(probe, [debugCss, '']);
    const page = await ctx.newPage();
    await page.emulateMedia({reducedMotion: motion});
    await page.goto(opt.base + pages[0], {waitUntil: 'load', timeout: opt.timeout});
    const r = await page.evaluate(() => {
      let on = false, found = false;
      const scan = (rules) => [...rules].forEach((x) => {
        if (x.constructor.name === 'CSSViewTransitionRule') {
          found = true;
          let up = x.parentRule, ok = x.navigation === 'auto';
          while (up) { if (up.media && !matchMedia(up.media.mediaText).matches) ok = false; up = up.parentRule; }
          on = on || ok;
        } else if (x.cssRules) scan(x.cssRules);
      });
      for (const sh of document.styleSheets) { try { scan(sh.cssRules); } catch (e) {} }
      const name = (s) => { const el = document.querySelector(s); return el && getComputedStyle(el).viewTransitionName; };
      return {found, on, top: name('.shell-header'), side: name('.shell-aside')};
    });
    if (r.top !== 'aster-top' || r.side !== 'aster-side') fail('vt', `view-transition-name ${r.top} / ${r.side}, want aster-top / aster-side`);
    if (motion === 'no-preference' && !r.on) fail('vt', `no @view-transition { navigation: auto } in force${r.found ? '' : ' (none found)'}`);
    if (motion === 'reduce' && r.on) fail('vt', 'the cross-document view transition is on under reduced motion');
    await ctx.close();
  }
}

/* appearance: the control in `scope`, keyboard only. */
async function keyboard(page, scope, where) {
  const sel = `${scope} .palette-menu`;
  const btn = page.locator(`${sel} > button`);
  const state = () => page.evaluate((s) => {
    const m = document.querySelector(s);
    const a = document.activeElement;
    let store = {};
    try { store = {theme: localStorage.getItem('aster-theme'), palette: localStorage.getItem('aster-palette')}; } catch (e) {}
    return {
      open: !!m && !m.querySelector('[role="menu"]').hidden && getComputedStyle(m.querySelector('[role="menu"]')).display !== 'none' && m.querySelector('[role="menu"]').getBoundingClientRect().height > 0,
      expanded: m?.querySelector('button').getAttribute('aria-expanded'),
      onButton: a === m?.querySelector('button'),
      focus: a?.getAttribute('data-value') ?? null,
      scheme: document.documentElement.getAttribute('data-scheme'),
      theme: document.documentElement.getAttribute('data-theme'),
      palette: document.documentElement.getAttribute('data-palette') ?? 'rose-pine',
      store,
    };
  }, sel);
  const want = async (label, test) => {
    const s = await state();
    if (!test(s)) { fail('appearance', `${where}: ${label} (${JSON.stringify(s)})`); return false; }
    return true;
  };
  if (!(await btn.count())) { fail('appearance', `${where}: no appearance button`); return; }
  await page.evaluate(() => document.activeElement?.blur());
  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = (await state()).onButton;
  }
  if (!reached) { fail('appearance', `${where}: Tab never reached the button`); return; }
  await page.keyboard.press('Enter');
  if (!(await want('Enter opens the menu on the checked scheme', (s) => s.open && s.expanded === 'true' && s.focus === 'auto'))) return;
  await page.keyboard.press('ArrowDown');
  if (!(await want('ArrowDown moves to Light', (s) => s.focus === 'light'))) return;
  await page.keyboard.press('Enter');
  if (!(await want('Enter picks Light, closes and refocuses', (s) => !s.open && s.onButton && s.scheme === 'light' && s.theme === 'light' && s.store.theme === 'light'))) return;
  await page.keyboard.press('Space');
  if (!(await want('Space opens on Light', (s) => s.open && s.focus === 'light'))) return;
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');
  if (!(await want('End, ArrowUp reach the next-to-last palette', (s) => s.focus === 'teal'))) return;
  await page.keyboard.press(' ');
  if (!(await want('Space picks the palette, closes and refocuses', (s) => !s.open && s.onButton && s.palette === 'teal' && s.store.palette === 'teal'))) return;
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  if (!(await want('Escape closes and refocuses', (s) => !s.open && s.expanded === 'false' && s.onButton))) return;
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await want('Tab closes', (s) => !s.open && s.expanded === 'false');
}

async function appearance(browser) {
  const ctx = await session(browser, opt, 'desktop', 'light');
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('shell-gate')) { localStorage.setItem('aster-theme', 'auto'); localStorage.setItem('aster-palette', 'rose-pine'); sessionStorage.setItem('shell-gate', '1'); } } catch (e) {} });
  await ctx.addInitScript(probe, [debugCss, '']);
  const page = await ctx.newPage();
  await page.emulateMedia({colorScheme: 'light'});
  await page.goto(opt.base + pages[0], {waitUntil: 'load', timeout: opt.timeout});
  await page.waitForTimeout(opt.settle);
  await dismiss(page);
  await keyboard(page, '.shell-header', 'top bar');
  await ctx.close();
  // The login page: a context with no session.
  const anon = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, colorScheme: 'light'});
  await anon.addInitScript(() => { try { if (!sessionStorage.getItem('shell-gate')) { localStorage.setItem('aster-theme', 'auto'); localStorage.setItem('aster-palette', 'rose-pine'); sessionStorage.setItem('shell-gate', '1'); } } catch (e) {} });
  await anon.addInitScript(probe, [debugCss, '']);
  const login = await anon.newPage();
  await login.goto(opt.base, {waitUntil: 'load', timeout: opt.timeout});
  await login.waitForTimeout(opt.settle);
  await keyboard(login, '.login-controls', 'login page');
  await anon.close();
}

/* rail-tip: hover the first group row of the collapsed rail. */
async function railTip(browser) {
  const ctx = await session(browser, opt, 'desktop', 'light');
  await ctx.addInitScript(() => { try { localStorage.setItem('aster-rail', '1'); } catch (e) {} });
  await ctx.addInitScript(probe, [debugCss, '']);
  const page = await ctx.newPage();
  await page.goto(opt.base + pages[0], {waitUntil: 'load', timeout: opt.timeout});
  await page.waitForTimeout(opt.settle);
  await dismiss(page);
  const row = page.locator('#mainmenu > .nav-group > :first-child').first();
  // The rail's tooltips are menu-aster.js's: wait for it, then point.
  await page.waitForSelector('#mainmenu > .nav-group > [data-tooltip]', {state: 'attached', timeout: opt.timeout}).catch(() => {});
  await page.evaluate(() => {
    window.__tips = [];
    for (const t of ['tooltip-open', 'tooltip-close', 'mouseover', 'mouseout']) document.addEventListener(t, (e) => window.__tips.push(`${Math.round(performance.now())} ${t}`), true);
  });
  await row.hover({force: true});
  await page.waitForFunction(() => {
    const t = document.querySelector('body > .cbi-tooltip');
    return t && +getComputedStyle(t).opacity === 1 && t.textContent.trim();
  }, null, {timeout: 3000}).catch(() => {});
  const r = await page.evaluate(() => {
    const el = document.querySelector('#mainmenu > .nav-group > :first-child');
    const tip = document.querySelector('body > .cbi-tooltip');
    const a = el.getBoundingClientRect();
    const t = tip && tip.getBoundingClientRect();
    const shown = !!tip && getComputedStyle(tip).display !== 'none' && +getComputedStyle(tip).opacity > 0 && t.width > 0;
    return {label: el.getAttribute('aria-label'), text: tip?.textContent.trim() ?? null, shown, right: a.right, left: t?.left ?? null, has: el.getAttribute('data-tooltip'), style: tip?.getAttribute('style'), log: window.__tips.join(', '),
      mid: a.top + a.height / 2, tipMid: t ? t.top + t.height / 2 : null};
  });
  if (!r.shown || r.text !== r.label) fail('rail-tip', `hovering the rail's first row shows ${r.shown ? `"${r.text}"` : 'no tooltip'}, want "${r.label}" (data-tooltip ${r.has}, tip style ${r.style}, events ${r.log})`);
  else if (r.left < r.right || Math.abs(r.mid - r.tipMid) > 1) fail('rail-tip', `the tooltip is not at the row's end side (row right ${r.right}, tip left ${r.left}, centres ${r.mid}/${r.tipMid})`);
  await ctx.close();
}

const browser = await launch();
try {
  for (const [name, fn] of [['walk', walk], ['transitions', transitions], ['appearance', appearance], ['rail', railTip]]) {
    try { await fn(browser); } catch (e) { errors.push(`${name}: ${String(e.message).split('\n')[0]}`); }
  }
} finally {
  await browser.close();
}
for (const e of errors) lines.push(`ERROR ${e}`);
const result = failures.length || errors.length ? 'FAIL' : 'PASS';
lines.push(`RESULT ${result} (${failures.length} failure(s), ${errors.length} error(s))`);
const text = lines.join('\n') + '\n';
process.stdout.write(text);
writeOut(opt.out, text);
writeOut(opt.json, JSON.stringify({gate: 'shell', pages, errors, failures, waived: []}, null, 2));
process.exit(result === 'PASS' ? 0 : 1);
