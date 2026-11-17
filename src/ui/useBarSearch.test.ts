import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocode } from '../data/geocode';
import { fetchBars } from '../data/overpass';
import type { Bar } from '../data/types';
import { useBarSearch } from './useBarSearch';

vi.mock('../data/geocode', () => ({ geocode: vi.fn() }));
vi.mock('../data/overpass', () => ({ fetchBars: vi.fn() }));

const fetchBarsMock = vi.mocked(fetchBars);
const NOW = () => new Date(2026, 10, 20, 20, 0);
const ONE_BAR: Bar[] = [
  { id: 'node/1', name: 'Second', lat: 1, lon: 1, distanceMeters: 10, openingHoursRaw: 'Mo-Su 17:00-23:00' },
];

afterEach(() => vi.clearAllMocks());

describe('useBarSearch', () => {
  it('aborts the search in flight when a new one starts and keeps only the newer answer', async () => {
    const signals: AbortSignal[] = [];
    let answerFirst: (bars: Bar[]) => void = () => {};
    fetchBarsMock
      .mockImplementationOnce((_c, _r, options) => {
        signals.push(options!.signal!);
        return new Promise((resolve) => (answerFirst = resolve));
      })
      .mockImplementationOnce(async (_c, _r, options) => {
        signals.push(options!.signal!);
        return ONE_BAR;
      });

    const { result } = renderHook(() => useBarSearch({ now: NOW }));
    act(() => void result.current.search({ kind: 'coords', coords: { lat: 1, lon: 1 }, label: 'your location', radiusKm: 5 }));
    act(() => void result.current.search({ kind: 'coords', coords: { lat: 2, lon: 2 }, label: 'your location', radiusKm: 2 }));

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);

    // The superseded request answering late must not overwrite the newer result.
    await act(async () => answerFirst([]));
    const { state } = result.current;
    expect(state.status === 'success' && state.total).toBe(1);
    expect(state.status === 'success' && state.request.radiusKm).toBe(2);
  });

  it('retries the last request exactly', async () => {
    vi.mocked(geocode).mockResolvedValue({ lat: 3, lon: 4, displayName: 'Somewhere' });
    fetchBarsMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(ONE_BAR);

    const { result } = renderHook(() => useBarSearch({ now: NOW }));
    act(() => void result.current.search({ kind: 'place', query: 'Somewhere', radiusKm: 10 }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    const { state: failed } = result.current;
    expect(failed.status === 'error' && failed.errorKind).toBe('unexpected');

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(fetchBarsMock).toHaveBeenLastCalledWith({ lat: 3, lon: 4 }, 10_000, expect.anything());
  });
});
