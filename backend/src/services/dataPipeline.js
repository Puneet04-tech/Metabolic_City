import { fetchWeatherForAllCities, getWeatherSnapshot, weatherToTelemetry } from './weatherService.js';
import { generateTransitTelemetryEvents } from './transitService.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { processTelemetryToCells, recalculateAllActiveCells, normalizeCoordinates } from '../engine/risk.js';
import { getCity, getConfiguredCityNames } from './cityConfig.js';
import dotenv from 'dotenv';

dotenv.config();

const PIPELINE_CYCLE_MINUTES = parseInt(process.env.PIPELINE_CYCLE_MINUTES) || 10;
let pipelineRunning = false;
let scheduledPipelineHandle = null;

/**
 * Run the data pipeline:
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
    // Step 1: Fetch weather for all cities
    console.log('Fetching weather data for all cities...');
    const weatherData = await fetchWeatherForAllCities();
    
    for (const cityName of Object.keys(weatherData)) {
      if (weatherData[cityName]) {
        const snapshot = getWeatherSnapshot(weatherData[cityName]);
        console.log(`  ${cityName}: ${snapshot.temperatureC ?? 'unknown'}C, ${snapshot.rainMmHr ?? 0}mm rain`);
      } else {
        console.log(`  ${cityName}: Failed to fetch weather`);
      }
    }

    // Step 2: Generate transit telemetry for each city
    console.log('Generating transit telemetry based on weather...');
    const allTelemetryEvents = [];
    const successfulCityCodes = [];
    const failedCities = [];

    for (const cityName of cities) {
      const weather = weatherData[cityName];
      if (!weather) {
        console.log(`  Skipping ${cityName} - no weather data`);
        failedCities.push(cityName);
        continue;
      }

      // Generate weather telemetry
      const weatherEvent = weatherToTelemetry(cityName, weather);
      const cityCoords = getCity(cityName);
      const weatherNorm = normalizeCoordinates(cityCoords.lat, cityCoords.lon);
      Object.assign(weatherEvent, weatherNorm);
      allTelemetryEvents.push(weatherEvent);
      successfulCityCodes.push(cityCoords.code);

      // Generate transit telemetry
      const transitEvents = generateTransitTelemetryEvents(cityName, weather, 30);
      for (const event of transitEvents) {
        const transitNorm = normalizeCoordinates(event.latitude, event.longitude);
        Object.assign(event, transitNorm);
        allTelemetryEvents.push(event);
      }
    }

    console.log(`  Generated ${allTelemetryEvents.length} telemetry events`);
    if (!allTelemetryEvents.length) {
      throw new Error('No weather-backed telemetry was generated; preserving existing telemetry.');
    }

    // Step 3: Replace generated telemetry only for cities fetched successfully.
    console.log('Replacing generated telemetry for successful cities...');
    await TelemetryEvent.deleteMany({
      sourceType: { $in: ['WEATHER_API', 'GTFS_TRANSIT'] },
      cityCode: { $in: successfulCityCodes },
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
    console.log(`[${new Date().toISOString()}] Pipeline ${success ? 'completed successfully' : 'completed with partial weather failures'}`);
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
