import mongoose from 'mongoose';

const spatialCellSchema = new mongoose.Schema(
  {
    h3Index: { type: String, required: true, unique: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    scores: {
      mobility: { type: Number, min: 0, max: 10, default: 0 },
      climate: { type: Number, min: 0, max: 10, default: 0 },
      vulnerability: { type: Number, min: 0, max: 10, default: 0 },
    },
    weights: {
      Wm: { type: Number, default: 0.4 },
      Wc: { type: Number, default: 0.4 },
      Wv: { type: Number, default: 0.2 },
    },
    compositeRisk: { type: Number, min: 0, max: 10, default: 0, index: true },
    riskLevel: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'],
      default: 'LOW',
      index: true,
    },
    trend: {
      type: String,
      enum: ['SURGING', 'RISING', 'STABLE', 'DE-ESCALATING'],
      default: 'STABLE',
    },
    riskVelocity: { type: Number, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 1.0 },
    cascadeRisk: { type: Number, min: 0, max: 10, default: 0 },
    telemetryStats: {
      eventCount: { type: Number, default: 0 },
      sources: [String],
      lastObservedAt: Date,
      transitEventsCount: { type: Number, default: 0 },
      weatherEventsCount: { type: Number, default: 0 },
      citizenEventsCount: { type: Number, default: 0 },
      gisEventsCount: { type: Number, default: 0 },
    },
    anomalyDetected: { type: Boolean, default: false },
    anomalyReason: { type: String, default: null },
    isDegraded: { type: Boolean, default: true },
    degradationReasons: [String],
    history: [
      {
        compositeRisk: Number,
        scores: {
          mobility: Number,
          climate: Number,
          vulnerability: Number,
        },
        calculatedAt: { type: Date, default: Date.now },
      },
    ],
    lastUpdated: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

spatialCellSchema.index({ compositeRisk: -1, lastUpdated: -1 });
spatialCellSchema.index({ riskLevel: 1, lastUpdated: -1 });

export const SpatialCell = mongoose.model('SpatialCell', spatialCellSchema);
