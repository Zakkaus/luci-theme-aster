/**
 * The panel's non-colour adjustments, shared by every theme variant: control
 * sizes, supporting text, icon sizes, the text-input/input-group/list fixes,
 * thin scrollbars, the `brand` Card variant and the Heroicons registry. Each
 * variant is `defineTheme({name, extends: <official theme>, icons, tokens, components})`
 * plus its own typography (`panelScale`), which keeps the theme's fonts.
 */
import {spacingDefaults, type ThemeAdaptations} from '@astryxdesign/core/theme';
import {appIconRegistry} from './icons';

declare module '@astryxdesign/core/Card' {
  interface CardVariantMap {
    brand: true;
  }
}

/**
 * Shared type scale. The owner found the default ramp too small (14px text,
 * 32px controls), so the base is 15px on every theme. The ratio is 1.2 on all
 * of them so headings land at the same size and position whichever theme is
 * picked (the official gothic, matcha and y2k themes use 1.25 on a 16px base).
 * `typography` replaces the base theme's config, so each variant repeats its
 * own fonts beside this scale.
 */
export const panelScale = {base: 15, ratio: 1.2} as const;

/**
 * Chinese for every text stack, in the script of the page language. The theme
 * fonts are Latin only, so without this each OS drew Chinese in its own font.
 * The stacks name `--font-family-cjk`, which site.fonts.css sets from the
 * document's `lang` (App.tsx): Noto Sans SC Variable with PingFang SC and
 * Microsoft YaHei for zh-Hans, Noto Sans TC Variable with PingFang TC and
 * Microsoft JhengHei otherwise, so Simplified text gets mainland glyph forms
 * and Traditional text Taiwan ones. The fallback inside `var()` is the
 * Traditional set, for a page whose stylesheet has not loaded. Both faces are
 * self-hosted and split into unicode-range chunks, so a page fetches only the
 * chunks its glyphs fall in; the platform fonts after each cover the time
 * before a chunk arrives.
 * It sits between two Latin fallbacks that Linux resolves to the same font
 * (Helvetica and Arial, "Times New Roman" and Times): when it came after both,
 * Chrome on Linux drew some Chinese glyphs in the system CJK font instead.
 * Before them, Latin text would pull Noto's latin chunk while the theme font
 * loads.
 */
export const cjkFallbacks = 'var(--font-family-cjk, "Noto Sans TC Variable", "PingFang TC", "Microsoft JhengHei")';

/** Code font the official themes share (loaded by every theme's fonts.css). */
export const jetBrainsMono = {
  family: 'JetBrains Mono',
  fallbacks: '"SF Mono", Monaco, Consolas, monospace',
} as const;

// Thin native scrollbars. Astryx draws no scrollbar and has no scrollbar
// token, so each scroll viewport it renders sets the width (it does not
// inherit) and the thumb takes the emphasized border tone.
const thin = {
  scrollbarColor: 'var(--color-border-emphasized) transparent',
  scrollbarWidth: 'thin',
} as const;

// 44px, the same hit area as the phone chrome (src/ui/dock.ts).
const touchTarget = 'var(--spacing-11)';
const touchHit = {
  content: '""',
  position: 'absolute',
  insetBlock: `min(0px, calc((100% - ${touchTarget}) / 2))`,
  insetInline: `min(0px, calc((100% - ${touchTarget}) / 2))`,
  pointerEvents: 'auto',
} as const;
// Astryx hides the native input under its indicator; removing its native appearance enables a hit pseudo-element.
const nativeTouchHit = {
  ':where(*) input[type="checkbox"]': {appearance: 'none'},
  ':where(*) input[type="checkbox"]::before': touchHit,
} as const;

export {appIconRegistry};

