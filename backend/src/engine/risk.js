import * as h3 from 'h3-js';
import { SpatialCell } from '../models/SpatialCell.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { ConfigWeights } from '../models/ConfigWeights.js';
import { broadcastCells } from './stream.js';

export const H3_RESOLUTION = 8;
export const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
export const HALF_LIFE_MS = 5 * 60 * 1000; // 5 minute temporal decay half-life

const clamp = (value, min = 0, max = 10) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
};

/**
 * Normalizes latitude and longitude and returns H3 index at resolution 8.
 */
export function normalizeCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('latitude must be a finite number between -90 and 90.');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('longitude must be a finite number between -180 and 180.');
  }

  const h3Fn = h3.latLngToCell || h3.geoToH3;
  if (typeof h3Fn !== 'function') {
    throw new Error('H3 spatial indexing function is unavailable.');
  }

  const h3Index = h3Fn(lat, lon, H3_RESOLUTION);
  return { latitude: lat, longitude: lon, h3Index };
}

/**
 * Fetches active weights from database or returns calibrated defaults.
 */
export async function getActiveWeights() {
  try {
    const configured = await ConfigWeights.findOne({ key: 'active' }).lean();
    if (configured && Number.isFinite(configured.Wm) && Number.isFinite(configured.Wc) && Number.isFinite(configured.Wv)) {
      return { Wm: configured.Wm, Wc: configured.Wc, Wv: configured.Wv };
    }
  } catch (error) {
    console.error('[risk-engine] Error reading weights:', error.message);
  }
  return { Wm: 0.4, Wc: 0.4, Wv: 0.2 };
}

/**
 * Fetches configured risk threshold for critical incident trigger.
 */
export async function getRiskThreshold() {
  try {
    const configured = await ConfigWeights.findOne({ key: 'active' }).lean();
    if (configured && Number.isFinite(configured.threshold)) {
      return configured.threshold;
    }
  } catch (error) {
    console.error('[risk-engine] Error reading threshold:', error.message);
  }
  return 7.0;
}

/**
 * Calculates exponential temporal decay weight for an event.
 * Events closer to now have weight closer to 1.0; older events decay towards 0.
 */
export function computeTemporalWeight(observedAt, now = Date.now(), halfLifeMs = HALF_LIFE_MS) {
  const eventTime = new Date(observedAt).getTime();
  const ageMs = Math.max(0, now - eventTime);
  const lambda = Math.LN2 / halfLifeMs;
  return Math.exp(-lambda * ageMs);
}

/**
 * Computes Mobility sub-score (Sm in [0, 10]) from transit events and citizen mobility reports.
 */
function computeMobilityScore(transitEvents, citizenEvents, now) {
  if (!transitEvents.length && !citizenEvents.length) {
    return { score: 0, hasData: false, sampleCount: 0 };
  }

  let totalWeight = 0;
  let weightedDelay = 0;
  let maxDelay = 0;
  let weightedSpeedReduction = 0;
  let maxSpeedReduction = 0;

  for (const event of transitEvents) {
    const w = computeTemporalWeight(event.observedAt, now);
    const delay = Math.max(0, Number(event.delayMins) || 0);
    const speedRed = Math.max(0, Math.min(100, Number(event.speedReductionPct) || 0));

    weightedDelay += delay * w;
    weightedSpeedReduction += speedRed * w;
    totalWeight += w;

    if (delay > maxDelay) maxDelay = delay;
    if (speedRed > maxSpeedReduction) maxSpeedReduction = speedRed;
  }

  const effectiveDelay = totalWeight > 0 ? weightedDelay / totalWeight : maxDelay;
  const effectiveSpeedRed = totalWeight > 0 ? weightedSpeedReduction / totalWeight : maxSpeedReduction;

  // Delay score: 15 mins delay = 10.0 (using blended average and peak)
  const delayScore = clamp(((0.7 * effectiveDelay + 0.3 * maxDelay) / 15) * 10);

  // Speed reduction score: 100% reduction = 10.0
  const speedScore = clamp(((0.7 * effectiveSpeedRed + 0.3 * maxSpeedReduction) / 100) * 10);

  // Citizen transit/road reports factor
  let citizenMobilityScore = 0;
  const mobilityReports = citizenEvents.filter((e) => {
    const text = (e.reportText || '').toLowerCase();
    return text.includes('traffic') || text.includes('jam') || text.includes('road') || text.includes('blocked') || text.includes('waterlog');
  });
  if (mobilityReports.length > 0) {
    citizenMobilityScore = clamp(mobilityReports.length * 2.5);
  }

  // Combined mobility score
  let mobilityScore;
  if (transitEvents.length > 0) {
    mobilityScore = clamp(0.6 * delayScore + 0.3 * speedScore + 0.1 * citizenMobilityScore);
  } else {
    mobilityScore = clamp(citizenMobilityScore);
  }

  return {
    score: Number(mobilityScore.toFixed(2)),
    hasData: true,
    sampleCount: transitEvents.length + mobilityReports.length,
    maxDelay,
    maxSpeedReduction,
  };
}

