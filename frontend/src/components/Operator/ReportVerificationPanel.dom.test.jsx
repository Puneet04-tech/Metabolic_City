import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReportVerificationPanel from './ReportVerificationPanel.jsx';

const report = (alertKey, verification, extra = {}) => ({
  alertKey,
  h3Index: '883d914f17fffff',
  type: 'REPORT',
  title: 'Flooding and waterlogging',
  severity: 8,
  status: 'OPEN',
  verification,
  evidenceCount: 1,
  ...extra,
});

describe('ReportVerificationPanel', () => {
  it('shows every verification state with an explicit empty message', () => {
    render(<ReportVerificationPanel alerts={[]} />);

    expect(
      screen.getByText(/No citizen or field reports in the current alert window/)
    ).toBeTruthy();
    for (const label of ['Unverified', 'Corroborated', 'Field verified']) {
      const state = screen.getByText(label, { selector: 'dt' }).closest('[data-state]');
      expect(within(state).getByText('0')).toBeTruthy();
    }
  });

  it('shows unverified, corroborated and field-verified reports', () => {
    render(
      <ReportVerificationPanel
        alerts={[
          report('report-1', 'UNVERIFIED'),
          report('report-2', 'CORROBORATED', { evidenceCount: 2 }),
          report('report-3', 'VERIFIED', { title: 'Crew-confirmed flooding' }),
        ]}
      />
    );

    expect(screen.getByText('Crew-confirmed flooding')).toBeTruthy();
    expect(screen.getAllByText('Flooding and waterlogging')).toHaveLength(2);
    expect(screen.getByText(/2 reports/)).toBeTruthy();
    for (const label of ['Unverified', 'Corroborated', 'Field verified']) {
      const state = screen.getByText(label, { selector: 'dt' }).closest('[data-state]');
      expect(within(state).getByText('1')).toBeTruthy();
    }
  });
});
