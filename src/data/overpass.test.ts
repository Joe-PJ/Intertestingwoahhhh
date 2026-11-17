import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from './__fixtures__/overpass.json';
import {
  OVERPASS_URL,
  UNNAMED_BAR,
  buildOverpassQuery,
  fetchBars,
  haversineMeters,
  parseOverpassResponse,
} from './overpass';
import { REQUEST_TIMEOUT_MS } from './request';
import { DataError } from './types';
import { hangingFetch, respondWith } from '../test/fetchMocks';

const CENTER = { lat: 40.7306, lon: -73.9866 };

afterEach(() => {
  vi.useRealTimers();
});

describe('buildOverpassQuery', () => {
  it('asks for nodes, ways and relations tagged bar|pub|biergarten around the centre', () => {
    expect(buildOverpassQuery(CENTER, 5000)).toBe(
      '[out:json][timeout:25];nwr["amenity"~"^(bar|pub|biergarten)$"](around:5000,40.7306,-73.9866);out center tags;',
    );
  });

  it('rounds the radius to whole metres', () => {
    expect(buildOverpassQuery(CENTER, 1234.6)).toContain('(around:1235,');
  });
});

describe('fetchBars', () => {
  it('POSTs the query as form data to Overpass', async () => {
    const fetchMock = respondWith(fixture);
    await fetchBars(CENTER, 2000, { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(OVERPASS_URL);
    expect(init?.method).toBe('POST');
    const sent = new URLSearchParams(String(init?.body));
    expect(sent.get('data')).toBe(buildOverpassQuery(CENTER, 2000));
  });

  it('normalises the fixture into de-duplicated Bar records', async () => {
    const bars = await fetchBars(CENTER, 5000, { fetch: respondWith(fixture) });
    const byId = Object.fromEntries(bars.map((bar) => [bar.id, bar]));

    expect(bars.map((bar) => bar.id)).toEqual(['node/1001', 'way/2002', 'node/1003', 'node/1004']);

    expect(byId['node/1001']).toEqual({
      id: 'node/1001',
      name: 'The Night Owl',
      lat: 40.7306,
      lon: -73.9866,
      address: '12 Bleak Street, Gotham',
      openingHoursRaw: 'Mo-Su 17:00-04:00',
      distanceMeters: 0,
    });

    // Ways have no lat/lon of their own: the centre stands in.
    expect(byId['way/2002']).toMatchObject({
      name: 'The Lamplighter',
      lat: 40.7411,
      lon: -73.9897,
      address: '88 Canal Row',
      openingHoursRaw: 'Mo-Th 12:00-23:00; Fr,Sa 12:00-01:00',
    });
    expect(byId['way/2002']!.distanceMeters).toBeGreaterThan(1000);

    expect(byId['node/1003']).toMatchObject({ name: UNNAMED_BAR, openingHoursRaw: '18:00-02:00' });
    expect(byId['node/1003']).not.toHaveProperty('address');

    expect(byId['node/1004']).toMatchObject({ name: 'Stein Garden' });
    expect(byId['node/1004']).not.toHaveProperty('openingHoursRaw');
  });

  it('maps HTTP 429 to rateLimited and other failures to network', async () => {
    await expect(
      fetchBars(CENTER, 5000, { fetch: respondWith('slow down', { status: 429, raw: true }) }),
    ).rejects.toMatchObject({ kind: 'rateLimited' });
    await expect(
      fetchBars(CENTER, 5000, { fetch: respondWith('boom', { status: 504, raw: true }) }),
    ).rejects.toMatchObject({ kind: 'network' });
    await expect(
      fetchBars(CENTER, 5000, { fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')) }),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('maps a non-JSON or malformed body to badResponse', async () => {
    await expect(
      fetchBars(CENTER, 5000, { fetch: respondWith('<html>busy</html>', { raw: true }) }),
    ).rejects.toMatchObject({ kind: 'badResponse' });
    await expect(fetchBars(CENTER, 5000, { fetch: respondWith({ remark: 'x' }) })).rejects.toMatchObject({
      kind: 'badResponse',
    });
  });

  it('gives up after 25 seconds with a timeout error', async () => {
    vi.useFakeTimers();
    const pending = fetchBars(CENTER, 5000, { fetch: hangingFetch() });
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
  });

  it('rethrows the caller abort reason instead of a DataError', async () => {
    const controller = new AbortController();
    const pending = fetchBars(CENTER, 5000, { fetch: hangingFetch(), signal: controller.signal });
    controller.abort();
    const error = await pending.catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(DataError);
    expect((error as DOMException).name).toBe('AbortError');
  });
});

describe('parseOverpassResponse', () => {
  it('skips elements without usable coordinates', () => {
    const bars = parseOverpassResponse(
      { elements: [{ type: 'way', id: 9, tags: { amenity: 'pub' } }, { type: 'area', id: 1 }] },
      CENTER,
    );
    expect(bars).toEqual([]);
  });
});

describe('haversineMeters', () => {
  it('is within 1% of the known London–Paris distance (~343.5 km)', () => {
    const london = { lat: 51.5074, lon: -0.1278 };
    const paris = { lat: 48.8566, lon: 2.3522 };
    const expected = 343_500;
    expect(Math.abs(haversineMeters(london, paris) - expected) / expected).toBeLessThan(0.01);
  });

  it('is zero for the same point and symmetric', () => {
    const a = { lat: 10, lon: 20 };
    const b = { lat: -33.9, lon: 151.2 };
    expect(haversineMeters(a, a)).toBe(0);
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});
