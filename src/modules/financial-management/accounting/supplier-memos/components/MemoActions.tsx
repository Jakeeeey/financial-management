"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, History, MoreHorizontal, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { memoDateTime, memoMoney, type MemoDetail, type MemoHistoryEvent, type MemoMutationResult, type SupplierMemo, type SupplierMemoFilters } from "../types";
import { SupplierMemoPrintDialog } from "./SupplierMemoPrintDialog";

type Mode = "view" | "edit" | "cancel" | "history";
type Supplier = { id: number; supplier_name: string };
type Account = { coa_id: number; gl_code: string | null; account_title: string | null };
type Values = { supplier_id: string; chart_of_account: string; date: string; amount: string; reason: string };
const fields = { supplier_id: "Supplier", chart_of_account: "GL account", date: "Memo date", amount: "Amount", reason: "Memo reason", status: "Status" };

async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Unable to load this memo.");
  return payload;
}

export function MemoReportButton({ api, filters, disabled }: { api: string; filters: SupplierMemoFilters; disabled: boolean }) {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return <Button variant="outline" size="sm" asChild disabled={disabled}>
    <a href={api + "/report?" + query} target="_blank" rel="noopener noreferrer" aria-disabled={disabled}
      onClick={event => { if (disabled) event.preventDefault(); }}><Printer className="h-4 w-4" /> Print summary</a>
  </Button>;
}

export function MemoRowActions({ memo, api, suppliers, accounts, onChanged }: {
  memo: SupplierMemo; api: string; suppliers: Supplier[]; accounts: Account[]; onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  return <div className="flex items-center gap-1">
    <Button variant="outline" size="sm" onClick={() => setMode("view")}>View</Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={"Actions for " + memo.memo_number}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!memo.eligibility?.canEdit} onSelect={() => setMode("edit")}><Pencil /> Edit</DropdownMenuItem>
        <DropdownMenuItem disabled={!memo.eligibility?.canCancel} onSelect={() => setMode("cancel")} className="text-destructive"><Ban /> Cancel memo</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMode("history")}><History /> History</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setPrintOpen(true)}><Printer /> Print</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {mode && <MemoDialog key={mode} memo={memo} api={api} mode={mode} suppliers={suppliers} accounts={accounts}
      onMode={setMode} onClose={() => setMode(null)} onChanged={onChanged} onPrint={() => setPrintOpen(true)} />}
    {printOpen && <SupplierMemoPrintDialog memo={memo} api={api} onClose={() => setPrintOpen(false)} />}
  </div>;
}

