/**
 * Chart theme — one place that reads the design tokens and hands them to
 * Recharts. The four chart modules used to carry their own copies of the
 * palette, the axis colours and the tooltip style.
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

export const getChartTheme = () => {
  if (cachedTheme) return cachedTheme;

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
      strokeDasharray: '3 3',
    },
    axis: {
      stroke: tokens['--text-secondary'],
      tick: { fill: tokens['--text-secondary'], fontSize: 12 },
    },
    tooltip: {
      contentStyle: {
        backgroundColor: tokens['--surface-raised'],
        border: `1px solid ${tokens['--border-strong']}`,
        borderRadius: '8px',
        color: tokens['--text-primary'],
        fontSize: 13,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
      },
      itemStyle: { color: tokens['--text-primary'] },
      labelStyle: { color: tokens['--text-secondary'] },
      cursor: { fill: tokens['--accent-soft'] },
    },
    empty: {
      text: tokens['--text-secondary'],
    },
  };

  return cachedTheme;
};

/** Severity → colour, used by every chart that plots risk bands. */
export const severityColor = (severity) => {
  const { colors } = getChartTheme();
  return colors[severity] ?? colors.neutral;
};
