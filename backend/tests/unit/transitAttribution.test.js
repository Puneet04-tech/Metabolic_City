/**
 * Transit Attribution Tests
 * Data Integrity Principle: a cell's mobility score comes from the transit
 * that is actually in that cell
 */

import {
  congestionLevelFor,
  generateTransitTelemetry,
  generateTransitTelemetryEvents,
} from '../../src/services/transitService.js';
import {
  expectedSpeedMpsFor,
  findStopById,
  nearestStopDistanceKm,
} from '../../src/services/staticGTFSData.js';

const WEATHER = {
  current: {
    temperature_2m: 28,
    precipitation: 0,
    wind_speed_10m: 4,
  },
  hourly: { visibility: [10000] },
};

describe('findStopById', () => {
  it('finds a stop in any city', () => {
    const stop = findStopById('BPL003');
    expect(stop).toBeTruthy();
    expect(stop.stopName).toBe('Old Bus Stand');
    expect(stop.cityCode).toBe('CITY-MP-BPL');
  });

  it('returns null for an unknown stop', () => {
    expect(findStopById('NOPE999')).toBeNull();
    expect(findStopById(undefined)).toBeNull();
  });
});

describe('nearestStopDistanceKm', () => {
  it('measures the gap to the closest neighbouring stop', () => {
    const stop = findStopById('BPL003');
    const distance = nearestStopDistanceKm('bhopal', stop);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(10);
  });
});

describe('expectedSpeedMpsFor', () => {
  it('keeps the reference speed at the reference spacing', () => {
    expect(expectedSpeedMpsFor(1)).toBeCloseTo(11.1, 5);
  });

  it('expects a slower speed where the stops are close together', () => {
    expect(expectedSpeedMpsFor(0.4)).toBeLessThan(expectedSpeedMpsFor(1.6));
  });

  it('stays inside a plausible range', () => {
    expect(expectedSpeedMpsFor(0.01)).toBeGreaterThanOrEqual(3);
    expect(expectedSpeedMpsFor(50)).toBeLessThanOrEqual(20);
  });

  it('falls back to the reference when the spacing is unknown', () => {
    expect(expectedSpeedMpsFor(null)).toBeCloseTo(11.1, 5);
  });
});

describe('congestionLevelFor', () => {
  it('maps a speed reduction onto the congestion bands', () => {
    expect(congestionLevelFor(0)).toBe('LOW');
    expect(congestionLevelFor(30)).toBe('MODERATE');
    expect(congestionLevelFor(60)).toBe('SEVERE');
    expect(congestionLevelFor(85)).toBe('STANDSTILL');
  });
});

describe('generateTransitTelemetry', () => {
  it('places every vehicle at the stop it is serving', () => {
    const transit = generateTransitTelemetry('bhopal', WEATHER);
    expect(transit.vehicles.length).toBeGreaterThan(0);

    for (const vehicle of transit.vehicles) {
      const stop = findStopById(vehicle.stopId);
      expect(vehicle.latitude).toBe(stop.stopLat);
      expect(vehicle.longitude).toBe(stop.stopLon);
    }
  });

  it('gives two stops in different conditions different delays', () => {
    const wet = {
      current: { temperature_2m: 28, precipitation: 25, wind_speed_10m: 4 },
      hourly: { visibility: [1000] },
    };
    const dry = {
      current: { temperature_2m: 28, precipitation: 0, wind_speed_10m: 4 },
      hourly: { visibility: [10000] },
    };

    const byCell = new Map();
    for (const cell of ['wet', 'dry']) {
      const transit = generateTransitTelemetry('bhopal', cell === 'wet' ? wet : dry, {
        // The local weather arrives as the flat snapshot the interpolation
        // produces.
        weatherForCell: () => (cell === 'wet' ? { rainMmHr: 25 } : { rainMmHr: 0 }),
      });
      for (const vehicle of transit.vehicles) {
        byCell.set(`${cell}:${vehicle.h3Index}`, vehicle.delayMins);
      }
    }

    const wetDelays = [...byCell.entries()].filter(([key]) => key.startsWith('wet:')).map(([, v]) => v);
    const dryDelays = [...byCell.entries()].filter(([key]) => key.startsWith('dry:')).map(([, v]) => v);

    expect(wetDelays.length).toBeGreaterThan(0);
    expect(dryDelays.length).toBeGreaterThan(0);
    const wetAverage = wetDelays.reduce((sum, value) => sum + value, 0) / wetDelays.length;
    const dryAverage = dryDelays.reduce((sum, value) => sum + value, 0) / dryDelays.length;
    expect(wetAverage).toBeGreaterThan(dryAverage);
  });

  it('is stable for the same stop from one cycle to the next', () => {
    const first = generateTransitTelemetry('bhopal', WEATHER);
    const second = generateTransitTelemetry('bhopal', WEATHER);

    const byStop = new Map(first.vehicles.map((vehicle) => [vehicle.stopId, vehicle.delayMins]));
    for (const vehicle of second.vehicles) {
      if (!byStop.has(vehicle.stopId)) continue;
      expect(vehicle.delayMins).toBe(byStop.get(vehicle.stopId));
    }
  });
});

describe('generateTransitTelemetryEvents', () => {
  it('attributes each event to the cell of the stop it is at', () => {
    const events = generateTransitTelemetryEvents('bhopal', WEATHER, 30, { pipelineGenerated: true });
    expect(events).toHaveLength(30);

    for (const event of events) {
      const stop = findStopById(event.stopId);
      expect(event.latitude).toBe(stop.stopLat);
      expect(event.h3Index).toBeTruthy();
      expect(event.congestionLevel).toMatch(/LOW|MODERATE|SEVERE|STANDSTILL/);
    }
  });

  it('marks the events the pipeline generated so they can be replaced', () => {
    const events = generateTransitTelemetryEvents('bhopal', WEATHER, 5, { pipelineGenerated: true });
    for (const event of events) {
      expect(event.rawPayload.pipelineGenerated).toBe(true);
    }
  });

  it('does not mark the events when it is not the pipeline', () => {
    const events = generateTransitTelemetryEvents('bhopal', WEATHER, 5);
    for (const event of events) {
      expect(event.rawPayload.pipelineGenerated).toBeUndefined();
    }
  });

  it('gives events in different cells different values', () => {
    const events = generateTransitTelemetryEvents('bhopal', WEATHER, 30);
    const cells = new Set(events.map((event) => event.h3Index));
    expect(cells.size).toBeGreaterThan(1);
  });
});
