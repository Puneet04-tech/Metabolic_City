import { generateTransitTelemetryEvents } from './src/services/transitService.js';
import { fetchWeatherForAllCities } from './src/services/weatherService.js';
import { getCityGTFSData } from './src/services/staticGTFSData.js';
import dotenv from 'dotenv';

dotenv.config();

async function testGTFSIntegration() {
  console.log('Testing GTFS Static Data + Weather Simulation...\n');

  try {
    // Test 1: Fetch weather
    console.log('Step 1: Fetching weather...');
    const weatherData = await fetchWeatherForAllCities();
    console.log(`  ✅ Weather fetched for ${Object.keys(weatherData).length} cities`);

    // Test 2: Generate transit telemetry with GTFS data
    console.log('\nStep 2: Generating transit telemetry with GTFS data...');
    const transitEvents = generateTransitTelemetryEvents('bhopal', weatherData.bhopal, 5);
    console.log(`  ✅ Generated ${transitEvents.length} transit events`);
    
    if (transitEvents.length > 0) {
      const sample = transitEvents[0];
      console.log(`  Sample Event:`);
      console.log(`    Vehicle: ${sample.vehicleId}`);
      console.log(`    Route: ${sample.routeId} - ${sample.routeName}`);
      console.log(`    Stop: ${sample.stopId} - ${sample.stopName}`);
      console.log(`    Location: ${sample.latitude}, ${sample.longitude}`);
      console.log(`    Delay: ${sample.delayMins}min`);
      console.log(`    Speed Reduction: ${sample.speedReductionPct}%`);
    }

    // Test 3: Check GTFS data structure
    console.log('\nStep 3: Checking GTFS data structure...');
    
    for (const cityName of ['bhopal', 'indore', 'sehore']) {
      const cityData = getCityGTFSData(cityName);
      console.log(`  ${cityName}:`);
      console.log(`    Routes: ${cityData.routes.length}`);
      console.log(`    Stops: ${cityData.stops.length}`);
    }

    console.log('\n✅ GTFS integration test successful!');
    console.log('The system now uses real route and stop data with weather-based delays.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testGTFSIntegration();
