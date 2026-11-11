"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { usePeriodSetup } from "./usePeriodSetup";
import { getSetupPeriod, SetupError } from "../providers/bankReconciliationSetupApi";
import { addTransaction } from "../providers/bankReconciliationTransactionsApi";
import { emptyEntries, emptyEntry, entryDirty, entryValidation, type EntryDrafts, type EntryFields } from "../utils/reconcileDrafts";
import type { TransactionSide } from "../transaction-types";

type Setup = ReturnType<typeof usePeriodSetup>;
type Source = { identity: string; actorId: number; bankId: number; periodId: number | null; entries: EntryDrafts; lifetime: number };
type Action = { source: Source | null; run: () => void | Promise<void>; side?: TransactionSide };

export function useReconcileDrafts(actorId: number | null, setup: Setup, entriesReady: boolean) {
  const router = useRouter(), active = useRef<Source | null>(null), mounted = useRef(false), pending = useRef<Action | null>(null), working = useRef(false);
  const owner = useRef({ lifetime: 0 });
  const [view, setView] = useState({ entries: emptyEntries(), error: "", dialog: false, busy: false });
  const { getSnapshot, setAutosavePaused, save, run, load, discard, change } = setup;
  const owns = useCallback((source: Source) => mounted.current && source.lifetime === owner.current.lifetime && active.current === source && window.location.pathname.endsWith("/bank-reconciliation/reconcile"), []);
  useEffect(() => { const session = owner.current; mounted.current = true; session.lifetime++; return () => { mounted.current = false; session.lifetime++; }; }, []);
  const publish = useCallback((source: Source) => {
    if (!owns(source)) return;
    setView(previous => ({ ...previous, entries: structuredClone(source.entries) }));
  }, [owns]);

  useEffect(() => {
    if (!actorId || setup.loading) return;
    if (!setup.bank || !setup.draft) {
      if (active.current) { active.current = null; pending.current = null; working.current = false; setAutosavePaused(false); setView(previous => ({ ...previous, entries: emptyEntries(), dialog: false, busy: false })); }
      return;
    }
    const bankId = setup.bank.id, periodId = setup.period?.id ?? null, identity = `${actorId}:${bankId}:${periodId ?? "new"}`;
    const previous = active.current;
    if (previous?.identity === identity && previous.lifetime === owner.current.lifetime) return;
    if (previous && previous.lifetime === owner.current.lifetime && previous.actorId === actorId && previous.bankId === bankId && previous.periodId === null && periodId !== null) {
      previous.identity = identity; previous.periodId = periodId;
      publish(previous); return;
    }
    const source: Source = { identity, actorId, bankId, periodId, entries: emptyEntries(setup.draft.periodEnd), lifetime: owner.current.lifetime };
    active.current = source; pending.current = null; working.current = false;
    setAutosavePaused(false);
    setView(previousView => ({ ...previousView, entries: source.entries, error: "", dialog: false, busy: false }));
  }, [actorId, setup.bank, setup.draft, setup.period?.id, setup.period?.version, setup.loading, setup.dirty, setup.saving, publish, setAutosavePaused]);

  const changeSetup = useCallback((patch: Parameters<Setup["change"]>[0]) => { change(patch); }, [change]);
  const changeEntry = useCallback((side: TransactionSide, patch: Partial<EntryFields>) => {
    const source = active.current; if (!source || !owns(source) || working.current) return;
    source.entries[side] = { ...source.entries[side], fields: { ...source.entries[side].fields, ...patch } }; publish(source);
  }, [owns, publish]);
  const openEntry = useCallback((side: TransactionSide, open: boolean) => {
    const source = active.current; if (!source || !owns(source) || working.current) return;
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
    if (!entriesReady) throw new Error("Load the current transactions before adding a line.");
    working.current = true; setView(previous => ({ ...previous, busy: true, error: "" }));
    try { await performEntry(source, side); }
    finally { if (owns(source)) { working.current = false; setView(previous => ({ ...previous, busy: false })); } }
  }, [entriesReady, owns, performEntry]);
  const needsAttention = useCallback(() => Boolean(getSnapshot().needsAttention || active.current && Object.values(active.current.entries).some(entryDirty)), [getSnapshot]);
  const requestAction = useCallback((action: () => void | Promise<void>, side?: TransactionSide) => {
    const source = active.current;
    if (!side && (!working.current && !needsAttention())) {
      void Promise.resolve().then(action).catch(e => { if (mounted.current) setView(previous => ({ ...previous, error: e instanceof Error ? e.message : "Unable to continue." })); }); return;
    }
    if (pending.current) return;
    pending.current = { source, run: action, side }; setAutosavePaused(true);
    setView(previous => ({ ...previous, dialog: true, error: "" }));
  }, [needsAttention, setAutosavePaused]);
  const cancel = useCallback(() => {
    if (working.current) return;
    pending.current = null; setAutosavePaused(false); setView(previous => ({ ...previous, dialog: false, error: "" }));
  }, [setAutosavePaused]);
  const continueAction = useCallback(async (choice: "save" | "discard") => {
    const action = pending.current, source = action?.source;
    if (!action || !source || !owns(source) || working.current) return;
    working.current = true; setView(previous => ({ ...previous, busy: true, error: "" }));
    try {
      const sides: TransactionSide[] = action.side ? [action.side] : ["BANK", "LEDGER"];
      if (choice === "save") {
        if (!entriesReady && sides.some(side => entryDirty(source.entries[side]))) throw new Error("Load the current transactions before saving entry drafts. Cancel and retry loading, or discard the drafts to continue.");
        for (const side of sides) if (entryDirty(source.entries[side])) { const issue = entryValidation(source.entries[side]); if (issue) throw new Error(`${side === "BANK" ? "Bank" : "Ledger"} entry: ${issue}`); }
        await save(); if (!owns(source)) return;
        for (const side of sides) if (entryDirty(source.entries[side])) { await performEntry(source, side); if (!owns(source)) return; }
      } else {
        if (!action.side) { await discard(); if (!owns(source)) return; }
        for (const side of sides) source.entries[side] = emptyEntry(getSnapshot().draft?.periodEnd || "");
        publish(source);
      }
      pending.current = null; setView(previous => ({ ...previous, dialog: false }));
      await action.run();
    } catch (e) { if (owns(source)) setView(previous => ({ ...previous, error: e instanceof Error ? e.message : "Unable to save. Your input is retained." })); }
    finally { if (owns(source)) { working.current = false; setView(previous => ({ ...previous, busy: false })); setAutosavePaused(Boolean(pending.current)); } }
  }, [discard, entriesReady, getSnapshot, owns, performEntry, publish, save, setAutosavePaused]);

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
      const snapshot = getSnapshot();
      if (snapshot.dirty || snapshot.saving || active.current && Object.values(active.current.entries).some(entryDirty)) { event.preventDefault(); event.returnValue = ""; }
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
  }, [getSnapshot, needsAttention, requestAction, router]);

  return { ...view, ready: Boolean(actorId && setup.bank), changeSetup, changeEntry, openEntry, submitEntry, reviewEntry, allowRetry, requestAction, cancel, continueAction, discardEntry: (side: TransactionSide) => requestAction(() => {}, side) };
}
