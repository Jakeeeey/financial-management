export const FUND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export function fundStatusTone(status: string): string {
  if (status === "ACTIVE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "PENDING") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "REJECTED") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

export function FundStatusBadge({ status }: { status: string }) {
  const label = FUND_STATUS_LABELS[status] || (status ? status.charAt(0) + status.slice(1).toLowerCase() : "Unknown");
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${fundStatusTone(status)}`}>{label}</span>;
}
