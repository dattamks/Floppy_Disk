// Design palette — single source of truth for colors (PRD-01: easy to re-skin).
//
// Colors are exposed as CSS custom properties so the whole app can switch
// between light and dark at runtime with zero per-component changes: every
// `theme.brand` is really `var(--brand)`, and we swap the variable values under
// `:root[data-theme="dark"]`. The accent (brand) family is additionally keyed
// by `data-accent` so the user can pick a primary color. Non-color tokens
// (radii) stay literal.
//
// Premium finishes: the dark theme is a deep *matte black* (neutral, no blue
// cast); the light theme is a warm *matte paper* (soft off-white, crisp white
// cards). `onAccent` is text/iconography on the accent — always light — kept
// separate from `white`, which is a surface that flips dark.

// --- tiny hex helpers (for deriving accent tints) ---------------------------
const _rgb = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const _hex = (r, g, b) => {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
};
const mix = (a, b, t) => {
  const A = _rgb(a), B = _rgb(b);
  return _hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};

const DARK_BG = '#191A1C'; // the charcoal / deep-gray ground accents mix toward in dark

// Derive the full brand family from one base color, for a light or dark ground.
const brandFor = (base, dark) => (dark
  ? {
      brand: mix(base, '#FFFFFF', 0.16),
      brandDark: base,
      brandBorder: mix(base, DARK_BG, 0.6),
      brandBorderStrong: mix(base, DARK_BG, 0.46),
      brandBg: mix(base, DARK_BG, 0.82),
      brandBgSoft: mix(base, DARK_BG, 0.9),
      brandBgSoft2: mix(base, DARK_BG, 0.86),
      brandBgSoft3: mix(base, DARK_BG, 0.72),
      toastAction: mix(base, '#FFFFFF', 0.55),
    }
  : {
      brand: base,
      brandDark: mix(base, '#000000', 0.16),
      brandBorder: mix(base, '#FFFFFF', 0.72),
      brandBorderStrong: mix(base, '#FFFFFF', 0.62),
      brandBg: mix(base, '#FFFFFF', 0.9),
      brandBgSoft: mix(base, '#FFFFFF', 0.955),
      brandBgSoft2: mix(base, '#FFFFFF', 0.93),
      brandBgSoft3: mix(base, '#FFFFFF', 0.84),
      toastAction: mix(base, '#FFFFFF', 0.55),
    });

const BRAND_KEYS = Object.keys(brandFor('#5145E5', false));

// Selectable primary colors — a curated set that reads well on both grounds.
export const ACCENTS = [
  { id: 'violet', label: 'Violet', base: '#5145E5' },
  { id: 'blue', label: 'Blue', base: '#2E6DF0' },
  { id: 'emerald', label: 'Emerald', base: '#0E9E6E' },
  { id: 'amber', label: 'Amber', base: '#DD8305' },
  { id: 'rose', label: 'Rose', base: '#E23D6D' },
  { id: 'graphite', label: 'Graphite', base: '#5B6270' },
];
const DEFAULT_ACCENT = 'violet';
const accentBase = (id) => (ACCENTS.find((a) => a.id === id) || ACCENTS[0]).base;

// The custom accent: any hex the user picks. Stored separately from the accent
// id so switching to a preset and back preserves the chosen color.
export const CUSTOM_ACCENT = 'custom';
const DEFAULT_CUSTOM = '#7C5CFF';

// Normalize user input to a #rrggbb hex, or null if it isn't a color. Accepts
// "#abc", "abc", "#aabbcc", "aabbcc" (case-insensitive).
export const normalizeHex = (h) => {
  let s = (h || '').trim();
  if (!s) return null;
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
};

