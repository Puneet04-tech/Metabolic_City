import { ForecastSnapshot } from '../models/ForecastSnapshot.js';
import { SpatialCell } from '../models/SpatialCell.js';

const BUCKET_MS = 10 * 60 * 1000;
const MAX_TARGET_AGE_MS = 20 * 60 * 1000;
const MISSING_OBSERVATION_AFTER_MS = 60 * 60 * 1000;
let verifierTimer = null;

const round = (value, digits = 2) => Number(value.toFixed(digits));

function bucketFor(date) {
  return new Date(Math.floor(new Date(date).getTime() / BUCKET_MS) * BUCKET_MS);
}

/**
 * Stores the forecast that was actually published for a cell.
 *
 * One document per cell per ten-minute bucket, matching the pipeline cadence.
 * An ingest that recalculates the same cell twice in a bucket updates that
 * forecast rather than creating several copies of it.
 */
export async function recordForecastSnapshot(cell) {
  const points = Array.isArray(cell?.forecast?.points) ? cell.forecast.points : [];
  if (!cell?.h3Index || !points.length) return null;

  const generatedAt = new Date(cell.forecast.generatedAt || Date.now());
  const bucket = bucketFor(generatedAt);
  const document = {
    h3Index: cell.h3Index,
    cityCode: cell.cityCode || null,
    bucket,
    generatedAt,
    source: cell.forecast.source || 'trend+weather',
    modelVersion: cell.forecast.model || process.env.FORECAST_MODEL_VERSION || 'trend-weather-v1',
    points: points.map((point) => ({
      minutes: Number(point.minutes),
      at: new Date(point.at),
      risk: Number(point.risk),
      mobility: Number(point.mobility),
      climate: Number(point.climate),
      rainMmHr: Number(point.rainMmHr) || 0,
      floodRisk: Number(point.floodRisk) || 0,
      floodProbability: Number(point.floodProbability) || 0,
      floodDepthM: Number(point.floodDepthM) || 0,
      actualRisk: null,
      error: null,
      verifiedAt: null,
      verification: 'PENDING',
    })),
  };

  try {
    return await ForecastSnapshot.findOneAndUpdate(
      { h3Index: cell.h3Index, bucket },
      { $set: document },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

/**
 * Scores every forecast point whose target time has arrived.
 *
 * A point is only scored when the cell has an observation close to the target
 * time. Otherwise it is marked as unverifiable, rather than comparing a
 * three-hour-old forecast with a reading from a different part of the day.
 */
export async function verifyDueForecasts({ now = new Date(), limit = 250 } = {}) {
  const due = await ForecastSnapshot.find({
    'points.at': { $lte: now },
    'points.verification': 'PENDING',
  })
    .sort({ generatedAt: 1 })
    .limit(limit);

  let verified = 0;
  let unverifiable = 0;

  for (const snapshot of due) {
    const cell = await SpatialCell.findOne({ h3Index: snapshot.h3Index }).lean();
    let changed = false;

    for (const point of snapshot.points) {
      if (point.verification !== 'PENDING' || !point.at || point.at > now) continue;

      const targetAge = cell?.lastUpdated
        ? Math.abs(new Date(cell.lastUpdated).getTime() - new Date(point.at).getTime())
        : Infinity;

      if (cell && targetAge <= MAX_TARGET_AGE_MS) {
        point.actualRisk = Number(cell.compositeRisk);
        point.error = round(point.risk - point.actualRisk);
        point.verifiedAt = now;
        point.verification = 'VERIFIED';
        verified += 1;
        changed = true;
      } else if (now - new Date(point.at).getTime() > MISSING_OBSERVATION_AFTER_MS) {
        point.actualRisk = null;
        point.error = null;
        point.verifiedAt = now;
        point.verification = 'NO_OBSERVATION_AT_TARGET';
        unverifiable += 1;
        changed = true;
      }
    }

    if (changed) await snapshot.save();
  }

  return { verified, unverifiable, checked: due.length };
}

/**
 * A historical benchmark that exists before the first live forecast matures.
 *
 * It is persistence, not the live model: the previous observed risk is used as
 * the prediction for the next stored observation. Calling it a model score
 * would be dishonest, so it is returned separately as a baseline.
 */
export function summarizeHistoryBaseline(cells) {
  const errors = [];
  const leads = [];

  for (const cell of cells || []) {
    const history = (Array.isArray(cell.history) ? cell.history : [])
      .filter((entry) => Number.isFinite(Number(entry?.compositeRisk)) && entry?.calculatedAt)
      .sort((left, right) => new Date(left.calculatedAt) - new Date(right.calculatedAt));

    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1];
      const actual = history[index];
      const leadMinutes =
        (new Date(actual.calculatedAt).getTime() - new Date(previous.calculatedAt).getTime()) /
        60000;
      if (!(leadMinutes > 0) || leadMinutes > 180) continue;
      errors.push(Number(previous.compositeRisk) - Number(actual.compositeRisk));
      leads.push(leadMinutes);
    }
  }

  if (!errors.length) {
    return {
      method: 'persistence',
      samples: 0,
      mae: null,
      rmse: null,
      bias: null,
      medianLeadMinutes: null,
      changedPairs: 0,
      changedShare: null,
    };
  }

  const absolute = errors.map(Math.abs);
  const changedPairs = errors.filter((value) => Math.abs(value) > 0.01).length;
  leads.sort((left, right) => left - right);
  return {
    method: 'persistence-on-stored-cell-history',
    samples: errors.length,
    mae: round(absolute.reduce((sum, value) => sum + value, 0) / errors.length),
    rmse: round(Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length)),
    bias: round(errors.reduce((sum, value) => sum + value, 0) / errors.length),
    medianLeadMinutes: round(leads[Math.floor(leads.length / 2)], 1),
    changedPairs,
    changedShare: round(changedPairs / errors.length, 3),
  };
}

