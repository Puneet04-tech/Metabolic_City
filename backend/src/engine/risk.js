import * as h3 from 'h3-js';
import mongoose from 'mongoose';
import { SpatialCell } from '../models/SpatialCell.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { ConfigWeights } from '../models/ConfigWeights.js';
import { broadcastCells } from './stream.js';

export const H3_RESOLUTION = 8;
export const WINDOW_MS = 60 * 60 * 1000; // 1 hour window (increased from 15 min for more real data)
export const HALF_LIFE_MS = 30 * 60 * 1000; // 30 minute temporal decay half-life (increased from 5 min)

/** Calibrated defaults, used when neither the admin config nor the env set weights. */
export const DEFAULT_WEIGHTS = { Wm: 0.4, Wc: 0.4, Wv: 0.2 };

/**
 * Weights configured through the environment. They are normalised so an
 * operator can write 4/3/3 or 0.4/0.3/0.3 with the same result, and an invalid
 * or all-zero set falls back to the calibrated defaults instead of dividing
 * by zero.
 */
function weightsFromEnv() {
  const raw = {
    Wm: Number(process.env.WEIGHT_MOBILITY ?? DEFAULT_WEIGHTS.Wm),
    Wc: Number(process.env.WEIGHT_CLIMATE ?? DEFAULT_WEIGHTS.Wc),
    Wv: Number(process.env.WEIGHT_VULNERABILITY ?? DEFAULT_WEIGHTS.Wv),
  };

  if (![raw.Wm, raw.Wc, raw.Wv].every((value) => Number.isFinite(value) && value >= 0)) {
    return DEFAULT_WEIGHTS;
  }

  const sum = raw.Wm + raw.Wc + raw.Wv;
  if (sum <= 0) return DEFAULT_WEIGHTS;

  return { Wm: raw.Wm / sum, Wc: raw.Wc / sum, Wv: raw.Wv / sum };
}

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
  return weightsFromEnv();
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
 * Returns formatted trend string for better UI display
 */
function computeVelocityAndTrend(currentRisk, previousCell, calculatedAt = new Date()) {
  if (!previousCell || !Number.isFinite(previousCell.compositeRisk) || !previousCell.lastUpdated) {
    return { velocity: 0, trend: 'STABLE', trendDisplay: 'Stable (no history)' };
  }

  const timeDiffHours = Math.max(0.05, (calculatedAt.getTime() - new Date(previousCell.lastUpdated).getTime()) / (1000 * 60 * 60));
  const riskDiff = currentRisk - previousCell.compositeRisk;
  const velocity = Number((riskDiff / timeDiffHours).toFixed(2));

  let trend = 'STABLE';
  let trendDisplay = 'Stable';
  
  if (velocity > 1.5) {
    trend = 'SURGING';
    trendDisplay = `Surging (+${velocity.toFixed(1)}/h)`;
  } else if (velocity > 0.3) {
    trend = 'RISING';
    trendDisplay = `Rising (+${velocity.toFixed(1)}/h)`;
  } else if (velocity < -0.3) {
    trend = 'DE-ESCALATING';
    trendDisplay = `Falling (${velocity.toFixed(1)}/h)`;
  } else {
    trendDisplay = `Stable (${velocity.toFixed(1)}/h)`;
  }

  return { velocity, trend, trendDisplay };
}

/**
 * Computes comprehensive data confidence and degradation metrics.
 * Returns specific degradation status instead of generic "DEGRADED"
 */
