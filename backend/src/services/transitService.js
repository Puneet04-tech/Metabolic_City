/**
 * Transit Service for Simulated Transit Data
 * Generates realistic transit delays based on weather conditions
 * Uses static GTFS-like data for routes and stops
 */

import { getCityGTFSData, getRouteStops } from './staticGTFSData.js';
import * as h3 from 'h3-js';
import { getAvailableCityNames, getCity } from './cityConfig.js';

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
 * Generate simulated transit data based on weather conditions
 * Uses static GTFS data for routes and stops
 */
export function generateTransitTelemetry(cityName, weatherData) {
  const current = weatherData.current || weatherData.current_weather || {};
  const precipitation = Number(current.precipitation ?? weatherData.hourly?.precipitation?.[0] ?? 0);
  const temperature = Number(current.temperature_2m ?? current.temperature ?? 25);
  const windspeed = Number(current.wind_speed_10m ?? current.windspeed ?? 0);

  // Get GTFS data for the city
  const cityData = getCityGTFSData(cityName);
  const routes = cityData.routes;
  const stops = cityData.stops;

  // Calculate delay based on weather conditions
  let delayMinutes = 0;
  let speedReductionPct = 0;

  // Rain causes delays
  if (precipitation > 20) {
    delayMinutes += Math.floor(Math.random() * 30) + 20; // 20-50 min delay
    speedReductionPct += Math.floor(Math.random() * 30) + 40; // 40-70% speed reduction
  } else if (precipitation > 10) {
    delayMinutes += Math.floor(Math.random() * 20) + 10; // 10-30 min delay
    speedReductionPct += Math.floor(Math.random() * 20) + 30; // 30-50% speed reduction
  } else if (precipitation > 0) {
    delayMinutes += Math.floor(Math.random() * 10) + 5; // 5-15 min delay
    speedReductionPct += Math.floor(Math.random() * 15) + 20; // 20-35% speed reduction
  }

  // High winds cause delays
  if (windspeed > 20) {
    delayMinutes += Math.floor(Math.random() * 15) + 10;
    speedReductionPct += Math.floor(Math.random() * 10) + 15;
  } else if (windspeed > 10) {
    delayMinutes += Math.floor(Math.random() * 10) + 5;
    speedReductionPct += Math.floor(Math.random() * 5) + 10;
  }

  // Extreme temperatures cause delays
  if (temperature > 40 || temperature < 5) {
    delayMinutes += Math.floor(Math.random() * 10) + 5;
    speedReductionPct += Math.floor(Math.random() * 5) + 5;
  }

  // Random baseline delays (normal traffic conditions)
  const baselineDelay = Math.floor(Math.random() * 5);
  delayMinutes += baselineDelay;

  // Generate vehicle locations using real route and stop data
  const vehicles = [];
  for (let i = 0; i < Math.min(routes.length * 5, 50); i++) {
    const route = routes[i % routes.length];
    const routeStops = getRouteStops(cityName, route.routeId);
    
    if (routeStops.length === 0) continue;

    // Select a random stop on the route
    const stop = routeStops[Math.floor(Math.random() * routeStops.length)];
    
    // Add small offset to simulate vehicle between stops
    const offset = (Math.random() - 0.5) * 0.01; // ±0.005 degrees
    
    vehicles.push({
      vehicleId: `V${cityName.toUpperCase()}${i}`,
      routeId: route.routeId,
      routeName: route.routeLongName,
      stopId: stop.stopId,
      stopName: stop.stopName,
      latitude: stop.stopLat + offset,
      longitude: stop.stopLon + offset,
      speedMps: 11.1 * (1 - speedReductionPct / 100), // Normal speed 11.1 m/s (40 km/h)
      delayMins: delayMinutes,
      speedReductionPct,
    });
  }

  return {
    sourceType: 'SIMULATED_TRANSIT',
    cityName,
    observedAt: new Date().toISOString(),
    totalVehicles: vehicles.length,
    totalRoutes: routes.length,
    totalStops: stops.length,
    averageDelay: delayMinutes,
    averageSpeedReduction: speedReductionPct,
    vehicles,
  };
}

/**
 * Generate simulated transit events for telemetry ingestion
 */
export function generateTransitTelemetryEvents(cityName, weatherData, count = 20) {
  const city = getCity(cityName);
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${getAvailableCityNames().join(', ')}`);
  }
  const transitData = generateTransitTelemetry(cityName, weatherData);
  const events = [];

  for (let i = 0; i < count; i++) {
    const vehicle = transitData.vehicles[Math.floor(Math.random() * transitData.vehicles.length)];
    const offset = (Math.random() - 0.5) * 0.02; // ±0.01 degrees
    const timeOffset = i * 2 * 60 * 1000; // Every 2 minutes

    events.push({
      h3Index: getH3Index(vehicle.latitude + offset, vehicle.longitude + offset) || '8a283084dcb7fff',
      sourceType: 'GTFS_TRANSIT',
      cityCode: city.code,
      latitude: vehicle.latitude + offset,
      longitude: vehicle.longitude + offset,
      observedAt: new Date(Date.now() - timeOffset).toISOString(),
      vehicleId: vehicle.vehicleId,
      routeId: vehicle.routeId,
      routeName: vehicle.routeName,
      stopId: vehicle.stopId,
      stopName: vehicle.stopName,
      delayMins: vehicle.delayMins,
      speedReductionPct: vehicle.speedReductionPct,
    });
  }

  return events;
}

/**
 * Get transit status summary
 */
export function getTransitStatus(cityName, weatherData) {
  const transitData = generateTransitTelemetry(cityName, weatherData);
  const { averageDelay, averageSpeedReduction } = transitData;

  let status = 'NORMAL';
  if (averageDelay > 30) status = 'CRITICAL';
  else if (averageDelay > 15) status = 'HIGH';
  else if (averageDelay > 5) status = 'MODERATE';

  return {
    cityName,
    status,
    averageDelay,
    averageSpeedReduction,
    totalVehicles: transitData.totalVehicles,
    weatherImpact: weatherData.current_weather,
  };
}
