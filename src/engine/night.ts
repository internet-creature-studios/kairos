// The night renders honestly.
//
// Each vigil gets a quality: it is moonlit, or it belongs to the Ancient
// Ones (the deep watches when starlight older than life on Earth is plainly
// visible), or it is still twilight. And each night gets a sky summary: which
// planets can be seen during the Vigiliae, where, and how high, in plain
// directions. All of it is computed from the creature's city-grain sky.
//
// The thresholds below are Rowan's v0 rulings, written down so the founder
// can finesse them (the spec leaves the fine mechanics to engineering).

import { Body, Equator, Horizon, Illumination } from "astronomy-engine";
import { observerAt, type Locality } from "./locality";
import { instantIn } from "./position";
import { arcAt, sunAltitude, sunTimeline, type Arc } from "./sun";
import { DAY, type Instant } from "./substrate";

/** The sun's altitude below which the sky is fully dark (astronomical night). */
export const ANCIENT_SUN_ALTITUDE = -18;
/** A moon at least this lit, above the horizon, makes a vigil moonlit. */
export const MOONLIT_MIN_FRACTION = 0.3;
/** Planets lower than this are lost in haze and hills. */
export const PLANET_MIN_ALTITUDE = 5;
/** The sky must be at least this dark (nautical twilight) to call a planet visible. */
export const PLANET_MAX_SUN_ALTITUDE = -6;

export type VigilQuality = "moonlit" | "ancient" | "twilight";

export interface VigilSky {
  readonly vigil: number;
  readonly start: Instant;
  readonly end: Instant;
  readonly quality: VigilQuality;
  /** 0–1: how strongly the Moon lights this vigil, for tinting the night. */
  readonly moonlight: number;
  /** At the vigil's midpoint, degrees. */
  readonly sunAltitude: number;
  /** At the vigil's midpoint, degrees. */
  readonly moonAltitude: number;
}

export const PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"] as const;
export type PlanetName = (typeof PLANETS)[number];

export type Direction =
  | "north" | "north-east" | "east" | "south-east"
  | "south" | "south-west" | "west" | "north-west";
export type Height = "low" | "midway up" | "high";

export interface PlanetSighting {
  readonly vigil: number;
  /** Degrees above the horizon at the vigil's midpoint. */
  readonly altitude: number;
  /** Degrees clockwise from north. */
  readonly azimuth: number;
  readonly direction: Direction;
  readonly height: Height;
}

export interface PlanetNight {
  readonly planet: PlanetName;
  /** Apparent magnitude around the middle of the night (lower is brighter). */
  readonly magnitude: number;
  /** One entry per vigil in which the planet can be seen. */
  readonly sightings: readonly PlanetSighting[];
  /** The highest sighting, or null if the planet is not seen tonight. */
  readonly best: PlanetSighting | null;
}

export interface NightSky {
  readonly night: Arc;
  readonly vigils: readonly VigilSky[];
  readonly planets: readonly PlanetNight[];
}

const COMPASS: readonly Direction[] = [
  "north", "north-east", "east", "south-east",
  "south", "south-west", "west", "north-west",
];

export const directionOf = (azimuth: number): Direction =>
  COMPASS[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8]!;

export const heightOf = (altitude: number): Height =>
  altitude < 20 ? "low" : altitude < 50 ? "midway up" : "high";

/** The night arc holding t, or the next one if t falls in daylight. */
export function nightAround(t: Instant, place: Locality): Arc {
  const here = arcAt(t, place);
  if (here.kind === "night") return here;
  const next = sunTimeline(place, here.end, here.end + DAY).find(
    (a) => a.kind === "night" && a.start >= here.end - 1,
  );
  if (!next) throw new Error("no night found after this day");
  return next;
}

export function nightSky(night: Arc, place: Locality): NightSky {
  const observer = observerAt(place);
  const altitudeOf = (body: Body, t: Instant) => {
    const date = new Date(t);
    const eq = Equator(body, date, observer, true, true);
    return Horizon(date, observer, eq.ra, eq.dec, "normal");
  };

  const vigils: VigilSky[] = [];
  const sightings = new Map<PlanetName, PlanetSighting[]>(PLANETS.map((p) => [p, []]));

  for (let v = 1; v <= 12; v++) {
    const start = instantIn(night, v);
    const end = v === 12 ? night.end : instantIn(night, v + 1);
    const mid = (start + end) / 2;

    const sunMid = sunAltitude(mid, observer);
    const moonAlt = altitudeOf(Body.Moon, mid).altitude;
    const lit = Illumination(Body.Moon, new Date(mid)).phase_fraction;
    const moonlight = lit * Math.min(Math.max(moonAlt / 10, 0), 1);

    let quality: VigilQuality;
    if (moonAlt > 0 && lit >= MOONLIT_MIN_FRACTION) quality = "moonlit";
    else if (
      sunAltitude(start, observer) <= ANCIENT_SUN_ALTITUDE &&
      sunAltitude(end, observer) <= ANCIENT_SUN_ALTITUDE
    )
      quality = "ancient";
    else quality = "twilight";

    vigils.push({ vigil: v, start, end, quality, moonlight, sunAltitude: sunMid, moonAltitude: moonAlt });

    if (sunMid > PLANET_MAX_SUN_ALTITUDE) continue;
    for (const planet of PLANETS) {
      const hor = altitudeOf(Body[planet], mid);
      if (hor.altitude < PLANET_MIN_ALTITUDE) continue;
      sightings.get(planet)!.push({
        vigil: v,
        altitude: hor.altitude,
        azimuth: hor.azimuth,
        direction: directionOf(hor.azimuth),
        height: heightOf(hor.altitude),
      });
    }
  }

  const middle = new Date((night.start + night.end) / 2);
  const planets = PLANETS.map((planet): PlanetNight => {
    const seen = sightings.get(planet)!;
    const best = seen.reduce<PlanetSighting | null>(
      (top, s) => (top === null || s.altitude > top.altitude ? s : top),
      null,
    );
    return { planet, magnitude: Illumination(Body[planet], middle).mag, sightings: seen, best };
  });

  return { night, vigils, planets };
}

/**
 * A plain line for one planet: "Jupiter: high in the south-east, best
 * around 9V (seen 4V–12V)". Placeholder wording until the founder strikes
 * the voice.
 */
export function describePlanet(p: PlanetNight): string | null {
  if (!p.best) return null;
  const first = p.sightings[0]!.vigil;
  const last = p.sightings[p.sightings.length - 1]!.vigil;
  const span = first === last ? `${first}V` : `${first}V–${last}V`;
  return `${p.planet}: ${p.best.height} in the ${p.best.direction}, best around ${p.best.vigil}V (seen ${span})`;
}