/**
 * Computes Climate sub-score (Sc in [0, 10]) from meteorological events.
 * Models non-linear rain runoff curve, visibility hazard, and wind gusts.
 */
function computeClimateScore(weatherEvents, now) {
  if (!weatherEvents.length) {
    return { score: 0, hasData: false, sampleCount: 0 };
  }

  let totalWeight = 0;
  let weightedRain = 0;
  let maxRain = 0;
  let minVisibility = Infinity;
  let maxWindGust = 0;

  for (const event of weatherEvents) {
    const w = computeTemporalWeight(event.observedAt, now);
    const rain = Math.max(0, Number(event.rainMmHr) || 0);
    const vis = Number.isFinite(event.visibilityM) ? Number(event.visibilityM) : 10000;
    const gust = Math.max(0, Number(event.windGustMps) || 0);

    weightedRain += rain * w;
    totalWeight += w;

    if (rain > maxRain) maxRain = rain;
    if (vis < minVisibility) minVisibility = vis;
    if (gust > maxWindGust) maxWindGust = gust;
  }

  const effectiveRain = totalWeight > 0 ? weightedRain / totalWeight : maxRain;
  const peakBlendedRain = 0.65 * effectiveRain + 0.35 * maxRain;

  // Non-linear precipitation scaling curve:
  // 50 mm/hr = 10.0, with power curve (0.85) for early urban drainage saturation
  const rainScore = clamp(10 * Math.pow(Math.min(1, peakBlendedRain / 50), 0.85));

  // Visibility hazard: <500m is high hazard (up to 10), >5000m is 0
  let visScore = 0;
  if (minVisibility < 5000) {
    visScore = clamp(((5000 - Math.max(0, minVisibility)) / 5000) * 10);
  }

  // Wind gust hazard: >25 m/s (90 km/h) = 10, <8 m/s = 0
  let windScore = 0;
  if (maxWindGust > 8) {
    windScore = clamp(((maxWindGust - 8) / 17) * 10);
  }

  // Multi-hazard composite climate score
  const compositeClimate = clamp(0.70 * rainScore + 0.15 * visScore + 0.15 * windScore);

  return {
    score: Number(compositeClimate.toFixed(2)),
    hasData: true,
    sampleCount: weatherEvents.length,
    maxRain,
    minVisibility: minVisibility === Infinity ? null : minVisibility,
    maxWindGust,
  };
}

/**
 * Computes Vulnerability sub-score (Sv in [0, 10]) from baseline GIS data and citizen 311 reports.
 */
function computeVulnerabilityScore(gisEvents, citizenEvents, previousVulnerability = 0) {
  let baselineScore = previousVulnerability;
  let hasGis = false;

  if (gisEvents.length > 0) {
    const values = gisEvents
      .map((e) => Number(e.vulnerabilityScore))
      .filter((v) => Number.isFinite(v));
    if (values.length > 0) {
      baselineScore = Math.max(...values);
      hasGis = true;
    }
  }

  // Dynamic citizen distress multiplier (slum hazards, drain blockage, fallen tree, live wires)
  let citizenDistressScore = 0;
  if (citizenEvents.length > 0) {
    citizenDistressScore = clamp(citizenEvents.length * 2.0);
  }

  const finalVulnerability = clamp(
    baselineScore > 0 ? 0.75 * baselineScore + 0.25 * citizenDistressScore : citizenDistressScore
  );

  return {
    score: Number(finalVulnerability.toFixed(2)),
    hasData: hasGis || citizenEvents.length > 0 || baselineScore > 0,
    sampleCount: gisEvents.length + citizenEvents.length,
  };
}

