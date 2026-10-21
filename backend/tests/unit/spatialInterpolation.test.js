/**
 * Spatial Interpolation Tests
 * Data Integrity Principle: every cell's value comes from real observations
 */

import {
  buildAnchorPoints,
  haversineKm,
  interpolateField,
  interpolateSnapshot,
} from '../../src/services/spatialInterpolation.js';

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    const point = { latitude: 23.2599, longitude: 77.4126 };
    expect(haversineKm(point, point)).toBe(0);
  });

  it('measures a known distance', () => {
    // Bhopal to Sehore is roughly 33 km.
    const distance = haversineKm(
      { latitude: 23.2599, longitude: 77.4126 },
      { latitude: 23.208, longitude: 77.0816 }
    );
    expect(distance).toBeGreaterThan(30);
    expect(distance).toBeLessThan(36);
  });
});

describe('interpolateField', () => {
  const observations = [
    { latitude: 23.2599, longitude: 77.4126, values: { rainMmHr: 0 } },
    { latitude: 23.4, longitude: 77.5, values: { rainMmHr: 40 } },
  ];

  it('returns the observed value on top of an observation', () => {
    const result = interpolateField(
      observations,
      { latitude: 23.2599, longitude: 77.4126 },
      (observation) => observation.values.rainMmHr
    );
    expect(result.value).toBe(0);
    expect(result.exact).toBe(true);
  });

  it('blends between observations away from them', () => {
    const result = interpolateField(
      observations,
      { latitude: 23.33, longitude: 77.46 },
      (observation) => observation.values.rainMmHr
    );
    expect(result.exact).toBe(false);
    expect(result.value).toBeGreaterThan(0);
    expect(result.value).toBeLessThan(40);
  });

  it('gives a point nearer one observation a value nearer to it', () => {
    const nearFirst = interpolateField(
      observations,
      { latitude: 23.28, longitude: 77.43 },
      (observation) => observation.values.rainMmHr
    );
    const nearSecond = interpolateField(
      observations,
      { latitude: 23.39, longitude: 77.49 },
      (observation) => observation.values.rainMmHr
    );
    expect(nearFirst.value).toBeLessThan(nearSecond.value);
  });

  it('ignores observations that do not carry the field', () => {
    const result = interpolateField(
      [
        { latitude: 23.2599, longitude: 77.4126, values: { temperatureC: 20 } },
        { latitude: 23.4, longitude: 77.5, values: { temperatureC: 30 } },
      ],
      { latitude: 23.33, longitude: 77.46 },
      (observation) => observation.values.rainMmHr
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined when there is nothing to interpolate', () => {
    const result = interpolateField([], { latitude: 23, longitude: 77 }, (o) => o.values.x);
    expect(result).toBeUndefined();
  });
});

describe('interpolateSnapshot', () => {
  const observations = [
    {
      latitude: 23.2599,
      longitude: 77.4126,
      values: { temperatureC: 25, rainMmHr: 0, humidityPct: 40 },
    },
    {
      latitude: 23.4,
      longitude: 77.5,
      values: { temperatureC: 35, rainMmHr: 30, humidityPct: 80 },
    },
  ];

  it('gives two different cells two different snapshots', () => {
    const near = interpolateSnapshot(observations, { latitude: 23.27, longitude: 77.42 });
    const far = interpolateSnapshot(observations, { latitude: 23.39, longitude: 77.49 });

    expect(near.values.rainMmHr).not.toBe(far.values.rainMmHr);
    expect(near.values.temperatureC).not.toBe(far.values.temperatureC);
  });

  it('is reproducible for the same target', () => {
    const target = { latitude: 23.31, longitude: 77.45 };
    const first = interpolateSnapshot(observations, target);
    const second = interpolateSnapshot(observations, target);
    expect(first.values).toEqual(second.values);
  });

  it('returns null when there are no observations', () => {
    expect(interpolateSnapshot([], { latitude: 23, longitude: 77 })).toBeNull();
  });

  it('leaves out a field no observation carries', () => {
    const snapshot = interpolateSnapshot(
      [{ latitude: 23.2599, longitude: 77.4126, values: { temperatureC: 25 } }],
      { latitude: 23.3, longitude: 77.45 }
    );
    expect(snapshot.values.temperatureC).toBe(25);
    expect('rainMmHr' in snapshot.values).toBe(false);
  });
});

describe('buildAnchorPoints', () => {
  const centre = { latitude: 23.2599, longitude: 77.4126 };
  const stops = [
    { stopLat: 23.1876, stopLon: 77.3745 },
    { stopLat: 23.2912, stopLon: 77.5023 },
  ];

  it('always includes the centre', () => {
    const points = buildAnchorPoints(centre, []);
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ key: 'centre', latitude: 23.2599, longitude: 77.4126 });
  });

  it('brackets the stops with four more points', () => {
    const points = buildAnchorPoints(centre, stops);
    expect(points).toHaveLength(5);
    expect(points.map((point) => point.key)).toEqual([
      'centre',
      'north-west',
      'north-east',
      'south-west',
      'south-east',
    ]);
  });

  it('puts the extra points outside the stops', () => {
    const points = buildAnchorPoints(centre, stops);
    const [northWest, northEast, southWest, southEast] = points.slice(1);
    expect(northWest.latitude).toBeGreaterThan(23.2912);
    expect(southWest.latitude).toBeLessThan(23.1876);
    expect(northWest.longitude).toBeLessThan(77.3745);
    expect(northEast.longitude).toBeGreaterThan(77.5023);
    expect(southEast.latitude).toBeLessThan(23.1876);
  });

  it('accepts the city catalogue shape as well', () => {
    const points = buildAnchorPoints({ lat: 23.2599, lon: 77.4126 }, stops);
    expect(points[0].latitude).toBe(23.2599);
    expect(points[0].longitude).toBe(77.4126);
  });

  it('refuses a centre it cannot place', () => {
    expect(() => buildAnchorPoints({}, stops)).toThrow(/latitude and longitude/);
  });
});
