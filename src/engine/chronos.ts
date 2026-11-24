// Dual citizenship: the chronos frame.
//
// KAIROS fully supports the ordinary calendar. Every instant renders
// correctly in either frame because both are renderings of the same
// substrate instant; nothing is stored twice. The chronos frame is the only
// place a timezone appears, and it is optional: without one, the device's
// own zone is used.

import type { Locality } from "./locality";
import type { Instant } from "./substrate";

export interface ChronosReading {
  /** "Friday" */
  readonly weekday: string;
  /** "November 20, 2026" */
  readonly date: string;
  /** "3:15 PM" */
  readonly time: string;
  /** "PST" */
  readonly zone: string;
  /** "Friday, November 20, 2026, 3:15 PM PST" */
  readonly text: string;
}

export function chronosAt(
  t: Instant,
  zoneOrPlace?: string | Locality,
  locale = "en-US",
): ChronosReading {
  const timeZone = typeof zoneOrPlace === "string" ? zoneOrPlace : zoneOrPlace?.timeZone;
  const parts = new Intl.DateTimeFormat(locale, {
    ...(timeZone && { timeZone }),
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const date = `${get("month")} ${get("day")}, ${get("year")}`;
  const time = `${get("hour")}:${get("minute")} ${get("dayPeriod")}`.trim();
  const zone = get("timeZoneName");
  return { weekday, date, time, zone, text: `${weekday}, ${date}, ${time} ${zone}` };
}
