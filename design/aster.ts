/**
 * The aster theme, copied from the LuCI reference page (astryx-ref
 * src/theme/luci.ts, renamed): card-v2's `siteTheme` (a port
 * of the official Astryx docsite theme) with three changes.
 *  - Accent is brand blue (#225BFF light, #3D87FF dark): accent fill, links,
 *    focus ring and the selected side-nav row. Primary ink stays siteTheme's.
 *    `--color-on-accent` follows the accent: white on the light blue, deep
 *    navy on the dark one (white on #3D87FF is only 3.3:1).
 *  - No web fonts: a router ships no font files, so text uses the system UI
 *    stack, then siteTheme's CJK fallbacks; code uses the system mono stack.
 * Everything else is siteTheme's, kept verbatim: ink, radii, body washes,
 * panel scale and control sizes, pill buttons, TopNav, pagination dots and the
 * landing's custom tokens (unused on this page, kept so the token set matches).
 */
import {defineTheme, type TokenValue} from '@astryxdesign/core/theme';
import {asterIconRegistry} from './icons';
import {cjkFallbacks, panelScale, panelShared} from './shared';

const PRIMARY = 'light-dark(#15110C, #DFE2E5)';
const BRAND_BLUE = 'light-dark(#225BFF, #3D87FF)';
const BRAND_BLUE_MUTED = 'light-dark(rgba(34, 91, 255, 0.10), rgba(61, 135, 255, 0.16))';
const systemUi = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, ${cjkFallbacks}, Arial, sans-serif`;
const systemMono = '"SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

// Custom (non-core) tokens, both upstream's. The brand blue marks one landing
// demo card; the feature-card
// tint is the official landing's bento background (apps/docsite globals.css).
const customTokens: Record<string, TokenValue> = {
  '--color-brand': BRAND_BLUE,
  '--astryx-marketing-feature-card-bg': 'light-dark(#E6F0FF, #1A2333)',
  ...cardFaceTokens(),
};

/**
 * The landing's card face (features/landing/CardFaces.tsx): one matte
 * charcoal finish for every card, with only a faint fall of light from top
 * to bottom (`-from` to `-to`), a hairline edge, the ink of the mark and
 * number, the gold chip and a soft drop shadow. No sheen, glare or grain:
 * the face reads as a printed plastic card, not a glossy render. It stays
 * dark in both modes, like the physical card; dark mode lifts the face and
 * its edge a step so it still separates from the near-black body.
 */
function cardFaceTokens(): Record<string, TokenValue> {
  return {
    '--nb-face-from': 'light-dark(#2B2B2F, #303036)',
    '--nb-face-to': 'light-dark(#1C1C1F, #222227)',
    '--nb-face-edge': 'light-dark(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.14))',
    '--nb-face-ink': 'rgba(255, 255, 255, 0.92)',
    '--nb-face-ink-muted': 'rgba(255, 255, 255, 0.64)',
    '--nb-face-chip-from': '#D9C894',
    '--nb-face-chip-to': '#B09A62',
    '--nb-face-chip-line': 'rgba(74, 58, 24, 0.35)',
    '--nb-face-shadow': 'light-dark(rgba(36, 28, 18, 0.22), rgba(0, 0, 0, 0.55))',
  };
}

export const asterTheme = defineTheme({
  name: 'aster',
  icons: asterIconRegistry,
  tokens: {
    '--color-accent': BRAND_BLUE,
    '--color-text-accent': BRAND_BLUE,
    '--color-icon-accent': BRAND_BLUE,
    '--color-accent-muted': BRAND_BLUE_MUTED,
    '--color-on-accent': 'light-dark(#FFFFFF, #0B1020)',
    '--color-background-body': 'light-dark(#F8F4ED, #111112)',
    '--color-text-primary': PRIMARY,
    '--color-icon-primary': PRIMARY,
    '--color-text-secondary': 'light-dark(#4E606F, #B8BDC3)',
    '--color-on-error': 'light-dark(#FFFFFF, #15110C)',
    '--text-display-1-weight': 'var(--font-weight-semibold)',
    '--text-display-2-weight': 'var(--font-weight-semibold)',
    '--text-display-3-weight': 'var(--font-weight-semibold)',
    '--radius-inner': '8px',
    '--radius-element': '12px',
    '--radius-container': '16px',
    '--radius-page': '32px',
    ...panelShared.tokens,
    ...customTokens,
  },
  typography: {
    scale: panelScale,
    body: {family: 'system-ui', fallbacks: systemUi},
    heading: {family: 'system-ui', fallbacks: systemUi},
    code: {family: 'ui-monospace', fallbacks: systemMono},
  },
  adaptations: panelShared.adaptations,
  components: {
    ...panelShared.components,
    'app-shell': {
      base: {
        ...panelShared.components['app-shell'].base,
        '--color-background-body': 'light-dark(#F4F4F5, #18181B)',
      },
    },
    // Selected nav row in the accent: tinted fill, accent label and icon.
    'side-nav-item': {
      selected: {
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-text-accent)',
      },
    },
    'nav-icon': {base: {backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)'}},
    button: {base: {...panelShared.components.button.base, borderRadius: 'var(--radius-full)'}},
    'top-nav-item': {
      selected: {
        backgroundColor: 'transparent',
        ':hover': {backgroundColor: 'var(--color-overlay-hover)'},
        ':active': {backgroundColor: 'var(--color-overlay-pressed)'},
      },
    },
    'pagination-dot': {
      base: {
        width: '10px',
        height: '10px',
        backgroundColor: 'transparent',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: 'color-mix(in srgb, var(--color-accent) 60%, transparent)',
        boxSizing: 'border-box',
        transitionProperty: 'width, background-color, border-color',
        transitionDuration: 'var(--duration-fast)',
        transitionTimingFunction: 'var(--ease-standard)',
        ':hover': {backgroundColor: 'var(--color-accent-muted)'},
      },
      active: {
        width: 'var(--spacing-7)',
        backgroundColor: 'var(--color-accent)',
        borderColor: 'var(--color-accent)',
        borderRadius: 'var(--radius-full)',
        ':hover': {backgroundColor: 'var(--color-accent)'},
      },
    },
  },
});
