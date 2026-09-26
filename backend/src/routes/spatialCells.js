import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { listActiveCells } from '../engine/risk.js';
import { SpatialCell } from '../models/SpatialCell.js';

const router = express.Router();

router.get('/', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    res.json({ cells: await listActiveCells() });
  } catch (error) {
    next(error);
  }
});

router.get('/:h3Index', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    const cell = await SpatialCell.findOne({ h3Index: req.params.h3Index }).lean();
    if (!cell) return res.status(404).json({ message: 'H3 cell not found.' });
    return res.json({ cell });
  } catch (error) {
    return next(error);
  }
});

export default router;