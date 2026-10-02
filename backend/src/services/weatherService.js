import dotenv from 'dotenv';

dotenv.config();

const OPENMETEO_BASE_URL = process.env.OPENMETEO_BASE_URL || 'https://api.open-meteo.com/v1';

const cities = {
  bhopal: { lat: 23.2599, lon: 77.4126, code: 'CITY-MP-BPL' },
  indore: { lat: 22.7196, lon: 75.8577, code: 'CITY-MP-IDR' },
  sehore: { lat: 23.2080, lon: 77.0816, code: 'CITY-MP-SHR' },
};

/**
 * Fetch current weather data for a city using Open-Meteo API
 * No API key required - completely free
 */
export async function fetchWeatherForCity(cityName) {
  const city = cities[cityName.toLowerCase()];
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${Object.keys(cities).join(', ')}`);
  }

  const url = `${OPENMETEO_BASE_URL}/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,visibility`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API returned ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching weather for ${cityName}:`, error.message);
    throw error;
  }
}

/**
 * Fetch weather for all configured cities
 */
export async function fetchWeatherForAllCities() {
  const results = {};
  for (const cityName of Object.keys(cities)) {
    try {
      results[cityName] = await fetchWeatherForCity(cityName);
    } catch (error) {
      console.error(`Failed to fetch weather for ${cityName}:`, error.message);
      results[cityName] = null;
    }
  }
  return results;
}

/**
 * Convert Open-Meteo weather data to telemetry event format
 */
export function weatherToTelemetry(cityName, weatherData) {
  const city = cities[cityName.toLowerCase()];
  const current = weatherData.current_weather;
  const hourly = weatherData.hourly;

  return {
    h3Index: null, // Will be set by spatial indexing
    sourceType: 'WEATHER_API',
    cityCode: city.code,
    observedAt: new Date().toISOString(),
    rainMmHr: current.precipitation || 0,
    visibilityM: current.visibility || 10000,
    windGustMps: current.windspeed || 0,
    temperatureC: current.temperature || 25,
    humidityPct: hourly?.relative_humidity_2m?.[0] || 50,
    weatherCondition: getWeatherCondition(current.temperature, current.precipitation, current.windspeed),
  };
}

/**
 * Get weather condition description based on parameters
 */
function getWeatherCondition(temp, precipitation, windSpeed) {
  if (precipitation > 10) return 'Heavy Rain';
  if (precipitation > 0) return 'Rain';
  if (windSpeed > 15) return 'Windy';
  if (temp > 35) return 'Hot';
  if (temp < 10) return 'Cold';
  return 'Clear';
}

/**
 * Fetch historical weather data (last 24 hours)
 */
export async function fetchHistoricalWeather(cityName, hours = 24) {
  const city = cities[cityName.toLowerCase()];
  if (!city) {
    throw new Error(`City ${cityName} not found`);
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
  
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  const url = `${OPENMETEO_BASE_URL}/archive?latitude=${city.lat}&longitude=${city.lon}&start_date=${start}&end_date=${end}&hourly=temperature_2m,precipitation,wind_speed_10m`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo Archive API returned ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching historical weather for ${cityName}:`, error.message);
    throw error;
  }
}
