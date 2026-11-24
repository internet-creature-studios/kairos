// Layer 2: the rendering. Where a creature stands in the day's arc of light.
//
// Each arc divides into 12 temporal hours: the Horae by day ("8H", spoken
// "eighth"), the Vigiliae by night ("3V", spoken "three-vee"; long form
// "the third vigil"). Each hour measures 100 units. Quarters fall at
// 25 / 50 / 75 and are the smallest named thing; below a quarter the count
// runs in plain numbers. These are positions, not durations: an hour of a
// short winter day is shorter than an hour of its long night.

import type { Arc, ArcKind } from "./sun";
import { arcAt } from "./sun";
import type { Locality } from "./locality";
import type { Duration, Instant } from "./substrate";

export const HOURS_PER_ARC = 12;
export const UNITS_PER_HOUR = 100;
export const UNITS_PER_QUARTER = 25;

export type Quarter = 0 | 1 | 2 | 3;

export interface Position {
  readonly arc: Arc;
  readonly kind: ArcKind;
  /** 1–12: which Hora (by day) or Vigilia (by night). */
  readonly hour: number;
  /** 0–99: units elapsed in the hour. */
  readonly units: number;
  /** 0–3: the quarter of the hour; 1, 2, 3 are the named marks 25, 50, 75. */
  readonly quarter: Quarter;
  /** 0–24: the plain count inside the quarter. Carries no name. */
  readonly withinQuarter: number;
  /** Exact temporal hours elapsed in the arc, in [0, 12). */
  readonly elapsed: number;
  /** How long one temporal hour of this arc lasts, in physical time. */
  readonly hourLength: Duration;
}

// A thousandth of a unit is under 3 ms in any real arc; it only absorbs
// floating-point dust, so that 8H 50 converted to an instant and back is
// still 8H 50.
const DUST = 1e-3;

export function positionIn(arc: Arc, t: Instant): Position {
  const span = arc.end - arc.start;
  const raw = ((t - arc.start) / span) * HOURS_PER_ARC;
  const elapsed = Math.min(Math.max(raw, 0), HOURS_PER_ARC - 1e-12);
  const index = Math.floor(elapsed + DUST / UNITS_PER_HOUR);
  const hourIndex = Math.min(index, HOURS_PER_ARC - 1);
  const units = Math.min(
    Math.max(Math.floor((elapsed - hourIndex) * UNITS_PER_HOUR + DUST), 0),
    UNITS_PER_HOUR - 1,
  );
  const quarter = Math.floor(units / UNITS_PER_QUARTER) as Quarter;
  return {
    arc,
    kind: arc.kind,
    hour: hourIndex + 1,
    units,
    quarter,
    withinQuarter: units - quarter * UNITS_PER_QUARTER,
    elapsed,
    hourLength: span / HOURS_PER_ARC,
  };
}

/** Where an instant falls in the sky at a place. */
export function positionAt(t: Instant, place: Locality): Position {
  return positionIn(arcAt(t, place), t);
}

/** The instant at which an arc reaches the given hour and units. */
export function instantIn(arc: Arc, hour: number, units = 0): Instant {
  if (!Number.isInteger(hour) || hour < 1 || hour > HOURS_PER_ARC)
    throw new RangeError(`hour must be 1–12, got ${hour}`);
  if (!(units >= 0 && units < UNITS_PER_HOUR))
    throw new RangeError(`units must be in [0, 100), got ${units}`);
  const fraction = (hour - 1 + units / UNITS_PER_HOUR) / HOURS_PER_ARC;
  return Math.ceil(arc.start + fraction * (arc.end - arc.start));
}

export type Precision = "hour" | "quarter" | "unit";

const letter = (kind: ArcKind) => (kind === "day" ? "H" : "V");

/**
 * Written form: "8H", "8H 50" (to the quarter), "8H 63" (to the unit).
 * At quarter precision a position shows the quarter it is in.
 */
export function formatPosition(p: Position, precision: Precision = "unit"): string {
  const head = `${p.hour}${letter(p.kind)}`;
  if (precision === "hour") return head;
  if (precision === "quarter")
    return p.quarter === 0 ? head : `${head} ${p.quarter * UNITS_PER_QUARTER}`;
  return `${head} ${String(p.units).padStart(2, "0")}`;
}

const ORDINALS = [
  "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
] as const;
const CARDINALS = [
  "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
] as const;

/**
 * Spoken forms, struck by the founder 2026-11-18. By day the hour is a
 * count, spoken as the ordinal ("8H" is "eighth"). By night it is a watch,
 * a call sign ("8V" is "eight-vee"), with an epic long form ("the eighth
 * vigil").
 */
export function speak(p: Pick<Position, "kind" | "hour">): { short: string; long: string } {
  const ordinal = ORDINALS[p.hour - 1]!;
  return p.kind === "day"
    ? { short: ordinal, long: `the ${ordinal} hour` }
    : { short: `${CARDINALS[p.hour - 1]!}-vee`, long: `the ${ordinal} vigil` };
}

export interface WrittenPosition {
  readonly kind: ArcKind;
  readonly hour: number;
  readonly units: number;
}

/** Reads "8H", "8h 50", "3V 07". Returns null for anything else. */
export function parsePosition(text: string): WrittenPosition | null {
  const m = /^\s*(\d{1,2})\s*([hv])\s*(\d{1,2})?\s*$/i.exec(text);
  if (!m) return null;
  const hour = Number(m[1]);
  const units = m[3] === undefined ? 0 : Number(m[3]);
  if (hour < 1 || hour > HOURS_PER_ARC || units >= UNITS_PER_HOUR) return null;
  return { kind: m[2]!.toLowerCase() === "h" ? "day" : "night", hour, units };
}
