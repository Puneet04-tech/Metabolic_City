import { getCity } from './cityConfig.js';
import { getCityNetworkCells, TRAFFIC_ROAD_CLASSES } from './osmService.js';
import * as h3 from 'h3-js';

const h3IndexOf = h3.latLngToCell || h3.geoToH3;

const FLOW_URL = 'https://api.tomtom.com/traffic/services/5/flowSegmentData';
const INCIDENT_URL = 'https://api.tomtom.com/traffic/services/5/incidentDetails';

const FLOW_FIELDS = [
  'frc',
  'currentSpeed',
  'freeFlowSpeed',
  'currentTravelTime',
  'freeFlowTravelTime',
  'confidence',
  'roadNumbers',
  'pointIndices',
].join(',');

const INCIDENT_FIELDS = [
  'id',
  'type',
  'geometry{type,coordinates}',
  'properties{congestionLevel,description,delay,roadNumbers,iconCategory,from,to}',
].join(',');

/** The congestion bands the model already has. */
export function congestionLevelFor(speedReductionPct) {
  if (speedReductionPct >= 80) return 'STANDSTILL';
  if (speedReductionPct >= 50) return 'SEVERE';
  if (speedReductionPct >= 20) return 'MODERATE';
  return 'LOW';
}

/**
 * The traffic provider is only usable with a key. Without one the system
 * reports that it has no mobility signal rather than inventing one.
 */
export function trafficProviderConfigured() {
  return Boolean(process.env.TOMTOM_API_KEY || process.env.TOMTOM_SERVICE_KEY);
}

/**
 * The keys to try, most privileged first.
 *
 * A TomTom project shows a portal key, which is meant for calls from a
 * browser, and a service key, which is meant for calls from a server. Some
 * traffic endpoints refuse a portal key off the browser, so both are tried.
 */
function trafficKeys() {
  return [
    process.env.TOMTOM_SERVICE_KEY,
    process.env.TOMTOM_API_KEY,
  ].filter(Boolean);
}

