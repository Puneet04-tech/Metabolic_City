import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { DeadLetterMessage } from '../models/DeadLetterMessage.js';

const DEFAULT_TRAFFIC_MINUTES = Number(process.env.TRAFFIC_POLL_MINUTES || 30);
const DEFAULT_WEATHER_MINUTES = Number(process.env.PIPELINE_CYCLE_MINUTES || 10);
const DEFAULT_GTFS_SECONDS = Number(process.env.TRANSIT_POLL_INTERVAL_MS || 10000) / 1000;

const SOURCE_DEFINITIONS = [
  {
    sourceType: 'TRAFFIC_API',
    label: 'Road traffic',
    provider: 'TomTom',
    expectedMinutes: DEFAULT_TRAFFIC_MINUTES,
    configured: Boolean(process.env.TOMTOM_API_KEY || process.env.TOMTOM_SERVICE_KEY),
    note: 'Flow and incident readings on the watched road probes.',
  },
  {
    sourceType: 'WEATHER_API',
    label: 'Weather',
    provider: 'Open-Meteo',
    expectedMinutes: DEFAULT_WEATHER_MINUTES,
    configured: true,
    note: 'Current conditions interpolated from the city anchor points.',
  },
  {
    sourceType: 'GTFS_TRANSIT',
    label: 'Transit',
    provider: 'GTFS-RT',
    expectedMinutes: DEFAULT_GTFS_SECONDS ? DEFAULT_GTFS_SECONDS / 60 : null,
    configured: Boolean(process.env.GTFS_RT_URL),
    note: 'Vehicle positions and delays, when a transit feed is configured.',
  },
  {
    sourceType: 'CITIZEN_311',
    label: 'Citizen and field reports',
    provider: 'Citizen QR / field crew',
    expectedMinutes: null,
    configured: true,
    note: 'Event-driven: a report arrives when someone sends one, not on a clock.',
  },
  {
    sourceType: 'IOT_SENSOR',
    label: 'Sensors',
    provider: 'IoT ingestion key',
    expectedMinutes: null,
    configured: Boolean(process.env.INGEST_API_KEY),
    note: 'Event-driven sensor readings. No physical sensor network is assumed.',
  },
  {
    sourceType: 'GIS_STATIC',
    label: 'Terrain and map',
    provider: 'OpenStreetMap / elevation',
    expectedMinutes: 30 * 24 * 60,
    configured: true,
    note: 'Static baseline, refreshed when the road network changes.',
  },
];

function freshness(status, ageMinutes, targetMinutes) {
  if (status === 'NO_DATA') return 'NO_DATA';
  if (!targetMinutes) return 'EVENT_DRIVEN';
  const age = Number(ageMinutes);
  if (!Number.isFinite(age)) return 'NO_DATA';
  if (age <= Math.max(targetMinutes * 2, targetMinutes + 5)) return 'LIVE';
  if (age <= Math.max(targetMinutes * 4, targetMinutes + 20)) return 'DELAYED';
  return 'STALE';
}

export async function getSourceHealth() {
  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1000);

  const [groups, deadLetters] = await Promise.all([
    TelemetryEvent.aggregate([
      { $match: { observedAt: { $gte: since } } },
      {
        $group: {
          _id: '$sourceType',
          events24h: { $sum: 1 },
          lastObservedAt: { $max: '$observedAt' },
          lastReceivedAt: { $max: '$receivedAt' },
          cells: { $addToSet: '$h3Index' },
          providers: { $addToSet: '$source' },
        },
      },
    ]),
    DeadLetterMessage.countDocuments({ receivedAt: { $gte: since } }),
  ]);

  const byType = new Map(groups.map((group) => [group._id, group]));

  const sources = SOURCE_DEFINITIONS.map((definition) => {
    const row = byType.get(definition.sourceType);
    const lastObserved = row?.lastObservedAt ? new Date(row.lastObservedAt) : null;
    const ageMinutes = lastObserved ? Number(((now - lastObserved.getTime()) / 60000).toFixed(1)) : null;
    const status = !row?.events24h
      ? 'NO_DATA'
      : freshness('DATA', ageMinutes, definition.expectedMinutes);

    return {
      ...definition,
      status: definition.configured === false && status === 'NO_DATA' ? 'NOT_CONFIGURED' : status,
      events24h: row?.events24h || 0,
      cells: (row?.cells || []).filter(Boolean).length,
      providers: (row?.providers || []).filter(Boolean),
      lastObservedAt: lastObserved,
      lastReceivedAt: row?.lastReceivedAt || null,
      ageMinutes,
      freshnessTargetMinutes: definition.expectedMinutes,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    deadLetter24h: deadLetters,
    sources,
    note:
      'Status is based on the last observed event and the source cadence. ' +
      'A live status means data is arriving, not that the data is correct.',
  };
}

export { SOURCE_DEFINITIONS };
