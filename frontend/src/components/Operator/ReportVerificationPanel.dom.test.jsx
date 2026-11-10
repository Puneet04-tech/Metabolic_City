import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('expands a report to show each reporter and its timestamp', () => {
    const onSelect = vi.fn();
    const corroborated = report('report-2', 'CORROBORATED', {
      evidenceCount: 2,
      firstSeenAt: '2026-11-10T10:01:00.000Z',
      evidence: [
        {
          reporter: 'Resident 1',
          kind: 'RESIDENT',
          at: '2026-11-10T10:01:00.000Z',
        },
        {
          reporter: 'Resident 2',
          kind: 'RESIDENT',
          at: '2026-11-10T10:06:00.000Z',
        },
      ],
    });

    const { container } = render(
      <ReportVerificationPanel alerts={[corroborated]} onSelect={onSelect} />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Show evidence for Flooding and waterlogging/,
      })
    );

    expect(screen.getByText('Reporter evidence')).toBeTruthy();
    expect(screen.getByText('2 distinct reporters')).toBeTruthy();
    expect(screen.getByText('Resident 1')).toBeTruthy();
    expect(screen.getByText('Resident 2')).toBeTruthy();
    expect(screen.getAllByText('Citizen report')).toHaveLength(2);

    const times = [...container.querySelectorAll('time')];
    expect(times.map((time) => time.getAttribute('datetime'))).toEqual([
      '2026-11-10T10:01:00.000Z',
      '2026-11-10T10:06:00.000Z',
      '2026-11-10T10:01:00.000Z',
      '2026-11-10T10:06:00.000Z',
    ]);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Open cell/ }));
    expect(onSelect).toHaveBeenCalledWith(corroborated);

    fireEvent.click(
      screen.getByRole('button', {
        name: /Hide evidence for Flooding and waterlogging/,
      })
    );
    expect(screen.queryByText('Reporter evidence')).toBeNull();
  });

  it('labels a field crew report as field verified evidence', () => {
    const verified = report('report-3', 'VERIFIED', {
      firstSeenAt: '2026-11-10T10:12:00.000Z',
      evidence: [
        {
          reporter: 'Field crew',
          kind: 'FIELD_CREW',
          at: '2026-11-10T10:12:00.000Z',
        },
      ],
    });

    render(<ReportVerificationPanel alerts={[verified]} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: /Show evidence for Flooding and waterlogging/,
      })
    );

    expect(screen.getByText('Field crew')).toBeTruthy();
    expect(screen.getByText('Field verified report')).toBeTruthy();
    expect(screen.getByText('1 distinct reporter')).toBeTruthy();
  });

  it('explains when an older alert has no retained reporter evidence', () => {
    render(
      <ReportVerificationPanel
        alerts={[report('legacy', 'CORROBORATED', { evidenceCount: 2 })]}
      />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Show evidence for Flooding and waterlogging/,
      })
    );

    expect(
      screen.getByText(/No reporter-level evidence was retained/)
    ).toBeTruthy();
  });
});
