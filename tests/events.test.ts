import { describe, expect, test } from "vitest";
import {
  EngravingError,
  HOUR,
  MINUTE,
  engraveEnd,
  engraveStart,
  glide,
  perParticipant,
  phaseOf,
  type KairosEvent,
} from "../src/engine";
import { london, seattle, tokyo, utc } from "./places";

const nine = utc(2026, 11, 24, 17); // 9 a.m. in Seattle
const event = (id: string, start: number, length: number, extra: Partial<KairosEvent> = {}): KairosEvent => ({
  id,
  title: id,
  predictedStart: start,
  lengthEstimate: length,
  ...extra,
});

describe("events: futures predicted, pasts proven", () => {
  test("an event moves through its phases only by engraving", () => {
    let e = event("walk", nine, HOUR);
    expect(phaseOf(e, nine - HOUR)).toBe("predicted");
    expect(phaseOf(e, nine + 2 * HOUR)).toBe("unwitnessed");
    e = engraveStart(e, nine + 10 * MINUTE, nine + 15 * MINUTE);
    expect(phaseOf(e, nine + 30 * MINUTE)).toBe("underway");
    expect(phaseOf(e, nine + 2 * HOUR)).toBe("trailing");
    e = engraveEnd(e, nine + 80 * MINUTE, nine + 2 * HOUR);
    expect(phaseOf(e, nine + 2 * HOUR)).toBe("proven");
  });

  test("nothing in the future can be engraved, and ends follow starts", () => {
    const e = event("walk", nine, HOUR);
    expect(() => engraveStart(e, nine + MINUTE, nine)).toThrow(EngravingError);
    expect(() => engraveEnd(e, nine, nine + HOUR)).toThrow(EngravingError);
    const started = engraveStart(e, nine, nine);
    expect(() => engraveEnd(started, nine - MINUTE, nine + HOUR)).toThrow(EngravingError);
    expect(() => engraveEnd(started, nine + 2 * HOUR, nine + HOUR)).toThrow(EngravingError);
  });

  test("an event has no end field to enter", () => {
    const e = event("walk", nine, HOUR);
    expect("end" in e).toBe(false);
  });
});

describe("breathe and glide", () => {
  test("a late start pushes the flexible event right after it", () => {
    const write = engraveStart(event("write", nine, HOUR), nine + 30 * MINUTE, nine + 30 * MINUTE);
    const read = event("read", nine + HOUR, HOUR, { flexible: true });
    const [, b] = glide([read, write], nine + 40 * MINUTE);
    expect(b!.event.id).toBe("read");
    expect(b!.glided).toBe(30 * MINUTE);
    expect(b!.start).toBe(nine + 90 * MINUTE);
    expect(b!.endIsEngraved).toBe(false);
  });

  test("slack between plans absorbs an overrun first", () => {
    const write = engraveStart(event("write", nine, HOUR), nine + 30 * MINUTE, nine + 30 * MINUTE);
    const read = event("read", nine + 3 * HOUR, HOUR, { flexible: true });
    expect(glide([write, read], nine + 40 * MINUTE)[1]!.glided).toBe(0);
  });

  test("fixed events hold their place, and planned overlaps stay overlapping, calmly", () => {
    const write = engraveStart(event("write", nine, HOUR), nine + 30 * MINUTE, nine + 30 * MINUTE);
    const meeting = event("meeting", nine + HOUR, HOUR);
    const call = event("call", nine + 30 * MINUTE, HOUR, { flexible: true });
    const placed = glide([write, meeting, call], nine + 40 * MINUTE);
    expect(placed.find((p) => p.event.id === "meeting")!.glided).toBe(0);
    expect(placed.find((p) => p.event.id === "call")!.glided).toBe(0);
  });

  test("glides chain down a run of back-to-back flexible plans", () => {
    const a = engraveStart(event("a", nine, HOUR), nine + 20 * MINUTE, nine + 20 * MINUTE);
    const b = event("b", nine + HOUR, HOUR, { flexible: true });
    const c = event("c", nine + 2 * HOUR, HOUR, { flexible: true });
    const placed = glide([a, b, c], nine + 30 * MINUTE);
    expect(placed.map((p) => p.glided)).toEqual([0, 20 * MINUTE, 20 * MINUTE]);
  });
});

describe("remote meetings render per participant", () => {
  test("one instant: day in Seattle, a vigil in Tokyo and London", () => {
    const start = utc(2026, 11, 24, 18); // 10 a.m. Seattle, 3 a.m. Tokyo, 6 p.m. London
    const views = perParticipant({ start, end: start + HOUR }, [
      { name: "Seattle friend", place: seattle },
      { name: "Tokyo friend", place: tokyo },
      { name: "London friend", place: london },
    ]);
    expect(views.map((v) => v.asks)).toEqual(["horae", "vigiliae", "vigiliae"]);
    expect(views[0]!.day.weekdayName).toBe("Marsday");
    expect(views[1]!.day.weekdayName).toBe("Mertaag");
    // 6 p.m. Tuesday in London is after its sunset, so already Mertaag there.
    expect(views[2]!.day.weekdayName).toBe("Mertaag");
  });

  test("a meeting across sunset asks for both", () => {
    const start = utc(2026, 11, 24, 15, 30); // London sunset is about 15:55
    const [view] = perParticipant({ start, end: start + HOUR }, [{ name: "London friend", place: london }]);
    expect(view!.asks).toBe("both");
  });
});
