import { Queue } from 'bullmq';
import Redis from 'ioredis';

/**
 * Telemetry Ingestion Queue
 * Performance Principle: Async Processing - Decouple ingestion from processing
 * 
 * Addresses: Synchronous database bottleneck on high-throughput ingestion
 * API route pushes to queue in O(1) time, worker processes asynchronously
 */

const queueEnabled = process.env.REDIS_ENABLED === 'true' && Boolean(process.env.REDIS_URL);
const redisUrl = process.env.REDIS_URL;
const redisConnection = queueEnabled
  ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true })
  : null;

/**
 * Telemetry ingestion queue
 */
export const telemetryQueue = queueEnabled ? new Queue('telemetryIngestion', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // Keep last 1000 completed jobs for 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
}) : null;

export function isTelemetryQueueEnabled() {
  return queueEnabled;
}

/**
 * Add telemetry event to queue
 */
export async function addTelemetryEvent(telemetryData) {
  if (!telemetryQueue) {
    return { id: `local-${Date.now()}`, local: true };
  }
  const job = await telemetryQueue.add('processTelemetry', telemetryData, {
    priority: getPriority(telemetryData),
  });
  
  console.log(`[QUEUE] Telemetry event queued: job ID ${job.id}`);
  return job;
}

/**
 * Get priority based on telemetry severity
 */
function getPriority(data) {
  if (data.riskScore >= 8) return 1; // High priority for critical risk
  if (data.riskScore >= 5) return 5; // Medium priority
  return 10; // Low priority
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  if (!telemetryQueue) return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, mode: 'local' };
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    telemetryQueue.getWaitingCount(),
    telemetryQueue.getActiveCount(),
    telemetryQueue.getCompletedCount(),
    telemetryQueue.getFailedCount(),
    telemetryQueue.getDelayedCount(),
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

/**
 * Pause queue
 */
export async function pauseQueue() {
  if (!telemetryQueue) return;
  await telemetryQueue.pause();
  console.log('[QUEUE] Telemetry queue paused');
}

/**
 * Resume queue
 */
export async function resumeQueue() {
  if (!telemetryQueue) return;
  await telemetryQueue.resume();
  console.log('[QUEUE] Telemetry queue resumed');
}

/**
 * Close queue connection
 */
export async function closeQueue() {
  if (!telemetryQueue) return;
  await telemetryQueue.close();
  await redisConnection.quit();
  console.log('[QUEUE] Telemetry queue closed');
}
