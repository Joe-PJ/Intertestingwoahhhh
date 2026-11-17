import { haversineMeters, isLatitude, isLongitude } from './geo';
import { requestJson } from './request';
import { DataError, type Bar, type Coords, type RequestOptions } from './types';

export { haversineMeters } from './geo';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const UNNAMED_BAR = 'Unnamed bar';

/**
 * One Overpass query for every bar, pub and beer garden (nodes, ways and relations) around a point.
 *
 * Throws a RangeError when the centre is not a finite, in-range latitude/longitude or the
 * radius is not a finite positive number, so no caller value is ever interpolated raw into
 * the Overpass QL. That is a caller bug, not a network failure, so it is not a DataError.
 */
export function buildOverpassQuery(center: Coords, radiusMeters: number): string {
  const { lat, lon } = center;
  if (!isLatitude(lat) || !isLongitude(lon)) {
    throw new RangeError(`Invalid search centre: ${String(lat)}, ${String(lon)}`);
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new RangeError(`Invalid search radius: ${String(radiusMeters)}`);
  }
  const radius = Math.max(1, Math.round(radiusMeters));
  return `[out:json][timeout:25];nwr["amenity"~"^(bar|pub|biergarten)$"](around:${radius},${lat},${lon});out center tags;`;
}

/**
 * Fetch and normalise every bar within `radiusMeters` of `center` (FR-2.1, FR-2.2).
 * Rejects with a RangeError — without calling fetch — for an invalid centre or radius.
 */
export async function fetchBars(
  center: Coords,
  radiusMeters: number,
  options: RequestOptions = {},
): Promise<Bar[]> {
  const query = buildOverpassQuery(center, radiusMeters);
  const body = await requestJson(
    OVERPASS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ data: query }).toString(),
    },
    options,
  );
  return parseOverpassResponse(body, center);
}

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
}

/** Turn an Overpass JSON body into Bar records, de-duplicated by OSM id. */
export function parseOverpassResponse(body: unknown, center: Coords): Bar[] {
  const elements = (body as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) {
    throw new DataError('badResponse', 'Overpass response had no elements list');
  }

  const bars = new Map<string, Bar>();
  for (const raw of elements as OverpassElement[]) {
    const bar = toBar(raw, center);
    if (bar && !bars.has(bar.id)) bars.set(bar.id, bar);
  }
  return [...bars.values()];
}

function toBar(element: OverpassElement, center: Coords): Bar | null {
  if (typeof element !== 'object' || element === null) return null;
  const { type, id } = element;
  if (type !== 'node' && type !== 'way' && type !== 'relation') return null;
  if (typeof id !== 'number' && typeof id !== 'string') return null;

  const point = type === 'node' ? element : element.center;
  const lat = point?.lat;
  const lon = point?.lon;
  // Overpass output is untrusted: drop anything without a real, in-range position
  // rather than letting NaN/Infinity reach the distance and the sort.
  if (!isLatitude(lat) || !isLongitude(lon)) return null;

  const tags: Record<string, unknown> =
    typeof element.tags === 'object' && element.tags !== null ? element.tags : {};
  const name = text(tags.name) ?? UNNAMED_BAR;
  const address = formatAddress(tags);
  const openingHoursRaw = text(tags.opening_hours);

  return {
    id: `${type}/${id}`,
    name,
    lat,
    lon,
    ...(address ? { address } : {}),
    ...(openingHoursRaw ? { openingHoursRaw } : {}),
    distanceMeters: haversineMeters(center, { lat, lon }),
  };
}

function formatAddress(tags: Record<string, unknown>): string | undefined {
  const street = [text(tags['addr:housenumber']), text(tags['addr:street'])]
    .filter(Boolean)
    .join(' ');
  const city = text(tags['addr:city']);
  if (!street) return undefined;
  return city ? `${street}, ${city}` : street;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
