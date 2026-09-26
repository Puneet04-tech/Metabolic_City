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
    weights: { Wm: { type: Number, default: 0.4 }, Wc: { type: Number, default: 0.4 }, Wv: { type: Number, default: 0.2 } },
    compositeRisk: { type: Number, min: 0, max: 10, default: 0 },
    isDegraded: { type: Boolean, default: true },
    degradationReasons: [String],
    lastUpdated: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const SpatialCell = mongoose.model('SpatialCell', spatialCellSchema);