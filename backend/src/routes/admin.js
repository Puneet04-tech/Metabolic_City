import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { ConfigWeights } from '../models/ConfigWeights.js';
import { SpatialCell } from '../models/SpatialCell.js';
import { getActiveWeights, getRiskThreshold, recalculateAllActiveCells } from '../engine/risk.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

const router = express.Router();

function parseThreshold(value) {
  if (value === undefined || value === null) return undefined;
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 3 || threshold > 10) {
    throw new Error('Risk threshold must be a number between 3.0 and 10.0.');
  }
  return Number(threshold.toFixed(2));
}

function parseWeights(body) {
  const Wm = Number(body?.Wm);
  const Wc = Number(body?.Wc);
  const Wv = Number(body?.Wv);

  if (!Number.isFinite(Wm) || Wm < 0 || Wm > 1 ||
      !Number.isFinite(Wc) || Wc < 0 || Wc > 1 ||
      !Number.isFinite(Wv) || Wv < 0 || Wv > 1) {
    throw new Error('All weights (Wm, Wc, Wv) must be numbers between 0 and 1.');
  }

  const sum = Wm + Wc + Wv;
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`Weights must sum exactly to 1.0 (current sum: ${sum.toFixed(3)}).`);
  }

  return {
    Wm: Number(Wm.toFixed(3)),
    Wc: Number(Wc.toFixed(3)),
    Wv: Number(Wv.toFixed(3)),
  };
}

// GET /api/v1/admin/weights - Get current weights and threshold
router.get('/weights', protect, authorize('admin'), async (req, res, next) => {
  try {
    const [weights, threshold] = await Promise.all([getActiveWeights(), getRiskThreshold()]);
    return res.json({ weights, threshold });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/admin/weights/dry-run - Preview effect of weights on active cells
router.post('/weights/dry-run', protect, authorize('admin'), async (req, res, next) => {
  try {
    const weights = parseWeights(req.body);
    const threshold = req.body?.threshold != null ? parseThreshold(req.body.threshold) : await getRiskThreshold();
    const cells = await SpatialCell.find().sort({ compositeRisk: -1 }).limit(200).lean();

    const preview = cells.map((cell) => {
      const mobility = cell.scores?.mobility || 0;
      const climate = cell.scores?.climate || 0;
      const vulnerability = cell.scores?.vulnerability || 0;
      const projectedRisk = Number((weights.Wm * mobility + weights.Wc * climate + weights.Wv * vulnerability).toFixed(2));

      return {
        h3Index: cell.h3Index,
        currentRisk: cell.compositeRisk,
        projectedRisk,
        currentRiskLevel: cell.compositeRisk >= threshold ? 'CRITICAL' : cell.compositeRisk >= 5 ? 'HIGH' : 'NORMAL',
        projectedRiskLevel: projectedRisk >= threshold ? 'CRITICAL' : projectedRisk >= 5 ? 'HIGH' : 'NORMAL',
        delta: Number((projectedRisk - cell.compositeRisk).toFixed(2)),
      };
    });

    const criticalCountCurrent = preview.filter((p) => p.currentRisk >= threshold).length;
    const criticalCountProjected = preview.filter((p) => p.projectedRisk >= threshold).length;

    return res.json({
      weights,
      threshold,
      summary: {
        totalEvaluated: preview.length,
        currentCriticalCount: criticalCountCurrent,
        projectedCriticalCount: criticalCountProjected,
      },
      preview,
    });
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

// PUT /api/v1/admin/weights - Commit weight changes and recalculate cells
router.put('/weights', protect, authorize('admin'), async (req, res, next) => {
  try {
    const weights = parseWeights(req.body);
    const threshold = parseThreshold(req.body?.threshold);

    const patch = { ...weights, key: 'active', updatedBy: req.user._id };
    if (threshold !== undefined) patch.threshold = threshold;

    const configured = await ConfigWeights.findOneAndUpdate(
      { key: 'active' },
      { $set: patch },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();

    await AuditLog.create({
      actorId: req.user._id,
      action: 'WEIGHTS_UPDATED',
      entityType: 'config_weights',
      entityId: 'active',
      metadata: { ...weights, threshold: configured.threshold },
    });

    // Asynchronously trigger recalculation of active cells
    recalculateAllActiveCells().catch((err) =>
      console.error('[admin] Background cell recalculation after weight update failed:', err.message)
    );

    return res.json({
      message: 'Dynamic risk weights updated successfully. Active spatial cells are being recalculated.',
      weights: { Wm: configured.Wm, Wc: configured.Wc, Wv: configured.Wv },
      threshold: configured.threshold,
    });
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

// POST /api/v1/admin/recalculate-all - Force full spatial grid recalculation
router.post('/recalculate-all', protect, authorize('admin'), async (req, res, next) => {
  try {
    const results = await recalculateAllActiveCells();
    await AuditLog.create({
      actorId: req.user._id,
      action: 'MANUAL_GRID_RECALCULATION',
      entityType: 'spatial_grid',
      metadata: { cellsCount: results.length },
    });
    return res.json({ message: 'Recalculated all active spatial cells.', cellsUpdated: results.length });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/admin/users - List municipal users
router.get('/users', protect, authorize('admin'), async (req, res, next) => {
  try {
    const query = {};
    if (req.user.cityCode) query.cityCode = req.user.cityCode;
    const users = await User.find(query);
    return res.json({ users: users.map(({ password, ...user }) => user) });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/v1/admin/users/:userId/active - Activate / Deactivate user
router.patch('/users/:userId/active', protect, authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(422).json({ message: 'Invalid user ID format.' });
    }

    const active = Boolean(req.body?.active);
    const result = await User.updateOne({ _id: req.params.userId }, { $set: { active } });

    await AuditLog.create({
      actorId: req.user._id,
      action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: req.params.userId,
      metadata: { active },
    });

    return res.json({ updated: result.modifiedCount === 1, active });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/admin/audit-logs - Query system audit trails
router.get('/audit-logs', protect, authorize('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.entityType) filter.entityType = req.query.entityType;

    const logs = await AuditLog.find(filter)
      .populate('actorId', 'name email role staffId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ count: logs.length, logs });
  } catch (error) {
    return next(error);
  }
});

export default router;
