function fallbackAction(cell, transitAlerts = []) {
  const resources = [];
  if (cell.scores.climate >= 7) resources.push('Pump Truck');
  if (cell.scores.mobility >= 7) resources.push('Traffic Diverter');
  if (!resources.length) resources.push('Municipal Inspection Crew');
  const alertText = transitAlerts.length ? ` Active transit alerts: ${transitAlerts.join('; ')}.` : '';
  return {
    actionNarrative: `Critical urban risk detected in H3 cell ${cell.h3Index}. Composite risk is ${cell.compositeRisk}, with mobility ${cell.scores.mobility}, climate ${cell.scores.climate}, and vulnerability ${cell.scores.vulnerability}.${alertText}`,
    priority: cell.compositeRisk >= 8 ? 'CRITICAL' : 'HIGH',
    recommendedResources: resources,
    dispatchText: `METABOLIC CITY ALERT: H3 ${cell.h3Index} risk ${cell.compositeRisk}. Deploy ${resources.join(' and ')}. Operator approval required.`,
  };
}

function parseGeminiResponse(data) {
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  const jsonText = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(jsonText);
  if (!parsed.action_narrative || !parsed.priority || !Array.isArray(parsed.recommended_resources) || !parsed.dispatch_text) {
    throw new Error('Gemini response did not match the Phase 3 action schema.');
  }
  return {
    actionNarrative: parsed.action_narrative,
    priority: parsed.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    recommendedResources: parsed.recommended_resources,
    dispatchText: parsed.dispatch_text,
  };
}

export async function synthesizeAction(cell, transitAlerts = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) return fallbackAction(cell, transitAlerts);

  const prompt = `Return only JSON with keys action_narrative, priority, recommended_resources, dispatch_text. Analyze this municipal emergency cell: ${JSON.stringify({
    h3Index: cell.h3Index,
    compositeRisk: cell.compositeRisk,
    scores: cell.scores,
    transitAlerts,
  })}. Do not invent measurements. Recommend practical municipal response resources.`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
    return parseGeminiResponse(await response.json());
  } catch (error) {
    console.error('[action-synthesizer] Gemini unavailable, using deterministic fallback:', error.message);
    return fallbackAction(cell, transitAlerts);
  }
}