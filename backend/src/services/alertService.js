import { Alert } from '../models/Alert.js';
import { AuditLog } from '../models/AuditLog.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { broadcastAlert } from '../engine/stream.js';

const ACTIVE_STATUSES = ['OPEN', 'ACKNOWLEDGED'];
const TERMINAL_STATUSES = ['RESOLVED', 'EXPIRED'];
const ALL_CLEAR_GRACE_MINUTES = Number(process.env.ALERT_ALL_CLEAR_GRACE_MINUTES || 15);
const ALERT_EXPIRY_MINUTES = Number(process.env.ALERT_EXPIRY_MINUTES || 30);
let monitorTimer = null;

const asDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export function fallbackAlertKey(alert, h3Index) {
  return [alert.type || 'ALERT', h3Index, alert.title || '', alert.detail || ''].join('|');
}

/**
 * Evidence rules, kept pure so they can be tested without a database.
 *
 * A provider report is not a field verification, and one resident is not a
 * corroborated event. The alert says which of those it is instead of treating
 * every row in the table as equally true.
 */
export function deriveVerification(alert, observations = []) {
  const reports = observations.filter((event) => event.sourceType === 'CITIZEN_311');
  const fieldReports = reports.filter((event) => /^CREW_/i.test(String(event.senderId || '')));
  const category = String(alert.category || '').toUpperCase();

  if (alert.type === 'REPORT') {
    const matching = reports.filter(
      (event) => String(event.category || '').toUpperCase() === category
    );
    const matchingField = matching.some((event) => /^CREW_/i.test(String(event.senderId || '')));
    const distinctReporters = new Set(
      matching.map((event) => event.senderId || String(event.eventId || event._id))
    ).size;

    if (matchingField) {
      return { verification: 'VERIFIED', evidenceCount: Math.max(1, distinctReporters) };
    }
    if (distinctReporters >= 2) {
      return { verification: 'CORROBORATED', evidenceCount: distinctReporters };
    }
    return { verification: 'UNVERIFIED', evidenceCount: 1 };
  }

  if (fieldReports.length) {
    return { verification: 'CORROBORATED', evidenceCount: Math.max(1, fieldReports.length) };
  }
  if (alert.type === 'INCIDENT') {
    return { verification: 'PROVIDER_REPORTED', evidenceCount: 1 };
  }
  if (alert.type === 'CONGESTION' || alert.type === 'SENSOR') {
    return { verification: 'OBSERVED', evidenceCount: 1 };
  }
  return { verification: 'UNVERIFIED', evidenceCount: 1 };
}

function alertFields(alert, cell, now, verification) {
  return {
    h3Index: cell.h3Index,
    cityCode: cell.cityCode || null,
    type: alert.type || 'REPORT',
    severity: Math.max(0, Math.min(10, Number(alert.severity) || 0)),
    title: String(alert.title || 'Alert').slice(0, 200),
    detail: String(alert.detail || '').slice(0, 500),
    category: alert.category || null,
    lastSeenAt: now,
    ...verification,
  };
}

/**
 * Reconciles the alerts in a fresh cell snapshot with the alert lifecycle.
 *
 * New evidence opens an alert, changed evidence updates it, and an alert that
 * has disappeared from a fresh snapshot is resolved only after a grace period.
 * That grace period is what prevents one delayed provider poll from sending a
 * false all-clear and another alert immediately afterwards.
 */
