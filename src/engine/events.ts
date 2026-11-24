// Events: futures are predicted, pasts are proven.
//
// An event has exactly two entered facts: a predicted start and a length
// estimate. There is no end field, so no end can ever be entered by hand.
// When the thing actually begins its start is engraved; when it is over its
// end is engraved too, reconstructed from receipts (which receipts, and how
// the creature confirms them, is still the founder's open question 3; the
// engine only refuses to engrave anything in the future).
//
// No fences: overlapping plans are allowed and are information, not errors.
// When something runs long, the flexible events after it breathe and glide
// rather than collide; fixed events (a meeting with others) hold their place.

import type { Locality } from "./locality";
import { positionAt, type Position } from "./position";
import { creatureDayAt, type CreatureDay } from "./calendar";
import type { Duration, Instant } from "./substrate";

export interface KairosEvent {
  readonly id: string;
  readonly title: string;
  /** When it is expected to begin. A prediction, never a fence. */
  readonly predictedStart: Instant;
  /** How long it is expected to take. */
  readonly lengthEstimate: Duration;
  /** Flexible events glide when something before them runs long. */
  readonly flexible?: boolean;
  /** When it actually began. Set by engraving only. */
  readonly engravedStart?: Instant;
  /** When it actually ended. Set by engraving only. */
  readonly engravedEnd?: Instant;
  /** Who is in it and where they are, for rendering in each one's own sky. */
  readonly participants?: readonly Participant[];
}

export interface Participant {
  readonly name: string;
  readonly place: Locality;
}

/**
 * predicted  : not begun; its start is still a prediction.
 * underway   : start engraved, within its estimate.
 * trailing   : start engraved, past its estimate, no end receipt yet; it
 *              stays soft at its trailing edge, honestly.
 * proven     : start and end both engraved.
 * unwitnessed: its time has passed with no engraving. Weather, not failure.
 */
export type EventPhase = "predicted" | "underway" | "trailing" | "proven" | "unwitnessed";

export function phaseOf(e: KairosEvent, now: Instant): EventPhase {
  if (e.engravedEnd !== undefined) return "proven";
  if (e.engravedStart !== undefined)
    return now < e.engravedStart + e.lengthEstimate ? "underway" : "trailing";
  return now < e.predictedStart + e.lengthEstimate ? "predicted" : "unwitnessed";
}

export class EngravingError extends Error {}

export function engraveStart(e: KairosEvent, at: Instant, now: Instant): KairosEvent {
  if (at > now) throw new EngravingError("a start can only be engraved once it has happened");
  if (e.engravedEnd !== undefined && at > e.engravedEnd)
    throw new EngravingError("a start cannot come after its engraved end");
  return { ...e, engravedStart: at };
}

export function engraveEnd(e: KairosEvent, at: Instant, now: Instant): KairosEvent {
  if (e.engravedStart === undefined)
    throw new EngravingError("an end can only be engraved after the start is");
  if (at > now) throw new EngravingError("an end can only be engraved once it has happened");
  if (at < e.engravedStart) throw new EngravingError("an end cannot come before its start");
  return { ...e, engravedEnd: at };
}

export interface Placement {
  readonly event: KairosEvent;
  readonly phase: EventPhase;
  /** Where it renders now: engraved, glided, or as predicted. */
  readonly start: Instant;
  /** Where its end is expected or proven. */
  readonly end: Instant;
  /** True only when the end is engraved; otherwise draw it as a soft, fading edge. */
  readonly endIsEngraved: boolean;
  /** How far it has glided later than predicted, to make room. 0 if it has not. */
  readonly glided: Duration;
}

const plannedEnd = (e: KairosEvent) => e.predictedStart + e.lengthEstimate;

/**
 * Lays out events as they stand now. A flexible event that has not begun
 * glides later just far enough to begin after the events planned to finish
 * before it; any slack between them is breathing room that absorbs an
 * overrun first. Events planned to overlap are left overlapping, calmly.
 * Nothing ever glides earlier than its prediction.
 */
export function glide(events: readonly KairosEvent[], now: Instant): Placement[] {
  // Lay out in the order they were planned, so that everything planned to
  // finish before an event is placed before it, however late it began.
  const order = [...events].sort((a, b) => a.predictedStart - b.predictedStart);
  const placed: Placement[] = [];
  for (const e of order) {
    const phase = phaseOf(e, now);
    let start = e.engravedStart ?? e.predictedStart;
    let glided = 0;
    if (e.flexible && phase === "predicted") {
      let earliest = e.predictedStart;
      for (const p of placed)
        if (plannedEnd(p.event) <= e.predictedStart) earliest = Math.max(earliest, p.end);
      glided = earliest - e.predictedStart;
      start = earliest;
    }
    const endIsEngraved = e.engravedEnd !== undefined;
    const end = e.engravedEnd ?? start + e.lengthEstimate;
    placed.push({ event: e, phase, start, end, endIsEngraved, glided });
  }
  return placed.sort((a, b) => a.start - b.start);
}

export interface ParticipantView {
  readonly participant: Participant;
  readonly day: CreatureDay;
  readonly start: Position;
  readonly end: Position;
  /**
   * What part of this participant's day the event asks for: their Horae,
   * their Vigiliae, or both. A meeting in someone's deep night shows as a
   * vigil, calmly.
   */
  readonly asks: "horae" | "vigiliae" | "both";
}

/** One instant, rendered in each participant's own arc of light. */
export function perParticipant(placement: Pick<Placement, "start" | "end">, participants: readonly Participant[]): ParticipantView[] {
  return participants.map((participant) => {
    const start = positionAt(placement.start, participant.place);
    // The last instant inside the event, so an end exactly at sunset still counts as day.
    const lastInside = Math.max(placement.start, placement.end - 1);
    const end = positionAt(lastInside, participant.place);
    const crossesArc = start.arc.start !== end.arc.start;
    const asks =
      start.kind === "day" && end.kind === "day" && !crossesArc
        ? "horae"
        : start.kind === "night" && end.kind === "night" && !crossesArc
          ? "vigiliae"
          : "both";
    return {
      participant,
      day: creatureDayAt(placement.start, participant.place),
      start,
      end,
      asks,
    };
  });
}
