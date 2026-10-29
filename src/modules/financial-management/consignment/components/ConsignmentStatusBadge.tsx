import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  CLOSED: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300",
};

const STATUS_LABELS: Record<string, string> = {
  ALL: "All statuses",
  DRAFT: "Draft",
  PENDING: "Pending",
  ACTIVE: "Active",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

const NEUTRAL_STYLE = "border-border bg-muted text-muted-foreground";

export function consignmentStatusLabel(status?: string | null) {
  const key = String(status ?? "").trim().toUpperCase();
  return STATUS_LABELS[key] ?? (key || "Unknown");
}

export function ConsignmentStatusBadge({ status, className = "" }: { status?: string | null; className?: string }) {
  const key = String(status ?? "").trim().toUpperCase();
  const label = key === "ALL" ? "All statuses" : key || "Unknown";
  return <Badge variant="outline" className={`px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[key] ?? NEUTRAL_STYLE} ${className}`}>{label}</Badge>;
}
