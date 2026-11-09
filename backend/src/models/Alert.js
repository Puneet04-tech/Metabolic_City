import mongoose from 'mongoose';

/**
 * A live alert with a lifecycle.
 *
 * The cell snapshot says what is wrong right now. This record says since when,
 * who acknowledged it, what evidence backs it, and whether it ended with an
 * all-clear or simply stopped being observed. That distinction is what turns a
 * coloured cell into an operational alert.
 */
const alertSchema = new mongoose.Schema(
  {
    alertKey: { type: String, required: true, unique: true, index: true },
    h3Index: { type: String, required: true, index: true },
    cityCode: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: ['INCIDENT', 'CONGESTION', 'REPORT', 'SENSOR'],
      required: true,
      index: true,
    },
    severity: { type: Number, min: 0, max: 10, default: 0, index: true },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    category: { type: String, default: null },
    status: {
      type: String,
      enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'EXPIRED'],
      default: 'OPEN',
      index: true,
    },
    verification: {
      type: String,
      enum: ['UNVERIFIED', 'PROVIDER_REPORTED', 'OBSERVED', 'CORROBORATED', 'VERIFIED'],
      default: 'UNVERIFIED',
      index: true,
    },
    evidenceCount: { type: Number, default: 1 },
    firstSeenAt: { type: Date, default: Date.now, index: true },
    lastSeenAt: { type: Date, default: Date.now },
    acknowledgedAt: Date,
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // ALL_CLEAR is a confirmed return to normal. EXPIRED means the feed went
    // quiet before anyone could confirm that the hazard ended.
    resolution: {
      type: String,
      enum: ['ALL_CLEAR', 'OPERATOR_ALL_CLEAR', 'NO_FRESH_OBSERVATION', 'SUPERSEDED'],
      default: null,
    },
    transitions: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: String,
      },
    ],
    revision: { type: Number, default: 1 },
  },
  { timestamps: true }
);

alertSchema.index({ status: 1, severity: -1, lastSeenAt: -1 });
alertSchema.index({ h3Index: 1, status: 1, lastSeenAt: -1 });
alertSchema.index({ cityCode: 1, status: 1, severity: -1 });
alertSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema);
