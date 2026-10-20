"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentDocument } from "../providers/consignmentApi";

type TransactionPage = Awaited<ReturnType<typeof consignmentApi.listTransactions>>;

export default function ConsignmentTransactionsModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [result, setResult] = useState<TransactionPage | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (target = 0) => {
    setLoading(true); setError("");
    try { const data = await consignmentApi.listTransactions({ search: search.trim(), status, documentType, page: target }); setResult(data); setPage(data.page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the transaction register."); }
    finally { setLoading(false); }
  }, [search, status, documentType]);
  useEffect(() => { void load(0); }, [load]);

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_LEDGER")) return <main className="p-6 text-sm text-muted-foreground">Consignment ledger access is required to view the transaction register.</main>;

  return (
    <main className="space-y-6 p-6">
      <div><h1 className="text-2xl font-semibold">Consignment Transactions</h1><p className="mt-1 text-sm text-muted-foreground">Search the Consignment document register and review each record’s lifecycle status.</p></div>
      {error && <Alert variant="destructive"><AlertTitle>Transaction register unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="flex flex-wrap items-end gap-3 rounded-lg border p-4"><label className="min-w-56 flex-1 space-y-1 text-sm"><span>Search</span><input className="h-10 w-full rounded-md border bg-background px-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Document or external reference" /></label><label className="space-y-1 text-sm"><span>Document type</span><select className="h-10 rounded-md border bg-background px-3" value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="">All types</option>{["SHIP", "RETURN", "ADJ", "SALE", "SRET", "DED", "FEE", "AMORT", "DELIST"].map((type) => <option key={type}>{type}</option>)}</select></label><label className="space-y-1 text-sm"><span>Status</span><select className="h-10 rounded-md border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["DRAFT", "PENDING", "POSTED", "REJECTED", "VOIDED"].map((value) => <option key={value}>{value}</option>)}</select></label><Button variant="outline" onClick={() => void load(0)} disabled={loading}>{loading ? "Searching…" : "Search"}</Button></section>
      <section className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[55rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Consignee</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Net</th></tr></thead><tbody>{result?.items.map((item: ConsignmentDocument) => <tr key={item.documentId} className="border-t"><td className="px-4 py-3 font-medium">{item.documentType} · #{item.documentId}</td><td className="px-4 py-3">{item.documentDate}</td><td className="px-4 py-3">#{item.consigneeId}</td><td className="px-4 py-3">{item.externalReference || "—"}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3 text-right tabular-nums">{item.netAmount == null ? "—" : `₱${item.netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}</td></tr>)}{!loading && (!result || result.items.length === 0) && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No transactions found.</td></tr>}{loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading transactions…</td></tr>}</tbody></table>{(page > 0 || result?.hasNext) && <div className="flex justify-end gap-2 border-t p-3"><Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={loading || !result?.hasNext}>Next</Button></div>}</section>
    </main>
  );
}
