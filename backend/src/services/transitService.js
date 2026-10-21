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
 * A small deterministic generator seeded from a string.
 *
 * The simulation used Math.random() for everything, so the same stop
 * produced a different delay on every cycle and the scores moved for no
 * reason. Seeding it by stop keeps a stop's own baseline stable, so the
 * only thing that moves a stop's score is the weather around it.
 */
function seededRandom(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * The conditions a stop is in.
 *
 * The transit service is given the weather of the cell a stop sits in, so a
 * stop in a flooded cell and a stop in a dry cell on the same route are not
 * treated alike. The local weather arrives as a flat snapshot (the same
 * shape the interpolation produces) and the city reading arrives in the
 * shape the weather API returns; both are understood here.
 */
function localConditions(weatherData, localWeather) {
  const source = localWeather || weatherData;
  const current = source.current || source.current_weather || {};

  const precipitation = Number(
    current.precipitation ??
      source.rainMmHr ??
      source.precipitation ??
      source.hourly?.precipitation?.[0] ??
      0
  );
  const temperature = Number(
    current.temperature_2m ?? current.temperature ?? source.temperatureC ?? 25
  );
  const windspeed = Number(
    current.wind_speed_10m ?? current.windspeed ?? source.windSpeedMps ?? source.windGustMps ?? 0
  );

  return { precipitation, temperature, windspeed };
}

/**
 * The delay and speed reduction at one stop, given the conditions around it.
 */
function stopSeverity(conditions, random) {
  let delayMinutes = 0;
  let speedReductionPct = 0;

  // Rain causes delays
  if (conditions.precipitation > 20) {
    delayMinutes += Math.floor(random() * 30) + 20; // 20-50 min delay
    speedReductionPct += Math.floor(random() * 30) + 40; // 40-70% speed reduction
  } else if (conditions.precipitation > 10) {
    delayMinutes += Math.floor(random() * 20) + 10; // 10-30 min delay
    speedReductionPct += Math.floor(random() * 20) + 30; // 30-50% speed reduction
  } else if (conditions.precipitation > 0) {
    delayMinutes += Math.floor(random() * 10) + 5; // 5-15 min delay
    speedReductionPct += Math.floor(random() * 15) + 20; // 20-35% speed reduction
  }

  // High winds cause delays
  if (conditions.windspeed > 20) {
    delayMinutes += Math.floor(random() * 15) + 10;
    speedReductionPct += Math.floor(random() * 10) + 15;
  } else if (conditions.windspeed > 10) {
    delayMinutes += Math.floor(random() * 10) + 5;
    speedReductionPct += Math.floor(random() * 5) + 10;
  }

  // Extreme temperatures cause delays
  if (conditions.temperature > 40 || conditions.temperature < 5) {
    delayMinutes += Math.floor(random() * 10) + 5;
    speedReductionPct += Math.floor(random() * 5) + 5;
  }

  // A small baseline delay, stable for a given stop
  delayMinutes += Math.floor(random() * 5);

  return { delayMinutes, speedReductionPct };
}

/**
 * The congestion band a speed reduction falls into.
 */
export function congestionLevelFor(speedReductionPct) {
  if (speedReductionPct >= 80) return 'STANDSTILL';
  if (speedReductionPct >= 50) return 'SEVERE';
  if (speedReductionPct >= 20) return 'MODERATE';
  return 'LOW';
}

/**
 * Generate simulated transit data based on weather conditions
 * Uses static GTFS data for routes and stops
 *
 * `options.weatherForCell` resolves the weather of the cell a stop sits in.
 * When it is supplied, each stop is affected by its own surroundings rather
 * than by the city as a whole, so two stops on the same route separate.
 */
export function generateTransitTelemetry(cityName, weatherData, options = {}) {
  const { weatherForCell = null } = options;

  // Get GTFS data for the city
  const cityData = getCityGTFSData(cityName);
  const routes = cityData.routes;
  const stops = cityData.stops;

  // Generate vehicle locations using real route and stop data
  const vehicles = [];
  for (let i = 0; i < Math.min(routes.length * 5, 50); i++) {
    const route = routes[i % routes.length];
    const routeStops = getRouteStops(cityName, route.routeId);

    if (routeStops.length === 0) continue;

    // Select a stop on the route. The choice is seeded by the vehicle, so a
    // given vehicle works the same stop from one cycle to the next.
    const random = seededRandom(`${cityName}:${route.routeId}:${i}`);
    const stop = routeStops[Math.floor(random() * routeStops.length)];

    const stopIndex = getH3Index(stop.stopLat, stop.stopLon);
    const localWeather = stopIndex && weatherForCell ? weatherForCell(stopIndex) : null;
    const conditions = localConditions(weatherData, localWeather);

    // The severity is seeded by the stop, so the same stop keeps the same
    // severity while its surroundings stay the same. Only the weather
    // around a stop moves its score.
    const stopRandom = seededRandom(`${cityName}:${stop.stopId}`);
    const { delayMinutes, speedReductionPct } = stopSeverity(conditions, stopRandom);

    vehicles.push({
      vehicleId: `V${cityName.toUpperCase()}${i}`,
      routeId: route.routeId,
      routeName: route.routeLongName,
      stopId: stop.stopId,
      stopName: stop.stopName,
      h3Index: stopIndex,
      // The vehicle is placed at the stop it is serving, so the event lands
      // in that stop's cell rather than a neighbour of it.
      latitude: stop.stopLat,
      longitude: stop.stopLon,
      speedMps: 11.1 * (1 - speedReductionPct / 100), // Normal speed 11.1 m/s (40 km/h)
      delayMins: delayMinutes,
      speedReductionPct,
      conditions,
    });
  }

  const delays = vehicles.map((vehicle) => vehicle.delayMins);
  const reductions = vehicles.map((vehicle) => vehicle.speedReductionPct);

  return {
    sourceType: 'SIMULATED_TRANSIT',
    cityName,
    observedAt: new Date().toISOString(),
    totalVehicles: vehicles.length,
    totalRoutes: routes.length,
    totalStops: stops.length,
    averageDelay: delays.length ? delays.reduce((sum, value) => sum + value, 0) / delays.length : 0,
    averageSpeedReduction: reductions.length
      ? reductions.reduce((sum, value) => sum + value, 0) / reductions.length
      : 0,
    vehicles,
  };
}

/**
 * Generate simulated transit events for telemetry ingestion
 */
export function generateTransitTelemetryEvents(cityName, weatherData, count = 20, options = {}) {
  const city = getCity(cityName);
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${getAvailableCityNames().join(', ')}`);
  }
  const transitData = generateTransitTelemetry(cityName, weatherData, options);
  const events = [];

  for (let i = 0; i < count; i++) {
    const random = seededRandom(`${cityName}:event:${i}`);
    const vehicle = transitData.vehicles[Math.floor(random() * transitData.vehicles.length)];
    if (!vehicle) break;

    const timeOffset = i * 2 * 60 * 1000; // Every 2 minutes

    events.push({
      h3Index: vehicle.h3Index || getH3Index(vehicle.latitude, vehicle.longitude) || '8a283084dcb7fff',
      sourceType: 'GTFS_TRANSIT',
      cityCode: city.code,
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      observedAt: new Date(Date.now() - timeOffset).toISOString(),
      vehicleId: vehicle.vehicleId,
      routeId: vehicle.routeId,
      routeName: vehicle.routeName,
      stopId: vehicle.stopId,
      stopName: vehicle.stopName,
      delayMins: vehicle.delayMins,
      speedReductionPct: vehicle.speedReductionPct,
      congestionLevel: congestionLevelFor(vehicle.speedReductionPct),
      rawPayload: {
        ...(options.pipelineGenerated ? { pipelineGenerated: true } : {}),
        simulated: true,
        stopId: vehicle.stopId,
        stopName: vehicle.stopName,
        conditions: vehicle.conditions,
      },
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
