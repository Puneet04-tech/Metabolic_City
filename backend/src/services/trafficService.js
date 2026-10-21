import { getCity } from './cityConfig.js';
import { getCityNetworkCells, TRAFFIC_ROAD_CLASSES } from './osmService.js';
import { consumeBudget, remainingBudget } from './requestBudget.js';
import * as h3 from 'h3-js';

const h3IndexOf = h3.latLngToCell || h3.geoToH3;

const FLOW_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData';
const INCIDENT_URL = 'https://api.tomtom.com/traffic/services/5/incidentDetails';

/** The provider name the daily allowance is counted against. */
const PROVIDER = 'tomtom';

/**
 * The daily allowance.
 *
 * The free tier is 2,500 non-tile requests a day, shared between the flow
 * and incident endpoints. The limit here is set below that so there is
 * always room for the day's last cycle.
 */
const DAILY_LIMIT = Number(process.env.TOMTOM_DAILY_LIMIT ?? 2300);

/** How long to wait after the provider says it has had enough. */
let pausedUntil = 0;

/** The zoom level the road geometry is returned at. */
const FLOW_ZOOM = 16;

const FLOW_PARAMS = {
  style: 'absolute',
  format: 'json',
  unit: 'kmph',
};

/**
 * The fields asked for. The service rejects unknown field names, so this
 * list is exactly the shape the response schema allows.
 */
const INCIDENT_FIELDS =
  '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,' +
  'events{description,code,iconCategory},from,to,length,delay,roadNumbers,timeValidity}}}';

/**
 * What an incident does to the road, by its category.
 *
 * The categories are the ones the service reports: 1 accident, 4 rain,
 * 6 jam, 7 lane closed, 8 road closed, 9 road works, 11 flooding.
 */
const INCIDENT_IMPACT = {
  1: { speedReductionPct: 60, label: 'Accident' },
  2: { speedReductionPct: 25, label: 'Fog' },
  3: { speedReductionPct: 30, label: 'Dangerous conditions' },
  4: { speedReductionPct: 30, label: 'Rain' },
  5: { speedReductionPct: 25, label: 'Ice' },
  6: { speedReductionPct: 85, label: 'Jam' },
  7: { speedReductionPct: 90, label: 'Lane closed' },
  8: { speedReductionPct: 100, label: 'Road closed' },
  9: { speedReductionPct: 45, label: 'Road works' },
  10: { speedReductionPct: 30, label: 'Wind' },
  11: { speedReductionPct: 70, label: 'Flooding' },
  14: { speedReductionPct: 55, label: 'Broken down vehicle' },
};

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
 * Whether the provider is asking us to slow down.
 */
export function trafficPaused() {
  return Date.now() < pausedUntil;
}

/**
 * How long the provider asked us to wait, in milliseconds.
 */
export function trafficPauseRemaining() {
  return Math.max(0, pausedUntil - Date.now());
}

/**
 * The keys to try, most privileged first.
 *
 * A TomTom project shows a portal key, which is meant for calls from a
 * browser, and a service key, which is meant for calls from a server. Both
 * are tried.
 */
function trafficKeys() {
  return [process.env.TOMTOM_SERVICE_KEY, process.env.TOMTOM_API_KEY].filter(Boolean);
}

