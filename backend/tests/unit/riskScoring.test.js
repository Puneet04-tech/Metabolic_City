/**
 * Risk Scoring Tests
 * Data Integrity Principle: a cell's score is derived from the data in that
 * cell, not from the city as a whole
 */

import { scoreCellEvents } from '../../src/engine/risk.js';

const now = new Date().toISOString();

const weatherEvent = (overrides = {}) => ({
  sourceType: 'WEATHER_API',
  h3Index: '883d914f17fffff',
  observedAt: now,
  rainMmHr: 0,
  visibilityM: 10000,
  windGustMps: 2,
  temperatureC: 28,
  humidityPct: 45,
  ...overrides,
});

const transitEvent = (overrides = {}) => ({
  sourceType: 'GTFS_TRANSIT',
  h3Index: '883d914f17fffff',
  observedAt: now,
  delayMins: 0,
  speedReductionPct: 0,
  ...overrides,
});

describe('scoreCellEvents', () => {
  it('gives two cells with the same readings the same score', () => {
    // This is what the pipeline produced when it copied one city reading
    // into every cell: identical events, identical scores.
    const readings = [weatherEvent(), transitEvent({ delayMins: 4, speedReductionPct: 12 })];

    const first = scoreCellEvents(readings);
    const second = scoreCellEvents(readings.map((event) => ({ ...event })));

    expect(second.scores.climate).toBe(first.scores.climate);
    expect(second.scores.mobility).toBe(first.scores.mobility);
    expect(second.compositeRisk).toBe(first.compositeRisk);
  });

  it('gives two cells with different readings different climate scores', () => {
    const dry = scoreCellEvents([weatherEvent({ rainMmHr: 0, visibilityM: 10000 })]);
    const wet = scoreCellEvents([
      weatherEvent({ rainMmHr: 28, visibilityM: 1200, windGustMps: 14 }),
    ]);

    expect(wet.scores.climate).toBeGreaterThan(dry.scores.climate);
    expect(wet.compositeRisk).toBeGreaterThan(dry.compositeRisk);
  });

  it('gives two cells with different transit delays different mobility scores', () => {
    const flowing = scoreCellEvents([transitEvent({ delayMins: 0, speedReductionPct: 0 })]);
    const jammed = scoreCellEvents([transitEvent({ delayMins: 14, speedReductionPct: 55 })]);

    expect(jammed.scores.mobility).toBeGreaterThan(flowing.scores.mobility);
    expect(jammed.compositeRisk).toBeGreaterThan(flowing.compositeRisk);
  });

  it('separates two cells that each have their own weather and transit', () => {
    const quietCell = scoreCellEvents([
      weatherEvent({ rainMmHr: 0, visibilityM: 10000 }),
      transitEvent({ delayMins: 0, speedReductionPct: 0 }),
    ]);
    const badCell = scoreCellEvents([
      weatherEvent({ rainMmHr: 30, visibilityM: 900, windGustMps: 16 }),
      transitEvent({ delayMins: 15, speedReductionPct: 60 }),
    ]);

    expect(badCell.scores.climate).not.toBe(quietCell.scores.climate);
    expect(badCell.scores.mobility).not.toBe(quietCell.scores.mobility);
    expect(badCell.compositeRisk).toBeGreaterThan(quietCell.compositeRisk + 2);
  });

  it('bands the cell against the threshold it was given', () => {
    const readings = [
      weatherEvent({ rainMmHr: 40, visibilityM: 800, windGustMps: 18 }),
      transitEvent({ delayMins: 15, speedReductionPct: 60 }),
    ];
    const tight = scoreCellEvents(readings, null, { Wm: 0.4, Wc: 0.4, Wv: 0.2 }, 5);
    const loose = scoreCellEvents(readings, null, { Wm: 0.4, Wc: 0.4, Wv: 0.2 }, 9);

    expect(tight.compositeRisk).toBeGreaterThan(5);
    expect(tight.riskLevel).toBe('CRITICAL');
    expect(loose.riskLevel).toBe('HIGH');
  });

  it('keeps every sub-score inside the scale', () => {
    const readings = [
      weatherEvent({ rainMmHr: 500, visibilityM: 10, windGustMps: 60 }),
      transitEvent({ delayMins: 999, speedReductionPct: 100 }),
    ];
    const scored = scoreCellEvents(readings);

    for (const value of Object.values(scored.scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
    expect(scored.compositeRisk).toBeLessThanOrEqual(10);
  });
});
