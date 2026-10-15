"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentDashboardSummary } from "../providers/consignmentApi";

const links = [
  ["My Submissions", "/fm/consignment/my-submissions"],
  ["Approvals", "/fm/consignment/approvals"],
  ["Consignees", "/fm/consignment/consignees"],
  ["Agreements", "/fm/consignment/agreements"],
  ["Stock Position", "/fm/consignment/stock"],
  ["Sales Records", "/fm/consignment/sales"],
  ["Listing Fees", "/fm/consignment/listing-fees"],
  ["Transactions", "/fm/consignment/transactions"],
];

function peso(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function metric(label: string, value: string | number) {
  return <div key={label} className="rounded-lg border bg-card p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div></div>;
}

export default function ConsignmentDashboardModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [summary, setSummary] = useState<ConsignmentDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (accessLoading) return;
    if (!access?.capabilities.includes("VIEW_OPERATIONAL_AREAS")) {
      setLoading(false);
      return;
    }

    let active = true;
    void consignmentApi.getDashboard().then((value) => { if (active) setSummary(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load the dashboard."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [access, accessLoading]);

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_OPERATIONAL_AREAS")) return <main className="p-6 text-sm text-muted-foreground">Consignment operational access is required.</main>;

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Consignment Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Current submissions, consignee activity, inventory, and posted results.</p></div>
        <button type="button" className="h-9 rounded-md border px-3 text-sm" onClick={() => { setLoading(true); setError(""); void consignmentApi.getDashboard().then(setSummary).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load the dashboard.")).finally(() => setLoading(false)); }} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {error && <Alert variant="destructive"><AlertTitle>Dashboard unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metric("Pending submissions", summary?.pendingSubmissions ?? (loading ? "…" : 0))}
        {metric("Pending approvals", summary?.pendingApprovals ?? (loading ? "…" : "—"))}
        {metric("Posted transactions", summary?.postedTransactions ?? (loading ? "…" : 0))}
        {metric("Active consignees", summary?.activeConsignees ?? (loading ? "…" : 0))}
        {metric("Active agreements", summary?.activeAgreements ?? (loading ? "…" : 0))}
        {metric("Units shipped", summary?.shippedUnits ?? (loading ? "…" : 0))}
        {metric("Gross sales", peso(summary?.salesGrossAmount))}
        {metric("Outstanding billed", peso(summary?.billedAmount))}
        {metric("Returned units", summary?.returnedUnits ?? (loading ? "…" : 0))}
        {metric("Deductions", peso(summary?.deductionsAmount))}
        {metric("Attention items", summary?.attentionItems ?? (loading ? "…" : 0))}
        {metric("Unamortized fees", peso(summary?.unamortizedListingFeeBalance))}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map(([label, href]) => <Link key={href} href={href} className="rounded-lg border p-4 text-sm font-medium hover:bg-muted/50">{label}<span className="ml-2 text-primary">→</span></Link>)}
      </section>
    </main>
  );
}
