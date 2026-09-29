import mongoose from 'mongoose';

const configWeightsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'active', unique: true },
    Wm: { type: Number, required: true, min: 0, max: 1 },
    Wc: { type: Number, required: true, min: 0, max: 1 },
    Wv: { type: Number, required: true, min: 0, max: 1 },
    threshold: { type: Number, default: 7, min: 3, max: 10 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ConfigWeights = mongoose.model('ConfigWeights', configWeightsSchema);