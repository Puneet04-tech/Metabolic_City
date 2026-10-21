import { TerrainCell } from '../models/TerrainCell.js';
import { getCity } from './cityConfig.js';
import { getCityNetworkCells, metresBetween } from './osmService.js';
import * as h3 from 'h3-js';

const h3IndexOf = h3.latLngToCell || h3.geoToH3;

/**
 * The elevation model. Free, no key, and it answers for a whole list of
 * points in one request.
 */
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

/**
 * Fetches the real elevation of a set of points.
 *
 * The API takes a comma-separated list of coordinates and answers with a
 * list of heights, so a whole city is one request.
 */
export async function fetchElevations(points) {
  if (!points.length) return [];

  const url = new URL(ELEVATION_URL);
  url.searchParams.set('latitude', points.map((point) => point.latitude).join(','));
  url.searchParams.set('longitude', points.map((point) => point.longitude).join(','));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MetabolicCity/1.0 (urban risk operations)' },
    });
    if (!response.ok) {
      throw new Error(`Elevation API returned ${response.status}`);
    }
    const body = await response.json();
    const elevations = body.elevation || [];
    if (elevations.length !== points.length) {
      throw new Error(
        `Elevation API returned ${elevations.length} values for ${points.length} points`
      );
    }
    return points.map((point, index) => ({
      ...point,
      elevationM: Number(elevations[index]),
    }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How much a road class matters when choosing the street that names a cell.
 */
const ROAD_IMPORTANCE = {
  motorway: 6,
  trunk: 5,
  primary: 4,
  secondary: 3,
  tertiary: 2,
  unclassified: 1,
  residential: 1,
  living_street: 1,
  service: 0,
};

const roadImportance = (highway) => ROAD_IMPORTANCE[highway] ?? 0;

/**
 * How far a cell is from the lowest ground in the city, and how steep the
 * ground around it is.
 */
function measureRelief(cells) {
  const elevations = cells.map((cell) => cell.elevationM);
  const lowest = Math.min(...elevations);
  const highest = Math.max(...elevations);
  const span = Math.max(1, highest - lowest);

  for (const cell of cells) {
    cell.reliefM = Number((cell.elevationM - lowest).toFixed(1));
    cell.relativeHeight = (cell.elevationM - lowest) / span;
  }

  // Slope from the steepest neighbour within one cell.
  const byIndex = new Map(cells.map((cell) => [cell.h3Index, cell]));
  for (const cell of cells) {
    let steepest = 0;
    for (const neighbour of h3.gridDisk(cell.h3Index, 1)) {
      const other = byIndex.get(neighbour);
      if (!other) continue;
      const distance = metresBetween(cell, other);
      if (distance < 1) continue;
      const gradient = Math.atan(Math.abs(other.elevationM - cell.elevationM) / distance);
      steepest = Math.max(steepest, (gradient * 180) / Math.PI);
    }
    cell.slopeDeg = Number(steepest.toFixed(2));
  }

  return { lowest, highest, span };
}

/**
 * How exposed a cell is to ponding.
 *
 * Three real facts decide it: how low the ground is against the rest of the
 * city, how steep it is (flat ground ponds, steep ground sheds), and how
 * close the nearest real watercourse is. The result is a number from 0 to 10
 * that says how likely this cell is to hold water, before any rain falls.
 */
export function floodSusceptibility({ relativeHeight, slopeDeg, waterDistanceM }) {
  // Low ground scores high. The bottom quarter of the city is the wettest.
  const lowGround = Math.max(0, Math.min(1, (0.35 - relativeHeight) / 0.35)) * 0.45;

  // Flat ground holds water; a slope of 8 degrees is enough to shed it.
  const flat = Math.max(0, Math.min(1, (8 - slopeDeg) / 8)) * 0.2;

  // Being near a real river is the strongest single clue.
  let nearWater = 0;
  if (Number.isFinite(waterDistanceM)) {
    nearWater = Math.max(0, Math.min(1, (600 - waterDistanceM) / 600)) * 0.35;
  }

  return Number((lowGround + flat + nearWater).toFixed(2));
}

/**
 * Builds the terrain of every cell that holds a real street.
 *
 * The result is cached, because the ground does not change between cycles.
 */
export async function buildCityTerrain(cityName) {
  const city = getCity(cityName);
  const networkCells = await getCityNetworkCells(cityName);
  if (!networkCells.length) {
    return { cells: [], skipped: 'no road network cached for this city' };
  }

  const withElevation = await fetchElevations(
    networkCells.map((cell) => ({ latitude: cell.latitude, longitude: cell.longitude }))
  );

  const cells = networkCells.map((cell, index) => {
    const elevation = withElevation[index];
    const nearestWater = cell.segments
      .filter((segment) => Number.isFinite(segment.waterwayDistanceM))
      .sort((a, b) => a.waterwayDistanceM - b.waterwayDistanceM)[0];

    // The named streets in this cell, most important first. This is what
    // tells an operator which real place the cell is.
    const roadNames = [
      ...new Set(
        cell.segments
          .filter((segment) => segment.name)
          .sort((a, b) => roadImportance(b.highway) - roadImportance(a.highway))
          .map((segment) => segment.name)
      ),
    ].slice(0, 3);

    return {
      cityCode: city.code,
      h3Index: cell.h3Index,
      latitude: cell.latitude,
      longitude: cell.longitude,
      elevationM: elevation.elevationM,
      waterDistanceM: nearestWater ? nearestWater.waterwayDistanceM : null,
      waterwayName: nearestWater ? nearestWater.waterwayName : '',
      roadCount: cell.roadCount,
      roadClasses: cell.roadClasses,
      roadNames,
    };
  });

  const { lowest, highest } = measureRelief(cells);

  for (const cell of cells) {
    cell.floodSusceptibility = floodSusceptibility({
      relativeHeight: cell.relativeHeight,
      slopeDeg: cell.slopeDeg,
      waterDistanceM: cell.waterDistanceM,
    });
  }

  await TerrainCell.deleteMany({ cityCode: city.code });
  await TerrainCell.insertMany(cells, { ordered: false });

  return {
    cells,
    lowest,
    highest,
    suspended: cells.filter((cell) => cell.floodSusceptibility >= 0.5).length,
  };
}

/**
 * The stored terrain of a city.
 */
export async function getCityTerrain(cityName) {
  const city = getCity(cityName);
  if (!city) return [];
  return TerrainCell.find({ cityCode: city.code }).lean();
}

/**
 * The terrain as telemetry events.
 *
 * This is the real, static part of the risk: how exposed a cell is to
 * ponding, independent of the weather at that moment.
 */
export function terrainToTelemetry(terrain) {
  return {
    sourceType: 'GIS_STATIC',
    h3Index: terrain.h3Index,
    latitude: terrain.latitude,
    longitude: terrain.longitude,
    cityCode: terrain.cityCode,
    observedAt: new Date(),
    vulnerabilityScore: Number((terrain.floodSusceptibility * 1.6).toFixed(2)),
    rawPayload: {
      source: 'open-meteo-elevation+osm',
      pipelineGenerated: true,
      elevationM: terrain.elevationM,
      reliefM: terrain.reliefM,
      slopeDeg: terrain.slopeDeg,
      waterDistanceM: terrain.waterDistanceM,
      waterwayName: terrain.waterwayName,
      roadCount: terrain.roadCount,
      roadClasses: terrain.roadClasses,
      roadNames: terrain.roadNames || [],
      floodSusceptibility: terrain.floodSusceptibility,
    },
  };
}
