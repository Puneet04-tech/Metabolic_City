import {
  summarizeForecastPoints,
  summarizeHistoryBaseline,
} from '../../src/services/forecastAudit.js';

describe('forecast accuracy summary', () => {
  it('reports error, not just a count of forecasts', () => {
    const summary = summarizeForecastPoints([
      { minutes: 60, error: 1, verification: 'VERIFIED' },
      { minutes: 60, error: -1, verification: 'VERIFIED' },
      { minutes: 120, error: 2, verification: 'VERIFIED' },
      { minutes: 120, error: 4, verification: 'NO_OBSERVATION_AT_TARGET' },
    ]);

    expect(summary.samples).toBe(3);
    expect(summary.mae).toBe(1.33);
    expect(summary.rmse).toBe(1.41);
    expect(summary.bias).toBe(0.67);
    expect(summary.byHorizon['60'].samples).toBe(2);
    expect(summary.byHorizon['120'].samples).toBe(1);
  });

  it('does not invent a score when nothing has been verified', () => {
    const summary = summarizeForecastPoints([
      { minutes: 60, error: null, verification: 'PENDING' },
    ]);

    expect(summary.samples).toBe(0);
    expect(summary.mae).toBeNull();
    expect(summary.bias).toBeNull();
    expect(summary.byHorizon).toEqual({});
  });
});

describe('historical forecast baseline', () => {
  it('scores persistence against the next stored observation', () => {
    const base = new Date('2026-11-09T10:00:00.000Z').getTime();
    const summary = summarizeHistoryBaseline([
      {
        history: [
          { compositeRisk: 2, calculatedAt: new Date(base) },
          { compositeRisk: 3, calculatedAt: new Date(base + 10 * 60000) },
          { compositeRisk: 6, calculatedAt: new Date(base + 20 * 60000) },
        ],
      },
    ]);

    expect(summary.samples).toBe(2);
    expect(summary.method).toBe('persistence-on-stored-cell-history');
    expect(summary.mae).toBe(2);
    expect(summary.bias).toBe(-2);
    expect(summary.medianLeadMinutes).toBe(10);
    expect(summary.changedPairs).toBe(2);
    expect(summary.changedShare).toBe(1);
  });

  it('reports a flat baseline instead of implying model skill', () => {
    const base = new Date('2026-11-09T10:00:00.000Z').getTime();
    const summary = summarizeHistoryBaseline([
      {
        history: [
          { compositeRisk: 2, calculatedAt: new Date(base) },
          { compositeRisk: 2, calculatedAt: new Date(base + 10 * 60000) },
        ],
      },
    ]);

    expect(summary.mae).toBe(0);
    expect(summary.changedPairs).toBe(0);
    expect(summary.changedShare).toBe(0);
  });

  it('does not compare entries separated by more than three hours', () => {
    const base = new Date('2026-11-09T10:00:00.000Z').getTime();
    const summary = summarizeHistoryBaseline([
      {
        history: [
          { compositeRisk: 2, calculatedAt: new Date(base) },
          { compositeRisk: 3, calculatedAt: new Date(base + 4 * 3600000) },
        ],
      },
    ]);

    expect(summary.samples).toBe(0);
  });
});
