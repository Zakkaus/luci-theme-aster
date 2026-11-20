#!/usr/bin/env node
/**
 * Generates htdocs/luci-static/aster/tokens.css from the Astryx theme build.
 *
 *   node scripts/tokens.mjs            write tokens.css
 *   node scripts/tokens.mjs --check    regenerate in memory; exit 1 when it
 *                                      differs from the committed tokens.css
 *
 * Steps:
 *  1. Take the custom properties of the theme's token block
 *     (`@scope ([data-astryx-theme="aster"]) { :scope { ... } }`, outside any
 *     @media) and declare them on :root, so the page needs no
 *     data-astryx-theme attribute and no @scope support. The component and
 *     reset rules of the build target Astryx's React markup and are dropped.
 *  2. Keep the build's `:root { color-scheme }` and `html[data-theme]` rules;
 *     header.ut sets data-theme for the light and dark media paths.
 *  3. Fill every token the output or the stylesheets reference but the theme
 *     does not define from the core defaults (`:root` rules of
 *     @astryxdesign/core/dist/astryx.css), transitively, and only those.
 *  4. Append the theme's AppShell overrides (custom properties the build sets
 *     on .astryx-app-shell) as a rule for pages that carry the shell, then
 *     design/layout.css, the sizes the theme has no token for. Steps 1, 3
 *     and 4 keep only the non-colour tokens; the colours are step 5's.
 *  5. Append the palettes of design/palettes.mjs, colour tokens only, each
 *     value light-dark(light, dark): the default (Rosé Pine) on :root, so a
 *     page needs no attribute and no script for it; Aster as
 *     `:root[data-palette="aster"]`, the colours steps 1, 3 and 4 set aside
 *     (its AppShell ones, such as the shell's own --color-background-body,
 *     under `:has(> body > .shell)`); every other palette as
 *     `:root[data-palette="<slug>"]`. Then the picker's swatch of every
 *     palette as [data-swatch="<slug>"] rules.
 *  6. Palette check: the default and every palette block must define the
 *     colour tokens (--color-*, *-color) the stylesheets read, directly or
 *     through a non-colour token of tokens.css; a gap would leave that
 *     token unset under the default, or at the default's colour under the
 *     palette. Aster also keeps the colours its own values refer to.
 *     header.ut's `palettes` list (the picker and the head script) must
 *     name the same palettes, default first, then Aster, in this order.
 *  7. Closure check over tokens.css and the other four stylesheets: every
 *     var(--x) without a fallback must be declared in tokens.css, or be a
 *     component parameter declared in one of the stylesheets. A var()
 *     with a fallback is complete as written (the theme itself reads
 *     --_dynamic-type-* and --font-family-cjk that way), so it needs none.
 *     A layout entry that nothing reads is an error too, so the file
 *     collects no dead names.
 *
 * Options (paths relative to the repository root):
 *   --built <file>    theme build output   (design/built/aster.css)
 *   --core <file>     core stylesheet      (node_modules/@astryxdesign/core/dist/astryx.css)
 *   --layout <file>   layout sizes         (design/layout.css)
 *   --styles <dir>    stylesheet directory (htdocs/luci-static/aster)
 *   --skip-core-fill  omit step 3 (for the negative test only)
 *
 * Node built-ins only.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PALETTES, DEFAULT, ASTER, derive} from '../design/palettes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEME = 'aster';
const SHEETS = ['components.css', 'shell.css', 'theme.css', 'luci.css'];

function parseArgs(argv) {
  const opts = {
    check: false,
    skipCoreFill: false,
    built: 'design/built/aster.css',
    core: 'node_modules/@astryxdesign/core/dist/astryx.css',
    layout: 'design/layout.css',
    styles: 'htdocs/luci-static/aster',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--skip-core-fill') opts.skipCoreFill = true;
    else if (['--built', '--core', '--layout', '--styles'].includes(a) && i + 1 < argv.length)
      opts[a.slice(2)] = argv[++i];
    else fail(`unknown or incomplete argument: ${a}`);
  }
  for (const k of ['built', 'core', 'layout', 'styles']) opts[k] = path.resolve(ROOT, opts[k]);
  return opts;
}

function fail(msg) {
  process.stderr.write(`tokens.mjs: ${msg}\n`);
  process.exit(1);
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    fail(`cannot read ${path.relative(ROOT, file) || file}: ${e.code ?? e.message}`);
  }
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * A minimal CSS block parser: enough for the generated theme and core sheets.
 * Returns the root node; each node is {prelude, decls: string, children}.
 * Strings are skipped so a brace inside content: "{" cannot unbalance it.
 */
