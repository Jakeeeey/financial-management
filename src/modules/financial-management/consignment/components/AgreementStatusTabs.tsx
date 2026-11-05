"use client";

import { ConsignmentStatusBadge, consignmentStatusLabel } from "./ConsignmentStatusBadge";

const STATUSES = ["ALL", "DRAFT", "PENDING", "ACTIVE", "CLOSED", "REJECTED"];

export function AgreementStatusTabs({ status, counts, onChange, disabled = false }: {
  status: string;
  counts?: Record<string, number>;
  onChange: (status: string) => void;
  disabled?: boolean;
}) {
  const total = counts
    ? STATUSES.filter(value => value !== "ALL").reduce((sum, value) => sum + (counts[value] ?? 0), 0)
    : null;

  return <div role="group" aria-label="Filter agreements by status" className="flex flex-wrap items-center gap-2">
    {STATUSES.map(value => {
      const active = status === value;
      const count = value === "ALL" ? total : counts?.[value];
      return <button
        key={value}
        type="button"
        aria-pressed={active}
        aria-label={`${consignmentStatusLabel(value)}${count === null || count === undefined ? "" : `, ${count} record${count === 1 ? "" : "s"}`}`}
        disabled={disabled}
        onClick={() => onChange(value)}
        className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30" : "border-transparent hover:bg-muted"}`}
      >
        <ConsignmentStatusBadge status={value} />
        {count !== null && count !== undefined && <span className="min-w-4 text-right text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>}
      </button>;
    })}
  </div>;
}
