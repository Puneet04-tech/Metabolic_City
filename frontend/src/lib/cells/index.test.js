import { describe, expect, it } from 'vitest';
import {
  cellBand,
  cellScore,
  compareCells,
  countByBand,
  getCellLabel,
  shortenCellId,
  sortCells,
} from './index.js';

const makeCell = (h3Index, compositeRisk, scores = {}) => ({
  h3Index,
  compositeRisk,
  scores: { mobility: 0, climate: 0, vulnerability: 0, ...scores },
});

describe('cellScore', () => {
  it('uses the composite risk in composite mode', () => {
    expect(cellScore({ compositeRisk: 7.5 }, 'composite')).toBe(7.5);
  });

  it('uses the lens sub-score otherwise and coerces to a number', () => {
    const cell = { compositeRisk: 1, scores: { mobility: '4.5' } };
    expect(cellScore(cell, 'mobility')).toBe(4.5);
  });

  it('treats a missing sub-score as zero', () => {
    expect(cellScore({ compositeRisk: 1, scores: {} }, 'climate')).toBe(0);
  });
});

describe('cellBand', () => {
  it('classifies against the critical threshold', () => {
    expect(cellBand(7, 7)).toBe('critical');
    expect(cellBand(6.99, 7)).toBe('caution');
    expect(cellBand(5, 7)).toBe('caution');
    expect(cellBand(4.99, 7)).toBe('normal');
  });
});

describe('sortCells', () => {
  it('orders by risk descending', () => {
    const cells = [makeCell('a', 1), makeCell('b', 9), makeCell('c', 5)];
    expect(sortCells(cells, 'composite').map((cell) => cell.h3Index)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties by H3 id so the order is stable and explainable', () => {
    const cells = [makeCell('883d914f17bffff', 0.65), makeCell('883d914f05ffff', 0.65), makeCell('883d914f21ffff', 0.65)];
    expect(sortCells(cells, 'composite').map((cell) => cell.h3Index)).toEqual([
      '883d914f05ffff',
      '883d914f17bffff',
      '883d914f21ffff',
    ]);
  });

  it('produces the same order regardless of the input order', () => {
    const cells = [makeCell('c', 0.65), makeCell('a', 0.65), makeCell('b', 0.65)];
    const forward = sortCells(cells, 'composite').map((cell) => cell.h3Index);
    const reversed = sortCells([...cells].reverse(), 'composite').map((cell) => cell.h3Index);
    expect(forward).toEqual(reversed);
  });

  it('does not mutate the input array', () => {
    const cells = [makeCell('a', 1), makeCell('b', 9)];
    const snapshot = cells.map((cell) => cell.h3Index);
    sortCells(cells, 'composite');
    expect(cells.map((cell) => cell.h3Index)).toEqual(snapshot);
  });

  it('handles an empty or missing list', () => {
    expect(sortCells([], 'composite')).toEqual([]);
    expect(sortCells(undefined, 'composite')).toEqual([]);
  });

  it('sorts by the active lens', () => {
    const cells = [makeCell('a', 1, { mobility: 9 }), makeCell('b', 1, { mobility: 2 })];
    expect(sortCells(cells, 'mobility').map((cell) => cell.h3Index)).toEqual(['a', 'b']);
  });
});

describe('compareCells', () => {
  it('returns 0 for identical cells', () => {
    const cell = makeCell('a', 1);
    expect(compareCells(cell, { ...cell }, 'composite')).toBe(0);
  });
});

describe('countByBand', () => {
  it('counts each severity band', () => {
    const cells = [makeCell('a', 8), makeCell('b', 5), makeCell('c', 1), makeCell('d', 7)];
    expect(countByBand(cells, 'composite', 7)).toEqual({ critical: 2, caution: 1, normal: 1 });
  });

  it('returns zeroed counts for no cells', () => {
    expect(countByBand([], 'composite', 7)).toEqual({ critical: 0, caution: 0, normal: 0 });
  });
});

describe('shortenCellId', () => {
  it('shortens a long id and keeps both ends', () => {
    expect(shortenCellId('883d914f17bffff')).toBe('883d…fff');
  });

  it('leaves a short id untouched', () => {
    expect(shortenCellId('abc')).toBe('abc');
  });

  it('handles a missing id', () => {
    expect(shortenCellId(undefined)).toBe('');
  });
});

describe('getCellLabel', () => {
  it('prefers a real locality when the data has one', () => {
    expect(getCellLabel({ h3Index: '883d914f17bffff', locality: 'Zone 4' })).toBe('Zone 4');
  });

  it('uses a lookup when one is supplied', () => {
    const lookup = (cell) => (cell.h3Index === 'x' ? 'Ward 7' : null);
    expect(getCellLabel({ h3Index: 'x' }, lookup)).toBe('Ward 7');
  });

  it('falls back to the shortened id and never invents a name', () => {
    expect(getCellLabel({ h3Index: '883d914f17bffff' })).toBe('883d…fff');
  });

  it('handles a missing cell', () => {
    expect(getCellLabel(null)).toBe('');
  });
});
