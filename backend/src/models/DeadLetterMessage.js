import mongoose from 'mongoose';

/**
 * Dead Letter Message Schema
 * Reliability Principle: Error Handling - Dead Letter Queue for failed jobs
 * 
 * Supports both telemetry validation errors (legacy) and BullMQ job failures (new)
 */

const deadLetterMessageSchema = new mongoose.Schema({
  // BullMQ job failure fields
  jobId: { type: String, index: true },
  queueName: { type: String, index: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  
  // Legacy telemetry validation fields
  sourceType: { type: String },
  payloadRaw: { type: mongoose.Schema.Types.Mixed },
  errorType: { type: String },
  
  // Common fields
  failedReason: { type: String, required: true },
  stackTrace: { type: String },
  attempts: { type: Number, default: 0 },
  receivedAt: { type: Date, default: Date.now, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  processed: { type: Boolean, default: false },
  processingNote: { type: String },
});

deadLetterMessageSchema.index({ queueName: 1, timestamp: -1 });
deadLetterMessageSchema.index({ processed: 1, timestamp: -1 });
deadLetterMessageSchema.index({ sourceType: 1, receivedAt: -1 });

export const DeadLetterMessage = mongoose.models.DeadLetterMessage || mongoose.model('DeadLetterMessage', deadLetterMessageSchema);

/**
 * Create dead letter message for BullMQ job failure
 */
export async function createDeadLetterMessage(jobId, queueName, payload, failedReason, stackTrace) {
  return await DeadLetterMessage.create({
    jobId,
    queueName,
    payload,
    failedReason,
    stackTrace,
    attempts: 1,
  });
}

/**
 * Retry dead letter message
 */
export async function retryDeadLetterMessage(dlqId) {
  const dlq = await DeadLetterMessage.findById(dlqId);
  if (!dlq) {
    throw new Error('Dead letter message not found');
  }
  
  dlq.processed = true;
  dlq.processingNote = 'Manually retried';
  await dlq.save();
  
  return dlq;
}

/**
 * Get all unprocessed dead letter messages
 */
export async function getUnprocessedDLQ(queueName, limit = 100) {
  return DeadLetterMessage.find({
    queueName,
    processed: false,
  })
    .sort({ timestamp: -1 })
    .limit(limit);
}

/**
 * Get dead letter message statistics
 */
export async function getDLQStats() {
  const stats = await DeadLetterMessage.aggregate([
    {
      $group: {
        _id: '$queueName',
        count: { $sum: 1 },
      },
    },
  ]);
  
  return stats.map(stat => ({
    queueName: stat._id,
    count: stat.count,
  }));
}