function parseBlocks(css) {
  const src = stripComments(css);
  const root = {prelude: '', decls: '', children: [], parent: null};
  let node = root;
  let buf = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) fail('unterminated string in stylesheet');
      buf += src.slice(i, end + 1);
      i = end;
    } else if (c === '{') {
      // The prelude is the text since the last declaration ended.
      const cut = buf.lastIndexOf(';');
      node.decls += buf.slice(0, cut + 1);
      const child = {prelude: buf.slice(cut + 1).trim(), decls: '', children: [], parent: node};
      node.children.push(child);
      node = child;
      buf = '';
    } else if (c === '}') {
      node.decls += buf;
      buf = '';
      if (!node.parent) fail('unbalanced "}" in stylesheet');
      node = node.parent;
    } else {
      buf += c;
    }
  }
  if (node !== root) fail('unbalanced "{" in stylesheet');
  return root;
}

/** Custom-property declarations of a block, in order: [[name, value]]. */
function customProps(decls) {
  const out = [];
  // Split on ';' outside parentheses (values like light-dark(a, b) carry no ';').
  for (const part of decls.split(';')) {
    const m = part.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]*?)\s*$/);
    if (m) out.push([m[1], m[2].replace(/\s+/g, ' ')]);
  }
  return out;
}

function* walk(node, ancestors = []) {
  for (const child of node.children) {
    yield [child, ancestors];
    yield* walk(child, [...ancestors, child]);
  }
}

const isLayer = (n) => /^@layer\b/.test(n.prelude);
const isThemeScope = (n) =>
  n.prelude.startsWith('@scope') && n.prelude.includes(`[data-astryx-theme="${THEME}"]`);

/** Steps 1, 2 and the AppShell part of 4: theme tokens, colour-scheme rules
 *  and the custom properties the theme sets on the app shell. */
function extractTheme(css) {
  const tree = parseBlocks(css);
  const tokens = [];
  const shell = [];
  const schemeRules = [];
  for (const [n, anc] of walk(tree)) {
    const inScope = anc.length && isThemeScope(anc.at(-1)) && anc.slice(0, -1).every(isLayer);
    if (n.prelude === ':scope' && inScope) tokens.push(...customProps(n.decls));
    if (n.prelude === '.astryx-app-shell' && inScope) shell.push(...customProps(n.decls));
    if (/^(:root|html\[data-theme="(light|dark)"\])$/.test(n.prelude) && anc.every(isLayer) &&
        /^\s*color-scheme\s*:[^;]+;\s*$/.test(n.decls)) {
      schemeRules.push(`${n.prelude} { ${n.decls.trim()} }`);
    }
  }
  if (!css.includes(`@scope ([data-astryx-theme="${THEME}"])`))
    fail(`built theme has no @scope for data-astryx-theme="${THEME}"`);
  if (!tokens.length) fail('no token block found in the built theme');
  if (schemeRules.length !== 3) fail(`expected 3 color-scheme rules in the built theme, found ${schemeRules.length}`);
  if (!shell.length) fail('no .astryx-app-shell custom properties found in the built theme');
  return {tokens: dedupe(tokens), shell: dedupe(shell), schemeRules};
}

/** Last declaration wins, as in the cascade; order of first appearance kept. */
function dedupe(pairs) {
  const map = new Map();
  for (const [k, v] of pairs) map.set(k, v);
  return [...map.entries()];
}

/** Core defaults: declarations of rules whose selector list contains :root. */
function extractCore(css) {
  const tree = parseBlocks(css);
  const pairs = [];
  for (const [n, anc] of walk(tree)) {
    if (!anc.every(isLayer)) continue;
    if (!n.prelude.split(',').some((s) => s.trim() === ':root')) continue;
    pairs.push(...customProps(n.decls));
  }
  if (!pairs.length) fail('no :root tokens found in the core stylesheet');
  return new Map(dedupe(pairs));
}

/** var() references: [{name, fallback}] in source order. */
function refs(css) {
  const out = [];
  for (const m of stripComments(css).matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g))
    out.push({name: m[1], fallback: m[2] === ','});
  return out;
}

