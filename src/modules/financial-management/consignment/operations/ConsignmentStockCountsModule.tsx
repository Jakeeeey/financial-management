"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import {
  consignmentApi,
  type ConsignmentAgreement,
  type ConsignmentConsignee,
  type ConsignmentDocumentDetail,
} from "../providers/consignmentApi";
import { todayInManila } from "../controls/control-utils";

type StockPosition = Awaited<ReturnType<typeof consignmentApi.getStockPosition>>[number];

function formatAmount(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }

export default function ConsignmentStockCountsModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [consignees, setConsignees] = useState<ConsignmentConsignee[]>([]);
  const [agreements, setAgreements] = useState<ConsignmentAgreement[]>([]);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [records, setRecords] = useState<Awaited<ReturnType<typeof consignmentApi.listDocuments>> | null>(null);
  const [detail, setDetail] = useState<ConsignmentDocumentDetail | null>(null);
  const [page, setPage] = useState(0);
  const [date, setDate] = useState(todayInManila());
  const [consigneeId, setConsigneeId] = useState("");
  const [agreementId, setAgreementId] = useState("");
  const [reference, setReference] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof consignmentApi.previewDocument>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRecords = useCallback(async (target = 0) => {
    setLoading(true); setError("");
    try { const result = await consignmentApi.listDocuments({ documentType: "ADJ", page: target }); setRecords(result); setPage(result.page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load stock count records."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadRecords(); }, [loadRecords]);
  useEffect(() => {
    let active = true;
    void Promise.all([consignmentApi.listConsignees("", 0, 100), consignmentApi.listAgreements("", 0, 100)])
      .then(([consigneePage, agreementPage]) => { if (active) { setConsignees(consigneePage.items); setAgreements(agreementPage.items); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load count lookups."); });
    return () => { active = false; };
  }, []);

  const eligibleAgreements = useMemo(() => agreements.filter((item) => item.status === "ACTIVE" && (!consigneeId || String(item.consigneeId) === consigneeId)), [agreements, consigneeId]);
  const overages = positions.filter((row) => Number(counts[row.productId] ?? row.quantity) > row.quantity);
  const shortages = positions.flatMap((row) => {
    const shortage = row.quantity - Number(counts[row.productId] ?? row.quantity);
    return shortage > 0 ? [{ ...row, shortage }] : [];
  });

  async function chooseAgreement(value: string) {
    setAgreementId(value); setPositions([]); setCounts({}); setPreview(null);
    if (!value) return;
    setLoading(true); setError("");
    try {
      const result = await consignmentApi.getStockPosition(Number(value));
      setPositions(result); setCounts(Object.fromEntries(result.map((row) => [row.productId, String(row.quantity)])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load book stock for this agreement."); }
    finally { setLoading(false); }
  }

  function inputBody() {
    return {
      documentType: "ADJ",
      documentDate: date,
      consigneeId: Number(consigneeId),
      agreementId: Number(agreementId),
      externalReference: reference.trim(),
      lines: shortages.map((row) => ({ productId: row.productId, productCodeSnapshot: row.productCode, productNameSnapshot: row.productName, quantity: row.shortage })),
    };
  }

  function reset() {
    setShowForm(false); setDate(todayInManila()); setConsigneeId(""); setAgreementId(""); setReference("");
    setPositions([]); setCounts({}); setPreview(null); setError("");
  }

  async function previewCount() {
    if (shortages.length === 0) { setError("No shortage needs adjustment. Count overages are kept for investigation and are not posted."); return; }
    setWorking(true); setError(""); setPreview(null);
    try { setPreview(await consignmentApi.previewDocument(inputBody())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not preview the stock count."); }
    finally { setWorking(false); }
  }

  async function saveCount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (shortages.length === 0) { setError("A count with no shortage does not create an adjustment. Investigate any count overages separately."); return; }
    setWorking(true); setError(""); setMessage("");
    try { await consignmentApi.saveDocument(inputBody()); setMessage("Stock count shortage saved as a draft."); reset(); await loadRecords(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the stock count."); }
    finally { setWorking(false); }
  }

  async function view(documentId: number) {
    setLoading(true); setError("");
    try { setDetail(await consignmentApi.getDocument(documentId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open the count record."); }
    finally { setLoading(false); }
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_OPERATIONAL_AREAS")) return <main className="p-6 text-sm text-muted-foreground">Consignment operational access is required.</main>;

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Stock Counts</h1><p className="mt-1 text-sm text-muted-foreground">Compare counted stock with the posted book position. Only shortages are submitted for adjustment; overages require investigation.</p></div>{access.capabilities.includes("CREATE_DOCUMENT") && <Button onClick={() => { setDetail(null); setShowForm(true); }}>Record stock count</Button>}</div>
      {error && <Alert variant="destructive"><AlertTitle>Stock count action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      {showForm && <form className="space-y-4 rounded-lg border p-4" onSubmit={(event) => void saveCount(event)}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">New stock count</h2><p className="text-xs text-muted-foreground">ERP calculates shortage value and applies the agreement’s shrinkage responsibility.</p></div><Button type="button" variant="outline" onClick={reset}>Close</Button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="space-y-1 text-sm"><span>Count date</span><input required type="date" className="h-10 w-full rounded-md border bg-background px-3" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="space-y-1 text-sm"><span>Count sheet number</span><input required maxLength={120} className="h-10 w-full rounded-md border bg-background px-3" value={reference} onChange={(event) => setReference(event.target.value)} /></label><label className="space-y-1 text-sm"><span>Consignee</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={consigneeId} onChange={(event) => { setConsigneeId(event.target.value); setAgreementId(""); setPositions([]); setCounts({}); }}><option value="">Select active consignee</option>{consignees.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.consigneeId} value={item.consigneeId}>{item.consigneeCode} · {item.displayName}</option>)}</select></label><label className="space-y-1 text-sm"><span>Agreement</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={agreementId} onChange={(event) => void chooseAgreement(event.target.value)}><option value="">Select active agreement</option>{eligibleAgreements.map((item) => <option key={item.agreementId} value={item.agreementId}>{item.agreementReference || `Agreement #${item.agreementId}`}</option>)}</select></label></div>
        {positions.length > 0 && <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3 text-right">Book quantity</th><th className="px-3 py-3 text-right">Counted quantity</th><th className="px-3 py-3 text-right">Shortage</th></tr></thead><tbody>{positions.map((row) => { const counted = Number(counts[row.productId] ?? row.quantity); const shortage = Math.max(row.quantity - counted, 0); return <tr key={row.productId} className="border-t"><td className="px-3 py-3"><span className="font-medium">{row.productCode || `#${row.productId}`}</span><span className="ml-2 text-muted-foreground">{row.productName}</span></td><td className="px-3 py-3 text-right tabular-nums">{row.quantity}</td><td className="px-3 py-3 text-right"><input type="number" min="0" step="0.000001" className="h-9 w-32 rounded-md border bg-background px-2 text-right" aria-label={`Counted quantity for ${row.productCode || row.productId}`} value={counts[row.productId] ?? ""} onChange={(event) => { setCounts((current) => ({ ...current, [row.productId]: event.target.value })); setPreview(null); }} /></td><td className="px-3 py-3 text-right tabular-nums">{shortage ? shortage : "—"}</td></tr>; })}</tbody></table></div>}
        {positions.length === 0 && agreementId && !loading && <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">No posted book stock exists for this agreement.</p>}
        {overages.length > 0 && <Alert><AlertTitle>Count overage needs investigation</AlertTitle><AlertDescription>{overages.length} product count(s) exceed the book quantity. They will not be posted as stock gains.</AlertDescription></Alert>}
        {preview && <section className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-sm"><h3 className="font-medium">ERP calculation preview</h3>{preview.warnings.map((warning) => <p key={warning} className="mt-1 text-amber-800">{warning}</p>)}{Object.entries(preview.calculationPreview.amounts).map(([key, value]) => <p key={key} className="mt-1">{key}: {formatAmount(value)}</p>)}</section>}
        <div className="flex flex-wrap gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => void previewCount()} disabled={working || loading}>{working ? "Calculating…" : "Preview calculation"}</Button><Button type="submit" disabled={working || loading || shortages.length === 0}>{working ? "Saving…" : "Save shortage draft"}</Button></div>
      </form>}
      <section className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[52rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Count sheet</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Consignee / agreement</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{records?.items.map((item) => <tr key={item.documentId} className="border-t"><td className="px-4 py-3 font-medium">{item.externalReference || `Count #${item.documentId}`}</td><td className="px-4 py-3">{item.documentDate}</td><td className="px-4 py-3">{consignees.find((value) => value.consigneeId === item.consigneeId)?.displayName ?? `#${item.consigneeId}`}<div className="text-xs text-muted-foreground">Agreement #{item.agreementId}</div></td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => void view(item.documentId)}>View</Button></td></tr>)}{(!records || records.items.length === 0) && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{loading ? "Loading stock counts…" : "No stock shortage adjustments have been recorded."}</td></tr>}</tbody></table>{(page > 0 || records?.hasNext) && <div className="flex justify-end gap-2 border-t p-3"><Button size="sm" variant="outline" onClick={() => void loadRecords(page - 1)} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => void loadRecords(page + 1)} disabled={loading || !records?.hasNext}>Next</Button></div>}</section>
      {detail && <section className="space-y-3 rounded-lg border p-4"><div className="flex justify-between gap-3"><div><h2 className="font-semibold">Stock count · #{detail.document.documentId}</h2><p className="text-sm text-muted-foreground">{detail.document.externalReference} · {detail.document.status}</p></div><Button size="sm" variant="outline" onClick={() => setDetail(null)}>Close</Button></div><p className="text-sm">Shortage lines: {detail.lines.length}</p>{detail.calculationPreview && Object.entries(detail.calculationPreview.amounts).map(([key, value]) => <p key={key} className="text-sm">{key}: {formatAmount(value)}</p>)}</section>}
    </main>
  );
}
