import { describe, expect, test } from "vitest";
import {
  DAY,
  WEEK,
  chronosAt,
  creatureDayAt,
  creatureDayOn,
  formatCreatureDate,
  formatOrbit,
  formatPosition,
  holidaysOn,
  instantOn,
  positionAt,
  weekdayOfDayNumber,
} from "../src/engine";
import { rome, seattle, sydney, tokyo, tromso, utc } from "./places";

describe("the week and the year", () => {
  test("the week, as struck", () => {
    expect(WEEK).toEqual(["Sunday", "Monday", "Marsday", "Mertaag", "Jeudi", "Kinyobi", "Saturday"]);
    expect(WEEK[weekdayOfDayNumber(0)]).toBe("Jeudi"); // 1970-01-01, a Thursday
  });

  test("O-years count orbits since the epoch, negative before it", () => {
    expect(formatOrbit(56)).toBe("O56");
    expect(formatOrbit(0)).toBe("O0");
    expect(formatOrbit(-1170)).toBe("O−1170");
    expect(creatureDayOn({ year: 2026, month: 11, day: 24 }, seattle).orbit).toBe(56);
    expect(creatureDayOn({ year: 1970, month: 1, day: 1 }, rome).orbit).toBe(0);
    expect(creatureDayOn({ year: 1969, month: 12, day: 31 }, rome).orbit).toBe(-1);
    // Charlemagne crowned in Rome, Christmas Day 800.
    expect(creatureDayOn({ year: 800, month: 12, day: 25 }, rome).orbit).toBe(-1170);
  });

  test("Hatsu-Kinyobi is the second Kinyobi of November", () => {
    const on = (day: number) => holidaysOn(creatureDayOn({ year: 2026, month: 11, day }, seattle));
    expect(on(13)).toEqual(["Hatsu-Kinyobi"]); // first celebrated Fri Nov 13, 2026
    expect(on(6)).toEqual([]);
    expect(on(20)).toEqual([]);
    expect(holidaysOn(creatureDayOn({ year: 2027, month: 11, day: 12 }, seattle))).toEqual(["Hatsu-Kinyobi"]);
  });
});

