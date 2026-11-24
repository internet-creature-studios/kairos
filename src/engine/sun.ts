// The arcs of light.
//
// The sun governs the day. Each stretch from sunrise to sunset is a day arc,
// to be divided into 12 Horae; each stretch from sunset to sunrise is a night
// arc, to be divided into 12 Vigiliae. Sunrise and sunset are the standard
// ones: the moment the sun's upper edge meets an ideal sea-level horizon,
// with the usual atmospheric refraction.
//
// Near the poles the sun can stay up, or down, for days or months. A
// stretch like that has no sunrise or sunset to divide, so the engine stands
// in equinox hours for it: day from the sun's 6 o'clock in the morning to its
// 6 o'clock in the evening, by the sun's own hour angle, and night the other
// way round. Those arcs are flagged "midnight-sun" or "polar-night" so a
// surface can say so honestly. What the Horae should *mean* there is the
// founder's to decide (docs/founder-options.md); this keeps the engine
// whole until she does.

import {
  Body,
  Equator,
  Horizon,
  SearchHourAngle,
  SearchRiseSet,
  type Observer,
} from "astronomy-engine";
import { observerAt, type Locality } from "./locality";
import { DAY, HOUR, MINUTE, type Instant } from "./substrate";

export type ArcKind = "day" | "night";

/**
 * "horizon": bounded by a real sunrise and sunset.
 * "midnight-sun" / "polar-night": an equinox stand-in, because the sun did
 * not cross the horizon (it stayed up / stayed down).
 */
export type ArcSource = "horizon" | "midnight-sun" | "polar-night";

export interface Arc {
  readonly kind: ArcKind;
  /** Inclusive. */
  readonly start: Instant;
  /** Exclusive. */
  readonly end: Instant;
  readonly source: ArcSource;
}

interface Boundary {
  readonly at: Instant;
  /** The kind of arc that starts here. */
  readonly begins: ArcKind;
  /** A real sunrise or sunset, rather than an hour-angle stand-in. */
  readonly natural: boolean;
  /** For stand-ins: whether the sun stayed up or stayed down through this stretch. */
  readonly polar?: Exclude<ArcSource, "horizon">;
}

/** No real day or night arc is longer than this; anything longer is polar. */
const LONGEST_NATURAL_ARC = 24 * HOUR;
/** How far beyond a requested range to look for the arcs that hold it. */
const MARGIN = 2 * DAY;

// Sunrises and sunsets, found one UTC day at a time and remembered, so that
// rendering a week or a month does not search the sky again for each hour.
const crossingCache = new Map<string, readonly Boundary[]>();
const CACHE_LIMIT = 8192;

function crossingsOnUtcDay(
  observer: Observer,
  dayIndex: number,
): readonly Boundary[] {
  const key = `${observer.latitude}|${observer.longitude}|${dayIndex}`;
  const hit = crossingCache.get(key);
  if (hit) return hit;

  const from = dayIndex * DAY;
  const to = from + DAY;
  const found: Boundary[] = [];
  let t = from;
  while (t < to) {
    const limitDays = (to - t) / DAY;
    const rise = SearchRiseSet(Body.Sun, observer, +1, new Date(t), limitDays);
    const set = SearchRiseSet(Body.Sun, observer, -1, new Date(t), limitDays);
    const next: Boundary[] = [];
    if (rise) next.push({ at: rise.date.getTime(), begins: "day", natural: true });
    if (set) next.push({ at: set.date.getTime(), begins: "night", natural: true });
    if (next.length === 0) break;
    // The first rise and the first set after t are consecutive events: a
    // second rise cannot come before a set, nor a second set before a rise.
    next.sort((a, b) => a.at - b.at);
    for (const b of next) if (b.at < to) found.push(b);
    t = next[next.length - 1]!.at + MINUTE;
  }

  if (crossingCache.size >= CACHE_LIMIT) {
    const oldest = crossingCache.keys().next().value;
    if (oldest !== undefined) crossingCache.delete(oldest);
  }
  crossingCache.set(key, found);
  return found;
}

function horizonCrossings(
  observer: Observer,
  from: Instant,
  to: Instant,
): Boundary[] {
  const out: Boundary[] = [];
  for (let d = Math.floor(from / DAY); d * DAY < to; d++)
    for (const b of crossingsOnUtcDay(observer, d))
      if (b.at >= from && b.at < to) out.push(b);
  return out;
}

