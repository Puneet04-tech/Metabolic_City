import { Incident } from '../models/Incident.js';
import { User } from '../models/User.js';
import { sendSms } from './sms.js';

let timer;

export async function evaluateEscalations() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const incidents = await Incident.find({
    riskScore: { $gte: 7 },
    status: { $in: ['DETECTED'] },
    detectedAt: { $lte: cutoff },
  }).limit(50).lean();
  const managers = await User.find({ role: 'administrator', phone: { $exists: true, $type: 'string' } });
  for (const incident of incidents) {
    const text = `ESCALATION: Critical Metabolic City incident at H3 ${incident.h3Index}, risk ${incident.riskScore}, unacknowledged for 15+ minutes.`;
    for (const manager of managers) {
      try {
        await sendSms(manager.phone, text);
      } catch (error) {
        console.error('[escalation] SMS failed:', error.message);
      }
    }
    await Incident.updateOne({ _id: incident._id }, { $set: { status: 'DISPATCHED', dispatchedAt: new Date() } });
  }
}

export function startEscalationMonitor() {
  if (timer) return;
  evaluateEscalations().catch((error) => console.error('[escalation] initial check failed:', error.message));
  timer = setInterval(() => evaluateEscalations().catch((error) => console.error('[escalation] monitor failed:', error.message)), 60000);
}