/**
 * Calculates neighboring cascade risk using H3 ring distance k=1.
 */
async function computeCascadeRisk(h3Index, directRisk) {
  try {
    const diskFn = h3.gridDisk || h3.kRing;
    if (typeof diskFn !== 'function') return 0;

    const neighbors = diskFn(h3Index, 1).filter((idx) => idx !== h3Index);
    if (!neighbors.length) return 0;

    const neighborCells = await SpatialCell.find(
      { h3Index: { $in: neighbors } },
      { compositeRisk: 1 }
    ).lean();

    if (!neighborCells.length) return 0;

    const risks = neighborCells.map((c) => Number(c.compositeRisk) || 0);
    const maxNeighborRisk = Math.max(...risks);
    const avgNeighborRisk = risks.reduce((sum, r) => sum + r, 0) / risks.length;

    // Spillover threshold: if neighboring cells have risk > 6.0, propagate cascade effect
    if (maxNeighborRisk >= 6.0) {
      const cascadeComponent = 0.6 * maxNeighborRisk + 0.4 * avgNeighborRisk;
      return clamp(cascadeComponent);
    }
  } catch (error) {
    console.error('[risk-engine] Cascade computation error:', error.message);
  }
  return 0;
}

/**
 * Determines trend and velocity based on previous score and time elapsed.
 */
function computeVelocityAndTrend(currentRisk, previousCell, calculatedAt = new Date()) {
  if (!previousCell || !Number.isFinite(previousCell.compositeRisk) || !previousCell.lastUpdated) {
    return { velocity: 0, trend: 'STABLE' };
  }

  const timeDiffHours = Math.max(0.05, (calculatedAt.getTime() - new Date(previousCell.lastUpdated).getTime()) / (1000 * 60 * 60));
  const riskDiff = currentRisk - previousCell.compositeRisk;
  const velocity = Number((riskDiff / timeDiffHours).toFixed(2));

  let trend = 'STABLE';
  if (velocity > 1.5) {
    trend = 'SURGING';
  } else if (velocity > 0.3) {
    trend = 'RISING';
  } else if (velocity < -0.3) {
    trend = 'DE-ESCALATING';
  }

  return { velocity, trend };
}

/**
 * Computes comprehensive data confidence and degradation metrics.
 */
function computeConfidenceAndDegradation(mobilityData, climateData, vulnerabilityData) {
  const degradationReasons = [];
  let confidenceScore = 1.0;

  if (!mobilityData.hasData) {
    degradationReasons.push('mobility_data_missing');
    confidenceScore -= 0.35;
  } else if (mobilityData.sampleCount < 2) {
    degradationReasons.push('mobility_sparse_samples');
    confidenceScore -= 0.10;
  }

  if (!climateData.hasData) {
    degradationReasons.push('climate_data_missing');
    confidenceScore -= 0.35;
  } else if (climateData.sampleCount < 2) {
    degradationReasons.push('climate_sparse_samples');
    confidenceScore -= 0.10;
  }

  if (!vulnerabilityData.hasData) {
    degradationReasons.push('vulnerability_baseline_missing');
    confidenceScore -= 0.20;
  }

  confidenceScore = Math.max(0.1, Math.min(1.0, Number(confidenceScore.toFixed(2))));
  const isDegraded = degradationReasons.length > 0;

  return { confidenceScore, isDegraded, degradationReasons };
}

/**
 * Determines risk category band.
 */
function classifyRiskLevel(compositeRisk, threshold = 7.0) {
  if (compositeRisk >= threshold) return 'CRITICAL';
  if (compositeRisk >= 5.0) return 'HIGH';
  if (compositeRisk >= 3.0) return 'MODERATE';
  return 'LOW';
}

/**
 * Checks for sensor anomalies or rapid impossible jumps.
 */
