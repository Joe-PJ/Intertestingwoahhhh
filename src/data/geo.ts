import type { Coords } from './types';

const EARTH_RADIUS_METERS = 6_371_008.8; // IUGG mean radius

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in metres (haversine formula). */
export function haversineMeters(a: Coords, b: Coords): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
