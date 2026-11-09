import { summarizeForecastPoints } from '../../src/services/forecastAudit.js';

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
