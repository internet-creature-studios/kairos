// Layer 1: the substrate.
//
// The atom governs the rock. Every instant KAIROS stores or reasons about is
// a count of milliseconds since the Unix epoch, 1970-01-01T00:00:00Z: the
// same count every device clock already speaks, so nothing is converted on
// the way in. Durations live here too. Nothing in this layer knows about
// sunrise, timezones, weekdays or names; those are Layer 2, the rendering.
//
// (Unix time skips leap seconds, so it trails true atomic time by 27 s since
// 1972. No leap second has been added since 2016 and they are to be retired
// by 2035, so the two now tick together. Noted in docs/decisions.md.)

/** A single planet-wide moment: milliseconds since the Unix epoch. */
export type Instant = number;

/** A length of physical time, in milliseconds. */
export type Duration = number;

export const SECOND: Duration = 1_000;
export const MINUTE: Duration = 60_000;
export const HOUR: Duration = 3_600_000;
export const DAY: Duration = 86_400_000;

export const isInstant = (t: unknown): t is Instant =>
  typeof t === "number" && Number.isFinite(t);
