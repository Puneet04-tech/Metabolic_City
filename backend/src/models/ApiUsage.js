import mongoose from 'mongoose';

/**
 * How much of a provider's monthly allowance has been spent.
 *
 * The record is keyed by provider and month, so the counter survives a
 * restart and a new month starts with the allowance intact.
 */
const ApiUsageSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    month: { type: String, required: true },
    used: { type: Number, default: 0 },
    limit: { type: Number, required: true },
  },
  { timestamps: true }
);

ApiUsageSchema.index({ provider: 1, month: 1 }, { unique: true });

export const ApiUsage =
  mongoose.models.ApiUsage || mongoose.model('ApiUsage', ApiUsageSchema);
export default ApiUsage;
