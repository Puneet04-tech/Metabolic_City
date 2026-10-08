import h3 from 'h3-js';
import { SpatialCell } from '../models/SpatialCell.js';

/**
 * Spatial Analysis Service
 * Spatial Intelligence Principles: Multi-resolution, Geospatial Indexing, Temporal-Spatial Correlation, Neighbor Awareness
 */

/**
 * Multi-Resolution H3 Analysis
 * Get risk at different resolutions (neighborhood, city, region)
 */
export async function getMultiResolutionRisk(h3Index) {
  const results = {
    street: await getCellRisk(h3Index),
    neighborhood: await getNeighborhoodRisk(h3Index),
    city: await getCityRisk(h3Index),
  };
  
  return results;
}

/**
 * Get cell risk at current resolution (street-level)
 */
async function getCellRisk(h3Index) {
  const cell = await SpatialCell.findOne({ h3Index });
  return cell ? { h3Index, risk: cell.compositeRisk, level: cell.riskLevel } : null;
}

/**
 * Get neighborhood risk (resolution 6)
 */
async function getNeighborhoodRisk(h3Index) {
  const parentH3 = h3.h3ToParent(h3Index, 6);
  const children = h3.h3ToChildren(parentH3, 8);
  
  const cells = await SpatialCell.find({ h3Index: { $in: children } });
  const avgRisk = cells.length > 0 
    ? cells.reduce((sum, cell) => sum + cell.compositeRisk, 0) / cells.length 
    : 0;
  
  return {
    h3Index: parentH3,
    risk: avgRisk,
    level: getRiskLevel(avgRisk),
    cellCount: cells.length,
  };
}

/**
 * Get city risk (resolution 4)
 */
async function getCityRisk(h3Index) {
  const parentH3 = h3.h3ToParent(h3Index, 4);
  const children = h3.h3ToChildren(parentH3, 8);
  
  const cells = await SpatialCell.find({ h3Index: { $in: children } });
  const avgRisk = cells.length > 0 
    ? cells.reduce((sum, cell) => sum + cell.compositeRisk, 0) / cells.length 
    : 0;
  
  return {
    h3Index: parentH3,
    risk: avgRisk,
    level: getRiskLevel(avgRisk),
    cellCount: cells.length,
  };
}

/**
 * Neighbor Awareness
 * Calculate risk considering neighbors
 */
export async function getNeighborAwareRisk(h3Index) {
  const cell = await SpatialCell.findOne({ h3Index });
  if (!cell) return null;
  
  const neighbors = h3.kRing(h3Index, 1); // 1-ring neighbors
  const neighborCells = await SpatialCell.find({ h3Index: { $in: neighbors } });
  
  const avgNeighborRisk = neighborCells.length > 0
    ? neighborCells.reduce((sum, c) => sum + c.compositeRisk, 0) / neighborCells.length
    : 0;
  
  const cascadeRisk = detectCascadeRisk(cell.compositeRisk, avgNeighborRisk);
  
  return {
    h3Index,
    originalRisk: cell.compositeRisk,
    neighborCount: neighborCells.length,
    avgNeighborRisk,
    cascadeRisk,
    adjustedRisk: cell.compositeRisk + (cascadeRisk * 0.2),
    riskFactors: {
      isolation: neighborCells.length === 0 ? 'high' : 'normal',
      neighborhoodPressure: avgNeighborRisk > 7 ? 'high' : 'normal',
    },
  };
}

/**
 * Detect cascade risk from neighbors
 */
function detectCascadeRisk(cellRisk, avgNeighborRisk) {
  const riskDiff = avgNeighborRisk - cellRisk;
  
  if (riskDiff > 2) return 2; // High cascade risk
  if (riskDiff > 1) return 1; // Moderate cascade risk
  if (riskDiff < -2) return -1; // Isolated high risk
  return 0; // Normal
}

/**
 * Temporal-Spatial Correlation
 * Analyze risk patterns over time for a cell
 */
