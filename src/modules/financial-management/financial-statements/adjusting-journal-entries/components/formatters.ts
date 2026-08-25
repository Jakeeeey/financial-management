export const balancedTolerance = 0.005;

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function statusBadgeClass(status: string) {
  if (status === "Posted") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "Voided") return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700";
}
