import type { DateRange, ReportPeriod } from "../types";

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

export function weekFromDate(date: Date): DateRange {
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

export function currentManilaWeek(): DateRange {
  return weekFromDate(manilaToday());
}

export function currentManilaDateOnly(): string {
  return formatDateOnly(manilaToday());
}

export function weekFromStart(startDate: string): DateRange | null {
  const start = parseDateOnly(startDate);
  return start ? weekFromDate(start) : null;
}

export function dateRangeForPeriod(period: ReportPeriod, referenceDate: string): DateRange | null {
  const date = parseDateOnly(referenceDate);
  if (!date) return null;

  if (period === "daily") {
    const value = formatDateOnly(date);
    return { startDate: value, endDate: value };
  }

  if (period === "weekly") return weekFromDate(date);

  if (period === "monthly") {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return { startDate: formatDateOnly(start), endDate: formatDateOnly(end) };
  }

  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
  return { startDate: formatDateOnly(start), endDate: formatDateOnly(end) };
}

export function shiftReferenceDate(referenceDate: string, period: ReportPeriod, amount: number): string | null {
  const date = parseDateOnly(referenceDate);
  if (!date) return null;

  if (period === "daily") return formatDateOnly(addDays(date, amount));
  if (period === "weekly") return formatDateOnly(addDays(date, amount * 7));

  if (period === "monthly") {
    return formatDateOnly(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)));
  }

  return formatDateOnly(new Date(Date.UTC(date.getUTCFullYear() + amount, 0, 1)));
}

export function periodLabel(period: ReportPeriod): string {
  return {
    daily: "day",
    weekly: "week",
    monthly: "month",
    yearly: "year",
  }[period];
}

export function formatPeriodRange(period: ReportPeriod, range: DateRange): string {
  if (period === "daily") return `Day of ${formatReportDate(range.startDate)}`;
  if (period === "weekly") return `Week of ${formatReportDate(range.startDate)} - ${formatReportDate(range.endDate)}`;

  const start = parseDateOnly(range.startDate);
  if (!start) return "N/A";
  if (period === "monthly") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(start);
  }

  return String(start.getUTCFullYear());
}

export function datesInRange(range: DateRange): string[] {
  const start = parseDateOnly(range.startDate);
  const end = parseDateOnly(range.endDate);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  for (let date = start; date.getTime() <= end.getTime(); date = addDays(date, 1)) {
    dates.push(formatDateOnly(date));
  }
  return dates;
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

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
  const monthDay = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  return `${weekday} ${monthDay}`;
}
