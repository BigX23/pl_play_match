import { describe, it, expect } from "vitest";
import {
  availabilityGrid,
  periodsForDay,
  PERIODS,
  WEEK_DAYS,
  type Period,
} from "./availability";
import type { DayAvailability } from "./matching-engine";

/** Compact helper: an enabled day with one slot. */
function day(name: string, start: number, end: number): DayAvailability {
  return { day: name, enabled: true, slots: [{ start, end }] };
}

describe("periodsForDay", () => {
  it("returns no periods for undefined or disabled days", () => {
    expect(periodsForDay(undefined).size).toBe(0);
    expect(periodsForDay({ day: "Mon", enabled: false, slots: [{ start: 9, end: 20 }] }).size).toBe(0);
  });

  it("maps an all-day slot to all three buckets", () => {
    const set = periodsForDay(day("Mon", 8, 21));
    expect([...set].sort()).toEqual(["afternoon", "evening", "morning"]);
  });

  it("buckets an evening-only slot as evening", () => {
    const set = periodsForDay(day("Tue", 18, 21));
    expect([...set]).toEqual(["evening"]);
  });

  it("buckets a morning slot as morning only", () => {
    const set = periodsForDay(day("Sat", 6, 11));
    expect([...set]).toEqual(["morning"]);
  });

  it("treats a boundary-touching slot as not covering the next bucket", () => {
    // 12:00–17:00 is exactly the afternoon window: no morning, no evening.
    expect([...periodsForDay(day("Wed", 12, 17))]).toEqual(["afternoon"]);
  });

  it("ignores an empty-slot enabled day", () => {
    expect(periodsForDay({ day: "Fri", enabled: true, slots: [] }).size).toBe(0);
  });
});

describe("availabilityGrid", () => {
  const mine: DayAvailability[] = [
    day("Mon", 18, 21),
    day("Tue", 18, 21),
    { day: "Thu", enabled: true, slots: [{ start: 13, end: 21 }] }, // afternoon + evening
    day("Sat", 6, 11), // morning
  ];
  const theirs: DayAvailability[] = [
    day("Tue", 18, 21),
    day("Wed", 18, 21),
    { day: "Thu", enabled: true, slots: [{ start: 8, end: 21 }] }, // morning + afternoon + evening
    { day: "Sun", enabled: true, slots: [{ start: 13, end: 16 }] }, // afternoon
  ];

  const grid = availabilityGrid(mine, theirs);
  const at = (period: Period, dayName: string) =>
    grid.cells[period][WEEK_DAYS.indexOf(dayName as (typeof WEEK_DAYS)[number])];

  it("exposes the week and the three period rows", () => {
    expect(grid.days).toEqual(WEEK_DAYS);
    expect(grid.periods.map((p) => p.key)).toEqual(PERIODS.map((p) => p.key));
    expect(grid.cells.evening).toHaveLength(7);
  });

  it("marks slots where both are free as 'both'", () => {
    expect(at("evening", "Tue")).toBe("both");
    expect(at("evening", "Thu")).toBe("both");
  });

  it("marks one-sided slots as 'you' or 'them'", () => {
    expect(at("evening", "Mon")).toBe("you"); // only mine
    expect(at("evening", "Wed")).toBe("them"); // only theirs
    expect(at("morning", "Sat")).toBe("you"); // only mine
    expect(at("morning", "Thu")).toBe("them"); // only theirs
    expect(at("afternoon", "Thu")).toBe("both"); // both cover afternoon
    expect(at("afternoon", "Sun")).toBe("them");
  });

  it("marks empty slots as 'none'", () => {
    expect(at("morning", "Fri")).toBe("none");
    expect(at("afternoon", "Mon")).toBe("none");
  });

  it("counts shared slots (both Tue & Thu evening + Thu afternoon = 3)", () => {
    expect(grid.sharedCount).toBe(3);
  });

  it("handles empty availability on either side", () => {
    const empty = availabilityGrid(undefined, theirs);
    expect(empty.sharedCount).toBe(0);
    expect(empty.cells.evening.every((c) => c === "them" || c === "none")).toBe(true);
  });
});
