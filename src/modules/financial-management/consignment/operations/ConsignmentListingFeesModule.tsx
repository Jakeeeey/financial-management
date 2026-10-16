"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentListingFeeSchedule } from "../providers/consignmentApi";
import ConsignmentDocumentWorkspace, { type ConsignmentDocumentType } from "./ConsignmentDocumentWorkspace";

const tabs: Array<{ type: ConsignmentDocumentType | "SCHEDULES"; label: string }> = [
  { type: "FEE", label: "Listing Fees" },
  { type: "AMORT", label: "Amortization" },
  { type: "DELIST", label: "Delisting" },
  { type: "SCHEDULES", label: "Fee Schedules" },
];

export default function ConsignmentListingFeesModule() {
  const { access } = useConsignmentAccess();
  const [tab, setTab] = useState<ConsignmentDocumentType | "SCHEDULES">("FEE");
  const [schedules, setSchedules] = useState<Awaited<ReturnType<typeof consignmentApi.listListingFeeSchedules>> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tab !== "SCHEDULES" || !access?.capabilities.includes("VIEW_LEDGER")) return;
    let active = true;
    void consignmentApi.listListingFeeSchedules(page, 50).then((result) => { if (active) setSchedules(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load fee schedules."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [access?.capabilities, page, tab]);

  return (
    <main className="space-y-4 p-6">
      <nav className="flex flex-wrap gap-2 border-b pb-3" aria-label="Listing fee workspaces">{tabs.map((item) => <Button key={item.type} size="sm" variant={tab === item.type ? "default" : "outline"} onClick={() => { setTab(item.type); setPage(0); setLoading(item.type === "SCHEDULES" && Boolean(access?.capabilities.includes("VIEW_LEDGER"))); setError(""); }}>{item.label}</Button>)}</nav>
      {tab !== "SCHEDULES" && <ConsignmentDocumentWorkspace documentType={tab} />}
      {tab === "SCHEDULES" && <section className="space-y-4"><div><h1 className="text-2xl font-semibold">Listing Fee Schedules</h1><p className="mt-1 text-sm text-muted-foreground">Posted fees, amortized balances, and delisting status.</p></div>{!access?.capabilities.includes("VIEW_LEDGER") && <Alert><AlertTitle>Ledger access required</AlertTitle><AlertDescription>Fee schedule balances are visible to Consignment Approvers and Controllers.</AlertDescription></Alert>}{error && <Alert variant="destructive"><AlertTitle>Fee schedules unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{access?.capabilities.includes("VIEW_LEDGER") && <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[54rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Fee line</th><th className="px-3 py-3">Start month</th><th className="px-3 py-3 text-right">Term</th><th className="px-3 py-3 text-right">Original</th><th className="px-3 py-3 text-right">Monthly</th><th className="px-3 py-3 text-right">Amortized</th><th className="px-3 py-3 text-right">Remaining</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{schedules?.items.map((item: ConsignmentListingFeeSchedule) => <tr key={item.scheduleId} className="border-t"><td className="px-3 py-3">#{item.feeDocumentLineId}</td><td className="px-3 py-3">{item.startMonth}</td><td className="px-3 py-3 text-right">{item.periodMonths} months</td><td className="px-3 py-3 text-right">₱{item.originalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td><td className="px-3 py-3 text-right">₱{item.monthlyAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td><td className="px-3 py-3 text-right">₱{item.amortizedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td><td className="px-3 py-3 text-right">₱{item.remainingAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td><td className="px-3 py-3">{item.delistedAt ? `Delisted ${item.delistedAt}` : "Active"}</td></tr>)}{(!schedules || schedules.items.length === 0) && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{loading ? "Loading fee schedules…" : "No posted listing fee schedules found."}</td></tr>}</tbody></table>{schedules && (page > 0 || schedules.hasNext) && <div className="flex justify-end gap-2 border-t p-3"><Button size="sm" variant="outline" onClick={() => { setLoading(true); setPage((value) => Math.max(0, value - 1)); }} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => { setLoading(true); setPage((value) => value + 1); }} disabled={loading || !schedules.hasNext}>Next</Button></div>}</div>}</section>}
    </main>
  );
}
