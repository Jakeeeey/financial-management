export interface DateRange {
  startDate: string;
  endDate: string;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function currentManilaWeek(): DateRange {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

export function shiftWeek(range: DateRange, amount: number): DateRange {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + amount * 7);
  end.setUTCDate(end.getUTCDate() + amount * 7);
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

export function isValidDateRange(range: DateRange): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate)) return false;
  return range.startDate <= range.endDate;
}

export function formatDateRange(range: DateRange): string {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function todayManilaDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatWerTimestamp(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const raw = value.replace(" ", "T");
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}+08:00`);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return `${new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(date)} PHT (UTC+08:00)`;
}
