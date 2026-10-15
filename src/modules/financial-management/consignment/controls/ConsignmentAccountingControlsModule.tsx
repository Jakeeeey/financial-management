"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import {
  consignmentApi,
  type ConsignmentAccountMappings,
  type ConsignmentPolicy,
} from "../providers/consignmentApi";
import { formatManilaDateTime } from "./control-utils";

export default function ConsignmentAccountingControlsModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [policy, setPolicy] = useState<ConsignmentPolicy | null>(null);
  const [vatRate, setVatRate] = useState("");
  const [ewtRate, setEwtRate] = useState("");
  const [feeTreatment, setFeeTreatment] = useState("");
  const [accountData, setAccountData] = useState<ConsignmentAccountMappings | null>(null);
  const [mappingValues, setMappingValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [savedPolicy, mappings] = await Promise.all([
        consignmentApi.getPolicy(),
        consignmentApi.getAccountMappings(),
      ]);
      setPolicy(savedPolicy);
      setVatRate(savedPolicy?.vatRate == null ? "" : String(savedPolicy.vatRate));
      setEwtRate(savedPolicy?.ewtRate == null ? "" : String(savedPolicy.ewtRate));
      setFeeTreatment(savedPolicy?.defaultListingFeeTreatment ?? "");
      setAccountData(mappings);
      setMappingValues(Object.fromEntries(mappings.mappings.map((item) => [item.key, item.accountId == null ? "" : String(item.accountId)])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Consignment accounting controls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const assignedCount = useMemo(() => Object.values(mappingValues).filter(Boolean).length, [mappingValues]);

  async function savePolicy() {
    setSavingPolicy(true);
    setError("");
    setMessage("");
    try {
      const saved = await consignmentApi.savePolicy({
        vatRate: vatRate === "" ? null : Number(vatRate),
        ewtRate: ewtRate === "" ? null : Number(ewtRate),
        defaultListingFeeTreatment: feeTreatment || null,
      });
      setPolicy(saved);
      setMessage("Consignment tax and fee policy saved and recorded in the audit trail.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save Consignment policy.");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function saveMappings() {
    if (!accountData) return;
    setSavingMappings(true);
    setError("");
    setMessage("");
    try {
      const saved = await consignmentApi.saveAccountMappings(accountData.mappings.map((item) => ({
        key: item.key,
        accountId: mappingValues[item.key] ? Number(mappingValues[item.key]) : null,
      })));
      setAccountData(saved);
      setMappingValues(Object.fromEntries(saved.mappings.map((item) => [item.key, item.accountId == null ? "" : String(item.accountId)])));
      setMessage("Chart-of-account mappings saved and recorded in the audit trail.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save account mappings.");
    } finally {
      setSavingMappings(false);
    }
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("MANAGE_POLICIES")) {
    return <main className="p-6 text-sm text-muted-foreground">Consignment Controller access is required to manage accounting controls.</main>;
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Consignment Policies & Account Mappings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Maintain provisional Consignment rates and map the module to existing ERP chart-of-account entries.</p>
      </div>
      {error && <Alert variant="destructive"><AlertTitle>Could not save changes</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      <Alert>
        <AlertTitle>Posting remains gated</AlertTitle>
        <AlertDescription>
          Accounting and tax owner sign-off is still required. Saving rates or mappings does not enable posting. The shared ERP ledger writer is {accountData?.postingEnabled ? "configured" : "disabled"}, and all required accounts are {accountData?.complete ? "mapped" : "not yet mapped"}.
        </AlertDescription>
      </Alert>

      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="text-lg font-semibold">Tax and fee policy</h2>
          <p className="text-sm text-muted-foreground">Prototype values are not approved accounting or tax policy.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm"><span className="block">VAT rate (%)</span><input className="h-10 w-full rounded-md border bg-background px-3" type="number" min="0" max="25" step="0.000001" value={vatRate} onChange={(event) => setVatRate(event.target.value)} required /></label>
          <label className="space-y-1 text-sm"><span className="block">EWT rate (%)</span><input className="h-10 w-full rounded-md border bg-background px-3" type="number" min="0" max="25" step="0.000001" value={ewtRate} onChange={(event) => setEwtRate(event.target.value)} required /></label>
          <label className="space-y-1 text-sm"><span className="block">Default listing-fee treatment</span><select className="h-10 w-full rounded-md border bg-background px-3" value={feeTreatment} onChange={(event) => setFeeTreatment(event.target.value)}><option value="">Not configured</option><option value="CONTRA">Contra-revenue</option><option value="DISTINCT">Expense</option></select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Last saved: {formatManilaDateTime(policy?.updatedAt)}</p>
          <Button onClick={() => void savePolicy()} disabled={loading || savingPolicy || savingMappings || vatRate === "" || ewtRate === "" || !feeTreatment}>{savingPolicy ? "Saving…" : "Save policy"}</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Chart-of-account mapping</h2>
            <p className="text-sm text-muted-foreground">Map each Consignment accounting purpose to an existing ERP account; no accounts are created here.</p>
          </div>
          <span className="text-sm text-muted-foreground">{assignedCount} / {accountData?.mappings.length ?? 0} mapped</span>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading accounting controls…</p> : accountData && (
          <div className="space-y-3">
            {accountData.mappings.map((item) => (
              <label key={item.key} className="grid gap-2 text-sm sm:grid-cols-[minmax(14rem,1fr)_minmax(18rem,2fr)] sm:items-center">
                <span className="font-medium">{item.label}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3" value={mappingValues[item.key] ?? ""} onChange={(event) => setMappingValues((current) => ({ ...current, [item.key]: event.target.value }))}>
                  <option value="">Select an ERP account</option>
                  {[...accountData.accounts].sort((a, b) => (a.accountCode ?? "").localeCompare(b.accountCode ?? "")).map((account) => (
                    <option key={account.accountId} value={account.accountId}>{account.accountCode ?? "No code"} · {account.accountName ?? `Account #${account.accountId}`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">The mapping list updates only the Consignment control table. Existing ERP chart accounts remain authoritative.</p>
          <Button onClick={() => void saveMappings()} disabled={loading || savingPolicy || savingMappings || !accountData}>{savingMappings ? "Saving…" : "Save account mappings"}</Button>
        </div>
      </section>
    </main>
  );
}