// --- neutral (non-brand) palettes ------------------------------------------
const LIGHT = {
  ...brandFor(accentBase(DEFAULT_ACCENT), false),
  // Warm matte-paper neutrals.
  text: '#1A1A1C',
  textInk: '#111113',
  ink: '#08080A',
  textSoft: '#2C2C30',
  textSoft2: '#3C3C42',
  textMuted: '#6A6A6E',
  textMuted2: '#8C8C90',
  textFaint: '#9E9E9F',
  textFainter: '#BAB9B3',
  border: '#E6E3DB',
  borderStrong: '#D7D4CB',
  borderStrong2: '#CBC8BE',
  surface: '#F1EFEA',
  surface2: '#F8F6F1',
  surface3: '#EAE8E1',
  surface4: '#EFEDE7',
  appBg: '#F4F2ED',
  appBg2: '#F0EEE8',
  white: '#FFFFFF',
  black: '#000000',
  onAccent: '#FFFFFF',
  toastBg: '#1C1C1F',
  toastFg: '#F6F6F7',
  danger: '#E5484D',
  dangerDark: '#C0362C',
  dangerBorder: '#F3C9C9',
  dangerBorder2: '#FCA5A5',
  dangerBorder3: '#F5C2C2',
  dangerBg: '#FEECEC',
  dangerBg2: '#FDECEC',
  dangerBgSoft: '#FEF2F2',
  warn: '#D97706',
  warnDark: '#9A5B1E',
  warnBg: '#FFF7ED',
  warnBorder: '#FED7AA',
  success: '#16A34A',
  teal: '#0EA5A0',
  violet: '#8B5CF6',
  star: '#F5A623',
  starBgSoft: 'rgba(245,166,35,0.13)',
  tealBg: '#ECFDF9',
};

const DARK = {
  ...brandFor(accentBase(DEFAULT_ACCENT), true),
  // Neutral charcoal + deep-gray ramp — soft, low-cast, clearly layered panels
  // (app ground darkest → cards lifted → inputs/hover lighter). The accent hue
  // is the one saturated color, reserved for links and focal points.
  text: '#ECECEE',
  textInk: '#F8F8F9',
  ink: '#FAFAFB',
  textSoft: '#D6D6D9',
  textSoft2: '#C0C0C4',
  textMuted: '#9A9AA0',
  textMuted2: '#7C7C83',
  textFaint: '#68686F',
  textFainter: '#52525A',
  border: '#2E3034',
  borderStrong: '#3A3C42',
  borderStrong2: '#45474E',
  surface: '#26282C',
  surface2: '#1C1D20',
  surface3: '#2C2E33',
  surface4: '#232529',
  appBg: DARK_BG,
  appBg2: '#1C1D20',
  white: '#212327',
  black: '#000000',
  onAccent: '#FFFFFF',
  toastBg: '#2E3035',
  toastFg: '#F4F4F6',
  danger: '#F2565B',
  dangerDark: '#E0454A',
  dangerBorder: '#5A3033',
  dangerBorder2: '#7A3D40',
  dangerBorder3: '#6A3639',
  dangerBg: '#3A2325',
  dangerBg2: '#351F21',
  dangerBgSoft: '#2A1C1E',
  warn: '#E0912F',
  warnDark: '#E0A45A',
  warnBg: '#2E2416',
  warnBorder: '#5A4520',
  success: '#3DBB74',
  teal: '#2CC6B8',
  violet: '#A78BFA',
  star: '#F5B93A',
  starBgSoft: 'rgba(245,185,58,0.16)',
  tealBg: '#16302D',
};

const COLOR_KEYS = Object.keys(LIGHT);

// The public palette: every color is a CSS variable reference; radii literal.
export const theme = COLOR_KEYS.reduce((acc, k) => {
  acc[k] = `var(--${k})`;
  return acc;
}, {
  radius: '6px',
  radiusBadge: '5px',
  radiusCard: '10px',
});

const varsOf = (keys, palette) => keys.map((k) => `--${k}:${palette[k]};`).join('');
const cssBlock = (selector, keys, palette) => `${selector}{${varsOf(keys, palette)}}`;

// Per-accent brand overrides (light, dark, and OS-dark fallback).
const accentCss = (id) => {
  const light = brandFor(accentBase(id), false);
  const dark = brandFor(accentBase(id), true);
  return (
    cssBlock(`:root[data-accent="${id}"]`, BRAND_KEYS, light) +
    cssBlock(`:root[data-accent="${id}"][data-theme="dark"]`, BRAND_KEYS, dark) +
    `@media (prefers-color-scheme: dark){${cssBlock(`:root[data-accent="${id}"]:not([data-theme="light"])`, BRAND_KEYS, dark)}}`
  );
};

