import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { CellLock } from '../models/CellLock.js';
import { Incident } from '../models/Incident.js';
import { SpatialCell } from '../models/SpatialCell.js';
import { synthesizeAction } from '../services/actionSynthesizer.js';
import { AuditLog } from '../models/AuditLog.js';

const router = express.Router();

const criticalOnly = async (h3Index) => {
  const cell = await SpatialCell.findOne({ h3Index }).lean();
  if (!cell) throw new Error('H3 cell not found.');
  if (cell.compositeRisk < 7) throw new Error('Action synthesis is available only for critical cells with risk >= 7.');
  return cell;
};

router.get('/', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const incidents = await Incident.find().sort({ detectedAt: -1 }).limit(100).lean();
    return res.json({ incidents });
  } catch (error) {
    return next(error);
  }
});

router.get('/:h3Index/action', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const cell = await criticalOnly(req.params.h3Index);
    const action = await synthesizeAction(cell, req.query.transitAlert ? [req.query.transitAlert] : []);
    const activeLock = await CellLock.findOne({ h3Index: cell.h3Index, expiresAt: { $gt: new Date() } }).lean();
    return res.json({ cell, action, lock: activeLock ? { ownerId: activeLock.lockOwnerId, expiresAt: activeLock.expiresAt } : null });
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

router.post('/:h3Index/lock', protect, authorize('operator'), async (req, res, next) => {
  try {
    await criticalOnly(req.params.h3Index);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000);
    const lock = await CellLock.findOneAndUpdate(
      { h3Index: req.params.h3Index, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { h3Index: req.params.h3Index, lockOwnerId: req.user._id, expiresAt } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
    return res.status(201).json({ status: 'LOCK_ACQUIRED', lock });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ status: 'LOCKED_BY_OTHER_OPERATOR', message: 'Another operator owns this cell lock.' });
    return next(error);
  }
});

router.post('/:h3Index/decision', protect, authorize('operator'), async (req, res, next) => {
  try {
    const { decision, overrideReason } = req.body || {};
    if (!['approve', 'override'].includes(decision)) return res.status(422).json({ message: 'decision must be approve or override.' });
    const cell = await criticalOnly(req.params.h3Index);
    const lock = await CellLock.findOne({ h3Index: cell.h3Index, lockOwnerId: req.user._id, expiresAt: { $gt: new Date() } }).lean();
    if (!lock) return res.status(409).json({ status: 'LOCK_REQUIRED', message: 'Acquire the active cell lock before deciding.' });
    const action = await synthesizeAction(cell);
    const incident = await Incident.create({
      h3Index: cell.h3Index,
      riskScore: cell.compositeRisk,
      scores: cell.scores,
      action,
      status: decision === 'approve' ? 'APPROVED' : 'OVERRIDDEN',
      operatorId: req.user._id,
      operatorDecisionAt: new Date(),
      overrideReason: decision === 'override' ? overrideReason : undefined,
      lockOwnerId: req.user._id,
    });
    await CellLock.deleteOne({ _id: lock._id });
    await AuditLog.create({ actorId: req.user._id, action: `INCIDENT_${decision.toUpperCase()}`, entityType: 'incident', entityId: incident._id.toString(), metadata: { h3Index: cell.h3Index, riskScore: cell.compositeRisk } });
    return res.status(201).json({ incident });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:incidentId/assign', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const incident = await Incident.findByIdAndUpdate(
      req.params.incidentId,
      { $set: { assignedCrewId: req.body?.crewId, status: 'DISPATCHED', dispatchedAt: new Date() } },
      { returnDocument: 'after' }
    ).lean();
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    await AuditLog.create({ actorId: req.user._id, action: 'INCIDENT_ASSIGNED', entityType: 'incident', entityId: incident._id.toString(), metadata: { crewId: req.body?.crewId } });
    return res.json({ incident });
  } catch (error) { return next(error); }
});

export default router;