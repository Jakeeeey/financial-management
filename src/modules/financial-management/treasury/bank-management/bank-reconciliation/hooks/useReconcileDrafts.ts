"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { usePeriodSetup } from "./usePeriodSetup";
import { getOpenPeriod, getSetupPeriod, SetupError } from "../providers/bankReconciliationSetupApi";
import { addTransaction } from "../providers/bankReconciliationTransactionsApi";
import { bankReconciliationRequestId } from "../utils/request-id";
import { emptyEntries, emptyEntry, entryDirty, entryValidation, parseRecovery, recoveryKey, recoveryPatch, sameSetup, type EntryDrafts, type EntryFields, type RecoveryDraft } from "../utils/reconcileDrafts";
import type { TransactionSide } from "../transaction-types";

type Setup = ReturnType<typeof usePeriodSetup>;
type Source = { key: string; actorId: number; bankId: number; periodId: number | null; entries: EntryDrafts; recovery: RecoveryDraft | null; revision: string; lifetime: number };
type Action = { source: Source | null; run: () => void | Promise<void>; side?: TransactionSide };
const storageMessage = "Draft recovery is unavailable in this tab. Keep this page open until your work is saved or explicitly discarded.";

export function useReconcileDrafts(actorId: number | null, setup: Setup) {
  const router = useRouter(), active = useRef<Source | null>(null), mounted = useRef(false), pending = useRef<Action | null>(null), working = useRef(false);
  const owner = useRef({ lifetime: 0 });
  const [view, setView] = useState({ key: "", entries: emptyEntries(), recovery: null as RecoveryDraft | null, storageError: "", error: "", dialog: false, busy: false });
  const { getSnapshot, setAutosavePaused, save, run, load, discard, change } = setup;
  const owns = useCallback((source: Source) => mounted.current && source.lifetime === owner.current.lifetime && active.current === source && window.location.pathname.endsWith("/bank-reconciliation/reconcile"), []);
  useEffect(() => { const session = owner.current; mounted.current = true; session.lifetime++; return () => { mounted.current = false; session.lifetime++; }; }, []);
  const storageFailure = useCallback(() => { if (mounted.current) setView(previous => previous.storageError ? previous : { ...previous, storageError: storageMessage }); }, []);
  const remove = useCallback((source: Source) => {
    try { const raw = sessionStorage.getItem(source.key); if (!raw || JSON.parse(raw).revision === source.revision) sessionStorage.removeItem(source.key); }
    catch { storageFailure(); }
  }, [storageFailure]);
  const persist = useCallback((source = active.current) => {
    if (!source || !owns(source) || source.recovery) return;
    const snapshot = getSnapshot(); if (!snapshot.draft || snapshot.draft.bankId !== source.bankId) return;
    if (!snapshot.dirty && !snapshot.saving && !Object.values(source.entries).some(entryDirty)) { remove(source); return; }
    source.revision = bankReconciliationRequestId();
    const record: RecoveryDraft = { schema: 1, actorId: source.actorId, bankId: source.bankId, periodId: source.periodId, baseVersion: snapshot.period?.version ?? null, baseline: { ...(snapshot.baseline || snapshot.draft) }, setup: { ...snapshot.draft }, attempted: snapshot.attempted ? { ...snapshot.attempted } : null, entries: structuredClone(source.entries), revision: source.revision };
    try { sessionStorage.setItem(source.key, JSON.stringify(record)); } catch { storageFailure(); }
  }, [getSnapshot, owns, remove, storageFailure]);
  const publish = useCallback((source: Source) => {
    if (!owns(source)) return;
    setView(previous => ({ ...previous, key: source.key, entries: structuredClone(source.entries), recovery: source.recovery }));
    persist(source);
  }, [owns, persist]);

  useEffect(() => {
    if (!actorId || setup.loading) return;
    if (!setup.bank || !setup.draft) {
      if (active.current) { active.current = null; pending.current = null; working.current = false; setAutosavePaused(false); setView(previous => ({ ...previous, key: "", entries: emptyEntries(), recovery: null, dialog: false, busy: false })); }
      return;
    }
    const bankId = setup.bank.id, periodId = setup.period?.id ?? null, key = recoveryKey(actorId, bankId, periodId);
    const previous = active.current;
    if (previous?.key === key && previous.lifetime === owner.current.lifetime) { persist(previous); return; }
    if (previous && previous.lifetime === owner.current.lifetime && previous.actorId === actorId && previous.bankId === bankId && previous.periodId === null && periodId !== null) {
      const recovered = previous.recovery;
      remove(previous); previous.key = key; previous.periodId = periodId;
      if (recovered) {
        previous.recovery = { ...recovered, periodId };
        try { sessionStorage.setItem(key, JSON.stringify(previous.recovery)); } catch { storageFailure(); }
      }
      publish(previous); return;
    }
    const source: Source = { key, actorId, bankId, periodId, entries: emptyEntries(setup.draft.periodEnd), recovery: null, revision: bankReconciliationRequestId(), lifetime: owner.current.lifetime };
    active.current = source;
    pending.current = null; working.current = false;
    try {
      let raw = sessionStorage.getItem(key), foundKey = key;
      if (!raw && periodId !== null) { foundKey = recoveryKey(actorId, bankId, null); raw = sessionStorage.getItem(foundKey); }
      if (raw) {
        const recovered = parseRecovery(raw, actorId, bankId, foundKey === key ? periodId : null);
        source.revision = recovered.revision;
        if (sameSetup(recovered.setup, setup.draft) && !Object.values(recovered.entries).some(entryDirty)) sessionStorage.removeItem(foundKey);
        else {
          source.recovery = { ...recovered, periodId };
          if (foundKey !== key) { sessionStorage.setItem(key, JSON.stringify(source.recovery)); sessionStorage.removeItem(foundKey); }
        }
      }
    } catch { storageFailure(); }
    setAutosavePaused(Boolean(source.recovery));
    setView(previousView => ({ ...previousView, key, entries: source.entries, recovery: source.recovery, error: "", dialog: false, busy: false }));
    persist(source);
  }, [actorId, setup.bank, setup.draft, setup.period?.id, setup.period?.version, setup.loading, setup.dirty, setup.saving, persist, publish, remove, setAutosavePaused, storageFailure]);

  const changeSetup = useCallback((patch: Parameters<Setup["change"]>[0]) => { change(patch); persist(); }, [change, persist]);
  const changeEntry = useCallback((side: TransactionSide, patch: Partial<EntryFields>) => {
    const source = active.current; if (!source || !owns(source) || source.recovery || working.current) return;
    source.entries[side] = { ...source.entries[side], fields: { ...source.entries[side].fields, ...patch } }; publish(source);
  }, [owns, publish]);
  const openEntry = useCallback((side: TransactionSide, open: boolean) => {
    const source = active.current; if (!source || !owns(source) || source.recovery || working.current) return;
    if (open && !entryDirty(source.entries[side])) source.entries[side] = emptyEntry(getSnapshot().draft?.periodEnd || "");
    source.entries[side] = { ...source.entries[side], open }; publish(source);
  }, [getSnapshot, owns, publish]);
  const performEntry = useCallback(async (source: Source, side: TransactionSide) => {
    const entry = source.entries[side], error = entryValidation(entry);
    if (error) throw new Error(`${side === "BANK" ? "Bank" : "Ledger"} entry: ${error}`);
    entry.uncertain = true; entry.reviewed = false; publish(source);
    try {
      await run(period => addTransaction(period, side, { ...entry.fields }));
      if (!owns(source)) return;
      source.entries[side] = emptyEntry(getSnapshot().draft?.periodEnd || ""); publish(source);
    } catch (e) {
      if (owns(source)) { entry.uncertain = !(e instanceof SetupError && e.status < 500); publish(source); }
      throw e;
    }
  }, [getSnapshot, owns, publish, run]);
  const submitEntry = useCallback(async (side: TransactionSide) => {
    const source = active.current; if (!source || !owns(source) || working.current) return;
    working.current = true; setView(previous => ({ ...previous, busy: true, error: "" }));
    try { await performEntry(source, side); }
    finally { if (owns(source)) { working.current = false; setView(previous => ({ ...previous, busy: false })); } }
  }, [owns, performEntry]);
  const needsAttention = useCallback(() => !active.current?.recovery && Boolean(getSnapshot().needsAttention || active.current && Object.values(active.current.entries).some(entryDirty)), [getSnapshot]);
  const requestAction = useCallback((action: () => void | Promise<void>, side?: TransactionSide) => {
    const source = active.current;
    if (!side && (source?.recovery || !working.current && !needsAttention())) {
      void Promise.resolve().then(action).catch(e => { if (mounted.current) setView(previous => ({ ...previous, error: e instanceof Error ? e.message : "Unable to continue." })); }); return;
    }
    if (pending.current) return;
    pending.current = { source, run: action, side }; persist(); setAutosavePaused(true);
    setView(previous => ({ ...previous, dialog: true, error: "" }));
  }, [needsAttention, persist, setAutosavePaused]);
  const cancel = useCallback(() => {
    if (working.current) return;
    pending.current = null; setAutosavePaused(Boolean(active.current?.recovery)); setView(previous => ({ ...previous, dialog: false, error: "" }));
  }, [setAutosavePaused]);
  const continueAction = useCallback(async (choice: "save" | "discard") => {
    const action = pending.current, source = action?.source;
    if (!action || !source || !owns(source) || working.current) return;
    working.current = true; setView(previous => ({ ...previous, busy: true, error: "" }));
    try {
      const sides: TransactionSide[] = action.side ? [action.side] : ["BANK", "LEDGER"];
      if (choice === "save") {
        for (const side of sides) if (entryDirty(source.entries[side])) { const issue = entryValidation(source.entries[side]); if (issue) throw new Error(`${side === "BANK" ? "Bank" : "Ledger"} entry: ${issue}`); }
        await save(); if (!owns(source)) return;
        for (const side of sides) if (entryDirty(source.entries[side])) { await performEntry(source, side); if (!owns(source)) return; }
      } else {
        if (!action.side) { await discard(); if (!owns(source)) return; }
        for (const side of sides) source.entries[side] = emptyEntry(getSnapshot().draft?.periodEnd || "");
        publish(source);
      }
      persist(source); pending.current = null; setView(previous => ({ ...previous, dialog: false }));
      await action.run();
    } catch (e) { if (owns(source)) setView(previous => ({ ...previous, error: e instanceof Error ? e.message : "Unable to save. Your input is retained." })); }
    finally { if (owns(source)) { working.current = false; setView(previous => ({ ...previous, busy: false })); setAutosavePaused(Boolean(active.current?.recovery) || Boolean(pending.current)); } }
  }, [discard, getSnapshot, owns, performEntry, persist, publish, save, setAutosavePaused]);

  const restore = useCallback(async () => {
    const source = active.current, recovered = source?.recovery;
    if (!source || !recovered || working.current || !owns(source)) return;
    working.current = true; setView(previous => ({ ...previous, busy: true, error: "" }));
    try {
      const reviewedVersion = getSnapshot().period?.version;
      const latest = source.periodId ? await getSetupPeriod(source.periodId) : (await getOpenPeriod(source.bankId)).period;
      if (!owns(source)) return;
      if (latest?.status === "CLOSED") { load(latest); throw new Error("This period is closed. The recovered values remain available below for review."); }
      if (latest && latest.version !== reviewedVersion) { load(latest); throw new Error("The saved setup changed again. Review the updated values before restoring this draft."); }
      if (latest) load(latest);
      source.recovery = null; source.entries = structuredClone(recovered.entries);
      for (const entry of Object.values(source.entries)) if (entry.uncertain) entry.reviewed = false;
      change(recoveryPatch(recovered)); publish(source);
      setAutosavePaused(false);
    } catch (e) { if (owns(source)) setView(previous => ({ ...previous, error: e instanceof Error ? e.message : "Unable to restore this draft." })); }
    finally { if (owns(source)) { working.current = false; setView(previous => ({ ...previous, busy: false })); } }
  }, [change, getSnapshot, load, owns, publish, setAutosavePaused]);
  const discardRecovery = useCallback(async () => {
    const source = active.current; if (!source || !owns(source) || working.current) return;
    working.current = true; setView(previous => ({ ...previous, busy: true, error: "" }));
    try {
      if (source.periodId === null) await discard();
      if (!mounted.current || source.lifetime !== owner.current.lifetime) return;
      remove(source);
      if (owns(source)) { source.recovery = null; publish(source); }
      if (!active.current || owns(source)) setAutosavePaused(false);
    } catch (e) { if (owns(source)) setView(previous => ({ ...previous, error: e instanceof Error ? e.message : "Unable to discard the recovered draft." })); }
    finally { if (mounted.current && source.lifetime === owner.current.lifetime && (!active.current || owns(source))) { working.current = false; setView(previous => ({ ...previous, busy: false })); } }
  }, [discard, owns, publish, remove, setAutosavePaused]);
  const reviewEntry = useCallback(async (side: TransactionSide) => {
    const source = active.current; if (!source || !owns(source) || working.current) return;
    if (getSnapshot().needsAttention) throw new Error("Save or resolve the setup changes before reviewing the unconfirmed entry.");
    const selected = getSnapshot().period; if (!selected) return;
    const latest = await getSetupPeriod(selected.id); if (!owns(source)) return;
    load(latest); source.entries[side].reviewed = true; publish(source);
  }, [getSnapshot, load, owns, publish]);
  const allowRetry = useCallback((side: TransactionSide) => {
    const source = active.current; if (!source || !owns(source) || !source.entries[side].reviewed) return;
    source.entries[side].uncertain = false; source.entries[side].reviewed = false; publish(source);
  }, [owns, publish]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      persist(); const snapshot = getSnapshot();
      if (snapshot.dirty || snapshot.saving || active.current?.recovery || active.current && Object.values(active.current.entries).some(entryDirty)) { event.preventDefault(); event.returnValue = ""; }
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !needsAttention() && !working.current) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      requestAction(() => { if (url.origin === location.origin) router.push(url.pathname + url.search + url.hash); else window.location.assign(url.href); });
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [getSnapshot, needsAttention, persist, requestAction, router]);

  return { ...view, ready: view.key === (actorId && setup.bank ? recoveryKey(actorId, setup.bank.id, setup.period?.id ?? null) : ""), changeSetup, changeEntry, openEntry, submitEntry, reviewEntry, allowRetry, requestAction, cancel, continueAction, restore, discardRecovery, discardEntry: (side: TransactionSide) => requestAction(() => {}, side) };
}