async function requestTomTom(url, params, method = 'GET', body = null) {
  const keys = trafficKeys();
  if (!keys.length) throw new Error('No TomTom API key is configured.');

  let lastError = null;
  for (const key of keys) {
    const target = new URL(url);
    for (const [name, value] of Object.entries(params || {})) {
      target.searchParams.set(name, value);
    }
    target.searchParams.set('key', key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(target, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MetabolicCity/1.0 (urban risk operations)',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');

        if (response.status === 429) {
          // The provider has had enough. Stop for as long as it asks, and
          // do not spend the rest of the day's allowance.
          const retryAfter = Number(response.headers.get('retry-after'));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 15 * 60 * 1000;
          pausedUntil = Date.now() + waitMs;
          lastError = new Error(
            `TomTom rate limit reached; pausing for ${Math.round(waitMs / 60000)} minutes.`
          );
          continue;
        }

        lastError = new Error(`TomTom returned ${response.status}: ${text.slice(0, 200)}`);
        if (response.status === 401 || response.status === 403) continue;
        throw lastError;
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
      if (error instanceof Error && /TomTom returned (401|403)/.test(error.message)) continue;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('TomTom rejected every configured key.');
}

/**
 * The real travel time on one point, against the free-flow time.
 *
 * This is the whole mobility signal: how much longer the road is taking
 * than it would take with nothing on it. TomTom computes it from fused
 * real-time measurements.
 */
export async function fetchFlowSegment(point) {
  const response = await requestTomTom(
    `${FLOW_URL}/${FLOW_PARAMS.style}/${FLOW_ZOOM}/${FLOW_PARAMS.format}`,
    {
      point: `${point.latitude},${point.longitude}`,
      unit: FLOW_PARAMS.unit,
    }
  );
  return response.flowSegmentData || null;
}

/**
 * The real traffic state of a city, as telemetry events.
 *
 * Each probe is one request, so the number of probes is kept inside the
 * free allowance: a few hundred requests a day per city, not thousands.
 */
export async function fetchCityTraffic(cityName, { maxProbes = 25, offset = 0 } = {}) {
  const city = getCity(cityName);
  if (!trafficProviderConfigured()) {
    return { events: [], skipped: 'no TomTom API key configured' };
  }
  if (trafficPaused()) {
    return { events: [], skipped: 'the traffic provider asked us to slow down' };
  }

  // The number of roads measured is bounded by what is left of the day's
  // allowance, so the system spends what it has and no more.
  const left = await remainingBudget(PROVIDER, DAILY_LIMIT);
  if (left <= 0) {
    return { events: [], skipped: "today's traffic allowance is used up" };
  }
  const probesToUse = Math.min(maxProbes, left);

  const probes = await selectTrafficProbes(cityName, probesToUse, offset);
  if (!probes.length) {
    return { events: [], skipped: 'no road network cached for this city' };
  }

  const events = [];
  let failures = 0;

  for (const probe of probes) {
    const budget = await consumeBudget(PROVIDER, 1, DAILY_LIMIT);
    if (!budget.allowed) {
      return { events, skipped: "today's traffic allowance is used up", exhausted: true };
    }

    let segment;
    try {
      segment = await fetchFlowSegment(probe);
    } catch (error) {
      failures += 1;
      if (error instanceof Error && /rate limit/.test(error.message)) break;
      continue;
    }
    if (!segment) continue;

    const mobility = flowToMobility(segment);

    // The reading belongs to the road TomTom matched, not to the point we
    // asked about, so the cell it lands in is the cell that road is in.
    const coordinate = segment.coordinates?.coordinate?.[0];
    const latitude = coordinate?.latitude ?? probe.latitude;
    const longitude = coordinate?.longitude ?? probe.longitude;
    const h3Index = h3IndexOf(latitude, longitude, 8) || probe.h3Index;

    events.push({
      sourceType: 'GTFS_TRANSIT',
      h3Index,
      latitude,
      longitude,
      cityCode: city.code,
      observedAt: new Date(),
      delayMins: mobility.delayMins,
      speedReductionPct: mobility.speedReductionPct,
      congestionLevel: segment.roadClosure ? 'STANDSTILL' : mobility.congestionLevel,
      rawPayload: {
        source: 'tomtom-traffic-flow',
        roadName: probe.roadName,
        highway: probe.highway,
        frc: segment.frc,
        currentSpeed: segment.currentSpeed,
        freeFlowSpeed: segment.freeFlowSpeed,
        currentTravelTime: segment.currentTravelTime,
        freeFlowTravelTime: segment.freeFlowTravelTime,
        confidence: segment.confidence,
        roadClosure: segment.roadClosure ?? false,
      },
    });
  }

  return { events, probes: probes.length, failures };
}

/**
 * The real incidents on the roads of a city, as telemetry events.
 */
export async function fetchCityIncidents(cityName, { maxProbes = 25, offset = 0 } = {}) {
  const city = getCity(cityName);
  if (!trafficProviderConfigured()) return { events: [] };
  if (trafficPaused()) return { events: [] };

  const left = await remainingBudget(PROVIDER, DAILY_LIMIT);
  if (left <= 0) return { events: [] };

  const budget = await consumeBudget(PROVIDER, 1, DAILY_LIMIT);
  if (!budget.allowed) return { events: [] };

  const probes = await selectTrafficProbes(cityName, Math.min(maxProbes, left), offset);
  if (!probes.length) return { events: [] };

  const latitudes = probes.map((probe) => probe.latitude);
  const longitudes = probes.map((probe) => probe.longitude);
  // The service wants the corners as minLon,minLat,maxLon,maxLat.
  const bbox = [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ].join(',');

  const response = await requestTomTom(INCIDENT_URL, {
    bbox,
    fields: INCIDENT_FIELDS,
    language: 'en-GB',
    timeValidityFilter: 'present',
  });

  const events = [];
  for (const incident of response.incidents || []) {
    const coordinates = incident.geometry?.coordinates || [];
    if (!coordinates.length) continue;
    // A LineString is [lon, lat] pairs; a Point is a single [lon, lat].
    const first = Array.isArray(coordinates[0]) ? coordinates[0] : coordinates;
    const [longitude, latitude] = first;
    const h3Index = h3IndexOf(latitude, longitude, 8);
    if (!h3Index) continue;

    const properties = incident.properties || {};
    const impact = INCIDENT_IMPACT[properties.iconCategory] || { speedReductionPct: 20, label: 'Incident' };
    // The delay is in seconds and is already measured against free-flow.
    const delayMins = Number(properties.delay || 0) / 60;
    const description =
      properties.events?.[0]?.description || impact.label;

    events.push({
      sourceType: 'GTFS_TRANSIT',
      h3Index,
      latitude,
      longitude,
      cityCode: city.code,
      observedAt: new Date(),
      delayMins: Number(delayMins.toFixed(2)),
      speedReductionPct: impact.speedReductionPct,
      congestionLevel: congestionLevelFor(impact.speedReductionPct),
      rawPayload: {
        source: 'tomtom-traffic-incidents',
        incidentId: properties.id,
        category: impact.label,
        iconCategory: properties.iconCategory,
        description,
        from: properties.from,
        to: properties.to,
        lengthM: properties.length,
        delaySeconds: properties.delay,
        roadNumbers: properties.roadNumbers,
        magnitudeOfDelay: properties.magnitudeOfDelay,
      },
    });
  }

  return { events };
}

/**
 * Turns a flow segment into the numbers the risk engine scores on.
 */
export function flowToMobility(segment) {
  const currentSpeed = Number(segment.currentSpeed);
  const freeFlowSpeed = Number(segment.freeFlowSpeed);
  const currentTravelTime = Number(segment.currentTravelTime);
  const freeFlowTravelTime = Number(segment.freeFlowTravelTime);

  const delayMins =
    Number.isFinite(currentTravelTime) && Number.isFinite(freeFlowTravelTime)
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
 * The roads worth asking about.
 *
 * One road per cell, the one that carries the most traffic, and the
 * selection rotates between cycles so that every cell is covered over
 * time rather than the same handful every time.
 */
export async function selectTrafficProbes(cityName, maxProbes = 25, offset = 0) {
  const cells = await getCityNetworkCells(cityName);
  const candidates = [];

  for (const cell of cells) {
    const roads = cell.segments.filter((segment) => TRAFFIC_ROAD_CLASSES.has(segment.highway));
    if (!roads.length) continue;

    // The longest road in the cell is the one that carries the most traffic.
    const road = roads.sort((a, b) => (b.lengthM || 0) - (a.lengthM || 0))[0];
    candidates.push({
      h3Index: cell.h3Index,
      latitude: road.latitude,
      longitude: road.longitude,
      roadName: road.name,
      highway: road.highway,
    });
  }

  // Spread the budget over the biggest roads first.
  candidates.sort((a, b) => {
    const aClass = a.highway === 'primary' || a.highway === 'trunk' ? 0 : 1;
    const bClass = b.highway === 'primary' || b.highway === 'trunk' ? 0 : 1;
    if (aClass !== bClass) return aClass - bClass;
    return a.h3Index.localeCompare(b.h3Index);
  });

  if (candidates.length <= maxProbes) return candidates;

  // Rotate the window so different cells are measured on each cycle.
  const start = offset % candidates.length;
  const rotated = [...candidates.slice(start), ...candidates.slice(0, start)];
  return rotated.slice(0, maxProbes);
}
