import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { DeadLetterMessage } from '../models/DeadLetterMessage.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { normalizeCoordinates, recalculateCell } from '../engine/risk.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

function parseObservedAt(value) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('timestamp must be a valid ISO 8601 date string.');
  }
  return date;
}

async function writeDeadLetter(sourceType, payload, error) {
  try {
    await DeadLetterMessage.create({
      sourceType,
      payloadRaw: payload,
      errorType: 'TELEMETRY_VALIDATION_ERROR',
      failureReason: error.message,
    });
  } catch (dlqError) {
    console.error('[telemetry] Failed to write dead letter message:', dlqError.message);
  }
}

export async function ingest(sourceType, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be a non-empty JSON object.');
  }

  const { latitude, longitude, h3Index } = normalizeCoordinates(payload.latitude, payload.longitude);
  const observedAt = parseObservedAt(payload.timestamp || payload.observedAt);
  const delayMins = payload.delayMins != null
    ? Number(payload.delayMins)
    : payload.delaySeconds != null
    ? Number(payload.delaySeconds) / 60
    : undefined;

  const event = await TelemetryEvent.create({
    sourceType,
    h3Index,
    latitude,
    longitude,
    cityCode: payload.cityCode || 'CITY-IND-BPL8',
    observedAt,
    routeId: payload.routeId,
    vehicleId: payload.vehicleId,
    delayMins: Number.isFinite(delayMins) ? delayMins : undefined,
    speedReductionPct: Number.isFinite(Number(payload.speedReductionPct)) ? Number(payload.speedReductionPct) : undefined,
    congestionLevel: payload.congestionLevel,
    rainMmHr: Number.isFinite(Number(payload.rainMmHr ?? payload.precipitationRate))
      ? Number(payload.rainMmHr ?? payload.precipitationRate)
      : undefined,
    visibilityM: Number.isFinite(Number(payload.visibilityM)) ? Number(payload.visibilityM) : undefined,
    windGustMps: Number.isFinite(Number(payload.windGustMps)) ? Number(payload.windGustMps) : undefined,
    temperatureC: Number.isFinite(Number(payload.temperatureC)) ? Number(payload.temperatureC) : undefined,
    humidityPct: Number.isFinite(Number(payload.humidityPct)) ? Number(payload.humidityPct) : undefined,
    weatherCondition: payload.weatherCondition,
    vulnerabilityScore: Number.isFinite(Number(payload.vulnerabilityScore)) ? Number(payload.vulnerabilityScore) : undefined,
    category: payload.category,
    senderId: payload.senderId,
    reportText: payload.reportText ? String(payload.reportText).slice(0, 1000) : undefined,
    imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls.filter((url) => typeof url === 'string') : [],
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
    await writeDeadLetter(sourceType, req.body || {}, error);
    return res.status(422).json({ accepted: false, message: error.message, degraded: true });
  }
}

// Public citizen rate limiter to prevent report spam
const citizenLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many reports from this connection. Please try again in a few minutes.' },
});

// Validation rules
const coordValidators = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('latitude must be a number between -90 and 90.'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('longitude must be a number between -180 and 180.'),
];

// POST /api/v1/telemetry/transit
router.post('/transit', protect, authorize('operator', 'admin'), coordValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ accepted: false, message: errors.array()[0].msg });
  return handleIngest('GTFS_TRANSIT', req, res);
});

// POST /api/v1/telemetry/weather
router.post('/weather', protect, authorize('operator', 'admin'), coordValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ accepted: false, message: errors.array()[0].msg });
  return handleIngest('WEATHER_API', req, res);
});

// POST /api/v1/telemetry/citizen
router.post('/citizen', citizenLimiter, coordValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ accepted: false, message: errors.array()[0].msg });
  return handleIngest('CITIZEN_311', req, res);
});

// POST /api/v1/telemetry/batch - Bulk ingestion for survey or high frequency data
router.post('/batch', protect, authorize('operator', 'admin'), async (req, res) => {
  const items = Array.isArray(req.body?.events) ? req.body.events : [];
  if (!items.length || items.length > 200) {
    return res.status(422).json({ message: 'events must be an array of 1 to 200 items.' });
  }

  const results = [];
  const affectedCells = new Set();

  for (const item of items) {
    try {
      const sourceType = item.sourceType || 'GIS_STATIC';
      const result = await ingest(sourceType, item);
      results.push({ accepted: true, eventId: result.event._id, h3Index: result.event.h3Index });
      affectedCells.add(result.event.h3Index);
    } catch (err) {
      await writeDeadLetter(item.sourceType || 'UNKNOWN', item, err);
      results.push({ accepted: false, message: err.message });
    }
  }

  return res.status(201).json({
    total: items.length,
    processed: results.filter((r) => r.accepted).length,
    affectedCellsCount: affectedCells.size,
    results,
  });
});

// GET /api/v1/telemetry/events
router.get(
  '/events',
  protect,
  authorize('operator', 'field', 'admin'),
  [
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
    query('sourceType').optional().isString(),
    query('h3Index').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 500);
      const filter = {};

      if (req.query.sourceType) filter.sourceType = req.query.sourceType;
      if (req.query.h3Index) filter.h3Index = req.query.h3Index;
      if (req.query.from || req.query.to) {
        filter.observedAt = {};
        if (req.query.from) filter.observedAt.$gte = new Date(req.query.from);
        if (req.query.to) filter.observedAt.$lte = new Date(req.query.to);
      }

      const events = await TelemetryEvent.find(filter).sort({ observedAt: -1 }).limit(limit).lean();
      return res.json({ count: events.length, events });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/v1/telemetry/stats
router.get('/stats', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [countsBySource, deadLetterCount, totalEvents] = await Promise.all([
      TelemetryEvent.aggregate([
        { $match: { observedAt: { $gte: oneDayAgo } } },
        { $group: { _id: '$sourceType', count: { $sum: 1 } } },
      ]),
      DeadLetterMessage.countDocuments({ receivedAt: { $gte: oneDayAgo } }),
      TelemetryEvent.countDocuments({ observedAt: { $gte: oneDayAgo } }),
    ]);

    return res.json({
      period: 'last_24h',
      totalEvents,
      deadLetterCount,
      bySource: countsBySource,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
