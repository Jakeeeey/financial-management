/**
 * Philippine Time helpers for Bank Management V2.
 *
 * FSD-ERP-BNK-2026-V1 requires every stored stamp in PHT (UTC+8) and treats a UTC
 * stamp as a critical finding, so these helpers write and read PHT wall clock and
 * never fall back to the server's local zone. Colours and formats are deliberately
 * plain: the module formats amounts through `@/lib/utils`.
 */

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

/** PHT parts of an instant. */
function phtParts(value: Date | number = Date.now()) {
  const shifted = new Date((typeof value === "number" ? value : value.getTime()) + PHT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

/** `YYYY-MM-DD` for the PHT calendar day. */
export function phtDate(value: Date | number = Date.now()): string {
  const p = phtParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** `HH:mm:ss` in PHT. */
export function phtTime(value: Date | number = Date.now()): string {
  const p = phtParts(value);
  return `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
}

/** `YYYY-MM-DDTHH:mm:ss`, the value written to `dateTime` columns. */
export function phtStamp(value: Date | number = Date.now()): string {
  return `${phtDate(value)}T${phtTime(value)}`;
}

/** `YYYY-MM-DD HH:mm:ss`, for display and for the audit log. */
export function phtDisplayStamp(value: string | Date | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const iso = toPhtStampString(value);
  return iso ? iso.replace("T", " ").slice(0, 19) : "—";
}

/** `YYYY-MM-DD HH:mm` for dense table cells. */
export function phtDisplayShort(value: string | Date | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const iso = toPhtStampString(value);
  return iso ? iso.replace("T", " ").slice(0, 16) : "—";
}

/** Today's PHT date, the default for date inputs and date-only filters. */
export function phtToday(): string {
  return phtDate();
}

/**
 * Normalises any stored stamp to `YYYY-MM-DDTHH:mm:ss`.
 *
 * Accepts a Date, epoch ms, a `dateTime` string, or a legacy UTC `timestamp` ending
 * in `Z` (converted to PHT so old rows still render correctly). Returns "" when the
 * value is unparseable.
 */
export function toPhtStampString(value: string | Date | number): string {
  if (value instanceof Date) return phtStamp(value);
  if (typeof value === "number") return phtStamp(value);

  const raw = value.trim();
  if (!raw) return "";

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00`;

  // A stamp carrying no zone is already PHT wall clock: we write PHT, never UTC, so
  // shifting it by +8 would render every new row eight hours into the future.
  if (!raw.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(raw)) {
    const naive = raw.replace(" ", "T");
    return naive.length === 16 ? `${naive}:00` : naive.slice(0, 19);
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return "";
  return phtStamp(parsed);
}

/** `YYYY-MM-DD` of a stored stamp, in PHT. */
export function toPhtDateString(value: string | Date | number | null | undefined): string {
  if (value == null || value === "") return "";
  const iso = toPhtStampString(value);
  return iso ? iso.slice(0, 10) : "";
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2 Nov 2026` for a stored date, in PHT; `—` when there is no date. */
export function phtDateLabel(value: string | Date | number | null | undefined): string {
  const date = toPhtDateString(value);
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTH_LABELS[month - 1] ?? ""} ${year}`;
}

/** Whole days between a stored stamp and now, in PHT. Negative values mean future. */
export function daysSince(value: string | Date | number | null | undefined): number {
  const date = toPhtDateString(value);
  if (!date) return 0;
  const then = Date.parse(`${date}T00:00:00Z`);
  const now = Date.parse(`${phtDate()}T00:00:00Z`);
  return Math.round((now - then) / 86_400_000);
}

/** True when the stored stamp carries a UTC marker, i.e. the legacy shape the FSD flags. */
export function isUtcStamp(value: string | null | undefined): boolean {
  if (!value) return false;
  return /Z$/i.test(value.trim());
}