export async function getHistoricalBaseline({ hours = 24, cityCode = null } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(hours)) * 60 * 60 * 1000);
  const query = { lastUpdated: { $gte: since } };
  if (cityCode) query.cityCode = cityCode;
  const cells = await SpatialCell.find(query, { history: 1, cityCode: 1 }).lean();
  return summarizeHistoryBaseline(cells);
}

export function summarizeForecastPoints(points) {
  const scored = (points || []).filter(
    (point) => point?.verification === 'VERIFIED' && Number.isFinite(Number(point.error))
  );

  const summarize = (rows) => {
    if (!rows.length) return { samples: 0, mae: null, rmse: null, bias: null };
    const errors = rows.map((row) => Number(row.error));
    const absolute = errors.map(Math.abs);
    return {
      samples: rows.length,
      mae: round(absolute.reduce((sum, value) => sum + value, 0) / rows.length),
      rmse: round(Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / rows.length)),
      bias: round(errors.reduce((sum, value) => sum + value, 0) / rows.length),
    };
  };

  const byHorizon = {};
  for (const point of scored) {
    const key = String(point.minutes);
    if (!byHorizon[key]) byHorizon[key] = [];
    byHorizon[key].push(point);
  }

  return {
    ...summarize(scored),
    byHorizon: Object.fromEntries(
      Object.entries(byHorizon)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([minutes, rows]) => [minutes, summarize(rows)])
    ),
  };
}

export async function getForecastAccuracy({ hours = 24, cityCode = null } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(hours)) * 60 * 60 * 1000);
  const query = {
    generatedAt: { $gte: since },
    'points.at': { $lte: new Date() },
  };
  if (cityCode) query.cityCode = cityCode;

  const latestQuery = cityCode ? { cityCode } : {};
  const [snapshots, latestSnapshot, historicalBaseline] = await Promise.all([
    ForecastSnapshot.find(query).sort({ generatedAt: -1 }).lean(),
    ForecastSnapshot.findOne(latestQuery, { modelVersion: 1, generatedAt: 1 })
      .sort({ generatedAt: -1 })
      .lean(),
    getHistoricalBaseline({ hours, cityCode }),
  ]);
  const points = snapshots.flatMap((snapshot) => snapshot.points || []);
  const scheduled = points.filter((point) => point.at && point.at <= new Date()).length;
  const summary = summarizeForecastPoints(points);

  return {
    periodHours: Number(hours),
    generatedAt: new Date().toISOString(),
    modelVersion:
      latestSnapshot?.modelVersion ||
      snapshots.find((snapshot) => snapshot.modelVersion)?.modelVersion ||
      process.env.FORECAST_MODEL_VERSION ||
      'trend-weather-v1',
    scheduledPoints: scheduled,
    scoredPoints: summary.samples,
    coverage: scheduled ? round(summary.samples / scheduled, 3) : 0,
    ...summary,
    historicalBaseline,
    note:
      'Live points compare the published forecast with the next cell snapshot near the target time. ' +
      'The historical baseline is persistence on stored cell history, not the live model. ' +
      'Neither measures whether a disaster occurred.',
  };
}

export function startForecastVerifier() {
  if (verifierTimer) return;
  const intervalMs = Number(process.env.FORECAST_VERIFY_INTERVAL_MS || 5 * 60 * 1000);

  const run = () => {
    verifyDueForecasts().catch((error) =>
      console.error('[forecast] Verification run failed:', error.message)
    );
  };

  run();
  verifierTimer = setInterval(run, intervalMs);
  console.log(`[forecast] Verification active (check interval: ${intervalMs / 1000}s).`);
}

export function stopForecastVerifier() {
  if (verifierTimer) {
    clearInterval(verifierTimer);
    verifierTimer = null;
  }
}
