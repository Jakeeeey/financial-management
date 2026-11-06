"use client";

export function ReplenishmentStatus({ state }: { state: string }) {
  const styles = state === "PENDING"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : state === "POSTED"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-destructive/30 bg-destructive/10 text-destructive";
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>{state === "PENDING" ? "Pending" : state === "POSTED" ? "Posted" : "Rejected"}</span>;
}
