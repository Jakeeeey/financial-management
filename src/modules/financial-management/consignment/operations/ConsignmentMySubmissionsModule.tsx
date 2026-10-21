"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentDocument } from "../providers/consignmentApi";

type SubmissionPage = Awaited<ReturnType<typeof consignmentApi.listMySubmissions>>;

const routes: Record<string, string> = {
  SHIP: "/fm/consignment/stock/shipments", RETURN: "/fm/consignment/stock/returns", ADJ: "/fm/consignment/stock/counts",
  SALE: "/fm/consignment/sales", SRET: "/fm/consignment/sales/customer-returns", DED: "/fm/consignment/sales/memos",
  FEE: "/fm/consignment/listing-fees", AMORT: "/fm/consignment/listing-fees", DELIST: "/fm/consignment/listing-fees",
};

export default function ConsignmentMySubmissionsModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [data, setData] = useState<SubmissionPage | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (target = 0) => {
    setLoading(true); setError("");
    try { const result = await consignmentApi.listMySubmissions(target); setData(result); setPage(result.page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load submissions."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(document: ConsignmentDocument) {
    setWorking(document.documentId); setError(""); setMessage("");
    try { await consignmentApi.submitDocument(document.documentId); setMessage(`Document #${document.documentId} was submitted for review.`); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit the draft."); }
    finally { setWorking(null); }
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_OWN_SUBMISSIONS")) return <main className="p-6 text-sm text-muted-foreground">Consignment submission access is required.</main>;

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">My Submissions</h1><p className="mt-1 text-sm text-muted-foreground">Track drafts and records you submitted for Consignment review.</p></div><Button variant="outline" onClick={() => void load(page)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</Button></div>
      {error && <Alert variant="destructive"><AlertTitle>Could not load submissions</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Submission updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      <section className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[58rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Record</th><th className="px-4 py-3">Date / reference</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Net amount</th><th className="px-4 py-3">Action</th></tr></thead>
          <tbody>{data?.items.map((item) => <tr key={item.documentId} className="border-t"><td className="px-4 py-3 font-medium">{item.documentType} · #{item.documentId}</td><td className="px-4 py-3">{item.documentDate}<div className="text-xs text-muted-foreground">{item.externalReference || "No reference"}</div></td><td className="px-4 py-3">{item.status}{item.rejectionReason && <div className="max-w-xs text-xs text-destructive">{item.rejectionReason}</div>}</td><td className="px-4 py-3 text-right tabular-nums">{item.netAmount == null ? "—" : `₱${item.netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}</td><td className="space-x-2 px-4 py-3">{item.status === "DRAFT" && access.capabilities.includes("CREATE_DOCUMENT") && <Button size="sm" onClick={() => void submit(item)} disabled={working !== null}>{working === item.documentId ? "Submitting…" : "Submit"}</Button>}<Link className="text-primary underline" href={routes[item.documentType] ?? "/fm/consignment/transactions"}>Open</Link></td></tr>)}
          {(!data || data.items.length === 0) && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{loading ? "Loading submissions…" : "No Consignment submissions found."}</td></tr>}</tbody>
        </table>
        {(page > 0 || data?.hasNext) && <div className="flex justify-end gap-2 border-t p-3"><Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={loading || !data?.hasNext}>Next</Button></div>}
      </section>
    </main>
  );
}
