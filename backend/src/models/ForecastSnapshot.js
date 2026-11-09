import mongoose from 'mongoose';

/**
 * A forecast as it was published, kept so it can be scored later.
 *
 * The cell's `forecast` field is the current projection. This collection is the
 * audit trail: it preserves what the model said at the time, which is the only
 * way to measure lead-time error without rewriting history.
 */
const forecastPointSchema = new mongoose.Schema(
  {
    minutes: Number,
    at: Date,
    risk: Number,
    mobility: Number,
    climate: Number,
    rainMmHr: Number,
    floodRisk: Number,
    floodProbability: Number,
    floodDepthM: Number,
    actualRisk: Number,
    error: Number,
    verifiedAt: Date,
    verification: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'NO_OBSERVATION_AT_TARGET'],
      default: 'PENDING',
    },
  },
  { _id: false }
);

const forecastSnapshotSchema = new mongoose.Schema(
  {
    h3Index: { type: String, required: true, index: true },
    cityCode: { type: String, default: null, index: true },
    bucket: { type: Date, required: true, index: true },
    generatedAt: { type: Date, required: true },
    source: { type: String, default: 'trend+weather' },
    modelVersion: { type: String, default: 'trend-weather-v1' },
    points: [forecastPointSchema],
  },
  { timestamps: true }
);

forecastSnapshotSchema.index({ h3Index: 1, bucket: 1 }, { unique: true });
forecastSnapshotSchema.index({ 'points.at': 1, 'points.verification': 1 });
forecastSnapshotSchema.index({ generatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const ForecastSnapshot =
  mongoose.models.ForecastSnapshot || mongoose.model('ForecastSnapshot', forecastSnapshotSchema);
