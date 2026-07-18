/**
 * Availability bucketing for the match-compatibility view.
 *
 * The matching engine stores availability as hour-range TimeSlots per weekday.
 * For the "when can we actually play" heatmap we collapse those slots into three
 * human buckets — Morning / Afternoon / Evening — and compute, per day+bucket,
 * whether both players are free, only one, or neither.
 *
 * Pure functions, no I/O — safe to run server-side (the two-player grid is built
 * on the server so a player's raw schedule never reaches the other's client).
 */
import type { DayAvailability, TimeSlot } from "./matching-engine";

export type Period = "morning" | "afternoon" | "evening";
export type CellState = "both" | "you" | "them" | "none";

/** Weekday order used across the app's availability UI. */
export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Bucket boundaries in 24h hours: [startHour, endHour). */
export const PERIODS: { key: Period; label: string; startHour: number; endHour: number }[] = [
  { key: "morning", label: "Morning", startHour: 5, endHour: 12 },
  { key: "afternoon", label: "Afternoon", startHour: 12, endHour: 17 },
  { key: "evening", label: "Evening", startHour: 17, endHour: 23 },
];

export interface AvailabilityGrid {
  days: readonly string[];
  periods: { key: Period; label: string }[];
  /** One row per period; each array is aligned to `days` (length 7). */
  cells: Record<Period, CellState[]>;
  /** Number of day+period slots where both players are free. */
  sharedCount: number;
}

/** True when a slot overlaps a period's hour range at all. */
function slotCoversPeriod(slot: TimeSlot, startHour: number, endHour: number): boolean {
  return Math.min(slot.end, endHour) > Math.max(slot.start, startHour);
}

/** The set of periods a given day's slots cover (empty if the day is off). */
export function periodsForDay(day: DayAvailability | undefined): Set<Period> {
  const out = new Set<Period>();
  if (!day || !day.enabled) return out;
  for (const p of PERIODS) {
    if (day.slots.some((s) => slotCoversPeriod(s, p.startHour, p.endHour))) out.add(p.key);
  }
  return out;
}

function byDay(av: DayAvailability[] | undefined): Map<string, DayAvailability> {
  const m = new Map<string, DayAvailability>();
  for (const d of av ?? []) m.set(d.day, d);
  return m;
}

/**
 * Build the two-player heatmap. For each weekday + period the cell is:
 * `both` (green), `you`/`them` (one side, amber), or `none`.
 */
export function availabilityGrid(
  mine: DayAvailability[] | undefined,
  theirs: DayAvailability[] | undefined
): AvailabilityGrid {
  const mineByDay = byDay(mine);
  const theirsByDay = byDay(theirs);

  const mineSets = new Map(WEEK_DAYS.map((d) => [d, periodsForDay(mineByDay.get(d))]));
  const theirSets = new Map(WEEK_DAYS.map((d) => [d, periodsForDay(theirsByDay.get(d))]));

  const cells = {} as Record<Period, CellState[]>;
  let sharedCount = 0;

  for (const p of PERIODS) {
    cells[p.key] = WEEK_DAYS.map((day) => {
      const mineFree = mineSets.get(day)!.has(p.key);
      const theirFree = theirSets.get(day)!.has(p.key);
      if (mineFree && theirFree) {
        sharedCount++;
        return "both";
      }
      if (mineFree) return "you";
      if (theirFree) return "them";
      return "none";
    });
  }

  return {
    days: WEEK_DAYS,
    periods: PERIODS.map(({ key, label }) => ({ key, label })),
    cells,
    sharedCount,
  };
}
