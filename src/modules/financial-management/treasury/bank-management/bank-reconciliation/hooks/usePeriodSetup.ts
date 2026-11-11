"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBankConfiguration, getOpenPeriod, getSetupPeriod, saveSetupPeriod, SetupError } from "../providers/bankReconciliationSetupApi";
import type { BankConfiguration, PeriodDraft, ReconciliationPeriod } from "../setup-types";
import { getPeriodHistory } from "../providers/bankReconciliationLifecycleApi";
import { sameSetup } from "../utils/reconcileDrafts";

export type SetupFields = { bankId: number; companyId: number | null; currency: string; periodEnd: string; statementOpening: string; statementEnding: string };
type SetupScope = { lifetime: number; selection: number; pathname: string };
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
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [autosavePaused, setPaused] = useState(false);
  const baseline = useRef<SetupFields | null>(null), submitted = useRef<SetupFields | null>(null), paused = useRef(false), failed = useRef(false);
  const autoRetry = useRef(true);
  const unconfirmed = useRef<SetupFields | null>(null);
  const current = useRef<SetupFields | null>(null), saved = useRef(""), record = useRef<ReconciliationPeriod | null>(null), pending = useRef<Promise<ReconciliationPeriod | null> | null>(null), conflict = useRef(false);
  const commands = useRef<Promise<unknown>>(Promise.resolve());
  const owner = useRef({ mounted: false, lifetime: 0, selection: 0, pathname: "" }), reading = useRef(0);
  const scope = useCallback((): SetupScope => ({ lifetime: owner.current.lifetime, selection: owner.current.selection, pathname: owner.current.pathname }), []);
  const owns = useCallback((source: SetupScope) => owner.current.mounted && source.lifetime === owner.current.lifetime && source.selection === owner.current.selection && window.location.pathname === source.pathname, []);
  const ownsRead = useCallback((source: SetupScope, request: number) => owns(source) && reading.current === request, [owns]);
  useEffect(() => {
    const activeOwner = owner.current;
    activeOwner.mounted = true; activeOwner.lifetime++; activeOwner.pathname = window.location.pathname;
    return () => { activeOwner.mounted = false; activeOwner.lifetime++; };
  }, []);
  const periodUrl = useCallback((source: SetupScope, id: number | null, closureId?: number) => {
    if (!owns(source)) return;
    const url = new URL(window.location.href);
    if (id == null) url.searchParams.delete("periodId"); else url.searchParams.set("periodId", String(id));
    if (closureId) url.searchParams.set("closureId", String(closureId)); else url.searchParams.delete("closureId");
    window.history.replaceState(null, "", url);
  }, [owns]);

  const change = useCallback((patch: Partial<SetupFields>) => {
    if (!owns(scope()) || !current.current || record.current?.status === "CLOSED") return;
    current.current = { ...current.current, ...patch }; setDraft(current.current);
    autoRetry.current = true;
    const changed = failed.current || !record.current || !baseline.current || !sameSetup(current.current, baseline.current);
    setDirty(changed); setStatus(changed ? "Unsaved changes" : submitted.current ? "Saving…" : "Setup saved");
  }, [owns, scope]);
  const accept = useCallback((result: ReconciliationPeriod, source = scope()) => {
    if (!owns(source)) return;
    record.current = result; setPeriod(result); setBank(result.bank);
  }, [owns, scope]);
  const save = useCallback(async (): Promise<ReconciliationPeriod | null> => {
    const source = scope();
    if (!owns(source)) return null;
    while (pending.current) { await pending.current; if (!owns(source)) return null; }
    if (!current.current || record.current?.status === "CLOSED") return record.current;
    if (conflict.current) throw new Error("The period changed in another session. Reload the setup before saving.");
    if (failed.current && record.current) {
      const latest = await getSetupPeriod(record.current.id);
      if (!owns(source)) return null;
      if (latest.version !== record.current.version) throw new SetupError(409, "The saved setup changed. Reload and review it before saving again.");
    }
    let body: PeriodDraft;
    try { body = payload(current.current); } catch (e) { const message = e instanceof Error ? e.message : "Check the amounts."; setError(message); setStatus("Not saved"); throw e; }
    const signature = JSON.stringify(body);
    if (signature === saved.current || record.current && baseline.current && sameSetup(current.current, baseline.current)) { failed.current = false; unconfirmed.current = null; setDirty(false); setError(""); setStatus("Setup saved"); return record.current; }
    submitted.current = { ...current.current }; setSaving(true); setStatus("Saving…"); setError("");
    const operation = saveSetupPeriod({ ...body, version: record.current?.version }, record.current?.id)
      .then(result => {
        if (owns(source)) {
          accept(result, source); saved.current = signature; baseline.current = fields(result); failed.current = false; unconfirmed.current = null;
          const changed = Boolean(current.current && !sameSetup(current.current, baseline.current));
          setDirty(changed); setStatus(changed ? "Unsaved changes" : "Setup saved");
          periodUrl(source, result.id, result.lifecycle?.closureId);
        }
        return result;
      }).catch(e => { if (owns(source)) { unconfirmed.current = e instanceof SetupError && e.status < 500 ? null : submitted.current; failed.current = true; autoRetry.current = false; setDirty(true); conflict.current = e instanceof SetupError && e.status === 409; setError(e.message); setStatus("Not saved"); } throw e; })
      .finally(() => { if (pending.current === operation) { pending.current = null; submitted.current = null; if (owns(source)) setSaving(false); } });
    pending.current = operation;
    return operation;
  }, [accept, owns, periodUrl, scope]);
  const run = useCallback(<T extends { period: ReconciliationPeriod }>(operation: (period: ReconciliationPeriod) => Promise<T>): Promise<T> => {
    const source = scope();
    const task = commands.current.catch(() => {}).then(async () => {
      if (!owns(source)) throw new DOMException("The reconciliation selection changed.", "AbortError");
      const latest = await save();
      if (!owns(source)) throw new DOMException("The reconciliation selection changed.", "AbortError");
      if (!latest) throw new Error("Select and save a bank account first.");
      const work = operation(latest).then(result => { accept(result.period, source); return result; })
        .catch(e => { if (owns(source) && e instanceof SetupError && e.status === 409) conflict.current = true; throw e; });
      const waiting = work.then(result => result.period, () => null);
      pending.current = waiting;
      try { return await work; } finally { if (pending.current === waiting) pending.current = null; }
    });
    commands.current = task;
    return task;
  }, [accept, owns, save, scope]);
  const load = useCallback((result: ReconciliationPeriod, source = scope()) => {
    if (!owns(source)) return;
    owner.current.selection++; reading.current++;
    const next = fields(result); current.current = next; baseline.current = next; unconfirmed.current = null; setDraft(next); saved.current = JSON.stringify(payload(next)); conflict.current = false; failed.current = false; autoRetry.current = true; setDirty(false);
    accept(result); setError(""); setStatus(result.status === "CLOSED" ? "Closed period" : "Setup saved");
    setLoading(false); periodUrl(scope(), result.id, result.lifecycle?.closureId);
  }, [accept, owns, periodUrl, scope]);
  const selectBank = useCallback(async (id: number, companyId: number | null) => {
    const source = scope(); if (!owns(source)) return;
    const request = ++reading.current;
    setLoading(true); setError("");
    try {
      await save();
      if (!ownsRead(source, request)) return;
      const [configuration, opened] = await Promise.all([getBankConfiguration(id), getOpenPeriod(id)]);
      if (!ownsRead(source, request)) return;
      if (opened.period) load(opened.period, source);
      else {
        const history = await getPeriodHistory("", 1, id);
        if (!ownsRead(source, request)) return;
        if (history.items.length) { const latest = history.items[0], result = await getSetupPeriod(latest.id, latest.closureId || undefined); if (ownsRead(source, request)) load(result, source); return; }
        owner.current.selection++; reading.current++;
        record.current = null; setPeriod(null); setBank(configuration); saved.current = ""; conflict.current = false; failed.current = false; unconfirmed.current = null; autoRetry.current = true;
        current.current = { bankId: id, companyId: configuration.companyId ?? companyId, currency: configuration.currency, periodEnd: "", statementOpening: "", statementEnding: "" };
        baseline.current = { ...current.current }; setDirty(true); setDraft(current.current); setStatus("Unsaved changes"); setLoading(false); periodUrl(scope(), null);
      }
    } catch (e) { if (ownsRead(source, request)) setError(e instanceof Error ? e.message : "Unable to load setup."); }
    finally { if (ownsRead(source, request)) setLoading(false); }
  }, [load, owns, ownsRead, periodUrl, save, scope]);
  const reload = useCallback(async () => {
    const source = scope(), selected = record.current;
    if (!owns(source) || !selected) return;
    const request = ++reading.current;
    setLoading(true);
    try {
      if (pending.current) await pending.current.catch(() => null);
      if (!ownsRead(source, request)) return;
      const result = await getSetupPeriod(selected.id, selected.lifecycle?.closureId);
      if (ownsRead(source, request)) load(result, source);
    } catch (e) { if (ownsRead(source, request)) setError(e instanceof Error ? e.message : "Unable to reload setup."); }
    finally { if (ownsRead(source, request)) setLoading(false); }
  }, [load, owns, ownsRead, scope]);
  const clear = useCallback(() => {
    if (!owns(scope())) return;
    owner.current.selection++; reading.current++;
    current.current = null; baseline.current = null; unconfirmed.current = null; record.current = null; saved.current = ""; conflict.current = false; failed.current = false;
    setDirty(false); setDraft(null); setPeriod(null); setBank(null); setStatus(""); setError(""); setLoading(false);
    periodUrl(scope(), null);
  }, [owns, periodUrl, scope]);
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("periodId");
    if (!id || !/^[1-9]\d*$/.test(id)) return;
    const source = scope(), request = ++reading.current;
    setLoading(true);
    const revision = new URL(window.location.href).searchParams.get("closureId");
    getSetupPeriod(Number(id), revision && /^[1-9]\d*$/.test(revision) ? Number(revision) : undefined).then(result => { if (ownsRead(source, request)) load(result, source); }).catch(e => { if (ownsRead(source, request)) setError(e.message); }).finally(() => { if (ownsRead(source, request)) setLoading(false); });
  }, [load, ownsRead, scope]);
  useEffect(() => {
    if (!draft || loading || autosavePaused || period?.status === "CLOSED") return;
    const timer = setTimeout(() => { if (!paused.current && autoRetry.current) void save().catch(() => {}); }, 650);
    return () => clearTimeout(timer);
  }, [draft, loading, autosavePaused, period?.status, save]);
  const selectPeriod = useCallback(async (id: number, closureId?: number) => {
    const source = scope(); if (!owns(source)) return;
    const request = ++reading.current;
    setLoading(true); setError("");
    try {
      await save(); if (!ownsRead(source, request)) return;
      const result = await getSetupPeriod(id, closureId); if (ownsRead(source, request)) load(result, source);
    }
    catch (e) { if (ownsRead(source, request)) setError(e instanceof Error ? e.message : "Unable to load period."); throw e; }
    finally { if (ownsRead(source, request)) setLoading(false); }
  }, [load, owns, ownsRead, save, scope]);
  const getSnapshot = useCallback(() => {
    const changed = Boolean(current.current && (failed.current || !record.current || !baseline.current || !sameSetup(current.current, baseline.current)));
    return { draft: current.current, baseline: baseline.current, attempted: submitted.current || unconfirmed.current, period: record.current, saving: submitted.current !== null, dirty: changed, needsAttention: Boolean(current.current && (submitted.current ? !sameSetup(current.current, submitted.current) : changed)) };
  }, []);
  const setAutosavePaused = useCallback((value: boolean) => { paused.current = value; setPaused(value); }, []);
  const discard = useCallback(async () => {
    const source = scope(); if (!owns(source)) return;
    while (pending.current) { await pending.current.catch(() => null); if (!owns(source)) return; }
    const selected = record.current, bankId = current.current?.bankId;
    const latest = selected ? await getSetupPeriod(selected.id, selected.lifecycle?.closureId) : bankId ? (await getOpenPeriod(bankId)).period : null;
    if (!owns(source)) return;
    if (latest) load(latest, source); else clear();
  }, [clear, load, owns, scope]);
  return { draft, period, bank, loading, status, error, dirty, saving, change, save, run, selectBank, selectPeriod, load, accept, reload, clear, discard, getSnapshot, setAutosavePaused, setBank, setError };
}
