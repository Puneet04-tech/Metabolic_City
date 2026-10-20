import * as h3 from 'h3-js';

const EARTH_RADIUS = 6371000;

/** The centre of an H3 cell. */
export const cellCenter = (h3Index) => {
  if (!h3Index) return null;
  try {
    const [lat, lng] = h3.cellToLatLng(h3Index);
    return { lat, lng };
  } catch {
    return null;
  }
};

/** Great-circle distance in metres. */
export const distanceMeters = (from, to) => {
  if (!from || !to) return null;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** A maps link for a coordinate. */
export const mapsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
