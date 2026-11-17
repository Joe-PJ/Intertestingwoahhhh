import { describe, expect, it } from 'vitest';
import type { Bar } from '../data/types';
import {
  BUSINESS_DAY_ROLLOVER_HOUR,
  NIGHT_SPLIT_HOUR,
  businessNightStart,
  classify,
  closingTimeTonight,
  groupAndSort,
  type ClosingCategory,
  type ClosingTonight,
} from './closing';

// Fixed local clocks: Friday 20 Nov 2026 20:00, and the same night at Saturday 01:30.
const FRI_2000 = new Date(2026, 10, 20, 20, 0);
const SAT_0130 = new Date(2026, 10, 21, 1, 30);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);

describe('constants', () => {
  it('splits Day from Night at midnight and rolls the business day over at 06:00', () => {
    expect(NIGHT_SPLIT_HOUR).toBe(0);
    expect(BUSINESS_DAY_ROLLOVER_HOUR).toBe(6);
  });
});

describe('businessNightStart', () => {
  it.each([
    ['Friday 20:00', FRI_2000, at(20, 6)],
    ['Saturday 01:30 (still Friday night)', SAT_0130, at(20, 6)],
    ['Saturday 05:59', at(21, 5, 59), at(20, 6)],
    ['Saturday 06:00 (new business day)', at(21, 6), at(21, 6)],
  ])('%s', (_label, now, expected) => {
    expect(businessNightStart(now)).toEqual(expected);
  });
});

describe('closingTimeTonight + classify', () => {
  const cases: [string, string | undefined, Date, ClosingTonight, ClosingCategory][] = [
    ['closes before midnight', 'Mo-Su 16:00-23:00', FRI_2000, { kind: 'closes', at: at(20, 23) }, 'day'],
    ['closes after midnight', 'Fr-Sa 18:00-02:00', FRI_2000, { kind: 'closes', at: at(21, 2) }, 'night'],
    ['after-midnight close, asked at 01:30', 'Fr-Sa 18:00-02:00', SAT_0130, { kind: 'closes', at: at(21, 2) }, 'night'],
    ['closes at 24:00', 'Mo-Su 18:00-24:00', FRI_2000, { kind: 'closes', at: at(21, 0) }, 'night'],
    ['closes at 00:00', 'Mo-Su 18:00-00:00', FRI_2000, { kind: 'closes', at: at(21, 0) }, 'night'],
    ['split across midnight rules', 'Fr 18:00-24:00; Sa 00:00-02:00', FRI_2000, { kind: 'closes', at: at(21, 2) }, 'night'],
    ['lunch and evening sessions use the evening', 'Mo-Su 12:00-14:00,17:00-22:00', FRI_2000, { kind: 'closes', at: at(20, 22) }, 'day'],
    ['open all day into the night', 'Mo-Th 12:00-23:00; Fr,Sa 12:00-01:00', FRI_2000, { kind: 'closes', at: at(21, 1) }, 'night'],
    ['24/7', '24/7', FRI_2000, { kind: 'allNight' }, 'night'],
    ['closes at 06:00 or later', 'Fr 18:00-07:00', FRI_2000, { kind: 'allNight' }, 'night'],
    ['closed on Friday', 'Mo-Th 17:00-23:00; Fr off', FRI_2000, { kind: 'closedTonight' }, 'closed'],
    ['Fr off on its own', 'Fr off', FRI_2000, { kind: 'closedTonight' }, 'closed'],
    ['lunch only', 'Mo-Su 11:00-14:00', FRI_2000, { kind: 'closedTonight' }, 'closed'],
    ['public-holiday rule without a country', 'PH off; Mo-Su 17:00-01:00', FRI_2000, { kind: 'closes', at: at(21, 1) }, 'night'],
    ['by appointment', 'by appointment', FRI_2000, { kind: 'unknown' }, 'unknown'],
    ['comment only', '"call ahead"', FRI_2000, { kind: 'unknown' }, 'unknown'],
    ['open end (closing time only guessed)', 'Mo-Su 18:00+', FRI_2000, { kind: 'unknown' }, 'unknown'],
    ['garbage', 'whenever lol ;;', FRI_2000, { kind: 'unknown' }, 'unknown'],
    ['blank', '   ', FRI_2000, { kind: 'unknown' }, 'unknown'],
    ['missing', undefined, FRI_2000, { kind: 'unknown' }, 'unknown'],
  ];

  it.each(cases)('%s: %s', (_label, raw, now, expected, category) => {
    const closing = closingTimeTonight(raw, now, { lat: 52.52, lon: 13.405 });
    expect(closing).toEqual(expected);
    expect(classify(closing)).toBe(category);
  });

  it('gives the same answer with or without coordinates', () => {
    expect(closingTimeTonight('Fr-Sa 18:00-02:00', FRI_2000)).toEqual({ kind: 'closes', at: at(21, 2) });
  });

  it('classifies 23:59 as day and exactly 00:00 as night', () => {
    expect(classify({ kind: 'closes', at: at(20, 23, 59) })).toBe('day');
    expect(classify({ kind: 'closes', at: at(21, 0) })).toBe('night');
    expect(classify({ kind: 'closes', at: at(21, 5, 59) })).toBe('night');
  });
});