function computeConfidenceAndDegradation(mobilityData, climateData, vulnerabilityData) {
  const degradationReasons = [];
  let confidenceScore = 1.0;
  let degradationStatus = 'HEALTHY';

  if (!mobilityData.hasData) {
    degradationReasons.push('mobility_data_missing');
    confidenceScore -= 0.35;
    degradationStatus = 'NO_MOBILITY_DATA';
  } else if (mobilityData.sampleCount < 2) {
    degradationReasons.push('mobility_sparse_samples');
    confidenceScore -= 0.10;
    if (degradationStatus === 'HEALTHY') degradationStatus = 'SPARSE_MOBILITY';
  }

  if (!climateData.hasData) {
    degradationReasons.push('climate_data_missing');
    confidenceScore -= 0.35;
    if (degradationStatus === 'HEALTHY' || degradationStatus === 'NO_MOBILITY_DATA') {
      degradationStatus = 'NO_CLIMATE_DATA';
    } else {
      degradationStatus = 'NO_CLIMATE_DATA';
    }
  } else if (climateData.sampleCount < 2) {
    degradationReasons.push('climate_sparse_samples');
    confidenceScore -= 0.10;
    if (degradationStatus === 'HEALTHY') degradationStatus = 'SPARSE_CLIMATE';
  }

  if (!vulnerabilityData.hasData) {
    degradationReasons.push('vulnerability_baseline_missing');
    confidenceScore -= 0.20;
    if (degradationStatus === 'HEALTHY') degradationStatus = 'NO_VULNERABILITY_DATA';
  }

  confidenceScore = Math.max(0.1, Math.min(1.0, Number(confidenceScore.toFixed(2))));
  const isDegraded = degradationReasons.length > 0;

  return { confidenceScore, isDegraded, degradationReasons, degradationStatus };
}

/**
 * Determines risk category band.
 */
