import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { latLngToCell } from 'h3-js';
import { SpatialCell } from '../models/SpatialCell.js';
import { DeadLetterMessage, createDeadLetterMessage } from '../models/DeadLetterMessage.js';
import { broadcastRiskUpdate } from '../services/streamManager.js';

/**
 * Telemetry Ingestion Worker
 * Performance Principle: Async Processing - Background job processing
 * 
 * Processes telemetry events from queue, performs H3 calculations,
 * updates MongoDB, and broadcasts via distributed WebSocket
 */

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * Telemetry worker
 */
const worker = new Worker(
  'telemetryIngestion',
  async (job) => {
    const { lat, lng, reading, sensorId, timestamp } = job.data;

    console.log(`[WORKER] Processing telemetry job ${job.id} from sensor ${sensorId}`);

    // Validate input
    if (lat === undefined || lng === undefined || !sensorId) {
      throw new Error('ERR_INVALID_TELEMETRY_SCHEMA: Missing required fields (lat, lng, sensorId)');
    }

    // Compute H3 Hexagon Index at Resolution 8
    const h3Index = latLngToCell(lat, lng, 8);

    // Compute updated risk score based on telemetry reading
    const riskFactor = Math.min(1.0, (reading || 0) / 100.0);

    // Bulk MongoDB Atomic Persistence
    const updatedCell = await SpatialCell.findOneAndUpdate(
      { h3Index },
      {
        $set: {
          lastUpdated: new Date(),
          latitude: lat,
          longitude: lng,
        },
        $max: { compositeRisk: riskFactor },
        $push: {
          history: {
            compositeRisk: riskFactor,
            calculatedAt: new Date(),
          },
        },
        $inc: {
          'telemetryStats.eventCount': 1,
          'telemetryStats.transitEventsCount': 1,
        },
      },
      { upsert: true, new: true }
    );

    console.log(`[WORKER] Updated cell ${h3Index} with risk ${riskFactor}`);

    // Broadcast across distributed socket clusters
    broadcastRiskUpdate(h3Index, {
      riskScore: updatedCell.compositeRisk,
      riskLevel: updatedCell.riskLevel,
      updatedAt: updatedCell.lastUpdated,
    });

    return {
      h3Index,
      riskScore: updatedCell.compositeRisk,
      processedAt: new Date(),
    };
  },
  {
    connection: redisConnection,
    concurrency: 10,
    limiter: {
      max: 100, // Max 100 jobs per second
      duration: 1000,
    },
  }
);

/**
 * Worker Failure Guard (Dead Letter Fallback)
 * Reliability Principle: Error Handling - DLQ for failed jobs
 */
worker.on('failed', async (job, err) => {
  console.error(`[WORKER_FAIL] Job ${job.id} failed after ${job?.attemptsMade || 0} attempts. Error: ${err.message}`);
  
  try {
    await createDeadLetterMessage(
      job.id,
      'telemetryIngestion',
      job.data,
      err.message,
      err.stack
    );
    console.log(`[WORKER_FAIL] Job ${job.id} moved to Dead Letter Queue`);
  } catch (dlqErr) {
    console.error(`[CRITICAL_DLQ_FAILURE] Could not log to DeadLetterMessage: ${dlqErr.message}`);
  }
});

/**
 * Worker success logging
 */
worker.on('completed', (job) => {
  console.log(`[WORKER_SUCCESS] Job ${job.id} completed successfully`);
});

/**
 * Worker error logging
 */
worker.on('error', (err) => {
  console.error(`[WORKER_ERROR] Worker error: ${err.message}`);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('[WORKER] SIGTERM received, closing worker...');
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[WORKER] SIGINT received, closing worker...');
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});

export default worker;
