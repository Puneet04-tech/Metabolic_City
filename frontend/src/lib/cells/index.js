/**
 * Cell domain helpers.
 *
 * "Cell" is the primary term across the product: a cell is an H3 hexagon with
 * a composite risk score. Nothing in this module invents names — a locality
 * lookup can be plugged in through `getCellLabel`'s `lookup` seam.
 */

export const SEVERITY = {
  CRITICAL: 'critical',
  CAUTION: 'caution',
  NORMAL: 'normal',
};

/**
 * The risk engine fixes the caution band at 5. The critical threshold above
 * it is configurable per municipality, so it is never hard-coded here.
 */
export const CAUTION_THRESHOLD = 5;

/** The server's risk levels, mapped onto the product's three bands. */
const LEVEL_BAND = {
  CRITICAL: SEVERITY.CRITICAL,
  HIGH: SEVERITY.CAUTION,
  MODERATE: SEVERITY.NORMAL,
  LOW: SEVERITY.NORMAL,
};

/** The server's risk levels, as the labels an operator reads. */
const LEVEL_LABEL = {
  CRITICAL: 'Critical',
  HIGH: 'Caution',
  MODERATE: 'Normal',
  LOW: 'Normal',
};

export const riskLevelLabel = (level) => LEVEL_LABEL[String(level || '').toUpperCase()] ?? 'Normal';

export const cellScore = (cell, mode) =>
  mode === 'composite' ? cell.compositeRisk : Number(cell.scores?.[mode]) || 0;

export const cellBand = (value, threshold) =>
  value >= threshold ? SEVERITY.CRITICAL : value >= CAUTION_THRESHOLD ? SEVERITY.CAUTION : SEVERITY.NORMAL;

/**
 * The band of a cell.
 *
 * The server already classifies every cell with the municipality's configured
 * threshold, so that classification wins. The numeric fallback is only used
 * for payloads that carry no risk level.
 */
export const cellBandFor = (cell, mode, threshold) => {
  const level = String(cell?.riskLevel || '').toUpperCase();
  if (LEVEL_BAND[level]) return LEVEL_BAND[level];
  return cellBand(cellScore(cell, mode), threshold);
};

/** `883d914f17bffff` -> `883d…fff` */
export const shortenCellId = (id, head = 4, tail = 3) => {
  if (!id) return '';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
};

/**
 * The part of an H3 index that actually tells one cell from another.
 *
 * A resolution-8 index is fifteen characters. The first four are the
 * resolution-4 base cell, which is the same for every cell in a city, and
 * the last five are the reserved bits, which never change. The characters
 * in between carry the distinction, and the last two of them are the
 * resolution-8 digit itself.
 */
export const cellRef = (id) => {
  if (!id) return '';
  if (id.length < 12) return id;
  return `…${id.slice(5, 10)}`;
};

/**
 * The one place a cell's display name is produced.
 * Returns a real locality when the data (or a lookup) provides one, and
 * falls back to the shortened H3 id — never an invented name.
 */
export const getCellLabel = (cell, lookup) => {
  if (!cell) return '';
  if (cell.locality) return cell.locality;
  if (typeof lookup === 'function') {
    const resolved = lookup(cell);
    if (resolved) return resolved;
  }
  return shortenCellId(cell.h3Index);
};

/**
 * The score code for each lens, used for the column heading and the legend.
 */
export const LENS_CODES = {
  composite: 'Rc',
  mobility: 'Sm',
  climate: 'Sc',
  vulnerability: 'Sv',
};

export const LENS_NAMES = {
  composite: 'Composite risk',
  mobility: 'Mobility',
  climate: 'Climate',
  vulnerability: 'Vulnerability',
};

/**
 * The scale of a lens, so the legend can say what the colours mean.
 */
export const lensScale = (mode, threshold) => [
  { band: 'critical', label: 'Critical', text: `≥ ${threshold}` },
  { band: 'caution', label: 'Caution', text: `${CAUTION_THRESHOLD}–${threshold}` },
  { band: 'normal', label: 'Normal', text: `< ${CAUTION_THRESHOLD}` },
];

/**
 * Ordering used everywhere: risk first, then the most recently updated, then
 * the identifier. The last two steps are the tie-break, so two cells with the
 * same score never swap places between refreshes. They keep their direction
 * whichever way the risk is sorted.
 */
export const compareCells = (a, b, mode, direction = 'desc') => {
  const sign = direction === 'asc' ? 1 : -1;
  const risk = (cellScore(a, mode) - cellScore(b, mode)) * sign;
  if (risk) return risk;

  const updated = new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
  if (updated) return updated;

  const left = a.h3Index ?? '';
  const right = b.h3Index ?? '';
  if (left === right) return 0;
  return left.localeCompare(right);
};

export const sortCells = (cells, mode, direction = 'desc') =>
  [...(cells ?? [])].sort((a, b) => compareCells(a, b, mode, direction));

export const countByBand = (cells, mode, threshold) => {
  const counts = { critical: 0, caution: 0, normal: 0 };
  for (const cell of cells ?? []) counts[cellBandFor(cell, mode, threshold)] += 1;
  return counts;
};

/**
 * Where a cell sits in the ordering of the cells that share its band, as a
 * percentile between 0 and 1.
 *
 * This is only used when every cell is in the same band, where a severity
 * colour would say nothing. The result is a position, not a severity, and
 * the interface says so.
 */
export const percentileRanks = (cells, mode) => {
  const list = [...(cells ?? [])];
  if (!list.length) return new Map();

  const sorted = [...list].sort((a, b) => cellScore(a, mode) - cellScore(b, mode));
  const ranks = new Map();
  sorted.forEach((cell, index) => {
    ranks.set(cell.h3Index, sorted.length === 1 ? 1 : index / (sorted.length - 1));
  });
  return ranks;
};

/**
 * Whether every cell sits in the same band, which is the only case where a
 * percentile colouring says anything useful.
 */
export const allInOneBand = (cells, mode, threshold) => {
  const list = cells ?? [];
  if (list.length < 2) return false;
  const bands = new Set(list.map((cell) => cellBandFor(cell, mode, threshold)));
  return bands.size === 1;
};
