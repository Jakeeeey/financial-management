"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ConsignmentProductPicker from "../components/ConsignmentProductPicker";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import {
  consignmentApi,
  type ConsignmentAgreement,
  type ConsignmentConsignee,
  type ConsignmentDocument,
  type ConsignmentDocumentDetail,
  type ConsignmentDocumentInput,
  type ConsignmentDocumentLine,
  type ConsignmentListingFeeSchedule,
  type ConsignmentProductOption,
} from "../providers/consignmentApi";
import { todayInManila } from "../controls/control-utils";

export type ConsignmentDocumentType = "SHIP" | "RETURN" | "SALE" | "SRET" | "DED" | "FEE" | "AMORT" | "DELIST";

type WorkspaceConfig = {
  label: string;
  description: string;
  referenceLabel?: string;
  sourceType?: "SALE" | "FEE";
  salesPeriods?: boolean;
  products?: boolean;
  returnCondition?: boolean;
  customerReturn?: boolean;
  memo?: boolean;
  listingFee?: boolean;
  amortization?: boolean;
  delisting?: boolean;
  multipleLines?: boolean;
};

const CONFIG: Record<ConsignmentDocumentType, WorkspaceConfig> = {
  SHIP: { label: "Shipments", description: "Record goods delivered to a consignee. Shipment approval moves stock but does not recognize revenue.", referenceLabel: "Delivery receipt number", products: true, multipleLines: true },
  RETURN: { label: "Stock Returns", description: "Record stock returned from a consignee and classify each line as resalable, damaged, or expired.", referenceLabel: "Return slip number", products: true, returnCondition: true, multipleLines: true },
  SALE: { label: "Sales Records", description: "Record consignee sell-through with the invoice number, sales period, selling price, and frozen reference price.", referenceLabel: "Consignee invoice number", products: true, salesPeriods: true, multipleLines: true },
  SRET: { label: "Customer Returns", description: "Link each customer return to its posted source sale and original product line.", referenceLabel: "Customer credit memo number", sourceType: "SALE", customerReturn: true, multipleLines: true },
  DED: { label: "Debit / Credit Memos", description: "Record one approved debit or credit reason and amount against a posted sale.", referenceLabel: "Memo reference", sourceType: "SALE", memo: true },
  FEE: { label: "Listing Fees", description: "Record a listing fee against a posted sale, including its amortization period and settlement method.", referenceLabel: "Fee invoice / reference", sourceType: "SALE", listingFee: true },
  AMORT: { label: "Listing Fee Amortization", description: "Book the scheduled straight-line amount for an active posted fee line.", sourceType: "FEE", amortization: true },
  DELIST: { label: "Listing Fee Delisting", description: "Record an early delisting, its refund, and the remaining fee balance against a posted fee line.", referenceLabel: "Delisting notice number", sourceType: "FEE", delisting: true },
};

type EditableLine = {
  product: ConsignmentProductOption | null;
  quantity: string;
  unitPrice: string;
  referenceUnitPrice: string;
  returnCondition: string;
  reasonCode: string;
  reasonDetail: string;
  lineAmount: string;
  feeStartMonth: string;
  feePeriodMonths: string;
  feeTreatment: string;
  settlementMethod: string;
  sourceDocumentLineId: number | null;
};

