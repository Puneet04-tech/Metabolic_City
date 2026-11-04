import dotenv from 'dotenv';
import * as h3 from 'h3-js';
import { getAvailableCityNames, getCity, getConfiguredCityNames } from './cityConfig.js';
import { consumeBudget } from './requestBudget.js';

dotenv.config();

// Cache configuration
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache
const weatherCache = new Map();

/**
 * Get cached weather data if still valid
 */
function getCachedWeather(cityName) {
  const cached = weatherCache.get(cityName);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > WEATHER_CACHE_TTL_MS) {
    weatherCache.delete(cityName);
    return null;
  }

  console.log(`[weather] Using cached data for ${cityName} (age: ${Math.round(age / 1000)}s)`);
  return cached.data;
}

/**
 * Cache weather data
 */
function setCachedWeather(cityName, data) {
  weatherCache.set(cityName, {
    data,
    timestamp: Date.now(),
  });
  console.log(`[weather] Cached weather data for ${cityName}`);
}

/**
 * Clear all cache (useful for testing or manual refresh)
 */
export function clearWeatherCache() {
  weatherCache.clear();
  console.log('[weather] Cache cleared');
}

/**
 * Fetch weather from Open-Meteo (Free, no API key required)
 */
async function fetchFromOpenMeteo(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
    hourly: 'visibility',
    timezone: 'auto',
  });

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo API returned ${response.status}`);
  }

  return await response.json();
}

/**
 * Fetch weather from OpenWeatherMap (Free tier: 1,000 calls/day, 60 calls/minute)
 * Requires API key: https://openweathermap.org/api
 */
async function fetchFromOpenWeatherMap(lat, lon, apiKey) {
  if (!apiKey) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  const url = 'https://api.openweathermap.org/data/2.5/weather';
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
    units: 'metric',
  });

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API returned ${response.status}`);
  }

  const data = await response.json();

  // Convert OpenWeatherMap format to match Open-Meteo structure
  return {
    current: {
      temperature_2m: data.main.temp,
      relative_humidity_2m: data.main.humidity,
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      weather_code: data.weather[0].id,
      wind_speed_10m: data.wind.speed,
      wind_gusts_10m: data.wind.gust || data.wind.speed,
    },
    hourly: {
      visibility: [data.visibility],
    },
    provider: 'openweathermap',
  };
}

/**
 * Fetch weather from WeatherAPI (Free tier: 1,000,000 calls/month)
 * Requires API key: https://www.weatherapi.com/
 */
async function fetchFromWeatherAPI(lat, lon, apiKey) {
  if (!apiKey) {
    throw new Error('WeatherAPI key not configured');
  }

  const url = 'https://api.weatherapi.com/v1/current.json';
  const params = new URLSearchParams({
    key: apiKey,
    q: `${lat},${lon}`,
    aqi: 'no',
  });

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) {
    throw new Error(`WeatherAPI returned ${response.status}`);
  }

  const data = await response.json();

  // Convert WeatherAPI format to match Open-Meteo structure
  return {
    current: {
      temperature_2m: data.current.temp_c,
      relative_humidity_2m: data.current.humidity,
      precipitation: data.current.precip_mm,
      weather_code: data.current.condition.code,
      wind_speed_10m: data.current.wind_kph / 3.6, // Convert km/h to m/s
      wind_gusts_10m: data.current.gust_kph / 3.6,
    },
    hourly: {
      visibility: [data.current.vis_km * 1000], // Convert km to m
    },
    provider: 'weatherapi',
  };
}

/**
 * Fetch weather from wttr.in (Free, no API key, rate limited)
 * Good fallback for development
 */
