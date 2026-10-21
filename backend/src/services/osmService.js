import { RoadSegment } from '../models/RoadSegment.js';
import { getCity } from './cityConfig.js';
import * as h3 from 'h3-js';

const h3IndexOf = h3.latLngToCell || h3.geoToH3;
const h3ToLatLng = h3.cellToLatLng || h3.h3ToGeo;

const OSM_API = 'https://api.openstreetmap.org/api/0.6/map';
const USER_AGENT =
  process.env.OSM_USER_AGENT || 'MetabolicCity/1.0 (urban risk operations; set OSM_USER_AGENT)';

/** Roads worth carrying: the ones a response crew would drive on. */
const ROAD_CLASSES = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'pedestrian',
  'footway',
  'path',
  'track',
]);

/** Classes that carry meaningful traffic, used for the traffic probes. */
export const TRAFFIC_ROAD_CLASSES = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
]);

const WATER_CLASSES = new Set(['river', 'stream', 'canal', 'drain', 'ditch', 'weir']);

/** Roughly how big a square of the map one request may cover. */
const TILE_SPAN_DEG = 0.005; // ~550 m

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The distance between two points in metres.
 */
export function metresBetween(a, b) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Parses the OSM API's XML into the things we need: ways with their tags and
 * their node coordinates.
 */
function parseOsmXml(xml) {
  const nodes = new Map();
  for (const match of xml.matchAll(/<node\b([^>]*)\/>\s*/g)) {
    const attrs = match[1];
    const id = (attrs.match(/id="(\d+)"/) || [])[1];
    const lat = Number((attrs.match(/lat="([-\d.]+)"/) || [])[1]);
    const lon = Number((attrs.match(/lon="([-\d.]+)"/) || [])[1]);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    nodes.set(id, { latitude: lat, longitude: lon });
  }

  const ways = [];
  for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
    const attrs = match[1];
    const body = match[2];
    const id = (attrs.match(/id="(\d+)"/) || [])[1];
    if (!id) continue;

    const tags = {};
    for (const tag of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) {
      tags[tag[1]] = tag[2];
    }

    const geometry = [];
    for (const ref of body.matchAll(/<nd ref="(\d+)"\s*\/>/g)) {
      const point = nodes.get(ref[1]);
      if (point) geometry.push([point.latitude, point.longitude]);
    }
    if (geometry.length < 2) continue;

    ways.push({ osmId: id, tags, geometry });
  }

  return ways;
}

/**
 * Fetches one small square of the map from the OpenStreetMap API.
 */
