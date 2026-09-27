import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { ConfigWeights } from '../models/ConfigWeights.js';
import { SpatialCell } from '../models/SpatialCell.js';
import { getActiveWeights } from '../engine/risk.js';

const router = express.Router();

function parseWeights(body) {
  const weights = { Wm: Number(body?.Wm), Wc: Number(body?.Wc), Wv: Number(body?.Wv) };
  if (Object.values(weights).some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error('Weights must be numbers between 0 and 1.');
  if (Math.abs(weights.Wm + weights.Wc + weights.Wv - 1) > 0.0001) throw new Error('Weights must sum exactly to 1.');
  return weights;
}

router.get('/weights', protect, authorize('admin'), async (req, res, next) => {
  try { return res.json({ weights: await getActiveWeights() }); } catch (error) { return next(error); }
});

router.post('/weights/dry-run', protect, authorize('admin'), async (req, res, next) => {
  try {
    const weights = parseWeights(req.body);
    const cells = await SpatialCell.find().limit(200).lean();
    const preview = cells.map((cell) => ({
      h3Index: cell.h3Index,
      currentRisk: cell.compositeRisk,
      projectedRisk: Number((weights.Wm * cell.scores.mobility + weights.Wc * cell.scores.climate + weights.Wv * cell.scores.vulnerability).toFixed(2)),
    }));
    return res.json({ weights, preview });
  } catch (error) { return res.status(422).json({ message: error.message }); }
});

router.put('/weights', protect, authorize('admin'), async (req, res, next) => {
  try {
    const weights = parseWeights(req.body);
    const configured = await ConfigWeights.findOneAndUpdate(
      { key: 'active' },
      { $set: { ...weights, key: 'active', updatedBy: req.user._id } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
    return res.json({ weights: configured });
  } catch (error) { return res.status(422).json({ message: error.message }); }
});

export default router;