"use client";

import * as React from "react";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AjeSearchableSelect } from "./AjeSearchableSelect";
import { money, formatDate, formatDateTime, todayManila } from "./formatters";
import { ajeAttachmentPreviewUrl, ajeAttachmentUrl, ajeEntryPrintUrl, adjustingJournalEntriesApi as api } from "../services/adjusting-journal-entries.api";
import { AjeAttachmentPreview, isPreviewableAjeImage } from "./AjeAttachmentPreview";
import type { AdjustingEntry, AdjustingEntryPayload, AdjustingEntrySourceJournal, AdjustingEntrySourceJournalSummary, AjeAccess, AjeAccount, AjeAction, AjeAttachment, AjeReversalPreview, DepartmentLookup, DivisionLookup } from "../types";

type Line = { key: string; coaId: string; departmentId: string; description: string; debit: string; credit: string; originalDetailId: number | null };
type Form = { reference: string; transactionDate: string; description: string; divisionId: string; sourceJeNo: string; entryKind: "ADJUSTMENT" | "REVERSAL"; originalEntryId: number | null; reversalMode: "FULL" | "PARTIAL" | null; details: Line[] };
type SubmitBlocker = { message: string; selector: string };
type Props = { initialEntry: AdjustingEntry | null; seed?: AdjustingEntryPayload | null; readOnly: boolean; hideTitle?: boolean; dirtyRef: React.MutableRefObject<boolean>; access: AjeAccess; accounts: AjeAccount[]; departments: DepartmentLookup[]; divisions: DivisionLookup[]; onSaved: () => void; onAction: (entry: AdjustingEntry, action: AjeAction) => void };

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

function serializeForm(value: Form) {
  return JSON.stringify({ ...value, details: value.details.map(({ coaId, departmentId, description, debit, credit, originalDetailId }) => ({ coaId, departmentId, description, debit, credit, originalDetailId })) });
}

function hasSourceReplacementContent(value: Form) {
  return Boolean(value.reference.trim() || value.description.trim() || value.sourceJeNo || value.divisionId || value.details.some(row => row.coaId || row.departmentId || row.description.trim() || row.debit.trim() || row.credit.trim()));
}

function focusBlocker(selector: string) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const target = candidates.find(element => element.getClientRects().length > 0) || candidates[0];
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  target?.focus({ preventScroll: true });
}