function detectAnomalies(scores, currentRisk, previousRisk) {
  if (previousRisk != null && Math.abs(currentRisk - previousRisk) >= 4.5) {
    return { detected: true, reason: 'RAPID_RISK_SURGE_ANOMALY' };
  }
  if (scores.climate > 9.5 && scores.mobility < 0.5) {
    return { detected: true, reason: 'EXTREME_WEATHER_WITHOUT_TRANSIT_IMPACT_CHECK' };
  }
  return { detected: false, reason: null };
}

/**
 * Evaluates all events for a spatial cell and produces rich scores.
 */
export function scoreCellEvents(events, previousCell, weights = { Wm: 0.4, Wc: 0.4, Wv: 0.2 }, threshold = 7.0) {
  const now = Date.now();
  const transit = events.filter((e) => e.sourceType === 'GTFS_TRANSIT');
  const weather = events.filter((e) => e.sourceType === 'WEATHER_API');
  const citizen = events.filter((e) => e.sourceType === 'CITIZEN_311');
  const gis = events.filter((e) => e.sourceType === 'GIS_STATIC' || Number.isFinite(e.vulnerabilityScore));

  const previousVulnerability = previousCell?.scores?.vulnerability || 0;

  const mobility = computeMobilityScore(transit, citizen, now);
  const climate = computeClimateScore(weather, now);
  const vulnerability = computeVulnerabilityScore(gis, citizen, previousVulnerability);

  const directRisk = Number(
    (weights.Wm * mobility.score + weights.Wc * climate.score + weights.Wv * vulnerability.score).toFixed(2)
  );

  const { confidenceScore, isDegraded, degradationReasons } = computeConfidenceAndDegradation(
    mobility,
    climate,
    vulnerability
  );

  const previousCompositeRisk = previousCell?.compositeRisk;
  const { velocity, trend } = computeVelocityAndTrend(directRisk, previousCell, new Date(now));
  const riskLevel = classifyRiskLevel(directRisk, threshold);
  const anomaly = detectAnomalies({ mobility: mobility.score, climate: climate.score, vulnerability: vulnerability.score }, directRisk, previousCompositeRisk);

  const sources = [...new Set(events.map((e) => e.sourceType))];
  const lastObserved = events.length
    ? new Date(Math.max(...events.map((e) => new Date(e.observedAt).getTime())))
    : previousCell?.lastUpdated || new Date();

  return {
    scores: {
      mobility: mobility.score,
      climate: climate.score,
      vulnerability: vulnerability.score,
    },
    weights,
    compositeRisk: directRisk,
    riskLevel,
    trend,
    riskVelocity: velocity,
    confidence: confidenceScore,
    isDegraded,
    degradationReasons,
    anomalyDetected: anomaly.detected,
    anomalyReason: anomaly.reason,
    telemetryStats: {
      eventCount: events.length,
      sources,
      lastObservedAt: lastObserved,
      transitEventsCount: transit.length,
      weatherEventsCount: weather.length,
      citizenEventsCount: citizen.length,
      gisEventsCount: gis.length,
    },
  };
}

/**
 * Recalculates and persists an H3 cell based on telemetry within the sliding window.
 */