/** The sun's 6 a.m. and 6 p.m. by hour angle: equinox stand-ins for polar stretches. */
function hourAngleBoundaries(
  observer: Observer,
  from: Instant,
  to: Instant,
  polar: Exclude<ArcSource, "horizon">,
): Boundary[] {
  const out: Boundary[] = [];
  let t = from;
  while (t < to) {
    const morning = SearchHourAngle(Body.Sun, observer, 18, new Date(t), +1);
    const evening = SearchHourAngle(Body.Sun, observer, 6, new Date(t), +1);
    const pair: Boundary[] = [
      { at: morning.time.date.getTime(), begins: "day" as const, natural: false, polar },
      { at: evening.time.date.getTime(), begins: "night" as const, natural: false, polar },
    ].sort((a, b) => a.at - b.at);
    for (const b of pair) if (b.at < to) out.push(b);
    t = pair[1]!.at + MINUTE;
  }
  return out;
}

/**
 * Joins a polar stretch's stand-in boundaries to the real sunrise or sunset
 * at either end, so that day and night still alternate: the arc after a real
 * sunrise is a day, the arc before a real sunset is a day, and so on.
 */
function reconcile(
  first: Boundary | undefined,
  inner: Boundary[],
  last: Boundary | undefined,
): Boundary[] {
  const list = [...(first ? [first] : []), ...inner, ...(last ? [last] : [])];
  if (first)
    while (list.length >= 3 && list[1]!.begins === list[0]!.begins)
      list.splice(1, 1);
  if (last)
    while (
      list.length >= 3 &&
      list[list.length - 2]!.begins === list[list.length - 1]!.begins
    )
      list.splice(list.length - 2, 1);
  return list;
}

/** The sun's altitude in degrees (with refraction) at an instant. */
export function sunAltitude(t: Instant, observer: Observer): number {
  const date = new Date(t);
  const eq = Equator(Body.Sun, date, observer, true, true);
  return Horizon(date, observer, eq.ra, eq.dec, "normal").altitude;
}

/**
 * The arcs of light at a place, in order and without gaps, covering at
 * least [from, to].
 */
export function sunTimeline(
  place: Locality,
  from: Instant,
  to: Instant = from,
): Arc[] {
  const observer = observerAt(place);
  const w0 = from - MARGIN;
  const w1 = to + MARGIN;
  const natural = horizonCrossings(observer, w0, w1);

  // Assemble every boundary in the window, replacing polar stretches (no
  // sunrise or sunset for more than a day) with hour-angle stand-ins.
  // In a polar stretch the sun never crosses the horizon, so it is up (or
  // down) throughout: after a sunrise, or before a sunset, it stayed up.
  const after = (b: Boundary) => (b.begins === "day" ? "midnight-sun" : "polar-night");
  const before = (b: Boundary) => (b.begins === "night" ? "midnight-sun" : "polar-night");

  const boundaries: Boundary[] = [];
  if (natural.length === 0) {
    const up = sunAltitude((w0 + w1) / 2, observer) > 0;
    boundaries.push(
      ...hourAngleBoundaries(observer, w0 - DAY, w1 + DAY, up ? "midnight-sun" : "polar-night"),
    );
  } else {
    const head = natural[0]!;
    if (head.at - w0 > LONGEST_NATURAL_ARC) {
      const inner = hourAngleBoundaries(observer, w0 - DAY, head.at - MINUTE, before(head));
      boundaries.push(...reconcile(undefined, inner, head).slice(0, -1));
    }
    for (let i = 0; i < natural.length; i++) {
      const a = natural[i]!;
      const b = natural[i + 1];
      if (b && b.at - a.at > LONGEST_NATURAL_ARC) {
        const inner = hourAngleBoundaries(observer, a.at + MINUTE, b.at - MINUTE, after(a));
        boundaries.push(...reconcile(a, inner, b).slice(0, -1));
      } else {
        boundaries.push(a);
      }
    }
    const tail = natural[natural.length - 1]!;
    if (w1 - tail.at > LONGEST_NATURAL_ARC) {
      boundaries.pop(); // tail, re-added by reconcile
      const inner = hourAngleBoundaries(observer, tail.at + MINUTE, w1 + DAY, after(tail));
      boundaries.push(...reconcile(tail, inner, undefined));
    }
  }

  const arcs: Arc[] = [];
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const a = boundaries[i]!;
    const b = boundaries[i + 1]!;
    if (b.at <= from || a.at > to) continue;
    const real = a.natural && b.natural && b.at - a.at <= LONGEST_NATURAL_ARC;
    const source: ArcSource = real ? "horizon" : (a.polar ?? b.polar ?? "polar-night");
    arcs.push({ kind: a.begins, start: a.at, end: b.at, source });
  }
  return arcs;
}

/** The arc of light holding an instant at a place. */
export function arcAt(t: Instant, place: Locality): Arc {
  const arc = sunTimeline(place, t, t).find((a) => a.start <= t && t < a.end);
  if (!arc) throw new Error(`no arc of light found at ${new Date(t).toISOString()}`);
  return arc;
}
