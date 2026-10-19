"use client";

import * as React from "react";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AjeSearchableSelect } from "./AjeSearchableSelect";
import { money, formatDate, formatDateTime, todayManila } from "./formatters";
import { ajeAttachmentUrl, ajeEntryPrintUrl, adjustingJournalEntriesApi as api } from "../services/adjusting-journal-entries.api";
import type { AdjustingEntry, AdjustingEntryPayload, AjeAccess, AjeAccount, AjeAction, AjeAttachment, AjeReversalPreview, DepartmentLookup, DivisionLookup } from "../types";

type Line = { key: string; coaId: string; departmentId: string; description: string; debit: string; credit: string; originalDetailId: number | null };
type Form = { reference: string; transactionDate: string; description: string; divisionId: string; sourceJeNo: string; entryKind: "ADJUSTMENT" | "REVERSAL"; originalEntryId: number | null; reversalMode: "FULL" | "PARTIAL" | null; details: Line[] };
type Props = { initialEntry: AdjustingEntry | null; seed?: AdjustingEntryPayload | null; readOnly: boolean; hideTitle?: boolean; access: AjeAccess; accounts: AjeAccount[]; departments: DepartmentLookup[]; divisions: DivisionLookup[]; onSaved: () => void; onAction: (entry: AdjustingEntry, action: AjeAction) => void };

function line(data?: { coaId?: number | null; departmentId?: number | null; description?: string | null; debit?: number; credit?: number; originalDetailId?: number | null }): Line {
  return { key: crypto.randomUUID(), coaId: data?.coaId ? String(data.coaId) : "", departmentId: data?.departmentId ? String(data.departmentId) : "", description: data?.description || "", debit: data?.debit ? String(data.debit) : "", credit: data?.credit ? String(data.credit) : "", originalDetailId: data?.originalDetailId ?? null };
}
function cents(value: string) {
  if (!value.trim()) return 0;
  if (!/^-?\d+(\.\d{0,2})?$/.test(value)) return NaN;
  return Math.round(Number(value) * 100);
}
function initialForm(entry: AdjustingEntry | null, seed?: AdjustingEntryPayload | null): Form {
  const data = entry || seed;
  return { reference: data?.reference || "", transactionDate: data?.transactionDate || todayManila(), description: data?.description || "", divisionId: data?.divisionId ? String(data.divisionId) : "", sourceJeNo: data?.sourceJeNo || "", entryKind: data?.entryKind || "ADJUSTMENT", originalEntryId: data?.originalEntryId ?? null, reversalMode: data?.reversalMode ?? null, details: data?.details.length ? data.details.map(line) : [line(), line()] };
}

