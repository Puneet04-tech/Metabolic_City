import { Queue, Worker } from 'bullmq';
import { initCache, invalidateCellCache } from '../services/cacheService.js';

/**
 * Job Queue Configuration
 * Performance Principle: Async Processing - Job queue for heavy operations
 */

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
};

/**
 * Risk Calculation Queue
 * Processes H3 cell risk calculations asynchronously
 */
export const riskCalculationQueue = new Queue('risk-calculation', { connection });

/**
 * Incident Processing Queue
 * Processes incident creation and updates asynchronously
 */
export const incidentQueue = new Queue('incident-processing', { connection });

/**
 * Analytics Generation Queue
 * Generates analytics reports asynchronously
 */
export const analyticsQueue = new Queue('analytics-generation', { connection });

/**
 * Evidence Processing Queue
 * Processes field crew evidence uploads asynchronously
 */
export const evidenceQueue = new Queue('evidence-processing', { connection });

/**
 * Start workers for processing jobs
 */
export function startWorkers() {
  console.log('[Job Queue] Starting workers...');

  // Risk Calculation Worker
  const riskWorker = new Worker(
    'risk-calculation',
    async (job) => {
      const { h3Index, telemetry } = job.data;
      console.log(`[Job Queue] Processing risk calculation for ${h3Index}`);
      
      // Import dynamically to avoid circular dependencies
      const { processTelemetryToCells } = await import('../engine/risk.js');
      const result = await processTelemetryToCells([telemetry]);
      
      // Invalidate cache for this cell
      await invalidateCellCache(h3Index);
      
      return result;
    },
    { connection }
  );

  riskWorker.on('completed', (job) => {
    console.log(`[Job Queue] Risk calculation completed for ${job.data.h3Index}`);
  });

  riskWorker.on('failed', (job, err) => {
    console.error(`[Job Queue] Risk calculation failed for ${job.data.h3Index}:`, err.message);
  });

  // Incident Processing Worker
  const incidentWorker = new Worker(
    'incident-processing',
    async (job) => {
      const { incidentId, action } = job.data;
      console.log(`[Job Queue] Processing incident ${incidentId}: ${action}`);
      
      // Import dynamically
      const { withTransaction } = await import('../utils/transactions.js');
      
      if (action === 'dispatch') {
        const { dispatchIncidentWithTransaction } = await import('../utils/transactions.js');
        return await dispatchIncidentWithTransaction(incidentId, job.data.dispatchData);
      }
      
      if (action === 'resolve') {
        const { resolveIncidentWithTransaction } = await import('../utils/transactions.js');
        return await resolveIncidentWithTransaction(incidentId, job.data.resolutionData);
      }
      
      return null;
    },
    { connection }
  );

  incidentWorker.on('completed', (job) => {
    console.log(`[Job Queue] Incident processing completed for ${job.data.incidentId}`);
  });

  incidentWorker.on('failed', (job, err) => {
    console.error(`[Job Queue] Incident processing failed for ${job.data.incidentId}:`, err.message);
  });

  // Analytics Generation Worker
  const analyticsWorker = new Worker(
    'analytics-generation',
    async (job) => {
      const { reportType, filters } = job.data;
      console.log(`[Job Queue] Generating ${reportType} analytics report`);
      
      // Import dynamically
      const { Incident } = await import('../models/Incident.js');
      const { SpatialCell } = await import('../models/SpatialCell.js');
      
      let result;
      
      if (reportType === 'incident-summary') {
        result = await Incident.aggregate([
          { $match: filters || {} },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
      }
      
      if (reportType === 'risk-distribution') {
        result = await SpatialCell.aggregate([
          { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
        ]);
      }
      
      return result;
    },
    { connection }
  );

  analyticsWorker.on('completed', (job) => {
    console.log(`[Job Queue] Analytics generation completed: ${job.data.reportType}`);
  });

  analyticsWorker.on('failed', (job, err) => {
    console.error(`[Job Queue] Analytics generation failed: ${job.data.reportType}:`, err.message);
  });

  // Evidence Processing Worker
  const evidenceWorker = new Worker(
    'evidence-processing',
    async (job) => {
      const { incidentId, evidenceData } = job.data;
      console.log(`[Job Queue] Processing evidence for incident ${incidentId}`);
      
      // Process image compression, storage, etc.
      // This is a placeholder for actual evidence processing
      
      return {
        processed: true,
        incidentId,
        evidenceCount: evidenceData.length,
      };
    },
    { connection }
  );

  evidenceWorker.on('completed', (job) => {
    console.log(`[Job Queue] Evidence processing completed for ${job.data.incidentId}`);
  });

  evidenceWorker.on('failed', (job, err) => {
    console.error(`[Job Queue] Evidence processing failed for ${job.data.incidentId}:`, err.message);
  });

  return { riskWorker, incidentWorker, analyticsWorker, evidenceWorker };
}

/**
 * Add risk calculation job
 */
export async function addRiskCalculationJob(h3Index, telemetry) {
  return await riskCalculationQueue.add(
    'calculate-risk',
    { h3Index, telemetry },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
}

/**
 * Add incident processing job
 */
export async function addIncidentJob(incidentId, action, data) {
  return await incidentQueue.add(
    `incident-${action}`,
    { incidentId, action, ...data },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
}

/**
 * Add analytics generation job
 */
export async function addAnalyticsJob(reportType, filters) {
  return await analyticsQueue.add(
    'generate-analytics',
    { reportType, filters },
    {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  );
}

/**
 * Add evidence processing job
 */
export async function addEvidenceJob(incidentId, evidenceData) {
  return await evidenceQueue.add(
    'process-evidence',
    { incidentId, evidenceData },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  );
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const queues = [riskCalculationQueue, incidentQueue, analyticsQueue, evidenceQueue];
  const stats = {};
  
  for (const queue of queues) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    
    stats[queue.name] = { waiting, active, completed, failed };
  }
  
  return stats;
}

/**
 * Close all queues
 */
export async function closeQueues() {
  await Promise.all([
    riskCalculationQueue.close(),
    incidentQueue.close(),
    analyticsQueue.close(),
    evidenceQueue.close(),
  ]);
}
