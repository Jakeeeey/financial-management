export interface CashFlowDatePresets {
  today: string;
  monthToDateStart: string;
  lastMonthStart: string;
  lastMonthEnd: string;
  yearToDateStart: string;
}

const REPORTING_TIME_ZONE = "Asia/Manila";

function dateOnly(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCashFlowDatePresets(now: Date = new Date()): CashFlowDatePresets {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORTING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);

  const year = part("year");
  const month = part("month");
  const day = part("day");
  const previousMonthStart = new Date(Date.UTC(year, month - 2, 1));
  const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));

  return {
    today: dateOnly(year, month, day),
    monthToDateStart: dateOnly(year, month, 1),
    lastMonthStart: dateOnly(
      previousMonthStart.getUTCFullYear(),
      previousMonthStart.getUTCMonth() + 1,
      1
    ),
    lastMonthEnd: dateOnly(
      previousMonthEnd.getUTCFullYear(),
      previousMonthEnd.getUTCMonth() + 1,
      previousMonthEnd.getUTCDate()
    ),
    yearToDateStart: dateOnly(year, 1, 1),
  };
}

export function formatCashFlowDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getCashFlowDateRangeError(startDate: string, endDate: string) {
  if (!startDate || !endDate) return "Please select both start and end dates.";
  if (startDate > endDate) return "Start date must be on or before end date.";
  return null;
}