export const THEME_CSS =
  cssBlock(':root', COLOR_KEYS, LIGHT) +
  cssBlock(':root[data-theme="dark"]', COLOR_KEYS, DARK) +
  `@media (prefers-color-scheme: dark){${cssBlock(':root:not([data-theme="light"])', COLOR_KEYS, DARK)}}` +
  ACCENTS.map((a) => accentCss(a.id)).join('');

const THEME_KEY = 'floppy-theme';
const ACCENT_KEY = 'floppy-accent';
const CUSTOM_KEY = 'floppy-accent-hex';

// Build the same three brand blocks a preset gets, but for an arbitrary hex,
// under [data-accent="custom"]. Injected/updated into its own <style> so it can
// change at runtime without rebuilding the whole theme sheet.
const customAccentCss = (hex) => {
  const base = normalizeHex(hex) || DEFAULT_CUSTOM;
  const light = brandFor(base, false);
  const dark = brandFor(base, true);
  return (
    cssBlock(`:root[data-accent="custom"]`, BRAND_KEYS, light) +
    cssBlock(`:root[data-accent="custom"][data-theme="dark"]`, BRAND_KEYS, dark) +
    `@media (prefers-color-scheme: dark){${cssBlock(`:root[data-accent="custom"]:not([data-theme="light"])`, BRAND_KEYS, dark)}}`
  );
};

function injectCustomAccent(hex) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('accent-custom');
  if (!el) {
    el = document.createElement('style');
    el.id = 'accent-custom';
    document.head.appendChild(el);
  }
  el.textContent = customAccentCss(hex);
}

export function getCustomAccentHex() {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM;
  return normalizeHex(localStorage.getItem(CUSTOM_KEY)) || DEFAULT_CUSTOM;
}

// Resolve a CSS variable to its computed value (for <canvas>, which can't use
// var()). Falls back to the light hex if the DOM isn't available yet.
export function cssVar(name) {
  if (typeof window === 'undefined' || !document.documentElement) {
    return LIGHT[name.replace(/^--/, '')] || '';
  }
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || LIGHT[name.replace(/^--/, '')] || '';
}

export function getThemeMode() {
  if (typeof window === 'undefined') return 'system';
  return localStorage.getItem(THEME_KEY) || 'system';
}

export function effectiveTheme() {
  const mode = getThemeMode();
  if (mode === 'light' || mode === 'dark') return mode;
  return typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else root.removeAttribute('data-theme');
}

export function setThemeMode(mode) {
  if (typeof window !== 'undefined') {
    if (mode === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  }
  applyTheme(mode);
}

export function getAccent() {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT;
}

export function applyAccent(id) {
  if (typeof document === 'undefined') return;
  const acc = id || DEFAULT_ACCENT;
  if (acc === CUSTOM_ACCENT) injectCustomAccent(getCustomAccentHex());
  document.documentElement.setAttribute('data-accent', acc);
}

export function setAccent(id) {
  if (typeof window !== 'undefined') localStorage.setItem(ACCENT_KEY, id);
  applyAccent(id);
}

// Pick an arbitrary color. Persists the hex, switches the accent to "custom",
// and re-injects the custom brand block so the whole UI re-tints live.
export function setCustomAccent(hex) {
  const norm = normalizeHex(hex);
  if (typeof window !== 'undefined') {
    if (norm) localStorage.setItem(CUSTOM_KEY, norm);
    localStorage.setItem(ACCENT_KEY, CUSTOM_ACCENT);
  }
  injectCustomAccent(norm || getCustomAccentHex());
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-accent', CUSTOM_ACCENT);
}

// Inject the palette variables once and apply the saved theme + accent. Runs on
// import so the variables exist before any component paints (no flash).
if (typeof document !== 'undefined') {
  if (!document.getElementById('theme-vars')) {
    const style = document.createElement('style');
    style.id = 'theme-vars';
    style.textContent = THEME_CSS;
    document.head.appendChild(style);
  }
  applyTheme(getThemeMode());
  applyAccent(getAccent());
}
