import { describe, expect, test } from "vitest";
import { CITY_GRAIN, SKY_NOT_ADDRESS, locality, toCityGrain } from "../src/engine";

describe("locality", () => {
  test("the founder's onboarding line is verbatim", () => {
    expect(SKY_NOT_ADDRESS).toBe("KAIROS wants your sky, not your address.");
  });

  test("every coordinate is held at city grain, a tenth of a degree", () => {
    expect(CITY_GRAIN).toBe(0.1);
    expect(toCityGrain(47.6062)).toBe(47.6);
    expect(toCityGrain(-122.3321)).toBe(-122.3);
    expect(toCityGrain(0.04)).toBe(0);
    expect(Object.is(toCityGrain(-0.04), -0)).toBe(false);
    const precise = locality(35.676191, 139.650311, { name: "Tokyo" });
    expect(precise).toEqual({ latitude: 35.7, longitude: 139.7, name: "Tokyo" });
  });

  test("longitude wraps, latitude off the planet is refused", () => {
    expect(locality(0, 190).longitude).toBe(-170);
    expect(locality(0, -180).longitude).toBe(180);
    expect(() => locality(91, 0)).toThrow(RangeError);
    expect(() => locality(Number.NaN, 0)).toThrow(RangeError);
  });
});
