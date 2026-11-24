import { describe, expect, test } from "vitest";
import { DAY, HOUR, arcAt, sunTimeline } from "../src/engine";
import { london, longyearbyen, minutes, newYork, quito, seattle, tokyo, tromso, utc } from "./places";

const within = (actual: number, expected: number, toleranceMinutes: number) =>
  expect(Math.abs(minutes(actual - expected))).toBeLessThanOrEqual(toleranceMinutes);

describe("arcs of light", () => {
  test("sunrise and sunset match the published times", () => {
    // New York, winter solstice: 7:16 EST to 4:31 EST.
    const ny = arcAt(utc(2026, 12, 21, 17), newYork);
    expect(ny.kind).toBe("day");
    within(ny.start, utc(2026, 12, 21, 12, 16), 3);
    within(ny.end, utc(2026, 12, 21, 21, 31), 3);
    // London, winter solstice: 08:04 to 15:53 GMT.
    const ldn = arcAt(utc(2026, 12, 21, 12), london);
    within(ldn.start, utc(2026, 12, 21, 8, 4), 3);
    within(ldn.end, utc(2026, 12, 21, 15, 53), 3);
    // Tokyo, summer solstice: 4:25 to 19:00 JST.
    const tyo = arcAt(utc(2026, 6, 21, 3), tokyo);
    within(tyo.start, utc(2026, 6, 20, 19, 25), 3);
    within(tyo.end, utc(2026, 6, 21, 10, 0), 3);
  });

  test("at the equator a day is a little over twelve hours, all year", () => {
    for (const month of [3, 6, 9, 12]) {
      const arc = arcAt(utc(2026, month, 21, 17), quito);
      expect(arc.kind).toBe("day");
      const hours = (arc.end - arc.start) / HOUR;
      expect(hours).toBeGreaterThan(12.0);
      expect(hours).toBeLessThan(12.2);
    }
  });

  test("arcs alternate day and night with no gaps or overlaps", () => {
    for (const [place, from] of [
      [seattle, utc(2026, 1, 1)],
      [tromso, utc(2026, 5, 1)], // into the midnight sun
      [tromso, utc(2026, 7, 10)], // out of it
      [tromso, utc(2026, 11, 15)], // into the polar night
      [longyearbyen, utc(2026, 4, 1)],
    ] as const) {
      const arcs = sunTimeline(place, from, from + 40 * DAY);
      expect(arcs.length).toBeGreaterThan(70);
      for (let i = 1; i < arcs.length; i++) {
        expect(arcs[i]!.start).toBe(arcs[i - 1]!.end);
        expect(arcs[i]!.kind).not.toBe(arcs[i - 1]!.kind);
        expect(arcs[i]!.end).toBeGreaterThan(arcs[i]!.start);
      }
    }
  });

  test("polar stretches get honest equinox stand-ins", () => {
    const summer = arcAt(utc(2026, 6, 21, 12), tromso);
    expect(summer.source).toBe("midnight-sun");
    expect((summer.end - summer.start) / HOUR).toBeCloseTo(12, 0);
    const winter = arcAt(utc(2026, 12, 21, 12), tromso);
    expect(winter.source).toBe("polar-night");
    // An ordinary Tromsø spring day still has a real sunrise and sunset.
    expect(arcAt(utc(2026, 3, 20, 12), tromso).source).toBe("horizon");
    // Every arc in a month of midnight sun says so.
    for (const arc of sunTimeline(tromso, utc(2026, 6, 1), utc(2026, 7, 1)))
      expect(arc.source).toBe("midnight-sun");
  });

  test("an arc holds the instant it was asked about", () => {
    for (let t = utc(2026, 11, 1); t < utc(2026, 11, 4); t += 37 * 60_000) {
      const arc = arcAt(t, seattle);
      expect(arc.start).toBeLessThanOrEqual(t);
      expect(arc.end).toBeGreaterThan(t);
    }
  });
});
