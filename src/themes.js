/**
 * Themes: token sets over one structural stylesheet.
 *
 * A theme is a small set of design tokens (colours, type); the structure
 * (measure, rhythm, apparatus grammar, toolbar, tables) is shared and lives
 * in render.js. Guarantees hold per theme: the test suite asserts WCAG AA
 * contrast for every theme's ink, soft, accent and link on its ground.
 *
 *   savi       — white ground, hairlines, Venetian red accent, humanist serif.
 *                After Emmanuela Carbé's "Risposte dei Savi". The default.
 *   pergamena  — cool rag paper, iron-gall ink, rubric red, verdigris links.
 *                After the VeDPH Summer School 2026 stylesheet.
 *   moderno    — near-black on white, quiet blue accent, sans reading text.
 *                For born-digital and contemporary editions.
 */

const SERIF = `"EB Garamond",Iowan Old Style,Palatino,"Palatino Linotype",Georgia,serif`;
const MONO = `"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace`;
const SANS = `Inter,system-ui,"Helvetica Neue",Arial,sans-serif`;

export const THEMES = {
  savi: {
    label: 'Savi',
    vars: {
      ground: '#FFFFFF', paper: '#FFFFFF', ink: '#1B1B1B', soft: '#6A6A66',
      hair: '#E5E2D9', faint: '#CFCCC2', accent: '#B01E28', 'accent-soft': '#9a5a52',
      link: '#B01E28', reading: SERIF, mono: MONO,
    },
  },
  pergamena: {
    label: 'Pergamena',
    // Warm, quiet, typographic. No dark mastheads, no material metaphors:
    // a barely-warm ground, near-black ink, one muted terracotta accent,
    // a larger reading size and more air.
    vars: {
      ground: '#FBF9F6', paper: '#FFFFFF', ink: '#221F1C', soft: '#6B6257',
      hair: '#E9E3D9', faint: '#CEC5B8', accent: '#9C4221', 'accent-soft': '#B07A5C',
      link: '#9C4221', reading: SERIF, mono: MONO,
    },
    extra: `
body{font-size:19px;line-height:1.62}
header.torchio{padding-top:44px;padding-bottom:20px;border-bottom-width:2px}
header.torchio h1{font-size:30px;font-weight:600;letter-spacing:0}
main.torchio{padding-top:18px}
.t-head{font-size:1.25em;margin:1.6em 0 .5em}
`,
  },
  moderno: {
    label: 'Moderno',
    vars: {
      ground: '#FFFFFF', paper: '#FFFFFF', ink: '#16181C', soft: '#565C66',
      hair: '#E4E6EA', faint: '#C3C7CE', accent: '#0F4C81', 'accent-soft': '#5C7CA3',
      link: '#0F4C81', reading: SANS, mono: MONO,
    },
    extra: `
body{line-height:1.6;font-size:17px}
.t-head,header.torchio h1{letter-spacing:-.01em}
`,
  },
};

export function themeCSS(name) {
  const theme = THEMES[name] || THEMES.savi;
  const vars = Object.entries(theme.vars)
    .map(([k, v]) => `--${k}:${v}`).join(';');
  return `:root{${vars};--serif:var(--reading);--measure:44rem}\n${theme.extra || ''}`;
}

export function isTheme(name) {
  return Object.prototype.hasOwnProperty.call(THEMES, name);
}
