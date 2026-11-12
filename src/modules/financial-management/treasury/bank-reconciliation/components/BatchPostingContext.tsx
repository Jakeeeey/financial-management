import type { PostingEntry } from "../posting-types";
import type { CompanyReference } from "../reference-types";
import type { ReconciliationPeriod } from "../setup-types";
import { BankAccountLabel } from "./BankAccountLabel";
import { batchCashEffect, batchStatusCounts, formatBatchCashEffect, readyEntries } from "../utils/batchPosting";

const BLOCKED_REASONS = [
  { key: "needsAccount", label: "Needs account", reason: "set the missing Cash in Bank or offset account in Reconcile." },
  { key: "exported", label: "Exported", reason: "awaiting GL verification; not included in this batch." },
  { key: "pending", label: "Pending", reason: "check or retry the request before continuing." },
  { key: "failed", label: "Failed", reason: "retry or withdraw the attempt." },
] as const;

export function BatchPostingContext({ period, entity, postingDate, dateBlocked, entries }: {
  period: ReconciliationPeriod;
  entity: CompanyReference | null;
  postingDate: string;
  dateBlocked: boolean;
  entries: PostingEntry[];
}) {
  const ready = readyEntries(entries), counts = batchStatusCounts(entries);
  const blocked = BLOCKED_REASONS
    .map(item => ({ ...item, count: counts[item.key] }))
    .filter(item => item.count > 0);
  return <section id="batch-posting-context" aria-label="Batch posting context" className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
    <p className="font-medium"><BankAccountLabel bank={period.bank} /></p>
    <p className="text-muted-foreground">{entity?.name || "Entity not set"} · Period ended {period.periodEnd || "Not set"} · {period.status === "CLOSED" ? "Closed" : "Open"}</p>
    <p>Posting date {postingDate || "Not set"} · {ready.length} Ready · Net cash effect {formatBatchCashEffect(batchCashEffect(entries), period.currency)}</p>
    <p id="batch-posting-scope" className="text-xs text-muted-foreground">Includes all Ready entries in this period, even those hidden by journal filters.</p>
    {blocked.length > 0
      ? <div className="space-y-1 text-xs">
        <p className="font-medium">Blocked: {blocked.map(item => `${item.count} ${item.label}`).join(" · ")}</p>
        <ul className="space-y-1 text-muted-foreground">{blocked.map(item => <li key={item.key}><span className="font-medium">{item.label}:</span> {item.reason}</li>)}</ul>
      </div>
      : <p className="text-xs text-muted-foreground">No blocked entries.</p>}
    {dateBlocked && <p className="text-xs text-destructive">Posting date needs correction before this batch can run.</p>}
  </section>;
}