async function fetchFromWttrIn(lat, lon) {
  const url = `https://wttr.in/${lat},${lon}?format=j1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`wttr.in returned ${response.status}`);
  }

  const data = await response.json();
  const current = data.current_condition[0];

  // Convert wttr.in format to match Open-Meteo structure
  return {
    current: {
      temperature_2m: parseFloat(current.temp_C),
      relative_humidity_2m: parseInt(current.humidity),
      precipitation: parseFloat(current.precipMM),
      weather_code: parseInt(current.weatherCode),
      wind_speed_10m: parseFloat(current.windspeedKmph) / 3.6,
      wind_gusts_10m: parseFloat(current.gustKmph) / 3.6,
    },
    hourly: {
      visibility: [parseFloat(current.visibility) * 1000],
    },
    provider: 'wttrin',
  };
}

/**
 * Try multiple weather providers in order until one succeeds
 */
async function fetchWeatherWithFallback(lat, lon, cityName) {
  const providers = [];

  // Configure providers based on environment variables
  const primaryProvider = process.env.WEATHER_API_PROVIDER || 'openmeteo';

  // Add OpenWeatherMap if API key is configured
  if (process.env.OPENWEATHERMAP_API_KEY) {
    providers.push({
      name: 'OpenWeatherMap',
      fetch: () => fetchFromOpenWeatherMap(lat, lon, process.env.OPENWEATHERMAP_API_KEY),
    });
  }

  // Add WeatherAPI if API key is configured
  if (process.env.WEATHERAPI_KEY) {
    providers.push({
      name: 'WeatherAPI',
      fetch: () => fetchFromWeatherAPI(lat, lon, process.env.WEATHERAPI_KEY),
    });
  }

  // Add wttr.in as free fallback (no API key needed)
  providers.push({
    name: 'wttr.in',
    fetch: () => fetchFromWttrIn(lat, lon),
  });

  // Add Open-Meteo as last fallback (no API key needed)
  providers.push({
    name: 'Open-Meteo',
    fetch: () => fetchFromOpenMeteo(lat, lon),
  });

  // Reorder based on primary provider setting
  if (primaryProvider === 'openweathermap' && process.env.OPENWEATHERMAP_API_KEY) {
    const owm = providers.find(p => p.name === 'OpenWeatherMap');
    if (owm) {
      providers.splice(providers.indexOf(owm), 1);
      providers.unshift(owm);
    }
  } else if (primaryProvider === 'weatherapi' && process.env.WEATHERAPI_KEY) {
    const wapi = providers.find(p => p.name === 'WeatherAPI');
    if (wapi) {
      providers.splice(providers.indexOf(wapi), 1);
      providers.unshift(wapi);
    }
  }

  console.log(`[weather] Attempting ${providers.length} providers for ${cityName}: ${providers.map(p => p.name).join(', ')}`);

  for (const provider of providers) {
    try {
      console.log(`[weather] Trying ${provider.name} for ${cityName}...`);
      const data = await provider.fetch();
      console.log(`[weather] ✓ Success with ${provider.name} for ${cityName}`);
      return { data, provider: provider.name };
    } catch (error) {
      console.warn(`[weather] ✗ ${provider.name} failed for ${cityName}:`, error.message);
      continue;
    }
  }

  throw new Error(`All weather providers failed for ${cityName}`);
}

/**
 * Fetch current weather data for a city with multi-provider fallback and caching
 */
export async function fetchWeatherForCity(cityName) {
  const city = getCity(cityName);
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${getAvailableCityNames().join(', ')}`);
  }

  // Check cache first
  const cached = getCachedWeather(cityName);
  if (cached) {
    return cached;
  }

  // Try to fetch from providers
  try {
    const { data, provider } = await fetchWeatherWithFallback(city.lat, city.lon, cityName);

    // Cache the result
    setCachedWeather(cityName, data);

    return data;
  } catch (error) {
    console.error(`[weather] All providers failed for ${cityName}:`, error.message);

    // If synthetic fallback is enabled, use it
    if (process.env.WEATHER_SYNTHETIC_FALLBACK_ENABLED !== 'false') {
      console.warn(`[weather] Using synthetic fallback for ${cityName}`);
      return generateSyntheticWeather(cityName);
    }

    throw error;
  }
}

/**
 * Generate synthetic weather data as fallback when all APIs fail
 */