const declared = (css) =>
  new Set([...stripComments(css).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

function fillFromCore(core, defined, seedCss) {
  const fill = new Set();
  const queue = seedCss.flatMap((css) => refs(css).map((r) => r.name));
  while (queue.length) {
    const name = queue.shift();
    if (defined.has(name) || fill.has(name) || !core.has(name)) continue;
    fill.add(name);
    queue.push(...refs(core.get(name)).map((r) => r.name));
  }
  // Core order, so the output does not depend on discovery order.
  return [...core.entries()].filter(([k]) => fill.has(k));
}

const isColour = (name) => /^--color-|-color$/.test(name);
const lightDark = ([l, d]) => `light-dark(${l}, ${d})`;

/** Colour tokens the stylesheets read: directly, or through the value of a
 *  non-colour token in `defs` (name -> value). */
function colourReads(sheets, defs) {
  const want = new Set();
  const seen = new Set();
  const queue = Object.values(sheets).flatMap((css) => refs(css).map((r) => r.name));
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    if (isColour(name)) want.add(name);
    else if (defs.has(name)) queue.push(...refs(defs.get(name)).map((r) => r.name));
  }
  return [...want].sort();
}

const block = (pairs, sel = ':root') => `${sel} {\n${pairs.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;

/* LuCI's app shell is header.ut's .shell. The rule sits on the root so the
   body behind the shell, and anything a page appends to <body>, sees the same
   value; the login page has no .shell and keeps the theme-level one. */
const SHELL_SELECTOR = ':root:has(> body > .shell)';

function generate(opts, sheets) {
  const builtCss = read(opts.built);
  const layoutCss = read(opts.layout);
  const {tokens, shell, schemeRules} = extractTheme(builtCss);

  const themeNames = new Set(tokens.map(([k]) => k));
  const layoutNames = declared(layoutCss);
  const layoutClash = [...layoutNames].filter((n) => themeNames.has(n));
  if (layoutClash.length) fail(`layout redefines theme tokens: ${layoutClash.join(' ')}`);

  let fill = [];
  if (!opts.skipCoreFill) {
    const core = extractCore(read(opts.core));
    const defined = new Set([...themeNames, ...layoutNames]);
    const seeds = [tokens.map(([, v]) => v).join('\n'), shell.map(([, v]) => v).join('\n'),
      layoutCss, ...Object.values(sheets)];
    fill = fillFromCore(core, defined, seeds);
  }

  // Steps 5 and 6.
  const defs = new Map([...fill, ...tokens, ...shell, ...customProps(parseBlocks(layoutCss).children.map((c) => c.decls).join(";"))]);
  const reads = colourReads(sheets, defs);
  const problems = [];
  const gapCheck = (slug, has) => {
    const gaps = reads.filter((n) => !has(n));
    if (gaps.length) problems.push(`palette ${slug} lacks colour tokens the stylesheets read: ${gaps.join(' ')}`);
  };
  const paletteBlock = ({slug, tokens: own}, sel) => {
    const all = derive(own);
    gapCheck(slug, (n) => all[n]);
    return block(reads.filter((n) => all[n]).map((n) => [n, lightDark(all[n])]), sel);
  };

  // Aster's colours are the build's (and the core defaults it leaves
  // unset): every one the stylesheets read, plus those its values or the
  // :root tokens refer to (--color-text-green under --color-text-success).
  const nonColour = (pairs) => pairs.filter(([k]) => !isColour(k));
  const asterDefs = new Map([...tokens, ...fill].filter(([k]) => isColour(k)));
  const asterShell = shell.filter(([k]) => isColour(k));
  const keep = new Set();
  const queue = [...reads, ...[...nonColour(fill), ...nonColour(tokens), ...nonColour(shell)].flatMap(([, v]) => refs(v).map((r) => r.name))];
  while (queue.length) {
    const name = queue.shift();
    if (keep.has(name) || !asterDefs.has(name)) continue;
    keep.add(name);
    queue.push(...refs(asterDefs.get(name)).map((r) => r.name));
  }
  gapCheck(ASTER.slug, (n) => keep.has(n));
  const asterSel = `:root[data-palette="${ASTER.slug}"]`;
  const asterBlocks = [
    block([...asterDefs].filter(([k]) => keep.has(k)), asterSel),
    ...(asterShell.length ? [block(asterShell, `${asterSel}:has(> body > .shell)`)] : []),
  ];
  const paletteBlocks = PALETTES.map((p) => paletteBlock(p, `:root[data-palette="${p.slug}"]`));

  const themeVal = (name, pairs) => pairs.find(([k]) => k === name)?.[1];
  const swatches = [
    [DEFAULT.slug, lightDark(DEFAULT.tokens['--color-accent']), lightDark(DEFAULT.tokens['--color-background-body'])],
    [ASTER.slug, themeVal('--color-accent', tokens), themeVal('--color-background-body', shell)],
    ...PALETTES.map(({slug, tokens: own}) => [slug, lightDark(own['--color-accent']), lightDark(own['--color-background-body'])]),
  ].map(([slug, accent, shellBg]) =>
    `[data-swatch="${slug}"] { --aster-swatch-accent: ${accent}; --aster-swatch-shell: ${shellBg}; }`);

  const rel = (f) => path.relative(ROOT, f);
  const css = [
    `/* @generated by scripts/tokens.mjs — do not edit by hand.`,
    `   Sources: ${rel(opts.built)} (astryx theme build of design/aster.ts),`,
    `   core defaults from @astryxdesign/core/dist/astryx.css and`,
    `   ${rel(opts.layout)}. Regenerate: node scripts/tokens.mjs */`,
    '',
    ...schemeRules,
    '',
    `/* Theme tokens (${THEME}) but the colours, which the palettes set. */`,
    block(nonColour(tokens)),
    ...(nonColour(fill).length ? [`/* Core defaults the theme leaves unset, only those referenced. */`, block(nonColour(fill))] : []),
    ...(nonColour(shell).length ? [`/* The theme's AppShell overrides (.astryx-app-shell in the build). */`, block(nonColour(shell), SHELL_SELECTOR)] : []),
    `/* Palettes (design/palettes.mjs), colour tokens only. ${DEFAULT.name}, the`,
    `   default, is :root; header.ut sets data-palette for the others from`,
    `   localStorage "aster-palette". Aster is the theme build's colours with`,
    `   its AppShell overrides (.astryx-app-shell). */`,
    paletteBlock(DEFAULT, ':root'),
    ...asterBlocks,
    ...paletteBlocks,
    `/* The palette menu's swatch of each palette: its accent on its shell. */`,
    ...swatches,
    '',
    layoutCss.trimEnd(),
    '',
  ].join('\n');
  return {css, problems};
}

/** Names declared in `css` that no stylesheet reads, directly or through
 *  another live entry of the same file. */
function unread(css, sheets) {
  const names = declared(css);
  const readBy = new Set(Object.values(sheets).flatMap((s) => refs(s).map((r) => r.name)));
  const pairs = customProps(parseBlocks(css).children.map((c) => c.decls).join(';'));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [k, v] of pairs) {
      if (!readBy.has(k)) continue;
      for (const r of refs(v)) if (names.has(r.name) && !readBy.has(r.name)) readBy.add(r.name), (grew = true);
    }
  }
  return [...names].filter((n) => !readBy.has(n)).sort();
}

/** Step 5. Returns a list of problems; empty means closed. */
function closure(tokensCss, sheets, layoutCss) {
  const problems = [];
  // A component's own parameters (--button-h, --card-pad, ...) are declared
  // in the stylesheet that defines the component; they count as defined.
  // LuCI writes some properties inline (firewall.getZoneColorStyle()'s
  // --zone-color-rgb); they are defined by the markup.
  const defined = new Set(['--zone-color-rgb', ...declared(tokensCss), ...Object.values(sheets).flatMap((c) => [...declared(c)])]);
  const all = {'tokens.css': tokensCss, ...sheets};
  const missing = new Map();
  for (const [file, css] of Object.entries(all)) {
    for (const r of refs(css)) {
      if (r.fallback || defined.has(r.name)) continue;
      if (!missing.has(r.name)) missing.set(r.name, new Set());
      missing.get(r.name).add(file);
    }
  }
  for (const [name, files] of [...missing].sort())
    problems.push(`undefined: ${name} (read in ${[...files].join(', ')})`);

  // A layout entry is alive while a stylesheet, or another live entry of
  // the same file, reads it.
  const deadLayout = unread(layoutCss, sheets);
  if (deadLayout.length) problems.push(`layout entries nothing reads (delete them): ${deadLayout.join(' ')}`);
  return problems;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sheets = Object.fromEntries(SHEETS.map((f) => [f, read(path.join(opts.styles, f))]));
  const {css: out, problems} = generate(opts, sheets);
  const target = path.join(opts.styles, 'tokens.css');

  problems.push(...closure(out, sheets, read(opts.layout)));
  const header = read(path.join(ROOT, 'ucode/template/themes/aster/header.ut'));
  const listed = [...(header.match(/const palettes = \[([\s\S]*?)\];/)?.[1] ?? '').matchAll(/\[\s*'([^']+)',\s*'([^']+)'\s*\]/g)]
    .map((m) => `${m[1]}=${m[2]}`).join(' ');
  const want = [DEFAULT, ASTER, ...PALETTES].map((p) => `${p.slug}=${p.name}`).join(' ');
  if (listed !== want) problems.push(`header.ut palettes list is "${listed}", want "${want}"`);
  if (opts.check) {
    let current = null;
    try {
      current = fs.readFileSync(target, 'utf8');
    } catch {}
    if (current !== out)
      problems.push(`${path.relative(ROOT, target)} is out of date; run node scripts/tokens.mjs`);
  }
  if (problems.length) {
    for (const p of problems) process.stderr.write(`tokens.mjs: ${p}\n`);
    process.exit(1);
  }
  if (!opts.check) fs.writeFileSync(target, out);
  process.stdout.write(`tokens.mjs: ${opts.check ? 'up to date' : 'wrote'} ${path.relative(ROOT, target)} (${Buffer.byteLength(out)} B), closure OK, ${PALETTES.length + 2} palettes complete\n`);
}

main();
