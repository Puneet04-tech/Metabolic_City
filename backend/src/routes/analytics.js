import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { AuditLog } from '../models/AuditLog.js';
import { Incident } from '../models/Incident.js';
import { SpatialCell } from '../models/SpatialCell.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { getRiskThreshold } from '../engine/risk.js';

const router = express.Router();

function msBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from : null;
}

function averageMs(values) {
  const present = values.filter((v) => v !== null);
  if (!present.length) return null;
  return Math.round(present.reduce((acc, v) => acc + v, 0) / present.length);
}

function msToReadable(ms) {
  if (ms == null) return null;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

function velocityMetrics(incidents) {
  const detectionToApproval = incidents
    .filter((i) => i.operatorDecisionAt || ['APPROVED', 'OVERRIDDEN'].includes(i.status))
    .map((i) => msBetween(i.detectedAt, i.operatorDecisionAt || i.dispatchedAt));

  const approvalToResolution = incidents.map((i) =>
    msBetween(i.operatorDecisionAt || i.dispatchedAt, i.resolvedAt)
  );

  const dispatchToAck = incidents.map((i) => msBetween(i.dispatchedAt, i.acknowledgedAt));
  const ackToArrival = incidents.map((i) => msBetween(i.acknowledgedAt, i.arrivedAt));
  const arrivalToResolution = incidents.map((i) => msBetween(i.arrivedAt, i.resolvedAt));

  const closed = incidents.filter((i) => i.resolvedAt);
  const total = incidents.length;

  return {
    totalIncidents: total,
    resolved: closed.length,
    resolutionRate: total ? Math.round((closed.length / total) * 100) : 0,
    avgDetectionToApprovalMs: averageMs(detectionToApproval),
    avgDetectionToApproval: msToReadable(averageMs(detectionToApproval)),
    avgApprovalToResolutionMs: averageMs(approvalToResolution),
    avgApprovalToResolution: msToReadable(averageMs(approvalToResolution)),
    avgDispatchToAckMs: averageMs(dispatchToAck),
    avgDispatchToAck: msToReadable(averageMs(dispatchToAck)),
    avgAckToArrivalMs: averageMs(ackToArrival),
    avgAckToArrival: msToReadable(averageMs(ackToArrival)),
    avgArrivalToResolutionMs: averageMs(arrivalToResolution),
    avgArrivalToResolution: msToReadable(averageMs(arrivalToResolution)),
  };
}

// GET /api/v1/analytics/summary - Full operational dashboard aggregation
router.get('/summary', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const [counts, recentIncidents, audits, threshold] = await Promise.all([
      Incident.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            averageRisk: { $avg: '$riskScore' },
            maxRisk: { $max: '$riskScore' },
          },
        },
      ]),
      Incident.find().sort({ detectedAt: -1 }).limit(100).lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(100).lean(),
      getRiskThreshold(),
    ]);

    const metrics = velocityMetrics(recentIncidents);

    return res.json({
      threshold,
      statusCounts: counts,
      incidents: recentIncidents,
      auditLogs: audits,
      metrics,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/analytics/risk-heatmap - Current risk distribution across cells
router.get('/risk-heatmap', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cells = await SpatialCell.find(
      { lastUpdated: { $gte: cutoff } },
      {
        h3Index: 1,
        latitude: 1,
        longitude: 1,
        compositeRisk: 1,
        riskLevel: 1,
        trend: 1,
        confidence: 1,
        scores: 1,
        isDegraded: 1,
      }
    )
      .sort({ compositeRisk: -1 })
      .lean();

    return res.json({ count: cells.length, cells });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/analytics/telemetry-volume - Hourly telemetry volume for past 24h
router.get('/telemetry-volume', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const volumeByHour = await TelemetryEvent.aggregate([
      { $match: { observedAt: { $gte: oneDayAgo } } },
      {
        $group: {
          _id: {
            hour: { $hour: '$observedAt' },
            sourceType: '$sourceType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.hour': 1 } },
    ]);

    return res.json({ period: 'last_24h', data: volumeByHour });
  } catch (error) {
    return next(error);
  }
});

// GET /api/v1/analytics/crew-performance - Individual field crew metrics
router.get('/crew-performance', protect, authorize('admin'), async (req, res, next) => {
  try {
    const crewIncidents = await Incident.aggregate([
      { $match: { assignedCrewId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$assignedCrewId',
          totalAssigned: { $sum: 1 },
          totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
          avgRiskScore: { $avg: '$riskScore' },
          maxRiskScore: { $max: '$riskScore' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'crew',
        },
      },
      { $unwind: { path: '$crew', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: '$crew.name',
          phone: '$crew.phone',
          totalAssigned: 1,
          totalResolved: 1,
          resolutionRate: {
            $cond: [
              { $gt: ['$totalAssigned', 0] },
              { $round: [{ $multiply: [{ $divide: ['$totalResolved', '$totalAssigned'] }, 100] }, 0] },
              0,
            ],
          },
          avgRiskScore: { $round: ['$avgRiskScore', 2] },
          maxRiskScore: { $round: ['$maxRiskScore', 2] },
        },
      },
      { $sort: { totalResolved: -1 } },
    ]);

    return res.json({ crewMetrics: crewIncidents });
  } catch (error) {
    return next(error);
  }
});

export default router;
