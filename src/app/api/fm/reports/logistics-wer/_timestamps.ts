/** Format a timestamp as a timezone-less Philippine wall-clock value for Directus DateTime fields. */
export function formatManilaWallClock(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

/** Serialize a Directus wall-clock value as an explicit Philippine instant. */
export function serializeManilaTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim().replace(" ", "T");
  const explicit = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const date = new Date(explicit ? raw : `${raw}+08:00`);
  return Number.isNaN(date.getTime()) ? null : `${formatManilaWallClock(date)}+08:00`;
}

/** Restore an API instant to the timezone-less database representation. */
export function toManilaWallClock(value: string | null): string | null {
  return serializeManilaTimestamp(value)?.slice(0, 19) ?? null;
}
