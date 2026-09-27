import mongoose from 'mongoose';

const cellLockSchema = new mongoose.Schema(
  {
    h3Index: { type: String, required: true, unique: true, index: true },
    lockOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

cellLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CellLock = mongoose.model('CellLock', cellLockSchema);