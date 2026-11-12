"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BankAccountReference } from "../reference-types";
import type { PostingAction, PostingCommand, PostingData, PostingReceipt } from "../posting-types";
import { downloadFallbackJournal, downloadPostingExport, getBankPostingPeriod, getPostingPeriod, getPostingReceipt, runPostingCommand, savePostingDate } from "../providers/bankReconciliationPostingApi";
import { SetupError } from "../providers/bankReconciliationSetupApi";
import { bankReconciliationRequestId } from "../utils/request-id";
import { getPeriodHistory } from "../providers/bankReconciliationLifecycleApi";
import { postingDateError } from "../utils/postingDate";
import { toast } from "sonner";

type PendingRequest = { periodId: number; action: PostingAction; command: PostingCommand };
type ReadTarget = { kind: "period"; id: number; closureId?: number } | { kind: "bank"; bank: BankAccountReference };
type ReadState = { status: "idle" | "loading" | "ready" | "empty" | "error"; error: string; target: ReadTarget | null };
type DateInput = { value: string; badInput: boolean; failure?: { message: string; retryable: boolean; invalid: boolean } };

function periodUrl(id: number | null, closureId?: number) {
  const url = new URL(window.location.href); if (id == null) url.searchParams.delete("periodId"); else url.searchParams.set("periodId", String(id));
  if (closureId) url.searchParams.set("closureId", String(closureId)); else url.searchParams.delete("closureId"); window.history.replaceState(null, "", url);
}
export function usePostingPeriod(enabled: boolean) {
  const [data, setData] = useState<PostingData | null>(null), [bank, setBank] = useState<BankAccountReference | null>(null);
  const [dateInput, setDateInput] = useState<DateInput>({ value: "", badInput: false });
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [readState, setReadState] = useState<ReadState>({ status: "idle", error: "", target: null });
  const read = useRef(readState), alive = useRef(false), pathname = useRef("");
  const [operating, setOperating] = useState(false), [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const operation = useRef(false);
  const current = useRef<PostingData | null>(null), input = useRef(dateInput), dirty = useRef(false), conflict = useRef(false), generation = useRef(0), request = useRef<AbortController | null>(null), pending = useRef<Promise<boolean> | null>(null);
  const updateDate = useCallback((value: DateInput) => { input.current = value; setDateInput(value); }, []);
  const invalidate = useCallback(() => { const token = ++generation.current; request.current?.abort(); return token; }, []);
  const owns = useCallback((token: number) => alive.current && token === generation.current && window.location.pathname === pathname.current, []);
  const markRead = useCallback((status: ReadState["status"], error = "", target = read.current.target) => { const value = { status, error, target }; read.current = value; setReadState(value); }, []);
  const accept = useCallback((result: PostingData, preserveDate = false, clearError = true) => {
    const retain = preserveDate && dirty.current && current.current?.period.id === result.period.id && current.current.period.lifecycle?.closureId === result.period.lifecycle?.closureId;
    current.current = result; setData(result); setBank(result.period.bank);
    if (!retain) { updateDate({ value: result.postingDate.effective || "", badInput: false }); dirty.current = false; conflict.current = false; }
    if (clearError) setError("");
    markRead("ready", "", { kind: "period", id: result.period.id, closureId: result.period.lifecycle?.closureId });
    periodUrl(result.period.id, result.period.lifecycle?.closureId);
  }, [markRead, updateDate]);
  const load = useCallback(async (id: number, passive = false, closureId?: number, preserveDate = false) => {
    if (!alive.current || window.location.pathname !== pathname.current) return;
    if (passive && (dirty.current || pending.current || conflict.current || operation.current)) return;
    const token = invalidate(); const controller = new AbortController(); request.current = controller;
    if (current.current && (current.current.period.id !== id || current.current.period.lifecycle?.closureId !== closureId)) { current.current = null; setData(null); setBank(null); updateDate({ value: "", badInput: false }); dirty.current = false; conflict.current = false; }
    markRead("loading", "", { kind: "period", id, closureId }); setMessage("");
    try { const result = await getPostingPeriod(id, controller.signal, closureId); if (owns(token)) accept(result, preserveDate || passive, !passive && !preserveDate); }
    catch (e) { if (!controller.signal.aborted && owns(token)) markRead("error", e instanceof Error ? e.message : "Unable to load Posting."); }
  }, [accept, invalidate, markRead, owns, updateDate]);
  const saveDate = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current;
    const model = current.current;
    if (!model || read.current.status !== "ready") return Promise.resolve(false);
    if (model.period.status === "CLOSED") return Promise.resolve(true);
    if (postingDateError(input.current.value, model.postingDate, input.current.badInput)) return Promise.resolve(false);
    if (conflict.current) { updateDate({ ...input.current, failure: { message: "The period changed. Refresh data before saving the posting date.", retryable: false, invalid: false } }); return Promise.resolve(false); }
    if (!dirty.current) return Promise.resolve(!input.current.failure);
    const value = input.current.value || null;
    const token = invalidate(); setSaving(true); setError(""); setMessage("");
    const operation = savePostingDate(model.period, value).then(result => { if (!owns(token)) return false; accept(result); setMessage("Posting date saved"); return true; }).catch(e => {
      if (owns(token)) {
        conflict.current = e instanceof SetupError && e.status === 409;
        updateDate({ ...input.current, failure: { message: conflict.current ? "The period changed. Refresh data before saving the posting date." : e instanceof SetupError && e.fieldErrors.postingDate || (e instanceof Error ? e.message : "Unable to save the posting date."), retryable: !(e instanceof SetupError) || e.status >= 500 || e.status === 429, invalid: e instanceof SetupError && Boolean(e.fieldErrors.postingDate) } });
      }
      return false;
    }).finally(() => { pending.current = null; if (owns(token)) setSaving(false); });
    pending.current = operation; return operation;
  }, [accept, invalidate, owns, updateDate]);
  const changeDate = useCallback((value: string, badInput = false) => { if (pending.current || operation.current) return; updateDate({ value, badInput }); dirty.current = true; setMessage(""); setError(""); }, [updateDate]);
  const selectBank = useCallback(async (selected: BankAccountReference) => {
    if (operation.current) return;
    const previous = generation.current;
    if (pending.current) await pending.current;
    if (!owns(previous)) return;
    const token = invalidate(); const controller = new AbortController(); request.current = controller;
    current.current = null; setData(null); setBank(selected); updateDate({ value: "", badInput: false }); dirty.current = false; conflict.current = false; setError(""); setMessage(""); markRead("loading", "", { kind: "bank", bank: selected }); periodUrl(null);
    try {
      const result = await getBankPostingPeriod(selected.id, controller.signal);
      if (!owns(token)) return;
      if (result.periodId == null) {
        const history = await getPeriodHistory("", 1, selected.id);
        if (!owns(token)) return;
        if (history.items.length) await load(history.items[0].id, false, history.items[0].closureId || undefined);
        else { setMessage("No saved reconciliation exists for this bank."); markRead("empty"); }
      }
      else await load(result.periodId);
    } catch (e) { if (!controller.signal.aborted && owns(token)) markRead("error", e instanceof Error ? e.message : "Unable to load the bank's period."); }
  }, [invalidate, load, markRead, owns, updateDate]);
  const retry = useCallback(() => {
    if (read.current.status === "loading" || operation.current || pending.current) return;
    const target = read.current.target;
    if (target?.kind === "period") void load(target.id, false, target.closureId, true);
    else if (target?.kind === "bank") void selectBank(target.bank);
  }, [load, selectBank]);
  const refresh = useCallback(() => {
    if (read.current.status === "loading" || operation.current || pending.current) return;
    const target = read.current.target;
    if (target?.kind === "period") void load(target.id, false, target.closureId);
    else if (target?.kind === "bank") void selectBank(target.bank);
  }, [load, selectBank]);
  const remember = useCallback((value: PendingRequest | null) => { setPendingRequest(value); }, []);
  const complete = useCallback(async (request: PendingRequest, receipt: PostingReceipt) => {
    accept(receipt.data, request.action === "verify-import" || request.action === "withdraw");
    if (request.action === "prepare-export" && ["PREPARED", "EXPORTED"].includes(receipt.state)) {
      await downloadFallbackJournal(request.periodId, request.command.requestId); accept(await getPostingPeriod(request.periodId));
      remember(null); setMessage("Journal file generated. Verify the imported Posted ERP journal before it counts as posted.");
      toast.success("GL import workbook generated", { id: "bank-rec-posting", description: "Verify the imported Posted ERP journal before it counts as posted." });
    } else if (receipt.state !== "PENDING" && receipt.state !== "PREPARED") {
      remember(null);
      if (receipt.state === "FAILED") {
        const message = receipt.error || "The GL batch was rolled back.";
        setError(message); toast.error("Posting failed", { id: "bank-rec-posting-error", description: message, duration: 6000 });
      } else {
        setMessage(request.action === "withdraw" ? "Journal attempt withdrawn. Its file must not be imported." : request.action === "reverse" ? "Reversal posted. The source is unlocked." : "Journal operation completed.");
        const title = request.action === "withdraw" ? "Journal attempt withdrawn" : request.action === "reverse" ? "Reversal posted" : request.action === "verify-import" ? "Imported journal verified" : "Journal posted";
        toast.success(title, { id: "bank-rec-posting", description: request.action === "reverse" ? "The original remains in history and the source is unlocked." : request.action === "withdraw" ? "The file must not be imported." : "The GL journal is confirmed." });
      }
    } else {
      setMessage("This request is pending. Check its status or retry the same request.");
      toast.info("Posting pending", { id: "bank-rec-posting", description: "Check the request or retry the same request before starting another operation." });
    }
  }, [accept, remember]);
  const run = useCallback(async (action: PostingAction, selection: Pick<PostingCommand, "sourceKeys" | "journalId" | "glJournalId" | "acknowledgeWithdrawal">) => {
    if (operation.current || pending.current || pendingRequest || read.current.status !== "ready") return;
    const dependent = action !== "verify-import" && action !== "withdraw", before = current.current;
    if (!before || before.period.status === "CLOSED" || dependent && (input.current.failure || postingDateError(input.current.value, before.postingDate, input.current.badInput))) return;
    operation.current = true; setOperating(true); setError(""); setMessage("");
    try {
      if (dependent && !await saveDate()) return;
      const model = current.current;
      if (!alive.current || window.location.pathname !== pathname.current || read.current.status !== "ready" || !model || model.period.id !== before.period.id) return;
      const next: PendingRequest = { periodId: model.period.id, action, command: { requestId: bankReconciliationRequestId(), version: model.period.version, bankVersion: model.period.bank.version, ...selection } };
      invalidate(); remember(next); await complete(next, await runPostingCommand(next.periodId, action, next.command));
    }
    catch (e) { const message = e instanceof Error ? e.message : "The operation outcome is not confirmed. Check the saved request before retrying."; if (e instanceof SetupError && e.status < 500) remember(null); setError(message); toast.error("Posting failed", { id: "bank-rec-posting-error", description: message, duration: 6000 }); }
    finally { operation.current = false; setOperating(false); }
  }, [complete, invalidate, pendingRequest, remember, saveDate]);
  const recover = useCallback(async (retry: boolean) => {
    if (!pendingRequest || operation.current || read.current.status === "loading") return; operation.current = true; invalidate(); setOperating(true); setError("");
    try { const receipt = retry ? await runPostingCommand(pendingRequest.periodId, pendingRequest.action, pendingRequest.command) : await getPostingReceipt(pendingRequest.periodId, pendingRequest.command.requestId); if (!retry && ["PENDING", "PREPARED"].includes(receipt.state)) { accept(receipt.data); setMessage("This request is pending. Retry the same request to resume it."); } else await complete(pendingRequest, receipt); }
    catch (e) { if (e instanceof SetupError && e.status === 404) { remember(null); setMessage("The request was not committed. Refresh data before starting another operation."); toast.info("Request not committed", { id: "bank-rec-posting", description: "Refresh data before starting another operation." }); } else { const message = e instanceof Error ? e.message : "Unable to confirm the request outcome."; setError(message); toast.error("Unable to confirm posting request", { id: "bank-rec-posting-error", description: message, duration: 6000 }); } }
    finally { operation.current = false; setOperating(false); }
  }, [accept, complete, invalidate, pendingRequest, remember]);
  useEffect(() => {
    if (!enabled) return;
    alive.current = true; pathname.current = window.location.pathname;
    const id = new URL(window.location.href).searchParams.get("periodId");
    const revision = new URL(window.location.href).searchParams.get("closureId");
    if (id || revision) { if (id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) && (!revision || /^[1-9]\d*$/.test(revision) && Number.isSafeInteger(Number(revision)))) void load(Number(id), false, revision ? Number(revision) : undefined); else markRead("error", "Select a valid reconciliation period and closure revision.", null); }
    const focus = () => { const target = read.current.target; if (document.visibilityState === "visible" && read.current.status === "ready" && target?.kind === "period") void load(target.id, true, target.closureId); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { alive.current = false; invalidate(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [enabled, invalidate, load, markRead]);
  const selectPeriod = useCallback(async (id: number, closureId?: number) => { await saveDate(); if (dirty.current || operation.current) throw new Error("Save the posting date before switching periods."); await load(id, false, closureId); }, [load, saveDate]);
  const prepareLifecycle = useCallback(async () => { if (read.current.status !== "ready") throw new Error("Load the current Posting data first."); if (!await saveDate() || dirty.current || operation.current || pendingRequest) throw new Error("Resolve the pending posting operation or posting date first."); return current.current?.period || null; }, [pendingRequest, saveDate]);
  const exportFile = useCallback(async (format: "xlsx" | "pdf") => {
    if (operation.current || pending.current || pendingRequest || read.current.status !== "ready") return;
    if (current.current?.period.status !== "CLOSED" && (input.current.failure || postingDateError(input.current.value, current.current?.postingDate || { min: null, max: null }, input.current.badInput))) return;
    operation.current = true; setExporting(format); setError(""); setMessage("");
    try { if (!await saveDate() || read.current.status !== "ready") return; const model = current.current; if (!model) return; invalidate(); await downloadPostingExport(model.period, format); const message = `${format === "xlsx" ? "Excel" : "PDF"} Posting export generated.`; setMessage(message); toast.success(`Posting ${format === "xlsx" ? "Excel" : "PDF"} generated`, { id: "bank-rec-posting", description: message }); }
    catch (e) { const message = e instanceof Error ? e.message : "Unable to export Posting."; setError(message); toast.error("Posting export failed", { id: "bank-rec-posting-error", description: message, duration: 6000 }); }
    finally { operation.current = false; setExporting(null); }
  }, [invalidate, pendingRequest, saveDate]);
  const retainedData = readState.target?.kind === "period" && data?.period.id === readState.target.id && data?.period.lifecycle?.closureId === readState.target.closureId ? data : null;
  const validation = data ? postingDateError(dateInput.value, data.postingDate, dateInput.badInput) : "";
  const dateError = validation ? !dirty.current && !data?.postingDate.valid && data?.postingDate.message || validation : conflict.current ? "The period changed. Refresh data before saving the posting date." : dateInput.failure?.message || "";
  const dateBlocked = data?.period.status !== "CLOSED" && Boolean(validation || dateInput.failure || conflict.current);
  return { data: readState.status === "ready" ? data : null, retainedData, bank, date: dateInput.value, dateError, dateInvalid: Boolean(validation || dateInput.failure?.invalid), dateBlocked, canRetryDate: Boolean(dateInput.failure?.retryable) && !validation && !conflict.current, loading: readState.status === "loading", loadStatus: readState.status, loadError: readState.error, canRefresh: readState.target !== null, retry, saving, operating, pendingRequest, exporting, exportFile, error, message, changeDate, saveDate, selectBank, selectPeriod, prepareLifecycle, refresh, run, recover };
}
