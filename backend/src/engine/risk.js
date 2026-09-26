import { cellToLatLng, latLngToCell } from 'h3-js';
import { SpatialCell } from '../models/SpatialCell.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { broadcastCells } from './stream.js';

export const H3_RESOLUTION = 8;
const WINDOW_MS = 15 * 60 * 1000;

const clamp = (value) => Math.max(0, Math.min(10, Number(value) || 0));

export function normalizeCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('latitude must be between -90 and 90.');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('longitude must be between -180 and 180.');
  return { latitude: lat, longitude: lon, h3Index: latLngToCell(lat, lon, H3_RESOLUTION) };
}

function scoreEvents(events, previousCell) {
  const transit = events.filter((event) => event.sourceType === 'GTFS_TRANSIT');
  const weather = events.filter((event) => event.sourceType === 'WEATHER_API');
  const vulnerability = events.filter((event) => Number.isFinite(event.vulnerabilityScore));
  const degradationReasons = [];

  const maxDelay = transit.reduce((max, event) => Math.max(max, Number(event.delayMins) || 0), 0);
  const maxRain = weather.reduce((max, event) => Math.max(max, Number(event.rainMmHr) || 0), 0);
  const previousVulnerability = previousCell?.scores?.vulnerability || 0;
  const vulnerabilityScore = vulnerability.length
    ? vulnerability.reduce((max, event) => Math.max(max, clamp(event.vulnerabilityScore)), 0)
    : previousVulnerability;

  if (!transit.length) degradationReasons.push('mobility_data_missing');
  if (!weather.length) degradationReasons.push('climate_data_missing');
  if (!vulnerability.length && !previousVulnerability) degradationReasons.push('vulnerability_baseline_missing');

  const scores = {
    mobility: clamp((maxDelay / 15) * 10),
    climate: clamp((maxRain / 50) * 10),
    vulnerability: clamp(vulnerabilityScore),
  };
  const weights = previousCell?.weights || { Wm: 0.4, Wc: 0.4, Wv: 0.2 };
  return {
    scores,
    weights,
    compositeRisk: Number((weights.Wm * scores.mobility + weights.Wc * scores.climate + weights.Wv * scores.vulnerability).toFixed(2)),
    isDegraded: degradationReasons.length > 0,
    degradationReasons,
  };
}

export async function recalculateCell(h3Index) {
  const previousCell = await SpatialCell.findOne({ h3Index }).lean();
  const events = await TelemetryEvent.find({ h3Index, observedAt: { $gte: new Date(Date.now() - WINDOW_MS) } }).lean();
  const [latitude, longitude] = cellToLatLng(h3Index);
  const result = scoreEvents(events, previousCell);
  const cell = await SpatialCell.findOneAndUpdate(
    { h3Index },
    { $set: { h3Index, latitude, longitude, ...result, lastUpdated: new Date() } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
  broadcastCells([cell]);
  return cell;
}

export async function listActiveCells() {
  return SpatialCell.find({ lastUpdated: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }).sort({ compositeRisk: -1 }).lean();
}