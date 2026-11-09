function buildPlaybookResources(cell) {
  const resources = new Set();
  const { mobility = 0, climate = 0, vulnerability = 0 } = cell.scores || {};
  const risk = Number(cell.compositeRisk) || 0;

  if (risk >= 8.5) {
    resources.add('SDRF Emergency Rescue Unit');
    resources.add('High-Capacity Dewatering Pump (100 HP)');
    resources.add('Traffic Diversion & Police Control Unit');
  }
  if (climate >= 7) {
    resources.add('Municipal Dewatering Pump Truck');
    resources.add('Nagar Nigam Stormwater Drainage Squad');
    if (climate >= 8.5) resources.add('Suction Jetting Tanker');
  }
  if (mobility >= 7) {
    resources.add('Traffic Management & Diverter Crew');
    resources.add('Heavy Road Clearing & Recovery Vehicle');
  }
  if (vulnerability >= 7) {
    resources.add('Civil Defense & Slum Relief Team');
    resources.add('Emergency Medical First Responder Unit');
  }
  if (!resources.size) resources.add('Municipal Quick Response Inspection Crew');
  return [...resources];
}

/** The band the engine itself assigned, with a band-based fallback. */
function riskLevelFor(cell, risk) {
  const level = String(cell.riskLevel || '').toUpperCase();
  if (['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].includes(level)) return level;
  if (risk >= 7) return 'CRITICAL';
  if (risk >= 5) return 'HIGH';
  if (risk >= 3) return 'MODERATE';
  return 'LOW';
}

export function synthesizeAction(cell, transitAlerts = []) {
  const resources = buildPlaybookResources(cell);
  const risk = Number(cell.compositeRisk) || 0;
  const level = riskLevelFor(cell, risk);
  const scores = cell.scores || {};
  const alerts = transitAlerts.length ? ` Active corridor transit alerts: ${transitAlerts.join('; ')}.` : '';
  const basis = `Composite risk score is ${risk.toFixed(1)}/10.0 (Mobility: ${scores.mobility || 0}, Climate: ${scores.climate || 0}, Vulnerability: ${scores.vulnerability || 0}).`;

  const guidance = {
    CRITICAL: `Critical risk in H3 cell ${cell.h3Index}. ${basis} Immediate deployment of ${resources.join(', ')} is advised.`,
    HIGH: `High risk in H3 cell ${cell.h3Index}. ${basis} Deployment of ${resources.join(', ')} is advised.`,
    MODERATE: `Moderate risk in H3 cell ${cell.h3Index}. ${basis} A preventive inspection by ${resources.join(', ')} is advised.`,
    LOW: `Low risk in H3 cell ${cell.h3Index}. ${basis} No deployment is required; continue monitoring.`,
  }[level];

  return {
    providerUsed: 'deterministic',
    actionNarrative: `${guidance}${alerts}`,
    priority: level,
    recommendedResources: resources,
    dispatchText: `[METABOLIC CITY ${level}] H3: ${cell.h3Index} | Risk: ${risk.toFixed(1)}/10 | ${
      level === 'LOW' ? 'Monitor' : `Deploy: ${resources.slice(0, 3).join(', ')}`
    }. Operator confirmation required.`,
  };
}