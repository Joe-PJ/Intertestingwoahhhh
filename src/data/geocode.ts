import { isLatitude, isLongitude } from './geo';
import { requestJson } from './request';
import { DataError, type Coords, type RequestOptions } from './types';

export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

export interface GeocodeResult extends Coords {
  /** Nominatim's human-readable name for the match, e.g. "Austin, Travis County, Texas, United States". */
  displayName: string;
}

export function buildGeocodeUrl(query: string): string {
  return `${NOMINATIM_SEARCH_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
}

/** Resolve a typed place to coordinates via Nominatim (FR-1.2). Empty match → 'notFound'. */
export async function geocode(query: string, options: RequestOptions = {}): Promise<GeocodeResult> {
  const trimmed = query.trim();
  if (!trimmed) throw new DataError('notFound', 'Empty place query');

  const body = await requestJson(
    buildGeocodeUrl(trimmed),
    { method: 'GET', headers: { Accept: 'application/json' } },
    options,
  );

  if (!Array.isArray(body)) {
    throw new DataError('badResponse', 'Nominatim did not return a list');
  }
  const first: unknown = body[0];
  if (first === undefined) throw new DataError('notFound', `No place matched "${trimmed}"`);

  const record = (first ?? {}) as Record<string, unknown>;
  const lat = coordinate(record.lat);
  const lon = coordinate(record.lon);
  if (!isLatitude(lat) || !isLongitude(lon)) {
    throw new DataError('badResponse', 'Nominatim result had invalid coordinates');
  }
  const displayName = typeof record.display_name === 'string' ? record.display_name : trimmed;
  return { lat, lon, displayName };
}

/** Nominatim sends coordinates as decimal strings; accept numbers too. */
function coordinate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
