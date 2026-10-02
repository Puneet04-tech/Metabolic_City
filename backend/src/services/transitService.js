/**
 * Transit Service for Simulated Transit Data
 * Generates realistic transit delays based on weather conditions
 */

const cities = {
  bhopal: { lat: 23.2599, lon: 77.4126, code: 'CITY-MP-BPL' },
  indore: { lat: 22.7196, lon: 75.8577, code: 'CITY-MP-IDR' },
  sehore: { lat: 23.2080, lon: 77.0816, code: 'CITY-MP-SHR' },
};

/**
 * Generate simulated transit data based on weather conditions
 */
export function generateTransitTelemetry(cityName, weatherData) {
  const current = weatherData.current_weather;
  const { precipitation, temperature, windspeed } = current;

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

  // Generate vehicle locations (simulated)
  const city = cities[cityName.toLowerCase()];
  const vehicles = [];
  for (let i = 0; i < 50; i++) {
    const offset = (Math.random() - 0.5) * 0.1; // ±0.05 degrees
    vehicles.push({
      vehicleId: `V${cityName.toUpperCase()}${i}`,
      routeId: `R${Math.floor(Math.random() * 20) + 1}`,
      latitude: city.lat + offset,
      longitude: city.lon + offset,
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
    averageDelay: delayMinutes,
    averageSpeedReduction: speedReductionPct,
    vehicles,
  };
}

/**
 * Generate simulated transit events for telemetry ingestion
 */
export function generateTransitTelemetryEvents(cityName, weatherData, count = 20) {
  const city = cities[cityName.toLowerCase()];
  const transitData = generateTransitTelemetry(cityName, weatherData);
  const events = [];

  for (let i = 0; i < count; i++) {
    const vehicle = transitData.vehicles[Math.floor(Math.random() * transitData.vehicles.length)];
    const offset = (Math.random() - 0.5) * 0.02; // ±0.01 degrees
    const timeOffset = i * 2 * 60 * 1000; // Every 2 minutes

    events.push({
      h3Index: null, // Will be set by spatial indexing
      sourceType: 'SIMULATED_TRANSIT',
      cityCode: city.code,
      latitude: vehicle.latitude + offset,
      longitude: vehicle.longitude + offset,
      observedAt: new Date(Date.now() - timeOffset).toISOString(),
      vehicleId: vehicle.vehicleId,
      routeId: vehicle.routeId,
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
