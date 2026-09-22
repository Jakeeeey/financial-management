export const LOGISTICS_WER_VISIBLE_STATUSES = ["For Clearance", "Posted"] as const;

export function isLogisticsWerVisibleStatus(status: string | null): boolean {
  const normalized = (status || "").toLowerCase();
  return LOGISTICS_WER_VISIBLE_STATUSES.some((allowedStatus) => allowedStatus.toLowerCase() === normalized);
}

export function dispatchPlanStatusClassName(status: string | null): string {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("cancel") || normalized.includes("reject")) return "border-red-200 bg-red-50 text-red-700";
  if (normalized.includes("post") || normalized.includes("deliver")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized.includes("approval") || normalized.includes("clearance")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

/**
 * Display text for status pills on the Logistics WER page. Every value
 * renders with uppercased first letters. Stored values are unchanged.
 */
export function displayWerStatus(status: string | null): string {
  const normalized = (status || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized
    .split(/[\s_-]+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}