function MemoDialog({ memo, api, mode, suppliers, accounts, onMode, onClose, onChanged, onPrint }: {
  memo: SupplierMemo; api: string; mode: Mode; suppliers: Supplier[]; accounts: Account[];
  onMode: (mode: Mode) => void; onClose: () => void; onChanged: () => void; onPrint: () => void;
}) {
  const [detail, setDetail] = useState<MemoDetail | null>(null);
  const [events, setEvents] = useState<MemoHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [values, setValues] = useState<Values>({ supplier_id: "", chart_of_account: "", date: "", amount: "", reason: "" });
  const requestId = useRef("");
  const submitting = useRef(false);
  const editable = mode === "edit", cancelling = mode === "cancel";
  const endpoint = api + "/" + memo.id;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (mode === "history") setEvents((await read<{ data: MemoHistoryEvent[] }>(endpoint + "/history", { signal: controller.signal })).data);
        else {
          const result = await read<MemoDetail>(endpoint, { signal: controller.signal });
          setDetail(result);
          setValues({ supplier_id: String(result.memo.supplier_id), chart_of_account: String(result.memo.chart_of_account),
            date: result.memo.date.slice(0, 10), amount: String(result.memo.amount), reason: result.memo.reason || "" });
        }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load memo."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, mode]);

  async function save() {
    if (!detail || submitting.current || uncertain) return;
    if (!changeReason.trim()) { setError("Enter the reason for this " + (cancelling ? "cancellation." : "edit.")); return; }
    submitting.current = true;
    setSaving(true); setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch(endpoint + (cancelling ? "/cancel" : ""), {
        method: cancelling ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: detail.revisionToken, requestId: requestId.current, changeReason, values }),
      });
      const result: MemoMutationResult = await response.json();
      if (!response.ok) {
        setError(result.message || "The change could not be saved.");
        if (response.status === 409 || response.status >= 500) setUncertain(true);
        return;
      }
      if (result.state !== "saved") {
        setUncertain(true); setError(result.message + " Request: " + result.requestId);
        onChanged(); return;
      }
      toast.success(result.message); onChanged(); onClose();
    } catch {
      setUncertain(true);
      setError("The request outcome could not be confirmed. Review History before trying again. Request: " + requestId.current);
    } finally { submitting.current = false; setSaving(false); }
  }

  const current = detail?.memo || memo;
  const eligibility = detail?.eligibility || memo.eligibility;
  const supplierOptions = suppliers.map(row => ({ value: String(row.id), label: row.supplier_name }));
  if (!supplierOptions.some(option => option.value === String(current.supplier_id))) supplierOptions.push({ value: String(current.supplier_id), label: current.supplierName || "Supplier #" + current.supplier_id });
  const accountOptions = accounts.map(row => ({ value: String(row.coa_id), label: [row.gl_code, row.account_title].filter(Boolean).join(" - ") }));
  if (!accountOptions.some(option => option.value === String(current.chart_of_account))) accountOptions.push({ value: String(current.chart_of_account), label: current.accountName || "Account #" + current.chart_of_account });
  const fieldValue = (key: string, value: unknown): string => {
    if (value == null || value === "") return "None";
    if (key === "amount") return memoMoney(String(value));
    if (key === "supplier_id") return supplierOptions.find(row => row.value === String(value))?.label || "Supplier #" + value;
    if (key === "chart_of_account") return accountOptions.find(row => row.value === String(value))?.label || "Account #" + value;
    return String(value);
  };

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden" showCloseButton={!saving}
      onInteractOutside={event => { if (editable || cancelling || saving) event.preventDefault(); }}>
      <DialogHeader className="shrink-0">
        <DialogTitle>{mode === "history" ? "Memo history" : cancelling ? "Cancel memo?" : editable ? "Edit memo" : "Memo details"} · {memo.memo_number}</DialogTitle>
        <DialogDescription>{cancelling ? "Cancellation removes the unused balance from selection. The memo and audit history will be retained."
          : editable ? "Only Available, unapplied memos may be edited. The memo number, type and creator stay unchanged."
          : mode === "history" ? "Recorded changes, reasons and transaction outcomes. Older revisions may not identify the application user."
          : "Review the memo and its linked disbursements without leaving this module."}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto space-y-4 pr-1">
        {loading ? <p role="status">Loading memo…</p> : mode === "history" ? <>
          {!events.length && !error && <p className="text-sm text-muted-foreground">No recorded history is available.</p>}
          {events.map(event => <article key={event.id} className="rounded-md border p-3 space-y-2 text-sm">
            <p className="font-semibold">{event.action} <span className="font-normal text-muted-foreground">· {event.outcome === "needs-review" ? "Outcome needs review" : event.outcome === "legacy" ? "Legacy revision" : event.outcome}</span></p>
            <p className="text-xs text-muted-foreground">{event.actorName} · {memoDateTime(event.occurredAt)}</p>
            {event.reason && <p className="break-words">Change reason: {event.reason}</p>}
            {(event.outcome === "failed" || event.outcome === "needs-review") && <p className="text-xs text-amber-700 dark:text-amber-300">Requested changes below are not confirmed as saved.</p>}
            {Object.entries(fields).filter(([key]) => String(event.before[key] ?? "") !== String(event.after[key] ?? "")).map(([key, label]) =>
              <p key={key} className="break-words text-xs"><strong>{label}:</strong> {fieldValue(key, event.before[key])} → {fieldValue(key, event.after[key])}</p>)}
            {event.requestId && <p className="break-all text-xs text-muted-foreground">Request: {event.requestId}</p>}
          </article>)}
        </> : detail && <>
          <div className="rounded-md border p-3 grid gap-2 sm:grid-cols-2 text-sm">
            <p><strong>Supplier:</strong> {current.supplierName}</p><p><strong>Status:</strong> {current.status}</p>
            <p><strong>Original:</strong> {memoMoney(current.amount)}</p><p><strong>Remaining:</strong> {memoMoney(eligibility?.remainingAmount)}</p>
            <p><strong>Posted usage:</strong> {memoMoney(eligibility?.appliedAmount)}</p><p><strong>Reserved:</strong> {memoMoney(eligibility?.reservedAmount)}</p>
          </div>
          {eligibility?.blockedReason && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{eligibility.blockedReason}</p>}
          {editable ? <fieldset disabled={saving || uncertain || !eligibility?.canEdit} className="grid sm:grid-cols-2 gap-4">
            <div className="min-w-0 space-y-1" role="group" aria-labelledby="memo-edit-supplier"><Label id="memo-edit-supplier">Supplier *</Label>
              <SearchableSelect options={supplierOptions} value={values.supplier_id} onValueChange={value => setValues(previous => ({ ...previous, supplier_id: value }))} placeholder="Select supplier" /></div>
            <div className="min-w-0 space-y-1" role="group" aria-labelledby="memo-edit-account"><Label id="memo-edit-account">GL account *</Label>
              <SearchableSelect options={accountOptions} value={values.chart_of_account} onValueChange={value => setValues(previous => ({ ...previous, chart_of_account: value }))} placeholder="Select account" /></div>
            <div className="space-y-1"><Label htmlFor="memo-edit-date">Memo date *</Label><Input id="memo-edit-date" type="date" value={values.date} onChange={event => setValues(previous => ({ ...previous, date: event.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="memo-edit-amount">Amount (₱) *</Label><Input id="memo-edit-amount" type="number" min="0.01" max="99999999.99" step="0.01" value={values.amount} onChange={event => setValues(previous => ({ ...previous, amount: event.target.value }))} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="memo-edit-reason">Memo reason</Label><Textarea id="memo-edit-reason" maxLength={255} value={values.reason} onChange={event => setValues(previous => ({ ...previous, reason: event.target.value }))} /></div>
          </fieldset> : !cancelling && <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Memo date</dt><dd>{current.date.slice(0, 10)}</dd></div>
            <div><dt className="text-muted-foreground">GL account</dt><dd>{current.accountCode} {current.accountName}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Memo reason</dt><dd className="break-words">{current.reason || "None"}</dd></div>
            <div><dt className="text-muted-foreground">Created by</dt><dd>{current.creatorName}</dd></div>
            <div><dt className="text-muted-foreground">Created at</dt><dd>{memoDateTime(current.created_at)}</dd></div>
          </dl>}
          {!!eligibility?.applications.length && <div className="text-sm"><h3 className="font-semibold mb-2">Linked disbursements</h3>
            {eligibility.applications.map(row => <p key={row.id}>{row.documentNo} · {row.status} · {memoMoney(row.amount)}</p>)}</div>}
          {(editable || cancelling) && <div className="space-y-1"><Label htmlFor="memo-change-reason">{cancelling ? "Cancellation reason" : "Reason for editing"} *</Label>
            <Textarea id="memo-change-reason" value={changeReason} maxLength={1000} disabled={saving || uncertain}
              onChange={event => setChangeReason(event.target.value)} placeholder="Explain why this change is needed for the audit trail." /></div>}
        </>}
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive break-words">{error}</p>}
      </div>
      <DialogFooter className="shrink-0 flex-wrap">
        <Button variant="outline" disabled={saving} onClick={onClose}>Close</Button>
        {mode === "history" && <Button variant="outline" onClick={() => onMode("view")}>Memo details</Button>}
        {mode !== "history" && <Button variant="outline" disabled={saving} onClick={() => onMode("history")}>History</Button>}
        {mode === "view" && <Button variant="outline" disabled={loading || !detail} onClick={onPrint}>Print</Button>}
        {mode === "view" && detail?.eligibility.canEdit && <Button onClick={() => onMode("edit")}>Edit memo</Button>}
        {(editable || cancelling) && <Button variant={cancelling ? "destructive" : "default"} disabled={loading || saving || uncertain || !eligibility?.canEdit || !changeReason.trim()} onClick={() => void save()}>
          {saving ? "Saving…" : cancelling ? "Confirm cancellation" : "Save changes"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
