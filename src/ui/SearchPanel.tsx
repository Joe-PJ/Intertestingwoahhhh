import { useId, useState, type FormEvent, type RefObject } from 'react';
import { RADIUS_OPTIONS_KM, type RadiusKm } from '../data/types';
import { LocationIcon } from './icons';
import { LOCATION_OFF_MESSAGE, LOCATION_TIMEOUT_MESSAGE } from './messages';
import type { SearchRequest } from './useBarSearch';

interface SearchPanelProps {
  radiusKm: RadiusKm;
  onRadiusChange: (radiusKm: RadiusKm) => void;
  onSearch: (request: SearchRequest) => void;
  /** A search is running: the search buttons are disabled until it settles (FR-5.1). */
  busy: boolean;
  /** The typed-place field; the app focuses it when location is off or the user needs another place. */
  placeInputRef: RefObject<HTMLInputElement>;
}

const GEOLOCATION_OPTIONS: PositionOptions = { timeout: 15_000, maximumAge: 5 * 60_000 };

export function SearchPanel({ radiusKm, onRadiusChange, onSearch, busy, placeInputRef }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const placeId = useId();
  const noteId = useId();
  const radiusId = useId();

  const fallBackToTyping = (message: string) => {
    setLocationNote(message);
    placeInputRef.current?.focus();
  };

  const locateMe = () => {
    setLocationNote(null);
    if (!('geolocation' in navigator) || !navigator.geolocation) {
      fallBackToTyping(LOCATION_OFF_MESSAGE);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        onSearch({ kind: 'here', coords: { lat: coords.latitude, lon: coords.longitude }, radiusKm });
      },
      (error) => {
        setLocating(false);
        fallBackToTyping(error.code === error.TIMEOUT ? LOCATION_TIMEOUT_MESSAGE : LOCATION_OFF_MESSAGE);
      },
      GEOLOCATION_OPTIONS,
    );
  };

  const submitPlace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const place = query.trim();
    if (!place) {
      placeInputRef.current?.focus();
      return;
    }
    setLocationNote(null);
    onSearch({ kind: 'place', query: place, radiusKm });
  };

  return (
    <section className="search" aria-label="Choose an area">
      <button
        type="button"
        className="button button--primary search__locate"
        onClick={locateMe}
        disabled={busy || locating}
      >
        <LocationIcon className="button__icon" />
        {locating ? 'Finding you…' : 'Use my location'}
      </button>
      {locationNote && (
        <p id={noteId} className="search__note" role="status">
          {locationNote}
        </p>
      )}

      <form className="search__form" onSubmit={submitPlace} role="search">
        <label htmlFor={placeId} className="field-label">
          Or type a town or address
        </label>
        <div className="search__row">
          <input
            ref={placeInputRef}
            id={placeId}
            className="input"
            type="text"
            name="place"
            autoComplete="address-level2"
            enterKeyHint="search"
            placeholder="e.g. Austin, TX"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-describedby={locationNote ? noteId : undefined}
          />
          <button type="submit" className="button button--secondary" disabled={busy}>
            Search
          </button>
        </div>
      </form>

      <div className="search__radius">
        <label htmlFor={radiusId} className="field-label field-label--inline">
          Search within
        </label>
        <select
          id={radiusId}
          className="select"
          value={radiusKm}
          onChange={(event) => onRadiusChange(Number(event.target.value) as RadiusKm)}
        >
          {RADIUS_OPTIONS_KM.map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
