import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { DeadLetterMessage } from '../models/DeadLetterMessage.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { normalizeCoordinates, recalculateCell } from '../engine/risk.js';

const router = express.Router();

function parseObservedAt(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new Error('timestamp must be a valid ISO 8601 date.');
  return date;
}

async function writeDeadLetter(sourceType, payload, error) {
  await DeadLetterMessage.create({
    sourceType,
    payloadRaw: payload,
    errorType: 'TELEMETRY_VALIDATION_ERROR',
    failureReason: error.message,
  });
}

export async function ingest(sourceType, payload) {
  const { latitude, longitude, h3Index } = normalizeCoordinates(payload.latitude, payload.longitude);
  const observedAt = parseObservedAt(payload.timestamp || payload.observedAt);
  const delayMins = payload.delayMins ?? (payload.delaySeconds == null ? undefined : Number(payload.delaySeconds) / 60);
  const event = await TelemetryEvent.create({
    sourceType,
    h3Index,
    latitude,
    longitude,
    observedAt,
    routeId: payload.routeId,
    vehicleId: payload.vehicleId,
    delayMins,
    speedReductionPct: payload.speedReductionPct,
    rainMmHr: payload.rainMmHr ?? payload.precipitationRate,
    visibilityM: payload.visibilityM,
    windGustMps: payload.windGustMps,
    vulnerabilityScore: payload.vulnerabilityScore,
    senderId: payload.senderId,
    reportText: payload.reportText,
    imageUrls: payload.imageUrls || [],
    rawPayload: payload,
  });
  const cell = await recalculateCell(h3Index);
  return { event, cell };
}

async function handleIngest(sourceType, req, res) {
  try {
    const result = await ingest(sourceType, req.body || {});
    return res.status(201).json({ accepted: true, event: result.event, cell: result.cell });
  } catch (error) {
    try {
      await writeDeadLetter(sourceType, req.body || {}, error);
    } catch (dlqError) {
      console.error('[telemetry] failed to write DLQ:', dlqError.message);
    }
    return res.status(422).json({ accepted: false, message: error.message, degraded: true });
  }
}

router.post('/transit', protect, authorize('operator', 'admin'), (req, res) => handleIngest('GTFS_TRANSIT', req, res));
router.post('/weather', protect, authorize('operator', 'admin'), (req, res) => handleIngest('WEATHER_API', req, res));
router.post('/citizen', (req, res) => handleIngest('CITIZEN_311', req, res));

router.get('/events', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const events = await TelemetryEvent.find().sort({ observedAt: -1 }).limit(limit).lean();
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

export default router;