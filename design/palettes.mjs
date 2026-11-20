/**
 * The palettes (plan decisions 10 and 12). Rosé Pine is the default:
 * scripts/tokens.mjs writes its colour tokens on tokens.css's :root, and
 * each other palette below as a `:root[data-palette="<slug>"]` block of
 * colour tokens only, every value a `light-dark(light, dark)` pair, so the
 * mode switch keeps working. Aster is not listed here: its colours are
 * design/aster.ts's, which tokens.mjs moves from the theme build into
 * `:root[data-palette="aster"]`. A palette lists the tokens it chooses;
 * derive() fills in the rest the same way for every palette, the way
 * Astryx's core derives them from the same roles.
 *
 * Each entry is [light, dark]. The header and the picker read the slug and
 * name; header.ut, theme-aster.js and checks/lib/gate.mjs list the slugs.
 *
 * Node built-ins only.
 */

/* accent-muted in dark is 22 % (0x38) in the four palettes below: their
   pastel dark accents at 15 % made the selected side nav row read as the
   hovered row's grey (QA 2026-11-20); at 22 % it is 1.3:1 or more from the
   hover and the row's words stay 6.5:1 or more. Aster keeps Astryx's 16 %.

   Relay Blue, Sounding Teal and Herbarium Plum were designed for this
   project. The field border (--color-border-emphasized) stays Astryx's
   #CCD3DB in light, as in Aster, and is waived in the contrast gate. */
const RELAY = {
  '--color-accent': ['#315FD3', '#87A9FA'],
  '--color-accent-muted': ['#315FD316', '#87A9FA38'],
  '--color-on-accent': ['#FFFFFF', '#101D37'],
  '--color-text-accent': ['#274EAD', '#A9C2FF'],
  '--color-background-body': ['#F3F4F7', '#181A20'],
  '--color-background-surface': ['#FFFFFF', '#20232A'],
  '--color-background-muted': ['#E9ECF2', '#15171D'],
  '--color-text-primary': ['#19202C', '#E4E8EF'],
  '--color-text-secondary': ['#515F74', '#AFBACB'],
  '--color-border': ['#DCE1E9', '#31353E'],
  '--color-border-emphasized': ['#CCD3DB', '#494D53'],
  '--color-success': ['#358561', '#65B591'],
  '--color-text-success': ['#246445', '#99D2AF'],
  '--color-warning': ['#BE852E', '#D3A258'],
  '--color-text-warning': ['#80500E', '#EDC588'],
  '--color-error': ['#BD4C56', '#D97782'],
  '--color-text-error': ['#9D303D', '#F2ACB3'],
  '--color-info': ['#477FA1', '#75ABCA'],
  '--color-text-info': ['#31617F', '#A0CBE3'],
  '--focus-outline-color': ['#315FD3', '#87A9FA'],
};

const TEAL = {
  '--color-accent': ['#246B69', '#7DC8BC'],
  '--color-accent-muted': ['#246B6919', '#7DC8BC38'],
  '--color-on-accent': ['#FFFFFF', '#112D2A'],
  '--color-text-accent': ['#175A59', '#9ADACE'],
  '--color-background-body': ['#F1F5F3', '#161D1C'],
  '--color-background-surface': ['#FCFEFD', '#1D2826'],
  '--color-background-muted': ['#E4ECE8', '#131A19'],
  '--color-text-primary': ['#172824', '#E0EAE6'],
  '--color-text-secondary': ['#50645F', '#A9BDB5'],
  '--color-border': ['#D6E1DC', '#2E3935'],
  '--color-border-emphasized': ['#CCD3DB', '#494D53'],
  '--color-success': ['#658245', '#9BB97B'],
  '--color-text-success': ['#44622E', '#BDDA9E'],
  '--color-warning': ['#BA863E', '#CEA468'],
  '--color-text-warning': ['#785017', '#E7C697'],
  '--color-error': ['#B95853', '#D9817B'],
  '--color-text-error': ['#933B37', '#EFAEA9'],
  '--color-info': ['#5984AA', '#84AACC'],
  '--color-text-info': ['#355E84', '#ACCCE6'],
  '--focus-outline-color': ['#246B69', '#7DC8BC'],
};

