import express from 'express';
import * as h3 from 'h3-js';
import { protect, authorize } from '../middleware/auth.js';
import { listActiveCells, recalculateCell, getRiskDistributionSummary } from '../engine/risk.js';
import { SpatialCell } from '../models/SpatialCell.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';

const router = express.Router();

// GET /api/v1/spatial-cells/summary - Statistical overview
router.get('/summary', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    const summary = await getRiskDistributionSummary();
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/spatial-cells - List active cells with filtering
router.get('/', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    const { minRisk, riskLevel, isDegraded, limit } = req.query;
    const cells = await listActiveCells({
      minRisk: minRisk != null ? Number(minRisk) : undefined,
      riskLevel,
      isDegraded: isDegraded != null ? isDegraded === 'true' : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return res.json({ count: cells.length, cells });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/spatial-cells/:h3Index - Single cell details with telemetry breakdown
router.get('/:h3Index', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    const cell = await SpatialCell.findOne({ h3Index: req.params.h3Index }).lean();
    if (!cell) {
      return res.status(404).json({ message: 'H3 spatial cell not found.' });
    }

    // Get recent raw events for this cell
    const recentEvents = await TelemetryEvent.find({
      h3Index: req.params.h3Index,
      observedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    })
      .sort({ observedAt: -1 })
      .limit(20)
      .lean();

    return res.json({ cell, recentEvents });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/spatial-cells/:h3Index/neighbors - Get immediate 6 neighbors and boundary
router.get('/:h3Index/neighbors', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    const { h3Index } = req.params;
    const diskFn = h3.gridDisk || h3.kRing;
    if (typeof diskFn !== 'function') {
      return res.status(500).json({ message: 'H3 disk function not available.' });
    }

    const neighborIndexes = diskFn(h3Index, 1);
    const neighborCells = await SpatialCell.find({ h3Index: { $in: neighborIndexes } }).lean();

    return res.json({
      centerCell: h3Index,
      neighborCount: neighborCells.length,
      neighbors: neighborCells,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/spatial-cells/:h3Index/recalculate - Force recalculation
router.post('/:h3Index/recalculate', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const cell = await recalculateCell(req.params.h3Index);
    return res.json({ message: 'Spatial cell recalculated successfully.', cell });
  } catch (error) {
    return next(error);
  }
});

export default router;
