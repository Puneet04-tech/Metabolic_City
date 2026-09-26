import mongoose from 'mongoose';

const tokenSessionSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tokenSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenSession = mongoose.model('TokenSession', tokenSessionSchema);