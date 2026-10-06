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

export function synthesizeAction(cell, transitAlerts = []) {
  const resources = buildPlaybookResources(cell);
  const risk = Number(cell.compositeRisk) || 0;
  const priority = risk >= 8 ? 'CRITICAL' : 'HIGH';
  const scores = cell.scores || {};
  const alerts = transitAlerts.length ? ` Active corridor transit alerts: ${transitAlerts.join('; ')}.` : '';
  return {
    providerUsed: 'deterministic',
    actionNarrative: `Critical municipal hazard detected in H3 cell ${cell.h3Index}. Composite risk score is ${risk.toFixed(1)}/10.0 (Mobility: ${scores.mobility || 0}, Climate: ${scores.climate || 0}, Vulnerability: ${scores.vulnerability || 0}). Immediate deployment of ${resources.join(', ')} is advised to mitigate urban gridlock and water accumulation.${alerts}`,
    priority,
    recommendedResources: resources,
    dispatchText: `[METABOLIC CITY ${priority}] H3: ${cell.h3Index} | Risk: ${risk.toFixed(1)}/10 | Deploy: ${resources.slice(0, 3).join(', ')}. Operator confirmation logged.`,
  };
}