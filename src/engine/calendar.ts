// The creature day, the week, and the year.
//
// A creature day holds one daylight arc, its 12 Horae, together with night.
// It turns over at sunset, the oldest reckoning: night first, then day.
// Struck by the founder with Dain, 2026-11-24 (docs/founder-options.md, 1).
// A creature day is its 12 Vigiliae, 1V to 12V, then its 12 Horae, 1H to
// 12H. "Friday night" after dark is already Saturday; the founder's
// "Kinyobi vigil" at 05:23 on a Friday is Kinyobi's own. Holidays and the
// new O-year begin at the sunset of their eve. It needs no clock and no
// timezone, only the sky. The other policies stay available to callers.
//
// Months and days of the month are kept; the days of the week are renamed.
// A day's date is its date in local mean solar time at the middle of its
// daylight: the sun's own calendar for that longitude.
//
// The year is the O-count: complete Earth orbits since the Unix epoch, O for
// the orbit and for zero. November 2026 is O56; before 1970 it runs negative
// on the same floor rule (Charlemagne crowned, Dec 800: O−1170). For now the
// count turns over with the kept calendar's year, on January 1st; whether it
// should instead turn on the true orbital anniversary is an open option.

import type { Arc } from "./sun";
import { sunTimeline } from "./sun";
import type { Locality } from "./locality";
import { instantIn, type WrittenPosition } from "./position";
import { DAY, type Instant } from "./substrate";

/** The week, struck 2026-11-13. Index 0 is Sunday. */
export const WEEK = [
  "Sunday",
  "Monday",
  "Marsday",
  "Mertaag",
  "Jeudi",
  "Kinyobi",
  "Saturday",
] as const;
export type WeekdayName = (typeof WEEK)[number];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** The year 1970 is O0. */
export const EPOCH_YEAR = 1970;

export type DayBoundary = "sunset" | "night-midpoint" | "sunrise";
/** The founder's choice, 2026-11-24: the day turns over at sunset. */
export const DEFAULT_DAY_BOUNDARY: DayBoundary = "sunset";

export interface CivilDate {
  readonly year: number;
  /** 1–12 */
  readonly month: number;
  /** 1–31 */
  readonly day: number;
}

export interface CreatureDay {
  /** Inclusive. */
  readonly start: Instant;
  /** Exclusive. */
  readonly end: Instant;
  readonly boundary: DayBoundary;
  readonly date: CivilDate;
  /** 0–6, Sunday first. */
  readonly weekday: number;
  readonly weekdayName: WeekdayName;
  /** The O-year. */
  readonly orbit: number;
  /** This day's daylight: its 12 Horae. */
  readonly horae: Arc;
  /** The night before the Horae. With days turning at sunset, this day's own Vigiliae. */
  readonly nightBefore: Arc;
  /** The night after the Horae. With days turning at sunset, the next day's Vigiliae. */
  readonly nightAfter: Arc;
}

/** Whole days since the epoch, in local mean solar time at a longitude. */
export function localMeanDayNumber(t: Instant, longitude: number): number {
  // The sun crosses a degree of longitude in 4 minutes.
  return Math.floor((t + longitude * 240_000) / DAY);
}

