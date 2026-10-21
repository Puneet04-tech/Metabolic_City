import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import OperatorConsole from './pages/OperatorConsole.jsx';
import Landing from './pages/Landing.jsx';
import SignIn from './pages/SignIn.jsx';
import { ToastProvider } from './components/ui/Toast/Toast';

vi.mock('./api.js', () => ({
  apiRequest: vi.fn(async (path) => {
    if (path.includes('/weights')) return { weights: { Wm: 0.4, Wc: 0.4, Wv: 0.2 }, threshold: 7 };
    if (path.includes('audit-logs')) return { count: 0, logs: [] };
    if (path.includes('/users')) return { users: [] };
    if (path.includes('field/tasks')) return { count: 0, incidents: [] };
    if (path.includes('/v1/incidents/')) {
      return {
        incident: {
          _id: 'inc-1',
          h3Index: '883d914f17bffff',
          status: 'ACKNOWLEDGED',
          priority: 'HIGH',
          riskScore: 6.4,
          detectedAt: new Date().toISOString(),
          action: {
            actionNarrative: 'Water is backing up on the main road.',
            priority: 'HIGH',
            recommendedResources: ['Pump crew', 'Sandbags'],
            dispatchText: 'Attend the junction and clear the drain.',
          },
        },
      };
    }
    if (path.includes('analytics/summary')) {
      return { threshold: 7, statusCounts: [], incidents: [], auditLogs: [], metrics: {} };
    }
    return { count: 0, incidents: [] };
  }),
  clearSession: vi.fn(),
  getStoredUser: () => ({ name: 'Asha Rao', role: 'administrator', cityCode: 'CITY-IND-BPL8' }),
  getNavItems: () => [],
}));

vi.mock('./lib/fieldOutbox.js', () => ({
  enqueueFieldUpdate: vi.fn(),
  flushFieldOutbox: vi.fn(),
  getPendingFieldUpdates: vi.fn(async () => 0),
}));

const { default: FieldTasks } = await import('./pages/FieldTasks.jsx');
const { default: FieldTaskDetail } = await import('./pages/FieldTaskDetail.jsx');
const { default: CitizenReport } = await import('./pages/CitizenReport.jsx');
const { default: Analytics } = await import('./pages/Analytics.jsx');
const { default: Admin } = await import('./pages/Admin.jsx');
const { default: SignUp } = await import('./pages/SignUp.jsx');
const { default: NotFound } = await import('./pages/NotFound.jsx');
const { default: Unauthorized } = await import('./pages/Unauthorized.jsx');

/**
 * Automated accessibility check of the migrated surfaces.
 * axe-core runs in jsdom; serious and critical violations fail the test.
 */
const check = async (element) => {
  const results = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  });
  return results.violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`);
};

describe('accessibility', () => {
  it('has no serious or critical violations on the operator console', async () => {
    const { container } = render(
      <MemoryRouter>
        <OperatorConsole />
      </MemoryRouter>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the landing page', async () => {
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the sign-in page', async () => {
    const { container } = render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the field task list', async () => {
    const { container } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/field']}>
          <FieldTasks />
        </MemoryRouter>
      </ToastProvider>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the citizen report', async () => {
    const data = encodeURIComponent(JSON.stringify({ locationId: 'LOC-001', cityCode: 'CITY-IND-BPL8' }));
    const { container } = render(
      <MemoryRouter initialEntries={[`/citizen-report?data=${data}`]}>
        <CitizenReport />
      </MemoryRouter>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the analytics page', async () => {
    const { container } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/analytics']}>
          <Analytics />
        </MemoryRouter>
      </ToastProvider>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the admin page', async () => {
    const { container } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Admin />
        </MemoryRouter>
      </ToastProvider>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the field task detail', async () => {
    const { container } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/field/tasks/inc-1']}>
          <Routes>
            <Route path="/field/tasks/:id" element={<FieldTaskDetail />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the sign-up page', async () => {
    const { container } = render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the not-found page', async () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(await check(container)).toEqual([]);
  });

  it('has no serious or critical violations on the unauthorized page', async () => {
    const { container } = render(
      <MemoryRouter>
        <Unauthorized />
      </MemoryRouter>
    );
    expect(await check(container)).toEqual([]);
  });
});
