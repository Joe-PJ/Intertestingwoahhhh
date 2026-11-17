/** A point on the map, in WGS84 decimal degrees. */
export interface Coords {
  lat: number;
  lon: number;
}

/** One drinking place from OpenStreetMap, normalised for the app. */
export interface Bar {
  /** OSM type + id, e.g. 'node/123', 'way/456'. Unique across types. */
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  /** The raw OSM `opening_hours` tag, unparsed. */
  openingHoursRaw?: string;
  /** Straight-line distance from the search centre, in metres. */
  distanceMeters: number;
}

export type DataErrorKind = 'network' | 'timeout' | 'rateLimited' | 'notFound' | 'badResponse';

/**
 * Typed failure from the data layer. Carries a `kind` the UI maps to a
 * plain-language message; `message` is for logs only, never for users.
 */
export class DataError extends Error {
  readonly kind: DataErrorKind;

  constructor(kind: DataErrorKind, message?: string, options?: { cause?: unknown }) {
    super(message ?? kind, options);
    this.name = 'DataError';
    this.kind = kind;
  }
}

export function isDataError(value: unknown): value is DataError {
  return value instanceof DataError;
}

export const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 25] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 5;

/** Options shared by every network call in the data layer. */
export interface RequestOptions {
  /** Injectable fetch (tests pass a mock; defaults to globalThis.fetch). */
  fetch?: typeof fetch;
  /** Caller cancellation. An aborted call rejects with the signal's reason. */
  signal?: AbortSignal;
}