// Theme CSS has no nested @media, so reduced motion goes through adaptations.
// Typed up front: as an inferred literal, the rules widen into a union that
// defineTheme rejects.
const adaptations: ThemeAdaptations = {
  rules: [
    {
      when: {motion: 'reduce' as const},
      value: {components: {button: {base: {':active': {transform: 'none'}}}}},
    },
    {
      when: {pointer: 'coarse' as const},
      value: {
        components: {
          button: {
            base: {
              '::before': touchHit,
              ':is(.astryx-stack[data-direction="horizontal"][data-gap="1"]:has(> .astryx-button ~ .astryx-button) > *)::before': {
                insetInline: `max(calc(var(--spacing-1) / -2), ${touchHit.insetInline})`,
              },
              // A trailing action uses the text gap, not the row's scrollable inline end.
              ':is(.astryx-stack[data-direction="horizontal"][data-gap="2"] > .astryx-text + .astryx-button:last-of-type)::before': {
                insetInlineStart: `min(0px, calc(100% - ${touchTarget}))`,
                insetInlineEnd: '0',
              },
            },
          },
          'segmented-control-item': {base: {'::before': touchHit}},
          tab: {base: {position: 'relative', '::before': touchHit}},
          'collapsible-trigger': {base: {position: 'relative', '::before': touchHit}},
          // These wrappers already establish a stacking context; keep native inputs above the hit area.
          'text-input': {base: {'::before': {...touchHit, zIndex: '-1'}}},
          selector: {base: {'::before': {...touchHit, zIndex: '-1'}}},
          'checkbox-input': {base: nativeTouchHit},
          'switch-field': {base: nativeTouchHit},
          'side-nav-heading': {base: {position: 'relative', '::before': touchHit}},
          'side-nav-item': {
            base: {
              position: 'relative',
              // Adjacent navigation rows have only half a spacing step between them.
              '::before': {...touchHit, insetBlock: 'calc(var(--spacing-1) / -4)'},
            },
          },
          'list-item': {base: {':is(a, button)::before': touchHit}},
        },
      },
    },
    {
      // Legal Markdown tables scroll sideways on a phone. Markdown takes no Table plugins, so their first
      // column is pinned here, as useTableStickyColumns pins the data tables' identity column, with its edge shadow.
      when: {width: {below: 'sm'}},
      value: {
        components: {
          'markdown-table': {
            base: {
              ':where(*) :is(th, td):first-child': {
                position: 'sticky',
                insetInlineStart: '0',
                zIndex: '1',
                backgroundColor: 'var(--color-background-surface)',
                backgroundClip: 'padding-box',
                // Lets the edge shadow fall past the cell.
                overflow: 'visible',
              },
              ':where(*) :is(th, td):first-child::after': {
                content: '""',
                position: 'absolute',
                insetBlock: '0',
                insetInlineEnd: '0',
                width: 'var(--spacing-1)',
                translate: '100%',
                pointerEvents: 'none',
                backgroundImage: 'linear-gradient(to right, var(--color-shadow), transparent)',
              },
            },
          },
        },
      },
    },
  ],
};

export const panelShared = {
  tokens: {
    // Core's 4px spacing scale on every theme: matcha and y2k stretch it to
    // 6px steps, which moved the page padding and the whole layout.
    ...spacingDefaults,
    // Control heights move up one 4px step: sm 32, md 36, lg 40. Supporting
    // text stays 13px on a 20px line.
    '--size-element-sm': '32px',
    '--size-element-md': '36px',
    '--size-element-lg': '40px',
    '--text-supporting-size': '0.8125rem',
    '--text-supporting-leading': '1.5385',
  },
  components: {
    // Press feedback as on the Astryx homepage. Button already transitions
    // transform over --duration-fast with --ease-standard, so only the pressed
    // state is added; the hover overlay keeps each theme's own timing. The
    // reduced-motion rule in `panelShared.adaptations` removes the scale.
    button: {
      base: {
        ':active': {
          transform: 'scale(.98)',
        },
      },
    },
    // List clips its rows in the inline axis so a swiped row stays inside it.
    // No list here uses swipe actions, but every one inside a card uses
    // edgeCompensation, which pulls each row 8px out into the card padding so
    // the row text lines up with the heading. The clip cut that 8px off again:
    // the hover tint ended flush with the icon and lost its rounded corners.
    list: {base: {overflowX: 'visible'}},
    'app-shell': {base: thin},
    'app-shell-sidenav': {base: thin},
    layout: {base: thin},
    'layout-content': {base: thin},
    'layout-panel': {base: thin},
    'scrollable-area': {base: thin},
    // Library scrollers the list above missed; without it they drew the
    // 15px native bar with arrow buttons. Tables scroll sideways at narrow
    // widths; a Card and the Dialog surface scroll when their content is long.
    'table-scroll-wrapper': {base: thin},
    // The scrim dims without core's 2px blur: blurring the page behind every dialog, sheet and the phone drawer
    // repaints it each frame, and open and close ran at 30 fps on a phone.
    dialog: {base: {...thin, '::backdrop': {backdropFilter: 'none'}}},
    'mobile-nav': {base: {'::backdrop': {backdropFilter: 'none'}}},
    // `brand` Card: a flat accent-muted surface for the dashboard greeting.
    // SelectableCard rings an added variant in `--selectable-card-ring-color`.
    card: {
      base: thin,
      'variant:brand': {
        backgroundColor: 'var(--color-accent-muted)',
        '--selectable-card-ring-color': 'var(--color-accent)',
      },
    },
  },
  adaptations,
};
