import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { ConfigWeights } from '../models/ConfigWeights.js';
import { SpatialCell } from '../models/SpatialCell.js';
import { getActiveWeights } from '../engine/risk.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

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
    await AuditLog.create({ actorId: req.user._id, action: 'WEIGHTS_UPDATED', entityType: 'config_weights', entityId: 'active', metadata: weights });
    return res.json({ weights: configured });
  } catch (error) { return res.status(422).json({ message: error.message }); }
});

router.get('/users', protect, authorize('admin'), async (req, res, next) => {
  try { return res.json({ users: (await User.find({ cityCode: req.user.cityCode })).map(({ password, ...user }) => user) }); } catch (error) { return next(error); }
});

router.patch('/users/:userId/active', protect, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.updateOne(req.params.userId, { $set: { active: Boolean(req.body?.active) } });
    await AuditLog.create({ actorId: req.user._id, action: 'USER_STATUS_UPDATED', entityType: 'user', entityId: req.params.userId, metadata: { active: Boolean(req.body?.active) } });
    return res.json({ updated: user.modifiedCount === 1 });
  } catch (error) { return next(error); }
});

export default router;