const PLUM = {
  '--color-accent': ['#785378', '#C9A2C5'],
  '--color-accent-muted': ['#78537819', '#C9A2C538'],
  '--color-on-accent': ['#FFFFFF', '#302033'],
  '--color-text-accent': ['#69456B', '#DEC0DB'],
  '--color-background-body': ['#F6F3F0', '#201C20'],
  '--color-background-surface': ['#FFFDFA', '#292529'],
  '--color-background-muted': ['#ECE7E3', '#1C181C'],
  '--color-text-primary': ['#292329', '#ECE5E5'],
  '--color-text-secondary': ['#695E66', '#C3B6BD'],
  '--color-border': ['#E2DBD7', '#3D353C'],
  '--color-border-emphasized': ['#CCD3DB', '#494D53'],
  '--color-success': ['#75834F', '#A6B77E'],
  '--color-text-success': ['#4C6134', '#C5D4A0'],
  '--color-warning': ['#BF873D', '#CFA163'],
  '--color-text-warning': ['#805017', '#EBC492'],
  '--color-error': ['#BB5A46', '#D78472'],
  '--color-text-error': ['#943F30', '#EFAE9C'],
  '--color-info': ['#547D9C', '#7EA9C5'],
  '--color-text-info': ['#3B627F', '#ABCCE0'],
  '--focus-outline-color': ['#785378', '#C9A2C5'],
};

/* Rosé Pine (MIT, rosepinetheme.com; LICENSES/rose-pine-MIT.txt): Dawn in
   light, Main in dark. Roles follow the official usage: love for errors,
   gold for warnings, iris for hints (info), foam for additions (success).
   The accent is the most readable official colour of the pine family: pine
   in Dawn (iris on Dawn is 3.6:1 on the surface) and foam in Main (pine on
   Main is 3.2:1); success then takes the other one of the pair in Main, so
   an action never reads as a status. Muted is the sunken well, as in Aster:
   Dawn's overlay, Main's base.

   Official colours moved toward black (Dawn) or white (Main), each by the
   smallest step that passes; ratios against the worst background the text
   sits on (the surface, the muted well, its own muted fill, the neutral
   button fill, or the hover overlay):
     text-secondary  Dawn subtle #797593 -> #69657F   3.7 -> 4.6 on overlay
                     Main subtle #908CAA -> #938FAC   4.5 -> 4.6 under hover
     text-success    Dawn foam   #56949F -> #3E6B73   2.7 -> 4.6 on its fill
                     Main pine   #31748F -> #74A1B3   2.5 -> 4.6 on its fill
     text-warning    Dawn gold   #EA9D34 -> #8C5E1F   1.9 -> 4.7 on its fill
     text-error      Dawn love   #B4637A -> #8F4F61   3.2 -> 4.6 on its fill
                     Main love   #EB6F92 -> #F19DB5   3.3 -> 4.6 on the
                                                      neutral button (Delete)
     text-info       Dawn iris   #907AA9 -> #6D5D80   2.9 -> 4.6 on its fill
     error (fill)    Dawn love   #B4637A -> #AA5E73   white on it 4.2 -> 4.6
     border          Main highlightMed #403D52 -> #373447: the dark
                     separator cap is 1.5:1; 1.69 -> 1.47 on base
   Main's iris, gold and foam pass as they are. */
const ROSE_PINE = {
  '--color-accent': ['#286983', '#9CCFD8'],
  '--color-accent-muted': ['#28698319', '#9CCFD838'],
  '--color-on-accent': ['#FFFAF3', '#191724'],
  '--color-text-accent': ['#286983', '#9CCFD8'],
  '--color-background-body': ['#FAF4ED', '#191724'],
  '--color-background-surface': ['#FFFAF3', '#1F1D2E'],
  '--color-background-muted': ['#F2E9E1', '#191724'],
  '--color-text-primary': ['#575279', '#E0DEF4'],
  '--color-text-secondary': ['#69657F', '#938FAC'],
  '--color-border': ['#DFDAD9', '#373447'],
  '--color-border-emphasized': ['#CECACD', '#524F67'],
  '--color-success': ['#56949F', '#31748F'],
  '--color-text-success': ['#3E6B73', '#74A1B3'],
  '--color-warning': ['#EA9D34', '#F6C177'],
  '--color-text-warning': ['#8C5E1F', '#F6C177'],
  '--color-error': ['#AA5E73', '#EB6F92'],
  '--color-text-error': ['#8F4F61', '#F19DB5'],
  '--color-info': ['#907AA9', '#C4A7E7'],
  '--color-text-info': ['#6D5D80', '#C4A7E7'],
  '--focus-outline-color': ['#286983', '#9CCFD8'],
};

