import dotenv from 'dotenv';
import * as h3 from 'h3-js';
import { getAvailableCityNames, getCity, getConfiguredCityNames } from './cityConfig.js';

dotenv.config();

const OPENMETEO_BASE_URL = process.env.OPENMETEO_BASE_URL || 'https://api.open-meteo.com/v1';
const OPENMETEO_RETRIES = Number(process.env.OPENMETEO_RETRIES || 2);
const OPENMETEO_TIMEOUT_MS = Number(process.env.OPENMETEO_TIMEOUT_MS || 10000);

function getH3Index(lat, lon, res = 8) {
  const h3Fn = h3.latLngToCell || h3.geoToH3;
  if (typeof h3Fn === 'function') {
    try {
      return h3Fn(lat, lon, res);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Generate synthetic weather data as fallback when API fails
 * Uses time-of-day patterns and seasonal variations
 */
export function generateSyntheticWeather(cityName) {
  const city = getCity(cityName);
  const now = new Date();
  const hour = now.getHours();
  
  // Time-of-day temperature pattern
  let baseTemp = 25; // Base temperature
  if (hour >= 6 && hour < 12) baseTemp += 3; // Morning warming
  else if (hour >= 12 && hour < 17) baseTemp += 5; // Afternoon peak
  else if (hour >= 17 && hour < 21) baseTemp += 2; // Evening cooling
  else baseTemp -= 2; // Night cooling
  
  // Add random variation (-2 to +2 degrees)
  const tempVariation = (Math.random() * 4) - 2;
  const temperatureC = Number((baseTemp + tempVariation).toFixed(1));
  
  // Humidity (higher in morning, lower in afternoon)
  const baseHumidity = hour >= 6 && hour < 12 ? 75 : 50;
  const humidityPct = Number((baseHumidity + (Math.random() * 20 - 10)).toFixed(0));
  
  // Precipitation (10% chance of rain)
  const hasRain = Math.random() < 0.1;
  const rainMmHr = hasRain ? Number((Math.random() * 5).toFixed(1)) : 0;
  
  // Wind speed
  const windSpeed10m = Number((5 + Math.random() * 10).toFixed(1));
  const windGusts10m = Number((windSpeed10m + Math.random() * 5).toFixed(1));
  
  // Visibility (reduced with rain)
  const visibilityM = hasRain ? Number((1000 + Math.random() * 3000).toFixed(0)) : 10000;
  
  // Weather code (simplified)
  let weatherCode = 0; // Clear
  if (hasRain) weatherCode = 61; // Rain
  else if (humidityPct > 80) weatherCode = 1; // Cloudy
  
  return {
    current: {
      temperature_2m: temperatureC,
      relative_humidity_2m: humidityPct,
      precipitation: rainMmHr,
      weather_code: weatherCode,
      wind_speed_10m: windSpeed10m,
      wind_gusts_10m: windGusts10m,
    },
    hourly: {
      visibility: [visibilityM],
    },
    synthetic: true, // Mark as synthetic
    generatedAt: now.toISOString(),
  };
}

/**
 * Check if synthetic fallback is enabled
 */
function isSyntheticFallbackEnabled() {
  return process.env.WEATHER_SYNTHETIC_FALLBACK_ENABLED !== 'false';
}

/**
 * Fetch current weather data for a city using Open-Meteo API
 * This function is wrapped by circuit breaker for reliability
 * Falls back to synthetic data if API fails
 */
export async function fetchWeatherForCity(cityName) {
  const city = getCity(cityName);
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${getAvailableCityNames().join(', ')}`);
  }

  const url = new URL(`${OPENMETEO_BASE_URL}/forecast`);
  url.searchParams.set('latitude', String(city.lat));
  url.searchParams.set('longitude', String(city.lon));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m'
  );
  url.searchParams.set('hourly', 'visibility');
  url.searchParams.set('timezone', 'auto');

  let lastError;
  for (let attempt = 0; attempt <= OPENMETEO_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENMETEO_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        console.warn(`[weather] Open-Meteo API returned ${response.status} for ${cityName} (attempt ${attempt + 1}/${OPENMETEO_RETRIES + 1})`);
        if (attempt === OPENMETEO_RETRIES) {
          if (isSyntheticFallbackEnabled()) {
            console.warn(`[weather] All retries exhausted for ${cityName}, using synthetic fallback`);
            return generateSyntheticWeather(cityName);
          } else {
            console.error(`[weather] All retries exhausted for ${cityName}, synthetic fallback disabled`);
            throw new Error(`Weather API failed for ${cityName} and synthetic fallback is disabled`);
          }
        }
        throw new Error(`Open-Meteo API returned ${response.status}`);
      }
      const data = await response.json();
      console.log(`[weather] Successfully fetched weather for ${cityName} (attempt ${attempt + 1})`);
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`[weather] Attempt ${attempt + 1} failed for ${cityName}:`, error.message);
      if (attempt < OPENMETEO_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  console.error(`[weather] All attempts failed for ${cityName}:`, lastError.message);
  if (isSyntheticFallbackEnabled()) {
    console.warn(`[weather] Using synthetic fallback for ${cityName} due to error`);
    return generateSyntheticWeather(cityName);
  } else {
    console.error(`[weather] Not using synthetic fallback for ${cityName} (disabled in config)`);
    throw lastError;
  }
}

export async function fetchWeatherForAllCities() {
  const results = {};
  for (const cityName of getConfiguredCityNames()) {
    try {
      results[cityName] = await fetchWeatherForCity(cityName);
    } catch (error) {
      console.error(`Failed to fetch weather for ${cityName}:`, error.message);
      console.warn(`[weather] Using synthetic fallback for ${cityName} due to error`);
      results[cityName] = generateSyntheticWeather(cityName);
    }
  }
  return results;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

export function getWeatherSnapshot(weatherData) {
  const current = weatherData?.current || weatherData?.current_weather || {};
  const hourly = weatherData?.hourly || {};

  return {
    temperatureC: firstFinite(current.temperature_2m, current.temperature),
    rainMmHr: firstFinite(current.precipitation, hourly.precipitation?.[0], current.rain),
    visibilityM: firstFinite(current.visibility, hourly.visibility?.[0]),
    windSpeedMps: firstFinite(current.wind_speed_10m, current.windspeed),
    windGustMps: firstFinite(current.wind_gusts_10m, current.wind_speed_10m, current.windspeed),
    humidityPct: firstFinite(current.relative_humidity_2m, hourly.relative_humidity_2m?.[0]),
    weatherCode: firstFinite(current.weather_code, current.weathercode),
  };
}

export function weatherToTelemetry(cityName, weatherData) {
  const city = getCity(cityName);
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${getAvailableCityNames().join(', ')}`);
  }
  const snapshot = getWeatherSnapshot(weatherData);

  return {
    h3Index: getH3Index(city.lat, city.lon),
    latitude: city.lat,
    longitude: city.lon,
    sourceType: 'WEATHER_API',
    cityCode: city.code,
    observedAt: new Date().toISOString(),
    rainMmHr: snapshot.rainMmHr ?? 0,
    visibilityM: snapshot.visibilityM ?? 10000,
    windGustMps: snapshot.windGustMps ?? 0,
    temperatureC: snapshot.temperatureC ?? 25,
    humidityPct: snapshot.humidityPct ?? 50,
    weatherCondition: getWeatherCondition(snapshot.temperatureC, snapshot.rainMmHr, snapshot.windSpeedMps),
    rawPayload: weatherData,
  };
}

function getWeatherCondition(temp, precipitation, windSpeed) {
  if (precipitation > 10) return 'Heavy Rain';
  if (precipitation > 0) return 'Rain';
  if (windSpeed > 15) return 'Windy';
  if (temp > 35) return 'Hot';
  if (temp < 10) return 'Cold';
  return 'Clear';
}

export async function fetchHistoricalWeather(cityName, hours = 24) {
  const city = getCity(cityName);
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${getAvailableCityNames().join(', ')}`);
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
