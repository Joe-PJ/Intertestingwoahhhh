import OpeningHours from 'opening_hours';
import type { Bar, Coords } from '../data/types';

/**
 * The single source of truth for the Day Walkers / Night Crawlers split (FR-4.1):
 * a bar closing before this hour (on the clock after the business day's evening)
 * is a Day Walker; closing at or after it — or staying open all night — is a Night Crawler.
 * 0 means midnight.
 */
export const NIGHT_SPLIT_HOUR = 0;

/** The hour a business night ends and the next business day begins (FR-3.2). */
export const BUSINESS_DAY_ROLLOVER_HOUR = 6;

/** Intervals that are open at some point after this hour belong to "tonight". */
const EVENING_START_HOUR = 17;

export type ClosingTonight =
  | { kind: 'closes'; at: Date }
  | { kind: 'allNight' }
  | { kind: 'closedTonight' }
  | { kind: 'unknown' };

export type ClosingCategory = 'day' | 'night' | 'closed' | 'unknown';

export interface BarWithClosing {
  bar: Bar;
  closing: ClosingTonight;
}

export interface ClosingGroup {
  category: ClosingCategory;
  label: string;
  items: BarWithClosing[];
}

/** Display order and headings for the groups (FR-4.2). */
export const CLOSING_GROUPS: readonly { category: ClosingCategory; label: string }[] = [
  { category: 'day', label: 'Day Walkers' },
  { category: 'night', label: 'Night Crawlers' },
  { category: 'closed', label: 'Closed tonight' },
  { category: 'unknown', label: 'Hours unknown' },
];

/** `date`'s calendar day, `dayOffset` days later, at `hour`:00 local time (DST-safe). */
function atHour(date: Date, hour: number, dayOffset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, hour);
}

/**
 * Start of the business night `now` belongs to: today 06:00, or yesterday 06:00
 * when `now` is before 06:00 (so 01:30 on Saturday is still Friday night).
 */
export function businessNightStart(now: Date): Date {
  const dayOffset = now.getHours() < BUSINESS_DAY_ROLLOVER_HOUR ? -1 : 0;
  return atHour(now, BUSINESS_DAY_ROLLOVER_HOUR, dayOffset);
}

/** The instant that separates Day Walkers from Night Crawlers for the business night starting at `start`. */
function nightSplitFor(start: Date): Date {
  return atHour(start, NIGHT_SPLIT_HOUR, NIGHT_SPLIT_HOUR < BUSINESS_DAY_ROLLOVER_HOUR ? 1 : 0);
}

function parse(raw: string, coords?: Coords): OpeningHours | undefined {
  // Coordinates sharpen sunrise/sunset rules, but without a country code the library
  // refuses public-holiday rules ('PH off'); then evaluate without them, as it does by default.
  const attempts = coords ? [{ lat: String(coords.lat), lon: String(coords.lon) }, null] : [null];
  for (const nominatim of attempts) {
    try {
      return new OpeningHours(raw, nominatim, 0);
    } catch {
      // try the next configuration
    }
  }
  return undefined;
}

/**
 * Tonight's closing time for a raw OSM `opening_hours` value (FR-3.1–FR-3.4).
 *
 * "Tonight" is the business night containing `now` (06:00 to the next 06:00). Its open
 * interval is the last one that is open at some point after 17:00, or that contains `now`.
 * Intervals the library only guesses (open end `18:00+`, comments such as "by appointment")
 * yield 'unknown' rather than a made-up time.
 */
export function closingTimeTonight(raw: string | undefined, now: Date, coords?: Coords): ClosingTonight {
  if (!raw?.trim()) return { kind: 'unknown' };
  const hours = parse(raw, coords);
  if (!hours) return { kind: 'unknown' };

  const start = businessNightStart(now);
  const end = atHour(start, BUSINESS_DAY_ROLLOVER_HOUR, 1);
  const evening = atHour(start, EVENING_START_HOUR);

  let intervals: ReturnType<OpeningHours['getOpenIntervals']>;
  try {
    intervals = hours.getOpenIntervals(start, end);
  } catch {
    return { kind: 'unknown' };
  }

  const tonight = intervals.filter(
    ([from, to]) => to.getTime() > evening.getTime() || (from <= now && now < to),
  );
  const last = tonight.reduce<(typeof tonight)[number] | undefined>(
    (latest, interval) => (!latest || interval[1] > latest[1] ? interval : latest),
    undefined,
  );

  if (!last) return { kind: 'closedTonight' };
  const [, closesAt, isGuess] = last;
  if (isGuess) return { kind: 'unknown' };
  if (closesAt.getTime() >= end.getTime()) return { kind: 'allNight' };
  return { kind: 'closes', at: closesAt };
}

/** Day Walker (closes before midnight) or Night Crawler (midnight or later, or all night) — FR-4.1. */
export function classify(closing: ClosingTonight): ClosingCategory {
  switch (closing.kind) {
    case 'allNight':
      return 'night';
    case 'closedTonight':
      return 'closed';
    case 'unknown':
      return 'unknown';
    case 'closes': {
      // A close always falls after its business night's 06:00 start, so the close itself
      // tells us which night it belongs to (a 02:00 close belongs to the night before).
      const split = nightSplitFor(businessNightStart(closing.at));
      return closing.at.getTime() < split.getTime() ? 'day' : 'night';
    }
  }
}

/** Sort key for a close: all-night sorts after every timed close. */
function closeRank(closing: ClosingTonight): number {
  if (closing.kind === 'closes') return closing.at.getTime();
  if (closing.kind === 'allNight') return Number.POSITIVE_INFINITY;
  return 0; // closed / unknown: ordered by distance only
}

function compareItems(a: BarWithClosing, b: BarWithClosing): number {
  return (
    closeRank(a.closing) - closeRank(b.closing) ||
    a.bar.distanceMeters - b.bar.distanceMeters ||
    a.bar.name.localeCompare(b.bar.name) ||
    a.bar.id.localeCompare(b.bar.id)
  );
}

/**
 * Every bar placed in its group, groups in display order (FR-4.2), each sorted by
 * close time then distance (FR-3.5). All four groups are always returned, possibly empty.
 */
export function groupAndSort(bars: readonly Bar[], now: Date): ClosingGroup[] {
  const groups = CLOSING_GROUPS.map(({ category, label }) => ({ category, label, items: [] as BarWithClosing[] }));
  const byCategory = new Map(groups.map((group) => [group.category, group]));

  for (const bar of bars) {
    const closing = closingTimeTonight(bar.openingHoursRaw, now, { lat: bar.lat, lon: bar.lon });
    byCategory.get(classify(closing))?.items.push({ bar, closing });
  }
  for (const group of groups) group.items.sort(compareItems);
  return groups;
}
