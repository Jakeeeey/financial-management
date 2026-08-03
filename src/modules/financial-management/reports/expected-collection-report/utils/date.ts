import type { WeekRange } from "../types";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY_PATTERN.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function mondayOf(date: Date): Date {
  const day = date.getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function weekFromDate(date: Date): WeekRange {
  const start = mondayOf(date);
  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(addDays(start, 6)),
  };
}

function manilaToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  ));
}

export function currentManilaWeek(): WeekRange {
  return weekFromDate(manilaToday());
}

export function currentManilaDateOnly(): string {
  return formatDateOnly(manilaToday());
}

export function weekFromStart(startDate: string): WeekRange | null {
  const start = parseDateOnly(startDate);
  return start ? weekFromDate(start) : null;
}

export function formatReportDate(value: string | null | undefined): string {
  const date = value ? parseDateOnly(value) : null;
  if (!date) return "N/A";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function weekdayLabel(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}
