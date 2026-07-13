import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { className: string; label: string }> = {
  draft: { className: "bg-secondary text-secondary-foreground", label: "Draft" },
  pending: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", label: "Pending" },
  approved: { className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Approved" },
  rejected: { className: "bg-destructive text-destructive-foreground", label: "Rejected" },
  cancelled: { className: "bg-muted text-muted-foreground border", label: "Cancelled" },
};

export function PRStatusBadge({ status }: { status: string | null }) {
  const config = STATUS_MAP[status?.toLowerCase() ?? ""] ?? { className: "bg-secondary text-secondary-foreground", label: status ?? "—" };
  return <Badge className={config.className}>{config.label}</Badge>;
}
