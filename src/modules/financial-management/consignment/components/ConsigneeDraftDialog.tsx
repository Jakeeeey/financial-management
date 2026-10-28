"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { accountManagementApi } from "@/modules/financial-management/treasury/bank-management/account-management/providers/accountManagementApi";
import { ConsigneeSaveError, getConsignee, saveConsignee } from "../providers/consignees.api";
import { ConsigneeLocationSelect, type ConsigneeLocationOption } from "./ConsigneeLocationSelect";
import type { ConsigneeDetail, ConsigneeDraft, ConsignmentWorkspace } from "../types";

const identity = [
  ["legalName", "Registered business name", 200], ["tradeName", "Trade name", 160], ["tin", "TIN", 32],
  ["contactPerson", "Contact person", 160], ["email", "Email", 254], ["phone", "Phone", 40],
] as const;
const numbers = [
  ["commissionRate", "Commission (%)", 60], ["paymentTermsDays", "Payment terms (days)", 120],
  ["exposureLimit", "Exposure limit (PHP)", 99999999999999], ["ewtRate", "EWT (%)", 25], ["priceTolerance", "Price tolerance (%)", 50],
] as const;
const choices = [
  ["settlementFrequency", "Settlement frequency", [["WEEKLY", "Weekly"], ["SEMI_MONTHLY", "Twice a month"], ["MONTHLY", "Monthly"]]],
  ["salesReportFrequency", "Sales report frequency", [["WEEKLY", "Weekly"], ["BIWEEKLY", "Every two weeks"], ["MONTHLY", "Monthly"]]],
  ["shrinkageResponsibility", "Shrinkage responsibility", [["CONSIGNEE", "Consignee"], ["COMPANY", "Our company"]]],
  ["listingFeeSettlement", "Listing-fee settlement", [["OFFSET", "Deducted from collections"], ["CASH", "Paid in cash"]]],
] as const;
const submissionRequiredFields = new Set([
  "legalName", "tin", "contactPerson", "email", "phone", "addressLine", "city", "vatTreatment",
]);

function initial(detail: ConsigneeDetail | null): ConsigneeDraft {
  return {
    requestId: crypto.randomUUID(), version: detail?.version ?? null,
    legalName: detail?.legalName ?? "", tradeName: detail?.tradeName ?? "", tin: detail?.tin ?? "",
    vatTreatment: detail?.summary.vatTreatment ?? "", contactPerson: detail?.summary.contactPerson ?? "",
    email: detail?.summary.email ?? "", phone: detail?.summary.phone ?? "",
    addressLine: detail?.addressLine ?? "", city: detail?.city ?? "", province: detail?.province ?? "", postalCode: detail?.postalCode ?? "",
    defaults: detail?.defaults ?? { commissionRate: null, paymentTermsDays: null, settlementFrequency: null,
      salesReportFrequency: null, exposureLimit: null, shrinkageResponsibility: null, ewtRate: null, priceTolerance: null, listingFeeSettlement: null },
  };
}

