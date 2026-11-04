# Metabolic City - Algorithms and Formulae Documentation

**Project:** Urban Risk Management Platform  
**Date:** November 4, 2026  
**Purpose:** Technical documentation for supervisor review

---

## Table of Contents

1. [H3 Spatial Indexing](#1-h3-spatial-indexing)
2. [Composite Risk Calculation](#2-composite-risk-calculation)
3. [Mobility Score Algorithm](#3-mobility-score-algorithm)
4. [Climate Score Algorithm](#4-climate-score-algorithm)
5. [Vulnerability Score Algorithm](#5-vulnerability-score-algorithm)
6. [Temporal Decay Weighting](#6-temporal-decay-weighting)
7. [Cascade Risk Calculation](#7-cascade-risk-calculation)
8. [Risk Velocity and Trend](#8-risk-velocity-and-trend)
9. [Spatial Interpolation (IDW)](#9-spatial-interpolation-idw)
10. [Haversine Distance Formula](#10-haversine-distance-formula)
11. [Multi-Resolution H3 Analysis](#11-multi-resolution-h3-analysis)
12. [Spatial Autocorrelation (Moran's I)](#12-spatial-autocorrelation-morans-i)
13. [Temporal Pattern Analysis](#13-temporal-pattern-analysis)
14. [Volatility Calculation](#14-volatility-calculation)
15. [Seasonality Detection](#15-seasonality-detection)
16. [Traffic Flow to Mobility Conversion](#16-traffic-flow-to-mobility-conversion)
17. [Confidence and Degradation Metrics](#17-confidence-and-degradation-metrics)
18. [Anomaly Detection](#18-anomaly-detection)

---

## 1. H3 Spatial Indexing

### Description
H3 is a hexagonal hierarchical spatial indexing system that partitions the Earth's surface into hexagonal cells at multiple resolutions. Metabolic City uses resolution 8 (street-level, ~0.5km² per cell) for granular risk assessment.

### Algorithm
```
Input: latitude, longitude
Process: H3.latLngToCell(lat, lon, resolution)
Output: h3Index (string)
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
export const H3_RESOLUTION = 8; // Street-level resolution

export function normalizeCoordinates(latitude, longitude) {
  const h3Fn = h3.latLngToCell || h3.geoToH3;
  const h3Index = h3Fn(lat, lon, H3_RESOLUTION);
  return { latitude: lat, longitude: lon, h3Index };
}
```

### Parameters
- **Resolution 8:** ~0.5km² cell area (street-level)
- **Resolution 6:** ~3km² cell area (neighborhood-level)
- **Resolution 4:** ~25km² cell area (city-level)

---

## 2. Composite Risk Calculation

### Description
Composite risk is a weighted sum of three sub-scores: Mobility (Sm), Climate (Sc), and Vulnerability (Sv). The weights are configurable and stored in the database.

### Formula
```
Rc = (Wm × Sm) + (Wc × Sc) + (Wv × Sv)

Where:
- Rc = Composite Risk (0-10)
- Wm = Mobility weight (default: 0.4)
- Wc = Climate weight (default: 0.4)
- Wv = Vulnerability weight (default: 0.2)
- Sm = Mobility sub-score (0-10)
- Sc = Climate sub-score (0-10)
- Sv = Vulnerability sub-score (0-10)
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
const directRisk = Number(
  (weights.Wm * mobility.score + 
   weights.Wc * climate.score + 
   weights.Wv * vulnerability.score).toFixed(2)
);
```

### Weight Constraints
- **Sum constraint:** Wm + Wc + Wv = 1.0
- **Default weights:** Wm=0.4, Wc=0.4, Wv=0.2
- **Adjustable:** Via admin console or database

---

## 3. Mobility Score Algorithm

### Description
Calculates mobility risk from transit delays, speed reductions, and citizen reports. Uses temporal weighting to prioritize recent events.

### Formula
```
1. Temporal Weight:
   w = exp(-λ × age)
   λ = ln(2) / halfLife (halfLife = 30 minutes)

2. Weighted Delay:
   effectiveDelay = (Σ w × delay) / Σ w
   maxDelay = max(all delays)
   blendedDelay = 0.7 × effectiveDelay + 0.3 × maxDelay

3. Delay Score:
   Sd = clamp((blendedDelay / 15) × 10)
   // 15 minutes delay = 10.0 (maximum score)

4. Weighted Speed Reduction:
   effectiveSpeedRed = (Σ w × speedRed) / Σ w
   maxSpeedRed = max(all speed reductions)
   blendedSpeedRed = 0.7 × effectiveSpeedRed + 0.3 × maxSpeedRed

5. Speed Score:
   Ss = clamp((blendedSpeedRed / 100) × 10)
   // 100% speed reduction = 10.0 (maximum score)

6. Citizen Reports Factor:
   Scitizen = clamp(mobilityReports.length × 2.5)

7. Combined Mobility Score:
   Sm = clamp(0.6 × Sd + 0.3 × Ss + 0.1 × Scitizen)
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
function computeMobilityScore(transitEvents, citizenEvents, now) {
  // Calculate temporal weights
  for (const event of transitEvents) {
    const w = computeTemporalWeight(event.observedAt, now);
    weightedDelay += delay * w;
    weightedSpeedReduction += speedRed * w;
    totalWeight += w;
  }

  const effectiveDelay = totalWeight > 0 ? weightedDelay / totalWeight : maxDelay;
  const delayScore = clamp(((0.7 * effectiveDelay + 0.3 * maxDelay) / 15) * 10);
  const speedScore = clamp(((0.7 * effectiveSpeedRed + 0.3 * maxSpeedRed) / 100) * 10);
  
  const mobilityScore = clamp(0.6 * delayScore + 0.3 * speedScore + 0.1 * citizenMobilityScore);
  return { score: mobilityScore, ... };
}
```

### Key Parameters
- **Delay threshold:** 15 minutes = 10.0 score
- **Speed reduction threshold:** 100% = 10.0 score
- **Blending factor:** 70% average, 30% peak
- **Citizen report weight:** 2.5 per report

---

## 4. Climate Score Algorithm

### Description
Calculates climate risk from precipitation, visibility, and wind gusts using non-linear scaling curves to model urban drainage saturation and hazard accumulation.

### Formula
```
1. Precipitation Scoring (Non-linear):
   effectiveRain = (Σ w × rain) / Σ w
   peakBlendedRain = 0.65 × effectiveRain + 0.35 × maxRain
   Srain = 10 × (min(1, peakBlendedRain / 50))^0.85
   // 50 mm/hr = 10.0, power curve (0.85) for drainage saturation

2. Visibility Scoring:
   if visibility < 5000m:
     Svis = ((5000 - visibility) / 5000) × 10
   // <500m = high hazard (up to 10)
   // >5000m = 0 hazard

3. Wind Gust Scoring:
   if windGust > 8 m/s:
     Swind = ((windGust - 8) / 17) × 10
   // >25 m/s (90 km/h) = 10.0
   // <8 m/s = 0

4. Composite Climate Score:
   Sc = clamp(0.70 × Srain + 0.15 × Svis + 0.15 × Swind)
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
function computeClimateScore(weatherEvents, now) {
  const peakBlendedRain = 0.65 * effectiveRain + 0.35 * maxRain;
  const rainScore = clamp(10 * Math.pow(Math.min(1, peakBlendedRain / 50), 0.85));
  
  const visScore = clamp(((5000 - minVisibility) / 5000) * 10);
  const windScore = clamp(((maxWindGust - 8) / 17) * 10);
  
  const compositeClimate = clamp(0.70 * rainScore + 0.15 * visScore + 0.15 * windScore);
  return { score: compositeClimate, ... };
}
```

### Key Parameters
- **Rain threshold:** 50 mm/hr = 10.0 score
- **Power exponent:** 0.85 (early urban drainage saturation)
- **Visibility threshold:** 5000m (hazard onset)
- **Wind threshold:** 8 m/s (hazard onset), 25 m/s (maximum)
- **Multi-hazard weights:** 70% rain, 15% visibility, 15% wind

---

## 5. Vulnerability Score Algorithm

### Description
Calculates vulnerability from baseline GIS data (elevation, flood exposure) and dynamic citizen distress reports (slum hazards, drain blockage, fallen trees, live wires).

### Formula
```
1. Baseline from GIS:
   baselineScore = max(GIS vulnerability scores)

2. Citizen Distress Factor:
   Scitizen = clamp(citizenDistressReports.length × 2.0)

3. Combined Vulnerability:
   if baselineScore > 0:
     Sv = 0.75 × baselineScore + 0.25 × Scitizen
   else:
     Sv = Scitizen
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
function computeVulnerabilityScore(gisEvents, citizenEvents, previousVulnerability = 0) {
  const baselineScore = Math.max(...gisEvents.map(e => e.vulnerabilityScore));
  const citizenDistressScore = clamp(citizenEvents.length * 2.0);
  
  const finalVulnerability = clamp(
    baselineScore > 0 ? 0.75 * baselineScore + 0.25 * citizenDistressScore : citizenDistressScore
  );
  return { score: finalVulnerability, ... };
}
```

### Key Parameters
- **Citizen report weight:** 2.0 per distress report
- **Baseline weight:** 75% if GIS data available
- **Dynamic weight:** 25% citizen reports

---

## 6. Temporal Decay Weighting

### Description
Applies exponential decay to event weights based on age, prioritizing recent observations over older ones. Half-life determines how quickly older events lose influence.

### Formula
```
w = exp(-λ × age)

Where:
- w = temporal weight (0-1)
- λ = decay constant = ln(2) / halfLife
- age = time elapsed since event observation
- halfLife = 30 minutes (configurable)
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
export function computeTemporalWeight(observedAt, now = Date.now(), halfLifeMs = HALF_LIFE_MS) {
  const eventTime = new Date(observedAt).getTime();
  const ageMs = Math.max(0, now - eventTime);
  const lambda = Math.LN2 / halfLifeMs;
  return Math.exp(-lambda * ageMs);
}
```

### Decay Behavior
- **t = 0 (now):** w = 1.0 (full weight)
- **t = 30 min:** w = 0.5 (half weight)
- **t = 60 min:** w = 0.25 (quarter weight)
- **t = 90 min:** w = 0.125 (eighth weight)

### Configuration
- **HALF_LIFE_MS:** 30 minutes (default)
- **WINDOW_MS:** 60 minutes (events older than this are excluded)

---

## 7. Cascade Risk Calculation

### Description
Calculates risk spillover from neighboring H3 cells using H3 ring distance k=1 (immediate neighbors). If neighbors have high risk, cascade effect propagates to the target cell.

### Formula
```
1. Get Neighbors:
   neighbors = h3.kRing(h3Index, 1)  // 1-ring neighbors (6 cells)

2. Neighbor Risk Statistics:
   maxNeighborRisk = max(all neighbor composite risks)
   avgNeighborRisk = mean(all neighbor composite risks)

3. Cascade Detection:
   if maxNeighborRisk >= 6.0:
     cascadeRisk = 0.6 × maxNeighborRisk + 0.4 × avgNeighborRisk
   else:
     cascadeRisk = 0

4. Risk Adjustment:
   if cascadeRisk >= 7.0 and directRisk < cascadeRisk:
     adjustedRisk = 0.85 × directRisk + 0.15 × cascadeRisk
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
async function computeCascadeRisk(h3Index, directRisk) {
  const neighbors = h3.kRing(h3Index, 1).filter(idx => idx !== h3Index);
  const neighborCells = await SpatialCell.find({ h3Index: { $in: neighbors } });
  
  const risks = neighborCells.map(c => c.compositeRisk);
  const maxNeighborRisk = Math.max(...risks);
  const avgNeighborRisk = risks.reduce((sum, r) => sum + r, 0) / risks.length;
  
  if (maxNeighborRisk >= 6.0) {
    const cascadeComponent = 0.6 * maxNeighborRisk + 0.4 * avgNeighborRisk;
    return clamp(cascadeComponent);
  }
  return 0;
}
```

### Key Parameters
- **Ring distance:** k=1 (immediate 6 neighbors)
- **Cascade threshold:** 6.0 (neighbor risk)
- **Cascade blend:** 60% max, 40% average
- **Damping factor:** 85% direct, 15% cascade

---

## 8. Risk Velocity and Trend

### Description
Calculates the rate of change of risk over time and classifies the trend (SURGING, RISING, STABLE, DE-ESCALATING) based on velocity thresholds.

### Formula
```
1. Time Difference:
   timeDiffHours = max(0.05, (now - lastUpdated) / (1000 × 60 × 60))

2. Risk Velocity:
   velocity = (currentRisk - previousRisk) / timeDiffHours
   // Rate of change in risk points per hour

3. Trend Classification:
   if velocity > 1.5:    SURGING
   if velocity > 0.3:    RISING
   if velocity < -0.3:   DE-ESCALATING
   else:                 STABLE
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
function computeVelocityAndTrend(currentRisk, previousCell, calculatedAt = new Date()) {
  const timeDiffHours = Math.max(0.05, (calculatedAt.getTime() - new Date(previousCell.lastUpdated).getTime()) / (1000 * 60 * 60));
  const riskDiff = currentRisk - previousCell.compositeRisk;
  const velocity = Number((riskDiff / timeDiffHours).toFixed(2));
  
  if (velocity > 1.5) return { velocity, trend: 'SURGING', trendDisplay: `Surging (+${velocity.toFixed(1)}/h)` };
  if (velocity > 0.3) return { velocity, trend: 'RISING', trendDisplay: `Rising (+${velocity.toFixed(1)}/h)` };
  if (velocity < -0.3) return { velocity, trend: 'DE-ESCALATING', trendDisplay: `Falling (${velocity.toFixed(1)}/h)` };
  return { velocity, trend: 'STABLE', trendDisplay: `Stable (${velocity.toFixed(1)}/h)` };
}
```

### Velocity Thresholds
- **> 1.5 points/hour:** SURGING (rapid increase)
- **> 0.3 points/hour:** RISING (moderate increase)
- **< -0.3 points/hour:** DE-ESCALATING (decreasing)
- **-0.3 to 0.3 points/hour:** STABLE (no significant change)

---

## 9. Spatial Interpolation (IDW)

### Description
Inverse Distance Weighting (IDW) interpolates weather observations to give each H3 cell a value based on its distance to real observation points. Closer observations have more influence.

### Formula
```
1. Haversine Distance (for each observation):
   d = 2 × R × arcsin(√(sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)))
   where R = 6371.0088 km (Earth radius)

2. IDW Weight:
   weight = 1 / distance^power
   // Default power = 2 (standard IDW)

3. Interpolated Value:
   value = (Σ weight × observationValue) / Σ weight

4. Exact Match Override:
   if distance ≤ 0.05 km:
     value = observationValue (exact match, no interpolation)
```

### Implementation
**File:** `backend/src/services/spatialInterpolation.js`

```javascript
export function interpolateField(observations, target, select, options = {}) {
  const { power = 2, exactToleranceKm = 0.05 } = options;
  
  // Calculate distances using Haversine
  const distances = usable.map(entry => ({
    ...entry,
    distanceKm: haversineKm(target, entry.observation),
  }));
  
  // Exact match check
  if (nearest.distanceKm <= exactToleranceKm) {
    return { value: nearest.value, exact: true };
  }
  
  // IDW calculation
  let weightSum = 0;
  let weighted = 0;
  for (const entry of distances) {
    const weight = 1 / entry.distanceKm ** power;
    weightSum += weight;
    weighted += weight * entry.value;
  }
  
  return { value: weighted / weightSum, exact: false };
}
```

### Key Parameters
- **Power exponent:** 2 (standard IDW)
- **Exact tolerance:** 0.05 km (50 meters)
- **Earth radius:** 6371.0088 km

---

## 10. Haversine Distance Formula

### Description
Calculates the great-circle distance between two points on Earth's surface, accounting for Earth's curvature.

### Formula
```
d = 2 × R × arcsin(√(sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)))

Where:
- d = distance between points (km)
- R = Earth radius (6371.0088 km)
- Δlat = lat2 - lat1 (in radians)
- Δlon = lon2 - lon1 (in radians)
- lat1, lat2 = latitudes (in radians)
```

### Implementation
**File:** `backend/src/services/spatialInterpolation.js`

```javascript
const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  
  const h = Math.sin(dLat / 2) ** 2 + 
           Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

---

## 11. Multi-Resolution H3 Analysis

### Description
Analyzes risk at multiple H3 resolutions simultaneously: street-level (res 8), neighborhood-level (res 6), and city-level (res 4). Provides hierarchical risk assessment.

### Algorithm
```
1. Street-Level (Resolution 8):
   - Current cell's risk directly from database

2. Neighborhood-Level (Resolution 6):
   parentH3 = h3ToParent(h3Index, 6)
   children = h3ToChildren(parentH3, 8)
   avgRisk = mean(children's composite risks)

3. City-Level (Resolution 4):
   parentH3 = h3ToParent(h3Index, 4)
   children = h3ToChildren(parentH3, 8)
   avgRisk = mean(children's composite risks)
```

### Implementation
**File:** `backend/src/services/spatialAnalysis.js`

```javascript
export async function getMultiResolutionRisk(h3Index) {
  return {
    street: await getCellRisk(h3Index),
    neighborhood: await getNeighborhoodRisk(h3Index),
    city: await getCityRisk(h3Index),
  };
}

async function getNeighborhoodRisk(h3Index) {
  const parentH3 = h3.h3ToParent(h3Index, 6);
  const children = h3.h3ToChildren(parentH3, 8);
  const cells = await SpatialCell.find({ h3Index: { $in: children } });
  const avgRisk = cells.reduce((sum, cell) => sum + cell.compositeRisk, 0) / cells.length;
  return { h3Index: parentH3, risk: avgRisk, ... };
}
```

### Resolution Scale
- **Res 8:** ~0.5km² (street-level)
- **Res 6:** ~3km² (neighborhood-level)
- **Res 4:** ~25km² (city-level)

---

## 12. Spatial Autocorrelation (Moran's I)

### Description
Measures spatial clustering or dispersion of risk values. Moran's I > 0 indicates clustering (similar values nearby), I < 0 indicates dispersion (dissimilar values nearby), I ≈ 0 indicates random spatial pattern.

### Formula
```
Moran's I = Σi Σj wij × (xi - x̄) × (xj - x̄) / Σi (xi - x̄)²

Where:
- wij = spatial weight (1 for neighbors, 0 otherwise)
- xi, xj = risk values at locations i and j
- x̄ = mean of all risk values
- Σi Σj = double sum over all i and j pairs
```

### Implementation
**File:** `backend/src/services/spatialAnalysis.js`

```javascript
export async function calculateSpatialAutocorrelation(h3Index) {
  const neighbors = h3.kRing(h3Index, 1);
  const neighborCells = await SpatialCell.find({ h3Index: { $in: neighbors } });
  
  const risks = [cell.compositeRisk, ...neighborCells.map(c => c.compositeRisk)];
  const mean = risks.reduce((a, b) => a + b, 0) / risks.length;
  
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
  
  // Interpretation
  if (moransI > 0.3) return 'positive-autocorrelation-clustering';
  if (moransI < -0.3) return 'negative-autocorrelation-dispersion';
  return 'random-spatial-pattern';
}
```

### Interpretation
- **I > 0.3:** Positive autocorrelation (clustering)
- **I < -0.3:** Negative autocorrelation (dispersion)
- **-0.3 ≤ I ≤ 0.3:** Random spatial pattern

---

## 13. Temporal Pattern Analysis

### Description
Analyzes risk trends over time by comparing historical risk values. Detects increasing, decreasing, or stable patterns.

### Formula
```
1. Split Historical Data:
   firstHalf = risks[0 : floor(n/2)]
   secondHalf = risks[floor(n/2) : n]

2. Calculate Means:
   avgFirst = mean(firstHalf)
   avgSecond = mean(secondHalf)

3. Trend Detection:
   diff = avgSecond - avgFirst
   if diff > 1:    increasing
   if diff < -1:   decreasing
   else:          stable
```

### Implementation
**File:** `backend/src/services/spatialAnalysis.js`

```javascript
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
```

### Thresholds
- **> 1 point difference:** Increasing trend
- **< -1 point difference:** Decreasing trend
- **-1 to 1 points:** Stable

---

## 14. Volatility Calculation

### Description
Calculates the standard deviation of risk values over time, measuring how much risk fluctuates. High volatility indicates unstable conditions.

### Formula
```
1. Mean:
   x̄ = Σ xi / n

2. Variance:
   σ² = Σ (xi - x̄)² / n

3. Standard Deviation (Volatility):
   σ = √σ²
```

### Implementation
**File:** `backend/src/services/spatialAnalysis.js`

```javascript
function calculateVolatility(risks) {
  if (risks.length < 2) return 0;
  
  const mean = risks.reduce((a, b) => a + b, 0) / risks.length;
  const variance = risks.reduce((sum, risk) => sum + Math.pow(risk - mean, 2), 0) / risks.length;
  
  return Math.sqrt(variance);
}
```

### Interpretation
- **σ < 1:** Low volatility (stable)
- **1 ≤ σ ≤ 2:** Moderate volatility
- **σ > 2:** High volatility (unstable)
- **σ > 3:** Very high volatility (investigate)

---

## 15. Seasonality Detection

### Description
Detects temporal patterns in risk based on time-of-day occurrence. Basic implementation identifies day vs. night peaks.

### Algorithm
```
1. Extract Hours:
   hours = history.map(h => h.calculatedAt.getHours())

2. Classify:
   nightHours = count(hours where hour >= 22 or hour < 6)
   dayHours = totalHours - nightHours

3. Pattern Detection:
   if nightHours > dayHours × 1.5: night-peaks
   if dayHours > nightHours × 1.5: day-peaks
   else: uniform
```

### Implementation
**File:** `backend/src/services/spatialAnalysis.js`

```javascript
function detectSeasonality(history) {
  const hours = history.map(h => new Date(h.calculatedAt).getHours());
  
  const nightHours = hours.filter(h => h >= 22 || h < 6).length;
  const dayHours = hours.length - nightHours;
  
  if (nightHours > dayHours * 1.5) return 'night-peaks';
  if (dayHours > nightHours * 1.5) return 'day-peaks';
  return 'uniform';
}
```

### Pattern Types
- **Night-peaks:** Risk concentrates at night (22:00-06:00)
- **Day-peaks:** Risk concentrates during day (06:00-22:00)
- **Uniform:** Even distribution throughout day

---

## 16. Traffic Flow to Mobility Conversion

### Description
Converts TomTom traffic flow segment data into mobility metrics (delay minutes and speed reduction percentage) used in risk scoring.

### Formula
```
1. Delay Minutes:
   delayMins = max(0, (currentTravelTime - freeFlowTravelTime) / 60)

2. Speed Reduction Percentage:
   speedReductionPct = max(0, min(100, ((freeFlowSpeed - currentSpeed) / freeFlowSpeed) × 100))

3. Congestion Level:
   if speedReductionPct >= 80:    STANDSTILL
   if speedReductionPct >= 50:    SEVERE
   if speedReductionPct >= 20:    MODERATE
   else:                           LOW
```

### Implementation
**File:** `backend/src/services/trafficService.js`

```javascript
export function flowToMobility(segment) {
  const currentSpeed = Number(segment.currentSpeed);
  const freeFlowSpeed = Number(segment.freeFlowSpeed);
  const currentTravelTime = Number(segment.currentTravelTime);
  const freeFlowTravelTime = Number(segment.freeFlowTravelTime);

  const delayMins = Math.max(0, (currentTravelTime - freeFlowTravelTime) / 60);
  const speedReductionPct = Math.max(0, Math.min(100, ((freeFlowSpeed - currentSpeed) / freeFlowSpeed) * 100));

  return {
    delayMins: Number(delayMins.toFixed(2)),
    speedReductionPct: Number(speedReductionPct.toFixed(2)),
    congestionLevel: congestionLevelFor(speedReductionPct),
  };
}
```

### Congestion Bands
- **0-20%:** LOW
- **20-50%:** MODERATE
- **50-80%:** SEVERE
- **80-100%:** STANDSTILL

---

## 17. Confidence and Degradation Metrics

### Description
Calculates data confidence score based on data source availability and sample count. Identifies degradation reasons for dashboard display.

### Formula
```
1. Base Confidence: 1.0

2. Mobility Data:
   if no mobility data:      confidence -= 0.35, status = NO_MOBILITY_DATA
   if < 2 mobility samples:  confidence -= 0.10, status = SPARSE_MOBILITY

3. Climate Data:
   if no climate data:       confidence -= 0.35, status = NO_CLIMATE_DATA
   if < 2 climate samples:    confidence -= 0.10, status = SPARSE_CLIMATE

4. Vulnerability Data:
   if no vulnerability data: confidence -= 0.20, status = NO_VULNERABILITY_DATA

5. Final Confidence:
   confidence = max(0.1, min(1.0, confidence))
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
function computeConfidenceAndDegradation(mobilityData, climateData, vulnerabilityData) {
  let confidenceScore = 1.0;
  const degradationReasons = [];
  
  if (!mobilityData.hasData) {
    confidenceScore -= 0.35;
    degradationReasons.push('mobility_data_missing');
  } else if (mobilityData.sampleCount < 2) {
    confidenceScore -= 0.10;
    degradationReasons.push('mobility_sparse_samples');
  }
  
  // Similar for climate and vulnerability...
  
  return { confidenceScore, isDegraded, degradationReasons, degradationStatus };
}
```

### Confidence Levels
- **1.0:** HEALTHY (all data sources available)
- **0.8-0.9:** Minor degradation (some sparse data)
- **0.5-0.7:** Moderate degradation (one data source missing)
- **< 0.5:** Severe degradation (multiple data sources missing)

---

## 18. Anomaly Detection

### Description
Detects sensor anomalies or impossible rapid jumps in risk values to flag potential data quality issues.

### Detection Rules
```
1. Rapid Risk Surge:
   if |currentRisk - previousRisk| >= 4.5:
     anomaly = RAPID_RISK_SURGE_ANOMALY

2. Extreme Weather Without Transit Impact:
   if climate > 9.5 and mobility < 0.5:
     anomaly = EXTREME_WEATHER_WITHOUT_TRANSIT_IMPACT_CHECK
```

### Implementation
**File:** `backend/src/engine/risk.js`

```javascript
function detectAnomalies(scores, currentRisk, previousRisk) {
  if (previousRisk != null && Math.abs(currentRisk - previousRisk) >= 4.5) {
    return { detected: true, reason: 'RAPID_RISK_SURGE_ANOMALY' };
  }
  if (scores.climate > 9.5 && scores.mobility < 0.5) {
    return { detected: true, reason: 'EXTREME_WEATHER_WITHOUT_TRANSIT_IMPACT_CHECK' };
  }
  return { detected: false, reason: null };
}
```

### Anomaly Types
- **RAPID_RISK_SURGE_ANOMALY:** Risk increased by 4.5+ points (data quality issue)
- **EXTREME_WEATHER_WITHOUT_TRANSIT_IMPACT_CHECK:** Extreme weather but no transit impact (sensor calibration issue)

---

## Algorithm Summary Table

| Algorithm | Category | Formula/Method | Input | Output | File |
|----------|----------|---------------|-------|--------|------|
| H3 Indexing | Spatial | `h3.latLngToCell(lat, lon, 8)` | lat, lon | h3Index | `engine/risk.js` |
| Composite Risk | Risk | `Rc = Wm×Sm + Wc×Sc + Wv×Sv` | Sm, Sc, Sv, weights | Rc (0-10) | `engine/risk.js` |
| Mobility Score | Risk | Blended delay + speed + citizen reports | Transit events | Sm (0-10) | `engine/risk.js` |
| Climate Score | Risk | Non-linear rain + visibility + wind | Weather events | Sc (0-10) | `engine/risk.js` |
| Vulnerability Score | Risk | GIS baseline + citizen distress | GIS + citizen events | Sv (0-10) | `engine/risk.js` |
| Temporal Decay | Temporal | `w = exp(-λ × age)` | Event age | Weight (0-1) | `engine/risk.js` |
| Cascade Risk | Spatial | `0.6×max + 0.4×avg` of neighbors | Neighbor risks | CascadeRisk (0-10) | `engine/risk.js` |
| Risk Velocity | Temporal | `velocity = Δrisk / Δtime` | Risk history | Velocity (points/h) | `engine/risk.js` |
| IDW Interpolation | Spatial | `Σ(weight×value) / Σweight` | Observations + target | Interpolated value | `services/spatialInterpolation.js` |
| Haversine Distance | Spatial | `2R×arcsin(√(...))` | Two lat,lon pairs | Distance (km) | `services/spatialInterpolation.js` |
| Multi-Resolution | Spatial | Mean of child cells at different res | h3Index | Risk at multiple scales | `services/spatialAnalysis.js` |
| Moran's I | Spatial | Σwij(xi-x̄)(xj-x̄) / Σ(xi-x̄)² | Neighbor risks | Autocorrelation (-1 to 1) | `services/spatialAnalysis.js` |
| Trend Detection | Temporal | Compare first half vs second half | Risk history | Trend direction | `services/spatialAnalysis.js` |
| Volatility | Temporal | `σ = √(Σ(xi-x̄)²/n)` | Risk history | Standard deviation | `services/spatialAnalysis.js` |
| Seasonality | Temporal | Compare day vs night hour counts | Risk history | Pattern type | `services/spatialAnalysis.js` |
| Traffic Conversion | Mobility | `delay = (current-free)/60` | TomTom flow segment | Delay, speedRed% | `services/trafficService.js` |
| Confidence Score | Quality | `1.0 - Σ(penalties)` | Data source availability | Confidence (0-1) | `engine/risk.js` |
| Anomaly Detection | Quality | Threshold-based rules | Risk delta, scores | Anomaly flag | `engine/risk.js` |

---

## Implementation Files Reference

### Core Risk Engine
- `backend/src/engine/risk.js` - All risk calculation algorithms
- `backend/src/models/SpatialCell.js` - Data models for risk storage

### Spatial Analysis
- `backend/src/services/spatialAnalysis.js` - Multi-resolution, autocorrelation, temporal patterns
- `backend/src/routes/spatialAnalysis.js` - API endpoints for spatial analysis

### Spatial Interpolation
- `backend/src/services/spatialInterpolation.js` - IDW and Haversine calculations
- `backend/src/services/dataPipeline.js` - Pipeline integration

### Traffic Processing
- `backend/src/services/trafficService.js` - TomTom API integration and conversion

### Monitoring
- `backend/src/middleware/latencyMonitor.js` - Latency tracking and percentiles

---

## Configuration Parameters

### Risk Scoring
- `WEIGHT_MOBILITY` (default: 0.4)
- `WEIGHT_CLIMATE` (default: 0.3)
- `WEIGHT_VULNERABILITY` (default: 0.3)
- `DEFAULT_RISK_THRESHOLD` (default: 7.0)

### Temporal
- `WINDOW_MS` (default: 60 minutes)
- `HALF_LIFE_MS` (default: 30 minutes)

### Spatial
- `H3_RESOLUTION` (default: 8)
- `WEATHER_COVERAGE_RING` (default: 1)

---

## Validation and Testing

All algorithms have been validated through:
- Unit tests in `backend/tests/`
- Integration tests for spatial analysis
- Manual verification with sample data
- Supervisor demonstration scripts in `TESTING_GUIDE.md`

---

**Document Version:** 1.0  
**Last Updated:** November 4, 2026  
**Total Algorithms Documented:** 18  
**Total Formulae Documented:** 30+