function emptyLine(): EditableLine {
  return { product: null, quantity: "", unitPrice: "", referenceUnitPrice: "", returnCondition: "RESALABLE", reasonCode: "", reasonDetail: "", lineAmount: "", feeStartMonth: "", feePeriodMonths: "", feeTreatment: "CONTRA", settlementMethod: "OFFSET", sourceDocumentLineId: null };
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lineLabel(line: ConsignmentDocumentLine) {
  return `${line.productCodeSnapshot || `Product #${line.productId ?? "?"}`} · ${line.productNameSnapshot || "source line"}`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function mapExistingLine(line: ConsignmentDocumentLine): EditableLine {
  return {
    product: line.productId ? { productId: line.productId, productCode: line.productCodeSnapshot ?? "", productName: line.productNameSnapshot ?? "" } : null,
    quantity: line.quantity == null ? "" : String(line.quantity),
    unitPrice: line.unitPrice == null ? "" : String(line.unitPrice),
    referenceUnitPrice: line.referenceUnitPrice == null ? "" : String(line.referenceUnitPrice),
    returnCondition: line.returnCondition ?? "RESALABLE", reasonCode: line.reasonCode ?? "", reasonDetail: line.reasonDetail ?? "",
    lineAmount: line.lineAmount == null ? "" : String(line.lineAmount), feeStartMonth: line.feeStartMonth?.slice(0, 7) ?? "",
    feePeriodMonths: line.feePeriodMonths == null ? "" : String(line.feePeriodMonths), feeTreatment: line.feeTreatment ?? "CONTRA",
    settlementMethod: line.settlementMethod ?? "OFFSET", sourceDocumentLineId: line.sourceDocumentLineId,
  };
}

export default function ConsignmentDocumentWorkspace({ documentType }: { documentType: ConsignmentDocumentType }) {
  const config = CONFIG[documentType];
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [result, setResult] = useState<Awaited<ReturnType<typeof consignmentApi.listDocuments>> | null>(null);
  const [consignees, setConsignees] = useState<ConsignmentConsignee[]>([]);
  const [agreements, setAgreements] = useState<ConsignmentAgreement[]>([]);
  const [sourceDocuments, setSourceDocuments] = useState<ConsignmentDocument[]>([]);
  const [sourceDetail, setSourceDetail] = useState<ConsignmentDocumentDetail | null>(null);
  const [schedules, setSchedules] = useState<Record<number, ConsignmentListingFeeSchedule>>({});
  const [detail, setDetail] = useState<ConsignmentDocumentDetail | null>(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [documentDate, setDocumentDate] = useState(todayInManila());
  const [consigneeId, setConsigneeId] = useState("");
  const [agreementId, setAgreementId] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [salesPeriodStart, setSalesPeriodStart] = useState("");
  const [salesPeriodEnd, setSalesPeriodEnd] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([emptyLine()]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof consignmentApi.previewDocument>> | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (target = 0) => {
    setLoading(true); setError("");
    try {
      const data = await consignmentApi.listDocuments({ search, status, documentType, page: target });
      setResult(data); setPage(data.page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load Consignment documents."); }
    finally { setLoading(false); }
  }, [documentType, search, status]);
  useEffect(() => { void load(0); }, [load]);

  useEffect(() => {
    if (!showEditor) return;
    let active = true;
    void Promise.all([consignmentApi.listConsignees("", 0, 100), consignmentApi.listAgreements("", 0, 100)])
      .then(([consigneePage, agreementPage]) => {
        if (!active) return;
        setConsignees(consigneePage.items); setAgreements(agreementPage.items);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load Consignment lookups."); });
    return () => { active = false; };
  }, [showEditor]);

  useEffect(() => {
    if (!showEditor || !config.sourceType) { setSourceDocuments([]); return; }
    let active = true;
    void consignmentApi.listDocuments({ documentType: config.sourceType, status: "POSTED", page: 0, size: 100 })
      .then((data) => { if (active) setSourceDocuments(data.items); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load source documents."); });
    return () => { active = false; };
  }, [config.sourceType, showEditor]);

  useEffect(() => {
    if (!showEditor || !sourceDocumentId) { setSourceDetail(null); return; }
    let active = true;
    void consignmentApi.getDocument(Number(sourceDocumentId)).then((value) => {
      if (!active) return;
      setSourceDetail(value);
      setConsigneeId(String(value.document.consigneeId));
      setAgreementId(String(value.document.agreementId));
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load the selected source document."); });
    return () => { active = false; };
  }, [showEditor, sourceDocumentId]);

  const eligibleAgreements = useMemo(() => agreements.filter((item) => item.status === "ACTIVE" && (!consigneeId || String(item.consigneeId) === consigneeId)), [agreements, consigneeId]);

  function resetEditor() {
    setShowEditor(false); setEditingId(null); setDocumentDate(todayInManila()); setConsigneeId(""); setAgreementId("");
    setExternalReference(""); setSourceDocumentId(""); setSalesPeriodStart(""); setSalesPeriodEnd("");
    setLines([emptyLine()]); setPreview(null); setSourceDetail(null); setError("");
  }

  function startNew() {
    setDetail(null); setEditingId(null); setDocumentDate(todayInManila()); setConsigneeId(""); setAgreementId("");
    setExternalReference(""); setSourceDocumentId(""); setSalesPeriodStart(""); setSalesPeriodEnd("");
    setLines([emptyLine()]); setPreview(null); setError(""); setShowEditor(true);
  }

  async function editDraft(documentId: number) {
    setLoading(true); setError("");
    try {
      const value = await consignmentApi.getDocument(documentId);
      setDetail(value); setEditingId(documentId); setDocumentDate(value.document.documentDate);
      setConsigneeId(String(value.document.consigneeId)); setAgreementId(String(value.document.agreementId));
      setExternalReference(value.document.externalReference ?? ""); setSourceDocumentId(value.document.sourceDocumentId == null ? "" : String(value.document.sourceDocumentId));
      setSalesPeriodStart(value.document.salesPeriodStart ?? ""); setSalesPeriodEnd(value.document.salesPeriodEnd ?? "");
      const existingLines = value.lines.map(mapExistingLine);
      setLines(existingLines.length ? existingLines : [emptyLine()]);
      setPreview(null); setShowEditor(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the draft."); }
    finally { setLoading(false); }
  }

  function lineInputs(): ConsignmentDocumentInput["lines"] {
    return lines.flatMap((line) => {
      const productRequired = config.products === true || config.customerReturn === true;
      if (productRequired && !line.product) return [];
      const sourceLine = sourceDetail?.lines.find((item) => item.documentLineId === line.sourceDocumentLineId);
      return [{
        productId: line.product?.productId ?? sourceLine?.productId ?? null,
        productCodeSnapshot: line.product?.productCode ?? sourceLine?.productCodeSnapshot ?? null,
        productNameSnapshot: line.product?.productName ?? sourceLine?.productNameSnapshot ?? null,
        quantity: numberOrNull(line.quantity),
        unitPrice: numberOrNull(line.unitPrice),
        referenceUnitPrice: numberOrNull(line.referenceUnitPrice),
        returnCondition: config.returnCondition || config.customerReturn ? line.returnCondition : null,
        reasonCode: line.reasonCode || null,
        reasonDetail: line.reasonDetail || null,
        lineAmount: numberOrNull(line.lineAmount),
        feeStartMonth: line.feeStartMonth ? `${line.feeStartMonth}-01` : null,
        feePeriodMonths: numberOrNull(line.feePeriodMonths),
        feeTreatment: config.listingFee || config.delisting ? line.feeTreatment : null,
        settlementMethod: config.listingFee ? line.settlementMethod : null,
        sourceDocumentLineId: line.sourceDocumentLineId,
      }];
    });
  }

  function requestBody(): ConsignmentDocumentInput {
    return {
      documentType,
      documentDate,
      consigneeId: Number(consigneeId),
      agreementId: Number(agreementId),
      externalReference: externalReference.trim() || null,
      sourceDocumentId: sourceDocumentId ? Number(sourceDocumentId) : null,
      salesPeriodStart: config.salesPeriods ? salesPeriodStart || null : null,
      salesPeriodEnd: config.salesPeriods ? salesPeriodEnd || null : null,
      lines: lineInputs(),
    };
  }

  async function calculatePreview() {
    setPreviewing(true); setError(""); setMessage(""); setPreview(null);
    try { const value = await consignmentApi.previewDocument(requestBody()); setPreview(value); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not calculate a server preview."); }
    finally { setPreviewing(false); }
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const value = await consignmentApi.saveDocument(requestBody(), editingId ?? undefined);
      setDetail(value); setEditingId(value.document.documentId); setShowEditor(false);
      setMessage(`Draft #${value.document.documentId} saved.`); await load(page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the draft."); }
    finally { setSaving(false); }
  }

  async function openDetail(documentId: number) {
    setLoading(true); setError(""); setMessage("");
    try { setDetail(await consignmentApi.getDocument(documentId)); setShowEditor(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open this document."); }
    finally { setLoading(false); }
  }

  async function submitDraft() {
    if (!detail) return;
    setWorking(true); setError(""); setMessage("");
    try { const value = await consignmentApi.submitDocument(detail.document.documentId); setDetail(value); setMessage("Document submitted for approval."); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit the draft."); }
    finally { setWorking(false); }
  }

  async function voidPostedDocument() {
    if (!detail) return;
    setWorking(true); setError(""); setMessage("");
    try { const value = await consignmentApi.voidDocument(detail.document.documentId, voidReason.trim()); setDetail(value); setVoidReason(""); setMessage("Posted document voided with a reversing entry."); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not void the posted document."); }
    finally { setWorking(false); }
  }

  async function loadSourceSchedule(lineId: number) {
    try {
      const schedule = await consignmentApi.getListingFeeSchedule(lineId);
      setSchedules((current) => ({ ...current, [lineId]: schedule }));
      return schedule;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the fee schedule.");
      return null;
    }
  }

  function updateLine(index: number, update: Partial<EditableLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...update } : line));
    setPreview(null);
  }

  async function selectSourceLine(index: number, sourceLineId: number) {
    const sourceLine = sourceDetail?.lines.find((line) => line.documentLineId === sourceLineId);
    const next: Partial<EditableLine> = { sourceDocumentLineId: sourceLineId };
    if (sourceLine && config.customerReturn) {
      next.product = { productId: sourceLine.productId ?? 0, productCode: sourceLine.productCodeSnapshot ?? "", productName: sourceLine.productNameSnapshot ?? "" };
      next.quantity = ""; next.unitPrice = sourceLine.unitPrice == null ? "" : String(sourceLine.unitPrice);
    }
    if (sourceLine && (config.amortization || config.delisting)) {
      next.product = { productId: sourceLine.productId ?? 0, productCode: sourceLine.productCodeSnapshot ?? "", productName: sourceLine.productNameSnapshot ?? "" };
      next.feeTreatment = sourceLine.feeTreatment ?? "CONTRA";
      const schedule = await loadSourceSchedule(sourceLineId);
      if (schedule && config.amortization) {
        next.lineAmount = String(schedule.monthlyAmount);
        next.feeStartMonth = documentDate.slice(0, 7);
      }
    }
    updateLine(index, next);
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_OPERATIONAL_AREAS")) return <main className="p-6 text-sm text-muted-foreground">Consignment operational access is required.</main>;

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">{config.label}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{config.description}</p></div>{access.capabilities.includes("CREATE_DOCUMENT") && <Button onClick={startNew}>New {config.label.replace(/s$/, "")}</Button>}</div>
      {error && <Alert variant="destructive"><AlertTitle>Consignment document action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}

      {showEditor && <form className="space-y-4 rounded-lg border p-4" onSubmit={(event) => void saveDraft(event)}>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{editingId ? `Edit draft #${editingId}` : `New ${config.label.replace(/s$/, "")}`}</h2><p className="text-xs text-muted-foreground">The preview and final validation are calculated by ERP. Previewing does not save or post the document.</p></div><Button type="button" variant="outline" onClick={resetEditor}>Close</Button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm"><span>Document date</span><input required type="date" className="h-10 w-full rounded-md border bg-background px-3" value={documentDate} onChange={(event) => { setDocumentDate(event.target.value); setPreview(null); }} /></label>
          <label className="space-y-1 text-sm"><span>Consignee</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={consigneeId} onChange={(event) => { setConsigneeId(event.target.value); setAgreementId(""); }}><option value="">Select active consignee</option>{consignees.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.consigneeId} value={item.consigneeId}>{item.consigneeCode} · {item.displayName}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span>Agreement</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={agreementId} onChange={(event) => setAgreementId(event.target.value)}><option value="">Select active agreement</option>{eligibleAgreements.map((item) => <option key={item.agreementId} value={item.agreementId}>{item.agreementReference || `Agreement #${item.agreementId}`} · {item.startDate} to {item.endDate}</option>)}</select></label>
          {config.referenceLabel && <label className="space-y-1 text-sm"><span>{config.referenceLabel}</span><input required className="h-10 w-full rounded-md border bg-background px-3" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} maxLength={120} /></label>}
          {config.sourceType && <label className="space-y-1 text-sm"><span>{config.sourceType === "SALE" ? "Posted source sale" : "Posted listing fee"}</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={sourceDocumentId} onChange={(event) => { setSourceDocumentId(event.target.value); setSourceDetail(null); setLines([emptyLine()]); }}><option value="">Select posted source document</option>{sourceDocuments.map((item) => <option key={item.documentId} value={item.documentId}>#{item.documentId} · {item.externalReference || item.documentDate} · consignee #{item.consigneeId}</option>)}</select></label>}
          {config.salesPeriods && <><label className="space-y-1 text-sm"><span>Sales period start</span><input required type="date" className="h-10 w-full rounded-md border bg-background px-3" value={salesPeriodStart} onChange={(event) => setSalesPeriodStart(event.target.value)} /></label><label className="space-y-1 text-sm"><span>Sales period end</span><input required type="date" className="h-10 w-full rounded-md border bg-background px-3" value={salesPeriodEnd} onChange={(event) => setSalesPeriodEnd(event.target.value)} /></label></>}
        </div>
        {config.sourceType && sourceDetail && <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">Source {config.sourceType} #{sourceDetail.document.documentId}: {sourceDetail.document.externalReference || sourceDetail.document.documentDate}, {sourceDetail.lines.length} line(s).</p>}

        {lines.map((line, index) => <div key={index} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Line {index + 1}</h3>{config.multipleLines && lines.length > 1 && <button type="button" className="text-xs text-destructive underline" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Remove</button>}</div>
          {(config.products || config.customerReturn) && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {config.customerReturn ? <label className="space-y-1 text-sm"><span>Original sale line</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={line.sourceDocumentLineId ?? ""} onChange={(event) => void selectSourceLine(index, Number(event.target.value))}><option value="">Choose sold product</option>{sourceDetail?.lines.map((sourceLine) => <option key={sourceLine.documentLineId} value={sourceLine.documentLineId}>{lineLabel(sourceLine)} · sold {sourceLine.quantity ?? 0}</option>)}</select></label> : <div className="space-y-1 text-sm"><span className="block">Product</span><ConsignmentProductPicker value={line.product} onChange={(product) => updateLine(index, { product })} /></div>}
            <label className="space-y-1 text-sm"><span>{config.customerReturn ? "Units returned" : "Quantity"}</span><input required type="number" min="0.000001" step="0.000001" className="h-10 w-full rounded-md border bg-background px-3" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></label>
            {documentType === "SALE" && <><label className="space-y-1 text-sm"><span>Selling price (ex VAT)</span><input required type="number" min="0.000001" step="0.000001" className="h-10 w-full rounded-md border bg-background px-3" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} /></label><label className="space-y-1 text-sm"><span>Reference unit price</span><input required type="number" min="0.000001" step="0.000001" className="h-10 w-full rounded-md border bg-background px-3" value={line.referenceUnitPrice} onChange={(event) => updateLine(index, { referenceUnitPrice: event.target.value })} /></label></>}
            {config.returnCondition && <label className="space-y-1 text-sm"><span>Return condition</span><select className="h-10 w-full rounded-md border bg-background px-3" value={line.returnCondition} onChange={(event) => updateLine(index, { returnCondition: event.target.value })}><option value="RESALABLE">Resalable</option><option value="DAMAGED">Damaged</option><option value="EXPIRED">Expired</option></select></label>}
            {config.customerReturn && <><label className="space-y-1 text-sm"><span>Condition</span><select className="h-10 w-full rounded-md border bg-background px-3" value={line.returnCondition} onChange={(event) => updateLine(index, { returnCondition: event.target.value })}><option value="RESALABLE">Resalable</option><option value="DAMAGED">Damaged</option><option value="EXPIRED">Expired</option></select></label><label className="space-y-1 text-sm"><span>Return reason</span><input required className="h-10 w-full rounded-md border bg-background px-3" value={line.reasonCode} onChange={(event) => updateLine(index, { reasonCode: event.target.value })} maxLength={60} /></label><label className="space-y-1 text-sm"><span>Reason detail</span><input className="h-10 w-full rounded-md border bg-background px-3" value={line.reasonDetail} onChange={(event) => updateLine(index, { reasonDetail: event.target.value })} maxLength={1000} /></label></>}
          </div>}

          {config.memo && <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-sm"><span>Memo reason</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={line.reasonCode} onChange={(event) => updateLine(index, { reasonCode: event.target.value })}><option value="">Select reason</option>{["Price adjustment", "Shortage billing", "Damage billing", "Other charge", "Promo support", "Markdown support", "Spoilage claim", "Other credit"].map((reason) => <option key={reason}>{reason}</option>)}</select></label><label className="space-y-1 text-sm"><span>Amount before VAT</span><input required type="number" min="0.01" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" value={line.lineAmount} onChange={(event) => updateLine(index, { lineAmount: event.target.value })} /></label><label className="space-y-1 text-sm"><span>Reason detail</span><input className="h-10 w-full rounded-md border bg-background px-3" value={line.reasonDetail} onChange={(event) => updateLine(index, { reasonDetail: event.target.value })} maxLength={1000} /></label></div>}

          {config.listingFee && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><label className="space-y-1 text-sm"><span>Fee amount before VAT</span><input required type="number" min="0.01" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" value={line.lineAmount} onChange={(event) => updateLine(index, { lineAmount: event.target.value })} /></label><label className="space-y-1 text-sm"><span>Start month</span><input required type="month" className="h-10 w-full rounded-md border bg-background px-3" value={line.feeStartMonth} onChange={(event) => updateLine(index, { feeStartMonth: event.target.value })} /></label><label className="space-y-1 text-sm"><span>Period (months)</span><input required type="number" min="1" max="36" step="1" className="h-10 w-full rounded-md border bg-background px-3" value={line.feePeriodMonths} onChange={(event) => updateLine(index, { feePeriodMonths: event.target.value })} /></label><label className="space-y-1 text-sm"><span>Fee treatment</span><select className="h-10 w-full rounded-md border bg-background px-3" value={line.feeTreatment} onChange={(event) => updateLine(index, { feeTreatment: event.target.value })}><option value="CONTRA">Reduce revenue</option><option value="DISTINCT">Distinct service</option></select></label><label className="space-y-1 text-sm"><span>Settlement</span><select className="h-10 w-full rounded-md border bg-background px-3" value={line.settlementMethod} onChange={(event) => updateLine(index, { settlementMethod: event.target.value })}><option value="OFFSET">Offset collections</option><option value="CASH">Cash</option></select></label></div>}

          {(config.amortization || config.delisting) && <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-sm"><span>Posted fee line</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={line.sourceDocumentLineId ?? ""} onChange={(event) => void selectSourceLine(index, Number(event.target.value))}><option value="">Select fee line</option>{sourceDetail?.lines.map((sourceLine) => <option key={sourceLine.documentLineId} value={sourceLine.documentLineId}>{lineLabel(sourceLine)} · remaining schedule loads on selection</option>)}</select></label>{config.amortization && <><label className="space-y-1 text-sm"><span>Amortization month</span><input required type="month" className="h-10 w-full rounded-md border bg-background px-3" value={line.feeStartMonth} onChange={(event) => updateLine(index, { feeStartMonth: event.target.value, lineAmount: schedules[line.sourceDocumentLineId ?? 0] ? String(schedules[line.sourceDocumentLineId ?? 0].monthlyAmount) : line.lineAmount })} /></label><label className="space-y-1 text-sm"><span>Scheduled amount</span><input readOnly className="h-10 w-full rounded-md border bg-muted px-3" value={line.lineAmount} /></label></>}{config.delisting && <><label className="space-y-1 text-sm"><span>Refund amount</span><input required type="number" min="0" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" value={line.lineAmount} onChange={(event) => updateLine(index, { lineAmount: event.target.value })} /></label><div className="self-end text-xs text-muted-foreground">Active fee schedule: {schedules[line.sourceDocumentLineId ?? 0] ? `₱${schedules[line.sourceDocumentLineId ?? 0].remainingAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} remaining` : "Select a fee line to load its balance."}</div></>}</div>}
        </div>)}
        {config.multipleLines && <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, emptyLine()])}>Add line</Button>}
        {config.sourceType === "FEE" && sourceDetail && <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">Select the posted fee line above. ERP will check schedule eligibility and the period rules when you preview.</div>}
        <div className="flex flex-wrap gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => void calculatePreview()} disabled={previewing || saving}>{previewing ? "Calculating…" : "Preview calculations"}</Button><Button type="submit" disabled={saving || !access.capabilities.includes("CREATE_DOCUMENT")}>{saving ? "Saving…" : "Save draft"}</Button><Button type="button" variant="ghost" onClick={resetEditor}>Cancel</Button></div>
        {preview && <section className="space-y-2 rounded-md border border-blue-200 bg-blue-50/50 p-3 text-sm"><h3 className="font-medium">ERP calculation preview · {preview.calculationPreview.status.replaceAll("_", " ")}</h3>{preview.warnings.map((warning) => <p key={warning} className="text-amber-800">{warning}</p>)}<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(preview.calculationPreview.quantities).map(([key, value]) => <p key={key} className="text-muted-foreground">{key}: <strong className="text-foreground">{value.toLocaleString("en-PH")}</strong></p>)}{Object.entries(preview.calculationPreview.amounts).map(([key, value]) => <p key={key} className="text-muted-foreground">{key}: <strong className="text-foreground">{formatAmount(value)}</strong></p>)}</div></section>}
      </form>}

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-52 flex-1 space-y-1 text-sm"><span>Search</span><input className="h-10 w-full rounded-md border bg-background px-3" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Reference or document ID" /></label><label className="space-y-1 text-sm"><span>Status</span><select className="h-10 rounded-md border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["DRAFT", "PENDING", "POSTED", "REJECTED", "VOIDED"].map((value) => <option key={value}>{value}</option>)}</select></label><Button variant="outline" onClick={() => { setSearch(searchInput.trim()); void load(0); }} disabled={loading}>{loading ? "Searching…" : "Search"}</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[58rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Document</th><th className="px-3 py-3">Date / reference</th><th className="px-3 py-3">Consignee</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{result?.items.map((document) => <tr key={document.documentId} className="border-t"><td className="px-3 py-3 font-medium">{document.documentType} · #{document.documentId}</td><td className="px-3 py-3">{document.documentDate}<div className="text-xs text-muted-foreground">{document.externalReference || "—"}</div></td><td className="px-3 py-3">{consignees.find((item) => item.consigneeId === document.consigneeId)?.displayName ?? `#${document.consigneeId}`}</td><td className="px-3 py-3">{document.status}{document.rejectionReason && <div className="text-xs text-destructive">{document.rejectionReason}</div>}</td><td className="px-3 py-3 text-right tabular-nums">{document.netAmount == null ? "—" : formatAmount(document.netAmount)}</td><td className="space-x-2 px-3 py-3"><Button size="sm" variant="outline" onClick={() => void openDetail(document.documentId)}>View</Button>{document.status === "DRAFT" && access.capabilities.includes("CREATE_DOCUMENT") && document.createdByUserId === access.userId && <Button size="sm" onClick={() => void editDraft(document.documentId)}>Edit</Button>}</td></tr>)}{(!result || result.items.length === 0) && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{loading ? "Loading documents…" : `No ${config.label.toLowerCase()} records found.`}</td></tr>}</tbody></table></div>
        {(page > 0 || result?.hasNext) && <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={loading || !result?.hasNext}>Next</Button></div>}
      </section>

      {detail && !showEditor && <section className="space-y-4 rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{detail.document.documentType} · #{detail.document.documentId}</h2><p className="text-sm text-muted-foreground">{detail.document.documentDate} · {detail.document.externalReference || "No external reference"} · {detail.document.status}</p></div><Button variant="outline" onClick={() => setDetail(null)}>Close details</Button></div>
        {detail.warnings?.map((warning) => <p key={warning} className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">{warning}</p>)}
        <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Line</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Details</th></tr></thead><tbody>{detail.lines.map((line) => <tr key={line.documentLineId} className="border-t"><td className="px-3 py-2">{lineLabel(line)}</td><td className="px-3 py-2 text-right">{line.quantity ?? "—"}</td><td className="px-3 py-2 text-right">{line.unitPrice == null ? "—" : formatAmount(line.unitPrice)}</td><td className="px-3 py-2 text-right">{line.lineAmount == null ? "—" : formatAmount(line.lineAmount)}</td><td className="px-3 py-2">{line.reasonCode || line.returnCondition || (line.feePeriodMonths ? `${line.feePeriodMonths} months` : "—")}</td></tr>)}</tbody></table></div>
        {detail.calculationPreview && <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><strong className="sm:col-span-2 lg:col-span-3">Calculation · {detail.calculationPreview.status.replaceAll("_", " ")}</strong>{Object.entries(detail.calculationPreview.quantities).map(([key, value]) => <p key={key}>{key}: {value.toLocaleString("en-PH")}</p>)}{Object.entries(detail.calculationPreview.amounts).map(([key, value]) => <p key={key}>{key}: {formatAmount(value)}</p>)}</div>}
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">{detail.document.status === "DRAFT" && access.capabilities.includes("CREATE_DOCUMENT") && detail.document.createdByUserId === access.userId && <Button onClick={() => void submitDraft()} disabled={working}>{working ? "Submitting…" : "Submit for approval"}</Button>}{detail.document.status === "POSTED" && access.capabilities.includes("VOID_POSTED_DOCUMENT") && <><label className="min-w-60 flex-1 space-y-1 text-sm"><span>Reason to void</span><input className="h-10 w-full rounded-md border bg-background px-3" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={1000} /></label><Button variant="destructive" onClick={() => void voidPostedDocument()} disabled={working || !voidReason.trim()}>{working ? "Voiding…" : "Void with reversal"}</Button></>}</div>
      </section>}
    </main>
  );
}