export async function reconcileCellAlerts(cell) {
  if (!cell?.h3Index) return { opened: 0, updated: 0, resolved: 0 };

  const now = new Date();
  const observations = await TelemetryEvent.find({
    h3Index: cell.h3Index,
    observedAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) },
  })
    .sort({ observedAt: -1 })
    .limit(50)
    .lean();

  const activeKeys = [];
  let opened = 0;
  let updated = 0;

  for (const alert of Array.isArray(cell.alerts) ? cell.alerts : []) {
    const alertKey = alert.key || fallbackAlertKey(alert, cell.h3Index);
    activeKeys.push(alertKey);

    const verification = deriveVerification(alert, observations);
    const existing = await Alert.findOne({ alertKey });

    if (!existing) {
      try {
        const created = await Alert.create({
          alertKey,
          ...alertFields(alert, cell, now, verification),
          status: 'OPEN',
          firstSeenAt: asDate(alert.observedAt || now),
          transitions: [{ status: 'OPEN', at: now, reason: 'DETECTED' }],
        });
        broadcastAlert(created.toObject ? created.toObject() : created, 'opened');
        opened += 1;
      } catch (error) {
        // Two concurrent recalculations can race on the unique key. The other
        // one created the alert; this one should update it, not fail the cell.
        if (error.code !== 11000) throw error;
      }
      continue;
    }

    const reopening = TERMINAL_STATUSES.includes(existing.status);
    const fields = alertFields(alert, cell, now, verification);
    const severityChanged = Math.abs((Number(existing.severity) || 0) - fields.severity) >= 0.5;
    const evidenceChanged = existing.verification !== fields.verification;
    const detailChanged = existing.detail !== fields.detail || existing.title !== fields.title;
    const shouldBroadcast = reopening || severityChanged || evidenceChanged;

    const update = {
      $set: {
        ...fields,
        ...(reopening
          ? {
              status: 'OPEN',
              resolution: null,
              resolvedAt: null,
              resolvedBy: null,
              acknowledgedAt: null,
              acknowledgedBy: null,
            }
          : {}),
      },
      $inc: { revision: 1 },
    };

    if (reopening || severityChanged || evidenceChanged || detailChanged) {
      update.$push = {
        transitions: {
          status: reopening ? 'OPEN' : existing.status,
          at: now,
          reason: reopening ? 'REOPENED_BY_NEW_EVIDENCE' : 'EVIDENCE_UPDATED',
        },
      };
    }

    const saved = await Alert.findOneAndUpdate({ _id: existing._id }, update, {
      returnDocument: 'after',
    }).lean();

    if (shouldBroadcast && saved) {
      broadcastAlert(saved, reopening ? 'reopened' : 'updated');
      updated += 1;
    }
  }

  // A fresh snapshot that no longer contains an alert is evidence that the
  // hazard may be over. Wait for the grace period, then declare an all-clear.
  const graceCutoff = new Date(now.getTime() - ALL_CLEAR_GRACE_MINUTES * 60 * 1000);
  const disappeared = await Alert.find({
    h3Index: cell.h3Index,
    status: { $in: ACTIVE_STATUSES },
    alertKey: { $nin: activeKeys },
    lastSeenAt: { $lte: graceCutoff },
  });

  for (const alert of disappeared) {
    const saved = await Alert.findOneAndUpdate(
      { _id: alert._id, status: { $in: ACTIVE_STATUSES } },
      {
        $set: {
          status: 'RESOLVED',
          resolution: 'ALL_CLEAR',
          resolvedAt: now,
          resolvedBy: null,
        },
        $push: {
          transitions: {
            status: 'RESOLVED',
            at: now,
            reason: 'NO_LONGER_OBSERVED_AFTER_GRACE_PERIOD',
          },
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' }
    ).lean();
    if (saved) broadcastAlert(saved, 'resolved');
  }

  return { opened, updated, resolved: disappeared.length };
}

/**
 * An alert whose cell has not been observed for too long is not cleared: it
 * expires without a confirmation, so the record says why it stopped.
 */
export async function expireStaleAlerts() {
  const cutoff = new Date(Date.now() - ALERT_EXPIRY_MINUTES * 60 * 1000);
  const stale = await Alert.find({
    status: { $in: ACTIVE_STATUSES },
    lastSeenAt: { $lte: cutoff },
  }).limit(500);

  let expired = 0;
  for (const alert of stale) {
    const saved = await Alert.findOneAndUpdate(
      { _id: alert._id, status: { $in: ACTIVE_STATUSES } },
      {
        $set: {
          status: 'EXPIRED',
          resolution: 'NO_FRESH_OBSERVATION',
          resolvedAt: new Date(),
        },
        $push: {
          transitions: {
            status: 'EXPIRED',
            at: new Date(),
            reason: 'NO_FRESH_OBSERVATION',
          },
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' }
    ).lean();
    if (saved) {
      broadcastAlert(saved, 'expired');
      expired += 1;
    }
  }
  return expired;
}

export async function acknowledgeAlert(alertId, user) {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    const error = new Error('Alert not found.');
    error.status = 404;
    throw error;
  }
  if (TERMINAL_STATUSES.includes(alert.status)) {
    const error = new Error('A resolved or expired alert cannot be acknowledged.');
    error.status = 409;
    throw error;
  }

  alert.status = 'ACKNOWLEDGED';
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = user?._id || null;
  alert.transitions.push({
    status: 'ACKNOWLEDGED',
    at: new Date(),
    by: user?._id || null,
    reason: 'OPERATOR_ACKNOWLEDGED',
  });
  alert.revision += 1;
  const saved = await alert.save();

  await AuditLog.create({
    actorId: user?._id,
    action: 'ALERT_ACKNOWLEDGED',
    entityType: 'alert',
    entityId: alert._id.toString(),
    metadata: { alertKey: alert.alertKey, h3Index: alert.h3Index },
  });

  broadcastAlert(saved.toObject(), 'acknowledged');
  return saved;
}

export async function resolveAlert(alertId, user, note) {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    const error = new Error('Alert not found.');
    error.status = 404;
    throw error;
  }
  if (TERMINAL_STATUSES.includes(alert.status)) {
    const error = new Error('Alert is already resolved or expired.');
    error.status = 409;
    throw error;
  }

  alert.status = 'RESOLVED';
  alert.resolution = 'OPERATOR_ALL_CLEAR';
  alert.resolvedAt = new Date();
  alert.resolvedBy = user?._id || null;
  alert.transitions.push({
    status: 'RESOLVED',
    at: new Date(),
    by: user?._id || null,
    reason: note ? String(note).slice(0, 300) : 'OPERATOR_ALL_CLEAR',
  });
  alert.revision += 1;
  const saved = await alert.save();

  await AuditLog.create({
    actorId: user?._id,
    action: 'ALERT_ALL_CLEAR',
    entityType: 'alert',
    entityId: alert._id.toString(),
    metadata: { alertKey: alert.alertKey, h3Index: alert.h3Index, note: note || null },
  });

  broadcastAlert(saved.toObject(), 'resolved');
  return saved;
}

export async function listAlerts({ status, h3Index, cityCodes, limit = 100 } = {}) {
  const query = {};
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    if (statuses.length) query.status = { $in: statuses };
  }
  if (h3Index) query.h3Index = h3Index;
  if (cityCodes?.length) query.cityCode = { $in: cityCodes };

  return Alert.find(query).sort({ severity: -1, lastSeenAt: -1 }).limit(Math.min(limit, 200)).lean();
}

