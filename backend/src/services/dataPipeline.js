import { fetchWeatherForAllCities, fetchWeatherObservations, getWeatherSnapshot, weatherToTelemetry } from './weatherService.js';
import { generateTransitTelemetryEvents } from './transitService.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { processTelemetryToCells, recalculateAllActiveCells, normalizeCoordinates, H3_RESOLUTION } from '../engine/risk.js';
import { getCity, getConfiguredCityNames } from './cityConfig.js';
import { getCityStops } from './staticGTFSData.js';
import { buildAnchorPoints, interpolateSnapshot } from './spatialInterpolation.js';
import { fetchCityNetwork, saveCityNetwork, getCityNetworkCells } from './osmService.js';
import { buildCityTerrain, getCityTerrain, terrainToTelemetry } from './terrainService.js';
import { fetchCityTraffic, fetchCityIncidents, trafficProviderConfigured } from './trafficService.js';
import * as h3 from 'h3-js';
import dotenv from 'dotenv';

dotenv.config();

const PIPELINE_CYCLE_MINUTES = parseInt(process.env.PIPELINE_CYCLE_MINUTES) || 10;
const COVERAGE_RING = Number(process.env.WEATHER_COVERAGE_RING ?? 1);
const SIMULATION_ENABLED = process.env.TRANSIT_SIMULATION_ENABLED === 'true';
const NETWORK_REFRESH_DAYS = Number(process.env.OSM_NETWORK_REFRESH_DAYS ?? 30);
let pipelineRunning = false;
let scheduledPipelineHandle = null;

const h3ToLatLng = h3.cellToLatLng || h3.h3ToGeo;
const h3Disk = h3.gridDisk || h3.kRing;
const h3IndexOf = h3.latLngToCell || h3.geoToH3;

/**
 * The cells a city needs weather for.
 *
 * The cells that hold a transit stop, the cells around them, and the centre
 * of the city. Anchoring the coverage on the stops means every cell that
 * carries a mobility signal also carries a climate signal, so the two are
 * measured over the same ground.
 */
export function buildCoverageCells(cityName, centerH3Index) {
  const cells = new Map();

  const add = (h3Index) => {
    if (!h3Index || cells.has(h3Index)) return;
    const [latitude, longitude] = h3ToLatLng(h3Index);
    cells.set(h3Index, { h3Index, latitude, longitude });
  };

  add(centerH3Index);

  for (const stop of getCityStops(cityName)) {
    const stopIndex = h3IndexOf(stop.stopLat, stop.stopLon, H3_RESOLUTION);
    if (!stopIndex) continue;
    add(stopIndex);
    for (const neighbour of h3Disk(stopIndex, COVERAGE_RING)) add(neighbour);
  }

  return [...cells.values()];
}

/**
 * The cells of a city, taken from the real streets it has.
 *
 * When the road network has been downloaded, a cell exists because there is
 * a real street in it. Only if the network is missing does the coverage
 * fall back to the cells around the transit stops.
 */
async function resolveCoverageCells(cityName) {
  const networkCells = await getCityNetworkCells(cityName);
  if (networkCells.length) {
    return { cells: networkCells, source: 'osm-road-network' };
  }

  const cityCoords = getCity(cityName);
  const centerH3 = h3IndexOf(cityCoords.lat, cityCoords.lon, H3_RESOLUTION);
  return { cells: buildCoverageCells(cityName, centerH3), source: 'transit-stop-fallback' };
}

/**
 * Downloads the real road and water network of a city if it is not already
 * cached, or if the cache has gone stale.
 */
