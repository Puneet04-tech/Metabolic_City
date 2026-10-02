import { fetchWeatherForAllCities, weatherToTelemetry } from './weatherService.js';
import { generateTransitTelemetryEvents } from './transitService.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { processTelemetryToCells } from '../engine/risk.js';
import dotenv from 'dotenv';

dotenv.config();

const CITIES = ['bhopal', 'indore', 'sehore'];
const PIPELINE_CYCLE_MINUTES = parseInt(process.env.PIPELINE_CYCLE_MINUTES) || 10;

/**
 * Run the data pipeline:
 * 1. Fetch weather for all cities
 * 2. Generate transit telemetry based on weather
 * 3. Process telemetry into spatial cells
 * 4. Recalculate cell risks
 */
export async function runDataPipeline() {
  console.log(`\n[${new Date().toISOString()}] Starting data pipeline...`);

  try {
    // Step 1: Fetch weather for all cities
    console.log('Fetching weather data for all cities...');
    const weatherData = await fetchWeatherForAllCities();
    
    for (const cityName of Object.keys(weatherData)) {
      if (weatherData[cityName]) {
        console.log(`  ${cityName}: ${weatherData[cityName].current_weather.temperature}°C, ${weatherData[cityName].current_weather.precipitation}mm rain`);
      } else {
        console.log(`  ${cityName}: Failed to fetch weather`);
      }
    }

    // Step 2: Generate transit telemetry for each city
    console.log('Generating transit telemetry based on weather...');
    const allTelemetryEvents = [];

    for (const cityName of CITIES) {
      const weather = weatherData[cityName];
      if (!weather) {
        console.log(`  Skipping ${cityName} - no weather data`);
        continue;
      }

      // Generate weather telemetry
      const weatherEvent = weatherToTelemetry(cityName, weather);
      allTelemetryEvents.push(weatherEvent);

      // Generate transit telemetry
      const transitEvents = generateTransitTelemetryEvents(cityName, weather, 30);
      allTelemetryEvents.push(...transitEvents);
    }

    console.log(`  Generated ${allTelemetryEvents.length} telemetry events`);

    // Step 3: Clear existing telemetry and insert new events
    console.log('Clearing existing telemetry events...');
    await TelemetryEvent.deleteMany({});

    console.log('Inserting new telemetry events...');
    await TelemetryEvent.insertMany(allTelemetryEvents);

    // Step 4: Process telemetry into spatial cells
    console.log('Processing telemetry into spatial cells...');
    const processedCells = await processTelemetryToCells();

    console.log(`  Processed ${processedCells.length} spatial cells`);

    // Step 5: Recalculate cell risks
    console.log('Recalculating cell risks...');
    const { recalculateAllActiveCells } = await import('../engine/risk.js');
    const recalculatedCells = await recalculateAllActiveCells();

    console.log(`  Recalculated ${recalculatedCells.length} cells`);

    console.log(`[${new Date().toISOString()}] Pipeline completed successfully`);
    console.log(`Summary: ${CITIES.length} cities, ${allTelemetryEvents.length} events, ${recalculatedCells.length} cells`);

    return {
      success: true,
      cities: CITIES,
      eventsCount: allTelemetryEvents.length,
      cellsCount: recalculatedCells.length,
    };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Pipeline failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
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

  console.log(`Starting scheduled pipeline (cycle: ${PIPELINE_CYCLE_MINUTES} minutes)...`);

  // Run immediately
  runDataPipeline();

  // Schedule runs
  const intervalMs = PIPELINE_CYCLE_MINUTES * 60 * 1000;
  setInterval(runDataPipeline, intervalMs);

  console.log(`Pipeline will run every ${PIPELINE_CYCLE_MINUTES} minutes`);
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
