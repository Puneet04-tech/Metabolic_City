import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast/Toast';

const weights = { Wm: 0.4, Wc: 0.4, Wv: 0.2 };

const apiRequest = vi.fn();

vi.mock('../api.js', () => ({
  apiRequest: (...args) => apiRequest(...args),
  clearSession: vi.fn(),
  getStoredUser: () => ({ name: 'Admin Rao', role: 'administrator', cityCode: 'CITY-IND-BPL8' }),
  getNavItems: () => [],
}));

const { default: Admin } = await import('./Admin.jsx');
const { default: ThresholdForm } = await import('../components/admin/ThresholdForm');
const { default: UsersPanel } = await import('../components/admin/UsersPanel');
const { default: StatusDot } = await import('../components/ui/StatusDot/StatusDot');

const renderAt = (ui, path = '/admin') =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </ToastProvider>
  );

describe('Admin', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path) => {
      if (path.includes('/weights')) return Promise.resolve({ weights, threshold: 7 });
      if (path.includes('audit-logs')) return Promise.resolve({ count: 0, logs: [] });
      if (path.includes('/users')) return Promise.resolve({ users: [] });
      if (path.includes('analytics/summary')) {
        return Promise.resolve({ threshold: 7, statusCounts: [], incidents: [], auditLogs: [], metrics: {} });
      }
      if (path.includes('field/tasks')) return Promise.resolve({ count: 0, incidents: [] });
      return Promise.resolve({});
    });
  });

  it('shows the sub-navigation and the threshold form by default', async () => {
    renderAt(<Admin />);

    await waitFor(() => expect(screen.getAllByText('Risk thresholds').length).toBeGreaterThan(0));
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('QR codes')).toBeTruthy();
    expect(screen.getByText('System performance')).toBeTruthy();
    expect(screen.getByLabelText('Mobility weight')).toBeTruthy();
  });

  it('opens the users section from the address', async () => {
    renderAt(<Admin />, '/admin?section=users');

    await waitFor(() =>
      expect(screen.getByText(/Deactivating a user keeps their history/)).toBeTruthy()
    );
  });
});

describe('ThresholdForm', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path) => {
      if (path.includes('audit-logs')) return Promise.resolve({ count: 0, logs: [] });
      if (path.includes('/weights')) return Promise.resolve({ weights, threshold: 7 });
      return Promise.resolve({});
    });
  });

  it('validates that the weights add up to one', async () => {
    renderAt(<ThresholdForm />);

    await waitFor(() => expect(screen.getByText('Weights total 1.00 of 1.00')).toBeTruthy());
    expect(screen.queryByText('Fix this before saving')).toBeNull();
  });

  it('refuses a critical threshold below the caution band', async () => {
    renderAt(<ThresholdForm />);

    await waitFor(() => expect(screen.getByLabelText('Critical threshold')).toBeTruthy());
    const input = screen.getByLabelText('Critical threshold');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(input, { target: { value: '4' } });

    await waitFor(() =>
      expect(screen.getByText(/must be above the caution band/)).toBeTruthy()
    );
  });

  it('previews the effect of a change', async () => {
    apiRequest.mockImplementation((path, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          criticalCountCurrent: 4,
          criticalCountProjected: 9,
          preview: [
            {
              h3Index: '883d914f17bffff',
              currentRiskLevel: 'NORMAL',
              projectedRiskLevel: 'CRITICAL',
            },
          ],
        });
      }
      if (path.includes('audit-logs')) return Promise.resolve({ count: 0, logs: [] });
      return Promise.resolve({ weights, threshold: 7 });
    });

    renderAt(<ThresholdForm />);

    await waitFor(() => expect(screen.getByText('Preview the effect')).toBeTruthy());
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByText('Preview the effect'));

    await waitFor(() => expect(screen.getByText('Critical after')).toBeTruthy());
    expect(screen.getByText('Cells changing band')).toBeTruthy();
  });
});

describe('UsersPanel', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({
      users: [
        { _id: 'u1', name: 'Asha Rao', email: 'asha@example.gov', role: 'operator', active: true, cityCode: 'CITY-IND-BPL8' },
        { _id: 'u2', name: 'Vikram Das', email: 'vikram@example.gov', role: 'field_crew', active: false, cityCode: 'CITY-IND-BPL8' },
      ],
    });
  });

  it('lists the users with their role and status', async () => {
    renderAt(<UsersPanel />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeTruthy());
    expect(screen.getByText('Vikram Das')).toBeTruthy();
    expect(screen.getAllByText('Operator').length).toBeGreaterThan(0);
    expect(screen.getByText('Deactivated')).toBeTruthy();
  });

  it('filters by role', async () => {
    renderAt(<UsersPanel />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeTruthy());
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: 'field_crew' } });

    await waitFor(() => expect(screen.queryByText('Asha Rao')).toBeNull());
    expect(screen.getByText('Vikram Das')).toBeTruthy();
  });
});

describe('StatusDot', () => {
  it('pairs the dot with a label', () => {
    const { container } = render(<StatusDot status="healthy" label="All clear" />);
    expect(container.textContent).toContain('All clear');
    expect(container.querySelector('[data-status="healthy"]')).toBeTruthy();
  });
});
