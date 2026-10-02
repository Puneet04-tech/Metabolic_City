import { fetchWeatherForAllCities } from './src/services/weatherService.js';
import { generateTransitTelemetryEvents } from './src/services/transitService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPipeline() {
  console.log('Testing Open-Meteo + Simulated Transit Pipeline...\n');

  try {
    // Test 1: Fetch weather for all cities
    console.log('Step 1: Fetching weather for Bhopal, Indore, Sehore...');
    const weatherData = await fetchWeatherForAllCities();
    
    for (const cityName of Object.keys(weatherData)) {
      if (weatherData[cityName]) {
        const temp = weatherData[cityName].current_weather.temperature;
        const rain = weatherData[cityName].current_weather.precipitation;
        console.log(`  ✅ ${cityName}: ${temp}°C, ${rain}mm rain`);
      } else {
        console.log(`  ❌ ${cityName}: Failed`);
      }
    }

    // Test 2: Generate transit telemetry
    console.log('\nStep 2: Generating transit telemetry based on weather...');
    const transitEvents = generateTransitTelemetryEvents('bhopal', weatherData.bhopal, 5);
    console.log(`  ✅ Generated ${transitEvents.length} transit events`);
    console.log(`  Sample: Vehicle ${transitEvents[0].vehicleId}, Delay: ${transitEvents[0].delayMins}min`);

    console.log('\n✅ Pipeline test successful!');
    console.log('The pipeline is ready to be integrated into the server.');

  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error.message);
    process.exit(1);
  }
}

testPipeline();
