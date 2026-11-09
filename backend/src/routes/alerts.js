import express from 'express';
import mongoose from 'mongoose';
import { body, query, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { getCityCodeVariants } from '../services/cityConfig.js';
import {
  acknowledgeAlert,
  getAlertSummary,
  listAlerts,
  resolveAlert,
} from '../services/alertService.js';

const router = express.Router();

function cityScope(req) {
  if (req.user.role === 'admin' || req.user.role === 'administrator') return null;
  if (!req.user.cityCode) return null;
  return getCityCodeVariants(req.user.cityCode);
}

// GET /api/v1/alerts - Current and recent alert lifecycle records
router.get(
  '/',
  protect,
  authorize('operator', 'field', 'admin'),
  [
    query('status').optional().isString(),
    query('h3Index').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const alerts = await listAlerts({
        status: req.query.status,
        h3Index: req.query.h3Index,
        cityCodes: cityScope(req),
        limit: Number(req.query.limit) || 100,
      });
      return res.json({ count: alerts.length, alerts });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/v1/alerts/summary - Counts by lifecycle state and evidence quality
router.get('/summary', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    return res.json(await getAlertSummary(cityScope(req)));
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/v1/alerts/:alertId/acknowledge - An operator has seen the alert
router.patch(
  '/:alertId/acknowledge',
  protect,
  authorize('operator', 'admin'),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.alertId)) {
        return res.status(422).json({ message: 'Invalid alert ID format.' });
      }
      const alert = await acknowledgeAlert(req.params.alertId, req.user);
      return res.json({ alert });
    } catch (error) {
      return next(error);
    }
  }
);

// PATCH /api/v1/alerts/:alertId/resolve - Operator confirms an all-clear
router.patch(
  '/:alertId/resolve',
  protect,
  authorize('operator', 'admin'),
  [body('note').optional().isString().trim().isLength({ max: 300 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ message: errors.array()[0].msg });

    try {
      if (!mongoose.isValidObjectId(req.params.alertId)) {
        return res.status(422).json({ message: 'Invalid alert ID format.' });
      }
      const alert = await resolveAlert(req.params.alertId, req.user, req.body?.note);
      return res.json({ alert });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