export function AjeEntryEditor({ initialEntry, seed, readOnly, hideTitle = false, access, accounts, departments, divisions, onSaved, onAction }: Props) {
  const [entry, setEntry] = React.useState(initialEntry);
  const [form, setForm] = React.useState(() => initialForm(initialEntry, seed));
  const [requestKey] = React.useState(() => crypto.randomUUID());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [sourceSearch, setSourceSearch] = React.useState("");
  const [sources, setSources] = React.useState<Array<{ jeNo: string; transactionRef: string | null; description: string | null }>>([]);
  const [sourceBusy, setSourceBusy] = React.useState(false);
  const [attachments, setAttachments] = React.useState<AjeAttachment[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [preview, setPreview] = React.useState<AjeReversalPreview | null>(null);
  const inFlight = React.useRef(false);
  const frozen = readOnly || Boolean(entry && (entry.status !== "Draft" || entry.entryOrigin !== "MANUAL"));
  const reversal = form.entryKind === "REVERSAL";
  const isFull = reversal && form.reversalMode === "FULL";
  const totals = form.details.reduce((sum, row) => ({ debit: sum.debit + (cents(row.debit) || 0), credit: sum.credit + (cents(row.credit) || 0) }), { debit: 0, credit: 0 });
  const balanced = totals.debit > 0 && totals.debit === totals.credit;
  const accountById = React.useMemo(() => new Map(accounts.map(a => [String(a.id), a])), [accounts]);
  const accountOptions = React.useMemo(() => {
    const all = accounts.map(a => ({ value: String(a.id), label: a.label }));
    for (const d of initialEntry?.details || []) if (d.coaId && !accounts.some(a => a.id === d.coaId)) all.push({ value: String(d.coaId), label: `${d.accountNumber} - ${d.accountTitle} (unavailable)` });
    return all;
  }, [accounts, initialEntry]);
  const departmentOptions = [{ value: "none", label: "None" }, ...departments.filter(d => !form.divisionId || !d.parentDivision || String(d.parentDivision) === form.divisionId).map(d => ({ value: String(d.id), label: d.name }))];

  React.useEffect(() => {
    if (!entry?.id) return;
    let active = true;
    api.attachments(entry.id).then(data => { if (active) setAttachments(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load supporting documents"); });
    return () => { active = false; };
  }, [entry?.id]);
  React.useEffect(() => {
    if (!form.originalEntryId) return;
    let active = true;
    api.reversalPreview(form.originalEntryId).then(data => { if (active) setPreview(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load reversal limits"); });
    return () => { active = false; };
  }, [form.originalEntryId]);

  function updateLine(key: string, field: keyof Line, value: string) {
    setForm(current => ({ ...current, details: current.details.map(row => {
      if (row.key !== key) return row;
      const updated = { ...row, [field]: value };
      if (field === "debit" && cents(value) > 0) updated.credit = "";
      if (field === "credit" && cents(value) > 0) updated.debit = "";
      return updated;
    }) }));
  }
  function lineError(row: Line) {
    const debit = cents(row.debit), credit = cents(row.credit);
    if (!row.coaId) return "Select an account.";
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) return "Use non-negative amounts with up to two decimal places.";
    if ((debit > 0) === (credit > 0)) return "Enter one positive debit or credit.";
    if (accountById.get(row.coaId)?.departmentRequired && !row.departmentId) return "Department is required for this account.";
    const source = preview?.lines.find(d => d.originalDetailId === row.originalDetailId);
    if (source && debit + credit > Math.round(source.remainingAmount * 100)) return "Amount exceeds the remaining reversal balance.";
    return "";
  }
  async function searchSources() {
    setSourceBusy(true); setError("");
    try { setSources(await api.searchSourceJournalEntries(sourceSearch)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to search original journals"); }
    finally { setSourceBusy(false); }
  }
  async function selectSource(jeNo: string) {
    setSourceBusy(true); setError("");
    try {
      const source = await api.sourceJournalEntry(jeNo);
      setForm(current => ({ ...current, sourceJeNo: source.jeNo, reference: source.transactionRef || source.jeNo,
        description: `Adjustment for ${source.jeNo}: ${source.description || ""}`,
        details: source.details.map(d => line({ ...d, departmentId: d.departmentId ?? null })) }));
      setSources([]); setSourceSearch("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load original journal"); }
    finally { setSourceBusy(false); }
  }
  async function save(submit: boolean) {
    if (inFlight.current) return;
    setError("");
    if (!form.reference.trim() || !form.transactionDate || !form.description.trim()) { setError("Complete the reference, accounting date, and description."); return; }
    if (form.details.length === 0) { setError("Add at least one journal line."); return; }
    for (const [index, row] of form.details.entries()) {
      // Missing departments may be completed later in a draft.
      const detailError = lineError(row);
      if (detailError && (submit || detailError !== "Department is required for this account.")) { setError(`Line ${index + 1}: ${detailError}`); return; }
    }
    if (submit && (form.details.length < 2 || !balanced)) { setError("At least two journal lines and equal debit/credit totals are required to submit."); return; }
    inFlight.current = true; setBusy(true);
    try {
      const payload: AdjustingEntryPayload = { reference: form.reference.trim(), transactionDate: form.transactionDate, description: form.description.trim(), divisionId: form.divisionId ? Number(form.divisionId) : null, departmentId: null,
        sourceJeNo: form.sourceJeNo || null, entryKind: form.entryKind, originalEntryId: form.originalEntryId, reversalMode: form.reversalMode,
        creationRequestKey: requestKey, ...(entry ? { version: entry.version } : {}),
        details: form.details.map(row => ({ coaId: Number(row.coaId), departmentId: row.departmentId ? Number(row.departmentId) : null, description: row.description, debit: cents(row.debit) / 100, credit: cents(row.credit) / 100, originalDetailId: row.originalDetailId })) };
      const saved = entry ? await api.update(entry.id, payload) : await api.create(payload);
      setEntry(saved);
      let pending = [...selectedFiles];
      try {
        for (const file of selectedFiles) {
          await api.uploadAttachment(saved.id, file);
          pending = pending.slice(1); setSelectedFiles(pending);
        }
      } finally { setAttachments(await api.attachments(saved.id)); onSaved(); }
      toast.success("Draft saved");
      if (submit) onAction(saved, "submit");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save this draft"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function removeAttachment(file: AjeAttachment) {
    if (!entry || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await api.removeAttachment(entry.id, file.id); setAttachments(await api.attachments(entry.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to remove supporting document"); }
    finally { inFlight.current = false; setBusy(false); }
  }

  function selectFiles(files: File[]) {
    const invalid = files.find(file => file.size <= 0 || file.size > 10 * 1024 * 1024 || !/\.(png|jpe?g|webp|gif|bmp|tiff?|pdf|docx?|xlsx?|csv|txt)$/i.test(file.name));
    if (invalid) { setError(`${invalid.name}: choose an accepted file up to 10 MB.`); return; }
    setSelectedFiles(current => [...current, ...files]); setError("");
  }

  function changeReversalMode(mode: "FULL" | "PARTIAL") {
    if (mode === "FULL" && preview?.canFullReverse) {
      setForm(current => ({ ...current, reversalMode: mode, details: preview.lines.map(d => line({
        coaId: d.coaId, departmentId: d.departmentId, description: d.description,
        originalDetailId: d.originalDetailId, debit: d.originalCredit, credit: d.originalDebit,
      })) }));
    } else setForm(current => ({ ...current, reversalMode: mode }));
  }

  return <div className="space-y-5 rounded-lg border bg-background p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>{(!hideTitle || entry?.jeNo || reversal) && <h2 className="text-lg font-semibold">{entry?.jeNo || (reversal ? "New Reversal" : "New Adjusting Entry")}</h2>}<p className="text-sm text-muted-foreground">{entry?.status || "Draft"}{entry?.entryOrigin === "SYSTEM" ? " · Managed by its originating module" : ""}</p></div>
      <div className={balanced ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-destructive"}>{balanced ? "Balanced" : "Unbalanced"} · Difference {money((totals.debit - totals.credit) / 100)}</div>
    </div>
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {entry && <a className="inline-block text-sm text-primary underline" href={ajeEntryPrintUrl(entry.id)} target="_blank" rel="noreferrer">Print journal</a>}
    {entry?.lastPostingError && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Posting failed: {entry.lastPostingError}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-1.5"><Label htmlFor="aje-reference">Reference *</Label><Input id="aje-reference" maxLength={255} value={form.reference} disabled={frozen || busy} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="aje-date">{reversal ? "Reversal date" : "Period end date"} *</Label><Input id="aje-date" type="date" value={form.transactionDate} disabled={frozen || busy} onChange={e => setForm({ ...form, transactionDate: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Created By</Label><div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{entry?.creatorName || access.userName}</div></div>
      <div className="space-y-1.5"><Label>Division</Label><AjeSearchableSelect value={form.divisionId || "none"} onValueChange={value => setForm({ ...form, divisionId: value === "none" ? "" : value })} options={[{ value: "none", label: "None" }, ...divisions.map(d => ({ value: String(d.id), label: d.name }))]} disabled={frozen || busy || reversal} placeholder="None" /></div>
      <div className="space-y-1.5 md:col-span-2"><Label>Original journal (optional)</Label>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm">{form.sourceJeNo || "None"}</span>{!frozen && !reversal && <Button type="button" variant="outline" size="sm" disabled={busy || sourceBusy} onClick={() => setForm({ ...form, sourceJeNo: "" })}>None</Button>}</div>
        {!frozen && !reversal && <div className="flex gap-2"><Input aria-label="Search original journal" value={sourceSearch} onChange={e => setSourceSearch(e.target.value)} placeholder="Journal number or reference" disabled={busy || sourceBusy} /><Button type="button" variant="outline" disabled={busy || sourceBusy || sourceSearch.trim().length < 2} onClick={() => void searchSources()}>{sourceBusy ? <Loader2 className="size-4 animate-spin" /> : "Search"}</Button></div>}
        {sources.length > 0 && <div className="max-h-44 overflow-auto rounded-md border">{sources.map(s => <button type="button" key={s.jeNo} className="block w-full border-b p-2 text-left text-sm hover:bg-muted" disabled={sourceBusy} onClick={() => void selectSource(s.jeNo)}>{s.jeNo} · {s.transactionRef} <span className="text-muted-foreground">{s.description}</span></button>)}</div>}
      </div>
      <div className="space-y-1.5 md:col-span-3"><Label htmlFor="aje-narration">Description / Narration *</Label><Textarea id="aje-narration" value={form.description} disabled={frozen || busy} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
    </div>
    {reversal && <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm"><p>Reversal of {form.sourceJeNo}. Accounts and departments remain linked to the original lines.</p>{!frozen && <label className="flex items-center gap-2">Reversal mode <select className="rounded border bg-background px-2 py-1" value={form.reversalMode || "PARTIAL"} disabled={busy} onChange={e => changeReversalMode(e.target.value as "FULL" | "PARTIAL")}><option value="FULL" disabled={preview ? !preview.canFullReverse : true}>Full</option><option value="PARTIAL">Partial / remaining</option></select></label>}</div>}
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted/30"><tr><th className="p-2 text-left">Account</th><th className="p-2 text-left">Department</th><th className="p-2 text-left">Line description</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th /></tr></thead><tbody>
        {form.details.map((row, index) => { const issue = lineError(row); const remaining = preview?.lines.find(d => d.originalDetailId === row.originalDetailId)?.remainingAmount;
          return <tr key={row.key} className="border-t"><td className="min-w-64 p-2 align-top"><AjeSearchableSelect options={accountOptions} value={row.coaId} onValueChange={v => updateLine(row.key, "coaId", v)} disabled={frozen || busy || reversal} placeholder="Select account" />{issue && !frozen && <p className="mt-1 text-xs text-destructive">Line {index + 1}: {issue}</p>}{remaining !== undefined && <p className="mt-1 text-xs text-muted-foreground">Remaining: {money(remaining)}</p>}</td>
            <td className="min-w-48 p-2 align-top"><AjeSearchableSelect options={departmentOptions} value={row.departmentId || "none"} onValueChange={v => updateLine(row.key, "departmentId", v === "none" ? "" : v)} disabled={frozen || busy || reversal} placeholder="None" />{accountById.get(row.coaId)?.departmentRequired && <span className="text-xs text-muted-foreground">Required</span>}</td>
            <td className="min-w-44 p-2 align-top"><Input aria-label={`Line ${index + 1} description`} value={row.description} maxLength={1000} disabled={frozen || busy} onChange={e => updateLine(row.key, "description", e.target.value)} /></td>
            <td className="w-36 p-2 align-top"><Input aria-label={`Line ${index + 1} debit`} className={`text-right font-mono ${issue && !frozen ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.debit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "debit", e.target.value)} /></td>
            <td className="w-36 p-2 align-top"><Input aria-label={`Line ${index + 1} credit`} className={`text-right font-mono ${issue && !frozen ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.credit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "credit", e.target.value)} /></td>
            <td className="p-2 align-top">{!frozen && !isFull && <Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${index + 1}`} disabled={busy} onClick={() => setForm({ ...form, details: form.details.filter(d => d.key !== row.key) })}><Trash2 className="size-4" /></Button>}</td></tr>;
        })}
      </tbody><tfoot className="border-t bg-muted/20"><tr><td className="p-3 font-semibold" colSpan={3}>Totals</td><td className="p-3 text-right font-mono">{money(totals.debit / 100)}</td><td className="p-3 text-right font-mono">{money(totals.credit / 100)}</td><td /></tr></tfoot></table>
    </div>
    {!frozen && !reversal && <Button type="button" variant="outline" disabled={busy} onClick={() => setForm({ ...form, details: [...form.details, line()] })}><Plus className="mr-2 size-4" />Add line</Button>}
    <div className="space-y-3 rounded-md border p-3">
      <div><h3 className="font-medium">Supporting documents <span className="text-sm font-normal text-muted-foreground">(optional)</span></h3><p className="text-xs text-muted-foreground">Images, PDF, Word, Excel, CSV, or text · up to 10 MB per file. Files become read-only after submission.</p></div>
      {!frozen && <Input aria-label="Supporting documents" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" disabled={busy} onChange={e => { selectFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />}
      {attachments.map(file => <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{file.state === "READY" ? <a className="text-primary underline" href={ajeAttachmentUrl(file.entryId, file.id)}>{file.filename}</a> : `${file.filename} · Upload incomplete`} <span className="text-xs text-muted-foreground">by {file.uploadedByName}</span></span>{!frozen && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void removeAttachment(file)}>Remove</Button>}</div>)}
      {selectedFiles.map((file, index) => <div key={index} className="flex items-center justify-between text-sm"><span>{file.name} · Pending save</span><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setSelectedFiles(current => current.filter((_, i) => i !== index))}>Remove</Button></div>)}
    </div>
    {entry && <div className="grid gap-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-2"><p>Created: {entry.creatorName} · {formatDateTime(entry.dateCreated)}</p><p>Submitted: {entry.submittedByName || "—"} · {formatDateTime(entry.submittedAt)}</p><p>Approved: {entry.approvedByName || "—"} · {formatDateTime(entry.approvedAt)}</p><p>Posted: {entry.postedByName || "—"} · {formatDateTime(entry.datePosted)}</p><p>Accounting date: {formatDate(entry.transactionDate)}</p></div>}
    {!frozen && <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy || sourceBusy} onClick={() => void save(false)}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save Draft</Button><Button type="button" disabled={busy || sourceBusy} onClick={() => void save(true)}><Send className="mr-2 size-4" />Save & Submit</Button></div>}
  </div>;
}