export async function recalculateCell(h3Index) {
  const windowStart = new Date(Date.now() - WINDOW_MS);
  const [previousCell, events, activeWeights, threshold] = await Promise.all([
    SpatialCell.findOne({ h3Index }).lean(),
    TelemetryEvent.find({ h3Index, observedAt: { $gte: windowStart } }).lean(),
    getActiveWeights(),
    getRiskThreshold(),
  ]);

  const cellToLatLngFn = h3.cellToLatLng || h3.h3ToGeo;
  if (typeof cellToLatLngFn !== 'function') {
    throw new Error('H3 coordinate conversion function is unavailable.');
  }

  const [latitude, longitude] = cellToLatLngFn(h3Index);
  const scored = scoreCellEvents(events, previousCell, activeWeights, threshold);

  // Check neighbor cascade risk
  const cascadeRisk = await computeCascadeRisk(h3Index, scored.compositeRisk);
  if (cascadeRisk > 0) {
    scored.cascadeRisk = cascadeRisk;
    // If cascade risk is severe, apply damping addition to composite risk
    if (cascadeRisk >= 7.0 && scored.compositeRisk < cascadeRisk) {
      scored.compositeRisk = Number(
        Math.min(10, 0.85 * scored.compositeRisk + 0.15 * cascadeRisk).toFixed(2)
      );
      scored.riskLevel = classifyRiskLevel(scored.compositeRisk, threshold);
    }
  }

  // Manage rolling history (keep latest 10 snapshots for micro-trend rendering)
  const previousHistory = Array.isArray(previousCell?.history) ? previousCell.history : [];
  const updatedHistory = [
    ...previousHistory.slice(-9),
    {
      compositeRisk: scored.compositeRisk,
      scores: scored.scores,
      calculatedAt: new Date(),
    },
  ];

  const updatedCell = await SpatialCell.findOneAndUpdate(
    { h3Index },
    {
      $set: {
        h3Index,
        latitude,
        longitude,
        ...scored,
        history: updatedHistory,
        lastUpdated: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();

  broadcastCells([updatedCell]);
  return updatedCell;
}

/**
 * Processes all telemetry from the database into spatial cells.
 * This clears existing cells and recreates them based on current telemetry.
 */
export async function processTelemetryToCells() {
  try {
    const uniqueH3Indices = await TelemetryEvent.distinct('h3Index');

    // Clear existing spatial cells
    await SpatialCell.deleteMany({});

    const results = [];
    for (const h3Index of uniqueH3Indices) {
      if (!h3Index) continue;
      try {
        const updated = await recalculateCell(h3Index);
        results.push(updated);
      } catch (err) {
        console.error(`[risk-engine] Failed to process cell ${h3Index}:`, err.message);
      }
    }
    return results;
  } catch (error) {
    console.error('[risk-engine] Error in processTelemetryToCells:', error.message);
    throw error;
  }
}

/**
 * Recalculates all active spatial cells (e.g. after weight update or batch ingest).
 */
export async function recalculateAllActiveCells() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cells = await SpatialCell.find({ lastUpdated: { $gte: cutoff } }, { h3Index: 1 }).lean();
  const results = [];
  for (const cell of cells) {
    try {
      const updated = await recalculateCell(cell.h3Index);
      results.push(updated);
    } catch (err) {
      console.error(`[risk-engine] Failed to recalculate cell ${cell.h3Index}:`, err.message);
    }
  }
  return results;
}

/**
 * Lists active cells within the last 24 hours, ordered by composite risk descending.
 */
export async function listActiveCells(filters = {}) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const query = { lastUpdated: { $gte: cutoff } };

  if (filters.riskLevel) {
    query.riskLevel = filters.riskLevel.toUpperCase();
  }
  if (filters.minRisk != null) {
    query.compositeRisk = { $gte: Number(filters.minRisk) };
  }
  if (filters.isDegraded != null) {
    query.isDegraded = Boolean(filters.isDegraded);
  }

  const limit = Math.min(Number(filters.limit) || 250, 1000);
  return SpatialCell.find(query).sort({ compositeRisk: -1, lastUpdated: -1 }).limit(limit).lean();
}

/**
 * Returns aggregated statistical summary of risk distribution across the city.
 */
export async function getRiskDistributionSummary() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const threshold = await getRiskThreshold();

  const [aggregation, totalCells] = await Promise.all([
    SpatialCell.aggregate([
      { $match: { lastUpdated: { $gte: cutoff } } },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
          avgRisk: { $avg: '$compositeRisk' },
          avgMobility: { $avg: '$scores.mobility' },
          avgClimate: { $avg: '$scores.climate' },
          avgVulnerability: { $avg: '$scores.vulnerability' },
          avgConfidence: { $avg: '$confidence' },
          degradedCount: { $sum: { $cond: ['$isDegraded', 1, 0] } },
        },
      },
    ]),
    SpatialCell.countDocuments({ lastUpdated: { $gte: cutoff } }),
  ]);

  return {
    totalActiveCells: totalCells,
    threshold,
    breakdown: aggregation,
    generatedAt: new Date().toISOString(),
  };
}
