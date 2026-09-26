import mongoose from 'mongoose';

const deadLetterMessageSchema = new mongoose.Schema(
  {
    sourceType: String,
    payloadRaw: mongoose.Schema.Types.Mixed,
    errorType: { type: String, required: true },
    failureReason: { type: String, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

deadLetterMessageSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const DeadLetterMessage = mongoose.model('DeadLetterMessage', deadLetterMessageSchema);