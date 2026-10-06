import { fetchWeatherForAllCities, getWeatherSnapshot } from './src/services/weatherService.js';
import { generateTransitTelemetryEvents } from './src/services/transitService.js';
import { getConfiguredCityNames } from './src/services/cityConfig.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPipeline() {
  console.log('Testing Open-Meteo + Simulated Transit Pipeline...\n');

  try {
    console.log(`Step 1: Fetching weather for ${getConfiguredCityNames().join(', ')}...`);
    const weatherData = await fetchWeatherForAllCities();

    for (const cityName of Object.keys(weatherData)) {
      if (weatherData[cityName]) {
        const snapshot = getWeatherSnapshot(weatherData[cityName]);
        console.log(`  OK ${cityName}: ${snapshot.temperatureC ?? 'unknown'}C, ${snapshot.rainMmHr ?? 0}mm rain`);
      } else {
        console.log(`  FAILED ${cityName}`);
      }
    }

    console.log('\nStep 2: Generating transit telemetry based on weather...');
    const cityWithWeather = Object.keys(weatherData).find((cityName) => weatherData[cityName]);
    if (!cityWithWeather) {
      throw new Error('No city returned weather data.');
    }

    const transitEvents = generateTransitTelemetryEvents(cityWithWeather, weatherData[cityWithWeather], 5);
    console.log(`  OK Generated ${transitEvents.length} transit events`);
    console.log(`  Sample: Vehicle ${transitEvents[0].vehicleId}, Delay: ${transitEvents[0].delayMins}min`);

    console.log('\nPipeline test successful!');
    console.log('The pipeline is ready to be integrated into the server.');
  } catch (error) {
    console.error('\nPipeline test failed:', error.message);
    process.exit(1);
  }
}

testPipeline();
