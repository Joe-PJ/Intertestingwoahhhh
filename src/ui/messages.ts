import type { DataErrorKind } from '../data/types';

/** Anything that is not a DataError: a bug on our side, still told in plain words. */
export type SearchErrorKind = DataErrorKind | 'unexpected';

/**
 * What the person reads when a search fails (FR-5.3). Never a status code: each line
 * says what happened and what to do next; the 'Try again' button sits under it.
 */
export const ERROR_MESSAGES: Record<SearchErrorKind, string> = {
  network: "We couldn't reach the bar map right now. Try again in a moment.",
  timeout: 'The bar map took too long to answer. Try again, or pick a smaller radius.',
  rateLimited: 'The bar map is getting too many requests right now. Wait a minute, then try again.',
  notFound: "We couldn't find that place. Check the spelling, or try a nearby town.",
  badResponse: "The bar map sent back something we couldn't read. Try again in a moment.",
  unexpected: 'Something went wrong on our side. Try again.',
};

export const LOCATION_OFF_MESSAGE = 'Location is off. Type a town or address instead.';
export const LOCATION_TIMEOUT_MESSAGE = "We couldn't find your location in time. Type a town or address instead.";