/* The default, written on :root; the picker lists it first. */
export const DEFAULT = {slug: 'rose-pine', name: 'Rosé Pine', tokens: ROSE_PINE};

/* Aster, from the theme build; the picker lists it second. */
export const ASTER = {slug: 'aster', name: 'Aster'};

export const PALETTES = [
  {slug: 'relay', name: 'Relay Blue', tokens: RELAY},
  {slug: 'teal', name: 'Sounding Teal', tokens: TEAL},
  {slug: 'plum', name: 'Herbarium Plum', tokens: PLUM},
];

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/* a mixed toward b by k, as an opaque hex. */
const mix = (a, b, k) => '#' + rgb(a).map((v, i) => Math.round((v + (rgb(b)[i] - v) * k) * 255)
  .toString(16).padStart(2, '0')).join('').toUpperCase();
const both = (f) => [f(0), f(1)];

/**
 * The palette's own tokens plus every derived one, as name -> [light, dark].
 * The derivations follow Astryx's core defaults (astryx.css :root):
 *  - card = surface; the popover is the surface in light and one step up
 *    (6% toward the ink) in dark, as core's #28292C sits over #1F1F22;
 *  - icons take the text colour of their role;
 *  - the error border and the on-*-muted inks are the role's text colour;
 *  - the muted status fills are the fill at 20% (light) and 25% (dark);
 *  - neutral (the default button and badge fill) is the ink at 10% / 20%;
 *  - the hover and pressed overlays are the ink at 5% / 10% in light and
 *    white at 5% / 10% in dark; the dialog scrim is the ink at 40% in
 *    light and the body at 60% in dark;
 *  - on-error is white or the light-mode ink, whichever reads better on the
 *    error fill, or the dark body when neither reaches 4.5:1 (Rosé Pine's
 *    dark Love); on-light (ink on a light inline zone colour) stays black.
 */
export function derive(tokens) {
  const t = (name, m) => tokens[name][m];
  const ink = (m) => t('--color-text-primary', m);
  const out = {...tokens};
  out['--color-background-card'] = both((m) => t('--color-background-surface', m));
  out['--color-background-popover'] = both((m) => (m ? mix(t('--color-background-surface', m), ink(m), 0.06) : t('--color-background-surface', m)));
  out['--color-icon-accent'] = both((m) => t('--color-accent', m));
  out['--color-icon-primary'] = both(ink);
  out['--color-icon-secondary'] = both((m) => t('--color-text-secondary', m));
  out['--color-icon-success'] = both((m) => t('--color-text-success', m));
  out['--color-icon-warning'] = both((m) => t('--color-text-warning', m));
  out['--color-border-error'] = both((m) => t('--color-text-error', m));
  for (const role of ['success', 'warning', 'error', 'info']) {
    out[`--color-${role}-muted`] = both((m) => t(`--color-${role}`, m) + (m ? '3F' : '33'));
    out[`--color-on-${role}-muted`] = both((m) => t(`--color-text-${role}`, m));
  }
  out['--color-neutral'] = both((m) => ink(m) + (m ? '33' : '1A'));
  out['--color-overlay'] = both((m) => (m ? t('--color-background-body', m) + '99' : ink(m) + '66'));
  out['--color-overlay-hover'] = both((m) => (m ? '#FFFFFF0C' : ink(m) + '0C'));
  out['--color-overlay-pressed'] = both((m) => (m ? '#FFFFFF19' : ink(m) + '19'));
  out['--color-on-error'] = both((m) => {
    const fill = t('--color-error', m);
    const best = ratio('#FFFFFF', fill) >= ratio(ink(0), fill) ? '#FFFFFF' : ink(0);
    return ratio(best, fill) >= 4.5 ? best : t('--color-background-body', 1);
  });
  out['--color-on-light'] = ['#000000', '#000000'];
  return out;
}
