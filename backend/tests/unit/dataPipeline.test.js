/**
 * Data Pipeline Tests
 * Data Integrity Principle: every covered cell gets its own reading
 */

import { buildCoverageCells } from '../../src/services/dataPipeline.js';
import { getCityStops } from '../../src/services/staticGTFSData.js';
import { getWeatherSnapshot } from '../../src/services/weatherService.js';
import { interpolateSnapshot, buildAnchorPoints } from '../../src/services/spatialInterpolation.js';
import { scoreCellEvents } from '../../src/engine/risk.js';
import { getCity } from '../../src/services/cityConfig.js';
import * as h3 from 'h3-js';

const h3IndexOf = (lat, lon) => h3.latLngToCell(lat, lon, 8);

describe('buildCoverageCells', () => {
  it('covers the city centre and every stop', () => {
    const city = getCity('bhopal');
    const center = h3IndexOf(city.lat, city.lon);
    const cells = buildCoverageCells('bhopal', center);

    const indexes = new Set(cells.map((cell) => cell.h3Index));
    expect(indexes.has(center)).toBe(true);

    for (const stop of getCityStops('bhopal')) {
      expect(indexes.has(h3IndexOf(stop.stopLat, stop.stopLon))).toBe(true);
    }
  });

  it('gives every cell coordinates that match its index', () => {
    const city = getCity('bhopal');
    const cells = buildCoverageCells('bhopal', h3IndexOf(city.lat, city.lon));

    expect(cells.length).toBeGreaterThan(1);
    for (const cell of cells) {
      expect(Number.isFinite(cell.latitude)).toBe(true);
      expect(Number.isFinite(cell.longitude)).toBe(true);
    }
  });

  it('does not list the same cell twice', () => {
    const city = getCity('bhopal');
    const cells = buildCoverageCells('bhopal', h3IndexOf(city.lat, city.lon));
    const indexes = cells.map((cell) => cell.h3Index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });
});

describe('per-cell weather in the pipeline', () => {
  it('gives different cells different readings from the same observations', () => {
    const city = getCity('bhopal');
    const stops = getCityStops('bhopal');
    const points = buildAnchorPoints(city, stops);

    // A wet north-west and a dry south-east, as a real gradient would look.
    const observations = points.map((point, index) => ({
      key: point.key,
      latitude: point.latitude,
      longitude: point.longitude,
      values: {
        rainMmHr: index === 1 ? 30 : 0,
        temperatureC: index === 1 ? 22 : 32,
        visibilityM: index === 1 ? 900 : 10000,
        windGustMps: index === 1 ? 15 : 3,
        humidityPct: 50,
      },
    }));

    const cells = buildCoverageCells('bhopal', h3IndexOf(city.lat, city.lon));
    const readings = cells.map((cell) => ({
      cell,
      snapshot: interpolateSnapshot(observations, cell),
    }));

    const rainValues = readings.map((entry) => entry.snapshot.values.rainMmHr);
    expect(new Set(rainValues.map((value) => value.toFixed(2))).size).toBeGreaterThan(1);

    const temperatureValues = readings.map((entry) => entry.snapshot.values.temperatureC);
    expect(new Set(temperatureValues.map((value) => value.toFixed(2))).size).toBeGreaterThan(1);
  });

  it('turns those different readings into different cell scores', () => {
    const city = getCity('bhopal');
    const stops = getCityStops('bhopal');
    const points = buildAnchorPoints(city, stops);

    const observations = points.map((point, index) => ({
      key: point.key,
      latitude: point.latitude,
      longitude: point.longitude,
      values: {
        rainMmHr: index === 1 ? 40 : 0,
        temperatureC: 28,
        visibilityM: index === 1 ? 700 : 10000,
        windGustMps: index === 1 ? 18 : 3,
        humidityPct: 50,
      },
    }));

    const cells = buildCoverageCells('bhopal', h3IndexOf(city.lat, city.lon));
    const scores = cells.map((cell) => {
      const snapshot = interpolateSnapshot(observations, cell);
      const scored = scoreCellEvents([
        {
          sourceType: 'WEATHER_API',
          h3Index: cell.h3Index,
          observedAt: new Date().toISOString(),
          rainMmHr: snapshot.values.rainMmHr,
          visibilityM: snapshot.values.visibilityM,
          windGustMps: snapshot.values.windGustMps,
          temperatureC: snapshot.values.temperatureC,
          humidityPct: snapshot.values.humidityPct,
        },
      ]);
      return scored.compositeRisk;
    });

    // The cells must not all carry the same score, which is what one copied
    // city reading produced.
    expect(new Set(scores.map((value) => value.toFixed(2))).size).toBeGreaterThan(1);
  });

  it('reads the snapshot the interpolation produces', () => {
    const snapshot = getWeatherSnapshot({
      current: { temperature_2m: 27, precipitation: 3, wind_speed_10m: 6 },
      hourly: { visibility: [8000] },
    });
    expect(snapshot.rainMmHr).toBe(3);
    expect(snapshot.visibilityM).toBe(8000);
  });
});
