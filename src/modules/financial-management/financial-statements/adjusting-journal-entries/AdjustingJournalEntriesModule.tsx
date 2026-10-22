"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdjustingEntriesFilters } from "./components/AdjustingEntriesFilters";
import { AdjustingEntriesTable, actionLabelForEntry, availableActions, isSelfApproval } from "./components/AdjustingEntriesTable";
import { AdjustingEntriesSummaryCards } from "./components/AdjustingEntriesSummaryCards";
import { AjePeriodDialog } from "./components/AjePeriodDialog";
import { AjeEntryEditorSkeleton } from "./components/AjeEntryEditorSkeleton";
import { formatDate, money, todayManila } from "./components/formatters";
import { adjustingJournalEntriesApi as api, ajeReportUrl, fetchDepartmentOptions, fetchDivisionOptions } from "./services/adjusting-journal-entries.api";
import type { AdjustingEntry, AdjustingEntryPayload, AdjustingEntryQuery, AdjustingEntrySummary, AdjustingEntrySummaryQuery, AjeAccess, AjeAccount, AjeAction, AjeAttachment, AjeAuditEvent, AjePeriod, AjeReversalPreview, DepartmentLookup, DivisionLookup } from "./types";

const AjeEntryEditor = React.lazy(() => import("./components/AjeEntryEditor").then(module => ({ default:module.AjeEntryEditor })));
const AjeReviewDialog = React.lazy(() => import("./components/AjeReviewDialog").then(module => ({ default:module.AjeReviewDialog })));
const AjeAuditTrail = React.lazy(() => import("./components/AjeAuditTrail").then(module => ({ default:module.AjeAuditTrail })));

type Tab = "new" | "posting" | "audit" | "summary";
type EntryListTab = Extract<Tab, "posting" | "summary">;
type PostingQueue = "all" | "needs-action" | "submitted" | "approved" | "failed";
type CatalogLookups = { accounts: AjeAccount[]; departments: DepartmentLookup[]; divisions: DivisionLookup[] };
const statuses = ["All","Draft","Submitted","Approved","Rejected","Posted","Cancelled","Failed","Voided"];
const queueValues: PostingQueue[] = ["all","needs-action","submitted","approved","failed"];
const pageSizes = [10,20,50,100];
const sortValues = ["lastActivity,desc","transactionDate,desc","transactionDate,asc","id,desc","jeNo,asc","status,asc"];
const emptySummary: AdjustingEntrySummary = { draft:0, submitted:0, approved:0, posted:0, rejected:0, cancelled:0, failed:0, voided:0, imbalanced:0, totalRecords:0, postedDebit:0, postedCredit:0 };
const reasonRequired = new Set<AjeAction>(["reject","cancel"]);

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)) ? value : "";
}

function positiveId(value: string | null) {
  return value && /^\d+$/.test(value) && Number(value) > 0 ? value : "";
}

function pageNumber(value: string | null) {
  return value && /^\d+$/.test(value) ? Math.max(0, Number(value)) : 0;
}

async function loadEntryAuditEvents(entryId: number): Promise<AjeAuditEvent[]> {
  const pageSize = 100;
  const firstPage = await api.audit(new URLSearchParams({ entryId:String(entryId),page:"0",size:String(pageSize) }));
  const events = [...firstPage.content];
  for (let page = 1; page < firstPage.totalPages; page++) {
    const result = await api.audit(new URLSearchParams({ entryId:String(entryId),page:String(page),size:String(pageSize) }));
    events.push(...result.content);
  }
  return events.sort((a,b) => a.occurredAt.localeCompare(b.occurredAt) || a.id - b.id);
}

function parseListFilters(params: URLSearchParams) {
  const status = params.get("status") || "All";
  const pageSize = Number(params.get("pageSize"));
  const sort = params.get("sort") || "lastActivity,desc";
  const queue = params.get("queue");
  return {
    search: params.get("search") || "",
    status: statuses.includes(status) ? status : "All",
    startDate: validDate(params.get("startDate")),
    endDate: validDate(params.get("endDate")),
    division: positiveId(params.get("divisionId")) || "all",
    department: positiveId(params.get("departmentId")) || "all",
    accountType: positiveId(params.get("accountTypeId")),
    sort: sortValues.includes(sort) ? sort : "lastActivity,desc",
    page: pageNumber(params.get("page")),
    pageSize: pageSizes.includes(pageSize) ? pageSize : 20,
    queue: queue && queueValues.includes(queue as PostingQueue) ? queue as PostingQueue : null,
  };
}

