"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdjustingEntriesFilters } from "./components/AdjustingEntriesFilters";
import { AdjustingEntriesTable, actionLabels } from "./components/AdjustingEntriesTable";
import { AdjustingEntriesSummaryCards } from "./components/AdjustingEntriesSummaryCards";
import { AjeEntryEditor } from "./components/AjeEntryEditor";
import { AjeAuditTrail } from "./components/AjeAuditTrail";
import { AjePeriodDialog } from "./components/AjePeriodDialog";
import { formatDate, money, todayManila } from "./components/formatters";
import { adjustingJournalEntriesApi as api, ajeReportUrl, fetchDepartmentOptions, fetchDivisionOptions } from "./services/adjusting-journal-entries.api";
import type { AdjustingEntry, AdjustingEntryPayload, AdjustingEntryQuery, AdjustingEntrySummary, AjeAccess, AjeAccount, AjeAction, AjePeriod, AjeReversalPreview, DepartmentLookup, DivisionLookup } from "./types";

type Tab = "new" | "posting" | "audit" | "summary";
type EntryListTab = Extract<Tab, "posting" | "summary">;
type Lookups = { access: AjeAccess; accounts: AjeAccount[]; departments: DepartmentLookup[]; divisions: DivisionLookup[] };
const statuses = ["All","Draft","Submitted","Approved","Rejected","Posted","Cancelled","Failed","Voided"];
const emptySummary: AdjustingEntrySummary = { draft:0, submitted:0, approved:0, posted:0, rejected:0, cancelled:0, failed:0, voided:0, imbalanced:0, totalRecords:0 };
const reasonRequired = new Set<AjeAction>(["reject","cancel"]);

