/**
 * Philippine Time helpers for the FM taxation desk.
 *
 * Every stored stamp is PHT (UTC+8) wall clock, so these helpers read and write PHT
 * and never fall back to the server's local zone. Copied per module on purpose: this
 * desk has no shared folder.
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
function phtDate(value: Date | number = Date.now()): string {
  const p = phtParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** `HH:mm:ss` in PHT. */
function phtTime(value: Date | number = Date.now()): string {
  const p = phtParts(value);
  return `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
}

/** `YYYY-MM-DDTHH:mm:ss`, the value written to `dateTime` columns. */
export function phtStamp(value: Date | number = Date.now()): string {
  return `${phtDate(value)}T${phtTime(value)}`;
}

/** Today's PHT date, the default for date inputs and year-sensitive defaults. */
export function phtToday(): string {
  return phtDate();
}

/**
 * Normalises any stored stamp to `YYYY-MM-DDTHH:mm:ss`.
 *
 * Accepts a Date, epoch ms, a `dateTime` string, or a legacy UTC stamp ending in `Z`
 * (converted to PHT so old rows still render correctly). Returns "" when unparseable.
 */
function toPhtStampString(value: string | Date | number): string {
  if (value instanceof Date) return phtStamp(value);
  if (typeof value === "number") return phtStamp(value);

  const raw = value.trim();
  if (!raw) return "";

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00`;

  // A stamp carrying no zone is already PHT wall clock: shifting it by +8 would render
  // every stored row eight hours into the future.
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
