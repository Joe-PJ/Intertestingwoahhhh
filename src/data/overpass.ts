import { haversineMeters } from './geo';
import { requestJson } from './request';
import { DataError, type Bar, type Coords, type RequestOptions } from './types';

export { haversineMeters } from './geo';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const UNNAMED_BAR = 'Unnamed bar';

/** One Overpass query for every bar, pub and beer garden (nodes, ways and relations) around a point. */
export function buildOverpassQuery(center: Coords, radiusMeters: number): string {
  const radius = Math.round(radiusMeters);
  return `[out:json][timeout:25];nwr["amenity"~"^(bar|pub|biergarten)$"](around:${radius},${center.lat},${center.lon});out center tags;`;
}

/** Fetch and normalise every bar within `radiusMeters` of `center` (FR-2.1, FR-2.2). */
export async function fetchBars(
  center: Coords,
  radiusMeters: number,
  options: RequestOptions = {},
): Promise<Bar[]> {
  const body = await requestJson(
    OVERPASS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ data: buildOverpassQuery(center, radiusMeters) }).toString(),
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
  const { type, id } = element;
  if (type !== 'node' && type !== 'way' && type !== 'relation') return null;
  if (typeof id !== 'number' && typeof id !== 'string') return null;

  const point = type === 'node' ? element : element.center;
  const lat = point?.lat;
  const lon = point?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const tags = element.tags ?? {};
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
