"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentAgreement, type ConsignmentAgreementInput, type ConsignmentConsignee } from "../providers/consignmentApi";

type AgreementPage = Awaited<ReturnType<typeof consignmentApi.listAgreements>>;

const blankAgreement = (): ConsignmentAgreementInput => ({
  agreementReference: "", consigneeId: 0, startDate: "", endDate: "", commissionRate: 0, paymentTermsDays: 0,
  settlementFrequency: "MONTHLY", salesReportFrequency: "MONTHLY", exposureLimit: 0,
  shrinkageResponsibility: "COMPANY", ewtRate: 0, priceTolerance: 5, listingFeeSettlement: "OFFSET", vatTreatment: "NON_VAT",
});

export default function ConsignmentAgreementsModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [result, setResult] = useState<AgreementPage | null>(null);
  const [consignees, setConsignees] = useState<ConsignmentConsignee[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ConsignmentAgreementInput>(blankAgreement());
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [closeReasons, setCloseReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (target = 0) => {
    setLoading(true); setError("");
    try { const [data, consigneePage] = await Promise.all([consignmentApi.listAgreements(search.trim(), target), consignmentApi.listConsignees("", 0, 100)]); setResult(data); setPage(data.page); setConsignees(consigneePage.items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load agreements."); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { void load(0); }, [load]);

  function edit(item: ConsignmentAgreement) {
    setEditingId(item.agreementId);
    setForm({
      agreementReference: item.agreementReference, consigneeId: item.consigneeId, startDate: item.startDate, endDate: item.endDate,
      commissionRate: item.commissionRate, paymentTermsDays: item.paymentTermsDays, settlementFrequency: item.settlementFrequency,
      salesReportFrequency: item.salesReportFrequency, exposureLimit: item.exposureLimit, shrinkageResponsibility: item.shrinkageResponsibility,
      ewtRate: item.ewtRate, priceTolerance: item.priceTolerance, listingFeeSettlement: item.listingFeeSettlement, vatTreatment: item.vatTreatment,
    });
  }
  function cancelEdit() { setEditingId(null); setForm(blankAgreement()); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try { await consignmentApi.saveAgreement(form, editingId ?? undefined); setMessage(editingId ? "Agreement updated." : "Agreement submitted for review."); cancelEdit(); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the agreement."); }
    finally { setSaving(false); }
  }

  async function review(item: ConsignmentAgreement, decision: "approve" | "reject") {
    setWorkingId(item.agreementId); setError(""); setMessage("");
    try { await consignmentApi.reviewAgreement(item.agreementId, decision, rejectReasons[item.agreementId]); setMessage(`Agreement ${item.agreementReference || `#${item.agreementId}`} was ${decision === "approve" ? "activated" : "rejected"}.`); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review the agreement."); }
    finally { setWorkingId(null); }
  }

  async function close(item: ConsignmentAgreement) {
    setWorkingId(item.agreementId); setError(""); setMessage("");
    try { await consignmentApi.closeAgreement(item.agreementId, closeReasons[item.agreementId]?.trim() ?? ""); setMessage(`Agreement ${item.agreementReference || `#${item.agreementId}`} was closed.`); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not close the agreement."); }
    finally { setWorkingId(null); }
  }

  function numberField<K extends keyof ConsignmentAgreementInput>(key: K, label: string, min?: number, max?: number) {
    const value = form[key];
    return <label key={String(key)} className="space-y-1 text-sm"><span>{label}</span><input className="h-10 w-full rounded-md border bg-background px-3" type="number" step="0.01" min={min} max={max} value={value == null ? "" : String(value)} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value === "" ? 0 : Number(event.target.value) }))} /></label>;
  }
  function textField<K extends keyof ConsignmentAgreementInput>(key: K, label: string, type = "text") {
    const value = form[key];
    return <label key={String(key)} className="space-y-1 text-sm"><span>{label}</span><input className="h-10 w-full rounded-md border bg-background px-3" type={type} value={value == null ? "" : String(value)} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>;
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_OPERATIONAL_AREAS")) return <main className="p-6 text-sm text-muted-foreground">Consignment operational access is required.</main>;

  return (
    <main className="space-y-6 p-6">
      <div><h1 className="text-2xl font-semibold">Agreements</h1><p className="mt-1 text-sm text-muted-foreground">Set the active terms that govern Consignment shipments, reporting, settlements, and fees.</p></div>
      {error && <Alert variant="destructive"><AlertTitle>Agreement action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      {access.capabilities.includes("CREATE_DOCUMENT") && <form className="space-y-4 rounded-lg border p-4" onSubmit={(event) => void save(event)}>
        <div><h2 className="font-semibold">{editingId ? "Edit agreement" : "Add agreement"}</h2><p className="text-xs text-muted-foreground">New agreements remain pending until an authorized reviewer activates them.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {textField("agreementReference", "Agreement reference")}
          <label className="space-y-1 text-sm"><span>Consignee</span><select required className="h-10 w-full rounded-md border bg-background px-3" value={form.consigneeId || ""} onChange={(event) => setForm((current) => ({ ...current, consigneeId: Number(event.target.value) }))}><option value="">Select active consignee</option>{consignees.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.consigneeId} value={item.consigneeId}>{item.consigneeCode} · {item.displayName}</option>)}</select></label>
          {textField("startDate", "Start date", "date")}{textField("endDate", "End date", "date")}
          {numberField("commissionRate", "Commission rate (%)", 0, 60)}{numberField("paymentTermsDays", "Payment terms (days)", 0, 120)}
          {textField("settlementFrequency", "Settlement frequency")}{textField("salesReportFrequency", "Sales report frequency")}
          {numberField("exposureLimit", "Exposure limit (₱)", 0)}
          <label className="space-y-1 text-sm"><span>Shrinkage responsibility</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.shrinkageResponsibility} onChange={(event) => setForm((current) => ({ ...current, shrinkageResponsibility: event.target.value }))}><option value="COMPANY">Company</option><option value="CONSIGNEE">Consignee</option></select></label>
          {numberField("ewtRate", "EWT rate (%)", 0, 25)}{numberField("priceTolerance", "Price tolerance (%)", 0, 50)}
          <label className="space-y-1 text-sm"><span>Listing fee settlement</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.listingFeeSettlement} onChange={(event) => setForm((current) => ({ ...current, listingFeeSettlement: event.target.value }))}><option value="OFFSET">Offset against collections</option><option value="CASH">Cash</option></select></label>
          <label className="space-y-1 text-sm"><span>VAT treatment</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.vatTreatment ?? "NON_VAT"} onChange={(event) => setForm((current) => ({ ...current, vatTreatment: event.target.value }))}><option value="VAT_REGISTERED">VAT registered</option><option value="NON_VAT">Non-VAT</option></select></label>
        </div>
        <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Submit agreement"}</Button>{editingId && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel edit</Button>}</div>
      </form>}
      <section className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 space-y-1 text-sm"><span>Search agreements</span><input className="h-10 w-full rounded-md border bg-background px-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference or consignee" /></label><Button variant="outline" onClick={() => void load(0)} disabled={loading}>{loading ? "Searching…" : "Search"}</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[72rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Agreement</th><th className="px-3 py-3">Term</th><th className="px-3 py-3 text-right">Commission</th><th className="px-3 py-3 text-right">Exposure limit</th><th className="px-3 py-3">Settlement / shrinkage</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{result?.items.map((item) => { const consignee = consignees.find((value) => value.consigneeId === item.consigneeId); return <tr key={item.agreementId} className="border-t align-top"><td className="px-3 py-3"><div className="font-medium">{item.agreementReference || `Agreement #${item.agreementId}`}</div><div className="text-xs text-muted-foreground">{consignee?.displayName ?? `Consignee #${item.consigneeId}`}</div></td><td className="px-3 py-3">{item.startDate} – {item.endDate}</td><td className="px-3 py-3 text-right tabular-nums">{item.commissionRate}%</td><td className="px-3 py-3 text-right tabular-nums">₱{item.exposureLimit.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td><td className="px-3 py-3">{item.settlementFrequency}<div className="text-xs text-muted-foreground">{item.shrinkageResponsibility}</div></td><td className="px-3 py-3">{item.status}{item.rejectionReason && <div className="max-w-xs text-xs text-destructive">{item.rejectionReason}</div>}</td><td className="min-w-64 space-y-2 px-3 py-3">{access.capabilities.includes("CREATE_DOCUMENT") && <Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button>}{item.status === "PENDING" && access.capabilities.includes("REVIEW_DOCUMENT") && <div className="flex gap-2"><Button size="sm" onClick={() => void review(item, "approve")} disabled={workingId !== null}>{workingId === item.agreementId ? "Saving…" : "Approve"}</Button><input className="h-9 min-w-24 flex-1 rounded-md border bg-background px-2 text-xs" aria-label={`Rejection reason for ${item.agreementReference ?? item.agreementId}`} placeholder="Reason to reject" value={rejectReasons[item.agreementId] ?? ""} onChange={(event) => setRejectReasons((current) => ({ ...current, [item.agreementId]: event.target.value }))} /><Button size="sm" variant="destructive" onClick={() => void review(item, "reject")} disabled={workingId !== null || !(rejectReasons[item.agreementId] ?? "").trim()}>Reject</Button></div>}{item.status === "ACTIVE" && access.capabilities.includes("MANAGE_CONTROLS") && <div className="flex gap-2"><input className="h-9 min-w-24 flex-1 rounded-md border bg-background px-2 text-xs" aria-label={`Reason to close ${item.agreementReference ?? item.agreementId}`} placeholder="Reason to close" value={closeReasons[item.agreementId] ?? ""} onChange={(event) => setCloseReasons((current) => ({ ...current, [item.agreementId]: event.target.value }))} /><Button size="sm" variant="outline" onClick={() => void close(item)} disabled={workingId !== null || !(closeReasons[item.agreementId] ?? "").trim()}>Close</Button></div>}</td></tr>; })}{(!result || result.items.length === 0) && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{loading ? "Loading agreements…" : "No agreements found."}</td></tr>}</tbody></table></div>
        {(page > 0 || result?.hasNext) && <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={loading || !result?.hasNext}>Next</Button></div>}
      </section>
    </main>
  );
}
