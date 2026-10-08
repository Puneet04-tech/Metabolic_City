import mongoose from 'mongoose';

/**
 * Idempotency Key Schema
 * Data Integrity Principle: Idempotency - Safe retry of operations
 */
const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  params: { type: mongoose.Schema.Types.Mixed },
  response: { type: mongoose.Schema.Types.Mixed },
  statusCode: { type: Number },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // Expire after 24 hours
});

// Check if model already exists before defining (prevents hot reload errors)
export const IdempotencyKey = mongoose.models.IdempotencyKey || mongoose.model('IdempotencyKey', idempotencyKeySchema);

/**
 * Idempotency Middleware
 * Ensures that retrying the same operation doesn't create duplicates
 * 
 * Usage: Add idempotencyKey to request headers or body
 */
export function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;

  if (!idempotencyKey) {
    // No idempotency key provided, proceed normally
    return next();
  }

  // Check if this key has been used before
  IdempotencyKey.findOne({ key: idempotencyKey })
    .then((existing) => {
      if (existing) {
        // Return cached response
        console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
        return res.status(existing.statusCode).json(existing.response);
      }

      // Store original send to capture response
      const originalSend = res.send;
      const originalJson = res.json;

      // Override json to capture response
      res.json = function(data) {
        const cachedResponse = {
          key: idempotencyKey,
          endpoint: req.path,
          method: req.method,
          params: req.params,
          response: data,
          statusCode: res.statusCode,
        };

        // Store response asynchronously
        IdempotencyKey.create(cachedResponse).catch((err) => {
          console.error('[Idempotency] Failed to cache response:', err.message);
        });

        originalJson.call(this, data);
      };

      // Override send to capture response
      res.send = function(data) {
        const cachedResponse = {
          key: idempotencyKey,
          endpoint: req.path,
          method: req.method,
          params: req.params,
          response: data,
          statusCode: res.statusCode,
        };

        // Store response asynchronously
        IdempotencyKey.create(cachedResponse).catch((err) => {
          console.error('[Idempotency] Failed to cache response:', err.message);
        });

        originalSend.call(this, data);
      };

      next();
    })
    .catch((error) => {
      console.error('[Idempotency] Error checking idempotency key:', error.message);
      // Proceed normally on error
      next();
    });
}

/**
 * Check if operation is idempotent for specific scenarios
 */
export async function isOperationAlreadyExecuted(h3Index, operationType) {
  const key = `${operationType}:${h3Index}`;
  const existing = await IdempotencyKey.findOne({ key });
  return !!existing;
}

/**
 * Create idempotency key for incident dispatch
 */
export async function createDispatchIdempotencyKey(h3Index, incidentData) {
  const key = `dispatch:${h3Index}:${Date.now()}`;
  await IdempotencyKey.create({
    key,
    endpoint: '/api/v1/incidents',
    method: 'POST',
    params: { h3Index },
    response: incidentData,
    statusCode: 201,
  });
  return key;
}

/**
 * Check if incident already dispatched
 */
export async function isIncidentAlreadyDispatched(h3Index) {
  const { Incident } = await import('../models/Incident.js');
  const existing = await Incident.findOne({
    h3Index,
    status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
  });
  return !!existing;
}

/**
 * Check if cell already updated
 */
export async function isCellAlreadyUpdated(h3Index, lastUpdatedThreshold) {
  const { SpatialCell } = await import('../models/SpatialCell.js');
  const cell = await SpatialCell.findOne({ h3Index });
  if (!cell) return false;
  
  const timeSinceUpdate = Date.now() - new Date(cell.lastUpdated).getTime();
  return timeSinceUpdate < lastUpdatedThreshold;
}

/**
 * Cleanup old idempotency keys
 * Run this periodically to prevent database bloat
 */
export async function cleanupOldIdempotencyKeys(daysOld = 7) {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const result = await IdempotencyKey.deleteMany({
    createdAt: { $lt: cutoff },
  });
  console.log(`[Idempotency] Cleaned up ${result.deletedCount} old keys`);
  return result.deletedCount;
}
