import type { BarWithClosing } from '../domain/closing';
import { formatClosing, formatDistance } from './format';

/** One bar on the timeline: tonight's close first, then who and where (FR-5.4). */
export function BarCard({ item }: { item: BarWithClosing }) {
  const { bar, closing } = item;
  const timed = closing.kind === 'closes' || closing.kind === 'allNight';
  const closeClass = ['bar__close', closing.kind === 'closes' && 'bar__close--time', !timed && 'bar__close--quiet']
    .filter(Boolean)
    .join(' ');
  return (
    <li className="bar">
      <p className={closeClass}>
        {timed && <span className="visually-hidden">Closes </span>}
        {formatClosing(closing)}
      </p>
      <div className="bar__body">
        <h3 className="bar__name">{bar.name}</h3>
        <p className="bar__meta">
          <span>{formatDistance(bar.distanceMeters)} away</span>
          {bar.address && <span>{bar.address}</span>}
        </p>
        {bar.openingHoursRaw && (
          <details className="bar__hours">
            <summary>Hours</summary>
            <code>{bar.openingHoursRaw}</code>
          </details>
        )}
      </div>
    </li>
  );
}
