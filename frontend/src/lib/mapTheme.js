/**
 * Map theme — one place that reads the design tokens and hands them to
 * Leaflet. The cache is keyed by the active theme so the tile filter and cell
 * layer can be refreshed when the user switches surfaces.
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
  '--surface-sunken',
  '--map-tile-filter',
  '--relative-1',
  '--relative-2',
  '--relative-3',
  '--relative-4',
  '--relative-5',
  '--bg',
];

const FALLBACK = Object.fromEntries(TOKEN_NAMES.map((name) => [name, 'currentColor']));

let cachedTheme = null;
let cachedKey = null;

const themeKey = () =>
  typeof document === 'undefined'
    ? 'dark'
    : document.documentElement.dataset.theme || 'dark';

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
  const key = themeKey();
  if (cachedTheme && cachedKey === key) return cachedTheme;

  const tokens = readTokens();

  cachedTheme = {
    tokens,
    severity: {
      critical: tokens['--critical'],
      caution: tokens['--caution'],
      normal: tokens['--normal'],
    },
    relative: [
      tokens['--relative-1'],
      tokens['--relative-2'],
      tokens['--relative-3'],
      tokens['--relative-4'],
      tokens['--relative-5'],
    ],
    selectedStroke: tokens['--text-primary'],
    accent: tokens['--accent'],
    outline: tokens['--surface-sunken'],
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
      filter: tokens['--map-tile-filter'],
    },
  };
  cachedKey = key;

  return cachedTheme;
};

/** Severity → hex, for the canvas cell layer. */
export const severityHex = (severity) => {
  const { severity: palette } = getMapTheme();
  return palette[severity] ?? palette.normal;
};
