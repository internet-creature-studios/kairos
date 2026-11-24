// The moon clock.
//
// The Moon as she actually is tonight, seen from the creature's own sky:
// how much of her is lit, which way the lit side faces, how her face (the
// maria, the moonspots) is turned, and how she is nodding toward or away
// from us (libration). "Semi-accurate" is the founder's standard: faithful,
// not obsessive. Angles are given the way you would draw her for someone
// standing at the place and looking at her: degrees counterclockwise from
// straight up (toward the zenith).

import {
  Body,
  Equator,
  Horizon,
  Illumination,
  Libration,
  MoonPhase,
  RotationAxis,
  SearchRiseSet,
  SiderealTime,
} from "astronomy-engine";
import { observerAt, type Locality } from "./locality";
import type { Instant } from "./substrate";

export const SYNODIC_MONTH_DAYS = 29.530588853;

export const MOON_PHASES = [
  "new moon",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full moon",
  "waning gibbous",
  "last quarter",
  "waning crescent",
] as const;
export type MoonPhaseName = (typeof MOON_PHASES)[number];

export interface MoonClock {
  /** 0–360: 0 new, 90 first quarter, 180 full, 270 last quarter. */
  readonly phaseAngle: number;
  readonly phaseName: MoonPhaseName;
  /** 0–1: the lit fraction of her disc. */
  readonly illuminated: number;
  readonly waxing: boolean;
  /** Days since the last new moon (approximate). */
  readonly age: number;
  /** Degrees above the horizon, with refraction. */
  readonly altitude: number;
  /** Degrees clockwise from north. */
  readonly azimuth: number;
  readonly up: boolean;
  /** Which way her lit side faces: degrees counterclockwise from straight up. */
  readonly brightLimb: number;
  /** Which way her north pole points (how the moonspots are turned): degrees counterclockwise from straight up. */
  readonly northPole: number;
  /** Her nod, in degrees: positive latitude shows more of her north, positive longitude more of her east limb. */
  readonly libration: { readonly latitude: number; readonly longitude: number };
  readonly nextRise: Instant | null;
  readonly nextSet: Instant | null;
}

const RAD = Math.PI / 180;
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

/** Position angle of point b as seen from point a, from north through east (radians). */
function positionAngle(raA: number, decA: number, raB: number, decB: number): number {
  return Math.atan2(
    Math.cos(decB) * Math.sin(raB - raA),
    Math.sin(decB) * Math.cos(decA) - Math.cos(decB) * Math.sin(decA) * Math.cos(raB - raA),
  );
}

export function moonClock(t: Instant, place: Locality): MoonClock {
  const date = new Date(t);
  const observer = observerAt(place);

  const moon = Equator(Body.Moon, date, observer, true, true);
  const sun = Equator(Body.Sun, date, observer, true, true);
  const sky = Horizon(date, observer, moon.ra, moon.dec, "normal");

  const am = moon.ra * 15 * RAD;
  const dm = moon.dec * RAD;

  // The parallactic angle: how far the celestial north on her disc is turned
  // from the observer's straight up.
  const localSidereal = (SiderealTime(date) + place.longitude / 15) * 15 * RAD;
  const hourAngle = localSidereal - am;
  const lat = place.latitude * RAD;
  const parallactic = Math.atan2(
    Math.sin(hourAngle),
    Math.tan(lat) * Math.cos(dm) - Math.sin(dm) * Math.cos(hourAngle),
  );

  const brightLimbPA = positionAngle(am, dm, sun.ra * 15 * RAD, sun.dec * RAD);

  // Her rotation axis is given in J2000 coordinates, so measure it against
  // her J2000 position. (The ~0.4° of precession since 2000 is far below
  // what a drawing can show.)
  const axis = RotationAxis(Body.Moon, date);
  const moonJ2000 = Equator(Body.Moon, date, observer, false, true);
  const polePA = positionAngle(
    moonJ2000.ra * 15 * RAD,
    moonJ2000.dec * RAD,
    axis.ra * 15 * RAD,
    axis.dec * RAD,
  );

  const phaseAngle = MoonPhase(date);
  const lib = Libration(date);
  const rise = SearchRiseSet(Body.Moon, observer, +1, date, 2);
  const set = SearchRiseSet(Body.Moon, observer, -1, date, 2);

  return {
    phaseAngle,
    phaseName: MOON_PHASES[Math.floor(norm360(phaseAngle + 22.5) / 45) % 8]!,
    illuminated: Illumination(Body.Moon, date).phase_fraction,
    waxing: phaseAngle < 180,
    age: (phaseAngle / 360) * SYNODIC_MONTH_DAYS,
    altitude: sky.altitude,
    azimuth: sky.azimuth,
    up: sky.altitude > 0,
    brightLimb: norm360((brightLimbPA - parallactic) / RAD),
    northPole: norm360((polePA - parallactic) / RAD),
    libration: { latitude: lib.elat, longitude: lib.elon },
    nextRise: rise ? rise.date.getTime() : null,
    nextSet: set ? set.date.getTime() : null,
  };
}
