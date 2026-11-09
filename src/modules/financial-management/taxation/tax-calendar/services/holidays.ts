/**
 * Philippine working-day rules for the tax calendar.
 *
 * Fixed-date national holidays apply to every year. The movable ones (Holy Week, Eid'l
 * Fitr, Eid'l Adha) are proclaimed annually, so only the proclaimed years are listed;
 * the module shows the caveat instead of guessing a date for a future year.
 */

const FIXED_HOLIDAYS: Array<[number, number, string]> = [
  [1, 1, "New Year's Day"],
  [4, 9, "Araw ng Kagitingan"],
  [5, 1, "Labor Day"],
  [6, 12, "Independence Day"],
  [8, 21, "Ninoy Aquino Day"],
  [11, 30, "Bonifacio Day"],
  [12, 25, "Christmas Day"],
  [12, 30, "Rizal Day"],
];

/** Proclaimed dates, by year. Any year not listed falls back to fixed dates only. */
const PROCLAIMED: Record<number, Array<[string, string]>> = {
  2025: [
    ["2025-04-17", "Maundy Thursday"],
    ["2025-04-18", "Good Friday"],
    ["2025-03-31", "Eid'l Fitr"],
    ["2025-06-06", "Eid'l Adha"],
    ["2025-08-25", "National Heroes Day"],
  ],
  2026: [
    ["2026-04-02", "Maundy Thursday"],
    ["2026-04-03", "Good Friday"],
    ["2026-03-20", "Eid'l Fitr"],
    ["2026-05-27", "Eid'l Adha"],
    ["2026-08-31", "National Heroes Day"],
    ["2026-02-25", "EDSA People Power"],
  ],
};

export const HOLIDAY_CAVEAT =
  "Movable holidays (Holy Week, Eid'l Fitr, Eid'l Adha) use the proclaimed dates for 2025 and 2026 only; later years fall back to fixed-date holidays.";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Every holiday name for a year, keyed by `YYYY-MM-DD`. */
export function holidaysFor(year: number): Map<string, string> {
  const map = new Map<string, string>();
  for (const [month, day, name] of FIXED_HOLIDAYS) {
    map.set(`${year}-${pad(month)}-${pad(day)}`, name);
  }
  for (const [iso, name] of PROCLAIMED[year] ?? []) {
    map.set(iso, name);
  }
  return map;
}

function isWeekend(iso: string): boolean {
  const weekday = parseIso(iso).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** The reason a date does not count as a working day, or null when it does. */
export function nonWorkingReason(iso: string, holidays: Map<string, string>): string | null {
  if (isWeekend(iso)) return "Falls on a weekend";
  const holiday = holidays.get(iso);
  return holiday ? `Falls on ${holiday}` : null;
}

/** Moves a due date forward to the next working day, returning the reason when it moved. */
export function moveToWorkingDay(iso: string, holidays: Map<string, string>): { date: string; reason: string | null } {
  let cursor = parseIso(iso);
  let reason: string | null = null;
  for (let guard = 0; guard < 10; guard += 1) {
    const current = toIso(cursor);
    const blocked = nonWorkingReason(current, holidays);
    if (!blocked) return { date: current, reason };
    reason = reason ?? blocked;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return { date: toIso(cursor), reason };
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(parseIso(iso).getTime() + days * 24 * 60 * 60 * 1000));
}

export function endOfMonth(year: number, month: number): string {
  return toIso(new Date(Date.UTC(year, month, 0)));
}

export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}
