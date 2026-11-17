import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGeocodeUrl, geocode } from './geocode';
import { REQUEST_TIMEOUT_MS } from './request';
import { DataError } from './types';
import { hangingFetch, respondWith } from '../test/fetchMocks';

afterEach(() => {
  vi.useRealTimers();
});

const AUSTIN = [
  {
    place_id: 1,
    lat: '30.2711286',
    lon: '-97.7436995',
    display_name: 'Austin, Travis County, Texas, United States',
  },
];

describe('geocode', () => {
  it('builds the Nominatim URL with an encoded query', () => {
    expect(buildGeocodeUrl('Café & Bar, Paris')).toBe(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Caf%C3%A9%20%26%20Bar%2C%20Paris',
    );
  });

  it('returns the first result as numeric coordinates with its display name', async () => {
    const fetchMock = respondWith(AUSTIN);
    await expect(geocode('  Austin TX ', { fetch: fetchMock })).resolves.toEqual({
      lat: 30.2711286,
      lon: -97.7436995,
      displayName: 'Austin, Travis County, Texas, United States',
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(buildGeocodeUrl('Austin TX'));
    expect(init?.method).toBe('GET');
  });

  it('reports notFound when nothing matches', async () => {
    await expect(geocode('zzzz', { fetch: respondWith([]) })).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('reports notFound for a blank query without calling the network', async () => {
    const fetchMock = respondWith(AUSTIN);
    await expect(geocode('   ', { fetch: fetchMock })).rejects.toMatchObject({ kind: 'notFound' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps HTTP 429 to rateLimited', async () => {
    await expect(
      geocode('Austin', { fetch: respondWith('Too many', { status: 429, raw: true }) }),
    ).rejects.toMatchObject({ kind: 'rateLimited' });
  });

  it('maps HTTP 500 to network', async () => {
    const error = await geocode('Austin', { fetch: respondWith('oops', { status: 500, raw: true }) }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DataError);
    expect((error as DataError).kind).toBe('network');
  });

  it('maps non-JSON and non-list bodies to badResponse', async () => {
    await expect(geocode('Austin', { fetch: respondWith('<html/>', { raw: true }) })).rejects.toMatchObject({
      kind: 'badResponse',
    });
    await expect(geocode('Austin', { fetch: respondWith({ error: 'x' }) })).rejects.toMatchObject({
      kind: 'badResponse',
    });
    await expect(geocode('Austin', { fetch: respondWith([{ lat: '', lon: '1' }]) })).rejects.toMatchObject({
      kind: 'badResponse',
    });
  });

  it.each([
    ['non-numeric', { lat: 'abc', lon: '1' }],
    ['Infinity', { lat: 'Infinity', lon: '1' }],
    ['NaN', { lat: '1', lon: 'NaN' }],
    ['missing', { lat: '1' }],
    ['object', { lat: {}, lon: '1' }],
    ['out-of-range', { lat: '120', lon: '1' }],
  ])('maps a result with a %s coordinate to badResponse', async (_label, record) => {
    await expect(geocode('Austin', { fetch: respondWith([record]) })).rejects.toMatchObject({
      kind: 'badResponse',
    });
  });

  it('maps a null first result to badResponse', async () => {
    await expect(geocode('Austin', { fetch: respondWith([null]) })).rejects.toMatchObject({
      kind: 'badResponse',
    });
  });

  it('times out after 25 seconds', async () => {
    vi.useFakeTimers();
    const pending = geocode('Austin', { fetch: hangingFetch() });
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('stops when the caller aborts, without a DataError', async () => {
    const controller = new AbortController();
    const pending = geocode('Austin', { fetch: hangingFetch(), signal: controller.signal });
    controller.abort();
    const error = await pending.catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(DataError);
    expect((error as DOMException).name).toBe('AbortError');
  });

  it('does not call the network when already aborted', async () => {
    const fetchMock = respondWith(AUSTIN);
    const controller = new AbortController();
    controller.abort();
    await expect(geocode('Austin', { fetch: fetchMock, signal: controller.signal })).rejects.toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
