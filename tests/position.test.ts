import { describe, expect, test } from "vitest";
import {
  arcAt,
  formatPosition,
  instantIn,
  parsePosition,
  positionAt,
  positionIn,
  speak,
} from "../src/engine";
import { london, seattle, utc } from "./places";

describe("temporal hours", () => {
  const day = arcAt(utc(2026, 11, 24, 20), seattle);
  const night = arcAt(utc(2026, 11, 25, 6), seattle);

  test("sunrise opens the first Hora; solar noon opens the seventh", () => {
    expect(formatPosition(positionIn(day, day.start))).toBe("1H 00");
    expect(formatPosition(positionIn(day, (day.start + day.end) / 2))).toBe("7H 00");
    expect(formatPosition(positionIn(day, day.end - 1))).toBe("12H 99");
    expect(formatPosition(positionIn(night, night.start))).toBe("1V 00");
  });

  test("every hour, quarter and unit survives the trip to an instant and back", () => {
    for (const arc of [day, night])
      for (let hour = 1; hour <= 12; hour++)
        for (let units = 0; units < 100; units++) {
          const p = positionIn(arc, instantIn(arc, hour, units));
          expect([p.hour, p.units]).toEqual([hour, units]);
        }
  });

  test("quarters are the smallest named thing", () => {
    const p = positionIn(day, instantIn(day, 8, 63));
    expect(p.quarter).toBe(2);
    expect(p.withinQuarter).toBe(13);
    expect(formatPosition(p, "hour")).toBe("8H");
    expect(formatPosition(p, "quarter")).toBe("8H 50");
    expect(formatPosition(p, "unit")).toBe("8H 63");
    expect(formatPosition(positionIn(day, instantIn(day, 8, 10)), "quarter")).toBe("8H");
  });

  test("hours stretch and shrink with the season", () => {
    const winterDay = positionAt(utc(2026, 12, 21, 12), london);
    const winterNight = positionAt(utc(2026, 12, 21, 23), london);
    expect(winterDay.hourLength).toBeLessThan(40 * 60_000);
    expect(winterNight.hourLength).toBeGreaterThan(80 * 60_000);
    const summerDay = positionAt(utc(2026, 6, 21, 12), london);
    expect(summerDay.hourLength).toBeGreaterThan(80 * 60_000);
  });

  test("spoken forms, as struck", () => {
    expect(speak({ kind: "day", hour: 8 })).toEqual({ short: "eighth", long: "the eighth hour" });
    expect(speak({ kind: "night", hour: 6 })).toEqual({ short: "six-vee", long: "the sixth vigil" });
    expect(speak({ kind: "night", hour: 3 }).long).toBe("the third vigil");
    expect(speak({ kind: "day", hour: 12 }).short).toBe("twelfth");
  });

  test("written positions are read back", () => {
    expect(parsePosition("8H 50")).toEqual({ kind: "day", hour: 8, units: 50 });
    expect(parsePosition("3v")).toEqual({ kind: "night", hour: 3, units: 0 });
    expect(parsePosition("12H07")).toEqual({ kind: "day", hour: 12, units: 7 });
    expect(parsePosition("13H")).toBeNull();
    expect(parsePosition("8 o'clock")).toBeNull();
  });

  test("an instant outside an hour's range is refused", () => {
    expect(() => instantIn(day, 0)).toThrow(RangeError);
    expect(() => instantIn(day, 13)).toThrow(RangeError);
    expect(() => instantIn(day, 5, 100)).toThrow(RangeError);
  });
});
