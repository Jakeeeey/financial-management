/** Calendar-date formatting shared by the month grid and its day dialog. */

const DAY_MS = 86_400_000;

/** `August 2026`, in a zone that cannot shift the month boundary. */
export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1)),
  );
}

/** `Tuesday, 3 March 2026`. */
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export interface MonthCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Monday-first cells covering the month, padded out to whole weeks. */
export function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const total = Math.ceil((offset + dayCount) / 7) * 7;

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(first.getTime() + (index - offset) * DAY_MS);
    return {
      iso: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month,
    };
  });
}
