const HAS_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function formatConsignmentTimestamp(value: string): string {
  const input = value.trim();
  const date = new Date(HAS_TIME_ZONE.test(input) ? input : `${input}+08:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}