export function ConsigneeDraftDialog({ detail, onClose, onSaved, returnFocus, workspace = "consignees" }: {
  workspace?: ConsignmentWorkspace; detail: ConsigneeDetail | null; onClose: () => void; onSaved: (detail: ConsigneeDetail) => void; returnFocus: () => void;
}) {
  const [draft, setDraft] = useState(() => initial(detail));
  const initialProvince = useRef(draft.province);
  const baseline = useRef(JSON.stringify(draft));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ConsigneeSaveError | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [retryPayload, setRetryPayload] = useState<ConsigneeDraft | null>(null);
  const [discard, setDiscard] = useState(false);
  const [provinceOptions, setProvinceOptions] = useState<ConsigneeLocationOption[]>([]);
  const [cityOptions, setCityOptions] = useState<ConsigneeLocationOption[]>([]);
  const [locationLoading, setLocationLoading] = useState({ provinces: false, cities: false });
  const [locationErrors, setLocationErrors] = useState<{ provinces: string | null; cities: string | null }>({ provinces: null, cities: null });
  const locationRequestSeq = useRef({ provinces: 0, cities: 0 });
  const errorSummary = useRef<HTMLDivElement>(null);
  const dirty = baseline.current !== JSON.stringify(draft);
  const errors = failure?.fields ?? {};
  function close() { if (busy) return; if (dirty || uncertain) setDiscard(true); else onClose(); }
  function fieldError(key: string) { return errors[key] ? <p id={`draft-${key}-error`} className="mt-1 text-sm text-destructive">{errors[key]}</p> : null; }
  function isSubmissionFieldInvalid(key: string) {
    if (!submissionRequiredFields.has(key)) return false;
    const rawValue = draft[key as keyof ConsigneeDraft];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) return true;
    if (key === "tin") return !/^\d{9}(\d{3})?$/.test(value.replace(/[- ]/g, ""));
    if (key === "email") return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (key === "phone") return !/^\d{10,13}$/.test(value.replace(/[^0-9]/g, ""));
    if (key === "vatTreatment") return value !== "VAT" && value !== "NON_VAT";
    return false;
  }
  const fieldClass = (key: string) => isSubmissionFieldInvalid(key)
    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
    : "";
  const a11y = (key: string) => ({
    id: `draft-${key}`,
    "aria-required": submissionRequiredFields.has(key),
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `draft-${key}-error` : undefined,
  });
  const fieldLabel = (label: string, key: string) => submissionRequiredFields.has(key)
    ? <>{label}<span className="ml-1 text-destructive" aria-hidden="true">*</span><span className="sr-only"> required for submission</span></>
    : label;
  const loadLocationOptions = useCallback(async (
    kind: "provinces" | "cities",
    filters: { provinceCode?: string } = {},
  ) => {
    const sequence = locationRequestSeq.current[kind] + 1;
    locationRequestSeq.current[kind] = sequence;
    setLocationLoading(current => ({ ...current, [kind]: true }));
    setLocationErrors(current => ({ ...current, [kind]: null }));
    try {
      const options = await accountManagementApi.getPsgcOptions({ kind, ...filters });
      if (sequence === locationRequestSeq.current[kind]) {
        if (kind === "provinces") setProvinceOptions(options);
        else setCityOptions(options);
      }
      return options;
    } catch (cause) {
      if (sequence === locationRequestSeq.current[kind]) {
        setLocationErrors(current => ({ ...current, [kind]: cause instanceof Error ? cause.message : "Failed to load PSGC address data" }));
      }
      return [];
    } finally {
      if (sequence === locationRequestSeq.current[kind]) {
        setLocationLoading(current => ({ ...current, [kind]: false }));
      }
    }
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const provinces = await loadLocationOptions("provinces");
      if (!active) return;
      const selectedProvince = provinces.find(option => option.name.trim().toLowerCase() === initialProvince.current.trim().toLowerCase());
      await loadLocationOptions("cities", selectedProvince ? { provinceCode: selectedProvince.code } : {});
    })();
    return () => { active = false; };
  }, [loadLocationOptions]);

  function selectProvince(option: ConsigneeLocationOption) {
    setDraft(current => ({ ...current, province: option.name, city: "" }));
    void loadLocationOptions("cities", { provinceCode: option.code });
  }

  async function retryLocationOptions() {
    const provinces = await loadLocationOptions("provinces");
    const selectedProvince = provinces.find(option => option.name.trim().toLowerCase() === draft.province.trim().toLowerCase());
    await loadLocationOptions("cities", selectedProvince ? { provinceCode: selectedProvince.code } : {});
  }
  async function save() {
    if (busy) return;
    setFailure(null);
    if (!draft.legalName.trim()) {
      setFailure(new ConsigneeSaveError("Check the highlighted fields.", 400, { legalName: "Enter the registered business name." }));
      requestAnimationFrame(() => errorSummary.current?.focus()); return;
    }
    setBusy(true);
    const submitted = retryPayload ?? draft;
    try { onSaved(await saveConsignee(detail?.summary.id ?? null, submitted, workspace)); }
    catch (cause) {
      const error = cause instanceof ConsigneeSaveError ? cause : new ConsigneeSaveError("Unable to confirm the save. Retry the same request before making further changes.", 0);
      setFailure(error);
      if (!detail && (error.status === 0 || error.status >= 500)) { setUncertain(true); setRetryPayload(submitted); }
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally { setBusy(false); }
  }
  async function reload() {
    if (!detail || !window.confirm("Reload the saved draft? Your unsaved changes will be discarded.")) return;
    setBusy(true);
    try {
      const loaded = await getConsignee(detail.summary.id, new AbortController().signal, workspace);
      if (!loaded.editable) { setFailure(new ConsigneeSaveError("This record is no longer editable. Close to inspect it.", 403)); return; }
      const next = initial(loaded); setDraft(next); baseline.current = JSON.stringify(next); setFailure(null);
      const provinces = await loadLocationOptions("provinces");
      const selectedProvince = provinces.find(option => option.name.trim().toLowerCase() === next.province.trim().toLowerCase());
      await loadLocationOptions("cities", selectedProvince ? { provinceCode: selectedProvince.code } : {});
    } catch (cause) { setFailure(new ConsigneeSaveError(cause instanceof Error ? cause.message : "Reload failed.", 0)); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }} onEscapeKeyDown={event => { event.preventDefault(); close(); }} onInteractOutside={event => event.preventDefault()}>
      <DialogHeader className="pr-6"><DialogTitle>{detail ? `Edit draft ${detail.summary.code}` : "New consignee draft"}</DialogTitle>
        <DialogDescription>Fields marked * are required before submission. Only registered business name is required to save a draft; other fields may be blank, but any values provided must be valid. Saving does not submit or approve this consignee.</DialogDescription></DialogHeader>
      <form id="consignee-draft-form" className="min-h-0 space-y-5 overflow-y-auto pr-2" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
        {failure && <div ref={errorSummary} tabIndex={-1} role="alert" className="space-y-2 rounded border border-destructive p-3 focus-visible:outline-2"><p>{failure.message}</p>
          {Object.entries(errors).map(([key, message]) => <a key={key} className="block text-sm underline" href={`#draft-${key}`}>{message}</a>)}
          {failure.status === 409 && detail && <Button type="button" variant="outline" onClick={() => void reload()} disabled={busy}>Reload saved draft</Button>}
        </div>}
        <fieldset disabled={busy || uncertain || failure?.status === 403 || failure?.status === 401} className="space-y-5 disabled:opacity-70">
          <section className="space-y-3"><h3 className="font-semibold">Business identity, contact and address</h3>
            <div className="grid gap-4 sm:grid-cols-2">{identity.map(([key, label, max]) => <div key={key} className="min-w-0">
              <label htmlFor={`draft-${key}`} className="mb-1 block text-sm font-medium">{fieldLabel(label, key)}</label>
              <Input {...a11y(key)} className={fieldClass(key)} maxLength={max} required={key === "legalName"} type={key === "email" ? "email" : "text"} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} />{fieldError(key)}
            </div>)}
            <div className="min-w-0 sm:col-span-2">
              <label htmlFor="draft-addressLine" className="mb-1 block text-sm font-medium">{fieldLabel("Business address", "addressLine")}</label>
              <Input {...a11y("addressLine")} className={fieldClass("addressLine")} maxLength={255} value={draft.addressLine} onChange={event => setDraft({ ...draft, addressLine: event.target.value })} />{fieldError("addressLine")}
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2"><label htmlFor="draft-province" className="block text-sm font-medium">Province</label>{draft.province && <Button type="button" variant="ghost" size="sm" className="h-auto px-1 py-0 text-xs" onClick={() => { setDraft(current => ({ ...current, province: "", city: "" })); void loadLocationOptions("cities"); }}>Clear</Button>}</div>
              <ConsigneeLocationSelect {...a11y("province")} options={provinceOptions} value={draft.province} disabled={busy || locationLoading.provinces || provinceOptions.length === 0} loading={locationLoading.provinces} placeholder="Select province" searchPlaceholder="Search province..." emptyText="No provinces found." onSelect={selectProvince} />
              {fieldError("province")}
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2"><label htmlFor="draft-city" className="block text-sm font-medium">{fieldLabel("City / municipality", "city")}</label>{draft.city && <Button type="button" variant="ghost" size="sm" className="h-auto px-1 py-0 text-xs" onClick={() => setDraft(current => ({ ...current, city: "" }))}>Clear</Button>}</div>
              <ConsigneeLocationSelect {...a11y("city")} className={fieldClass("city")} options={cityOptions} value={draft.city} disabled={busy || locationLoading.cities || cityOptions.length === 0} loading={locationLoading.cities} placeholder="Select city or municipality" searchPlaceholder="Search city or municipality..." emptyText="No cities or municipalities found." onSelect={option => setDraft(current => ({ ...current, city: option.name }))} />
              {fieldError("city")}
            </div>
            <div className="min-w-0">
              <label htmlFor="draft-postalCode" className="mb-1 block text-sm font-medium">Postal code</label>
              <Input {...a11y("postalCode")} maxLength={20} value={draft.postalCode} onChange={event => setDraft({ ...draft, postalCode: event.target.value })} />{fieldError("postalCode")}
            </div>
            <div><label htmlFor="draft-vatTreatment" className="mb-1 block text-sm font-medium">{fieldLabel("VAT treatment", "vatTreatment")}</label>
              <select {...a11y("vatTreatment")} className={`h-10 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring ${fieldClass("vatTreatment")}`} value={draft.vatTreatment} onChange={event => setDraft({ ...draft, vatTreatment: event.target.value })}>
                <option value="">Not specified</option><option value="VAT">VAT-registered</option><option value="NON_VAT">Non-VAT</option>
              </select>{fieldError("vatTreatment")}</div>
            </div>
            {(locationErrors.provinces || locationErrors.cities) && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm sm:col-span-2"><span>{locationErrors.provinces || locationErrors.cities}</span><Button type="button" variant="outline" disabled={locationLoading.provinces || locationLoading.cities} onClick={() => void retryLocationOptions()}>Retry address options</Button></div>}
            <p className="text-sm text-muted-foreground sm:col-span-2">TIN: 9 or 12 digits; spaces and hyphens are accepted. Phone: 10–13 digits.</p>
          </section>
          <details className="rounded-lg border p-3" open={Object.keys(errors).some(key => key.startsWith("defaults.")) || undefined}>
            <summary className="cursor-pointer font-medium focus-visible:outline-2">Optional default terms</summary>
            <p className="my-3 text-sm text-muted-foreground">These are draft defaults, not approved accounting or tax settings. Leave unknown values blank.</p>
            <div className="grid gap-4 sm:grid-cols-2">{numbers.map(([key, label, max]) => <div key={key}>
              <label htmlFor={`draft-defaults.${key}`} className="mb-1 block text-sm font-medium">{label}</label>
              <Input {...a11y(`defaults.${key}`)} type="number" min={key === "commissionRate" || key === "exposureLimit" ? 0.000001 : 0} max={max} step={key === "paymentTermsDays" ? 1 : "0.000001"} value={draft.defaults[key] ?? ""}
                onChange={event => setDraft({ ...draft, defaults: { ...draft.defaults, [key]: event.target.value === "" ? null : Number(event.target.value) } })} />{fieldError(`defaults.${key}`)}
            </div>)}{choices.map(([key, label, options]) => <div key={key}>
              <label htmlFor={`draft-defaults.${key}`} className="mb-1 block text-sm font-medium">{label}</label>
              <select {...a11y(`defaults.${key}`)} className="h-10 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring" value={draft.defaults[key] ?? ""} onChange={event => setDraft({ ...draft, defaults: { ...draft.defaults, [key]: event.target.value || null } })}>
                <option value="">Not specified</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>{fieldError(`defaults.${key}`)}</div>)}</div>
          </details>
        </fieldset>
      </form>
      {discard && <div role="alert" className="space-y-2 rounded border p-3"><p>Discard unsaved changes? A save whose result is unknown may already have persisted.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDiscard(false)}>Keep editing</Button><Button variant="destructive" onClick={onClose}>Discard and close</Button></div></div>}
      <p role="status" className="text-sm text-muted-foreground">{busy ? "Saving or reloading draft. Please wait." : uncertain ? "Save result is unknown. Retry sends the identical creation request." : ""}</p>
      <DialogFooter className="shrink-0 border-t pt-4"><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button>
        <Button form="consignee-draft-form" type="submit" disabled={busy || failure?.status === 401 || failure?.status === 403 || (failure?.status === 409 && !!detail)}>{busy ? "Please wait?" : uncertain ? "Retry save" : "Save draft"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
