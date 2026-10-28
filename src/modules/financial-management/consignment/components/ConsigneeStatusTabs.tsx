"use client";

import type { ConsignmentWorkspace } from "../types";
import { ConsigneeStatusBadge } from "./ConsigneeStatusBadge";
import { consigneeStatusLabel } from "../utils/consignment-format";

const WORKSPACE_STATUSES: Record<ConsignmentWorkspace, string[]> = {
  consignees: ["ALL", "DRAFT", "PENDING", "ACTIVE", "REJECTED"],
  "my-submissions": ["ALL", "DRAFT", "PENDING", "ACTIVE", "REJECTED"],
  approvals: ["ALL", "PENDING", "ACTIVE", "REJECTED"],
};

export function ConsigneeStatusTabs({ workspace, status, counts, onChange, disabled = false }: {
  workspace: ConsignmentWorkspace;
  status: string;
  counts?: Record<string, number>;
  onChange: (status: string) => void;
  disabled?: boolean;
}) {
  const statuses = WORKSPACE_STATUSES[workspace];
  const total = counts
    ? statuses.filter(value => value !== "ALL").reduce((sum, value) => sum + (counts[value] ?? 0), 0)
    : null;

  return <div role="group" aria-label="Filter consignees by status" className="flex flex-wrap items-center gap-2">
    {statuses.map(value => {
      const active = status === value;
      const count = value === "ALL" ? total : counts?.[value];
      return <button
        key={value}
        type="button"
        aria-pressed={active}
        aria-label={`${consigneeStatusLabel(value)}${count === null || count === undefined ? "" : `, ${count} record${count === 1 ? "" : "s"}`}`}
        disabled={disabled}
        onClick={() => onChange(value)}
        className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30" : "border-transparent hover:bg-muted"}`}
      >
        <ConsigneeStatusBadge status={value} />
        {count !== null && count !== undefined && <span className="min-w-4 text-right text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>}
      </button>;
    })}
  </div>;
}
