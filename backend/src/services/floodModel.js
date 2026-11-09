import * as h3 from 'h3-js';
import { TerrainCell } from '../models/TerrainCell.js';

/**
 * Screening-level urban flood model.
 *
 * This is deliberately not a hydraulic model and it does not pretend to be
 * SWMM or HEC-RAS. It is a transparent rainfall-runoff calculation over the
 * real terrain already stored for each cell:
 *
 *   SCS Curve Number runoff -> time-of-concentration routing ->
 *   upstream donor cells -> drainage-capacity proxy -> ponding depth.
 *
 * The two assumptions that matter most are stated in every result:
 * drainage capacity is a terrain-based proxy, and antecedent moisture is a
 * proxy from current rainfall. Both must be replaced by measured drain levels
 * and soil moisture before this can be called a calibrated flood forecast.
 */

export const FLOOD_MODEL_VERSION = 'urban-flood-screening-v1';
const TERRAIN_CACHE_MS = 30 * 60 * 1000;
const CELL_AREA_FALLBACK_M2 = 704000;
const terrainCaches = new Map();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cellArea = (h3Index) => {
  try {
    return h3.cellArea(h3Index, h3.UNITS.m2) || CELL_AREA_FALLBACK_M2;
  } catch {
    return CELL_AREA_FALLBACK_M2;
  }
};

async function terrainMapFor(cityCode) {
  if (!cityCode) return new Map();
  const cached = terrainCaches.get(cityCode);
  if (cached && Date.now() - cached.at < TERRAIN_CACHE_MS) return cached.map;

  const cells = await TerrainCell.find({ cityCode }).lean();
  const map = new Map(cells.map((cell) => [cell.h3Index, cell]));
  terrainCaches.set(cityCode, { at: Date.now(), map });
  return map;
}

/**
 * A curve number from the real road density and the terrain's own flood
 * susceptibility. More paved surface means more runoff; a cell that already
 * ponds is treated as less able to infiltrate.
 */
export function curveNumber({ roadCount = 0, floodSusceptibility = 0.3 } = {}) {
  const pavedFraction = clamp(Number(roadCount) / 18, 0, 1);
  const impervious = clamp(0.12 + 0.55 * pavedFraction + 0.15 * Number(floodSusceptibility || 0), 0.12, 0.9);
  return clamp(65 + 30 * impervious, 65, 95);
}

/** SCS Curve Number runoff depth in millimetres. */
export function scsRunoffMm(rainfallMm, curve) {
  const p = Math.max(0, Number(rainfallMm) || 0);
  if (p <= 0) return 0;
  const s = 25400 / curve - 254;
  const initialAbstraction = 0.2 * s;
  if (p <= initialAbstraction) return 0;
  return Number((((p - initialAbstraction) ** 2) / (p + 0.8 * s)).toFixed(3));
}

/**
 * Kirpich time of concentration, in minutes, for a ~500 m urban flow path.
 * A steep cell sheds water faster than a flat one.
 */
export function timeOfConcentrationMinutes(slopeDeg) {
  const slope = Math.max(0.005, Math.tan((Math.max(0, Number(slopeDeg) || 0) * Math.PI) / 180));
  const minutes = 0.0195 * 500 ** 0.77 * slope ** -0.385;
  return clamp(minutes, 10, 180);
}

function rainfallToHorizon(rows, at, currentRainMmHr, durationH) {
  // The forecast rows are already future-only, so every row up to the target
  // is part of the storm. Taking only the last hour would undercount a
  // three-hour accumulation.
  const future = (rows || []).filter((row) => row.time <= at);
  if (future.length) {
    return {
      mm: future.reduce((sum, row) => sum + Math.max(0, Number(row.rainMmHr) || 0), 0),
      source: 'hourly-forecast',
    };
  }
  return {
    mm: Math.max(0, Number(currentRainMmHr) || 0) * durationH,
    source: 'current-rainfall-persistence',
  };
}