async function ensureNetwork(cityName) {
  const existing = await getCityNetworkCells(cityName);
  if (existing.length) {
    const segments = existing.flatMap((cell) => cell.segments);
    const newest = segments.reduce(
      (latest, segment) =>
        !latest || new Date(segment.fetchedAt) > new Date(latest.fetchedAt) ? segment : latest,
      null
    );
    if (newest) {
      const ageDays = (Date.now() - new Date(newest.fetchedAt).getTime()) / 86400000;
      if (ageDays < NETWORK_REFRESH_DAYS) {
        return { downloaded: false, cells: existing.length };
      }
    }
  }

  console.log(`  ${cityName}: downloading the real road network from OpenStreetMap...`);
  const network = await fetchCityNetwork(cityName, {
    radiusDeg: Number(process.env.OSM_NETWORK_RADIUS_DEG ?? 0.08),
    onProgress: ({ done, tiles }) => {
      if (done % 50 === 0) console.log(`    ${done} features, ${tiles} tiles`);
    },
  });
  const saved = await saveCityNetwork(cityName, network);
  console.log(
    `  ${cityName}: stored ${saved} real road segments and ${network.waters.length} watercourses`
  );
  return { downloaded: true, cells: saved, failedTiles: network.failedTiles };
}

/**
 * Builds the terrain of a city if it is not already known.
 *
 * The terrain is rebuilt whenever the street network underneath it has
 * changed, because new streets mean new cells that need their own ground.
 */
async function ensureTerrain(cityName, { force = false } = {}) {
  const existing = await getCityTerrain(cityName);
  if (existing.length && !force) return { cells: existing, rebuilt: false };

  console.log(`  ${cityName}: building the real terrain...`);
  const terrain = await buildCityTerrain(cityName);
  console.log(
    `  ${cityName}: ${terrain.cells?.length || 0} cells, ${
      terrain.lowest ?? '?'
    }-${terrain.highest ?? '?'}m, ${terrain.suspended ?? 0} flood-exposed`
  );
  return { cells: terrain.cells || [], rebuilt: true };
}

/**
 * Run the data pipeline with retry logic and partial success handling
 * 1. Fetch weather for all cities
 * 2. Generate transit telemetry based on weather
 * 3. Process telemetry into spatial cells
 * 4. Recalculate cell risks
 */