export function AdjustingJournalEntriesModule({ initialView = "posting" }: { initialView?: Tab }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParamText = searchParams.toString();
  const latestSearchParams = React.useRef(searchParamText);
  const listFilters = React.useMemo(() => parseListFilters(new URLSearchParams(searchParamText)), [searchParamText]);
  const [tab, setTab] = React.useState<Tab>(initialView);
  const [access, setAccess] = React.useState<AjeAccess | null>(null);
  const [catalogs, setCatalogs] = React.useState<CatalogLookups | null>(null);
  const [accessError, setAccessError] = React.useState("");
  const [catalogsError, setCatalogsError] = React.useState("");
  const [periodError, setPeriodError] = React.useState("");
  const [lookupRevision, setLookupRevision] = React.useState(0);
  const [period, setPeriod] = React.useState<AjePeriod | null>(null);
  const [accessLoading, setAccessLoading] = React.useState(initialView === "new" || initialView === "posting");
  const [catalogsLoading, setCatalogsLoading] = React.useState(initialView !== "audit");
  const [periodLoading, setPeriodLoading] = React.useState(initialView === "new" || initialView === "posting");
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [savedPostingQueue, setSavedPostingQueue] = React.useState<PostingQueue | null>(null);
  const [queuePreferenceLoaded, setQueuePreferenceLoaded] = React.useState(false);
  const [entries, setEntries] = React.useState<AdjustingEntry[]>([]);
  const [summary, setSummary] = React.useState(emptySummary);
  const [totalPages, setTotalPages] = React.useState(0);
  const [totalElements, setTotalElements] = React.useState(0);
  const [listLoading, setListLoading] = React.useState(initialView === "posting" || initialView === "summary");
  const [summaryLoading, setSummaryLoading] = React.useState(initialView === "posting" || initialView === "summary");
  const [listError, setListError] = React.useState("");
  const [summaryError, setSummaryError] = React.useState("");
  const [error, setError] = React.useState("");
  const [listRevision, setListRevision] = React.useState(0);
  const [summaryRevision, setSummaryRevision] = React.useState(0);
  const [auditRevision, setAuditRevision] = React.useState(0);
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
  const [reviewEntry, setReviewEntry] = React.useState<AdjustingEntry | null>(null);
  const [reviewDetails, setReviewDetails] = React.useState<AdjustingEntry | null>(null);
  const [reviewAttachments, setReviewAttachments] = React.useState<AjeAttachment[]>([]);
  const [reviewAuditEvents, setReviewAuditEvents] = React.useState<AjeAuditEvent[]>([]);
  const [reviewAuditLoading, setReviewAuditLoading] = React.useState(false);
  const [reviewAuditError, setReviewAuditError] = React.useState("");
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [reviewAttachmentsLoading, setReviewAttachmentsLoading] = React.useState(false);
  const [reviewError, setReviewError] = React.useState("");
  const [reviewAttachmentsError, setReviewAttachmentsError] = React.useState("");
  const [selectedApprovalIds, setSelectedApprovalIds] = React.useState<Set<number>>(() => new Set());
  const [bulkConfirmEntries, setBulkConfirmEntries] = React.useState<AdjustingEntry[] | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkResult, setBulkResult] = React.useState<{ approved: number; failures: Array<{ jeNo: string; message: string }> } | null>(null);
  const commandLock = React.useRef(false);
  const reviewRequestGeneration = React.useRef(0);
  const reviewAuditRequestGeneration = React.useRef(0);
  const editorDirtyRef = React.useRef(false);
  const handledIntent = React.useRef("");
  const searchCommitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = listFilters.search;
  const normalizedSearch = search.trim();
  const [searchDraft, setSearchDraft] = React.useState(search);
  const postingQueue = listFilters.queue || (initialView === "posting" && listFilters.status !== "All" ? "all" : savedPostingQueue || "needs-action");
  const status = initialView === "posting" && postingQueue !== "all" ? "All" : listFilters.status;
  const startDate = listFilters.startDate;
  const endDate = listFilters.endDate;
  const division = listFilters.division;
  const department = listFilters.department;
  const accountType = listFilters.accountType;
  const sort = listFilters.sort;
  const page = listFilters.page;
  const pageSize = listFilters.pageSize;
  const divisionId = division === "all" ? null : Number(division);
  const departmentId = department === "all" ? null : Number(department);
  const accountTypeId = accountType ? Number(accountType) : null;
  const query = React.useMemo<AdjustingEntryQuery>(() => ({ page,pageSize,search:normalizedSearch || undefined,status,startDate,endDate,divisionId,departmentId,accountTypeId,sort }), [page,pageSize,normalizedSearch,status,startDate,endDate,divisionId,departmentId,accountTypeId,sort]);
  const summaryQuery = React.useMemo<AdjustingEntrySummaryQuery>(() => ({ search:normalizedSearch || undefined,startDate,endDate,divisionId,departmentId,accountTypeId }), [normalizedSearch,startDate,endDate,divisionId,departmentId,accountTypeId]);
  const listQuery = React.useMemo<AdjustingEntryQuery>(() => {
    if (initialView !== "posting" || postingQueue === "all") return query;
    const queueStatus = postingQueue === "needs-action" ? "Needs action" : postingQueue === "submitted" ? "Submitted" : postingQueue === "approved" ? "Approved" : "Failed";
    return { ...query, status:queueStatus };
  }, [initialView,postingQueue,query]);
  const hasEntryList = initialView === "posting" || initialView === "summary";
  const listViewActive = hasEntryList && tab === initialView;

  React.useEffect(() => {
    setSelectedApprovalIds(new Set());
    setBulkResult(null);
  }, [tab,page,pageSize,search,status,startDate,endDate,division,department,accountType,postingQueue]);

  React.useEffect(() => {
    if (!access) return;
    const eligibleIds = new Set(entries.filter(entry => entry.entryOrigin === "MANUAL" && availableActions(entry).includes("approve") && !isSelfApproval(entry, access.userId)).map(entry => entry.id));
    setSelectedApprovalIds(current => new Set([...current].filter(id => eligibleIds.has(id))));
  }, [entries, access]);

  React.useEffect(() => { latestSearchParams.current = searchParamText; }, [searchParamText]);

  const updateListQuery = React.useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(latestSearchParams.current);
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const queryString = params.toString();
    latestSearchParams.current = queryString;
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll:false });
  }, [pathname, router]);

  const updateFilters = React.useCallback((updates: Record<string, string | null>) => {
    updateListQuery({ ...updates, page:"0" });
  }, [updateListQuery]);

  const cancelPendingSearchCommit = React.useCallback(() => {
    if (searchCommitTimer.current) clearTimeout(searchCommitTimer.current);
    searchCommitTimer.current = null;
  }, []);

  const handleSearchChange = React.useCallback((value: string) => {
    setSearchDraft(value);
    cancelPendingSearchCommit();
    searchCommitTimer.current = setTimeout(() => {
      searchCommitTimer.current = null;
      updateFilters({ search:value || null });
    }, 250);
  }, [cancelPendingSearchCommit,updateFilters]);

  React.useEffect(() => { setSearchDraft(search); }, [search]);

  React.useEffect(() => {
    const syncSearchFromLocation = () => {
      cancelPendingSearchCommit();
      setSearchDraft(parseListFilters(new URLSearchParams(window.location.search)).search);
    };
    window.addEventListener("popstate", syncSearchFromLocation);
    return () => window.removeEventListener("popstate", syncSearchFromLocation);
  }, [cancelPendingSearchCommit]);

  React.useEffect(() => () => cancelPendingSearchCommit(), [cancelPendingSearchCommit]);

  function selectPostingQueue(value: PostingQueue) {
    if (access) {
      try { window.localStorage.setItem(`aje-posting-queue:${access.userId}`, value); } catch { /* Storage can be unavailable in private contexts. */ }
    }
    setSavedPostingQueue(value);
    updateListQuery({ queue:value, status:null, page:"0" });
  }

  React.useEffect(() => {
    let active = true;
    const needsAccess = initialView === "new" || initialView === "posting";
    const needsCatalogs = initialView !== "audit";
    const needsPeriod = initialView === "new" || initialView === "posting";

    if (needsAccess) {
      setAccessLoading(true);
      setAccessError("");
      api.access().then(value => { if (active) setAccess(value); })
        .catch(e => { if (active) { setAccessError(e instanceof Error ? e.message : "Unable to load AJE permissions"); if (initialView === "posting") setQueuePreferenceLoaded(true); } })
        .finally(() => { if (active) setAccessLoading(false); });
    }
    if (needsCatalogs) {
      setCatalogsLoading(true);
      setCatalogsError("");
      Promise.all([api.accounts(),fetchDepartmentOptions(),fetchDivisionOptions()])
        .then(([accounts,departments,divisions]) => { if (active) setCatalogs({ accounts,departments,divisions }); })
        .catch(e => { if (active) setCatalogsError(e instanceof Error ? e.message : "Unable to load AJE lookup options"); })
        .finally(() => { if (active) setCatalogsLoading(false); });
    }
    if (needsPeriod) {
      setPeriodLoading(true);
      setPeriodError("");
      api.period().then(value => { if (active) setPeriod(value); })
        .catch(e => { if (active) setPeriodError(e instanceof Error ? e.message : "Unable to load the accounting period cutoff"); })
        .finally(() => { if (active) setPeriodLoading(false); });
    }
    return () => { active = false; };
  }, [initialView,lookupRevision]);

  React.useEffect(() => {
    if (initialView !== "posting" || !access || queuePreferenceLoaded) return;
    let saved: PostingQueue | null = listFilters.queue;
    if (!saved) {
      try {
        const stored = window.localStorage.getItem(`aje-posting-queue:${access.userId}`);
        if (stored && queueValues.includes(stored as PostingQueue)) saved = stored as PostingQueue;
      } catch { /* Storage can be unavailable in private contexts. */ }
    }
    setSavedPostingQueue(saved || "all");
    setQueuePreferenceLoaded(true);
  }, [access,initialView,listFilters.queue,queuePreferenceLoaded]);

  React.useEffect(() => {
    if (initialView === "posting" && queuePreferenceLoaded) {
      if (!listFilters.queue) updateListQuery({ queue:postingQueue });
      else if (postingQueue !== "all" && listFilters.status !== "All") updateListQuery({ status:null });
    }
  }, [initialView, listFilters.queue, listFilters.status, postingQueue, queuePreferenceLoaded, updateListQuery]);

  React.useEffect(() => {
    if (!listViewActive || (initialView === "posting" && !queuePreferenceLoaded)) {
      setListLoading(false);
      return;
    }
    const controller = new AbortController();
    setListLoading(true);
    setListError("");
    void api.list(listQuery, controller.signal)
      .then(list => {
        if (controller.signal.aborted) return;
        setEntries(list.content);
        setTotalPages(list.totalPages);
        setTotalElements(list.totalElements);
      })
      .catch(e => { if (!controller.signal.aborted) setListError(e instanceof Error ? e.message : "Unable to load adjusting entries"); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [initialView,listViewActive,queuePreferenceLoaded,listQuery,listRevision]);

  React.useEffect(() => {
    if (!listViewActive) {
      setSummaryLoading(false);
      return;
    }
    const controller = new AbortController();
    setSummaryLoading(true);
    setSummaryError("");
    void api.summary(summaryQuery, controller.signal)
      .then(counts => { if (!controller.signal.aborted) setSummary(counts); })
      .catch(e => { if (!controller.signal.aborted) setSummaryError(e instanceof Error ? e.message : "Unable to load adjusting entry summary"); })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [listViewActive,summaryQuery,summaryRevision]);

  function refreshEntriesAndSummary() {
    setListRevision(value => value + 1);
    setSummaryRevision(value => value + 1);
  }

  function handleEditorSaved(saveCompleted: boolean) {
    refreshEntriesAndSummary();
    if (initialView === "new" && saveCompleted) {
      setEditorEntry(null);
      setEditorSeed(null);
      setEditorReturnTab(null);
      setReadOnly(false);
      setEditorKey(key => key + 1);
    }
  }

  React.useEffect(() => {
    if (!access) return;
    const id = initialView === "posting" ? searchParams.get("editAjeId") : null;
    const source = initialView === "new" ? searchParams.get("sourceJeNo") : null;
    const intent = id || source || "";
    if (!intent || handledIntent.current === intent) return;
    handledIntent.current = intent;
    let active = true;
    const load = id ? api.get(Number(id)).then(entry => {
     if (active) { setEditorEntry(entry); setEditorSeed(null); setEditorReturnTab(initialView === "posting" || initialView === "summary" ? initialView : null); setReadOnly(searchParams.get("mode") === "view" || entry.status !== "Draft" || entry.creatorId !== access.userId); setEditorKey(k => k + 1); setTab("new"); }
    }) : api.sourceJournalEntry(source!).then(original => {
      if (active) {
        setEditorEntry(null); setEditorReturnTab(null); setReadOnly(false); setEditorSeed({ reference:original.transactionRef || original.jeNo,transactionDate:todayManila(),description:`Adjustment for ${original.jeNo}: ${original.description || ""}`,divisionId:null,departmentId:null,sourceJeNo:original.jeNo,details:original.details.filter(d => d.coaId != null).map(d => ({ coaId:d.coaId!,debit:d.debit,credit:d.credit,departmentId:d.departmentId ?? null })) });
        setEditorKey(k => k + 1); setTab("new");
      }
    });
    load.catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to open linked adjusting entry"); });
    return () => { active = false; };
  }, [access,initialView,searchParams]);

  function returnToEntryList() {
    if (!editorReturnTab) return;
    if (editorDirtyRef.current && !window.confirm("You have unsaved changes. Leave this adjusting entry without saving?")) return;
    editorDirtyRef.current = false;
    setTab(editorReturnTab);
    setEditorReturnTab(null);
    setEditorEntry(null);
    setEditorSeed(null);
    setReadOnly(false);
  }
  function requestAction(entry: AdjustingEntry, name: AjeAction) { if (commandLock.current || bulkBusy) return; setAction({ entry,action:name }); setReason(""); setActionError(""); }
  function toggleApprovalSelection(entryId: number, selected: boolean) {
    setSelectedApprovalIds(current => { const next = new Set(current); if (selected) next.add(entryId); else next.delete(entryId); return next; });
    setBulkResult(null);
  }
  function togglePageApprovalSelection(entryIds: number[], selected: boolean) {
    setSelectedApprovalIds(current => { const next = new Set(current); for (const id of entryIds) { if (selected) next.add(id); else next.delete(id); } return next; });
    setBulkResult(null);
  }
  function requestBulkApproval(selected: AdjustingEntry[]) {
    if (!selected.length || commandLock.current || busy || bulkBusy) return;
    setBulkResult(null);
    setBulkConfirmEntries(selected);
  }
  async function refreshReviewAudit(entryId: number) {
    const generation = ++reviewAuditRequestGeneration.current;
    setReviewAuditLoading(true);
    setReviewAuditError("");
    try {
      const events = await loadEntryAuditEvents(entryId);
      if (generation === reviewAuditRequestGeneration.current) setReviewAuditEvents(events);
    } catch (e) {
      if (generation === reviewAuditRequestGeneration.current) setReviewAuditError(e instanceof Error ? e.message : "Unable to load the audit trail");
    } finally {
      if (generation === reviewAuditRequestGeneration.current) setReviewAuditLoading(false);
    }
  }
  async function runBulkApproval() {
    if (!bulkConfirmEntries?.length || commandLock.current) return;
    commandLock.current = true;
    setBulkBusy(true);
    const approved: number[] = [];
    const failures: Array<{ jeNo: string; message: string }> = [];
    try {
      for (const entry of bulkConfirmEntries) {
        try {
          const updated = await api.command(entry.id, "approve", entry.version);
          approved.push(entry.id);
          if (reviewEntry?.id === updated.id) { setReviewEntry(updated); setReviewDetails(updated); void refreshReviewAudit(updated.id); }
        } catch (e) {
          failures.push({ jeNo: entry.jeNo || `Entry #${entry.id}`, message: e instanceof Error ? e.message : "Approval failed" });
        }
      }
      setSelectedApprovalIds(current => new Set([...current].filter(id => !approved.includes(id))));
      setBulkConfirmEntries(null);
      setBulkResult({ approved: approved.length, failures });
      refreshEntriesAndSummary();
      if (failures.length) toast.error(`${approved.length} approved; ${failures.length} failed. Review the results below.`);
      else toast.success(`${approved.length} ${approved.length === 1 ? "entry" : "entries"} approved`);
    } finally {
      commandLock.current = false;
      setBulkBusy(false);
    }
  }
  async function view(entry: AdjustingEntry, edit: boolean) {
    try { const details = await api.get(entry.id); setEditorEntry(details); setEditorSeed(null); setEditorReturnTab(tab === "posting" || tab === "summary" ? tab : null); setReadOnly(!edit || details.status !== "Draft" || details.entryOrigin !== "MANUAL" || details.creatorId !== access?.userId); setEditorKey(k => k + 1); setTab("new"); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to open this entry"); }
  }
  function openReview(entry: AdjustingEntry) {
    const generation = ++reviewRequestGeneration.current;
    setReviewEntry(entry); setReviewDetails(null); setReviewAttachments([]); setReviewLoading(true); setReviewAttachmentsLoading(true); setReviewError(""); setReviewAttachmentsError("");
    setReviewAuditEvents([]); setReviewAuditError("");
    void refreshReviewAudit(entry.id);
    void api.get(entry.id).then(details => {
      if (generation === reviewRequestGeneration.current) setReviewDetails(details);
    }).catch(error => {
      if (generation === reviewRequestGeneration.current) setReviewError(error instanceof Error ? error.message : "Unable to load journal details");
    }).finally(() => {
      if (generation === reviewRequestGeneration.current) setReviewLoading(false);
    });
    void api.attachments(entry.id).then(attachments => {
      if (generation === reviewRequestGeneration.current) setReviewAttachments(attachments);
    }).catch(error => {
      if (generation === reviewRequestGeneration.current) setReviewAttachmentsError(error instanceof Error ? error.message : "Unable to load supporting documents");
    }).finally(() => {
      if (generation === reviewRequestGeneration.current) setReviewAttachmentsLoading(false);
    });
  }
  function closeReview() {
    reviewRequestGeneration.current += 1;
    reviewAuditRequestGeneration.current += 1;
    setReviewEntry(null); setReviewDetails(null); setReviewAttachments([]); setReviewLoading(false); setReviewAttachmentsLoading(false); setReviewError(""); setReviewAttachmentsError("");
    setReviewAuditEvents([]); setReviewAuditLoading(false); setReviewAuditError("");
  }
  async function runAction(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!action || commandLock.current) return;
    if (reasonRequired.has(action.action) && !reason.trim()) { setActionError("A reason is required."); return; }
    commandLock.current = true; setBusy(true); setActionError("");
    try {
      const updated = await api.command(action.entry.id,action.action,action.entry.version,reason.trim() || undefined);
      setAction(null); refreshEntriesAndSummary(); toast.success(`${actionLabelForEntry(action.entry, action.action)} completed · ${updated.jeNo || `Entry #${updated.id}`}`);
      if (reviewEntry?.id === updated.id) { setReviewEntry(updated); setReviewDetails(updated); void refreshReviewAudit(updated.id); }
      if (editorEntry?.id === updated.id || (initialView === "posting" && tab === "new")) { setEditorEntry(updated); setEditorSeed(null); setReadOnly(updated.status !== "Draft"); setEditorKey(k => k + 1); }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "The action failed");
      refreshEntriesAndSummary();
      try {
        const latest = await api.get(action.entry.id);
        setAction(current => current ? { ...current, entry: latest,
          action: latest.status === "Failed" && ["post","retry"].includes(current.action) ? "retry" : current.action } : null);
        if (reviewEntry?.id === latest.id) { setReviewEntry(latest); setReviewDetails(latest); void refreshReviewAudit(latest.id); }
        if (editorEntry?.id === latest.id || (initialView === "posting" && tab === "new")) {
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
    setEditorEntry(null); setEditorReturnTab("posting"); setReadOnly(false); setEditorKey(k => k + 1); setReversal(null); setTab("new");
  }
  function clearFilters() {
    cancelPendingSearchCommit();
    setSearchDraft("");
    if (initialView === "posting" && access) {
      try { window.localStorage.setItem(`aje-posting-queue:${access.userId}`, "all"); } catch { /* Storage can be unavailable in private contexts. */ }
      setSavedPostingQueue("all");
    }
    updateListQuery({ search:null,status:null,startDate:null,endDate:null,divisionId:null,departmentId:null,accountTypeId:null,sort:null,page:"0",pageSize:null,...(initialView === "posting" ? { queue:"all" } : {}) });
  }
  const focusPosted = () => updateFilters({ status:"Posted",queue:"all" });
  const focusDrafts = () => updateFilters({ status:"Draft",queue:"all" });
  const hasFilters = Boolean(searchDraft.trim() || status !== "All" || startDate || endDate || division !== "all" || department !== "all" || accountType || sort !== "lastActivity,desc" || page > 0 || pageSize !== 20 || (initialView === "posting" && postingQueue !== "all"));
  const summaryDateScope = startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : startDate ? `From ${formatDate(startDate)}` : endDate ? `Through ${formatDate(endDate)}` : "All dates";
  const accountTypes = React.useMemo(() => [...new Map((catalogs?.accounts || []).filter(a => a.accountTypeId).map(a => [a.accountTypeId,{ id:a.accountTypeId!,name:a.accountTypeName || "Other" }])).values()], [catalogs]);
  const lookupErrors = [accessError,catalogsError,periodError].filter(Boolean);
  const editorTitle = editorEntry ? (readOnly ? "View Adjusting Entry" : "Editing Adjusting Entry") : editorSeed?.entryKind === "REVERSAL" ? "New Reversal" : "New Adjusting Entry";
  const summaryPrintDisabled = listLoading || Boolean(listError) || searchDraft.trim() !== normalizedSearch;
  const pageHeader = <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <h1 className="text-xl font-semibold">{tab === "posting" ? "Posting of Entries" : tab === "new" ? editorTitle : tab === "audit" ? "Audit Trail" : "Summary"}</h1>
    <p className="text-sm text-muted-foreground">{tab === "posting" ? "Review adjusting entries and process approvals and postings." : tab === "new" ? editorEntry ? (readOnly ? "Review this adjusting entry." : "Update this existing draft adjusting entry.") : "Prepare a balanced adjustment and submit it for review." : tab === "audit" ? "Chronological journal actions, revisions, supporting files, and period controls." : "Review adjusting entry workflow totals and journal activity."}</p>
    {(tab === "posting" || tab === "new") && <p className="mt-1 text-xs text-muted-foreground">Closed through: {periodLoading ? "Loading cutoff…" : periodError ? "Unavailable" : period?.closedThroughDate ? formatDate(period.closedThroughDate) : "No cutoff set"}</p>}
  </div><div className="flex flex-wrap gap-2">
    {tab === "posting" && <><Button variant="outline" onClick={refreshEntriesAndSummary}>Refresh</Button><Button variant="outline" disabled={!period || periodLoading} onClick={() => setPeriodOpen(true)}>Period controls</Button></>}
    {tab === "summary" && <a className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent" href={ajeReportUrl(listQuery,"csv")}>Export CSV</a>}
    {(tab === "posting" || tab === "summary") && <Button variant="outline" disabled={summaryPrintDisabled} asChild><a href={ajeReportUrl(listQuery,"pdf")} target="_blank" rel="noopener noreferrer" aria-disabled={summaryPrintDisabled} onClick={event => { if (summaryPrintDisabled) event.preventDefault(); }}>Print summary</a></Button>}
    {(tab === "audit" || tab === "summary") && <Button variant="outline" onClick={() => tab === "audit" ? setAuditRevision(v => v + 1) : refreshEntriesAndSummary()}>Refresh</Button>}
  </div></div>;
  return <div className="space-y-5 p-4 sm:p-6">
    {pageHeader}
    {lookupErrors.length > 0 && tab !== "audit" && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><span>{lookupErrors.join(" · ")}</span><Button variant="outline" size="sm" onClick={() => { setAccess(null); setCatalogs(null); setPeriod(null); setSavedPostingQueue(null); setQueuePreferenceLoaded(false); setLookupRevision(value => value + 1); }}>Retry lookups</Button></div>}
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {listViewActive && listError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{listError}</div>}
    {listViewActive && summaryError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{summaryError}</div>}
    {tab === "new" && <>
      {editorReturnTab && <div className="flex justify-start"><Button type="button" variant="outline" onClick={returnToEntryList}>{editorReturnTab === "posting" ? "Back to postings" : "Back to summary"}</Button></div>}
      {(!access || !catalogs) ? (accessLoading || catalogsLoading ? <AjeEntryEditorSkeleton /> : <p role="status" className="text-sm text-muted-foreground">The entry form is unavailable until its required lookup data loads.</p>) : <React.Suspense fallback={<AjeEntryEditorSkeleton />}><AjeEntryEditor key={editorKey} initialEntry={editorEntry} seed={editorSeed} readOnly={readOnly} hideTitle={tab === "new"} dirtyRef={editorDirtyRef} access={access} accounts={catalogs.accounts} departments={catalogs.departments} divisions={catalogs.divisions} onSaved={handleEditorSaved} onAction={requestAction} /></React.Suspense>}
    </>}
    {tab === "audit" && <React.Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading audit trail…</p>}><AjeAuditTrail revision={auditRevision} /></React.Suspense>}
    {(tab === "posting" || tab === "summary") && <>
      {tab === "summary" && <AdjustingEntriesSummaryCards summary={summary} loading={summaryLoading} selectedStatus={status} onStatusSelect={value => updateFilters({ status:value === "All" ? null : value,queue:"all" })} showPostedAmounts onShowPosted={focusPosted} onInvestigatePosted={focusPosted} onShowUnbalancedDrafts={focusDrafts} />}
      {tab === "summary" && <p className="text-xs text-muted-foreground">Accounting dates: {summaryDateScope}. Counts and posted amounts also reflect the search, division, department, and account-type filters. Status filters narrow the journal list only.</p>}
      {tab === "posting" && <div className="flex flex-wrap items-center gap-2" aria-label="Posting queue view">
        {([
          ["all", "All statuses", summary.totalRecords],
          ["needs-action", "Needs action", summary.submitted + summary.approved + summary.failed],
          ["submitted", "Awaiting review", summary.submitted],
          ["approved", "Ready to post", summary.approved],
          ["failed", "Posting failed", summary.failed],
        ] as const).map(([value, label, count]) => <Button key={value} type="button" size="sm" aria-pressed={postingQueue === value && (value !== "all" || status === "All")} variant={postingQueue === value && (value !== "all" || status === "All") ? "default" : "outline"} onClick={() => selectPostingQueue(value)}>{label}<span className="ml-1 rounded-full bg-background/20 px-1.5 text-xs">{count}</span></Button>)}
      </div>}
      <AdjustingEntriesFilters search={searchDraft} startDate={startDate} endDate={endDate} status={status} pageSize={pageSize} filterDivisionId={division} filterDepartmentId={department} statusOptions={statuses} pageSizes={[10,20,50,100]}
        filterDivisionOptions={[{ value:"all",label:"All divisions" },...(catalogs?.divisions || []).map(d => ({ value:String(d.id),label:d.name }))]}
        filterDepartmentOptions={[{ value:"all",label:"All departments" },...(catalogs?.departments || []).filter(d => division === "all" || !d.parentDivision || String(d.parentDivision) === division).map(d => ({ value:String(d.id),label:d.name }))]}
        hasActiveFilters={hasFilters} moreFiltersCount={Number(division !== "all") + Number(department !== "all") + Number(Boolean(accountType))} onSearchChange={handleSearchChange} onStartDateChange={v => updateFilters({ startDate:v || null })} onEndDateChange={v => updateFilters({ endDate:v || null })}
        onStatusChange={v => updateFilters({ status:v === "All" ? null : v,queue:"all" })} onPageSizeChange={v => updateListQuery({ pageSize:String(v),page:"0" })} onDivisionChange={v => updateFilters({ divisionId:v === "all" ? null : v,departmentId:null })} onDepartmentChange={v => updateFilters({ departmentId:v === "all" ? null : v })} onClearFilters={clearFilters}>
        <div className="space-y-1.5"><Label htmlFor="aje-account-type" className="text-xs font-medium text-muted-foreground">Account type</Label><select id="aje-account-type" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={accountType} onChange={e => updateFilters({ accountTypeId:e.target.value || null })}><option value="">All account types</option>{accountTypes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="aje-sort" className="text-xs font-medium text-muted-foreground">Sort</Label><select id="aje-sort" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={sort} onChange={e => updateFilters({ sort:e.target.value === "lastActivity,desc" ? null : e.target.value })}><option value="lastActivity,desc">Last activity: newest</option><option value="transactionDate,desc">Accounting date: newest</option><option value="transactionDate,asc">Accounting date: oldest</option><option value="id,desc">Newest created</option><option value="jeNo,asc">Journal number</option><option value="status,asc">Status</option></select></div>
      </AdjustingEntriesFilters>
      <AdjustingEntriesTable entries={entries} loading={listLoading || busy || bulkBusy} userId={access?.userId} readOnly={tab === "summary" || !access} onView={(entry,edit) => { if ((initialView === "posting" || initialView === "summary") && !edit) void openReview(entry); else void view(entry,edit); }} onAction={requestAction} onReverse={entry => void previewReversal(entry)} bulkActionsEnabled={tab === "posting" && Boolean(access)} selectedEntryIds={selectedApprovalIds} onToggleEntrySelection={toggleApprovalSelection} onTogglePageSelection={togglePageApprovalSelection} onBulkApprove={requestBulkApproval} bulkBusy={bulkBusy} />
      {bulkResult && <div role="status" className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm"><p>{bulkResult.approved} approved · {bulkResult.failures.length} failed</p>{bulkResult.failures.length > 0 && <ul className="list-inside list-disc text-destructive">{bulkResult.failures.map(failure => <li key={failure.jeNo}><span className="font-medium">{failure.jeNo}:</span> {failure.message}</li>)}</ul>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{totalElements > 0 ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalElements)} of ${totalElements} entries · Page ${page + 1} of ${Math.max(totalPages, 1)}` : "0 entries"}</span><div className="flex gap-2"><Button variant="outline" size="icon-sm" aria-label="Go to first page" disabled={page === 0 || listLoading} onClick={() => updateListQuery({ page:"0" })}><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" disabled={page === 0 || listLoading} onClick={() => updateListQuery({ page:String(page - 1) })}>Previous</Button><Button variant="outline" size="sm" disabled={listLoading || page + 1 >= totalPages} onClick={() => updateListQuery({ page:String(page + 1) })}>Next</Button><Button variant="outline" size="icon-sm" aria-label="Go to last page" disabled={listLoading || page + 1 >= totalPages} onClick={() => updateListQuery({ page:String(Math.max(0, totalPages - 1)) })}><ChevronsRight className="h-4 w-4" /></Button></div></div>
    </>}
    {periodOpen && period && <AjePeriodDialog period={period} onClose={() => setPeriodOpen(false)} onSaved={value => setPeriod(value)} />}
    <AlertDialog open={action !== null} onOpenChange={open => { if (!open && !busy) setAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{action ? `${actionLabelForEntry(action.entry, action.action)} ${action.entry.jeNo}?` : "Confirm action"}</AlertDialogTitle><AlertDialogDescription>{action?.action === "cancel" && action.entry.canCancelAfterReversalConflict ? "This cancels the failed full reversal and preserves the AJE and its audit history. It will not be permanently deleted." : action?.action === "post" || action?.action === "retry" ? "This commits the approved entry to the General Ledger. Posted entries are read-only." : "This action updates the journal workflow and records an audit event."}</AlertDialogDescription></AlertDialogHeader>
      {action && <div className="text-sm">Debit {money(action.entry.totalDebit)} · Credit {money(action.entry.totalCredit)}</div>}
      {action && reasonRequired.has(action.action) && <div className="space-y-1"><Label htmlFor="aje-action-reason">Reason *</Label><Textarea id="aje-action-reason" maxLength={4000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div>}
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>{action?.action === "cancel" && action.entry.canCancelAfterReversalConflict ? "Keep AJE" : "Cancel"}</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => void runAction(event)}>{busy ? "Working…" : action ? actionLabelForEntry(action.entry, action.action) : "Confirm"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
    <AlertDialog open={bulkConfirmEntries !== null} onOpenChange={open => { if (!open && !bulkBusy) setBulkConfirmEntries(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Approve {bulkConfirmEntries?.length || 0} selected entries?</AlertDialogTitle><AlertDialogDescription>Each entry will be approved separately using its current version. Entries that fail will remain selected so you can review and retry them.</AlertDialogDescription></AlertDialogHeader>
      {bulkConfirmEntries && <div className="max-h-48 overflow-y-auto rounded-md border p-3 text-sm"><ul className="list-inside list-disc">{bulkConfirmEntries.map(entry => <li key={entry.id}>{entry.jeNo} · {money(entry.totalDebit)} debit / {money(entry.totalCredit)} credit</li>)}</ul></div>}
      <AlertDialogFooter><AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={bulkBusy || !bulkConfirmEntries?.length} onClick={event => { event.preventDefault(); void runBulkApproval(); }}>{bulkBusy ? "Approving…" : "Approve selected"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
    <Dialog open={reversal !== null} onOpenChange={open => {if (!open) setReversal(null);}}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Reverse {reversal?.original.jeNo}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Posted reversals consume the eligible amounts of the original lines. The new reversal requires separate approval before posting.</p>
      <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Account</th><th className="p-2 text-right">Original</th><th className="p-2 text-right">Reversed</th><th className="p-2 text-right">Remaining</th></tr></thead><tbody>{reversal?.lines.map(d => <tr key={d.originalDetailId} className="border-t"><td className="p-2">{d.accountNumber} · {d.accountTitle}<p className="text-xs text-muted-foreground">{d.departmentName}</p></td><td className="p-2 text-right">{money(d.originalDebit + d.originalCredit)}</td><td className="p-2 text-right">{money(d.reversedAmount)}</td><td className="p-2 text-right">{money(d.remainingAmount)}</td></tr>)}</tbody></table></div>
      <DialogFooter><Button variant="outline" onClick={() => setReversal(null)}>Cancel</Button><Button variant="outline" disabled={!reversal?.lines.some(d => d.remainingAmount > 0)} onClick={() => createReversal("PARTIAL")}>Partial / remaining reversal</Button><Button disabled={!reversal?.canFullReverse} onClick={() => createReversal("FULL")}>Full reversal</Button></DialogFooter>
    </DialogContent></Dialog>
    {(initialView === "posting" || initialView === "summary") && reviewEntry !== null && <React.Suspense fallback={<Dialog open onOpenChange={open => { if (!open) closeReview(); }}>
      <DialogContent className="sm:max-w-5xl"><DialogHeader><DialogTitle>{reviewEntry.jeNo || "Review adjusting entry"}</DialogTitle></DialogHeader>
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading review dialog…</p>
        <DialogFooter><Button type="button" variant="outline" onClick={closeReview}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>}><AjeReviewDialog open journalNumber={reviewEntry.jeNo || null} entry={reviewDetails} attachments={reviewAttachments} loading={reviewLoading} error={reviewError} attachmentsLoading={reviewAttachmentsLoading} attachmentsError={reviewAttachmentsError} auditEvents={reviewAuditEvents} auditLoading={reviewAuditLoading} auditError={reviewAuditError} canReview={tab === "posting" && Boolean(access)} userId={access?.userId} onAction={requestAction} onClose={closeReview} /></React.Suspense>}
  </div>;
}
