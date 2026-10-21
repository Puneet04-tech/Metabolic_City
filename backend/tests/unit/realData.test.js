/**
 * Real Data Service Tests
 * Data Integrity Principle: the system must never invent a measurement
 */

import { buildAnchorPoints } from '../../src/services/spatialInterpolation.js';
import { floodSusceptibility } from '../../src/services/terrainService.js';
import {
  congestionLevelFor,
  flowToMobility,
  trafficProviderConfigured,
} from '../../src/services/trafficService.js';

describe('buildAnchorPoints', () => {
  it('always includes the centre', () => {
    const points = buildAnchorPoints({ latitude: 22.7196, longitude: 75.8577 }, []);
    expect(points).toHaveLength(1);
    expect(points[0].key).toBe('centre');
  });

  it('brackets the real extent of the city with four more points', () => {
    const points = buildAnchorPoints(
      { lat: 22.7196, lon: 75.8577 },
      [
        { latitude: 22.70, longitude: 75.83 },
        { latitude: 22.74, longitude: 75.89 },
      ]
    );
    expect(points).toHaveLength(5);
    expect(points.map((point) => point.key)).toEqual([
      'centre',
      'north-west',
      'north-east',
      'south-west',
      'south-east',
    ]);
  });

  it('puts the extra points outside the real extent', () => {
    const points = buildAnchorPoints(
      { lat: 22.7196, lon: 75.8577 },
      [
        { latitude: 22.70, longitude: 75.83 },
        { latitude: 22.74, longitude: 75.89 },
      ]
    );
    const [, northWest, , southWest] = points;
    expect(northWest.latitude).toBeGreaterThan(22.74);
    expect(southWest.latitude).toBeLessThan(22.70);
  });

  it('refuses a centre it cannot place', () => {
    expect(() => buildAnchorPoints({}, [])).toThrow(/latitude and longitude/);
  });
});

describe('floodSusceptibility', () => {
  it('scores low ground near a river as the most exposed', () => {
    const exposed = floodSusceptibility({
      relativeHeight: 0,
      slopeDeg: 1,
      waterDistanceM: 50,
    });
    const sheltered = floodSusceptibility({
      relativeHeight: 0.9,
      slopeDeg: 12,
      waterDistanceM: 3000,
    });
    expect(exposed).toBeGreaterThan(sheltered);
  });

  it('scores a cell close to water above one far from it', () => {
    const near = floodSusceptibility({ relativeHeight: 0.2, slopeDeg: 3, waterDistanceM: 80 });
    const far = floodSusceptibility({ relativeHeight: 0.2, slopeDeg: 3, waterDistanceM: 4000 });
    expect(near).toBeGreaterThan(far);
  });

  it('scores a flat cell above a steep one at the same height', () => {
    const flat = floodSusceptibility({ relativeHeight: 0.3, slopeDeg: 0, waterDistanceM: null });
    const steep = floodSusceptibility({ relativeHeight: 0.3, slopeDeg: 20, waterDistanceM: null });
    expect(flat).toBeGreaterThan(steep);
  });

  it('stays inside the scale', () => {
    const worst = floodSusceptibility({ relativeHeight: 0, slopeDeg: 0, waterDistanceM: 0 });
    const best = floodSusceptibility({ relativeHeight: 1, slopeDeg: 90, waterDistanceM: 99999 });
    expect(worst).toBeLessThanOrEqual(10);
    expect(best).toBeGreaterThanOrEqual(0);
  });
});

describe('flowToMobility', () => {
  it('turns a real flow segment into a delay and a speed reduction', () => {
    // 60 km/h free flow, now 30 km/h, and the trip takes twice as long.
    const mobility = flowToMobility({
      currentSpeed: 30,
      freeFlowSpeed: 60,
      currentTravelTime: 600,
      freeFlowTravelTime: 300,
    });
    expect(mobility.delayMins).toBe(5);
    expect(mobility.speedReductionPct).toBe(50);
    expect(mobility.congestionLevel).toBe('SEVERE');
  });

  it('reports no delay on a free-flowing road', () => {
    const mobility = flowToMobility({
      currentSpeed: 60,
      freeFlowSpeed: 60,
      currentTravelTime: 300,
      freeFlowTravelTime: 300,
    });
    expect(mobility.delayMins).toBe(0);
    expect(mobility.speedReductionPct).toBe(0);
    expect(mobility.congestionLevel).toBe('LOW');
  });

  it('never reports a negative delay', () => {
    const mobility = flowToMobility({
      currentSpeed: 70,
      freeFlowSpeed: 60,
      currentTravelTime: 200,
      freeFlowTravelTime: 300,
    });
    expect(mobility.delayMins).toBe(0);
    expect(mobility.speedReductionPct).toBe(0);
  });

  it('survives a segment with missing numbers', () => {
    const mobility = flowToMobility({});
    expect(mobility.delayMins).toBe(0);
    expect(mobility.speedReductionPct).toBe(0);
  });
});

describe('congestionLevelFor', () => {
  it('maps a speed reduction onto the bands the model already has', () => {
    expect(congestionLevelFor(0)).toBe('LOW');
    expect(congestionLevelFor(30)).toBe('MODERATE');
    expect(congestionLevelFor(60)).toBe('SEVERE');
    expect(congestionLevelFor(85)).toBe('STANDSTILL');
  });
});

describe('trafficProviderConfigured', () => {
  it('is false without a key, so the system reports missing mobility rather than inventing it', () => {
    delete process.env.TOMTOM_API_KEY;
    expect(trafficProviderConfigured()).toBe(false);
  });

  it('is true with a key', () => {
    process.env.TOMTOM_API_KEY = 'test-key';
    expect(trafficProviderConfigured()).toBe(true);
    delete process.env.TOMTOM_API_KEY;
  });
});
