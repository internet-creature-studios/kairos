// Locality, not timezones.
//
// Creaturetime lays no grid over the planet: the hours are computed from the
// creature's own sky. So where the creature is matters, but only at the
// grain a sky can show. KAIROS keeps every location at city grain, a tenth
// of a degree (about 11 km), the same grain creature.net's star background
// uses. A tenth of a degree of longitude moves sunrise by 24 seconds, under
// one unit of a temporal hour, so nothing finer is ever needed, and nothing
// finer is ever held. Coordinates are snapped on the way in, whatever their
// source.
//
// A timezone appears only as an optional extra for the chronos frame (the
// ordinary clock), never in creaturetime itself.

import { Observer } from "astronomy-engine";

/** The founder's onboarding line, struck verbatim. Not editable. */
export const SKY_NOT_ADDRESS = "KAIROS wants your sky, not your address.";

/** Degrees. Every latitude and longitude KAIROS holds is a multiple of this. */
export const CITY_GRAIN = 0.1;

export interface Locality {
  /** Degrees, north positive, at city grain. */
  readonly latitude: number;
  /** Degrees, east positive, in (-180, 180], at city grain. */
  readonly longitude: number;
  /** What the creature calls the place, e.g. "Tokyo". */
  readonly name?: string;
  /**
   * IANA zone for the chronos frame only (e.g. "Asia/Tokyo"). When absent,
   * chronos renders in the device's own zone.
   */
  readonly timeZone?: string;
}

/** Rounds degrees to city grain. */
export function toCityGrain(degrees: number): number {
  const snapped = Math.round(degrees / CITY_GRAIN) * CITY_GRAIN;
  // Strip float dust (0.30000000000000004) and negative zero.
  return Number(snapped.toFixed(1)) + 0;
}

function wrapLongitude(degrees: number): number {
  let x = ((degrees + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

/**
 * Makes a Locality, snapped to city grain. Throws on coordinates that are
 * not on Earth.
 */
export function locality(
  latitude: number,
  longitude: number,
  extras: { name?: string; timeZone?: string } = {},
): Locality {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90)
    throw new RangeError(`latitude must be within ±90°, got ${latitude}`);
  if (!Number.isFinite(longitude))
    throw new RangeError(`longitude must be a number, got ${longitude}`);
  return {
    latitude: toCityGrain(latitude),
    longitude: toCityGrain(wrapLongitude(toCityGrain(longitude))),
    ...(extras.name !== undefined && { name: extras.name }),
    ...(extras.timeZone !== undefined && { timeZone: extras.timeZone }),
  };
}

/**
 * The astronomy engine's observer for a locality. Elevation is taken as sea
 * level: the horizon KAIROS uses is the ideal one, not a particular ridge.
 */
export function observerAt(place: Locality): Observer {
  return new Observer(place.latitude, place.longitude, 0);
}
