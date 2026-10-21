/**
 * Map theme — one place that reads the design tokens and hands them to
 * Leaflet. Replaces the palette that was hard-coded inside the map component.
 */

const TOKEN_NAMES = [
  '--critical',
  '--caution',
  '--normal',
  '--accent',
  '--accent-soft',
  '--accent-grid',
  '--accent-label',
  '--text-primary',
  '--text-secondary',
  '--border',
  '--border-strong',
  '--surface',
  '--surface-raised',
  '--surface-scrim',
  '--map-tile-filter',
  '--bg',
];

/**
 * When there is no document (SSR or a test), the theme falls back to
 * `currentColor` rather than duplicating hex values here. The tokens file is
 * the only place a colour literal may live.
 */
const FALLBACK = Object.fromEntries(TOKEN_NAMES.map((name) => [name, 'currentColor']));

let cachedTheme = null;

const readTokens = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { ...FALLBACK };
  const computed = getComputedStyle(document.documentElement);
  const tokens = { ...FALLBACK };
  for (const name of TOKEN_NAMES) {
    const value = computed.getPropertyValue(name).trim();
    if (value) tokens[name] = value;
  }
  return tokens;
};

export const getMapTheme = () => {
  if (cachedTheme) return cachedTheme;

  const tokens = readTokens();

  cachedTheme = {
    tokens,
    severity: {
      critical: tokens['--critical'],
      caution: tokens['--caution'],
      normal: tokens['--normal'],
    },
    selectedStroke: tokens['--text-primary'],
    accent: tokens['--accent'],
    grid: {
      stroke: tokens['--accent'],
      gridStroke: tokens['--accent-grid'],
      label: tokens['--accent-label'],
    },
    attribution: {
      background: tokens['--surface-scrim'],
      color: tokens['--text-secondary'],
    },
    tile: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      // The public tile set is light; a single filter on the tile layer keeps
      // the map inside the dark palette without touching the tile source.
      filter: tokens['--map-tile-filter'],
    },
  };

  return cachedTheme;
};
/** Severity → hex, for the canvas cell layer. */
export const severityHex = (severity) => {
  const { severity: palette } = getMapTheme();
  return palette[severity] ?? palette.normal;
};
