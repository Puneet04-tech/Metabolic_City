import { ingest } from '../routes/telemetry.js';

function parseWeatherPoints() {
  return (process.env.OPENWEATHER_POINTS || '')
    .split(';')
    .map((point) => point.trim())
    .filter(Boolean)
    .map((point) => {
      const parts = point.split(',').map((p) => Number(p.trim()));
      return { latitude: parts[0], longitude: parts[1] };
    })
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

async function pollWeather() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const points = parseWeatherPoints();
  if (!apiKey || !points.length) return;

  for (const point of points) {
    try {
      const url = new URL('https://api.openweathermap.org/data/2.5/weather');
      url.searchParams.set('lat', String(point.latitude));
      url.searchParams.set('lon', String(point.longitude));
      url.searchParams.set('appid', apiKey);
      url.searchParams.set('units', 'metric');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OpenWeather responded HTTP ${response.status}`);
      }

      const weather = await response.json();
      const rainMmHr = weather.rain?.['1h'] ?? weather.rain?.['3h'] ? (weather.rain['3h'] / 3) : 0;

      await ingest('WEATHER_API', {
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: new Date().toISOString(),
        rainMmHr,
        visibilityM: weather.visibility,
        windGustMps: weather.wind?.gust ?? (weather.wind?.speed ? weather.wind.speed * 1.3 : 0),
        temperatureC: weather.main?.temp,
        humidityPct: weather.main?.humidity,
        weatherCondition: weather.weather?.[0]?.main || 'Clear',
        rawPayload: {
          source: 'OpenWeatherMap',
          city: weather.name,
          weather: weather.weather,
          wind: weather.wind,
          main: weather.main,
        },
      });
    } catch (error) {
      console.error(`[poller] Weather update failed for (${point.latitude}, ${point.longitude}):`, error.message);
    }
  }
}

async function pollTransit() {
  const feedUrl = process.env.GTFS_RT_URL;
  if (!feedUrl) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(feedUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`GTFS-RT responded HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const bindings = await import('gtfs-realtime-bindings');
    const FeedMessage = bindings.transit_realtime?.FeedMessage || bindings.default?.transit_realtime?.FeedMessage;

    if (!FeedMessage) {
      throw new Error('GTFS-Realtime FeedMessage decoder unavailable.');
    }

    const feed = FeedMessage.decode(buffer);

    for (const entity of feed.entity || []) {
      const vehicle = entity.vehicle;
      const position = vehicle?.position;
      if (!position?.latitude || !position?.longitude) continue;

      const speedMps = position.speed; // speed in meters per second
      const normalSpeedMps = 11.1; // ~40 km/h baseline
      let speedReductionPct = 0;
      if (Number.isFinite(speedMps) && speedMps < normalSpeedMps) {
        speedReductionPct = Math.round(((normalSpeedMps - Math.max(0, speedMps)) / normalSpeedMps) * 100);
      }

      await ingest('GTFS_TRANSIT', {
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: new Date(Number(vehicle.timestamp || feed.header?.timestamp || Date.now()) * 1000).toISOString(),
        vehicleId: vehicle.vehicle?.id || entity.id,
        routeId: vehicle.trip?.routeId,
        delayMins: 0,
        speedReductionPct,
        rawPayload: {
          source: 'GTFS-RT',
          vehicleId: vehicle.vehicle?.id,
          tripId: vehicle.trip?.tripId,
          bearing: position.bearing,
          speed: speedMps,
        },
      });
    }
  } catch (error) {
    console.error('[poller] GTFS-RT transit update failed:', error.message);
  }
}

export function startTelemetryPollers() {
  const weatherInterval = Number(process.env.WEATHER_POLL_INTERVAL_MS || 60000);
  const transitInterval = Number(process.env.TRANSIT_POLL_INTERVAL_MS || 10000);

  if (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_POINTS) {
    pollWeather();
    setInterval(pollWeather, weatherInterval);
    console.log(`[poller] OpenWeather active for ${parseWeatherPoints().length} points (interval: ${weatherInterval / 1000}s).`);
  }

  if (process.env.GTFS_RT_URL) {
    pollTransit();
    setInterval(pollTransit, transitInterval);
    console.log(`[poller] GTFS-RT active: ${process.env.GTFS_RT_URL} (interval: ${transitInterval / 1000}s).`);
  }
}