export function AjeEntryEditor({ initialEntry, seed, readOnly, hideTitle = false, dirtyRef, access, accounts, departments, divisions, onSaved, onAction }: Props) {
  const [entry, setEntry] = React.useState(initialEntry);
  const [form, setForm] = React.useState(() => initialForm(initialEntry, seed));
  const [savedSnapshot, setSavedSnapshot] = React.useState(() => serializeForm(initialForm(initialEntry, initialEntry ? undefined : null)));
  const [requestKey] = React.useState(() => crypto.randomUUID());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [checklistOpen, setChecklistOpen] = React.useState(false);
  const [sourceSearch, setSourceSearch] = React.useState("");
  const [sources, setSources] = React.useState<AdjustingEntrySourceJournalSummary[]>([]);
  const [sourceSearched, setSourceSearched] = React.useState(false);
  const [pendingSource, setPendingSource] = React.useState<AdjustingEntrySourceJournal | null>(null);
  const [selectedSource, setSelectedSource] = React.useState<AdjustingEntrySourceJournal | null>(null);
  const [sourceLoadError, setSourceLoadError] = React.useState("");
  const [sourceBusy, setSourceBusy] = React.useState(false);
  const [attachments, setAttachments] = React.useState<AjeAttachment[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const selectedFilePreviewUrls = React.useRef(new Map<File, string>());
  const [preview, setPreview] = React.useState<AjeReversalPreview | null>(null);
  const inFlight = React.useRef(false);
  const frozen = readOnly || Boolean(entry && (entry.status !== "Draft" || entry.entryOrigin !== "MANUAL"));
  const reversal = form.entryKind === "REVERSAL";
  const isFull = reversal && form.reversalMode === "FULL";
  const hasUnsavedChanges = !frozen && (serializeForm(form) !== savedSnapshot || selectedFiles.length > 0);
  const totals = form.details.reduce((sum, row) => ({ debit: sum.debit + (cents(row.debit) || 0), credit: sum.credit + (cents(row.credit) || 0) }), { debit: 0, credit: 0 });
  const balanced = totals.debit > 0 && totals.debit === totals.credit;
  const hasAmounts = totals.debit > 0 || totals.credit > 0;
  const accountById = React.useMemo(() => new Map(accounts.map(a => [String(a.id), a])), [accounts]);
  const accountOptions = React.useMemo(() => {
    const all = accounts.map(a => ({ value: String(a.id), label: a.label }));
    for (const d of initialEntry?.details || []) if (d.coaId && !accounts.some(a => a.id === d.coaId)) all.push({ value: String(d.coaId), label: `${d.accountNumber} - ${d.accountTitle} (unavailable)` });
    return all;
  }, [accounts, initialEntry]);
  const departmentOptions = [{ value: "none", label: "None" }, ...departments.filter(d => !form.divisionId || !d.parentDivision || String(d.parentDivision) === form.divisionId).map(d => ({ value: String(d.id), label: d.name }))];
  const pendingSourceTotals = pendingSource?.details.reduce((sum, row) => ({ debit: sum.debit + row.debit, credit: sum.credit + row.credit }), { debit: 0, credit: 0 });

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

  const submitBlockers: SubmitBlocker[] = (() => {
    const blockers: SubmitBlocker[] = [];
    if (!form.reference.trim()) blockers.push({ message: "Enter a reference.", selector: "#aje-reference" });
    if (!form.transactionDate) blockers.push({ message: "Choose an accounting date.", selector: "#aje-date" });
    if (!form.description.trim()) blockers.push({ message: "Enter a description.", selector: "#aje-narration" });
    if (form.details.length === 0) blockers.push({ message: "Add at least two journal lines.", selector: "#aje-lines-heading" });
    else if (form.details.length < 2) blockers.push({ message: "At least two journal lines are required.", selector: "#aje-lines-heading" });
    for (const [index, row] of form.details.entries()) {
      const issue = lineError(row);
      if (issue) {
        const control = issue === "Select an account." ? "account" : issue === "Department is required for this account." ? "department" : row.credit.trim() ? "credit" : "debit";
        blockers.push({ message: `Line ${index + 1}: ${issue}`, selector: `[aria-label="Line ${index + 1} ${control}"]` });
      }
    }
    if (!balanced) blockers.push({ message: "Debit and credit totals must be equal and greater than zero.", selector: "#aje-balance-indicator" });
    return blockers;
  })();

  React.useEffect(() => {
    dirtyRef.current = hasUnsavedChanges;
    if (!hasUnsavedChanges) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const confirmNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.getAttribute("href")?.startsWith("#")) return;
      if (new URL(anchor.href, window.location.href).href === window.location.href) return;
      if (!window.confirm("You have unsaved changes. Leave this adjusting entry without saving?")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", confirmNavigation, true);
    return () => {
      dirtyRef.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [dirtyRef, hasUnsavedChanges]);

  React.useEffect(() => {
    if (!entry?.id) return;
    let active = true;
    api.attachments(entry.id).then(data => { if (active) setAttachments(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load supporting documents"); });
    return () => { active = false; };
  }, [entry?.id]);
  React.useEffect(() => () => {
    for (const url of selectedFilePreviewUrls.current.values()) URL.revokeObjectURL(url);
    selectedFilePreviewUrls.current.clear();
  }, []);
  React.useEffect(() => {
    if (!form.originalEntryId) return;
    let active = true;
    api.reversalPreview(form.originalEntryId).then(data => { if (active) setPreview(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load reversal limits"); });
    return () => { active = false; };
  }, [form.originalEntryId]);
  React.useEffect(() => {
    if (!form.sourceJeNo || selectedSource?.jeNo === form.sourceJeNo) return;
    let active = true;
    api.sourceJournalEntry(form.sourceJeNo).then(source => { if (active) setSelectedSource(source); })
      .catch(e => { if (active) setSourceLoadError(e instanceof Error ? e.message : "Unable to load source journal details"); });
    return () => { active = false; };
  }, [form.sourceJeNo, selectedSource?.jeNo]);

  function updateLine(key: string, field: keyof Line, value: string) {
    setForm(current => ({ ...current, details: current.details.map(row => {
      if (row.key !== key) return row;
      const updated = { ...row, [field]: value };
      if (field === "debit" && cents(value) > 0) updated.credit = "";
      if (field === "credit" && cents(value) > 0) updated.debit = "";
      return updated;
    }) }));
  }
  async function searchSources() {
    setSourceBusy(true); setError(""); setSourceLoadError("");
    try { setSources(await api.searchSourceJournalEntries(sourceSearch)); setSourceSearched(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to search original journals"); }
    finally { setSourceBusy(false); }
  }
  function applySource(source: AdjustingEntrySourceJournal) {
    setSelectedSource(source);
    setForm(current => ({ ...current, sourceJeNo: source.jeNo, reference: source.transactionRef || source.jeNo,
      description: `Adjustment for ${source.jeNo}: ${source.description || ""}`,
      details: source.details.map(d => line({ ...d, departmentId: d.departmentId ?? null })) }));
    setPendingSource(null);
    setSources([]); setSourceSearch(""); setSourceSearched(false);
  }
  async function requestSourceSelection(jeNo: string) {
    setSourceBusy(true); setError(""); setSourceLoadError("");
    try {
      const source = await api.sourceJournalEntry(jeNo);
      if (source.jeNo === form.sourceJeNo) {
        setSelectedSource(source);
        setSources([]); setSourceSearch(""); setSourceSearched(false);
      } else if (hasSourceReplacementContent(form)) setPendingSource(source);
      else applySource(source);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load original journal"); }
    finally { setSourceBusy(false); }
  }
  function clearSource() {
    setSelectedSource(null); setSourceLoadError(""); setSources([]); setSourceSearch(""); setSourceSearched(false);
    setForm(current => ({ ...current, sourceJeNo: "" }));
  }
  async function save(submit: boolean) {
    if (inFlight.current) return;
    setError("");
    if (submit) {
      setSubmitAttempted(true);
      if (submitBlockers.length) return;
    } else {
      if (!form.reference.trim() || !form.transactionDate || !form.description.trim()) { setError("Complete the reference, accounting date, and description."); return; }
      if (form.details.length === 0) { setError("Add at least one journal line."); return; }
      for (const [index, row] of form.details.entries()) {
        const detailError = lineError(row);
        if (detailError && detailError !== "Department is required for this account.") { setError(`Line ${index + 1}: ${detailError}`); return; }
      }
    }
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
          revokeSelectedFilePreview(file);
          pending = pending.filter(selectedFile => selectedFile !== file); setSelectedFiles(pending);
        }
      } finally { setAttachments(await api.attachments(saved.id)); onSaved(); }
      setSavedSnapshot(serializeForm(form));
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
    for (const file of files) {
      if (isPreviewableAjeImage(file.type, file.name, true) && !selectedFilePreviewUrls.current.has(file)) {
        selectedFilePreviewUrls.current.set(file, URL.createObjectURL(file));
      }
    }
    setSelectedFiles(current => [...current, ...files]); setError("");
  }
  function revokeSelectedFilePreview(file: File) {
    const url = selectedFilePreviewUrls.current.get(file);
    if (url) URL.revokeObjectURL(url);
    selectedFilePreviewUrls.current.delete(file);
  }
  function removeSelectedFile(file: File) {
    revokeSelectedFilePreview(file);
    setSelectedFiles(current => current.filter(selectedFile => selectedFile !== file));
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
      <div>{(!hideTitle || entry?.jeNo || reversal) && <h2 className="text-lg font-semibold">{entry?.jeNo || (reversal ? "New Reversal" : "New Adjusting Entry")}</h2>}<div className="flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground">{entry?.status || "Draft"}{entry?.entryOrigin === "SYSTEM" ? " · Managed by its originating module" : ""}</p>{hasUnsavedChanges && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800">Unsaved changes</Badge>}</div></div>
      <div id="aje-balance-indicator" tabIndex={-1} className={`text-sm font-medium ${balanced ? "text-emerald-700" : hasAmounts ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">{balanced ? "Balanced" : hasAmounts ? <>Unbalanced · Difference {money((totals.debit - totals.credit) / 100)}</> : "No amounts entered yet · Add a debit and a credit line."}</div>
    </div>
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {(submitAttempted || checklistOpen) && submitBlockers.length > 0 && <div id="aje-submit-checklist" role="alert" className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="font-medium">Resolve these items before submitting:</p>
      <ul className="list-inside list-disc space-y-1">{submitBlockers.map((blocker, index) => <li key={`${blocker.message}-${index}`}><button type="button" className="text-left text-destructive underline-offset-2 hover:underline" onClick={() => focusBlocker(blocker.selector)}>{blocker.message}</button></li>)}</ul>
    </div>}
    {entry && <a className="inline-block text-sm text-primary underline" href={ajeEntryPrintUrl(entry.id)} target="_blank" rel="noreferrer">Print journal</a>}
    {entry?.lastPostingError && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Posting failed: {entry.lastPostingError}</div>}

    <section className="space-y-3 rounded-md border p-3 sm:p-4" aria-labelledby="aje-details-heading">
      <div><h3 id="aje-details-heading" className="font-semibold">Journal details</h3><p className="text-xs text-muted-foreground">Enter the accounting period, reference, and narration for this adjustment.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="aje-reference">Reference *</Label><Input id="aje-reference" maxLength={255} value={form.reference} disabled={frozen || busy} aria-invalid={submitAttempted && !form.reference.trim()} className={submitAttempted && !form.reference.trim() ? "border-destructive" : ""} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="aje-date">{reversal ? "Reversal date" : "Period end date"} *</Label><Input id="aje-date" type="date" value={form.transactionDate} disabled={frozen || busy} aria-invalid={submitAttempted && !form.transactionDate} className={submitAttempted && !form.transactionDate ? "border-destructive" : ""} onChange={e => setForm({ ...form, transactionDate: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Created By</Label><div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{entry?.creatorName || access.userName}</div></div>
        <div className="space-y-1.5"><Label>Division</Label><AjeSearchableSelect value={form.divisionId || "none"} onValueChange={value => setForm({ ...form, divisionId: value === "none" ? "" : value })} options={[{ value: "none", label: "None" }, ...divisions.map(d => ({ value: String(d.id), label: d.name }))]} disabled={frozen || busy || reversal} placeholder="None" /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Original journal (optional)</Label>
          <div className="flex flex-wrap items-center gap-2">{form.sourceJeNo ? <Badge variant="outline">{form.sourceJeNo}</Badge> : <span className="text-sm text-muted-foreground">None selected</span>}{!frozen && !reversal && form.sourceJeNo && <Button type="button" variant="ghost" size="sm" disabled={busy || sourceBusy} onClick={clearSource}>Clear source</Button>}</div>
          {!frozen && !reversal && <>
            <p className="text-xs text-muted-foreground">Search for a posted journal to use as the original source. The source details will be shown here before you continue.</p>
            <div className="flex gap-2"><Input aria-label="Search original journal" value={sourceSearch} onChange={e => {setSourceSearch(e.target.value);setSources([]);setSourceSearched(false);}} placeholder="Journal number or reference" disabled={busy || sourceBusy} /><Button type="button" variant="outline" className="shrink-0" disabled={busy || sourceBusy || sourceSearch.trim().length < 2} onClick={() => void searchSources()}>{sourceBusy ? <Loader2 className="size-4 animate-spin" /> : "Search"}</Button></div>
          </>}
          {sources.length > 0 && <div className="max-h-52 overflow-auto rounded-md border" role="listbox" aria-label="Source journal results">{sources.map(source => <button type="button" key={source.jeNo} className="block w-full border-b p-2 text-left text-sm last:border-b-0 hover:bg-muted" disabled={sourceBusy} onClick={() => void requestSourceSelection(source.jeNo)}><span className="flex flex-wrap items-center gap-2"><strong>{source.jeNo}</strong>{source.status && <Badge variant="outline">{source.status}</Badge>}<span className="text-xs text-muted-foreground">{source.sourceModule || "Journal"} · {formatDate(source.transactionDate)}</span></span><span className="mt-1 block text-xs text-muted-foreground">{source.transactionRef || "No reference"}{source.description ? ` · ${source.description}` : ""}</span></button>)}</div>}
          {sourceSearched && sources.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No eligible source journals matched that search. Try a journal number or reference.</p>}
          {sourceLoadError && <p role="alert" className="text-xs text-destructive">{sourceLoadError}</p>}
          {form.sourceJeNo && <div className="rounded-md bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Selected original journal</p>{selectedSource?.status && <Badge variant="outline">{selectedSource.status}</Badge>}</div>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3"><p><span className="text-muted-foreground">Reference</span><span className="mt-0.5 block font-medium">{selectedSource?.transactionRef || entry?.sourceTransactionRef || "—"}</span></p><p><span className="text-muted-foreground">Source module</span><span className="mt-0.5 block font-medium">{selectedSource?.sourceModule || entry?.sourceModule || "—"}</span></p><p><span className="text-muted-foreground">Accounting date</span><span className="mt-0.5 block font-medium">{formatDate(selectedSource?.transactionDate || entry?.sourceTransactionDate)}</span></p></div>
            {selectedSource?.description && <p className="mt-2 text-xs text-muted-foreground">{selectedSource.description}</p>}
          </div>}
        </div>
        <div className="space-y-1.5 md:col-span-3"><Label htmlFor="aje-narration">Description / Narration *</Label><Textarea id="aje-narration" value={form.description} disabled={frozen || busy} aria-invalid={submitAttempted && !form.description.trim()} className={submitAttempted && !form.description.trim() ? "border-destructive" : ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
      </div>
    </section>

    {reversal && <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm"><p>Reversal of {form.sourceJeNo}. Accounts and departments remain linked to the original lines.</p>{!frozen && <label className="flex items-center gap-2">Reversal mode <select className="rounded border bg-background px-2 py-1" value={form.reversalMode || "PARTIAL"} disabled={busy} onChange={e => changeReversalMode(e.target.value as "FULL" | "PARTIAL")}><option value="FULL" disabled={preview ? !preview.canFullReverse : true}>Full</option><option value="PARTIAL">Partial / remaining</option></select></label>}</div>}

    <section className="space-y-3" aria-labelledby="aje-lines-heading">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="aje-lines-heading" tabIndex={-1} className="font-semibold">Journal lines</h3><p className="text-xs text-muted-foreground">Each line needs one debit or credit. Totals must balance before submission.</p></div>{!frozen && !reversal && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setForm({ ...form, details: [...form.details, line()] })}><Plus className="mr-2 size-4" />Add line</Button>}</div>
      <div className="space-y-3 md:hidden">
        {form.details.map((row, index) => {
          const issue = lineError(row); const accountIssue = issue === "Select an account."; const departmentIssue = issue === "Department is required for this account."; const amountIssue = Boolean(issue && !accountIssue && !departmentIssue); const remaining = preview?.lines.find(d => d.originalDetailId === row.originalDetailId)?.remainingAmount;
          return <article key={row.key} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between"><h4 className="font-medium">Line {index + 1}</h4>{!frozen && !isFull && <Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${index + 1}`} disabled={busy} onClick={() => setForm({ ...form, details: form.details.filter(d => d.key !== row.key) })}><Trash2 className="size-4" /></Button>}</div>
            <div className="space-y-1"><Label>Account *</Label><AjeSearchableSelect options={accountOptions} value={row.coaId} onValueChange={v => updateLine(row.key, "coaId", v)} disabled={frozen || busy || reversal} placeholder="Select account" ariaLabel={`Line ${index + 1} account`} ariaInvalid={accountIssue} className={accountIssue ? "border-destructive" : ""} /></div>
            <div className="space-y-1"><Label>Department{accountById.get(row.coaId)?.departmentRequired ? " *" : ""}</Label><AjeSearchableSelect options={departmentOptions} value={row.departmentId || "none"} onValueChange={v => updateLine(row.key, "departmentId", v === "none" ? "" : v)} disabled={frozen || busy || reversal} placeholder="None" ariaLabel={`Line ${index + 1} department`} ariaInvalid={departmentIssue} className={departmentIssue ? "border-destructive" : ""} /></div>
            <div className="space-y-1"><Label htmlFor={`aje-line-desc-mobile-${index}`}>Line description</Label><Input id={`aje-line-desc-mobile-${index}`} aria-label={`Line ${index + 1} description`} value={row.description} maxLength={1000} disabled={frozen || busy} onChange={e => updateLine(row.key, "description", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor={`aje-line-debit-mobile-${index}`}>Debit</Label><Input id={`aje-line-debit-mobile-${index}`} aria-label={`Line ${index + 1} debit`} aria-invalid={amountIssue} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.debit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "debit", e.target.value)} /></div><div className="space-y-1"><Label htmlFor={`aje-line-credit-mobile-${index}`}>Credit</Label><Input id={`aje-line-credit-mobile-${index}`} aria-label={`Line ${index + 1} credit`} aria-invalid={amountIssue} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.credit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "credit", e.target.value)} /></div></div>
            {issue && <p className="text-xs text-destructive">{issue}</p>}{remaining !== undefined && <p className="text-xs text-muted-foreground">Remaining reversal amount: {money(remaining)}</p>}
          </article>;
        })}
        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-3 text-sm"><div><p className="text-xs text-muted-foreground">Total debit</p><p className="font-mono">{money(totals.debit / 100)}</p></div><div><p className="text-xs text-muted-foreground">Total credit</p><p className="font-mono">{money(totals.credit / 100)}</p></div></div>
      </div>
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted/30"><tr><th className="p-2 text-left">Account</th><th className="p-2 text-left">Department</th><th className="p-2 text-left">Line description</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th /></tr></thead><tbody>
          {form.details.map((row, index) => {
            const issue = lineError(row); const accountIssue = issue === "Select an account."; const departmentIssue = issue === "Department is required for this account."; const amountIssue = Boolean(issue && !accountIssue && !departmentIssue); const remaining = preview?.lines.find(d => d.originalDetailId === row.originalDetailId)?.remainingAmount;
            return <tr key={row.key} className="border-t"><td className="min-w-64 p-2 align-top"><AjeSearchableSelect options={accountOptions} value={row.coaId} onValueChange={v => updateLine(row.key, "coaId", v)} disabled={frozen || busy || reversal} placeholder="Select account" ariaLabel={`Line ${index + 1} account`} ariaInvalid={accountIssue} className={accountIssue ? "border-destructive" : ""} />{issue && <p className="mt-1 text-xs text-destructive">Line {index + 1}: {issue}</p>}{remaining !== undefined && <p className="mt-1 text-xs text-muted-foreground">Remaining: {money(remaining)}</p>}</td>
              <td className="min-w-48 p-2 align-top"><AjeSearchableSelect options={departmentOptions} value={row.departmentId || "none"} onValueChange={v => updateLine(row.key, "departmentId", v === "none" ? "" : v)} disabled={frozen || busy || reversal} placeholder="None" ariaLabel={`Line ${index + 1} department`} ariaInvalid={departmentIssue} className={departmentIssue ? "border-destructive" : ""} />{accountById.get(row.coaId)?.departmentRequired && <span className="text-xs text-muted-foreground">Required</span>}</td>
              <td className="min-w-44 p-2 align-top"><Input aria-label={`Line ${index + 1} description`} value={row.description} maxLength={1000} disabled={frozen || busy} onChange={e => updateLine(row.key, "description", e.target.value)} /></td>
              <td className="w-36 p-2 align-top"><Input aria-label={`Line ${index + 1} debit`} aria-invalid={amountIssue} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.debit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "debit", e.target.value)} /></td>
              <td className="w-36 p-2 align-top"><Input aria-label={`Line ${index + 1} credit`} aria-invalid={amountIssue} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.credit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "credit", e.target.value)} /></td>
              <td className="p-2 align-top">{!frozen && !isFull && <Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${index + 1}`} disabled={busy} onClick={() => setForm({ ...form, details: form.details.filter(d => d.key !== row.key) })}><Trash2 className="size-4" /></Button>}</td></tr>;
          })}
        </tbody><tfoot className="border-t bg-muted/20"><tr><td className="p-3 font-semibold" colSpan={3}>Totals</td><td className="p-3 text-right font-mono">{money(totals.debit / 100)}</td><td className="p-3 text-right font-mono">{money(totals.credit / 100)}</td><td /></tr></tfoot></table>
      </div>
    </section>

    <section className="space-y-3 rounded-md border p-3 sm:p-4" aria-labelledby="aje-documents-heading">
      <div><h3 id="aje-documents-heading" className="font-semibold">Supporting documents <span className="text-sm font-normal text-muted-foreground">(optional)</span></h3><p className="text-xs text-muted-foreground">Images, PDF, Word, Excel, CSV, or text · up to 10 MB per file. Files become read-only after submission.</p></div>
      {!frozen && <Input aria-label="Supporting documents" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" disabled={busy} onChange={e => { selectFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />}
      {attachments.map(file => {
        const previewable = file.state === "READY" && isPreviewableAjeImage(file.mimeType, file.filename);
        return <AjeAttachmentPreview key={file.id} fileName={file.filename}
          downloadUrl={file.state === "READY" ? ajeAttachmentUrl(file.entryId, file.id) : undefined}
          previewUrl={previewable ? ajeAttachmentPreviewUrl(file.entryId, file.id) : undefined}
          statusText={file.state === "READY" ? undefined : "Upload incomplete"}
          metadata={`by ${file.uploadedByName}`}
          onRemove={!frozen ? () => void removeAttachment(file) : undefined} removeDisabled={busy} />;
      })}
      {selectedFiles.map((file, index) => <AjeAttachmentPreview key={`${file.name}-${index}`} fileName={file.name}
        previewUrl={isPreviewableAjeImage(file.type, file.name, true) ? selectedFilePreviewUrls.current.get(file) : undefined}
        statusText="Pending save" onRemove={() => removeSelectedFile(file)} removeDisabled={busy} />)}
    </section>
    {entry && <div className="grid gap-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-2"><p>Created: {entry.creatorName} · {formatDateTime(entry.dateCreated)}</p><p>Submitted: {entry.submittedByName || "—"} · {formatDateTime(entry.submittedAt)}</p><p>Approved: {entry.approvedByName || "—"} · {formatDateTime(entry.approvedAt)}</p><p>Posted: {entry.postedByName || "—"} · {formatDateTime(entry.datePosted)}</p><p>Accounting date: {formatDate(entry.transactionDate)}</p></div>}

    {!frozen && <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-3 border-t bg-background/95 p-4 shadow-[0_-8px_20px_-16px_rgba(0,0,0,0.45)] backdrop-blur sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="min-w-0 text-sm" aria-live="polite">
        <p className={`font-medium ${balanced ? "text-emerald-700" : hasAmounts ? "text-destructive" : "text-muted-foreground"}`}>{balanced ? <>Balanced · Debit {money(totals.debit / 100)} · Credit {money(totals.credit / 100)}</> : hasAmounts ? <>Out of balance · Debit {money(totals.debit / 100)} · Credit {money(totals.credit / 100)}</> : "Enter debit and credit lines to balance this entry."}</p>
        {submitBlockers.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">{submitBlockers.length} {submitBlockers.length === 1 ? "item needs" : "items need"} attention before submission.{" "}{(submitAttempted || checklistOpen) ? "Use the checklist above to jump to each item." : <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => { setChecklistOpen(true); focusBlocker(submitBlockers[0].selector); }}>Show checklist</button>}</p> : <p className="mt-1 text-xs text-muted-foreground">Ready for review after saving.</p>}
      </div>
      <div className="flex shrink-0 justify-end gap-2"><Button type="button" variant="outline" disabled={busy || sourceBusy} onClick={() => void save(false)}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save Draft</Button><Button type="button" disabled={busy || sourceBusy} onClick={() => void save(true)}><Send className="mr-2 size-4" />Save & Submit</Button></div>
    </div>}
    <AlertDialog open={pendingSource !== null} onOpenChange={open => { if (!open) setPendingSource(null); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Replace the current entry details?</AlertDialogTitle><AlertDialogDescription>Selecting this original journal will replace the reference, narration, and journal lines. The accounting date, division, and supporting documents will stay unchanged.</AlertDialogDescription></AlertDialogHeader>
      {pendingSource && <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Original journal</span><span className="mt-0.5 block font-medium">{pendingSource.jeNo}</span></p><p><span className="text-muted-foreground">Date / reference</span><span className="mt-0.5 block">{formatDate(pendingSource.transactionDate)} · {pendingSource.transactionRef || "No reference"}</span></p><p><span className="text-muted-foreground">Lines to load</span><span className="mt-0.5 block">{pendingSource.details.length}</span></p><p><span className="text-muted-foreground">Source totals</span><span className="mt-0.5 block font-mono">Debit {money(pendingSourceTotals?.debit)} · Credit {money(pendingSourceTotals?.credit)}</span></p></div>}
      <AlertDialogFooter><AlertDialogCancel>Keep current details</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingSource) applySource(pendingSource); }}>Replace details</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
