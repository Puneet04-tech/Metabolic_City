import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import OperatorConsole from './pages/OperatorConsole.jsx';
import Landing from './pages/Landing.jsx';
import SignIn from './pages/SignIn.jsx';
import { ToastProvider } from './components/ui/Toast/Toast';

vi.mock('./api.js', () => ({
  apiRequest: vi.fn(async () => ({ count: 0, incidents: [] })),
  clearSession: vi.fn(),
  getStoredUser: () => ({ name: 'Asha Rao', role: 'operator', cityCode: 'CITY-IND-BPL8' }),
  getNavItems: () => [],
}));

vi.mock('./lib/fieldOutbox.js', () => ({
  enqueueFieldUpdate: vi.fn(),
  flushFieldOutbox: vi.fn(),
  getPendingFieldUpdates: vi.fn(async () => 0),
}));

const { default: FieldTasks } = await import('./pages/FieldTasks.jsx');
const { default: CitizenReport } = await import('./pages/CitizenReport.jsx');

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
});
