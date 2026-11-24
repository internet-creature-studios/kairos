import { describe, expect, test } from "vitest";
import { chronosAt, creatureDayAt, formatPosition, positionAt } from "../src/engine";
import { seattle, tokyo, utc } from "./places";

describe("dual citizenship", () => {
  test("one instant, both frames", () => {
    const t = utc(2026, 11, 24, 23, 15);
    const clock = chronosAt(t, seattle);
    expect(clock.text).toBe("Tuesday, November 24, 2026, 3:15 PM PST");
    const p = positionAt(t, seattle);
    expect(p.kind).toBe("day");
    expect(creatureDayAt(t, seattle).weekdayName).toBe("Marsday");
    expect(formatPosition(p)).toMatch(/^1[01]H \d\d$/);
  });

  test("the chronos frame uses the place's zone when it has one", () => {
    const t = utc(2026, 11, 24, 23, 15);
    expect(chronosAt(t, tokyo).text).toBe("Wednesday, November 25, 2026, 8:15 AM GMT+9");
    expect(chronosAt(t, "UTC").time).toBe("11:15 PM");
  });
});
