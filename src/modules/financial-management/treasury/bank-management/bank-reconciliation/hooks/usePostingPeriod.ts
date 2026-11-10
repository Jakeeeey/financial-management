"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BankAccountReference } from "../reference-types";
import type { PostingAction, PostingCommand, PostingData, PostingReceipt } from "../posting-types";
import { downloadFallbackJournal, downloadPostingExport, getBankPostingPeriod, getPostingPeriod, getPostingReceipt, runPostingCommand, savePostingDate } from "../providers/bankReconciliationPostingApi";
import { SetupError } from "../providers/bankReconciliationSetupApi";
import { bankReconciliationRequestId } from "../utils/request-id";
import { getPeriodHistory } from "../providers/bankReconciliationLifecycleApi";

type PendingRequest = { periodId: number; action: PostingAction; command: PostingCommand };
const requestKey = (id: number) => `bank-reconciliation-posting:${id}`;

function periodUrl(id: number | null, closureId?: number) {
  const url = new URL(window.location.href); if (id == null) url.searchParams.delete("periodId"); else url.searchParams.set("periodId", String(id));
  if (closureId) url.searchParams.set("closureId", String(closureId)); else url.searchParams.delete("closureId"); window.history.replaceState(null, "", url);
}
export function usePostingPeriod(enabled: boolean) {
  const [data, setData] = useState<PostingData | null>(null), [bank, setBank] = useState<BankAccountReference | null>(null), [date, setDate] = useState("");
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [operating, setOperating] = useState(false), [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const operation = useRef(false);
  const current = useRef<PostingData | null>(null), input = useRef(""), dirty = useRef(false), conflict = useRef(false), generation = useRef(0), request = useRef<AbortController | null>(null), pending = useRef<Promise<void> | null>(null);
  const invalidate = useCallback(() => { const token = ++generation.current; request.current?.abort(); return token; }, []);
  const accept = useCallback((result: PostingData) => {
    current.current = result; setData(result); setBank(result.period.bank); input.current = result.postingDate.effective || ""; setDate(input.current); dirty.current = false; conflict.current = false; setError(""); periodUrl(result.period.id, result.period.lifecycle?.closureId);
    if (!operation.current) { try { const saved = sessionStorage.getItem(requestKey(result.period.id)); setPendingRequest(saved ? JSON.parse(saved) : null); } catch { setPendingRequest(null); } }
  }, []);
  const load = useCallback(async (id: number, passive = false, closureId?: number) => {
    if (passive && (dirty.current || pending.current || conflict.current || operation.current)) return;
    const token = invalidate(); const controller = new AbortController(); request.current = controller; setLoading(true);
    try { const result = await getPostingPeriod(id, controller.signal, closureId); if (token === generation.current && !(passive && dirty.current)) { accept(result); setMessage(""); } }
    catch (e) { if (!controller.signal.aborted && token === generation.current) setError(e instanceof Error ? e.message : "Unable to load Posting."); }
    finally { if (token === generation.current) setLoading(false); }
  }, [accept, invalidate]);
  const saveDate = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    const model = current.current;
    if (!model || model.period.status === "CLOSED" || !dirty.current) return Promise.resolve();
    if (conflict.current) { setError("The period changed. Refresh data before saving the posting date."); return Promise.resolve(); }
    const value = input.current || null, { min, max } = model.postingDate;
    if (value !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !min || !max || value < min || value > max)) { setError(min && max ? `Posting date must be between ${min} and ${max}.` : "Set the period end date in Reconcile first."); return Promise.resolve(); }
    const token = invalidate(); setLoading(false); setSaving(true); setError(""); setMessage("");
    const operation = savePostingDate(model.period, value).then(result => { if (token === generation.current) { accept(result); setMessage("Posting date saved"); } }).catch(e => {
      if (token === generation.current) { conflict.current = e instanceof SetupError && e.status === 409; setError(e instanceof Error ? e.message : "Unable to save the posting date."); }
    }).finally(() => { pending.current = null; if (token === generation.current) setSaving(false); });
    pending.current = operation; return operation;
  }, [accept, invalidate]);
  const changeDate = useCallback((value: string) => { input.current = value; setDate(value); dirty.current = true; setMessage(""); setError(""); }, []);
  const selectBank = useCallback(async (selected: BankAccountReference) => {
    if (pending.current) await pending.current;
    const token = invalidate(); const controller = new AbortController(); request.current = controller;
    current.current = null; setData(null); setBank(selected); setDate(""); input.current = ""; dirty.current = false; conflict.current = false; setError(""); setMessage(""); setLoading(true); periodUrl(null);
    try {
      const result = await getBankPostingPeriod(selected.id, controller.signal);
      if (token !== generation.current) return;
      if (result.periodId == null) {
        const history = await getPeriodHistory("", 1, selected.id);
        if (token !== generation.current) return;
        if (history.items.length) await load(history.items[0].id, false, history.items[0].closureId || undefined);
        else { setMessage("No saved reconciliation exists for this bank."); setLoading(false); }
      }
      else await load(result.periodId);
    } catch (e) { if (!controller.signal.aborted && token === generation.current) { setError(e instanceof Error ? e.message : "Unable to load the bank's period."); setLoading(false); } }
  }, [invalidate, load]);
  const refresh = useCallback(() => { if (current.current) void load(current.current.period.id, false, current.current.period.lifecycle?.closureId); }, [load]);
  const remember = useCallback((value: PendingRequest | null, id: number) => { setPendingRequest(value); if (value) sessionStorage.setItem(requestKey(id), JSON.stringify(value)); else sessionStorage.removeItem(requestKey(id)); }, []);
  const complete = useCallback(async (request: PendingRequest, receipt: PostingReceipt) => {
    accept(receipt.data);
    if (request.action === "prepare-export" && ["PREPARED", "EXPORTED"].includes(receipt.state)) {
      await downloadFallbackJournal(request.periodId, request.command.requestId); accept(await getPostingPeriod(request.periodId));
      remember(null, request.periodId); setMessage("Journal file generated. Verify the imported Posted ERP journal before it counts as posted.");
    } else if (receipt.state !== "PENDING" && receipt.state !== "PREPARED") {
      remember(null, request.periodId); if (receipt.state === "FAILED") setError(receipt.error || "The GL batch was rolled back."); else setMessage(request.action === "withdraw" ? "Journal attempt withdrawn. Its file must not be imported." : request.action === "reverse" ? "Reversal posted. The source is unlocked." : "Journal operation completed.");
    } else setMessage("This request is pending. Check its status or retry the same request.");
  }, [accept, remember]);
  const run = useCallback(async (action: PostingAction, selection: Pick<PostingCommand, "sourceKeys" | "journalId" | "glJournalId" | "acknowledgeWithdrawal">) => {
    if (operation.current || pendingRequest) return;
    await saveDate(); if (dirty.current || operation.current) return;
    const model = current.current; if (!model) return;
    const next: PendingRequest = { periodId: model.period.id, action, command: { requestId: bankReconciliationRequestId(), version: model.period.version, bankVersion: model.period.bank.version, ...selection } };
    operation.current = true; invalidate(); setLoading(false); setOperating(true); setError(""); setMessage("");
    try { remember(next, next.periodId); await complete(next, await runPostingCommand(next.periodId, action, next.command)); }
    catch (e) { if (e instanceof SetupError && e.status < 500) remember(null, next.periodId); setError(e instanceof Error ? e.message : "The operation outcome is not confirmed. Check the saved request before retrying."); }
    finally { operation.current = false; setOperating(false); }
  }, [complete, invalidate, pendingRequest, remember, saveDate]);
  const recover = useCallback(async (retry: boolean) => {
    if (!pendingRequest || operation.current) return; operation.current = true; invalidate(); setLoading(false); setOperating(true); setError("");
    try { const receipt = retry ? await runPostingCommand(pendingRequest.periodId, pendingRequest.action, pendingRequest.command) : await getPostingReceipt(pendingRequest.periodId, pendingRequest.command.requestId); if (!retry && ["PENDING", "PREPARED"].includes(receipt.state)) { accept(receipt.data); setMessage("This request is pending. Retry the same request to resume it."); } else await complete(pendingRequest, receipt); }
    catch (e) { if (e instanceof SetupError && e.status === 404) { remember(null, pendingRequest.periodId); setMessage("The request was not committed. Refresh data before starting another operation."); } else setError(e instanceof Error ? e.message : "Unable to confirm the request outcome."); }
    finally { operation.current = false; setOperating(false); }
  }, [accept, complete, invalidate, pendingRequest, remember]);
  useEffect(() => {
    if (!enabled) return;
    const id = new URL(window.location.href).searchParams.get("periodId");
    const revision = new URL(window.location.href).searchParams.get("closureId");
    if (id) { if (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))) void load(Number(id), false, revision && /^[1-9]\d*$/.test(revision) ? Number(revision) : undefined); else setError("Select a valid reconciliation period."); }
    const focus = () => { if (document.visibilityState === "visible" && current.current) void load(current.current.period.id, true, current.current.period.lifecycle?.closureId); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { invalidate(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [enabled, invalidate, load]);
  const selectPeriod = useCallback(async (id: number, closureId?: number) => { await saveDate(); if (dirty.current || operation.current) throw new Error("Save the posting date before switching periods."); await load(id, false, closureId); }, [load, saveDate]);
  const prepareLifecycle = useCallback(async () => { await saveDate(); if (dirty.current || operation.current || pendingRequest) throw new Error("Resolve the pending posting operation or posting date first."); return current.current?.period || null; }, [pendingRequest, saveDate]);
  const exportFile = useCallback(async (format: "xlsx" | "pdf") => {
    if (operation.current || pendingRequest) return;
    operation.current = true; setExporting(format); setError(""); setMessage("");
    try { await saveDate(); if (dirty.current) return; const model = current.current; if (!model) return; invalidate(); setLoading(false); await downloadPostingExport(model.period, format); setMessage(`${format === "xlsx" ? "Excel" : "PDF"} Posting export generated.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to export Posting."); }
    finally { operation.current = false; setExporting(null); }
  }, [invalidate, pendingRequest, saveDate]);
  return { data, bank, date, loading, saving, operating, pendingRequest, exporting, exportFile, error, message, changeDate, saveDate, selectBank, selectPeriod, prepareLifecycle, refresh, run, recover };
}
