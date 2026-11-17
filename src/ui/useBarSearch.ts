import { useCallback, useEffect, useRef, useState } from 'react';
import { geocode } from '../data/geocode';
import { fetchBars } from '../data/overpass';
import { isDataError, type Coords, type RadiusKm } from '../data/types';
import { groupAndSort, type ClosingGroup } from '../domain/closing';
import type { SearchErrorKind } from './messages';

export type SearchRequest =
  /** A known centre: the device location, or a place already looked up (so widening never re-geocodes). */
  | { kind: 'coords'; coords: Coords; label: string; radiusKm: RadiusKm }
  | { kind: 'place'; query: string; radiusKm: RadiusKm };

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; request: SearchRequest }
  | {
      status: 'success';
      request: SearchRequest;
      /** Where the search was centred, kept so a wider search can reuse it without another place lookup. */
      centre: Coords;
      placeLabel: string;
      total: number;
      groups: ClosingGroup[];
    }
  | { status: 'error'; request: SearchRequest; errorKind: SearchErrorKind };

interface Options {
  /** Clock used to decide what "tonight" means; tests pin it. */
  now?: () => Date;
}

const systemNow = () => new Date();

/**
 * One bar search at a time. Starting a search aborts the one in flight, so a slow
 * earlier answer can never overwrite a newer one; the last request is kept so
 * `retry` can run exactly the same search again (FR-5.3).
 */
export function useBarSearch({ now = systemNow }: Options = {}) {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const inFlight = useRef<AbortController | null>(null);
  const lastRequest = useRef<SearchRequest | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const search = useCallback(
    async (request: SearchRequest) => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      lastRequest.current = request;
      const { signal } = controller;
      setState({ status: 'loading', request });

      try {
        let centre: Coords;
        let placeLabel: string;
        if (request.kind === 'place') {
          const place = await geocode(request.query, { signal });
          centre = { lat: place.lat, lon: place.lon };
          placeLabel = place.displayName;
        } else {
          centre = request.coords;
          placeLabel = request.label;
        }
        const bars = await fetchBars(centre, request.radiusKm * 1000, { signal });
        if (signal.aborted) return;
        setState({ status: 'success', request, centre, placeLabel, total: bars.length, groups: groupAndSort(bars, now()) });
      } catch (error) {
        // A superseded search is not a failure: the newer one owns the screen.
        if (signal.aborted) return;
        setState({ status: 'error', request, errorKind: isDataError(error) ? error.kind : 'unexpected' });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [now],
  );

  const retry = useCallback(() => {
    if (lastRequest.current) void search(lastRequest.current);
  }, [search]);

  return { state, search, retry };
}