async function postTomTom(url, body, params) {
  const keys = trafficKeys();
  if (!keys.length) throw new Error('No TomTom API key is configured.');

  let lastError = null;
  for (const key of keys) {
    const target = new URL(url);
    target.searchParams.set('key', key);
    for (const [name, value] of Object.entries(params || {})) {
      target.searchParams.set(name, value);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(target, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MetabolicCity/1.0 (urban risk operations)',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        lastError = new Error(`TomTom returned ${response.status}: ${text.slice(0, 160)}`);
        // A rejected key is worth trying the other one for.
        if (response.status === 401 || response.status === 403) continue;
        throw lastError;
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
      if (response?.status === 401 || response?.status === 403) continue;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('TomTom rejected every configured key.');
}

/**
 * The real travel time on a set of points, against the free-flow time.
 *
 * This is the whole mobility signal: how much longer the road is taking
 * than it would take with nothing on it.
 */
export async function fetchFlowSegments(points) {
  if (!trafficProviderConfigured() || !points.length) return [];

  const body = {
    points: points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
  };

  const response = await postTomTom(FLOW_URL, body, {
    fields: FLOW_FIELDS,
    unit: 'kmh',
    computeTravelTimeForAllPoints: 'false',
    geometry: 'true',
  });

  const segments = response.flowSegmentData;
  if (!segments) return [];
  return Array.isArray(segments) ? segments : [segments];
}

/**
 * The real incidents on the road: accidents, roadworks, closures, jams.
 */
export async function fetchIncidents(bbox) {
  if (!trafficProviderConfigured()) return [];

  const response = await postTomTom(
    INCIDENT_URL,
    {
      bbox: {
        minLat: bbox.minLat,
        maxLat: bbox.maxLat,
        minLon: bbox.minLon,
        maxLon: bbox.maxLon,
      },
    },
    {
      fields: INCIDENT_FIELDS,
      language: 'en-GB',
      timeValidityFilter: 'present',
      maxVersions: 1,
    }
  );

  return response.incidents || [];
}

/**
 * Turns a flow segment into the numbers the risk engine scores on.
 */
export function flowToMobility(segment) {
  const currentSpeed = Number(segment.currentSpeed);
  const freeFlowSpeed = Number(segment.freeFlowSpeed);
  const currentTravelTime = Number(segment.currentTravelTime);
  const freeFlowTravelTime = Number(segment.freeFlowTravelTime);

  const delayMins = Number.isFinite(currentTravelTime) && Number.isFinite(freeFlowTravelTime)
    ? Math.max(0, (currentTravelTime - freeFlowTravelTime) / 60)
    : 0;

  const speedReductionPct =
    Number.isFinite(currentSpeed) && Number.isFinite(freeFlowSpeed) && freeFlowSpeed > 0
      ? Math.max(0, Math.min(100, ((freeFlowSpeed - currentSpeed) / freeFlowSpeed) * 100))
      : 0;

  return {
    delayMins: Number(delayMins.toFixed(2)),
    speedReductionPct: Number(speedReductionPct.toFixed(2)),
    congestionLevel: congestionLevelFor(speedReductionPct),
  };
}

/**
 * Picks the points worth asking about: the middle of the real roads that
 * carry traffic, one per cell so the traffic budget is spent where the
 * cells are.
 */
export async function selectTrafficProbes(cityName, maxProbes = 60) {
  const cells = await getCityNetworkCells(cityName);
  const probes = [];

  for (const cell of cells) {
    const roads = cell.segments.filter((segment) => TRAFFIC_ROAD_CLASSES.has(segment.highway));
    if (!roads.length) continue;

    // The longest road in the cell is the one that carries the most traffic.
    const road = roads.sort((a, b) => (b.lengthM || 0) - (a.lengthM || 0))[0];
    probes.push({
      h3Index: cell.h3Index,
      latitude: road.latitude,
      longitude: road.longitude,
      roadName: road.name,
      highway: road.highway,
    });
  }

  // Spread the budget over the biggest roads first.
  probes.sort((a, b) => {
    const aClass = a.highway === 'primary' || a.highway === 'trunk' ? 0 : 1;
    const bClass = b.highway === 'primary' || b.highway === 'trunk' ? 0 : 1;
    return aClass - bClass;
  });

  return probes.slice(0, maxProbes);
}

/**
 * The real traffic state of a city, as telemetry events.
 *
 * Each probe becomes one event placed on the road it was measured on, so the
 * cell that holds that road carries the measurement.
 */
export async function fetchCityTraffic(cityName, { maxProbes = 60 } = {}) {
  const city = getCity(cityName);
  if (!trafficProviderConfigured()) {
    return { events: [], skipped: 'no TomTom API key configured' };
  }

  const probes = await selectTrafficProbes(cityName, maxProbes);
  if (!probes.length) {
    return { events: [], skipped: 'no road network cached for this city' };
  }

  const segments = await fetchFlowSegments(probes);
  const events = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const pointIndices = segment.pointIndices || [];
    const probe = probes[pointIndices[0] ?? index] || probes[index];
    if (!probe) continue;

    const mobility = flowToMobility(segment);
    events.push({
      sourceType: 'GTFS_TRANSIT',
      h3Index: probe.h3Index,
      latitude: probe.latitude,
      longitude: probe.longitude,
      cityCode: city.code,
      observedAt: new Date(),
      delayMins: mobility.delayMins,
      speedReductionPct: mobility.speedReductionPct,
      congestionLevel: mobility.congestionLevel,
      rawPayload: {
        source: 'tomtom-traffic-flow',
        roadName: probe.roadName,
        highway: probe.highway,
        currentSpeed: segment.currentSpeed,
        freeFlowSpeed: segment.freeFlowSpeed,
        currentTravelTime: segment.currentTravelTime,
        freeFlowTravelTime: segment.freeFlowTravelTime,
        confidence: segment.confidence,
      },
    });
  }

  return { events, probes: probes.length };
}

/**
 * The real incidents on the roads of a city, as telemetry events.
 */
export async function fetchCityIncidents(cityName, { maxProbes = 60 } = {}) {
  const city = getCity(cityName);
  if (!trafficProviderConfigured()) return { events: [] };

  const probes = await selectTrafficProbes(cityName, maxProbes);
  if (!probes.length) return { events: [] };

  const latitudes = probes.map((probe) => probe.latitude);
  const longitudes = probes.map((probe) => probe.longitude);
  const bbox = {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLon: Math.min(...longitudes),
    maxLon: Math.max(...longitudes),
  };

  const incidents = await fetchIncidents(bbox);
  const events = [];

  for (const incident of incidents) {
    const coordinates = incident.geometry?.coordinates || [];
    if (!coordinates.length) continue;
    const [longitude, latitude] = coordinates[0];
    const h3Index = h3IndexOf(latitude, longitude, 8);
    if (!h3Index) continue;

    const delayMins = Number(incident.properties?.delay) || 0;
    const congestion = String(incident.properties?.congestionLevel || '').toUpperCase();
    const speedReductionPct =
      congestion === 'JAM' ? 85 : congestion === 'CONGESTED' ? 55 : congestion === 'SLOW' ? 30 : 0;

    events.push({
      sourceType: 'GTFS_TRANSIT',
      h3Index,
      latitude,
      longitude,
      cityCode: city.code,
      observedAt: new Date(),
      delayMins,
      speedReductionPct,
      congestionLevel: congestionLevelFor(speedReductionPct),
      rawPayload: {
        source: 'tomtom-traffic-incidents',
        incidentId: incident.id,
        type: incident.type,
        congestionLevel: incident.properties?.congestionLevel,
        description: incident.properties?.description,
        roadNumbers: incident.properties?.roadNumbers,
      },
    });
  }

  return { events };
}
