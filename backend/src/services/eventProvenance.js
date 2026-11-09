import { createHash } from 'node:crypto';

/**
 * Canonical source types.
 *
 * Traffic used to be written as GTFS_TRANSIT because both arrived through the
 * mobility path. That made a TomTom road reading indistinguishable from a bus
 * feed in the audit trail, so traffic now has its own source.
 */
export const SOURCE_TYPES = [
  'TRAFFIC_API',
  'GTFS_TRANSIT',
  'WEATHER_API',
  'CITIZEN_311',
  'GIS_STATIC',
  'IOT_SENSOR',
];

const LEGACY_TRAFFIC_SOURCES = new Set([
  'tomtom-traffic-flow',
  'tomtom-traffic-incidents',
  'field-crew-gps',
]);

/**
 * Older rows labelled TomTom and field-crew readings as GTFS_TRANSIT. They are
 * still traffic measurements, so the reader accepts both labels while new
 * writes use TRAFFIC_API.
 */
export function isTrafficSource(sourceType, rawPayload) {
  if (sourceType === 'TRAFFIC_API') return true;
  if (sourceType !== 'GTFS_TRANSIT') return false;
  return LEGACY_TRAFFIC_SOURCES.has(rawPayload?.source);
}

export function sourceLabelFor(sourceType, payload = {}) {
  return String(
    payload.source ||
      payload.provider ||
      payload.sensorId ||
      (sourceType === 'TRAFFIC_API' ? 'traffic-provider' : sourceType)
  ).slice(0, 120);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

/**
 * The identity of an observation.
 *
 * A provider ID is the strongest identity: the same TomTom incident fetched
 * twice is one event, not two. When there is no provider ID, the content and
 * observation time are hashed, so a retried request with an identical body is
 * still one event instead of a duplicate that moves the risk score.
 */
export function buildEventIdentity({ sourceType, payload = {}, h3Index, observedAt }) {
  const explicitEventId = payload.eventId || payload.readingId || null;
  const providerId = payload.incidentId || payload.sensorId || payload.vehicleId || null;

  const identity = explicitEventId
    ? { sourceType, eventId: explicitEventId }
    : providerId
    ? { sourceType, providerId, observedAt: new Date(observedAt).toISOString() }
    : {
        sourceType,
        h3Index,
        observedAt: new Date(observedAt).toISOString(),
        payload: {
          category: payload.category,
          reportText: payload.reportText,
          rainMmHr: payload.rainMmHr,
          speedReductionPct: payload.speedReductionPct,
          delayMins: payload.delayMins,
          vulnerabilityScore: payload.vulnerabilityScore,
          imageUrls: payload.imageUrls,
        },
      };

  const contentHash = digest(identity);
  return {
    eventId: contentHash.slice(0, 32),
    contentHash,
    source: sourceLabelFor(sourceType, payload),
  };
}

export function stampEvent(event) {
  const identity = buildEventIdentity({
    sourceType: event.sourceType,
    payload: event.rawPayload && typeof event.rawPayload === 'object' ? event.rawPayload : event,
    h3Index: event.h3Index,
    observedAt: event.observedAt || new Date(),
  });
  return {
    ...event,
    ...identity,
    receivedAt: event.receivedAt || new Date(),
  };
}
