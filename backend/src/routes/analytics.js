import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { AuditLog } from '../models/AuditLog.js';
import { Incident } from '../models/Incident.js';

const router = express.Router();

router.get('/summary', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const [counts, recent, audits] = await Promise.all([
      Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, averageRisk: { $avg: '$riskScore' } } }]),
      Incident.find().sort({ detectedAt: -1 }).limit(100).lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    return res.json({ counts, incidents: recent, auditLogs: audits });
  } catch (error) {
    return next(error);
  }
});

export default router;