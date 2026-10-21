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
 * Ordering used everywhere: risk first, then H3 id so cells with identical
 * risk keep a stable, explainable order.
 */
export const compareCells = (a, b, mode) => {
  const risk = cellScore(b, mode) - cellScore(a, mode);
  if (risk) return risk;

  const left = a.h3Index ?? '';
  const right = b.h3Index ?? '';
  if (left === right) return 0;
  return left.localeCompare(right);
};

export const sortCells = (cells, mode) => [...(cells ?? [])].sort((a, b) => compareCells(a, b, mode));

export const countByBand = (cells, mode, threshold) => {
  const counts = { critical: 0, caution: 0, normal: 0 };
  for (const cell of cells ?? []) counts[cellBandFor(cell, mode, threshold)] += 1;
  return counts;
};