describe('groupAndSort', () => {
  let seq = 0;
  const bar = (name: string, openingHoursRaw: string | undefined, distanceMeters: number): Bar => ({
    id: `node/${++seq}`,
    name,
    lat: 52.52,
    lon: 13.405,
    openingHoursRaw,
    distanceMeters,
  });

  const fixture: Bar[] = [
    bar('Late Owl', 'Mo-Su 18:00-03:00', 900),
    bar('Mystery', undefined, 300),
    bar('Early Bird', 'Mo-Su 11:00-21:00', 1500),
    bar('Always On', '24/7', 2000),
    bar('Shut Friday', 'Mo-Th 17:00-23:00; Fr off', 100),
    bar('Ten Near', 'Mo-Su 16:00-22:00', 200),
    bar('Ten Far', 'Mo-Su 16:00-22:00', 800),
    bar('Two A', 'Fr-Sa 18:00-02:00', 400),
    bar('Midnight', 'Mo-Su 18:00-24:00', 700),
    bar('Garbage', 'whenever lol', 50),
    bar('Eleven', 'Mo-Su 16:00-23:00', 600),
    bar('Two B', 'Fr-Sa 19:00-02:00', 100),
    bar('Night Shift', 'Fr 20:00-08:00', 1200),
    bar('Lunch Spot', 'Mo-Su 11:00-14:00', 500),
    bar('Appointment', 'by appointment', 1000),
    bar('One', 'Mo-Su 17:00-01:00', 1100),
    bar('Half Eleven', 'Mo-Su 17:00-23:30', 300),
    bar('Sunday Only', 'Su 12:00-20:00', 2500),
    bar('Open End', 'Mo-Su 18:00+', 700),
    bar('Four', 'Mo-Su 20:00-04:00', 50),
  ];

  const names = (groups: ReturnType<typeof groupAndSort>) =>
    groups.map((group) => [group.label, group.items.map((item) => item.bar.name)]);

  const expected = [
    ['Day Walkers', ['Early Bird', 'Ten Near', 'Ten Far', 'Eleven', 'Half Eleven']],
    ['Night Crawlers', ['Midnight', 'One', 'Two B', 'Two A', 'Late Owl', 'Four', 'Night Shift', 'Always On']],
    ['Closed tonight', ['Shut Friday', 'Lunch Spot', 'Sunday Only']],
    ['Hours unknown', ['Garbage', 'Mystery', 'Open End', 'Appointment']],
  ];

  it('orders all 20 bars by group, then close time, then distance', () => {
    expect(fixture).toHaveLength(20);
    expect(names(groupAndSort(fixture, FRI_2000))).toEqual(expected);
  });

  it('orders the same way at 01:30 the same night', () => {
    expect(names(groupAndSort(fixture, SAT_0130))).toEqual(expected);
  });

  it('returns all four groups in display order even when empty', () => {
    const groups = groupAndSort([], FRI_2000);
    expect(groups.map((group) => group.category)).toEqual(['day', 'night', 'closed', 'unknown']);
    expect(groups.every((group) => group.items.length === 0)).toBe(true);
  });
});
