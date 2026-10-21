/**
 * Spatial interpolation over a small set of real observations.
 *
 * The pipeline only has a handful of weather observations per city, but every
 * cell needs its own value. Inverse distance weighting gives each cell a
 * value that is a smooth, reproducible function of its distance to those
 * observations, and it reduces exactly to the observation when the cell sits
 * on top of one. Nothing here invents a reading: every interpolated value is
 * a weighted combination of values that were actually observed.
 */

const EARTH_RADIUS_KM = 6371.0088;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Interpolates one numeric field across the observations.
 *
 * An observation that sits within `exactToleranceKm` of the target wins
 * outright, so a cell that contains a real observation keeps that exact
 * value rather than a blend of it with its neighbours.
 */
export function interpolateField(observations, target, select, options = {}) {
  const { power = 2, exactToleranceKm = 0.05 } = options;

  const usable = observations
    .map((observation) => ({ observation, value: Number(select(observation)) }))
    .filter((entry) => Number.isFinite(entry.value));

  if (!usable.length) return undefined;

  const distances = usable.map((entry) => ({
    ...entry,
    distanceKm: haversineKm(target, entry.observation),
  }));

  const nearest = distances.reduce((best, entry) =>
    entry.distanceKm < best.distanceKm ? entry : best
  );

  if (nearest.distanceKm <= exactToleranceKm) {
    return { value: nearest.value, nearestDistanceKm: nearest.distanceKm, exact: true };
  }

  let weightSum = 0;
  let weighted = 0;
  for (const entry of distances) {
    const weight = 1 / entry.distanceKm ** power;
    weightSum += weight;
    weighted += weight * entry.value;
  }

  return {
    value: weighted / weightSum,
    nearestDistanceKm: nearest.distanceKm,
    exact: false,
  };
}

/**
 * Interpolates a whole weather snapshot across the observations.
 *
 * Each field is interpolated independently so that a field missing from one
 * observation does not drag the others down. A field that no observation
 * carries comes back undefined.
 */
export function interpolateSnapshot(observations, target, options = {}) {
  if (!Array.isArray(observations) || !observations.length) return null;

  const fields = new Set();
  for (const observation of observations) {
    for (const key of Object.keys(observation.values || {})) fields.add(key);
  }

  const values = {};
  let nearestDistanceKm = Infinity;
  let exact = false;

  for (const field of fields) {
    const result = interpolateField(
      observations,
      target,
      (observation) => observation.values?.[field],
      options
    );
    if (!result) continue;
    values[field] = result.value;
    if (result.nearestDistanceKm < nearestDistanceKm) {
      nearestDistanceKm = result.nearestDistanceKm;
      exact = result.exact;
    }
  }

  if (!Object.keys(values).length) return null;

  return { values, nearestDistanceKm, exact };
}

/**
 * Builds the observations a city can be interpolated from: the centre plus
 * the corners of the box that contains the city.
 *
 * The centre may be given as { latitude, longitude } or as the { lat, lon }
 * the city catalogue uses. The points that bound the city may be given in
 * either shape as well.
 */
export function buildAnchorPoints(centre, points = [], paddingRatio = 0.15) {
  const centreLatitude = Number.isFinite(centre?.latitude) ? centre.latitude : centre?.lat;
  const centreLongitude = Number.isFinite(centre?.longitude) ? centre.longitude : centre?.lon;

  if (!Number.isFinite(centreLatitude) || !Number.isFinite(centreLongitude)) {
    throw new Error('buildAnchorPoints needs a centre with a finite latitude and longitude.');
  }

  const anchors = [{ key: 'centre', latitude: centreLatitude, longitude: centreLongitude }];

  const coordinates = (Array.isArray(points) ? points : [])
    .map((point) => ({
      latitude: Number.isFinite(point?.latitude) ? point.latitude : point?.stopLat,
      longitude: Number.isFinite(point?.longitude) ? point.longitude : point?.stopLon,
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  if (!coordinates.length) return anchors;

  const lats = coordinates.map((point) => point.latitude);
  const lons = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latPadding = Math.max(0.005, (maxLat - minLat) * paddingRatio);
  const lonPadding = Math.max(0.005, (maxLon - minLon) * paddingRatio);

  anchors.push(
    { key: 'north-west', latitude: maxLat + latPadding, longitude: minLon - lonPadding },
    { key: 'north-east', latitude: maxLat + latPadding, longitude: maxLon + lonPadding },
    { key: 'south-west', latitude: minLat - latPadding, longitude: minLon - lonPadding },
    { key: 'south-east', latitude: minLat - latPadding, longitude: maxLon + lonPadding }
  );

  return anchors;
}
