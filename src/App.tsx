import { useRef, useState } from 'react';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM, type RadiusKm } from './data/types';
import { CLOSING_GROUPS } from './domain/closing';
import { GROUP_ICONS, MoonIcon } from './ui/icons';
import { ERROR_MESSAGES } from './ui/messages';
import { GROUP_NOTES, ResultGroups } from './ui/ResultGroups';
import { SearchPanel } from './ui/SearchPanel';
import { useBarSearch, type SearchRequest } from './ui/useBarSearch';
import { VampireLogo } from './ui/VampireLogo';
import './App.css';
import './ui/ui.css';

const nextRadius = (km: RadiusKm): RadiusKm | undefined => RADIUS_OPTIONS_KM.find((option) => option > km);

export function App() {
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(DEFAULT_RADIUS_KM);
  const { state, search, retry } = useBarSearch();
  const placeInputRef = useRef<HTMLInputElement>(null);

  const runSearch = (request: SearchRequest) => void search(request);

  const widenTo = (km: RadiusKm) => {
    if (state.status !== 'success') return;
    setRadiusKm(km);
    runSearch({ ...state.request, radiusKm: km });
  };

  return (
    <div className="app">
      <header className="masthead">
        <VampireLogo className="masthead__mark" size={72} />
        <div>
          <h1 className="masthead__title">Day Walker</h1>
          <p className="masthead__tagline">Every bar near you, sorted by when it closes tonight.</p>
        </div>
      </header>

      <main className="app__main">
        <SearchPanel
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          onSearch={runSearch}
          busy={state.status === 'loading'}
          placeInputRef={placeInputRef}
        />

        {/* Present from first paint so screen readers announce loading and result changes (FR-5.1). */}
        <div className="status" role="status" aria-live="polite">
          {state.status === 'loading' && (
            <p className="status__loading">
              <MoonIcon className="status__moon" />
              Looking for bars within {state.request.radiusKm} km…
            </p>
          )}
          {state.status === 'success' && state.total > 0 && (
            <p className="status__summary">
              {state.total} {state.total === 1 ? 'bar' : 'bars'} within {state.request.radiusKm} km of{' '}
              <span className="status__place">{state.placeLabel}</span>
            </p>
          )}
        </div>

        {state.status === 'idle' && <Intro />}

        {state.status === 'error' && (
          <div className="notice notice--error" role="alert">
            <p className="notice__title">{ERROR_MESSAGES[state.errorKind]}</p>
            <p className="notice__body">Your place and radius are still set.</p>
            <button type="button" className="button button--secondary" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {state.status === 'success' && state.total === 0 && (
          <EmptyState
            radiusKm={state.request.radiusKm}
            onWiden={widenTo}
            onTryAnotherPlace={() => placeInputRef.current?.focus()}
          />
        )}

        {state.status === 'success' && state.total > 0 && <ResultGroups groups={state.groups} />}
      </main>

      <footer className="app__footer">
        <p>
          Bar data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
        </p>
      </footer>
    </div>
  );
}

function EmptyState({
  radiusKm,
  onWiden,
  onTryAnotherPlace,
}: {
  radiusKm: RadiusKm;
  onWiden: (km: RadiusKm) => void;
  onTryAnotherPlace: () => void;
}) {
  const wider = nextRadius(radiusKm);
  return (
    <div className="notice">
      <p className="notice__title">No bars found within {radiusKm} km.</p>
      {wider ? (
        <>
          <p className="notice__body">The map may simply have none listed this close. Look a little further out?</p>
          <button type="button" className="button button--secondary" onClick={() => onWiden(wider)}>
            Search within {wider} km
          </button>
        </>
      ) : (
        <>
          <p className="notice__body">That is the widest search. Try a nearby town instead.</p>
          <button type="button" className="button button--secondary" onClick={onTryAnotherPlace}>
            Type another place
          </button>
        </>
      )}
    </div>
  );
}

/** Before the first search: explain the split with the same icons, names and notes the results use. */
function Intro() {
  return (
    <ul className="intro" aria-label="How bars are grouped">
      {CLOSING_GROUPS.filter(({ category }) => category === 'day' || category === 'night').map(
        ({ category, label }) => {
          const Icon = GROUP_ICONS[category];
          return (
            <li key={category} className={`intro__item group--${category}`}>
              <Icon className="group__icon" />
              <span>
                <strong className="intro__label">{label}</strong>
                <span className="intro__note">{GROUP_NOTES[category]}</span>
              </span>
            </li>
          );
        },
      )}
    </ul>
  );
}
