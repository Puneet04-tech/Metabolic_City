import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { Incident } from '../models/Incident.js';
import { AuditLog } from '../models/AuditLog.js';
import { broadcastIncident } from '../engine/stream.js';
import { ingest } from './telemetry.js';

const router = express.Router();
const allowedStatuses = ['ACKNOWLEDGED', 'ARRIVED', 'RESOLVED'];

// GET /api/v1/field/tasks - List assigned and unassigned approved tasks
router.get('/tasks', protect, authorize('field', 'admin'), async (req, res, next) => {
  try {
    const incidents = await Incident.find({
      $or: [
        { assignedCrewId: req.user._id },
        { status: 'APPROVED', assignedCrewId: { $exists: false } },
        { status: 'DISPATCHED', assignedCrewId: req.user._id },
      ],
      status: { $in: ['APPROVED', 'DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED'] },
    })
      .sort({ detectedAt: -1 })
      .limit(50)
      .lean();

    return res.json({ count: incidents.length, incidents });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/field/sync - Synchronize outbox queue from offline field console
router.post('/sync', protect, authorize('field', 'admin'), async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (!updates.length || updates.length > 50) {
      return res.status(422).json({ message: 'updates must contain an array of 1 to 50 items.' });
    }

    const results = [];
    for (const update of updates) {
      const { clientId, incidentId, status, resolutionNote, resolutionPhotoUrl, latitude, longitude } = update;

      if (!incidentId || !allowedStatuses.includes(status)) {
        results.push({
          clientId,
          incidentId,
          accepted: false,
          message: `Invalid incidentId or status. Allowed statuses: ${allowedStatuses.join(', ')}`,
        });
        continue;
      }

      const fields = { status, assignedCrewId: req.user._id };
      if (status === 'ACKNOWLEDGED') fields.acknowledgedAt = new Date();
      if (status === 'ARRIVED') fields.arrivedAt = new Date();
      if (status === 'RESOLVED') {
        fields.resolvedAt = new Date();
        if (resolutionNote) fields.resolutionNote = String(resolutionNote).slice(0, 1000);
        if (resolutionPhotoUrl) fields.resolutionPhotoUrl = String(resolutionPhotoUrl);
        if (Number.isFinite(Number(latitude))) fields.resolutionLatitude = Number(latitude);
        if (Number.isFinite(Number(longitude))) fields.resolutionLongitude = Number(longitude);
      }

      const incident = await Incident.findOneAndUpdate(
        {
          _id: incidentId,
          $or: [{ assignedCrewId: req.user._id }, { assignedCrewId: { $exists: false } }],
        },
        { $set: fields },
        { returnDocument: 'after' }
      ).lean();

      if (incident) {
        broadcastIncident(incident);
        await AuditLog.create({
          actorId: req.user._id,
          action: `FIELD_${status}`,
          entityType: 'incident',
          entityId: incident._id.toString(),
          metadata: { status, latitude, longitude, hasPhoto: Boolean(resolutionPhotoUrl) },
        });
        results.push({ clientId, accepted: true, incidentId });
      } else {
        results.push({
          clientId,
          accepted: false,
          incidentId,
          message: 'Incident not found or already assigned to another crew member.',
        });
      }
    }

    return res.json({
      total: updates.length,
      synced: results.filter((r) => r.accepted).length,
      results,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/field/history - Resolved assignments by this crew member
router.get('/history', protect, authorize('field', 'admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const incidents = await Incident.find({
      assignedCrewId: req.user._id,
      status: 'RESOLVED',
    })
      .sort({ resolvedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ count: incidents.length, incidents });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/field/report - Direct on-ground hazard reporting by field crew
router.post(
  '/report',
  protect,
  authorize('field', 'admin'),
  [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('reportText').isString().trim().notEmpty().withMessage('Hazard description is required.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ message: errors.array()[0].msg });
    }

    try {
      const result = await ingest('CITIZEN_311', {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        reportText: `[FIELD CREW VERIFIED REPORT] ${req.body.reportText}`,
        senderId: `CREW_${req.user._id}`,
        category: req.body.category || 'GENERAL_HAZARD',
        imageUrls: req.body.imageUrls || [],
        vulnerabilityScore: Number(req.body.vulnerabilityScore) || undefined,
        cityCode: req.user.cityCode,
      });

      return res.status(201).json({
        message: 'Field hazard telemetry recorded successfully.',
        event: result.event,
        cell: result.cell,
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
