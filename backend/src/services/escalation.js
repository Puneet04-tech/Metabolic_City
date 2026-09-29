import { Incident } from '../models/Incident.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { sendSms } from './sms.js';
import { getRiskThreshold } from '../engine/risk.js';
import { broadcastIncident } from '../engine/stream.js';

let timer = null;

export async function evaluateEscalations() {
  try {
    const escalationTimeoutMinutes = Number(process.env.ESCALATION_TIMEOUT_MINUTES || 15);
    const cutoff = new Date(Date.now() - escalationTimeoutMinutes * 60 * 1000);
    const threshold = await getRiskThreshold();

    const unhandledIncidents = await Incident.find({
      riskScore: { $gte: threshold },
      status: 'DETECTED',
      detectedAt: { $lte: cutoff },
    })
      .limit(50)
      .lean();

    if (!unhandledIncidents.length) return;

    const managers = await User.find({
      role: 'administrator',
      active: true,
      phone: { $exists: true, $type: 'string' },
    });

    for (const incident of unhandledIncidents) {
      const text = `[METABOLIC CITY ESCALATION] Critical incident at H3 cell ${incident.h3Index} (Risk: ${incident.riskScore.toFixed(
        1
      )}/10) unacknowledged for ${escalationTimeoutMinutes}+ min. Immediate administrative intervention required.`;

      for (const manager of managers) {
        if (manager.phone) {
          try {
            await sendSms(manager.phone, text);
          } catch (smsErr) {
            console.error('[escalation] SMS notification error:', smsErr.message);
          }
        }
      }

      const updatedIncident = await Incident.findByIdAndUpdate(
        incident._id,
        {
          $set: {
            status: 'ESCALATED',
            escalatedAt: new Date(),
          },
          $inc: { escalationCount: 1 },
        },
        { returnDocument: 'after' }
      ).lean();

      if (updatedIncident) {
        broadcastIncident(updatedIncident);
        await AuditLog.create({
          action: 'INCIDENT_AUTO_ESCALATED',
          entityType: 'incident',
          entityId: incident._id.toString(),
          metadata: {
            h3Index: incident.h3Index,
            riskScore: incident.riskScore,
            unacknowledgedMinutes: escalationTimeoutMinutes,
          },
        });
        console.log(`[escalation] Auto-escalated incident ${incident._id} (H3: ${incident.h3Index}, Risk: ${incident.riskScore})`);
      }
    }
  } catch (error) {
    console.error('[escalation] Error evaluating escalations:', error.message);
  }
}

export function startEscalationMonitor() {
  if (timer) return;
  const intervalMs = Number(process.env.ESCALATION_CHECK_INTERVAL_MS || 60000);

  // Run initial check
  evaluateEscalations().catch((error) => console.error('[escalation] Initial check failed:', error.message));

  timer = setInterval(() => {
    evaluateEscalations().catch((error) => console.error('[escalation] Periodic monitor failed:', error.message));
  }, intervalMs);

  console.log(`[escalation] Escalation monitor active (check interval: ${intervalMs / 1000}s).`);
}

export function stopEscalationMonitor() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
