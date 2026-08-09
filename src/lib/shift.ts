// ============================================================================
// shift.ts — parse the SHIFT_TIMINGS strings into usable start/end times
// and provide helpers for "auto clock-out at shift end".
// ============================================================================
//
// Shift strings look like:
//   "Morning (09:00 - 18:00)"
//   "Evening (14:00 - 23:00)"
//   "Night (22:00 - 07:00)"  ← crosses midnight
//   "Flexible"               ← no auto-clockout
//
// Night shifts that cross midnight are handled correctly:
// if end < start, we treat the end as belonging to the *next* calendar day.

import { SHIFT_TIMINGS } from "@/lib/billzo";

export type ParsedShift = {
  label: string;
  raw: string;
  /** "09:00" — HH:mm (24h) */
  startHM: string | null;
  /** "18:00" — HH:mm (24h) */
  endHM: string | null;
  /** true when endHM < startHM (e.g. 22:00 → 07:00) */
  crossesMidnight: boolean;
  /** "Flexible" or unparseable */
  flexible: boolean;
};

const TIME_RE = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/;

/** Parse a single SHIFT_TIMINGS string into a structured shift. */
export function parseShift(raw?: string | null): ParsedShift {
  const fallback: ParsedShift = {
    label: raw ?? "Flexible",
    raw: raw ?? "",
    startHM: null,
    endHM: null,
    crossesMidnight: false,
    flexible: true,
  };
  if (!raw) return fallback;

  const label = raw.split("(")[0]?.trim() ?? raw;
  const m = TIME_RE.exec(raw);
  if (!m) {
    // "Flexible" or unparseable → no auto-clockout
    return { ...fallback, label };
  }

  const [, sh, sm, eh, em] = m;
  const pad = (n: string) => n.padStart(2, "0");
  const startHM = `${pad(sh!)}:${pad(sm!)}`;
  const endHM = `${pad(eh!)}:${pad(em!)}`;

  const startMins = Number(sh) * 60 + Number(sm);
  const endMins = Number(eh) * 60 + Number(em);

  return {
    label,
    raw,
    startHM,
    endHM,
    crossesMidnight: endMins <= startMins,
    flexible: false,
  };
}

/** Convert "HH:mm" + a base Date into an actual Date object. */
function hmToDate(hm: string, base: Date): Date {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h!, m!, 0, 0);
  return d;
}

/**
 * Given a clock-in timestamp and the agent's shift, compute the *expected*
 * clock-out Date. For night shifts crossing midnight, the end is on the next
 * calendar day.
 *
 * Returns null for flexible / unparseable shifts.
 */
export function expectedClockOut(clockInIso: string, shiftRaw?: string | null): Date | null {
  const shift = parseShift(shiftRaw);
  if (shift.flexible || !shift.endHM) return null;

  const clockIn = new Date(clockInIso);
  let end = hmToDate(shift.endHM, clockIn);

  // If the shift crosses midnight and the computed end is before the clock-in,
  // push end to the next day.
  if (end.getTime() <= clockIn.getTime()) {
    end = new Date(end.getTime() + 24 * 3_600_000);
  }
  return end;
}

/**
 * Decide whether an open attendance record (clock_in set, clock_out null)
 * should be auto-clocked-out now.
 *
 * Returns the suggested clock-out Date (the expected shift end) when:
 *  - the shift is parseable (not flexible), AND
 *  - now is past the expected shift end.
 *
 * Returns null otherwise.
 */
export function shouldAutoClockOut(clockInIso: string, shiftRaw?: string | null, now: Date = new Date()): Date | null {
  const expected = expectedClockOut(clockInIso, shiftRaw);
  if (!expected) return null;
  if (now.getTime() >= expected.getTime()) return expected;
  return null;
}

/** Human-readable label for the auto-clockout feature, e.g. "Auto clock-out at 07:00". */
export function autoClockOutLabel(shiftRaw?: string | null): string | null {
  const shift = parseShift(shiftRaw);
  if (shift.flexible || !shift.endHM) return null;
  return `Auto clock-out at ${prettyHM(shift.endHM)}`;
}

/** "07:00" → "7:00 AM" */
export function prettyHM(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const period = h! < 12 ? "AM" : "PM";
  let hour12 = h! % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** All known shift presets, pre-parsed for UI dropdowns. */
export const PARSED_SHIFTS = SHIFT_TIMINGS.map((s) => {
  const parsed = parseShift(s);
  return { ...parsed, raw: s };
});
