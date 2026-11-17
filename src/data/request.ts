import { DataError, type RequestOptions } from './types';

/** Both OSM services get the same budget; FR-2.3 says 25 seconds. */
export const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Shared fetch → JSON pipeline for Nominatim and Overpass. Maps every failure
 * onto a DataError kind so callers handle one error shape:
 * - 25 s without a response → 'timeout'
 * - HTTP 429 → 'rateLimited'; any other non-2xx or a transport failure → 'network'
 * - body that is not JSON → 'badResponse'
 * A caller-initiated abort is NOT mapped: it rethrows the signal's reason so
 * the UI can ignore superseded searches rather than show an error.
 */
export async function requestJson(
  url: string,
  init: RequestInit,
  { fetch: fetchImpl = globalThis.fetch, signal }: RequestOptions = {},
): Promise<unknown> {
  signal?.throwIfAborted();

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (cause) {
      throw mapTransportFailure(cause, timedOut, signal);
    }

    if (response.status === 429) {
      throw new DataError('rateLimited', `HTTP 429 from ${url}`);
    }
    if (!response.ok) {
      throw new DataError('network', `HTTP ${response.status} from ${url}`);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      throw mapTransportFailure(cause, timedOut, signal);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (cause) {
      throw new DataError('badResponse', `Response from ${url} was not JSON`, { cause });
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

function mapTransportFailure(cause: unknown, timedOut: boolean, signal?: AbortSignal): unknown {
  if (signal?.aborted) return signal.reason;
  if (timedOut) return new DataError('timeout', 'No response within 25 seconds', { cause });
  return new DataError('network', 'Request failed before a response arrived', { cause });
}
