/**
 * Chart theme — one place that reads the design tokens and hands them to
 * Recharts. The cache is keyed by the active theme, so switching between the
 * ink and paper surfaces updates every chart without a reload.
 */

const TOKEN_NAMES = [
  '--critical',
  '--caution',
  '--normal',
  '--accent',
  '--accent-soft',
  '--text-primary',
  '--text-secondary',
  '--text-disabled',
  '--border',
  '--border-strong',
  '--surface',
  '--surface-raised',
  '--shadow-overlay',
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

export const getChartTheme = () => {
  const key = themeKey();
  if (cachedTheme && cachedKey === key) return cachedTheme;

  const tokens = readTokens();

  cachedTheme = {
    tokens,
    colors: {
      critical: tokens['--critical'],
      caution: tokens['--caution'],
      normal: tokens['--normal'],
      accent: tokens['--accent'],
      info: tokens['--accent'],
      neutral: tokens['--text-disabled'],
    },
    grid: {
      stroke: tokens['--border'],
      strokeDasharray: '2 4',
    },
    axis: {
      stroke: tokens['--text-secondary'],
      tick: { fill: tokens['--text-secondary'], fontSize: 11 },
    },
    tooltip: {
      contentStyle: {
        backgroundColor: tokens['--surface-raised'],
        border: `1px solid ${tokens['--border-strong']}`,
        borderRadius: '8px',
        color: tokens['--text-primary'],
        fontSize: 12,
        boxShadow: tokens['--shadow-overlay'],
      },
      itemStyle: { color: tokens['--text-primary'] },
      labelStyle: { color: tokens['--text-secondary'] },
      cursor: { fill: tokens['--accent-soft'] },
    },
    empty: {
      text: tokens['--text-secondary'],
    },
  };
  cachedKey = key;

  return cachedTheme;
};

/** Severity → colour, used by every chart that plots risk bands. */
export const severityColor = (severity) => {
  const { colors } = getChartTheme();
  return colors[severity] ?? colors.neutral;
};
