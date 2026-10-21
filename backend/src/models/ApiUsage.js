import mongoose from 'mongoose';

/**
 * How much of a provider's daily allowance has been spent.
 *
 * The record is keyed by provider and day, so the counter survives a restart
 * and a new day starts with the allowance intact.
 */
const ApiUsageSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    day: { type: String, required: true },
    used: { type: Number, default: 0 },
    limit: { type: Number, required: true },
  },
  { timestamps: true }
);

ApiUsageSchema.index({ provider: 1, day: 1 }, { unique: true });

export const ApiUsage =
  mongoose.models.ApiUsage || mongoose.model('ApiUsage', ApiUsageSchema);
export default ApiUsage;
