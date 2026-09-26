import { ingest } from '../routes/telemetry.js';

function parseWeatherPoints() {
  return (process.env.OPENWEATHER_POINTS || '')
    .split(';')
    .map((point) => point.trim())
    .filter(Boolean)
    .map((point) => {
      const [latitude, longitude] = point.split(',').map(Number);
      return { latitude, longitude };
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
      url.searchParams.set('lat', point.latitude);
      url.searchParams.set('lon', point.longitude);
      url.searchParams.set('appid', apiKey);
      url.searchParams.set('units', 'metric');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OpenWeather responded ${response.status}`);
      const weather = await response.json();
      await ingest('WEATHER_API', {
        ...point,
        timestamp: new Date().toISOString(),
        rainMmHr: weather.rain?.['1h'] || 0,
        visibilityM: weather.visibility,
        windGustMps: weather.wind?.gust,
        rawSource: 'OpenWeather',
      });
    } catch (error) {
      console.error('[poller] weather update failed:', error.message);
    }
  }
}

async function pollTransit() {
  const feedUrl = process.env.GTFS_RT_URL;
  if (!feedUrl) return;

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`GTFS-RT responded ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const bindings = await import('gtfs-realtime-bindings');
    const FeedMessage = bindings.transit_realtime?.FeedMessage || bindings.default?.transit_realtime?.FeedMessage;
    if (!FeedMessage) throw new Error('GTFS-Realtime FeedMessage decoder unavailable.');
    const feed = FeedMessage.decode(buffer);

    for (const entity of feed.entity || []) {
      const vehicle = entity.vehicle;
      const position = vehicle?.position;
      if (!position?.latitude || !position?.longitude) continue;
      await ingest('GTFS_TRANSIT', {
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: new Date(Number(vehicle.timestamp || feed.header?.timestamp || Date.now()) * 1000).toISOString(),
        vehicleId: vehicle.vehicle?.id,
        routeId: vehicle.trip?.routeId,
        delaySeconds: 0,
        rawSource: 'GTFS-RT',
      });
    }
  } catch (error) {
    console.error('[poller] GTFS-RT update failed:', error.message);
  }
}

export function startTelemetryPollers() {
  const weatherInterval = Number(process.env.WEATHER_POLL_INTERVAL_MS || 60000);
  const transitInterval = Number(process.env.TRANSIT_POLL_INTERVAL_MS || 10000);
  if (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_POINTS) {
    pollWeather();
    setInterval(pollWeather, weatherInterval);
    console.log(`[poller] OpenWeather enabled for ${parseWeatherPoints().length} points.`);
  }
  if (process.env.GTFS_RT_URL) {
    pollTransit();
    setInterval(pollTransit, transitInterval);
    console.log(`[poller] GTFS-RT enabled: ${process.env.GTFS_RT_URL}`);
  }
}