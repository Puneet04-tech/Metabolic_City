import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import OperatorConsole from './OperatorConsole.jsx';
import SummaryStrip from '../components/Operator/SummaryStrip';
import CellList from '../components/Operator/CellList';
import CellDetail from '../components/Operator/CellDetail';
import { cellBand, cellBandFor, cellScore, countByBand, sortCells } from '../lib/cells/index.js';

const render = (element) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

const cell = (id, risk, extra = {}) => ({
  h3Index: id,
  compositeRisk: risk,
  scores: { mobility: 1.6, climate: 0.2, vulnerability: 0, ...extra.scores },
  trend: 'STABLE',
  riskVelocity: 0,
  history: [],
  lastUpdated: new Date().toISOString(),
  ...extra,
});

describe('OperatorConsole', () => {
  it('renders the shell, the toolbar and the panel', () => {
    const html = render(<OperatorConsole />);
    expect(html).toContain('Operator console');
    expect(html).toContain('Search cells');
    expect(html).toContain('Composite');
    expect(html).toContain('Vulnerability');
    expect(html).toContain('Risk summary');
  });
});

describe('SummaryStrip', () => {
  const counts = { critical: 2, caution: 3, normal: 40 };

  it('shows the three bands as toggles with their counts', () => {
    const html = render(<SummaryStrip counts={counts} total={45} activeFilters={new Set()} onToggle={() => {}} />);
    expect(html).toContain('Critical');
    expect(html).toContain('Caution');
    expect(html).toContain('Normal');
    expect(html).toContain('40');
  });

  it('says so in one line when there are no critical cells', () => {
    const html = render(
      <SummaryStrip counts={{ critical: 0, caution: 3, normal: 40 }} total={43} activeFilters={new Set()} onToggle={() => {}} />
    );
    expect(html).toContain('No critical cells');
  });

  it('describes the proportions for screen readers', () => {
    const html = render(<SummaryStrip counts={counts} total={45} activeFilters={new Set()} onToggle={() => {}} />);
    expect(html).toContain('45 cells: 2 critical, 3 caution, 40 normal');
  });
});

describe('CellList', () => {
  const cells = [cell('883d914f17bffff', 7.4), cell('883d914f05ffff', 0.6)];

  it('shows the cell name, the score and the identifier', () => {
    const html = render(
      <CellList cells={cells} mode="composite" threshold={7} sort={{ key: 'score', direction: 'desc' }} onSortChange={() => {}} onSelect={() => {}} />
    );
    expect(html).toContain('883d…fff');
    expect(html).toContain('7.40');
    expect(html).toContain('0.60');
  });

  it('shows the filtered count only when a filter is applied', () => {
    const filtered = render(
      <CellList cells={cells} mode="composite" threshold={7} sort={{ key: 'score', direction: 'desc' }} onSortChange={() => {}} onSelect={() => {}} filtered total={74} />
    );
    expect(filtered).toContain('Showing 2 of 74 cells');

    const unfiltered = render(
      <CellList cells={cells} mode="composite" threshold={7} sort={{ key: 'score', direction: 'desc' }} onSortChange={() => {}} onSelect={() => {}} total={74} />
    );
    expect(unfiltered).not.toContain('Showing');
  });

  it('shows an empty state when nothing matches', () => {
    const html = render(
      <CellList cells={[]} mode="composite" threshold={7} sort={{ key: 'score', direction: 'desc' }} onSortChange={() => {}} onSelect={() => {}} />
    );
    expect(html).toContain('No cells match');
  });
});

describe('CellDetail', () => {
  const selected = cell('883d914f17bffff', 7.4, { trendDisplay: 'Rising' });

  it('shows the breakdown with full labels', () => {
    const html = render(
      <CellDetail cell={selected} mode="composite" threshold={7} onBack={() => {}} onLock={() => {}} onDecide={() => {}} />
    );
    expect(html).toContain('Composite risk');
    expect(html).toContain('Mobility');
    expect(html).toContain('Climate');
    expect(html).toContain('Vulnerability');
  });

  it('offers the lock before any decision', () => {
    const html = render(
      <CellDetail cell={selected} mode="composite" threshold={7} onBack={() => {}} onLock={() => {}} onDecide={() => {}} />
    );
    expect(html).toContain('Claim 60-second lock');
  });

  it('offers approve and override once a lock is held', () => {
    const html = render(
      <CellDetail
        cell={selected}
        mode="composite"
        threshold={7}
        action={{ action: { actionNarrative: 'Send crew', priority: 'High', recommendedResources: ['Crew 2'], dispatchText: 'Dispatch now' }, lock: { expiresAt: new Date().toISOString() } }}
        onBack={() => {}}
        onLock={() => {}}
        onDecide={() => {}}
      />
    );
    expect(html).toContain('Approve and dispatch');
    expect(html).toContain('Override alert');
  });

  it('says which real readings back the score', () => {
    const html = render(
      <CellDetail
        cell={cell('883d914f17bffff', 6.2, {
          telemetryStats: {
            sources: ['WEATHER_API', 'GIS_STATIC'],
            weatherEventsCount: 4,
            gisEventsCount: 1,
            lastObservedAt: new Date().toISOString(),
          },
        })}
        mode="composite"
        threshold={7}
        onBack={() => {}}
        onLock={() => {}}
        onDecide={() => {}}
      />
    );
    expect(html).toContain('What this score is made of');
    expect(html).toContain('Weather readings');
    expect(html).toContain('Terrain');
  });

  it('says when a cell is missing a measurement instead of hiding it', () => {
    const html = render(
      <CellDetail
        cell={cell('883d914f17bffff', 6.2, {
          degradationStatus: 'NO_MOBILITY_DATA',
          telemetryStats: { sources: ['WEATHER_API'], weatherEventsCount: 2 },
        })}
        mode="composite"
        threshold={7}
        onBack={() => {}}
        onLock={() => {}}
        onDecide={() => {}}
      />
    );
    expect(html).toContain('No road speed readings for this cell');
  });
});

describe('band counting and ordering', () => {
  it('counts each band for the active lens', () => {
    const cells = [cell('a', 8), cell('b', 5), cell('c', 1)];
    expect(countByBand(cells, 'composite', 7)).toEqual({ critical: 1, caution: 1, normal: 1 });
  });

  it('orders by risk then by identifier', () => {
    const cells = [cell('b', 1), cell('a', 1), cell('c', 5)];
    expect(sortCells(cells, 'composite').map((item) => item.h3Index)).toEqual(['c', 'a', 'b']);
  });

  it('classifies with the same thresholds as the API', () => {
    expect(cellBand(7, 7)).toBe('critical');
    expect(cellBand(5, 7)).toBe('caution');
    expect(cellBand(4.9, 7)).toBe('normal');
  });

  it('uses the risk level the server already classified', () => {
    const classified = { h3Index: 'a', compositeRisk: 6.2, riskLevel: 'CRITICAL' };
    expect(cellBandFor(classified, 'composite', 7)).toBe('critical');
    expect(cellBandFor({ h3Index: 'b', compositeRisk: 4.2, riskLevel: 'HIGH' }, 'composite', 7)).toBe('caution');
    expect(cellBandFor({ h3Index: 'c', compositeRisk: 4.2, riskLevel: 'LOW' }, 'composite', 7)).toBe('normal');
  });

  it('reads the composite score in composite mode', () => {
    expect(cellScore(cell('a', 4.2), 'composite')).toBe(4.2);
  });
});