export function classifyRiskLevel(compositeRisk, threshold = 7.0) {
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

/** How disruptive each TomTom incident category is, as an alert severity. */
const INCIDENT_ALERT_SEVERITY = {
  1: 8, // accident
  2: 6, // fog
  3: 6, // dangerous conditions
  4: 5, // rain
  5: 6, // ice
  6: 7, // jam
  7: 8, // lane closed
  8: 9, // road closed
  9: 6, // road works
  10: 5, // high wind
  11: 9, // flooding
  14: 6, // broken-down vehicle
};

const CITIZEN_ALERT_SEVERITY = {
  ROAD_BLOCK: 8,
  WATERLOGGING: 8,
  FALLEN_TREE: 7,
  OPEN_MANHOLE: 7,
  POWER_HAZARD: 7,
  STRUCTURAL_DAMAGE: 6,
  TRAFFIC_JAM: 5,
  GENERAL_HAZARD: 5,
};

const CITIZEN_ALERT_LABELS = {
  ROAD_BLOCK: 'Road blocked or closed',
  WATERLOGGING: 'Flooding and waterlogging',
  FALLEN_TREE: 'Fallen tree',
  OPEN_MANHOLE: 'Open manhole',
  POWER_HAZARD: 'Electrical hazard',
  STRUCTURAL_DAMAGE: 'Damaged road or structure',
  TRAFFIC_JAM: 'Traffic jam',
  GENERAL_HAZARD: 'Citizen hazard report',
};

const ALERT_CAUTION = 5;

/**
 * Turns the readings behind a cell into explicit alerts.
 *
 * An alert says what is wrong and where, instead of burying a road closure in
 * a weighted average: a closure is an alert even when the delay it reports is
 * zero. Only measured events produce alerts — simulated transit is ignored.
 */
function deriveCellAlerts(transit, citizen) {
  const alerts = [];

  for (const event of transit) {
    const payload = event.rawPayload || {};
    if (payload.simulated) continue;

    if (payload.source === 'tomtom-traffic-incidents') {
      const iconCategory = Number(payload.iconCategory);
      const delayMins = Number(event.delayMins) || 0;
      const base = INCIDENT_ALERT_SEVERITY[iconCategory] ?? 5;
      const severity = clamp(base + Math.min(1, delayMins / 10));
      const description = payload.description || payload.category || 'Road incident';
      alerts.push({
        type: 'INCIDENT',
        severity: Number(severity.toFixed(1)),
        title: /^closed$/i.test(description) ? 'Road closed' : description,
        detail:
          delayMins > 0
            ? `${payload.category || 'Incident'} · ${delayMins.toFixed(1)} min delay`
            : `${payload.category || 'Incident'} reported on a watched road`,
        observedAt: event.observedAt,
      });
      continue;
    }

    const delayMins = Number(event.delayMins) || 0;
    const reduction = Number(event.speedReductionPct) || 0;
    if (delayMins >= 3 || reduction >= 30) {
      const severity = clamp(ALERT_CAUTION + delayMins / 5 + reduction / 25, ALERT_CAUTION, 9);
      alerts.push({
        type: 'CONGESTION',
        severity: Number(severity.toFixed(1)),
        title: 'Slow traffic',
        detail: `${reduction.toFixed(0)}% below free flow${delayMins > 0 ? ` · ${delayMins.toFixed(1)} min delay` : ''}`,
        observedAt: event.observedAt,
      });
    }
  }

  for (const event of citizen) {
    const payload = event.rawPayload || {};
    if (payload.simulated) continue;
    const category = String(event.category || payload.category || '').toUpperCase();
    const urgency = String(payload.urgency || '').toLowerCase();
    const base = CITIZEN_ALERT_SEVERITY[category] ?? ALERT_CAUTION;
    const severity = clamp(base + (urgency === 'high' ? 1 : urgency === 'low' ? -1 : 0));
    alerts.push({
      type: 'REPORT',
      severity,
      title: CITIZEN_ALERT_LABELS[category] || 'Citizen report',
      detail: event.reportText ? String(event.reportText).slice(0, 160) : 'Reported by a resident',
      observedAt: event.observedAt,
    });
  }

  alerts.sort((a, b) => b.severity - a.severity);
  const seen = new Set();
  const unique = [];
  for (const alert of alerts) {
    const key = `${alert.type}|${alert.title}|${alert.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(alert);
  }
  return unique.slice(0, 4);
}

/**
 * Evaluates all events for a spatial cell and produces rich scores.
 */
export function scoreCellEvents(events, previousCell, weights = DEFAULT_WEIGHTS, threshold = 7.0) {
  const now = Date.now();
  const transit = events.filter((e) => e.sourceType === 'GTFS_TRANSIT');
  const weather = events.filter((e) => e.sourceType === 'WEATHER_API');
  const citizen = events.filter((e) => e.sourceType === 'CITIZEN_311');
  const gis = events.filter((e) => e.sourceType === 'GIS_STATIC' || Number.isFinite(e.vulnerabilityScore));

  const previousVulnerability = previousCell?.scores?.vulnerability || 0;

  const mobility = computeMobilityScore(transit, citizen, now);
  const climate = computeClimateScore(weather, now);
  const vulnerability = computeVulnerabilityScore(gis, citizen, previousVulnerability);

  const alerts = deriveCellAlerts(transit, citizen);
  const alertScore = alerts.length ? alerts[0].severity : 0;
  const alertLevel =
    alertScore >= threshold ? 'CRITICAL' : alertScore >= ALERT_CAUTION ? 'WARNING' : null;

  const directRisk = Number(
    (weights.Wm * mobility.score + weights.Wc * climate.score + weights.Wv * vulnerability.score).toFixed(2)
  );

  const { confidenceScore, isDegraded, degradationReasons, degradationStatus } = computeConfidenceAndDegradation(
    mobility,
    climate,
    vulnerability
  );

  const previousCompositeRisk = previousCell?.compositeRisk;
  const { velocity, trend, trendDisplay } = computeVelocityAndTrend(directRisk, previousCell, new Date(now));
  const riskLevel = classifyRiskLevel(directRisk, threshold);
  const anomaly = detectAnomalies({ mobility: mobility.score, climate: climate.score, vulnerability: vulnerability.score }, directRisk, previousCompositeRisk);

  const sources = [...new Set(events.map((e) => e.sourceType))];
  // The real place this cell is: the streets it holds and the watercourse
  // it sits near. Taken from the terrain reading, never invented.
  const terrainEvent = gis.find((event) => event.rawPayload?.elevationM !== undefined) || gis[0];
  const context = terrainEvent?.rawPayload
    ? {
        streets: Array.isArray(terrainEvent.rawPayload.roadNames)
          ? terrainEvent.rawPayload.roadNames.filter(Boolean)
          : [],
        waterway: terrainEvent.rawPayload.waterwayName || '',
        waterDistanceM: terrainEvent.rawPayload.waterDistanceM ?? null,
        elevationM: terrainEvent.rawPayload.elevationM ?? null,
      }
    : null;
  // The last time something was actually observed here. When nothing has been
  // observed inside the window, this keeps the last real observation rather
  // than the last time the cell was written, so a cell that has gone quiet
  // stops counting as active.
  const lastObserved = events.length
    ? new Date(Math.max(...events.map((e) => new Date(e.observedAt).getTime())))
    : previousCell?.telemetryStats?.lastObservedAt || null;

  return {
    scores: {
      mobility: mobility.score,
      climate: climate.score,
      vulnerability: vulnerability.score,
    },
    weights,
    compositeRisk: directRisk,
    riskLevel,
    // What is actively wrong in this cell, independent of the averaged risk.
    alertScore,
    alertLevel,
    alerts,
    trend,
    trendDisplay,
    riskVelocity: velocity,
    confidence: confidenceScore,
    isDegraded,
    degradationReasons,
    degradationStatus,
    anomalyDetected: anomaly.detected,
    anomalyReason: anomaly.reason,
    context,
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
  // Check MongoDB connection before proceeding
  if (mongoose.connection.readyState !== 1) {
    console.warn('[risk-engine] MongoDB not connected, skipping cell recalculation');
    return null;
  }

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
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        ...scored,
        history: updatedHistory,
        lastUpdated: new Date(),
        degradationStatus: scored.degradationStatus,
        // The city the cell belongs to, taken from the telemetry that
        // produced it, so the console can group the cells by city.
        cityCode: events.find((event) => event.cityCode)?.cityCode || previousCell?.cityCode || null,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();

  broadcastCells([updatedCell]);
  return updatedCell;
}

/**
 * Processes all telemetry from the database into spatial cells.
 *
 * Cells are created from the telemetry that exists, and existing cells are
 * recalculated rather than deleted, so the rolling history of each cell
 * survives from one cycle to the next. Clearing the collection here used to
 * throw that history away every ten minutes, which left the history at a
 * single entry and made any trend or change detection impossible.
 */
export async function processTelemetryToCells() {
  try {
    const uniqueH3Indices = await TelemetryEvent.distinct('h3Index');

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

    // A cell whose telemetry is gone is a cell that no longer describes
    // anything. It is removed so the list of cells only ever holds places
    // that are actually being observed.
    const live = new Set(uniqueH3Indices.filter(Boolean));
    const stale = await SpatialCell.find({ h3Index: { $nin: [...live] } }, { h3Index: 1 }).lean();
    if (stale.length) {
      await SpatialCell.deleteMany({ h3Index: { $in: stale.map((cell) => cell.h3Index) } });
      console.log(`[risk-engine] Removed ${stale.length} cells that no longer have telemetry.`);
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
  // Check MongoDB connection before proceeding
  if (mongoose.connection.readyState !== 1) {
    console.warn('[risk-engine] MongoDB not connected, skipping cell recalculation');
    return [];
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cells = await SpatialCell.find({ lastUpdated: { $gte: cutoff } }, { h3Index: 1 }).lean();
  const results = [];
  for (const cell of cells) {
    try {
      const updated = await recalculateCell(cell.h3Index);
      if (updated) results.push(updated);
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
  // Check MongoDB connection before proceeding
  if (mongoose.connection.readyState !== 1) {
    console.warn('[risk-engine] MongoDB not connected, returning empty cell list');
    return [];
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // A cell counts as active when something was actually observed in it, not
  // merely when it was written to. A cell that has had no reading for a day
  // is not one an operator can act on.
  const query = {
    lastUpdated: { $gte: cutoff },
    'telemetryStats.lastObservedAt': { $gte: cutoff },
  };

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

  // Same definition of "active" as listActiveCells, so the summary cannot
  // report more cells than the list an operator can see.
  const activeMatch = {
    lastUpdated: { $gte: cutoff },
    'telemetryStats.lastObservedAt': { $gte: cutoff },
  };

  const [aggregation, totalCells] = await Promise.all([
    SpatialCell.aggregate([
      { $match: activeMatch },
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
    SpatialCell.countDocuments(activeMatch),
  ]);

  return {
    totalActiveCells: totalCells,
    threshold,
    breakdown: aggregation,
    generatedAt: new Date().toISOString(),
  };
}
