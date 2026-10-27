"use client";

import * as React from "react";
import { ChevronDown, Copy, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { v4 as generateUuid } from "uuid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AjeSearchableSelect } from "./AjeSearchableSelect";
import { AjeDataFreshness, AjeRetryAlert } from "./AjeDataFreshness";
import { money, formatDate, formatDateTime, todayManila } from "./formatters";
import { ajeAttachmentPreviewUrl, ajeAttachmentThumbnailUrl, ajeAttachmentUrl, ajeEntryPrintUrl, adjustingJournalEntriesApi as api } from "../services/adjusting-journal-entries.api";
import { AjeAttachmentPreview, isPreviewableAjeImage } from "./AjeAttachmentPreview";
import type { AdjustingEntry, AdjustingEntryPayload, AdjustingEntryPostedAdjustmentHistory, AdjustingEntrySourceJournal, AdjustingEntrySourceJournalSummary, AjeAccess, AjeAccount, AjeAction, AjeAttachment, AjeReversalPreview, DepartmentLookup, DivisionLookup } from "../types";

type Line = { key: string; coaId: string; departmentId: string; description: string; debit: string; credit: string; originalDetailId: number | null };
type Form = { reference: string; transactionDate: string; description: string; divisionId: string; sourceJeNo: string; entryKind: "ADJUSTMENT" | "REVERSAL"; originalEntryId: number | null; reversalMode: "FULL" | "PARTIAL" | null; details: Line[] };
type SubmitBlocker = { message: string; selector: string };
type Props = { initialEntry: AdjustingEntry | null; seed?: AdjustingEntryPayload | null; readOnly: boolean; hideTitle?: boolean; dirtyRef: React.MutableRefObject<boolean>; access: AjeAccess; accounts: AjeAccount[]; departments: DepartmentLookup[]; divisions: DivisionLookup[]; onSaved: (saveCompleted: boolean, entry: AdjustingEntry, submitting: boolean) => void; onAction: (entry: AdjustingEntry, action: AjeAction) => void };

function CurrencyInput({ className, ...props }: React.ComponentPropsWithoutRef<typeof Input>) {
  return <div className="relative">
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₱</span>
    <Input {...props} className={`pl-7 ${className ?? ""}`} />
  </div>;
}

function line(data?: { coaId?: number | null; departmentId?: number | null; description?: string | null; debit?: number; credit?: number; originalDetailId?: number | null }): Line {
  return { key: generateUuid(), coaId: data?.coaId ? String(data.coaId) : "", departmentId: data?.departmentId ? String(data.departmentId) : "", description: data?.description || "", debit: data?.debit ? String(data.debit) : "", credit: data?.credit ? String(data.credit) : "", originalDetailId: data?.originalDetailId ?? null };
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
  const [requestKey] = React.useState(() => generateUuid());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [validationMode, setValidationMode] = React.useState<"draft" | "submit" | null>(null);
  const [summaryFocusRequest, setSummaryFocusRequest] = React.useState(0);
  const [checklistOpen, setChecklistOpen] = React.useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = React.useState(false);
  const sourceSearchRef = React.useRef<HTMLInputElement>(null);
  const sourcePickerTriggerRef = React.useRef<HTMLButtonElement>(null);
  const sourceResultTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const sourceRequestInFlight = React.useRef(false);
  const [sourceSearch, setSourceSearch] = React.useState("");
  const [sources, setSources] = React.useState<AdjustingEntrySourceJournalSummary[]>([]);
  const [sourceSearched, setSourceSearched] = React.useState(false);
  const [pendingSource, setPendingSource] = React.useState<AdjustingEntrySourceJournal | null>(null);
  const [selectedSource, setSelectedSource] = React.useState<AdjustingEntrySourceJournal | null>(null);
  const [sourceLoadError, setSourceLoadError] = React.useState("");
  const [sourceBusy, setSourceBusy] = React.useState(false);
  const [postedAdjustmentHistory, setPostedAdjustmentHistory] = React.useState<AdjustingEntryPostedAdjustmentHistory | null>(null);
  const [postedAdjustmentHistoryLoading, setPostedAdjustmentHistoryLoading] = React.useState(false);
  const [postedAdjustmentHistoryError, setPostedAdjustmentHistoryError] = React.useState("");
  const [attachments, setAttachments] = React.useState<AjeAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = React.useState(Boolean(initialEntry?.id));
  const [attachmentsError, setAttachmentsError] = React.useState("");
  const [attachmentsUpdatedAt, setAttachmentsUpdatedAt] = React.useState<number | null>(null);
  const [attachmentsRevision, setAttachmentsRevision] = React.useState(0);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const selectedFilePreviewUrls = React.useRef(new Map<File, string>());
  const [preview, setPreview] = React.useState<AjeReversalPreview | null>(null);
  const inFlight = React.useRef(false);
  const creatorEditBlocked = Boolean(entry && ["Draft", "For Revision"].includes(entry.status) && entry.entryOrigin === "MANUAL" && entry.creatorId !== access.userId);
  const frozen = readOnly || Boolean(entry && (!["Draft", "For Revision"].includes(entry.status) || entry.entryOrigin !== "MANUAL" || entry.creatorId !== access.userId));
  const reversal = form.entryKind === "REVERSAL";
  const isFull = reversal && form.reversalMode === "FULL";
  const hasUnsavedChanges = !frozen && (serializeForm(form) !== savedSnapshot || selectedFiles.length > 0);
  const totals = form.details.reduce((sum, row) => ({ debit: sum.debit + (cents(row.debit) || 0), credit: sum.credit + (cents(row.credit) || 0) }), { debit: 0, credit: 0 });
  const balanced = totals.debit > 0 && totals.debit === totals.credit;
  const hasAmounts = totals.debit > 0 || totals.credit > 0;
  const currentPostedAdjustmentHistory = postedAdjustmentHistory?.sourceJeNo === form.sourceJeNo ? postedAdjustmentHistory : null;
  const sourceCapacityAvailable = currentPostedAdjustmentHistory !== null
    && [currentPostedAdjustmentHistory.sourceTotalDebit, currentPostedAdjustmentHistory.netConsumedDebit, currentPostedAdjustmentHistory.remainingEligibleDebit].every(value => typeof value === "number" && Number.isFinite(value));
  const sourceRemainingCents = sourceCapacityAvailable ? Math.round(currentPostedAdjustmentHistory.remainingEligibleDebit * 100) : null;
  const sourceOverLimit = !frozen && !reversal && sourceRemainingCents !== null && totals.debit > sourceRemainingCents;
  const accountById = React.useMemo(() => new Map(accounts.map(a => [String(a.id), a])), [accounts]);
  const accountOptions = React.useMemo(() => {
    const all = accounts.map(a => ({ value: String(a.id), label: a.label }));
    for (const d of initialEntry?.details || []) if (d.coaId && !accounts.some(a => a.id === d.coaId)) all.push({ value: String(d.coaId), label: `${d.accountNumber} - ${d.accountTitle} (unavailable)` });
    return all;
  }, [accounts, initialEntry]);
  function accountOptionsForLine(row: Line) {
    return accountOptions.map(option => {
      const duplicateLine = form.details.findIndex(candidate => candidate.key !== row.key
        && candidate.coaId === option.value && candidate.departmentId === row.departmentId);
      return {
        ...option,
        disabled: duplicateLine >= 0,
        disabledReason: duplicateLine >= 0 ? `Used on line ${duplicateLine + 1}` : undefined,
      };
    });
  }
  const departmentOptions = [{ value: "none", label: "None" }, ...departments.filter(d => !form.divisionId || !d.parentDivision || String(d.parentDivision) === form.divisionId).map(d => ({ value: String(d.id), label: d.name }))];
  const pendingSourceTotals = pendingSource?.details.reduce((sum, row) => ({ debit: sum.debit + row.debit, credit: sum.credit + row.credit }), { debit: 0, credit: 0 });

  function lineError(row: Line, forSubmission = true) {
    const debit = cents(row.debit), credit = cents(row.credit);
    if (!row.coaId) return "Select an account.";
    if (!reversal) {
      const lineIndex = form.details.findIndex(candidate => candidate.key === row.key);
      const duplicateIndex = form.details.findIndex((candidate, index) => index < lineIndex
        && candidate.coaId === row.coaId && candidate.departmentId === row.departmentId);
      if (duplicateIndex >= 0) return `This account and department are already used on line ${duplicateIndex + 1}.`;
    }
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) return "Use non-negative amounts with up to two decimal places.";
    if ((debit > 0) === (credit > 0)) return "Enter one positive debit or credit.";
    if (accountById.get(row.coaId)?.departmentRequired && !row.departmentId) return forSubmission ? "Department is required for this account." : "";
    const source = preview?.lines.find(d => d.originalDetailId === row.originalDetailId);
    if (source && debit + credit > Math.round(source.remainingAmount * 100)) return "Amount exceeds the remaining reversal balance.";
    return "";
  }

  function collectBlockers(submit: boolean): SubmitBlocker[] {
    const blockers: SubmitBlocker[] = [];
    if (!form.reference.trim()) blockers.push({ message: "Enter a reference.", selector: "#aje-reference" });
    if (!form.transactionDate) blockers.push({ message: "Choose an accounting date.", selector: "#aje-date" });
    if (!form.description.trim()) blockers.push({ message: "Enter a description.", selector: "#aje-narration" });
    if (submit && sourceOverLimit) blockers.push({ message: `Linked adjustment debit exceeds the remaining eligible amount of ${money((sourceRemainingCents || 0) / 100)}.`, selector: "#aje-lines-heading" });
    if (form.details.length === 0) blockers.push({ message: submit ? "Add at least two journal lines." : "Add at least one journal line.", selector: "#aje-lines-heading" });
    else if (submit && form.details.length < 2) blockers.push({ message: "At least two journal lines are required.", selector: "#aje-lines-heading" });
    for (const [index, row] of form.details.entries()) {
      const issue = lineError(row, submit);
      if (issue) {
        const control = issue === "Select an account." || issue.startsWith("This account and department are already used") ? "account" : issue === "Department is required for this account." ? "department" : row.credit.trim() ? "credit" : "debit";
        blockers.push({ message: `Line ${index + 1}: ${issue}`, selector: `[aria-label="Line ${index + 1} ${control}"]` });
      }
    }
    if (submit && !balanced) blockers.push({ message: "Debit and credit totals must be equal and greater than zero.", selector: "#aje-balance-indicator" });
    return blockers;
  }

  const submitBlockers = collectBlockers(true);
  const showValidation = validationMode !== null && !frozen;
  const validationBlockers = showValidation ? collectBlockers(validationMode === "submit") : [];
  const validationFailed = validationBlockers.length > 0;
  const summaryBlockers = validationFailed ? validationBlockers : checklistOpen && !frozen ? submitBlockers : [];
  const referenceError = showValidation && !form.reference.trim() ? "Enter a reference." : "";
  const dateError = showValidation && !form.transactionDate ? "Choose an accounting date." : "";
  const narrationError = showValidation && !form.description.trim() ? "Enter a description." : "";
  const balanceError = validationBlockers.find(blocker => blocker.selector === "#aje-balance-indicator")?.message;
  const linesError = validationBlockers.filter(blocker => blocker.selector === "#aje-lines-heading").map(blocker => blocker.message).join(" ");

  React.useEffect(() => {
    if (summaryFocusRequest > 0) focusBlocker("#aje-submit-checklist");
  }, [summaryFocusRequest]);

  React.useEffect(() => {
    if (sourcePickerOpen) {
      sourceSearchRef.current?.scrollIntoView({ block: "center" });
      sourceSearchRef.current?.focus({ preventScroll: true });
    }
  }, [sourcePickerOpen]);

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
    setAttachmentsLoading(true);
    api.attachments(entry.id).then(data => {
      if (active) { setAttachments(data); setAttachmentsError(""); setAttachmentsUpdatedAt(Date.now()); }
    }).catch(e => { if (active) setAttachmentsError(e instanceof Error ? e.message : "Unable to load supporting documents"); })
      .finally(() => { if (active) setAttachmentsLoading(false); });
    return () => { active = false; };
  }, [entry?.id,attachmentsRevision]);
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
  React.useEffect(() => {
    if (!form.sourceJeNo || reversal) {
      setPostedAdjustmentHistory(null);
      setPostedAdjustmentHistoryLoading(false);
      setPostedAdjustmentHistoryError("");
      return;
    }
    let active = true;
    setPostedAdjustmentHistory(null);
    setPostedAdjustmentHistoryLoading(true);
    setPostedAdjustmentHistoryError("");
    const excludeId = entry?.status === "Posted" ? null : entry?.id ?? null;
    api.postedAdjustmentHistory(form.sourceJeNo, excludeId)
      .then(history => { if (active) setPostedAdjustmentHistory(history); })
      .catch(e => { if (active) setPostedAdjustmentHistoryError(e instanceof Error ? e.message : "Unable to load remaining source amount"); })
      .finally(() => { if (active) setPostedAdjustmentHistoryLoading(false); });
    return () => { active = false; };
  }, [form.sourceJeNo, reversal, entry?.id, entry?.status]);

  function updateLine(key: string, field: keyof Line, value: string) {
    setForm(current => ({ ...current, details: current.details.map(row => {
      if (row.key !== key) return row;
      const updated = { ...row, [field]: value };
      if (field === "debit" && cents(value) > 0) updated.credit = "";
      if (field === "credit" && cents(value) > 0) updated.debit = "";
      return updated;
    }) }));
  }
  function duplicateLine(key: string) {
    setForm(current => {
      const index = current.details.findIndex(row => row.key === key);
      if (index < 0) return current;
      const source = current.details[index];
      const duplicate = { ...source, key: generateUuid(), originalDetailId: null };
      return { ...current, details: [...current.details.slice(0, index + 1), duplicate, ...current.details.slice(index + 1)] };
    });
  }
  function addLineAndFocus() {
    if (frozen || reversal || busy) return;
    const nextLineNumber = form.details.length + 1;
    setForm(current => ({ ...current, details: [...current.details, line()] }));
    requestAnimationFrame(() => focusBlocker(`[aria-label="Line ${nextLineNumber} account"]`));
  }
  function handleLinePaste(event: React.ClipboardEvent<HTMLElement>) {
    if (frozen || reversal || busy) return;
    const target = event.target as HTMLElement;
    const match = target.closest<HTMLElement>("[aria-label]")?.getAttribute("aria-label")?.match(/^Line (\d+) (account|department|description|debit|credit)$/);
    const pasted = event.clipboardData.getData("text/plain");
    if (!match || (!pasted.includes("\t") && !pasted.includes("\n"))) return;

    event.preventDefault();
    const startRow = Number(match[1]) - 1;
    const startColumn = ["account", "department", "description", "debit", "credit"].indexOf(match[2]);
    const rows = pasted.replace(/\r/g, "").split("\n");
    while (rows.length && rows[rows.length - 1] === "") rows.pop();
    const nextDetails = form.details.map(row => ({ ...row }));
    while (nextDetails.length < startRow + rows.length) nextDetails.push(line());

    const accountId = (value: string) => {
      const normalized = value.trim().toLocaleLowerCase();
      if (!normalized) return "";
      const exact = accounts.find(account => String(account.id) === value.trim() || account.label.trim().toLocaleLowerCase() === normalized);
      if (exact) return String(exact.id);
      const codeMatches = accounts.filter(account => account.label.split(/\s+-\s+/, 1)[0].trim().toLocaleLowerCase() === normalized);
      return codeMatches.length === 1 ? String(codeMatches[0].id) : null;
    };
    const departmentId = (value: string) => {
      const normalized = value.trim().toLocaleLowerCase();
      if (!normalized || normalized === "none") return "";
      const exact = departmentOptions.find(option => option.label.trim().toLocaleLowerCase() === normalized || option.value === value.trim());
      return exact && exact.value !== "none" ? exact.value : null;
    };

    for (const [rowOffset, rowText] of rows.entries()) {
      const cells = rowText.split("\t");
      if (startColumn + cells.length > 5) { toast.error("The pasted data has more columns than the journal line grid."); return; }
      const targetIndex = startRow + rowOffset;
      const row = { ...nextDetails[targetIndex] };
      let debitPasted = false;
      let creditPasted = false;
      for (const [cellOffset, cell] of cells.entries()) {
        const column = startColumn + cellOffset;
        const value = column === 2 ? cell : cell.trim();
        if (column === 0) {
          const resolved = accountId(value);
          if (resolved === null) { toast.error(`Line ${targetIndex + 1}: account “${value}” was not found. Paste the exact account name or code.`); return; }
          row.coaId = resolved;
        } else if (column === 1) {
          const resolved = departmentId(value);
          if (resolved === null) { toast.error(`Line ${targetIndex + 1}: department “${value}” was not found.`); return; }
          row.departmentId = resolved;
        } else if (column === 2) row.description = value;
        else if (column === 3 || column === 4) {
          if (value && (!Number.isFinite(cents(value)) || cents(value) < 0)) { toast.error(`Line ${targetIndex + 1}: amounts must be non-negative with up to two decimal places.`); return; }
          if (column === 3) { debitPasted = true; row.debit = value; }
          else { creditPasted = true; row.credit = value; }
        }
      }
      if (debitPasted && creditPasted && cents(row.debit) > 0 && cents(row.credit) > 0) { toast.error(`Line ${targetIndex + 1}: enter either a debit or a credit, not both.`); return; }
      if (debitPasted && cents(row.debit) > 0) row.credit = "";
      if (creditPasted && cents(row.credit) > 0) row.debit = "";
      nextDetails[targetIndex] = row;
    }
    setForm(current => ({ ...current, details: nextDetails }));
    toast.success(`Pasted ${rows.length} journal ${rows.length === 1 ? "line" : "lines"}.`);
  }
  async function searchSources() {
    const query = sourceSearch.trim();
    if (frozen || reversal || busy || sourceRequestInFlight.current || query.length < 2) return;
    sourceRequestInFlight.current = true;
    setSources([]); setSourceSearched(false);
    setSourceBusy(true); setError(""); setSourceLoadError("");
    try { setSources(await api.searchSourceJournalEntries(query)); setSourceSearched(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to search original journals"); }
    finally { sourceRequestInFlight.current = false; setSourceBusy(false); }
  }
  function closeSourcePicker() {
    setSourcePickerOpen(false);
    requestAnimationFrame(() => sourcePickerTriggerRef.current?.focus());
  }
  function applySource(source: AdjustingEntrySourceJournal) {
    setSelectedSource(source);
    setForm(current => ({ ...current, sourceJeNo: source.jeNo, reference: source.transactionRef || source.jeNo,
      description: `Adjustment for ${source.jeNo}: ${source.description || ""}`,
      details: source.details.map(d => line({ ...d, departmentId: d.departmentId ?? null })) }));
    setPendingSource(null);
    setSources([]); setSourceSearch(""); setSourceSearched(false);
    closeSourcePicker();
  }
  async function requestSourceSelection(jeNo: string, trigger: HTMLButtonElement) {
    if (frozen || reversal || busy || sourceRequestInFlight.current) return;
    sourceRequestInFlight.current = true;
    sourceResultTriggerRef.current = trigger;
    setSourceBusy(true); setError(""); setSourceLoadError("");
    try {
      const source = await api.sourceJournalEntry(jeNo);
      if (source.jeNo === form.sourceJeNo) {
        setSelectedSource(source);
        setSources([]); setSourceSearch(""); setSourceSearched(false);
        closeSourcePicker();
      } else if (hasSourceReplacementContent(form)) setPendingSource(source);
      else applySource(source);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load original journal"); }
    finally { sourceRequestInFlight.current = false; setSourceBusy(false); }
  }
  function clearSource() {
    setSelectedSource(null); setSourceLoadError(""); setSources([]); setSourceSearch(""); setSourceSearched(false);
    setForm(current => ({ ...current, sourceJeNo: "" }));
    closeSourcePicker();
  }
  async function save(submit: boolean) {
    if (inFlight.current) return;
    setError("");
    setValidationMode(submit ? "submit" : "draft");
    setChecklistOpen(false);
    if (collectBlockers(submit).length) {
      setSummaryFocusRequest(request => request + 1);
      return;
    }
    inFlight.current = true; setBusy(true);
    try {
      const payload: AdjustingEntryPayload = { reference: form.reference.trim(), transactionDate: form.transactionDate, description: form.description.trim(), divisionId: form.divisionId ? Number(form.divisionId) : null, departmentId: null,
        sourceJeNo: form.sourceJeNo || null, entryKind: form.entryKind, originalEntryId: form.originalEntryId, reversalMode: form.reversalMode,
        creationRequestKey: requestKey, ...(entry ? { version: entry.version, saveAsDraft: !submit } : {}),
        details: form.details.map(row => ({ coaId: Number(row.coaId), departmentId: row.departmentId ? Number(row.departmentId) : null, description: row.description, debit: cents(row.debit) / 100, credit: cents(row.credit) / 100, originalDetailId: row.originalDetailId })) };
      const saved = entry ? await api.update(entry.id, payload) : await api.create(payload);
      setEntry(saved);
      let pending = [...selectedFiles];
      let saveCompleted = false;
      try {
        for (const file of selectedFiles) {
          await api.uploadAttachment(saved.id, file);
          revokeSelectedFilePreview(file);
          pending = pending.filter(selectedFile => selectedFile !== file); setSelectedFiles(pending);
        }
        saveCompleted = true;
      } finally {
        setAttachmentsRevision(value => value + 1);
        onSaved(saveCompleted, saved, submit);
      }
      setSavedSnapshot(serializeForm(form));
      setValidationMode(null);
      setChecklistOpen(false);
      toast.success(`${saved.jeNo || `Entry #${saved.id}`} saved as ${saved.status}`);
      if (submit) onAction(saved, "submit");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save this draft"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function removeAttachment(file: AjeAttachment) {
    if (!entry || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await api.removeAttachment(entry.id, file.id); setAttachments(current => current.filter(attachment => attachment.id !== file.id)); setAttachmentsRevision(value => value + 1); }
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
      <div>{(!hideTitle || entry?.jeNo || reversal) && <h2 className="text-lg font-semibold">{entry?.jeNo || (reversal ? "New Reversal" : "New Adjusting Entry")}</h2>}<div className="flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground">{entry?.status || (reversal ? "For Revision (not saved)" : "Draft (not saved)")}{entry?.entryOrigin === "SYSTEM" ? " · Managed by its originating module" : ""}</p>{hasUnsavedChanges && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800">Unsaved changes</Badge>}</div></div>
      <div id="aje-balance-indicator" tabIndex={-1} aria-describedby={balanceError ? "aje-balance-error" : undefined} className={`text-sm font-medium ${balanced ? "text-emerald-700" : balanceError ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">{balanced ? "Balanced" : hasAmounts ? <>Unbalanced · Difference {money((totals.debit - totals.credit) / 100)}</> : "No amounts entered yet · Add a debit and a credit line."}{balanceError && <p id="aje-balance-error" className="mt-1 text-xs">{balanceError}</p>}</div>
    </div>
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {creatorEditBlocked && <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800">Only the AJE creator can edit or submit this draft.</div>}
    {summaryBlockers.length > 0 && <div id="aje-submit-checklist" tabIndex={-1} role={validationFailed ? "alert" : undefined} aria-labelledby="aje-checklist-heading" className={`space-y-2 rounded-md border p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring ${validationFailed ? "border-destructive/30 bg-destructive/5" : "bg-muted/20"}`}>
      <h3 id="aje-checklist-heading" className="font-medium">{validationFailed ? "There is a problem" : "Before submitting"}</h3>
      <p>{validationFailed ? `Resolve these items before ${validationMode === "draft" ? "saving the draft" : "submitting"}:` : "Complete these requirements when you are ready to submit:"}</p>
      <ul className="list-inside list-disc space-y-1">{summaryBlockers.map((blocker, index) => <li key={`${blocker.message}-${index}`}><button type="button" className={`text-left underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${validationFailed ? "text-destructive" : "text-foreground"}`} onClick={() => focusBlocker(blocker.selector)}>{blocker.message}</button></li>)}</ul>
    </div>}
    {entry && <a className="inline-block text-sm text-primary underline" href={ajeEntryPrintUrl(entry.id)} target="_blank" rel="noreferrer">Print journal</a>}
    {entry?.lastPostingError && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Posting failed: {entry.lastPostingError}</div>}

    <section className="space-y-3 rounded-md border p-3 sm:p-4" aria-labelledby="aje-details-heading">
      <div><h3 id="aje-details-heading" className="font-semibold">Journal details</h3><p className="text-xs text-muted-foreground">Enter the accounting period, reference, and narration for this adjustment.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="aje-reference">Reference *</Label><Input id="aje-reference" maxLength={255} value={form.reference} disabled={frozen || busy} aria-invalid={Boolean(referenceError)} aria-describedby={referenceError ? "aje-reference-error" : undefined} className={referenceError ? "border-destructive" : ""} onChange={e => setForm({ ...form, reference: e.target.value })} />{referenceError && <p id="aje-reference-error" className="text-xs text-destructive">{referenceError}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="aje-date">{reversal ? "Reversal date" : "Period end date"} *</Label><Input id="aje-date" type="date" value={form.transactionDate} disabled={frozen || busy} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "aje-date-error" : undefined} className={dateError ? "border-destructive" : ""} onChange={e => setForm({ ...form, transactionDate: e.target.value })} />{dateError && <p id="aje-date-error" className="text-xs text-destructive">{dateError}</p>}</div>
        <div className="space-y-1.5"><Label>Created By</Label><div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{entry?.creatorName || access.userName}</div></div>
        <div className="space-y-1.5"><Label>Division</Label><AjeSearchableSelect value={form.divisionId || "none"} onValueChange={value => setForm({ ...form, divisionId: value === "none" ? "" : value })} options={[{ value: "none", label: "None" }, ...divisions.map(d => ({ value: String(d.id), label: d.name }))]} disabled={frozen || busy || reversal} placeholder="None" /></div>
        <div className="min-w-0 space-y-1.5 md:col-span-2"><Label>Original journal (optional)</Label>
          {!frozen && !reversal ? <Collapsible open={sourcePickerOpen} onOpenChange={setSourcePickerOpen} className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {form.sourceJeNo && <Badge variant="outline">{form.sourceJeNo}</Badge>}
              <CollapsibleTrigger asChild><Button ref={sourcePickerTriggerRef} type="button" variant="outline" size="sm" disabled={busy || sourceBusy}>{form.sourceJeNo ? "Change original journal" : "Link original journal"}<ChevronDown aria-hidden="true" className={`ml-2 size-4 transition-transform ${sourcePickerOpen ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger>
              {form.sourceJeNo && <Button type="button" variant="ghost" size="sm" disabled={busy || sourceBusy} onClick={clearSource}>Clear source</Button>}
            </div>
            <CollapsibleContent className="min-w-0 space-y-2">
              <p id="aje-source-search-hint" className="text-xs text-muted-foreground">Enter at least 2 characters of a journal number or reference.</p>
              <div className="flex min-w-0 flex-wrap gap-2"><Input ref={sourceSearchRef} aria-label="Search original journal" aria-describedby="aje-source-search-hint" className="min-w-0 flex-1 basis-48" value={sourceSearch} onChange={e => {setSourceSearch(e.target.value);setSources([]);setSourceSearched(false);}} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void searchSources(); } }} placeholder="Journal number or reference" disabled={busy || sourceBusy} /><Button type="button" variant="outline" className="shrink-0" disabled={busy || sourceBusy || sourceSearch.trim().length < 2} onClick={() => void searchSources()}>{sourceBusy && <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />}Search</Button></div>
              {sourceBusy && <p role="status" className="text-xs text-muted-foreground">Loading original journals…</p>}
              {sources.length > 0 && <div className="max-h-52 overflow-auto rounded-md border" role="listbox" aria-label="Source journal results">{sources.map(source => <button type="button" key={source.jeNo} className="block w-full border-b p-2 text-left text-sm last:border-b-0 hover:bg-muted" disabled={sourceBusy} onClick={e => void requestSourceSelection(source.jeNo, e.currentTarget)}><span className="flex flex-wrap items-center gap-2"><strong>{source.jeNo}</strong>{source.status && <Badge variant="outline">{source.status}</Badge>}<span className="text-xs text-muted-foreground">{source.sourceModule || "Journal"} · {formatDate(source.transactionDate)}</span></span><span className="mt-1 block text-xs text-muted-foreground">{source.transactionRef || "No reference"}{source.description ? ` · ${source.description}` : ""}</span></button>)}</div>}
              {sourceSearched && sources.length === 0 && <p role="status" className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No eligible source journals matched that search. Try a journal number or reference.</p>}
            </CollapsibleContent>
          </Collapsible> : <div className="flex flex-wrap items-center gap-2">{form.sourceJeNo ? <Badge variant="outline">{form.sourceJeNo}</Badge> : <span className="text-sm text-muted-foreground">None selected</span>}</div>}
          {sourceLoadError && <p role="alert" className="text-xs text-destructive">{sourceLoadError}</p>}
          {form.sourceJeNo && <div className="rounded-md bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Selected original journal</p>{selectedSource?.status && <Badge variant="outline">{selectedSource.status}</Badge>}</div>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3"><p><span className="text-muted-foreground">Reference</span><span className="mt-0.5 block font-medium">{selectedSource?.transactionRef || entry?.sourceTransactionRef || "—"}</span></p><p><span className="text-muted-foreground">Source module</span><span className="mt-0.5 block font-medium">{selectedSource?.sourceModule || entry?.sourceModule || "—"}</span></p><p><span className="text-muted-foreground">Accounting date</span><span className="mt-0.5 block font-medium">{formatDate(selectedSource?.transactionDate || entry?.sourceTransactionDate)}</span></p></div>
            {selectedSource?.description && <p className="mt-2 text-xs text-muted-foreground">{selectedSource.description}</p>}
            {!reversal && <div className="mt-3 rounded-md border bg-background p-3 text-xs">
              <p className="font-medium">Remaining eligible source amount</p>
              {postedAdjustmentHistoryLoading ? <p className="mt-1 text-muted-foreground">Checking posted adjustments…</p>
                : postedAdjustmentHistoryError ? <p role="alert" className="mt-1 text-destructive">{postedAdjustmentHistoryError}</p>
                  : sourceCapacityAvailable ? <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <p><span className="text-muted-foreground">Source debit</span><span className="mt-0.5 block font-mono font-medium">{money(currentPostedAdjustmentHistory.sourceTotalDebit)}</span></p>
                    <p><span className="text-muted-foreground">Net posted adjustments</span><span className="mt-0.5 block font-mono font-medium">{money(currentPostedAdjustmentHistory.netConsumedDebit)}</span></p>
                    <p><span className="text-muted-foreground">Remaining eligible debit</span><span className="mt-0.5 block font-mono font-medium">{money(currentPostedAdjustmentHistory.remainingEligibleDebit)}</span></p>
                  </div> : <p className="mt-1 text-muted-foreground">Remaining amount is unavailable.</p>}
              {showValidation && validationMode === "submit" && sourceOverLimit && <p className="mt-2 font-medium text-destructive">Save as a draft or reduce the debit before submitting.</p>}
            </div>}
          </div>}
        </div>
        <div className="space-y-1.5 md:col-span-3"><Label htmlFor="aje-narration">Description / Narration *</Label><Textarea id="aje-narration" value={form.description} disabled={frozen || busy} aria-invalid={Boolean(narrationError)} aria-describedby={narrationError ? "aje-narration-error" : undefined} className={narrationError ? "border-destructive" : ""} onChange={e => setForm({ ...form, description: e.target.value })} />{narrationError && <p id="aje-narration-error" className="text-xs text-destructive">{narrationError}</p>}</div>
      </div>
    </section>

    {reversal && <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm"><p>Reversal of {form.sourceJeNo}. Accounts and departments remain linked to the original lines.</p>{!frozen && <label className="flex items-center gap-2">Reversal mode <select className="rounded border bg-background px-2 py-1" value={form.reversalMode || "PARTIAL"} disabled={busy} onChange={e => changeReversalMode(e.target.value as "FULL" | "PARTIAL")}><option value="FULL" disabled={preview ? !preview.canFullReverse : true}>Full</option><option value="PARTIAL">Partial / remaining</option></select></label>}</div>}

    <section className="space-y-3" aria-labelledby="aje-lines-heading" onPaste={handleLinePaste}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="aje-lines-heading" tabIndex={-1} aria-describedby={linesError ? "aje-lines-error" : undefined} className="font-semibold">Journal lines</h3><p className="text-xs text-muted-foreground">Each line needs one debit or credit. Totals must balance before submission.</p>{linesError && <p id="aje-lines-error" className="mt-1 text-xs text-destructive">{linesError}</p>}</div>{!frozen && !reversal && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setForm({ ...form, details: [...form.details, line()] })}><Plus className="mr-2 size-4" />Add line</Button>}</div>
      {!frozen && !reversal && <p className="text-xs text-muted-foreground">Duplicate a line or paste tab-separated rows into any line field. Paste columns follow Account, Department, Description, Debit, Credit. Each account and department combination can appear once; choose the department first to reuse an account.</p>}
      <div className="space-y-3 md:hidden">
        {form.details.map((row, index) => {
          const issue = showValidation ? lineError(row, validationMode === "submit") : ""; const accountIssue = issue === "Select an account." || issue.startsWith("This account and department are already used"); const departmentIssue = issue === "Department is required for this account."; const amountIssue = Boolean(issue && !accountIssue && !departmentIssue); const errorId = `aje-line-${row.key}-mobile-error`; const remaining = preview?.lines.find(d => d.originalDetailId === row.originalDetailId)?.remainingAmount;
          return <article key={row.key} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between"><h4 className="font-medium">Line {index + 1}</h4><div className="flex items-center">{!frozen && !reversal && <Button type="button" size="icon" variant="ghost" aria-label={`Duplicate line ${index + 1}`} disabled={busy} onClick={() => duplicateLine(row.key)}><Copy className="size-4" /></Button>}{!frozen && !isFull && <Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${index + 1}`} disabled={busy} onClick={() => setForm({ ...form, details: form.details.filter(d => d.key !== row.key) })}><Trash2 className="size-4" /></Button>}</div></div>
            <div className="space-y-1"><Label>Account *</Label><AjeSearchableSelect options={accountOptionsForLine(row)} value={row.coaId} onValueChange={v => updateLine(row.key, "coaId", v)} disabled={frozen || busy || reversal} placeholder="Select account" ariaLabel={`Line ${index + 1} account`} ariaInvalid={accountIssue} ariaDescribedBy={accountIssue ? errorId : undefined} className={accountIssue ? "border-destructive" : ""} /></div>
            <div className="space-y-1"><Label>Department{accountById.get(row.coaId)?.departmentRequired ? " *" : ""}</Label><AjeSearchableSelect options={departmentOptions} value={row.departmentId || "none"} onValueChange={v => updateLine(row.key, "departmentId", v === "none" ? "" : v)} disabled={frozen || busy || reversal} placeholder="None" ariaLabel={`Line ${index + 1} department`} ariaInvalid={departmentIssue} ariaDescribedBy={departmentIssue ? errorId : undefined} className={departmentIssue ? "border-destructive" : ""} /></div>
            <div className="space-y-1"><Label htmlFor={`aje-line-desc-mobile-${index}`}>Line description</Label><Input id={`aje-line-desc-mobile-${index}`} aria-label={`Line ${index + 1} description`} value={row.description} maxLength={1000} disabled={frozen || busy} onChange={e => updateLine(row.key, "description", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor={`aje-line-debit-mobile-${index}`}>Debit</Label><CurrencyInput id={`aje-line-debit-mobile-${index}`} aria-label={`Line ${index + 1} debit`} aria-invalid={amountIssue} aria-describedby={amountIssue ? errorId : undefined} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.debit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "debit", e.target.value)} onKeyDown={e => { if (e.key !== "Enter" || index !== form.details.length - 1) return; e.preventDefault(); if (row.coaId || row.departmentId || row.description.trim() || row.debit.trim() || row.credit.trim()) addLineAndFocus(); }} /></div><div className="space-y-1"><Label htmlFor={`aje-line-credit-mobile-${index}`}>Credit</Label><CurrencyInput id={`aje-line-credit-mobile-${index}`} aria-label={`Line ${index + 1} credit`} aria-invalid={amountIssue} aria-describedby={amountIssue ? errorId : undefined} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.credit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "credit", e.target.value)} onKeyDown={e => { if (e.key !== "Enter" || index !== form.details.length - 1) return; e.preventDefault(); if (row.coaId || row.departmentId || row.description.trim() || row.debit.trim() || row.credit.trim()) addLineAndFocus(); }} /></div></div>
            {issue && <p id={errorId} className="text-xs text-destructive">Line {index + 1}: {issue}</p>}{remaining !== undefined && <p className="text-xs text-muted-foreground">Remaining reversal amount: {money(remaining)}</p>}
          </article>;
        })}
        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-3 text-sm"><div><p className="text-xs text-muted-foreground">Total debit</p><p className="font-mono">{money(totals.debit / 100)}</p></div><div><p className="text-xs text-muted-foreground">Total credit</p><p className="font-mono">{money(totals.credit / 100)}</p></div></div>
      </div>
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted/30"><tr><th className="p-2 text-left">Account</th><th className="p-2 text-left">Department</th><th className="p-2 text-left">Line description</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th /></tr></thead><tbody>
          {form.details.map((row, index) => {
            const issue = showValidation ? lineError(row, validationMode === "submit") : ""; const accountIssue = issue === "Select an account." || issue.startsWith("This account and department are already used"); const departmentIssue = issue === "Department is required for this account."; const amountIssue = Boolean(issue && !accountIssue && !departmentIssue); const errorId = `aje-line-${row.key}-desktop-error`; const remaining = preview?.lines.find(d => d.originalDetailId === row.originalDetailId)?.remainingAmount;
            return <tr key={row.key} className="border-t"><td className="min-w-64 p-2 align-top"><AjeSearchableSelect options={accountOptionsForLine(row)} value={row.coaId} onValueChange={v => updateLine(row.key, "coaId", v)} disabled={frozen || busy || reversal} placeholder="Select account" ariaLabel={`Line ${index + 1} account`} ariaInvalid={accountIssue} ariaDescribedBy={accountIssue ? errorId : undefined} className={accountIssue ? "border-destructive" : ""} />{accountIssue && <p id={errorId} className="mt-1 text-xs text-destructive">Line {index + 1}: {issue}</p>}{remaining !== undefined && <p className="mt-1 text-xs text-muted-foreground">Remaining: {money(remaining)}</p>}</td>
              <td className="min-w-48 p-2 align-top"><AjeSearchableSelect options={departmentOptions} value={row.departmentId || "none"} onValueChange={v => updateLine(row.key, "departmentId", v === "none" ? "" : v)} disabled={frozen || busy || reversal} placeholder="None" ariaLabel={`Line ${index + 1} department`} ariaInvalid={departmentIssue} ariaDescribedBy={departmentIssue ? errorId : undefined} className={departmentIssue ? "border-destructive" : ""} />{departmentIssue && <p id={errorId} className="mt-1 text-xs text-destructive">Line {index + 1}: {issue}</p>}{accountById.get(row.coaId)?.departmentRequired && <span className="text-xs text-muted-foreground">Required</span>}</td>
              <td className="min-w-44 p-2 align-top"><Input aria-label={`Line ${index + 1} description`} value={row.description} maxLength={1000} disabled={frozen || busy} onChange={e => updateLine(row.key, "description", e.target.value)} /></td>
              <td className="w-36 p-2 align-top"><CurrencyInput aria-label={`Line ${index + 1} debit`} aria-invalid={amountIssue} aria-describedby={amountIssue ? errorId : undefined} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.debit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "debit", e.target.value)} onKeyDown={e => { if (e.key !== "Enter" || index !== form.details.length - 1) return; e.preventDefault(); if (row.coaId || row.departmentId || row.description.trim() || row.debit.trim() || row.credit.trim()) addLineAndFocus(); }} />{amountIssue && !row.credit.trim() && <p id={errorId} className="mt-1 text-xs text-destructive">Line {index + 1}: {issue}</p>}</td>
              <td className="w-36 p-2 align-top"><CurrencyInput aria-label={`Line ${index + 1} credit`} aria-invalid={amountIssue} aria-describedby={amountIssue ? errorId : undefined} className={`text-right font-mono ${amountIssue ? "border-destructive" : ""}`} type="number" min="0" step="0.01" value={row.credit} disabled={frozen || busy || isFull} onChange={e => updateLine(row.key, "credit", e.target.value)} onKeyDown={e => { if (e.key !== "Enter" || index !== form.details.length - 1) return; e.preventDefault(); if (row.coaId || row.departmentId || row.description.trim() || row.debit.trim() || row.credit.trim()) addLineAndFocus(); }} />{amountIssue && row.credit.trim() && <p id={errorId} className="mt-1 text-xs text-destructive">Line {index + 1}: {issue}</p>}</td>
              <td className="p-2 align-top"><div className="flex">{!frozen && !reversal && <Button type="button" size="icon" variant="ghost" aria-label={`Duplicate line ${index + 1}`} disabled={busy} onClick={() => duplicateLine(row.key)}><Copy className="size-4" /></Button>}{!frozen && !isFull && <Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${index + 1}`} disabled={busy} onClick={() => setForm({ ...form, details: form.details.filter(d => d.key !== row.key) })}><Trash2 className="size-4" /></Button>}</div></td></tr>;
          })}
        </tbody><tfoot className="border-t bg-muted/20"><tr><td className="p-3 font-semibold" colSpan={3}>Totals</td><td className="p-3 text-right font-mono">{money(totals.debit / 100)}</td><td className="p-3 text-right font-mono">{money(totals.credit / 100)}</td><td /></tr></tfoot></table>
      </div>
    </section>

    <section className="space-y-3 rounded-md border p-3 sm:p-4" aria-labelledby="aje-documents-heading">
      <div><h3 id="aje-documents-heading" className="font-semibold">Supporting documents <span className="text-sm font-normal text-muted-foreground">(optional)</span></h3><p className="text-xs text-muted-foreground">Images, PDF, Word, Excel, CSV, or text · up to 10 MB per file. Files become read-only after submission.</p><AjeDataFreshness label="Documents" updatedAt={attachmentsUpdatedAt} loading={attachmentsLoading} stale={Boolean(attachmentsError)} /></div>
      {attachmentsError && <AjeRetryAlert message={attachmentsError} retrying={attachmentsLoading} retryLabel="Retry documents" onRetry={() => setAttachmentsRevision(value => value + 1)} />}
      {attachmentsLoading && <p role="status" className="text-xs text-muted-foreground">Loading supporting documents…</p>}
      {!frozen && <Input aria-label="Supporting documents" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" disabled={busy} onChange={e => { selectFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />}
      {attachments.map(file => {
        const previewable = file.state === "READY" && isPreviewableAjeImage(file.mimeType, file.filename);
        return <AjeAttachmentPreview key={file.id} fileName={file.filename}
          downloadUrl={file.state === "READY" ? ajeAttachmentUrl(file.entryId, file.id) : undefined}
          thumbnailUrl={previewable ? ajeAttachmentThumbnailUrl(file.entryId, file.id) : undefined}
          previewUrl={previewable ? ajeAttachmentPreviewUrl(file.entryId, file.id) : undefined}
          statusText={file.state === "READY" ? undefined : "Upload incomplete"}
          metadata={`by ${file.uploadedByName}`}
          onRemove={!frozen ? () => void removeAttachment(file) : undefined} removeDisabled={busy} />;
      })}
      {selectedFiles.map((file, index) => <AjeAttachmentPreview key={`${file.name}-${index}`} fileName={file.name}
        thumbnailUrl={isPreviewableAjeImage(file.type, file.name, true) ? selectedFilePreviewUrls.current.get(file) : undefined}
        previewUrl={isPreviewableAjeImage(file.type, file.name, true) ? selectedFilePreviewUrls.current.get(file) : undefined}
        statusText="Pending save" onRemove={() => removeSelectedFile(file)} removeDisabled={busy} />)}
    </section>
    {entry && <div className="grid gap-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-2"><p>Created: {entry.creatorName} · {formatDateTime(entry.dateCreated)}</p><p>Submitted: {entry.submittedByName || "—"} · {formatDateTime(entry.submittedAt)}</p>{(entry.approvedByName || entry.approvedAt) && <p>Historical approval: {entry.approvedByName || "—"} · {formatDateTime(entry.approvedAt)}</p>}<p>Posted: {entry.postedByName || "—"} · {formatDateTime(entry.datePosted)}</p><p>Accounting date: {formatDate(entry.transactionDate)}</p></div>}

    {!frozen && <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-3 border-t bg-background/95 p-4 shadow-[0_-8px_20px_-16px_rgba(0,0,0,0.45)] backdrop-blur sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="min-w-0 text-sm" aria-live="polite">
        <p className={`font-medium ${balanced ? "text-emerald-700" : balanceError ? "text-destructive" : "text-muted-foreground"}`}>{balanced ? <>Balanced · Debit {money(totals.debit / 100)} · Credit {money(totals.credit / 100)}</> : hasAmounts ? <>Out of balance · Debit {money(totals.debit / 100)} · Credit {money(totals.credit / 100)}</> : "Enter debit and credit lines to balance this entry."}</p>
        {validationFailed ? <p className="mt-1 text-xs text-muted-foreground">{validationBlockers.length} {validationBlockers.length === 1 ? "item needs" : "items need"} attention before {validationMode === "draft" ? "saving the draft" : "submission"}. <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setSummaryFocusRequest(request => request + 1)}>Review errors</button></p>
          : submitBlockers.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">Check the requirements when you are ready. <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => { setChecklistOpen(true); setSummaryFocusRequest(request => request + 1); }}>Show checklist</button></p> : <p className="mt-1 text-xs text-muted-foreground">Ready to submit for posting.</p>}
      </div>
      <div className="flex shrink-0 justify-end gap-2"><Button type="button" variant="outline" disabled={busy || sourceBusy} onClick={() => void save(false)}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{!entry && reversal ? "Save for Revision" : "Save Draft"}</Button><Button type="button" disabled={busy || sourceBusy} onClick={() => void save(true)}><Send className="mr-2 size-4" />Save & Submit</Button></div>
    </div>}
    <AlertDialog open={pendingSource !== null} onOpenChange={open => { if (!open) setPendingSource(null); }}><AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); if (sourcePickerOpen) sourceResultTriggerRef.current?.focus(); else sourcePickerTriggerRef.current?.focus(); }}>
      <AlertDialogHeader><AlertDialogTitle>Replace the current entry details?</AlertDialogTitle><AlertDialogDescription>Selecting this original journal will replace the reference, narration, and journal lines. The accounting date, division, and supporting documents will stay unchanged.</AlertDialogDescription></AlertDialogHeader>
      {pendingSource && <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Original journal</span><span className="mt-0.5 block font-medium">{pendingSource.jeNo}</span></p><p><span className="text-muted-foreground">Date / reference</span><span className="mt-0.5 block">{formatDate(pendingSource.transactionDate)} · {pendingSource.transactionRef || "No reference"}</span></p><p><span className="text-muted-foreground">Lines to load</span><span className="mt-0.5 block">{pendingSource.details.length}</span></p><p><span className="text-muted-foreground">Source totals</span><span className="mt-0.5 block font-mono">Debit {money(pendingSourceTotals?.debit)} · Credit {money(pendingSourceTotals?.credit)}</span></p></div>}
      <AlertDialogFooter><AlertDialogCancel>Keep current details</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingSource) applySource(pendingSource); }}>Replace details</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