export async function runDataPipeline() {
  if (pipelineRunning) {
    console.warn('[pipeline] Previous data pipeline run is still active; skipping this cycle.');
    return { success: false, skipped: true, error: 'Pipeline already running.' };
  }

  pipelineRunning = true;
  console.log(`\n[${new Date().toISOString()}] Starting data pipeline...`);

  try {
    const cities = getConfiguredCityNames();
    
    // Step 1: Fetch weather for all cities with retry logic
    console.log('Fetching weather data for all cities...');
    let weatherData;
    let weatherRetryCount = 0;
    const maxWeatherRetries = 3;
    
    while (weatherRetryCount < maxWeatherRetries) {
      try {
        weatherData = await fetchWeatherForAllCities();
        const successfulCities = Object.keys(weatherData).filter(city => weatherData[city] !== null);
        if (successfulCities.length > 0) {
          console.log(`[pipeline] Weather fetch successful for ${successfulCities.length}/${cities.length} cities`);
          break;
        }
        weatherRetryCount++;
        if (weatherRetryCount < maxWeatherRetries) {
          console.log(`[pipeline] Weather fetch attempt ${weatherRetryCount + 1} failed, retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        weatherRetryCount++;
        console.error(`[pipeline] Weather fetch attempt ${weatherRetryCount + 1} failed:`, error.message);
        if (weatherRetryCount < maxWeatherRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    if (!weatherData || Object.keys(weatherData).filter(city => weatherData[city] !== null).length === 0) {
      console.warn('[pipeline] All weather fetch attempts failed, using synthetic fallback');
      weatherData = {};
      for (const cityName of cities) {
        weatherData[cityName] = null; // Will trigger synthetic fallback in transit generation
      }
    }
    
    for (const cityName of Object.keys(weatherData)) {
      const cityCoords = getCity(cityName);
      if (!cityCoords) continue;
      const snapshot = weatherData[cityName] ? getWeatherSnapshot(weatherData[cityName]) : null;
      const isSynthetic = weatherData[cityName]?.synthetic || false;
      console.log(
        `  ${cityName}: ${snapshot?.temperatureC ?? 'unknown'}C, ${snapshot?.rainMmHr ?? 0}mm rain${isSynthetic ? ' (synthetic)' : ''}`
      );
    }

    // Step 2: Gather the real observations for each city.
    console.log('Gathering real observations...');
    const allTelemetryEvents = [];
    const successfulCityCodes = [];
    const failedCities = [];

    for (const cityName of cities) {
      const weather = weatherData[cityName];
      if (!weather) {
        console.log(`  Skipping ${cityName} - no weather data (synthetic fallback disabled)`);
        failedCities.push(cityName);
        continue;
      }
      if (weather.synthetic && !process.env.WEATHER_SYNTHETIC_FALLBACK_ENABLED) {
        console.log(`  Skipping ${cityName} - synthetic data not allowed (fallback disabled)`);
        failedCities.push(cityName);
        continue;
      }

      const cityCoords = getCity(cityName);
      const actualWeather = weather;

      // Step 2a: the real street network of the city. This decides which
      // cells exist: a cell exists because there is a real street in it.
      const network = await ensureNetwork(cityName);
      const { cells: coverageCells, source: coverageSource } =
        await resolveCoverageCells(cityName);
      console.log(`  ${cityName}: ${coverageCells.length} cells (${coverageSource})`);

      // Step 2b: the real terrain of those cells: elevation, slope and how
      // close each one is to a real watercourse. It is rebuilt when the
      // street network underneath it has changed.
      const { cells: terrainCells } = await ensureTerrain(cityName, {
        force: network.downloaded,
      });
      for (const terrain of terrainCells) {
        allTelemetryEvents.push(terrainToTelemetry(terrain));
      }

      // Step 2c: real weather observations spread across the city, then
      // interpolated so every cell gets its own reading. The spread follows
      // the real extent of the city, not a fixed radius.
      const anchorPoints = buildAnchorPoints(
        cityCoords,
        coverageCells.map((cell) => ({ latitude: cell.latitude, longitude: cell.longitude }))
      );
      const extraPoints = anchorPoints.filter((point) => point.key !== 'centre');

      const observations = [
        {
          key: 'centre',
          latitude: cityCoords.lat,
          longitude: cityCoords.lon,
          data: actualWeather,
          values: getWeatherSnapshot(actualWeather),
        },
      ];
      if (extraPoints.length) {
        observations.push(...(await fetchWeatherObservations(extraPoints)));
      }

      const cellWeather = new Map();
      for (const cell of coverageCells) {
        const snapshot = interpolateSnapshot(observations, cell);
        if (!snapshot) continue;

        allTelemetryEvents.push(
          weatherToTelemetry(cityName, actualWeather, {
            h3Index: cell.h3Index,
            latitude: cell.latitude,
            longitude: cell.longitude,
            values: snapshot.values,
            provenance: {
              interpolation: {
                method: 'inverse-distance-weighted',
                observations: observations.map((observation) => ({
                  key: observation.key,
                  latitude: observation.latitude,
                  longitude: observation.longitude,
                })),
                nearestDistanceKm: Number(snapshot.nearestDistanceKm.toFixed(3)),
                exact: snapshot.exact,
              },
            },
          })
        );
        cellWeather.set(cell.h3Index, snapshot.values);
      }
      console.log(`  ${cityName}: weather for ${cellWeather.size} cells`);

      // Step 2d: the real traffic on those roads, when a provider is set up.
      if (trafficProviderConfigured()) {
        const traffic = await fetchCityTraffic(cityName, {
          maxProbes: Number(process.env.TRAFFIC_PROBES_PER_CITY ?? 60),
        });
        allTelemetryEvents.push(...traffic.events);

        const incidents = await fetchCityIncidents(cityName, {
          maxProbes: Number(process.env.TRAFFIC_PROBES_PER_CITY ?? 60),
        });
        allTelemetryEvents.push(...incidents.events);

        console.log(
          `  ${cityName}: ${traffic.events.length} road speed readings, ${incidents.events.length} incidents`
        );
      } else {
        console.log(
          `  ${cityName}: no traffic provider configured - mobility will be reported as missing rather than invented`
        );
      }

      // Step 2e: the simulated transit, only when it is asked for. It is off
      // by default because a modelled bus delay is not a measurement.
      if (SIMULATION_ENABLED) {
        const transitEvents = generateTransitTelemetryEvents(cityName, actualWeather, 30, {
          weatherForCell: (h3Index) => cellWeather.get(h3Index) || null,
          pipelineGenerated: true,
        });
        for (const event of transitEvents) {
          Object.assign(event, normalizeCoordinates(event.latitude, event.longitude));
          allTelemetryEvents.push(event);
        }
        console.log(`  ${cityName}: ${transitEvents.length} simulated transit events`);
      }

      successfulCityCodes.push(cityCoords.code);
    }

    console.log(`  Generated ${allTelemetryEvents.length} telemetry events`);
    if (!allTelemetryEvents.length) {
      throw new Error('No telemetry was generated; preserving existing telemetry.');
    }

    // Step 3: Replace only the telemetry this pipeline generated.
    // The pollers write real observations into the same collections, and
    // those must survive: they are per-point readings that the city cannot
    // be interpolated from any better.
    console.log('Replacing generated telemetry for successful cities...');
    await TelemetryEvent.deleteMany({
      sourceType: { $in: ['WEATHER_API', 'GTFS_TRANSIT', 'GIS_STATIC'] },
      cityCode: { $in: successfulCityCodes },
      'rawPayload.pipelineGenerated': true,
    });

    console.log('Inserting new telemetry events...');
    await TelemetryEvent.insertMany(allTelemetryEvents);

    // Step 4: Process telemetry into spatial cells
    console.log('Processing telemetry into spatial cells...');
    const processedCells = await processTelemetryToCells();

    console.log(`  Processed ${processedCells.length} spatial cells`);

    // Step 5: Recalculate cell risks
    console.log('Recalculating cell risks...');
    const recalculatedCells = await recalculateAllActiveCells();

    console.log(`  Recalculated ${recalculatedCells.length} cells`);

    const success = failedCities.length === 0;
    console.log(
      `[${new Date().toISOString()}] Pipeline ${success ? 'completed successfully' : 'completed with partial failures'}`
    );
    console.log(`Summary: ${successfulCityCodes.length}/${cities.length} cities, ${allTelemetryEvents.length} events, ${recalculatedCells.length} cells`);

    return {
      success,
      partial: !success,
      cities,
      failedCities,
      eventsCount: allTelemetryEvents.length,
      cellsCount: recalculatedCells.length,
    };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Pipeline failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    pipelineRunning = false;
  }
}

/**
 * Start the scheduled pipeline
 */
export function startScheduledPipeline() {
  if (process.env.PIPELINE_ENABLED !== 'true') {
    console.log('Pipeline is disabled. Set PIPELINE_ENABLED=true in .env to enable.');
    return;
  }

  if (scheduledPipelineHandle) {
    console.log('Scheduled pipeline is already running.');
    return;
  }

  console.log(`Starting scheduled pipeline (cycle: ${PIPELINE_CYCLE_MINUTES} minutes)...`);

  // Run immediately
  runDataPipeline();

  // Schedule runs
  const intervalMs = PIPELINE_CYCLE_MINUTES * 60 * 1000;
  scheduledPipelineHandle = setInterval(runDataPipeline, intervalMs);

  console.log(`Pipeline will run every ${PIPELINE_CYCLE_MINUTES} minutes`);
}

export function stopScheduledPipeline() {
  if (scheduledPipelineHandle) {
    clearInterval(scheduledPipelineHandle);
    scheduledPipelineHandle = null;
  }
}

// Run pipeline if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDataPipeline()
    .then((result) => {
      console.log('\nResult:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
