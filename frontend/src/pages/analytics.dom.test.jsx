import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast/Toast';

const summary = {
  threshold: 7,
  statusCounts: [
    { _id: 'APPROVED', count: 3, averageRisk: 7.4, maxRisk: 8.1 },
    { _id: 'RESOLVED', count: 5, averageRisk: 5.2, maxRisk: 7.2 },
  ],
  incidents: [
    {
      _id: 'incident-1',
      h3Index: '883d914f17bffff',
      status: 'RESOLVED',
      riskScore: 7.8,
      detectedAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
      operatorDecisionAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      dispatchText: 'Water on the main road.',
    },
    {
      _id: 'incident-2',
      h3Index: '883d914f05ffff',
      status: 'APPROVED',
      riskScore: 2.1,
      detectedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
    {
      _id: 'incident-3',
      h3Index: '883d914f21ffff',
      status: 'RESOLVED',
      riskScore: 5.4,
      detectedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  auditLogs: [{ _id: 'audit-1', action: 'INCIDENT_APPROVED', entityType: 'incident', entityId: 'incident-1', createdAt: new Date().toISOString() }],
  metrics: { totalIncidents: 2, resolved: 1, resolutionRate: 50 },
};

const apiRequest = vi.fn();

vi.mock('../api.js', () => ({
  apiRequest: (...args) => apiRequest(...args),
  clearSession: vi.fn(),
  getStoredUser: () => ({ name: 'Asha Rao', role: 'operator', cityCode: 'CITY-IND-BPL8' }),
  getNavItems: () => [],
}));

const { default: Analytics } = await import('./Analytics.jsx');
const { default: ChartFrame } = await import('../components/analytics/ChartFrame');

const renderAt = (ui, path = '/analytics') =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </ToastProvider>
  );

describe('Analytics', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path) => {
      if (path.includes('telemetry-volume')) return Promise.resolve({ period: 'last_24h', data: [] });
      if (path.includes('risk-heatmap')) return Promise.resolve({ count: 0, cells: [] });
      return Promise.resolve(summary);
    });
  });

  it('shows the key numbers with a period and a comparison', async () => {
    renderAt(<Analytics />);

    await waitFor(() => expect(screen.getByText('Incidents')).toBeTruthy());
    expect(screen.getByText('Resolution rate')).toBeTruthy();
    expect(screen.getByText('Time to approve')).toBeTruthy();
    expect(screen.getByText('Critical share')).toBeTruthy();
    // The delta is only shown when the previous period has data to compare with.
    expect(screen.getAllByText('vs previous period').length).toBeGreaterThan(0);
  });

  it('asks the question each chart answers', async () => {
    renderAt(<Analytics />);

    await waitFor(() => expect(screen.getByText('How many incidents were raised each day in this range?')).toBeTruthy());
    expect(screen.getByText('Where do the incidents sit in the response pipeline?')).toBeTruthy();
    expect(screen.getByText('How many readings arrived each hour, and from which source?')).toBeTruthy();
  });

  it('keeps the filters in the address', async () => {
    renderAt(<Analytics />, '/analytics?status=APPROVED&from=2026-01-01&to=2026-01-31');

    await waitFor(() => expect(screen.getByText('Incidents')).toBeTruthy());
    const status = screen.getByLabelText('Status');
    expect(status.value).toBe('APPROVED');
  });

  it('shows the table alternative for a chart', async () => {
    renderAt(<Analytics />);

    await waitFor(() => expect(screen.getByText('View as table')).toBeTruthy());
    const buttons = screen.getAllByText('View as table');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows an empty state when a chart has no data', async () => {
    renderAt(<Analytics />);

    await waitFor(() => expect(screen.getByText('No critical incidents in this range')).toBeTruthy());
  });

  it('surfaces an error with a retry', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('The service is unavailable.'), { status: 503 }));
    renderAt(<Analytics />);

    await waitFor(() => expect(screen.getByText('Analytics could not be loaded')).toBeTruthy());
  });
});

describe('ChartFrame', () => {
  it('shows the empty state instead of a chart when there is no data', () => {
    render(
      <ChartFrame
        title="Incidents per day"
        question="How many incidents were raised each day?"
        columns={[{ key: 'a', header: 'A' }]}
        rows={[]}
        emptyTitle="Nothing here"
      >
        <div>chart</div>
      </ChartFrame>
    );

    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.queryByText('chart')).toBeNull();
  });

  it('offers the table alternative when there is data', () => {
    render(
      <ChartFrame title="Incidents per day" question="How many?" columns={[{ key: 'a', header: 'A' }]} rows={[{ a: 1 }]}>
        <div>chart</div>
      </ChartFrame>
    );

    expect(screen.getByText('View as table')).toBeTruthy();
    expect(screen.getByText('chart')).toBeTruthy();
  });
});