export async function getTemporalSpatialPattern(h3Index, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const cell = await SpatialCell.findOne({ h3Index });
  if (!cell || !cell.history) return null;
  
  const recentHistory = cell.history.filter(
    (h) => new Date(h.calculatedAt) >= cutoff
  );
  
  if (recentHistory.length < 2) {
    return { h3Index, message: 'Insufficient historical data' };
  }
  
  const risks = recentHistory.map((h) => h.compositeRisk);
  const trend = calculateTrend(risks);
  const volatility = calculateVolatility(risks);
  const seasonality = detectSeasonality(recentHistory);
  
  return {
    h3Index,
    currentRisk: cell.compositeRisk,
    historical: {
      average: risks.reduce((a, b) => a + b, 0) / risks.length,
      min: Math.min(...risks),
      max: Math.max(...risks),
    },
    trend,
    volatility,
    seasonality,
    recommendation: getRecommendation(trend, volatility),
  };
}

/**
 * Calculate trend (increasing, decreasing, stable)
 */
function calculateTrend(risks) {
  if (risks.length < 2) return 'unknown';
  
  const firstHalf = risks.slice(0, Math.floor(risks.length / 2));
  const secondHalf = risks.slice(Math.floor(risks.length / 2));
  
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const diff = avgSecond - avgFirst;
  
  if (diff > 1) return 'increasing';
  if (diff < -1) return 'decreasing';
  return 'stable';
}

/**
 * Calculate volatility (standard deviation)
 */
function calculateVolatility(risks) {
  if (risks.length < 2) return 0;
  
  const mean = risks.reduce((a, b) => a + b, 0) / risks.length;
  const variance = risks.reduce((sum, risk) => sum + Math.pow(risk - mean, 2), 0) / risks.length;
  
  return Math.sqrt(variance);
}

/**
 * Detect seasonality (basic pattern detection)
 */
function detectSeasonality(history) {
  // Basic implementation - could be enhanced with more sophisticated algorithms
  const hours = history.map((h) => new Date(h.calculatedAt).getHours());
  
  const nightHours = hours.filter((h) => h >= 22 || h < 6).length;
  const dayHours = hours.length - nightHours;
  
  if (nightHours > dayHours * 1.5) return 'night-peaks';
  if (dayHours > nightHours * 1.5) return 'day-peaks';
  return 'uniform';
}

/**
 * Get recommendation based on trend and volatility
 */
function getRecommendation(trend, volatility) {
  if (trend === 'increasing' && volatility > 2) {
    return 'escalating-monitor-closely';
  }
  if (trend === 'increasing') {
    return 'increasing-monitor';
  }
  if (trend === 'decreasing') {
    return 'improving';
  }
  if (volatility > 3) {
    return 'unstable-investigate';
  }
  return 'stable-normal-operations';
}

/**
 * Get risk level from numeric score
 */
function getRiskLevel(risk) {
  if (risk >= 7) return 'CRITICAL';
  if (risk >= 4) return 'HIGH';
  if (risk >= 2) return 'MODERATE';
  return 'LOW';
}

/**
 * Find nearby cells within radius
 */
export async function findNearbyCells(h3Index, radiusKm = 5) {
  const [lat, lon] = h3.cellToLatLng(h3Index);
  
  // Use MongoDB 2dsphere for geospatial query
  const nearbyCells = await SpatialCell.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lon, lat] },
        $maxDistance: radiusKm * 1000, // Convert km to meters
      },
    },
  }).limit(50);
  
  return nearbyCells;
}

/**
 * Calculate spatial autocorrelation (Moran's I)
 */
export async function calculateSpatialAutocorrelation(h3Index) {
  const cell = await SpatialCell.findOne({ h3Index });
  if (!cell) return null;
  
  const neighbors = h3.kRing(h3Index, 1);
  const neighborCells = await SpatialCell.find({ h3Index: { $in: neighbors } });
  
  if (neighborCells.length === 0) return { h3Index, moransI: 0, interpretation: 'no-neighbors' };
  
  const risks = [cell.compositeRisk, ...neighborCells.map((c) => c.compositeRisk)];
  const mean = risks.reduce((a, b) => a + b, 0) / risks.length;
  
  // Simplified Moran's I calculation
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < risks.length; i++) {
    for (let j = 0; j < risks.length; j++) {
      if (i !== j) {
        numerator += (risks[i] - mean) * (risks[j] - mean);
      }
    }
    denominator += Math.pow(risks[i] - mean, 2);
  }
  
  const moransI = numerator / denominator;
  
  let interpretation;
  if (moransI > 0.3) interpretation = 'positive-autocorrelation-clustering';
  else if (moransI < -0.3) interpretation = 'negative-autocorrelation-dispersion';
  else interpretation = 'random-spatial-pattern';
  
  return {
    h3Index,
    moransI,
    interpretation,
    meanRisk: mean,
  };
}
