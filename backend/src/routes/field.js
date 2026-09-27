import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { Incident } from '../models/Incident.js';

const router = express.Router();
const allowedStatuses = ['ACKNOWLEDGED', 'ARRIVED', 'RESOLVED'];

router.get('/tasks', protect, authorize('field'), async (req, res, next) => {
  try {
    const incidents = await Incident.find({
      $or: [{ assignedCrewId: req.user._id }, { status: 'APPROVED', assignedCrewId: { $exists: false } }],
      status: { $in: ['APPROVED', 'DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED'] },
    }).sort({ detectedAt: -1 }).limit(50).lean();
    return res.json({ incidents });
  } catch (error) {
    return next(error);
  }
});

router.post('/sync', protect, authorize('field'), async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (!updates.length || updates.length > 50) return res.status(422).json({ message: 'updates must contain 1 to 50 items.' });
    const results = [];
    for (const update of updates) {
      if (!update.incidentId || !allowedStatuses.includes(update.status)) {
        results.push({ clientId: update.clientId, accepted: false, message: 'Invalid incidentId or status.' });
        continue;
      }
      const fields = { status: update.status, assignedCrewId: req.user._id };
      if (update.status === 'ACKNOWLEDGED') fields.acknowledgedAt = new Date();
      if (update.status === 'ARRIVED') fields.arrivedAt = new Date();
      if (update.status === 'RESOLVED') {
        fields.resolvedAt = new Date();
        fields.resolutionNote = String(update.resolutionNote || '').slice(0, 1000);
        fields.resolutionPhotoUrl = update.resolutionPhotoUrl;
        fields.resolutionLatitude = update.latitude;
        fields.resolutionLongitude = update.longitude;
      }
      const incident = await Incident.findOneAndUpdate(
        { _id: update.incidentId, $or: [{ assignedCrewId: req.user._id }, { assignedCrewId: { $exists: false } }] },
        { $set: fields },
        { returnDocument: 'after' }
      ).lean();
      results.push({ clientId: update.clientId, accepted: Boolean(incident), incidentId: update.incidentId });
    }
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

export default router;