export function civilFromDayNumber(days: number): CivilDate {
  const d = new Date(days * DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function dayNumberFromCivil(date: CivilDate): number {
  const d = new Date(0);
  d.setUTCFullYear(date.year, date.month - 1, date.day);
  return Math.round(d.getTime() / DAY);
}

/** 1970-01-01 was a Thursday, a Jeudi. */
export const weekdayOfDayNumber = (days: number): number => (((days + 4) % 7) + 7) % 7;

/** The O-year of a kept-calendar year. */
export const orbitOfYear = (year: number): number => year - EPOCH_YEAR;

/** "O56", "O−1170" (with a true minus sign). */
export const formatOrbit = (orbit: number): string =>
  orbit < 0 ? `O−${-orbit}` : `O${orbit}`;

function bounds(
  boundary: DayBoundary,
  before: Arc,
  horae: Arc,
  after: Arc,
): [Instant, Instant] {
  switch (boundary) {
    case "sunset":
      return [before.start, horae.end];
    case "sunrise":
      return [horae.start, after.end];
    case "night-midpoint":
      return [(before.start + before.end) / 2, (after.start + after.end) / 2];
  }
}

function dayFrom(
  boundary: DayBoundary,
  before: Arc,
  horae: Arc,
  after: Arc,
  place: Locality,
): CreatureDay {
  const [start, end] = bounds(boundary, before, horae, after);
  const days = localMeanDayNumber((horae.start + horae.end) / 2, place.longitude);
  const date = civilFromDayNumber(days);
  const weekday = weekdayOfDayNumber(days);
  return {
    start,
    end,
    boundary,
    date,
    weekday,
    weekdayName: WEEK[weekday]!,
    orbit: orbitOfYear(date.year),
    horae,
    nightBefore: before,
    nightAfter: after,
  };
}

/** The creature day holding an instant at a place. */
export function creatureDayAt(
  t: Instant,
  place: Locality,
  boundary: DayBoundary = DEFAULT_DAY_BOUNDARY,
): CreatureDay {
  const arcs = sunTimeline(place, t - 2 * DAY, t + 2 * DAY);
  for (let i = 1; i + 1 < arcs.length; i++) {
    const horae = arcs[i]!;
    if (horae.kind !== "day") continue;
    const day = dayFrom(boundary, arcs[i - 1]!, horae, arcs[i + 1]!, place);
    if (day.start <= t && t < day.end) return day;
  }
  throw new Error(`no creature day found at ${new Date(t).toISOString()}`);
}

/** The creature day carrying a kept-calendar date at a place. */
export function creatureDayOn(
  date: CivilDate,
  place: Locality,
  boundary: DayBoundary = DEFAULT_DAY_BOUNDARY,
): CreatureDay {
  // Local mean noon of that date sits inside its daylight.
  const noon = dayNumberFromCivil(date) * DAY + DAY / 2 - place.longitude * 240_000;
  const arcs = sunTimeline(place, noon - 2 * DAY, noon + 2 * DAY);
  let best: CreatureDay | undefined;
  for (let i = 1; i + 1 < arcs.length; i++) {
    const horae = arcs[i]!;
    if (horae.kind !== "day") continue;
    const day = dayFrom(boundary, arcs[i - 1]!, horae, arcs[i + 1]!, place);
    if (
      day.date.year === date.year &&
      day.date.month === date.month &&
      day.date.day === date.day
    )
      best ??= day;
  }
  return best ?? creatureDayAt(noon, place, boundary);
}

/**
 * The instant a written position falls at, within a creature day:
 * "Kinyobi, 8H 50" or "Kinyobi, 3V". The vigil is taken from whichever of
 * the nights on either side falls inside the day: with days turning at
 * sunset, always the night before the Horae.
 */
export function instantOn(day: CreatureDay, at: WrittenPosition): Instant {
  if (at.kind === "day") return instantIn(day.horae, at.hour, at.units);
  for (const night of [day.nightBefore, day.nightAfter]) {
    const t = instantIn(night, at.hour, at.units);
    if (day.start <= t && t < day.end) return t;
  }
  throw new RangeError(`${at.hour}V is not part of this day`);
}

/** "Kinyobi, November 20, O56" */
export function formatCreatureDate(day: CreatureDay): string {
  return `${day.weekdayName}, ${MONTHS[day.date.month - 1]} ${day.date.day}, ${formatOrbit(day.orbit)}`;
}

/**
 * The calendar's holidays. Hatsu-Kinyobi, the second Kinyobi of November,
 * was struck 2026-11-13 (first celebrated that day). How further holidays
 * enter the calendar is still open.
 */
export function holidaysOn(day: Pick<CreatureDay, "date" | "weekday">): string[] {
  const out: string[] = [];
  const { month, day: dom } = day.date;
  if (month === 11 && day.weekday === 5 && dom >= 8 && dom <= 14) out.push("Hatsu-Kinyobi");
  return out;
}
