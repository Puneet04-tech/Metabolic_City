import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Admin from './Admin.jsx';
import Analytics from './Analytics.jsx';
import FieldTaskDetail from './FieldTaskDetail.jsx';
import FieldTasks from './FieldTasks.jsx';
import Landing from './Landing.jsx';
import NotFound from './NotFound.jsx';
import OperatorConsole from './OperatorConsole.jsx';
import SignIn from './SignIn.jsx';
import SignUp from './SignUp.jsx';
import Unauthorized from './Unauthorized.jsx';
import { ToastProvider } from '../components/ui/Toast/Toast';

vi.mock('../api.js', () => ({
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
            recommendedResources: ['Pump crew'],
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

vi.mock('../lib/fieldOutbox.js', () => ({
  enqueueFieldUpdate: vi.fn(),
  flushFieldOutbox: vi.fn(),
  getPendingFieldUpdates: vi.fn(async () => 0),
}));

const headingLevels = (container) =>
  Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((node) => Number(node.tagName.slice(1)));

/**
 * Every route must have exactly one level-one heading, and the levels must
 * never skip a step. The app bar carries the heading for the authenticated
 * routes, so a page that renders its own must pass `titleAs="span"`.
 */
const checkHeadings = (container) => {
  const levels = headingLevels(container);
  const problems = [];

  const h1Count = levels.filter((level) => level === 1).length;
  if (h1Count !== 1) problems.push(`expected exactly one h1, found ${h1Count}`);

  let previous = 0;
  for (const level of levels) {
    if (previous && level > previous + 1) {
      problems.push(`heading level jumped from h${previous} to h${level}`);
    }
    previous = level;
  }

  return problems;
};

const renderRoute = (element, path) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

describe('heading structure', () => {
  const cases = [
    ['the landing page', <Landing />, '/'],
    ['the sign-in page', <SignIn />, '/login'],
    ['the sign-up page', <SignUp />, '/signup'],
    ['the operator console', <OperatorConsole />, '/operator'],
    ['the field task list', <FieldTasks />, '/field'],
    ['the field task detail', <FieldTaskDetail />, '/field/tasks/inc-1'],
    ['the analytics page', <Analytics />, '/analytics'],
    ['the admin page', <Admin />, '/admin'],
    ['the unauthorized page', <Unauthorized />, '/unauthorized'],
    ['the not-found page', <NotFound />, '/nope-404'],
  ];

  for (const [name, element, path] of cases) {
    it(`has one h1 and no skipped levels on ${name}`, async () => {
      const { container } = renderRoute(element, path);
      // Some pages load their data first, so the heading appears a tick later.
      await waitFor(() => expect(checkHeadings(container)).toEqual([]));
    });
  }
});
