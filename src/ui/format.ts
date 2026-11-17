import type { ClosingTonight } from '../domain/closing';

const clockTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const kilometres = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Tonight's close as the user's local clock time, e.g. '2:00 AM' (FR-5.4). */
export function formatClosing(closing: ClosingTonight): string {
  switch (closing.kind) {
    case 'closes':
      return clockTime.format(closing.at);
    case 'allNight':
      return 'Open all night';
    case 'closedTonight':
      return 'Closed';
    case 'unknown':
      return 'No hours';
  }
}

/** Straight-line distance, e.g. '0.8 km'. Anything under 50 m reads '< 0.1 km' rather than '0.0 km'. */
export function formatDistance(meters: number): string {
  if (meters < 50) return `< ${kilometres.format(0.1)} km`;
  return `${kilometres.format(meters / 1000)} km`;
}
