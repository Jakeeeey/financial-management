"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentConsignee, type ConsignmentConsigneeInput } from "../providers/consignmentApi";

type ConsigneePage = Awaited<ReturnType<typeof consignmentApi.listConsignees>>;

const blankConsignee = (): ConsignmentConsigneeInput => ({
  consigneeCode: "", displayName: "", legalName: "", tradeName: "", tin: "", contactPerson: "", email: "", phone: "",
  addressLine: "", city: "", province: "", postalCode: "", vatTreatment: "NON_VAT",
  defaultCommissionRate: 0, defaultPaymentTermsDays: 0, defaultSettlementFrequency: "MONTHLY",
  defaultSalesReportFrequency: "MONTHLY", defaultExposureLimit: 0, defaultShrinkageResponsibility: "COMPANY",
  defaultEwtRate: 0, defaultPriceTolerance: 5, defaultListingFeeSettlement: "OFFSET",
});

export default function ConsignmentConsigneesModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [result, setResult] = useState<ConsigneePage | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ConsignmentConsigneeInput>(blankConsignee());
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (target = 0) => {
    setLoading(true); setError("");
    try { const data = await consignmentApi.listConsignees(search.trim(), target); setResult(data); setPage(data.page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load consignees."); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { void load(0); }, [load]);

  function edit(item: ConsignmentConsignee) {
    setEditingId(item.consigneeId);
    setForm({
      ...blankConsignee(), consigneeCode: item.consigneeCode, displayName: item.displayName, legalName: item.legalName,
      tradeName: item.tradeName, tin: item.tin, contactPerson: item.contactPerson, email: item.email, phone: item.phone,
      addressLine: item.addressLine, city: item.city, province: item.province, postalCode: item.postalCode,
      vatTreatment: item.vatTreatment, defaultCommissionRate: item.defaultCommissionRate,
      defaultPaymentTermsDays: item.defaultPaymentTermsDays, defaultSettlementFrequency: item.defaultSettlementFrequency,
      defaultSalesReportFrequency: item.defaultSalesReportFrequency, defaultExposureLimit: item.defaultExposureLimit,
      defaultShrinkageResponsibility: item.defaultShrinkageResponsibility, defaultEwtRate: item.defaultEwtRate,
      defaultPriceTolerance: item.defaultPriceTolerance, defaultListingFeeSettlement: item.defaultListingFeeSettlement,
    });
  }

  function cancelEdit() { setEditingId(null); setForm(blankConsignee()); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try { await consignmentApi.saveConsignee(form, editingId ?? undefined); setMessage(editingId ? "Consignee updated." : "Consignee submitted for review."); cancelEdit(); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the consignee."); }
    finally { setSaving(false); }
  }

  async function review(item: ConsignmentConsignee, decision: "approve" | "reject") {
    setWorkingId(item.consigneeId); setError(""); setMessage("");
    try { await consignmentApi.reviewConsignee(item.consigneeId, decision, rejectReasons[item.consigneeId]); setMessage(`${item.displayName} was ${decision === "approve" ? "approved" : "rejected"}.`); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review the consignee."); }
    finally { setWorkingId(null); }
  }

  function textField<K extends keyof ConsignmentConsigneeInput>(key: K, label: string, type = "text", required = false) {
    const value = form[key];
    return <label key={String(key)} className="space-y-1 text-sm"><span>{label}</span><input className="h-10 w-full rounded-md border bg-background px-3" type={type} required={required} value={value == null ? "" : String(value)} onChange={(event) => setForm((current) => ({ ...current, [key]: type === "number" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value }))} /></label>;
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_OPERATIONAL_AREAS")) return <main className="p-6 text-sm text-muted-foreground">Consignment operational access is required.</main>;

  return (
    <main className="space-y-6 p-6">
      <div><h1 className="text-2xl font-semibold">Consignees</h1><p className="mt-1 text-sm text-muted-foreground">Maintain consignee details and review new records before activating them.</p></div>
      {error && <Alert variant="destructive"><AlertTitle>Consignee action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      {access.capabilities.includes("CREATE_DOCUMENT") && <form className="space-y-4 rounded-lg border p-4" onSubmit={(event) => void save(event)}>
        <div><h2 className="font-semibold">{editingId ? "Edit consignee" : "Add consignee"}</h2><p className="text-xs text-muted-foreground">New consignee records remain pending until reviewed.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {textField("consigneeCode", "Consignee code", "text", true)}{textField("displayName", "Display name", "text", true)}{textField("legalName", "Legal name")}{textField("tradeName", "Trade name")}
          {textField("tin", "TIN")}{textField("contactPerson", "Contact person")}{textField("email", "Email", "email")}{textField("phone", "Phone")}
          {textField("addressLine", "Address")}{textField("city", "City")}{textField("province", "Province")}{textField("postalCode", "Postal code")}
          <label className="space-y-1 text-sm"><span>VAT treatment</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.vatTreatment ?? "NON_VAT"} onChange={(event) => setForm((current) => ({ ...current, vatTreatment: event.target.value }))}><option value="VAT_REGISTERED">VAT registered</option><option value="NON_VAT">Non-VAT</option></select></label>
          {textField("defaultCommissionRate", "Default commission (%)", "number")}{textField("defaultPaymentTermsDays", "Default payment terms (days)", "number")}
          {textField("defaultSettlementFrequency", "Settlement frequency")}{textField("defaultSalesReportFrequency", "Sales report frequency")}
          {textField("defaultExposureLimit", "Exposure limit (₱)", "number")}
          <label className="space-y-1 text-sm"><span>Shrinkage responsibility</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.defaultShrinkageResponsibility ?? "COMPANY"} onChange={(event) => setForm((current) => ({ ...current, defaultShrinkageResponsibility: event.target.value }))}><option value="COMPANY">Company</option><option value="CONSIGNEE">Consignee</option></select></label>
          {textField("defaultEwtRate", "Default EWT (%)", "number")}{textField("defaultPriceTolerance", "Price tolerance (%)", "number")}
          <label className="space-y-1 text-sm"><span>Listing fee settlement</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.defaultListingFeeSettlement ?? "OFFSET"} onChange={(event) => setForm((current) => ({ ...current, defaultListingFeeSettlement: event.target.value }))}><option value="OFFSET">Offset against collections</option><option value="CASH">Cash</option></select></label>
        </div>
        <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Submit consignee"}</Button>{editingId && <Button type="button" variant="outline" onClick={cancelEdit}>Cancel edit</Button>}</div>
      </form>}
      <section className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 space-y-1 text-sm"><span>Search consignees</span><input className="h-10 w-full rounded-md border bg-background px-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, or TIN" /></label><Button variant="outline" onClick={() => void load(0)} disabled={loading}>{loading ? "Searching…" : "Search"}</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[62rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Code / name</th><th className="px-3 py-3">Legal name / TIN</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Rejection reason</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{result?.items.map((item) => <tr key={item.consigneeId} className="border-t align-top"><td className="px-3 py-3"><div className="font-medium">{item.consigneeCode} · {item.displayName}</div><div className="text-xs text-muted-foreground">{item.contactPerson || item.email || "—"}</div></td><td className="px-3 py-3">{item.legalName || "—"}<div className="text-xs text-muted-foreground">{item.tin || "No TIN"}</div></td><td className="px-3 py-3">{item.status}</td><td className="px-3 py-3 text-xs text-destructive">{item.rejectionReason || "—"}</td><td className="min-w-56 space-y-2 px-3 py-3">{access.capabilities.includes("CREATE_DOCUMENT") && <Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button>}{item.status === "PENDING" && access.capabilities.includes("REVIEW_DOCUMENT") && <div className="flex gap-2"><Button size="sm" onClick={() => void review(item, "approve")} disabled={workingId !== null}>{workingId === item.consigneeId ? "Saving…" : "Approve"}</Button><input className="h-9 min-w-24 flex-1 rounded-md border bg-background px-2 text-xs" aria-label={`Rejection reason for ${item.displayName}`} placeholder="Reason to reject" value={rejectReasons[item.consigneeId] ?? ""} onChange={(event) => setRejectReasons((current) => ({ ...current, [item.consigneeId]: event.target.value }))} /><Button size="sm" variant="destructive" onClick={() => void review(item, "reject")} disabled={workingId !== null || !(rejectReasons[item.consigneeId] ?? "").trim()}>Reject</Button></div>}</td></tr>)}{(!result || result.items.length === 0) && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{loading ? "Loading consignees…" : "No consignees found."}</td></tr>}</tbody></table></div>
        {(page > 0 || result?.hasNext) && <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={loading || !result?.hasNext}>Next</Button></div>}
      </section>
    </main>
  );
}