describe("the creature day", () => {
  test("a Kinyobi vigil before dawn: 05:23 Pacific on Friday 20 November", () => {
    const t = utc(2026, 11, 20, 13, 23);
    const day = creatureDayAt(t, seattle);
    expect(formatCreatureDate(day)).toBe("Kinyobi, November 20, O56");
    expect(positionAt(t, seattle).kind).toBe("night");
    expect(chronosAt(t, seattle).weekday).toBe("Friday");
  });

  test("a day turns over at sunset: night first, then day", () => {
    // Friday 9 p.m. Pacific is already Saturday, and Saturday's date.
    const fridayEvening = utc(2026, 11, 21, 5);
    const saturday = creatureDayAt(fridayEvening, seattle);
    expect(saturday.boundary).toBe("sunset");
    expect(formatCreatureDate(saturday)).toBe("Saturday, November 21, O56");
    expect(chronosAt(fridayEvening, seattle).weekday).toBe("Friday");
    // Friday 3:30 p.m. Pacific, in the last Horae before sunset: still Kinyobi.
    expect(creatureDayAt(utc(2026, 11, 20, 23, 30), seattle).weekdayName).toBe("Kinyobi");
    // The turn is the sunset itself.
    const kinyobi = creatureDayAt(utc(2026, 11, 20, 20), seattle);
    expect(kinyobi.end).toBe(kinyobi.horae.end);
    expect(creatureDayAt(kinyobi.end - 1, seattle).weekdayName).toBe("Kinyobi");
    expect(creatureDayAt(kinyobi.end, seattle).weekdayName).toBe("Saturday");
    // A day is its own night, 1V to 12V, then its Horae, 1H to 12H.
    expect(kinyobi.start).toBe(kinyobi.nightBefore.start);
    expect(formatPosition(positionAt(kinyobi.start, seattle))).toBe("1V 00");
  });

  test("the other turnover policies remain available", () => {
    const fridayEvening = utc(2026, 11, 21, 5);
    expect(creatureDayAt(fridayEvening, seattle, "night-midpoint").weekdayName).toBe("Kinyobi");
    expect(creatureDayAt(fridayEvening, seattle, "sunrise").weekdayName).toBe("Kinyobi");
    const fridayPreDawn = utc(2026, 11, 20, 12);
    expect(creatureDayAt(fridayPreDawn, seattle, "night-midpoint").weekdayName).toBe("Kinyobi");
    expect(creatureDayAt(fridayPreDawn, seattle, "sunrise").weekdayName).toBe("Jeudi");
  });

  test("holidays and the O-year begin at the sunset of their eve", () => {
    // Hatsu-Kinyobi 2026 began at sunset on Thursday 12 November.
    const thursdayNight = utc(2026, 11, 13, 4); // 8 p.m. Pacific, Thursday
    expect(holidaysOn(creatureDayAt(thursdayNight, seattle))).toEqual(["Hatsu-Kinyobi"]);
    // New Year's Eve after dark in Rome is already O57; that afternoon, O56.
    expect(creatureDayAt(utc(2026, 12, 31, 18), rome).orbit).toBe(57);
    expect(creatureDayAt(utc(2026, 12, 31, 14), rome).orbit).toBe(56);
  });

  test("days follow one another without gaps, each holding its own daylight", () => {
    for (const boundary of ["night-midpoint", "sunset", "sunrise"] as const) {
      let day = creatureDayAt(utc(2026, 1, 1, 12), tokyo, boundary);
      for (let i = 0; i < 400; i++) {
        expect(day.start).toBeLessThanOrEqual(day.horae.start);
        expect(day.horae.end).toBeLessThanOrEqual(day.end);
        const next = creatureDayAt(day.end, tokyo, boundary);
        expect(next.start).toBeCloseTo(day.end, -1);
        expect(next.weekday).toBe((day.weekday + 1) % 7);
        day = next;
      }
    }
  });

  test("the date follows the sun on both sides of the planet", () => {
    for (const place of [seattle, sydney, tokyo]) {
      const day = creatureDayOn({ year: 2026, month: 11, day: 24 }, place);
      expect(day.date).toEqual({ year: 2026, month: 11, day: 24 });
      expect(day.weekdayName).toBe("Marsday");
    }
  });

  test("a creature day survives the polar night and the midnight sun", () => {
    for (const t of [utc(2026, 6, 21, 12), utc(2026, 12, 21, 12), utc(2026, 5, 19, 12)]) {
      const day = creatureDayAt(t, tromso);
      expect(day.start).toBeLessThanOrEqual(t);
      expect(day.end).toBeGreaterThan(t);
      expect(day.end - day.start).toBeGreaterThan(0.5 * DAY);
    }
  });

  test("scheduling in creaturetime: a written position on a day becomes an instant", () => {
    const day = creatureDayOn({ year: 2026, month: 11, day: 27 }, seattle);
    expect(day.weekdayName).toBe("Kinyobi");
    const dinner = instantOn(day, { kind: "day", hour: 8, units: 50 });
    expect(formatPosition(positionAt(dinner, seattle))).toBe("8H 50");
    // Kinyobi's vigils are the night that opens it: Thursday evening by the
    // clock, then Friday's pre-dawn. The night after its Horae is Saturday's.
    const evening = instantOn(day, { kind: "night", hour: 3, units: 0 });
    expect(evening).toBeLessThan(day.horae.start);
    expect(chronosAt(evening, seattle).weekday).toBe("Thursday");
    const preDawn = instantOn(day, { kind: "night", hour: 10, units: 0 });
    expect(preDawn).toBeLessThan(day.horae.start);
    expect(chronosAt(preDawn, seattle).weekday).toBe("Friday");
    for (const t of [dinner, evening, preDawn]) expect(creatureDayAt(t, seattle).weekdayName).toBe("Kinyobi");
  });
});
