import { Body, Equator, Horizon, SearchHourAngle, SearchMoonPhase } from "astronomy-engine";
import { describe, expect, test } from "vitest";
import { moonClock, observerAt, type Locality } from "../src/engine";
import { london, seattle, sydney, utc } from "./places";

const RAD = Math.PI / 180;
const angleGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** The direction from the Moon to the Sun on an observer's sky, counterclockwise from up, worked out in horizon coordinates. */
function sunwardFromMoon(t: number, place: Locality): number {
  const date = new Date(t);
  const obs = observerAt(place);
  const toHorizon = (body: Body) => {
    const eq = Equator(body, date, obs, true, true);
    return Horizon(date, obs, eq.ra, eq.dec, "normal");
  };
  const m = toHorizon(Body.Moon);
  const s = toHorizon(Body.Sun);
  // Azimuth runs clockwise; flip it so the position-angle formula's sense matches.
  const am = -m.azimuth * RAD, hm = m.altitude * RAD;
  const as = -s.azimuth * RAD, hs = s.altitude * RAD;
  const pa = Math.atan2(
    Math.cos(hs) * Math.sin(as - am),
    Math.sin(hs) * Math.cos(hm) - Math.cos(hs) * Math.sin(hm) * Math.cos(as - am),
  );
  return ((pa / RAD) % 360 + 360) % 360;
}

describe("the moon clock", () => {
  test("the total lunar eclipse of 3 March 2026 is a full moon", () => {
    const m = moonClock(utc(2026, 3, 3, 11, 33), london);
    expect(m.phaseName).toBe("full moon");
    expect(m.illuminated).toBeGreaterThan(0.99);
  });

  test("phases run new, waxing, full, waning", () => {
    const newMoon = SearchMoonPhase(0, new Date(utc(2026, 11, 1)), 40)!.date.getTime();
    const at = (days: number) => moonClock(newMoon + days * 86_400_000, seattle);
    expect(at(0.1).phaseName).toBe("new moon");
    expect(at(4).phaseName).toBe("waxing crescent");
    expect(at(4).waxing).toBe(true);
    expect(at(7.4).phaseName).toBe("first quarter");
    expect(at(14.8).phaseName).toBe("full moon");
    expect(at(22).phaseName).toBe("last quarter");
    expect(at(26).phaseName).toBe("waning crescent");
    expect(at(26).waxing).toBe(false);
    expect(at(4).age).toBeCloseTo(4, 0);
  });

  test("her lit side faces the sun, as seen from the creature's own sky", () => {
    for (const place of [seattle, sydney, london])
      for (let h = 0; h < 30 * 24; h += 29) {
        const t = utc(2026, 11, 1) + h * 3_600_000;
        const m = moonClock(t, place);
        if (m.illuminated > 0.97 || m.illuminated < 0.03) continue; // the lit side is ill-defined
        expect(angleGap(m.brightLimb, sunwardFromMoon(t, place))).toBeLessThan(2);
      }
  });

  test("the moonspots are turned over in the southern hemisphere", () => {
    const transit = (place: Locality) =>
      SearchHourAngle(Body.Moon, observerAt(place), 0, new Date(utc(2026, 11, 24)), +1).time.date.getTime();
    // On the meridian her north points up in Seattle and down in Sydney.
    expect(angleGap(moonClock(transit(seattle), seattle).northPole, 0)).toBeLessThan(30);
    expect(angleGap(moonClock(transit(sydney), sydney).northPole, 180)).toBeLessThan(30);
  });

  test("libration stays within its natural wobble", () => {
    for (let d = 0; d < 60; d += 3) {
      const { libration } = moonClock(utc(2026, 1, 1) + d * 86_400_000, london);
      expect(Math.abs(libration.longitude)).toBeLessThan(8.5);
      expect(Math.abs(libration.latitude)).toBeLessThan(7.5);
    }
  });

  test("moonrise and moonset are found", () => {
    const m = moonClock(utc(2026, 11, 24, 12), seattle);
    expect(m.nextRise).not.toBeNull();
    expect(m.nextSet).not.toBeNull();
  });
});
