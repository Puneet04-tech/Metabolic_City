function buildPlaybookResources(cell) {
  const resources = new Set();
  const { mobility = 0, climate = 0, vulnerability = 0 } = cell.scores || {};
  const risk = cell.compositeRisk || 0;

  if (risk >= 8.5) {
    resources.add('SDRF Emergency Rescue Unit');
    resources.add('High-Capacity Dewatering Pump (100 HP)');
    resources.add('Traffic Diversion & Police Control Unit');
  }

  if (climate >= 7.0) {
    resources.add('Municipal Dewatering Pump Truck');
    resources.add('Nagar Nigam Stormwater Drainage Squad');
    if (climate >= 8.5) {
      resources.add('Suction Jetting Tanker');
    }
  }

  if (mobility >= 7.0) {
    resources.add('Traffic Management & Diverter Crew');
    resources.add('Heavy Road Clearing & Recovery Vehicle');
  }

  if (vulnerability >= 7.0) {
    resources.add('Civil Defense & Slum Relief Team');
    resources.add('Emergency Medical First Responder Unit');
  }

  if (resources.size === 0) {
    resources.add('Municipal Quick Response Inspection Crew');
  }

  return Array.from(resources);
}

function fallbackAction(cell, transitAlerts = []) {
  const resources = buildPlaybookResources(cell);
  const alertText = transitAlerts.length ? ` Active corridor transit alerts: ${transitAlerts.join('; ')}.` : '';
  const risk = cell.compositeRisk || 0;
  const priority = risk >= 8.0 ? 'CRITICAL' : 'HIGH';

  const actionNarrative = `Critical municipal hazard detected in H3 cell ${cell.h3Index}. Composite risk score is ${risk.toFixed(
    1
  )}/10.0 (Mobility: ${cell.scores?.mobility || 0}, Climate: ${cell.scores?.climate || 0}, Vulnerability: ${
    cell.scores?.vulnerability || 0
  }). Immediate deployment of ${resources.join(', ')} is advised to mitigate urban gridlock and water accumulation.${alertText}`;

  const dispatchText = `[METABOLIC CITY ${priority}] H3: ${cell.h3Index} | Risk: ${risk.toFixed(1)}/10 | Deploy: ${resources
    .slice(0, 3)
    .join(', ')}. Operator confirmation logged.`;

  return {
    actionNarrative,
    priority,
    recommendedResources: resources,
    dispatchText,
  };
}

function parseGeminiResponse(data) {
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in Gemini response text.');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const actionNarrative = parsed.action_narrative || parsed.actionNarrative;
  const priorityRaw = (parsed.priority || '').toUpperCase();
  const priority = priorityRaw === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
  const recommendedResources = Array.isArray(parsed.recommended_resources)
    ? parsed.recommended_resources
    : Array.isArray(parsed.recommendedResources)
    ? parsed.recommendedResources
    : ['Municipal Quick Response Crew'];
  const dispatchText = parsed.dispatch_text || parsed.dispatchText;

  if (!actionNarrative || !dispatchText) {
    throw new Error('Gemini response missing required narrative or dispatch fields.');
  }

  return {
    actionNarrative,
    priority,
    recommendedResources,
    dispatchText,
  };
}

export async function synthesizeAction(cell, transitAlerts = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return fallbackAction(cell, transitAlerts);
  }

  const prompt = `You are the Urban Disaster Response Intelligence Engine for Metabolic City AI (Bhopal/Sehore/Ashta municipal command).
Analyze this emergency situation for H3 spatial cell ${cell.h3Index}:
- Composite Risk Score: ${cell.compositeRisk}/10.0
- Mobility Sub-score: ${cell.scores?.mobility || 0}/10.0
- Climate Sub-score: ${cell.scores?.climate || 0}/10.0
- Vulnerability Sub-score: ${cell.scores?.vulnerability || 0}/10.0
- Active Corridor Alerts: ${transitAlerts.length ? transitAlerts.join(', ') : 'None'}

Return ONLY a valid JSON object with the following exact keys:
{
  "action_narrative": "A concise 2-3 sentence operational incident brief explaining the hazard dynamics and priority tactical objectives.",
  "priority": "CRITICAL" | "HIGH",
  "recommended_resources": ["list", "of", "practical", "municipal", "teams", "and", "equipment"],
  "dispatch_text": "An SMS/radio ready dispatch line under 160 characters for the on-duty field unit."
}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Gemini API HTTP ${response.status}`);
    }

    const data = await response.json();
    return parseGeminiResponse(data);
  } catch (error) {
    console.warn('[action-synthesizer] Gemini API call failed or timed out, using deterministic playbook:', error.message);
    return fallbackAction(cell, transitAlerts);
  }
}