function floodPointFor({ minutes, at, rows, currentRainMmHr, cell, terrain, terrainByIndex }) {
  const durationH = Math.max(1, minutes / 60);
  const rain = rainfallToHorizon(rows, at, currentRainMmHr, durationH);
  const antecedentProxyMm = clamp(Math.max(0, Number(currentRainMmHr) || 0) * 2, 0, 15);
  const rainfallMm = rain.mm + antecedentProxyMm;

  const areaM2 = cellArea(cell.h3Index);
  const cn = curveNumber({
    roadCount: terrain?.roadCount ?? cell.context?.roadCount ?? 0,
    floodSusceptibility:
      terrain?.floodSusceptibility ?? cell.context?.floodSusceptibility ?? 0.3,
  });
  const runoffMm = scsRunoffMm(rainfallMm, cn);
  const tcMinutes = timeOfConcentrationMinutes(
    terrain?.slopeDeg ?? cell.context?.slopeDeg ?? 0
  );
  const arrivalFraction = clamp(minutes / tcMinutes, 0.15, 1);
  const localVolumeM3 = (runoffMm / 1000) * areaM2 * arrivalFraction;

  // Upstream donors: higher neighbouring cells in the same city terrain.
  let upstreamVolumeM3 = 0;
  let donors = 0;
  if (terrain && terrainByIndex.size) {
    for (const neighbour of h3.gridDisk(cell.h3Index, 2)) {
      if (neighbour === cell.h3Index) continue;
      const donor = terrainByIndex.get(neighbour);
      if (!donor || !Number.isFinite(donor.elevationM)) continue;
      const rise = donor.elevationM - terrain.elevationM;
      if (rise <= 0.2) continue;

      const donorCn = curveNumber(donor);
      const donorRunoff = scsRunoffMm(rainfallMm, donorCn);
      const donorArea = cellArea(donor.h3Index);
      const weight = clamp(rise / 3, 0.05, 1) * 0.25;
      upstreamVolumeM3 += (donorRunoff / 1000) * donorArea * arrivalFraction * weight;
      donors += 1;
    }
  }

  // Drainage is the weakest input in the model. It is a documented proxy,
  // not a measured drain capacity.
  const floodSusceptibility = Number(
    terrain?.floodSusceptibility ?? cell.context?.floodSusceptibility ?? 0.3
  );
  const drainageCapacityMmHr = 8 + 14 * (1 - clamp(floodSusceptibility, 0, 1));
  const drainedVolumeM3 = (drainageCapacityMmHr / 1000) * areaM2 * durationH;
  const netVolumeM3 = Math.max(0, localVolumeM3 + upstreamVolumeM3 - drainedVolumeM3);
  const cellAverageDepthM = netVolumeM3 / areaM2;
  // Water concentrates in the low points of a cell rather than spreading
  // evenly over all 70 hectares. This factor is a terrain screening term, not
  // a surveyed ponding depth.
  const pondingFactor = 1 + 4 * clamp(floodSusceptibility, 0, 1);
  const depthM = Number(Math.min(2, cellAverageDepthM * pondingFactor).toFixed(3));

  // Two screening signals: runoff that drainage cannot remove, and the
  // resulting local ponding depth. Neither is a calibrated probability.
  const storageDeficitMm = Math.max(0, runoffMm + (upstreamVolumeM3 / areaM2) * 1000 - drainageCapacityMmHr * durationH);
  const runoffProbability = 1 - Math.exp(-storageDeficitMm / 10);
  const depthProbability = depthM <= 0.005 ? 0 : 1 / (1 + Math.exp(-(depthM - 0.08) / 0.05));
  const probability = Number(
    clamp(runoffProbability * (0.55 + 0.45 * floodSusceptibility) + depthProbability * 0.25, 0, 0.95).toFixed(3)
  );
  const terrainFields = [
    terrain?.elevationM,
    terrain?.slopeDeg,
    terrain?.waterDistanceM,
    terrain?.roadCount,
  ].filter((value) => Number.isFinite(Number(value))).length;
  const confidence = Number(
    clamp(0.35 + 0.4 * (terrainFields / 4) + (rows?.length ? 0.15 : 0) + (donors ? 0.1 : 0), 0.35, 0.9).toFixed(2)
  );

  return {
    minutes,
    at: new Date(at),
    probability,
    depthM,
    floodRisk: Number((probability * 10).toFixed(2)),
    runoffMm: Number(runoffMm.toFixed(2)),
    upstreamRunoffMm: Number(((upstreamVolumeM3 / areaM2) * 1000).toFixed(2)),
    rainfallMm: Number(rainfallMm.toFixed(2)),
    rainfallSource: rain.source,
    storageDeficitMm: Number(storageDeficitMm.toFixed(2)),
    pondingFactor: Number(pondingFactor.toFixed(2)),
    antecedentProxyMm: Number(antecedentProxyMm.toFixed(2)),
    curveNumber: cn,
    timeOfConcentrationMinutes: Number(tcMinutes.toFixed(0)),
    drainageCapacityMmHr: Number(drainageCapacityMmHr.toFixed(1)),
    donors,
    confidence,
    method: FLOOD_MODEL_VERSION,
  };
}

/**
 * The screening flood forecast for one cell over the supplied horizons.
 *
 * `cell` is the SpatialCell about to be written; `context` carries its
 * terrain. `rows` is the same hourly weather forecast used by the risk model,
 * so the flood and climate parts cannot disagree about the rain.
 */
export async function buildFloodForecast({
  cityCode,
  h3Index,
  context,
  currentRainMmHr = 0,
  rows = [],
  horizons = [60, 120, 180],
  now = Date.now(),
}) {
  const terrainByIndex = await terrainMapFor(cityCode);
  const terrain = terrainByIndex.get(h3Index) || null;
  const cell = { h3Index, context: context || {} };

  const points = horizons.map((minutes) =>
    floodPointFor({
      minutes,
      at: now + minutes * 60000,
      rows,
      currentRainMmHr,
      cell,
      terrain,
      terrainByIndex,
    })
  );

  const peak = points.reduce(
    (best, point) => (point.floodRisk > best.floodRisk ? point : best),
    points[0]
  );

  return {
    modelVersion: FLOOD_MODEL_VERSION,
    source: 'real-terrain+hourly-rainfall',
    peak: {
      minutes: peak.minutes,
      probability: peak.probability,
      depthM: peak.depthM,
      risk: peak.floodRisk,
      confidence: peak.confidence,
    },
    points,
    assumptions: [
      'Drainage capacity is a terrain-based proxy, not a measured drain capacity.',
      'Antecedent moisture is proxied from current rainfall, not measured soil moisture.',
      'Upstream inflow is a terrain-difference screening estimate, not a routed hydrograph.',
    ],
  };
}