export function AdjustingJournalEntriesModule({ initialView = "posting" }: { initialView?: Tab }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>(initialView);
  const [lookups, setLookups] = React.useState<Lookups | null>(null);
  const [initialError, setInitialError] = React.useState("");
  const [lookupRevision, setLookupRevision] = React.useState(0);
  const [period, setPeriod] = React.useState<AjePeriod | null>(null);
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("All");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [division, setDivision] = React.useState("all");
  const [department, setDepartment] = React.useState("all");
  const [accountType, setAccountType] = React.useState("");
  const [sort, setSort] = React.useState("transactionDate,desc");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [entries, setEntries] = React.useState<AdjustingEntry[]>([]);
  const [summary, setSummary] = React.useState(emptySummary);
  const [totalPages, setTotalPages] = React.useState(0);
  const [totalElements, setTotalElements] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const [editorEntry, setEditorEntry] = React.useState<AdjustingEntry | null>(null);
  const [editorSeed, setEditorSeed] = React.useState<AdjustingEntryPayload | null>(null);
  const [editorKey, setEditorKey] = React.useState(0);
  const [readOnly, setReadOnly] = React.useState(false);
  const [editorReturnTab, setEditorReturnTab] = React.useState<EntryListTab | null>(null);
  const [action, setAction] = React.useState<{ entry: AdjustingEntry; action: AjeAction } | null>(null);
  const [reason, setReason] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reversal, setReversal] = React.useState<AjeReversalPreview | null>(null);
  const commandLock = React.useRef(false);
  const requestGeneration = React.useRef(0);
  const handledIntent = React.useRef("");
  const query = React.useMemo<AdjustingEntryQuery>(() => ({ page,pageSize,search,status,startDate,endDate,divisionId: division === "all" ? null : Number(division),departmentId: department === "all" ? null : Number(department),accountTypeId: accountType ? Number(accountType) : null,sort }), [page,pageSize,search,status,startDate,endDate,division,department,accountType,sort]);

  React.useEffect(() => {
    let active = true;
    Promise.all([api.access(),api.accounts(),fetchDepartmentOptions(),fetchDivisionOptions(),api.period()])
      .then(([access,accounts,departments,divisions,cutoff]) => { if (active) { setLookups({ access,accounts,departments,divisions }); setPeriod(cutoff); setInitialError(""); } })
      .catch(e => { if (active) setInitialError(e instanceof Error ? e.message : "Unable to load Adjusting Entries"); });
    return () => { active = false; };
  }, [lookupRevision]);

  const reload = React.useCallback(async () => {
    if (!lookups) return;
    const generation = ++requestGeneration.current;
    setLoading(true);
    try {
      const [list,counts] = await Promise.all([api.list(query),api.summary(query)]);
      if (generation !== requestGeneration.current) return;
      setEntries(list.content); setTotalPages(list.totalPages); setTotalElements(list.totalElements); setSummary(counts); setError("");
    } catch (e) { if (generation === requestGeneration.current) setError(e instanceof Error ? e.message : "Unable to load adjusting entries"); }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [lookups,query]);

  React.useEffect(() => {
    const timer = setTimeout(() => void reload(),250);
    return () => { clearTimeout(timer); };
  }, [reload,revision]);

  React.useEffect(() => {
    if (!lookups) return;
    const id = searchParams.get("editAjeId");
    const source = searchParams.get("sourceJeNo");
    const intent = id || source || "";
    if (!intent || handledIntent.current === intent) return;
    handledIntent.current = intent;
    let active = true;
    const load = id ? api.get(Number(id)).then(entry => {
      if (active) { setEditorEntry(entry); setEditorSeed(null); setEditorReturnTab(initialView === "posting" || initialView === "summary" ? initialView : null); setReadOnly(searchParams.get("mode") === "view" || entry.status !== "Draft"); setEditorKey(k => k + 1); setTab("new"); }
    }) : api.sourceJournalEntry(source!).then(original => {
      if (active) {
        setEditorEntry(null); setEditorReturnTab(null); setReadOnly(false); setEditorSeed({ reference:original.transactionRef || original.jeNo,transactionDate:todayManila(),description:`Adjustment for ${original.jeNo}: ${original.description || ""}`,divisionId:null,departmentId:null,sourceJeNo:original.jeNo,details:original.details.filter(d => d.coaId != null).map(d => ({ coaId:d.coaId!,debit:d.debit,credit:d.credit,departmentId:d.departmentId ?? null })) });
        setEditorKey(k => k + 1); setTab("new");
      }
    });
    load.catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to open linked adjusting entry"); });
    return () => { active = false; };
  }, [initialView,lookups,searchParams]);

  function returnToEntryList() {
    if (!editorReturnTab) return;
    setTab(editorReturnTab);
    setEditorReturnTab(null);
    setEditorEntry(null);
    setEditorSeed(null);
    setReadOnly(false);
  }
  function requestAction(entry: AdjustingEntry, name: AjeAction) { setAction({ entry,action:name }); setReason(""); setActionError(""); }
  async function view(entry: AdjustingEntry, edit: boolean) {
    try { setEditorEntry(await api.get(entry.id)); setEditorSeed(null); setEditorReturnTab(tab === "posting" || tab === "summary" ? tab : null); setReadOnly(!edit || entry.status !== "Draft" || entry.entryOrigin !== "MANUAL"); setEditorKey(k => k + 1); setTab("new"); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to open this entry"); }
  }
  async function runAction(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!action || commandLock.current) return;
    if (reasonRequired.has(action.action) && !reason.trim()) { setActionError("A reason is required."); return; }
    commandLock.current = true; setBusy(true); setActionError("");
    try {
      const updated = await api.command(action.entry.id,action.action,action.entry.version,reason.trim() || undefined);
      setAction(null); setRevision(v => v + 1); toast.success(`${actionLabels[action.action]} completed`);
      if (editorEntry?.id === updated.id || tab === "new") { setEditorEntry(updated); setEditorSeed(null); setReadOnly(updated.status !== "Draft"); setEditorKey(k => k + 1); }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "The action failed");
      setRevision(v => v + 1);
      try {
        const latest = await api.get(action.entry.id);
        setAction(current => current ? { ...current, entry: latest,
          action: latest.status === "Failed" && ["post","retry"].includes(current.action) ? "retry" : current.action } : null);
        if (editorEntry?.id === latest.id || tab === "new") {
          setEditorEntry(latest); setReadOnly(latest.status !== "Draft"); setEditorKey(k => k + 1);
        }
      } catch { /* Keep the original error if the service is unavailable. */ }
    }
    finally { commandLock.current = false; setBusy(false); }
  }
  async function previewReversal(entry: AdjustingEntry) {
    try { setReversal(await api.reversalPreview(entry.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare a reversal"); }
  }
  function createReversal(mode: "FULL" | "PARTIAL") {
    if (!reversal) return;
    const original = reversal.original;
    setEditorSeed({ reference:`REV-${original.reference || original.jeNo}`.slice(0,255),transactionDate:todayManila(),description:`Reversal of ${original.jeNo}: ${original.description}`,divisionId:original.divisionId,departmentId:null,sourceJeNo:original.jeNo,entryKind:"REVERSAL",originalEntryId:original.id,reversalMode:mode,
      details:reversal.lines.filter(d => d.remainingAmount > 0).map(d => ({ coaId:d.coaId,departmentId:d.departmentId,description:d.description || "",originalDetailId:d.originalDetailId,debit:d.originalCredit > 0 ? d.remainingAmount : 0,credit:d.originalDebit > 0 ? d.remainingAmount : 0 })) });
    setEditorEntry(null); setEditorReturnTab(null); setReadOnly(false); setEditorKey(k => k + 1); setReversal(null); setTab("new");
  }
  function clearFilters() { setSearch("");setStatus("All");setStartDate("");setEndDate("");setDivision("all");setDepartment("all");setAccountType("");setPage(0); }
  const hasFilters = Boolean(search || status !== "All" || startDate || endDate || division !== "all" || department !== "all" || accountType);
  const accountTypes = React.useMemo(() => [...new Map((lookups?.accounts || []).filter(a => a.accountTypeId).map(a => [a.accountTypeId,{ id:a.accountTypeId!,name:a.accountTypeName || "Other" }])).values()], [lookups]);
  const pageHeader = <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <h1 className="text-xl font-semibold">{initialView === "posting" ? "Posting of Entries" : initialView === "new" ? "New Adjusting Entry" : initialView === "audit" ? "Audit Trail" : "Summary"}</h1>
    <p className="text-sm text-muted-foreground">{initialView === "posting" ? "Review adjusting entries and process approvals and postings." : initialView === "new" ? "Prepare a balanced adjustment and submit it for review." : initialView === "audit" ? "Chronological journal actions, revisions, supporting files, and period controls." : "Review adjusting entry workflow totals and journal activity."}</p>
    {(initialView === "posting" || initialView === "new") && <p className="mt-1 text-xs text-muted-foreground">Closed through: {period?.closedThroughDate ? formatDate(period.closedThroughDate) : "No cutoff set"}</p>}
  </div><div className="flex flex-wrap gap-2">
    {initialView === "posting" && <><Button variant="outline" onClick={() => setRevision(v => v + 1)}>Refresh</Button><Button variant="outline" disabled={!period} onClick={() => setPeriodOpen(true)}>Period controls</Button></>}
    {(initialView === "audit" || initialView === "summary") && <Button variant="outline" onClick={() => setRevision(v => v + 1)}>Refresh</Button>}
  </div></div>;

  if (initialError) return <div className="space-y-5 p-4 sm:p-6">{pageHeader}<div className="space-y-3"><p role="alert" className="text-destructive">{initialError}</p><Button variant="outline" onClick={() => setLookupRevision(v => v + 1)}>Retry</Button></div></div>;
  if (!lookups) return <div className="space-y-5 p-4 text-muted-foreground sm:p-6">{pageHeader}<p>Loading Adjusting Entries…</p></div>;
  return <div className="space-y-5 p-4 sm:p-6">
    {pageHeader}
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {tab === "new" && <>
      {editorReturnTab && <div className="flex justify-start"><Button type="button" variant="outline" onClick={returnToEntryList}>{editorReturnTab === "posting" ? "Back to postings" : "Back to summary"}</Button></div>}
      <AjeEntryEditor key={editorKey} initialEntry={editorEntry} seed={editorSeed} readOnly={readOnly} hideTitle={initialView === "new"} access={lookups.access} accounts={lookups.accounts} departments={lookups.departments} divisions={lookups.divisions} onSaved={() => setRevision(v => v + 1)} onAction={requestAction} />
    </>}
    {tab === "audit" && <AjeAuditTrail revision={revision} />}
    {(tab === "posting" || tab === "summary") && <>
      <AdjustingEntriesSummaryCards summary={summary} />
      <AdjustingEntriesFilters search={search} startDate={startDate} endDate={endDate} status={status} pageSize={pageSize} filterDivisionId={division} filterDepartmentId={department} statusOptions={statuses} pageSizes={[10,20,50,100]}
        filterDivisionOptions={[{ value:"all",label:"All divisions" },...lookups.divisions.map(d => ({ value:String(d.id),label:d.name }))]}
        filterDepartmentOptions={[{ value:"all",label:"All departments" },...lookups.departments.filter(d => division === "all" || !d.parentDivision || String(d.parentDivision) === division).map(d => ({ value:String(d.id),label:d.name }))]}
        hasActiveFilters={hasFilters} onSearchChange={v => {setSearch(v);setPage(0);}} onStartDateChange={v => {setStartDate(v);setPage(0);}} onEndDateChange={v => {setEndDate(v);setPage(0);}}
        onStatusChange={v => {setStatus(v);setPage(0);}} onPageSizeChange={v => {setPageSize(v);setPage(0);}} onDivisionChange={v => {setDivision(v);setDepartment("all");setPage(0);}} onDepartmentChange={v => {setDepartment(v);setPage(0);}} onClearFilters={clearFilters} />
      <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="aje-account-type">Account type</Label><select id="aje-account-type" className="h-9 rounded-md border bg-background px-3 text-sm" value={accountType} onChange={e => {setAccountType(e.target.value);setPage(0);}}><option value="">All account types</option>{accountTypes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="aje-sort">Sort</Label><select id="aje-sort" className="h-9 rounded-md border bg-background px-3 text-sm" value={sort} onChange={e => {setSort(e.target.value);setPage(0);}}><option value="transactionDate,desc">Accounting date: newest</option><option value="transactionDate,asc">Accounting date: oldest</option><option value="id,desc">Newest created</option><option value="jeNo,asc">Journal number</option><option value="status,asc">Status</option></select></div>
        {initialView === "summary" && <><a className="rounded-md border bg-background px-3 py-2 text-sm" href={ajeReportUrl(query,"csv")}>Export CSV</a><a className="rounded-md border bg-background px-3 py-2 text-sm" href={ajeReportUrl(query,"html")} target="_blank" rel="noreferrer">Print summary</a></>}
      </div>
      <AdjustingEntriesTable entries={entries} loading={loading} userId={lookups.access.userId} readOnly={tab === "summary"} onView={(entry,edit) => void view(entry,edit)} onAction={requestAction} onReverse={entry => void previewReversal(entry)} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{totalElements} entries · Page {totalPages ? page + 1 : 0} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={loading || page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></div>
    </>}
    {periodOpen && period && <AjePeriodDialog period={period} onClose={() => setPeriodOpen(false)} onSaved={value => {setPeriod(value);setRevision(v => v + 1);}} />}
    <AlertDialog open={action !== null} onOpenChange={open => { if (!open && !busy) setAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{action ? `${actionLabels[action.action]} ${action.entry.jeNo}?` : "Confirm action"}</AlertDialogTitle><AlertDialogDescription>{action?.action === "post" || action?.action === "retry" ? "This commits the approved entry to the General Ledger. Posted entries are read-only." : "This action updates the journal workflow and records an audit event."}</AlertDialogDescription></AlertDialogHeader>
      {action && <div className="text-sm">Debit {money(action.entry.totalDebit)} · Credit {money(action.entry.totalCredit)}</div>}
      {action && reasonRequired.has(action.action) && <div className="space-y-1"><Label htmlFor="aje-action-reason">Reason *</Label><Textarea id="aje-action-reason" maxLength={4000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div>}
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => void runAction(event)}>{busy ? "Working…" : action ? actionLabels[action.action] : "Confirm"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
    <Dialog open={reversal !== null} onOpenChange={open => {if (!open) setReversal(null);}}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Reverse {reversal?.original.jeNo}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Posted reversals consume the eligible amounts of the original lines. The new reversal requires separate approval before posting.</p>
      <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Account</th><th className="p-2 text-right">Original</th><th className="p-2 text-right">Reversed</th><th className="p-2 text-right">Remaining</th></tr></thead><tbody>{reversal?.lines.map(d => <tr key={d.originalDetailId} className="border-t"><td className="p-2">{d.accountNumber} · {d.accountTitle}<p className="text-xs text-muted-foreground">{d.departmentName}</p></td><td className="p-2 text-right">{money(d.originalDebit + d.originalCredit)}</td><td className="p-2 text-right">{money(d.reversedAmount)}</td><td className="p-2 text-right">{money(d.remainingAmount)}</td></tr>)}</tbody></table></div>
      <DialogFooter><Button variant="outline" onClick={() => setReversal(null)}>Cancel</Button><Button variant="outline" disabled={!reversal?.lines.some(d => d.remainingAmount > 0)} onClick={() => createReversal("PARTIAL")}>Partial / remaining reversal</Button><Button disabled={!reversal?.canFullReverse} onClick={() => createReversal("FULL")}>Full reversal</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
