import express from 'express';
import mongoose from 'mongoose';
import { body, query, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { CellLock } from '../models/CellLock.js';
import { Incident } from '../models/Incident.js';
import { SpatialCell } from '../models/SpatialCell.js';
import { synthesizeAction } from '../services/actionSynthesizer.js';
import { AuditLog } from '../models/AuditLog.js';
import { getRiskThreshold } from '../engine/risk.js';
import { broadcastIncident } from '../engine/stream.js';

const router = express.Router();

const criticalOnly = async (h3Index) => {
  const cell = await SpatialCell.findOne({ h3Index }).lean();
  const threshold = await getRiskThreshold();
  if (!cell) {
    const error = new Error('H3 spatial cell not found.');
    error.status = 404;
    throw error;
  }
  // Removed threshold restriction - operators can dispatch any cell
  // Warning is shown in the UI instead
  return cell;
};

// GET /api/v1/incidents - List incidents with filtering & pagination
router.get(
  '/',
  protect,
  authorize('operator', 'admin', 'field'),
  [
    query('status').optional().isString(),
    query('priority').optional().isString(),
    query('h3Index').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 200);
      const filter = {};

      if (req.query.status) {
        const statuses = req.query.status.split(',').map((s) => s.trim().toUpperCase());
        filter.status = { $in: statuses };
      }
      if (req.query.priority) filter['action.priority'] = req.query.priority.toUpperCase();
      if (req.query.h3Index) filter.h3Index = req.query.h3Index;

      const incidents = await Incident.find(filter)
        .populate('operatorId', 'name email staffId')
        .populate('assignedCrewId', 'name phone')
        .sort({ detectedAt: -1 })
        .limit(limit)
        .lean();

      return res.json({ count: incidents.length, incidents });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/v1/incidents/:id - Get single incident
router.get('/:incidentId', protect, authorize('operator', 'admin', 'field'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.incidentId)) {
      return res.status(422).json({ message: 'Invalid incident ID format.' });
    }

    const incident = await Incident.findById(req.params.incidentId)
      .populate('operatorId', 'name email staffId')
      .populate('assignedCrewId', 'name phone')
      .lean();

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found.' });
    }

    return res.json({ incident });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/incidents/:h3Index/action - Synthesize action for critical cell
router.get('/:h3Index/action', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const cell = await criticalOnly(req.params.h3Index);
    const transitAlerts = req.query.transitAlert ? (Array.isArray(req.query.transitAlert) ? req.query.transitAlert : [req.query.transitAlert]) : [];
    const action = await synthesizeAction(cell, transitAlerts);

    const activeLock = await CellLock.findOne({
      h3Index: cell.h3Index,
      expiresAt: { $gt: new Date() },
    }).lean();

    return res.json({
      cell,
      action,
      lock: activeLock ? { ownerId: activeLock.lockOwnerId, expiresAt: activeLock.expiresAt } : null,
    });
  } catch (error) {
    return res.status(error.status || 422).json({ message: error.message });
  }
});

// POST /api/v1/incidents/:h3Index/lock - Acquire mutex on cell decision
router.post('/:h3Index/lock', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    await criticalOnly(req.params.h3Index);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // 60s TTL

    const lock = await CellLock.findOneAndUpdate(
      {
        h3Index: req.params.h3Index,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }, { lockOwnerId: req.user._id }],
      },
      {
        $set: {
          h3Index: req.params.h3Index,
          lockOwnerId: req.user._id,
          expiresAt,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();

    return res.status(201).json({ status: 'LOCK_ACQUIRED', lock });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: 'LOCKED_BY_OTHER_OPERATOR',
        message: 'Another operator is currently evaluating this critical spatial cell.',
      });
    }
    return next(error);
  }
});

// POST /api/v1/incidents/:h3Index/decision - Operator approval or override
router.post(
  '/:h3Index/decision',
  protect,
  authorize('operator', 'admin'),
  [
    body('decision').isIn(['approve', 'override']).withMessage('decision must be approve or override.'),
    body('overrideReason').optional().isString().trim(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ message: errors.array()[0].msg });
    }

    try {
      const { decision, overrideReason } = req.body;
      const cell = await criticalOnly(req.params.h3Index);

      const lock = await CellLock.findOne({
        h3Index: cell.h3Index,
        lockOwnerId: req.user._id,
        expiresAt: { $gt: new Date() },
      }).lean();

      if (!lock) {
        return res.status(409).json({
          status: 'LOCK_REQUIRED',
          message: 'An active cell lock owned by your session is required before committing an incident decision.',
        });
      }

      const action = await synthesizeAction(cell);
      const incident = await Incident.create({
        h3Index: cell.h3Index,
        cityCode: req.user.cityCode || 'CITY-IND-BPL8',
        riskScore: cell.compositeRisk,
        scores: cell.scores,
        action,
        status: decision === 'approve' ? 'APPROVED' : 'OVERRIDDEN',
        operatorId: req.user._id,
        operatorDecisionAt: new Date(),
        overrideReason: decision === 'override' ? overrideReason || 'Operator manual intervention' : undefined,
        lockOwnerId: req.user._id,
      });

      await CellLock.deleteOne({ _id: lock._id });

      await AuditLog.create({
        actorId: req.user._id,
        action: `INCIDENT_${decision.toUpperCase()}`,
        entityType: 'incident',
        entityId: incident._id.toString(),
        metadata: {
          h3Index: cell.h3Index,
          riskScore: cell.compositeRisk,
          decision,
          overrideReason,
        },
      });

      broadcastIncident(incident);
      return res.status(201).json({ incident });
    } catch (error) {
      return next(error);
    }
  }
);

// PATCH /api/v1/incidents/:incidentId/assign - Dispatch to field crew
router.patch(
  '/:incidentId/assign',
  protect,
  authorize('operator', 'admin'),
  [body('crewId').isMongoId().withMessage('A valid crewId is required.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ message: errors.array()[0].msg });
    }

    try {
      const incident = await Incident.findByIdAndUpdate(
        req.params.incidentId,
        {
          $set: {
            assignedCrewId: req.body.crewId,
            status: 'DISPATCHED',
            dispatchedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      )
        .populate('assignedCrewId', 'name phone')
        .lean();

      if (!incident) {
        return res.status(404).json({ message: 'Incident not found.' });
      }

      await AuditLog.create({
        actorId: req.user._id,
        action: 'INCIDENT_ASSIGNED',
        entityType: 'incident',
        entityId: incident._id.toString(),
        metadata: { crewId: req.body.crewId, status: 'DISPATCHED' },
      });

      broadcastIncident(incident);
      return res.json({ incident });
    } catch (error) {
      return next(error);
    }
  }
);

// POST /api/v1/incidents/:incidentId/notes - Add field/operator note
router.post(
  '/:incidentId/notes',
  protect,
  authorize('operator', 'admin', 'field'),
  [body('note').isString().trim().notEmpty().withMessage('Note text is required.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ message: errors.array()[0].msg });
    }

    try {
      const incident = await Incident.findByIdAndUpdate(
        req.params.incidentId,
        {
          $push: {
            fieldNotes: {
              crewId: req.user._id,
              note: req.body.note.trim(),
              timestamp: new Date(),
            },
          },
        },
        { returnDocument: 'after' }
      ).lean();

      if (!incident) {
        return res.status(404).json({ message: 'Incident not found.' });
      }

      return res.json({ incident });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