export async function getAlertSummary(cityCodes) {
  const match = cityCodes?.length ? { cityCode: { $in: cityCodes } } : {};
  const [byStatus, byVerification, openCritical] = await Promise.all([
    Alert.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Alert.aggregate([
      { $match: { ...match, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: '$verification', count: { $sum: 1 } } },
    ]),
    Alert.countDocuments({ ...match, status: { $in: ACTIVE_STATUSES }, severity: { $gte: 7 } }),
  ]);

  return {
    byStatus: Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
    byVerification: Object.fromEntries(byVerification.map((row) => [row._id, row.count])),
    openCritical,
    active: byStatus
      .filter((row) => ACTIVE_STATUSES.includes(row._id))
      .reduce((sum, row) => sum + row.count, 0),
  };
}

export function startAlertMonitor() {
  if (monitorTimer) return;
  const intervalMs = Number(process.env.ALERT_MONITOR_INTERVAL_MS || 60000);

  const run = () => {
    expireStaleAlerts().catch((error) =>
      console.error('[alerts] Expiry monitor failed:', error.message)
    );
  };

  run();
  monitorTimer = setInterval(run, intervalMs);
  console.log(`[alerts] Lifecycle monitor active (check interval: ${intervalMs / 1000}s).`);
}

export function stopAlertMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

export const ALERT_LIFECYCLE = {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  ALL_CLEAR_GRACE_MINUTES,
  ALERT_EXPIRY_MINUTES,
};