function generateSyntheticWeather(cityName) {
  const city = getCity(cityName);
  const now = new Date();
  const hour = now.getHours();

  // Time-of-day temperature pattern
  let baseTemp = 25;
  if (hour >= 6 && hour < 12) baseTemp += 3;
  else if (hour >= 12 && hour < 17) baseTemp += 5;
  else if (hour >= 17 && hour < 21) baseTemp += 2;
  else baseTemp -= 2;

  const tempVariation = (Math.random() * 4) - 2;
  const temperatureC = Number((baseTemp + tempVariation).toFixed(1));

  const baseHumidity = hour >= 6 && hour < 12 ? 75 : 50;
  const humidityPct = Number((baseHumidity + (Math.random() * 20 - 10)).toFixed(0));

  const hasRain = Math.random() < 0.1;
  const rainMmHr = hasRain ? Number((Math.random() * 5).toFixed(1)) : 0;

  const windSpeed10m = Number((5 + Math.random() * 10).toFixed(1));
  const windGusts10m = Number((windSpeed10m + Math.random() * 5).toFixed(1));

  const visibilityM = hasRain ? Number((1000 + Math.random() * 3000).toFixed(0)) : 10000;

  let weatherCode = 0;
  if (hasRain) weatherCode = 61;
  else if (humidityPct > 80) weatherCode = 1;

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
    synthetic: true,
    generatedAt: now.toISOString(),
  };
}

/**
 * Fetch weather for all configured cities
 */
export async function fetchWeatherForAllCities() {
  const results = {};
  for (const cityName of getConfiguredCityNames()) {
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
 * Fetches the current weather at one arbitrary point.
 *
 * This is the primitive the per-cell interpolation is built on: the pipeline
 * needs a handful of real observations spread across a city, not one reading
 * for the whole of it.
 */
export async function fetchWeatherAtPoint(latitude, longitude) {
  try {
    const { data } = await fetchWeatherWithFallback(latitude, longitude, 'point');
    return data;
  } catch (error) {
    throw new Error(`Weather fetch failed for point (${latitude}, ${longitude}): ${error.message}`);
  }
}

/**
 * Fetches a set of weather observations for one city.
 *
 * Every point is a real observation. A point that fails is dropped rather
 * than replaced, so a partially reachable city still interpolates from the
 * observations it did get.
 */
export async function fetchWeatherObservations(points) {
  const settled = await Promise.allSettled(
    points.map(async (point) => {
      const data = await fetchWeatherAtPoint(point.latitude, point.longitude);
      return { point, data };
    })
  );

  const observations = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      observations.push({
        key: result.value.point.key,
        latitude: result.value.point.latitude,
        longitude: result.value.point.longitude,
        data: result.value.data,
        values: getWeatherSnapshot(result.value.data),
      });
      continue;
    }
    console.warn(
      `[weather] Observation ${result.reason?.message || 'failed'}; continuing with the remaining points`
    );
  }

  return observations;
}

/**
 * Get weather snapshot in standard format
 */
export function getWeatherSnapshot(weatherData) {
  const current = weatherData?.current || weatherData?.current_weather || {};
  const hourly = weatherData?.hourly || {};

  function firstFinite(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return undefined;
  }

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

/**
 * Convert weather data to telemetry format
 */
export function weatherToTelemetry(cityName, weatherData, target = {}) {
  const city = getCity(cityName);
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${getAvailableCityNames().join(', ')}`);
  }

  const snapshot = target.values ? target.values : getWeatherSnapshot(weatherData);
  const latitude = Number.isFinite(target.latitude) ? target.latitude : city.lat;
  const longitude = Number.isFinite(target.longitude) ? target.longitude : city.lon;

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

  return {
    h3Index: target.h3Index || getH3Index(latitude, longitude),
    latitude,
    longitude,
    sourceType: 'WEATHER_API',
    cityCode: city.code,
    observedAt: new Date().toISOString(),
    rainMmHr: snapshot.rainMmHr ?? 0,
    visibilityM: snapshot.visibilityM ?? 10000,
    windGustMps: snapshot.windGustMps ?? 0,
    temperatureC: snapshot.temperatureC ?? 25,
    humidityPct: snapshot.humidityPct ?? 50,
    weatherCondition: getWeatherCondition(snapshot.temperatureC, snapshot.rainMmHr, snapshot.windSpeedMps),
    rawPayload: {
      ...(target.values ? {} : weatherData),
      pipelineGenerated: true,
      ...(target.provenance || {}),
    },
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
