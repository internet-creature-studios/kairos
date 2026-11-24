import { SearchMoonPhase } from "astronomy-engine";
import { describe, expect, test } from "vitest";
import { describePlanet, directionOf, heightOf, nightAround, nightSky } from "../src/engine";
import { seattle, tromso, utc } from "./places";

describe("the night", () => {
  test("on the night of the new moon the deep vigils belong to the Ancient Ones", () => {
    const newMoon = SearchMoonPhase(0, new Date(utc(2026, 11, 1)), 40)!.date.getTime();
    const sky = nightSky(nightAround(newMoon, seattle), seattle);
    const qualities = sky.vigils.map((v) => v.quality);
    expect(qualities[0]).toBe("twilight"); // dusk
    expect(qualities[11]).toBe("twilight"); // dawn
    expect(qualities.slice(2, 10).every((q) => q === "ancient")).toBe(true);
  });

  test("under the full moon of 24 November 2026 the vigils are moonlit", () => {
    const sky = nightSky(nightAround(utc(2026, 11, 25, 4), seattle), seattle);
    expect(sky.vigils.filter((v) => v.quality === "moonlit").length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...sky.vigils.map((v) => v.moonlight))).toBeGreaterThan(0.9);
  });

  test("under the midnight sun there is no Hour of the Ancient Ones", () => {
    const sky = nightSky(nightAround(utc(2026, 6, 21, 22), tromso), tromso);
    expect(sky.vigils.some((v) => v.quality === "ancient")).toBe(false);
  });

  test("the planets of the night of 24 November 2026, over Seattle", () => {
    const sky = nightSky(nightAround(utc(2026, 11, 25, 4), seattle), seattle);
    const planet = (name: string) => sky.planets.find((p) => p.planet === name)!;
    // Saturn, a month past opposition, is an evening planet.
    expect(planet("Saturn").sightings[0]!.vigil).toBeLessThanOrEqual(3);
    // Jupiter and Mars, heading for their 2027 oppositions, ride high before dawn.
    expect(planet("Jupiter").best!.vigil).toBeGreaterThanOrEqual(9);
    expect(planet("Mars").best!.vigil).toBeGreaterThanOrEqual(9);
    // Venus, a month past inferior conjunction, is the morning star.
    expect(planet("Venus").sightings[0]!.vigil).toBeGreaterThanOrEqual(10);
    expect(planet("Venus").magnitude).toBeLessThan(-4);
    for (const p of sky.planets)
      for (const s of p.sightings) expect(s.altitude).toBeGreaterThanOrEqual(5);
    expect(describePlanet(planet("Jupiter"))).toMatch(/^Jupiter: (low|midway up|high) in the [a-z-]+, best around \d+V \(seen \d+V(–\d+V)?\)$/);
  });

  test("plain directions and heights", () => {
    expect(directionOf(0)).toBe("north");
    expect(directionOf(134)).toBe("south-east");
    expect(directionOf(359)).toBe("north");
    expect(directionOf(-90)).toBe("west");
    expect(heightOf(10)).toBe("low");
    expect(heightOf(35)).toBe("midway up");
    expect(heightOf(70)).toBe("high");
  });
});
