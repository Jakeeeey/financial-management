"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBankConfiguration, getOpenPeriod, getSetupPeriod, saveSetupPeriod, SetupError } from "../providers/bankReconciliationSetupApi";
import type { BankConfiguration, PeriodDraft, ReconciliationPeriod } from "../setup-types";

export type SetupFields = { bankId: number; companyId: number | null; currency: string; periodEnd: string; statementOpening: string; statementEnding: string };
export function setupMoney(value: string): string | null {
  const cleaned = value.trim().replaceAll(",", "");
  if (!cleaned) return null;
  if (!/^-?\d{1,16}(\.\d{1,2})?$/.test(cleaned)) throw new Error("Enter an amount with at most 16 whole digits and two decimal places.");
  return cleaned;
}
function fields(period: ReconciliationPeriod): SetupFields {
  return { bankId: period.bankId, companyId: period.companyId, currency: period.currency, periodEnd: period.periodEnd || "", statementOpening: period.statementOpening || "", statementEnding: period.statementEnding || "" };
}
function payload(draft: SetupFields): PeriodDraft {
  return { ...draft, periodEnd: draft.periodEnd || null, statementOpening: setupMoney(draft.statementOpening), statementEnding: setupMoney(draft.statementEnding) };
}

export function usePeriodSetup() {
  const [draft, setDraft] = useState<SetupFields | null>(null), [period, setPeriod] = useState<ReconciliationPeriod | null>(null), [bank, setBank] = useState<BankConfiguration | null>(null);
  const [loading, setLoading] = useState(false), [status, setStatus] = useState(""), [error, setError] = useState("");
  const current = useRef<SetupFields | null>(null), saved = useRef(""), record = useRef<ReconciliationPeriod | null>(null), pending = useRef<Promise<ReconciliationPeriod | null> | null>(null), conflict = useRef(false);
  const commands = useRef<Promise<unknown>>(Promise.resolve());

  const change = useCallback((patch: Partial<SetupFields>) => {
    if (!current.current) return;
    current.current = { ...current.current, ...patch }; setDraft(current.current); setStatus("Unsaved changes");
  }, []);
  const accept = useCallback((result: ReconciliationPeriod) => {
    record.current = result; setPeriod(result); setBank(result.bank);
  }, []);
  const save = useCallback(async (): Promise<ReconciliationPeriod | null> => {
    if (pending.current) { await pending.current; }
    if (!current.current || record.current?.status === "CLOSED") return record.current;
    if (conflict.current) throw new Error("The period changed in another session. Reload the setup before saving.");
    let body: PeriodDraft;
    try { body = payload(current.current); } catch (e) { const message = e instanceof Error ? e.message : "Check the amounts."; setError(message); setStatus("Not saved"); throw e; }
    const signature = JSON.stringify(body);
    if (signature === saved.current) return record.current;
    setStatus("Saving…"); setError("");
    const operation = saveSetupPeriod({ ...body, version: record.current?.version }, record.current?.id)
      .then(result => {
        accept(result); saved.current = signature; setStatus("Setup saved");
        const url = new URL(window.location.href); url.searchParams.set("periodId", String(result.id)); window.history.replaceState(null, "", url);
        return result;
      }).catch(e => { conflict.current = e instanceof SetupError && e.status === 409; setError(e.message); setStatus("Not saved"); throw e; })
      .finally(() => { pending.current = null; });
    pending.current = operation;
    return operation;
  }, [accept]);
  const run = useCallback(<T extends { period: ReconciliationPeriod }>(operation: (period: ReconciliationPeriod) => Promise<T>): Promise<T> => {
    const task = commands.current.catch(() => {}).then(async () => {
      const latest = await save();
      if (!latest) throw new Error("Select and save a bank account first.");
      const work = operation(latest).then(result => { accept(result.period); return result; })
        .catch(e => { if (e instanceof SetupError && e.status === 409) conflict.current = true; throw e; })
        .finally(() => { pending.current = null; });
      pending.current = work.then(result => result.period, () => record.current);
      return work;
    });
    commands.current = task;
    return task;
  }, [accept, save]);
  const load = useCallback((result: ReconciliationPeriod) => {
    const next = fields(result); current.current = next; setDraft(next); saved.current = JSON.stringify(payload(next)); conflict.current = false;
    accept(result); setError(""); setStatus(result.status === "CLOSED" ? "Closed period" : "Setup saved");
  }, [accept]);
  const selectBank = useCallback(async (id: number, companyId: number | null) => {
    setLoading(true); setError("");
    try {
      await save();
      const [configuration, opened] = await Promise.all([getBankConfiguration(id), getOpenPeriod(id)]);
      if (opened.period) load(opened.period);
      else {
        record.current = null; setPeriod(null); setBank(configuration); saved.current = ""; conflict.current = false;
        current.current = { bankId: id, companyId: configuration.companyId ?? companyId, currency: configuration.currency, periodEnd: "", statementOpening: "", statementEnding: "" };
        setDraft(current.current); setStatus("Unsaved changes");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load setup."); }
    finally { setLoading(false); }
  }, [load, save]);
  const reload = useCallback(async () => {
    if (!record.current) return;
    setLoading(true);
    try { if (pending.current) await pending.current.catch(() => null); load(await getSetupPeriod(record.current.id)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to reload setup."); }
    finally { setLoading(false); }
  }, [load]);
  const clear = useCallback(() => {
    current.current = null; record.current = null; saved.current = ""; conflict.current = false;
    setDraft(null); setPeriod(null); setBank(null); setStatus(""); setError("");
    const url = new URL(window.location.href); url.searchParams.delete("periodId"); window.history.replaceState(null, "", url);
  }, []);
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("periodId");
    if (!id || !/^[1-9]\d*$/.test(id)) return;
    let active = true;
    setLoading(true);
    getSetupPeriod(Number(id)).then(result => { if (active) load(result); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => {
    if (!draft || loading || period?.status === "CLOSED") return;
    const timer = setTimeout(() => { void save().catch(() => {}); }, 650);
    return () => clearTimeout(timer);
  }, [draft, loading, period?.status, save]);
  return { draft, period, bank, loading, status, error, change, save, run, selectBank, load, accept, reload, clear, setBank, setError };
}