async function fetchOsmTile(latitude, longitude, span) {
  const bbox = [
    longitude - span,
    latitude - span,
    longitude + span,
    latitude + span,
  ].join(',');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${OSM_API}?bbox=${bbox}`, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const xml = await response.text();
    return { ok: true, ways: parseOsmXml(xml) };
  } catch (error) {
    return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads the real road and water network of a city.
 *
 * The result is the truth about the city: which streets exist, what they are
 * called, which of them are near a river. The cell set of the whole system
 * is derived from it.
 */
export async function fetchCityNetwork(cityName, { radiusDeg = 0.09, onProgress } = {}) {
  const city = getCity(cityName);
  if (!city) throw new Error(`Unknown city: ${cityName}`);

  const tiles = [];
  const steps = Math.ceil((radiusDeg * 2) / TILE_SPAN_DEG);
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps; j += 1) {
      tiles.push([
        city.lat - radiusDeg + i * TILE_SPAN_DEG,
        city.lon - radiusDeg + j * TILE_SPAN_DEG,
      ]);
    }
  }

  const roads = new Map();
  const waters = new Map();
  let failed = 0;

  // Two requests at a time: the OSM API is rate limited, but not so heavily
  // that a whole city has to be fetched one tile at a time.
  const queue = [...tiles];
  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const [latitude, longitude] = queue.shift();
      // One retry: a dropped tile would otherwise shrink the cell set.
      let tile = await fetchOsmTile(latitude, longitude, TILE_SPAN_DEG);
      if (!tile.ok) {
        await sleep(1200);
        tile = await fetchOsmTile(latitude, longitude, TILE_SPAN_DEG);
      }
      if (!tile.ok) {
        failed += 1;
        continue;
      }
      for (const way of tile.ways) {
        const { highway, waterway } = way.tags;
        if (waterway && WATER_CLASSES.has(waterway)) {
          waters.set(way.osmId, {
            osmId: way.osmId,
            name: way.tags.name || '',
            waterway,
            geometry: way.geometry,
          });
          continue;
        }
        if (!highway || !ROAD_CLASSES.has(highway)) continue;
        if (roads.has(way.osmId)) continue;
        roads.set(way.osmId, {
          osmId: way.osmId,
          name: way.tags.name || '',
          highway,
          surface: way.tags.surface || '',
          lanes: Number.isFinite(Number(way.tags.lanes)) ? Number(way.tags.lanes) : null,
          oneway: way.tags.oneway === 'yes',
          geometry: way.geometry,
        });
      }
      onProgress?.({ done: roads.size + waters.size, tiles: tiles.length });
      await sleep(200);
    }
  });
  await Promise.all(workers);

  return { roads: [...roads.values()], waters: [...waters.values()], failedTiles: failed, tiles: tiles.length };
}

/**
 * Stores the downloaded network, ready to be queried.
 */
export async function saveCityNetwork(cityName, network) {
  const city = getCity(cityName);
  const resolution = 8;

  await RoadSegment.deleteMany({ cityCode: city.code });

  const waterPoints = network.waters.flatMap((water) =>
    water.geometry.map(([latitude, longitude]) => ({
      latitude,
      longitude,
      name: water.name,
    }))
  );

  const documents = [];
  for (const road of network.roads) {
    const mid = road.geometry[Math.floor(road.geometry.length / 2)];
    const h3Index = h3IndexOf(mid[0], mid[1], resolution);
    if (!h3Index) continue;

    let lengthM = 0;
    for (let i = 1; i < road.geometry.length; i += 1) {
      lengthM += metresBetween(
        { latitude: road.geometry[i - 1][0], longitude: road.geometry[i - 1][1] },
        { latitude: road.geometry[i][0], longitude: road.geometry[i][1] }
      );
    }

    let nearest = null;
    let nearestNamed = null;
    for (const point of waterPoints) {
      const distance = metresBetween(
        { latitude: mid[0], longitude: mid[1] },
        { latitude: point.latitude, longitude: point.longitude }
      );
      if (!nearest || distance < nearest.distanceM) {
        nearest = { distanceM: distance, name: point.name };
      }
      // A named watercourse is more useful than an unnamed one even when it
      // is a little further away.
      if (point.name && (!nearestNamed || distance < nearestNamed.distanceM)) {
        nearestNamed = { distanceM: distance, name: point.name };
      }
    }
    const waterway = nearestNamed || nearest;

    documents.push({
      cityCode: city.code,
      osmId: road.osmId,
      h3Index,
      name: road.name,
      highway: road.highway,
      surface: road.surface,
      lanes: road.lanes,
      oneway: road.oneway,
      geometry: road.geometry,
      latitude: mid[0],
      longitude: mid[1],
      lengthM: Math.round(lengthM),
      waterwayName: waterway?.name || '',
      waterwayDistanceM: waterway ? Math.round(waterway.distanceM) : null,
    });
  }

  if (documents.length) {
    await RoadSegment.insertMany(documents, { ordered: false });
  }
  return documents.length;
}

/**
 * The stored network of a city.
 */
export async function getCityNetwork(cityName) {
  const city = getCity(cityName);
  if (!city) return [];
  return RoadSegment.find({ cityCode: city.code }).lean();
}

/**
 * The cells that hold real streets, with the streets they hold.
 */
export async function getCityNetworkCells(cityName) {
  const segments = await getCityNetwork(cityName);
  const cells = new Map();

  for (const segment of segments) {
    if (!cells.has(segment.h3Index)) {
      const [latitude, longitude] = h3ToLatLng(segment.h3Index);
      cells.set(segment.h3Index, {
        h3Index: segment.h3Index,
        latitude,
        longitude,
        roadCount: 0,
        roadClasses: new Set(),
        segments: [],
      });
    }
    const cell = cells.get(segment.h3Index);
    cell.roadCount += 1;
    cell.roadClasses.add(segment.highway);
    cell.segments.push(segment);
  }

  for (const cell of cells.values()) {
    cell.roadClasses = [...cell.roadClasses];
  }
  return [...cells.values()];
}
