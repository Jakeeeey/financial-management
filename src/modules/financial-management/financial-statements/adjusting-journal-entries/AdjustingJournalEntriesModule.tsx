"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdjustingEntriesFilters } from "./components/AdjustingEntriesFilters";
import { AjeSearchableSelect } from "./components/AjeSearchableSelect";
import { actionRequiresReason, AdjustingEntriesTable, actionLabelForEntry } from "./components/AdjustingEntriesTable";
import { AdjustingEntriesSummaryCards } from "./components/AdjustingEntriesSummaryCards";
import { AjePeriodDialog } from "./components/AjePeriodDialog";
import { AjeEntryEditorSkeleton } from "./components/AjeEntryEditorSkeleton";
import { AjeDataFreshness, AjeRetryAlert } from "./components/AjeDataFreshness";
import { formatDate, money, todayManila } from "./components/formatters";
import { adjustingJournalEntriesApi as api, ajeReportUrl, fetchDepartmentOptions, fetchDivisionOptions } from "./services/adjusting-journal-entries.api";
import type { AdjustingEntry, AdjustingEntryPayload, AdjustingEntryQuery, AdjustingEntrySummary, AdjustingEntrySummaryQuery, AjeAccess, AjeAccount, AjeAction, AjeAttachment, AjeAuditEvent, AjePeriod, AjeReversalPreview, DepartmentLookup, DivisionLookup } from "./types";

const AjeEntryEditor = React.lazy(() => import("./components/AjeEntryEditor").then(module => ({ default:module.AjeEntryEditor })));
const AjeReviewDialog = React.lazy(() => import("./components/AjeReviewDialog").then(module => ({ default:module.AjeReviewDialog })));
const AjeAuditTrail = React.lazy(() => import("./components/AjeAuditTrail").then(module => ({ default:module.AjeAuditTrail })));

type Tab = "creation" | "new" | "posting" | "audit" | "summary";
type EntryListTab = Extract<Tab, "creation" | "posting" | "summary">;
type PostingQueue = "all" | "awaiting-my-review" | "ready-for-me-to-post" | "my-drafts";
const statuses = ["All","Drafts and revisions","Draft","For Revision","Submitted","Posted","Cancelled","Failed","Voided"];
const queueValues: PostingQueue[] = ["all","awaiting-my-review","ready-for-me-to-post","my-drafts"];
const pageSizes = [10,20,50,100];
const sortValues = ["lastActivity,desc","transactionDate,desc","transactionDate,asc","id,desc","jeNo,asc","status,asc"];
const emptySummary: AdjustingEntrySummary = { draft:0, forRevision:0, submitted:0, approved:0, posted:0, rejected:0, cancelled:0, failed:0, voided:0, imbalanced:0, postedImbalanced:0, totalRecords:0, postedDebit:0, postedCredit:0, awaitingMyReview:0, readyForMeToPost:0, myDrafts:0 };
function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)) ? value : "";
}

function positiveId(value: string | null) {
  return value && /^\d+$/.test(value) && Number(value) > 0 ? value : "";
}

function pageNumber(value: string | null) {
  return value && /^\d+$/.test(value) ? Math.max(0, Number(value)) : 0;
}

function exportScopeKey(query: AdjustingEntryQuery) {
  return JSON.stringify([query.search || "", query.status || "", query.startDate || "", query.endDate || "",
    query.divisionId || "", query.departmentId || "", query.accountTypeId || "", query.sourceJeNo || "",
    query.sort || "", query.unbalancedOnly === true, query.queue || "", query.workspace || ""]);
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
  const requestedStatus = params.get("status") || "All";
  const status = requestedStatus === "Approved" ? "Submitted" : requestedStatus === "Rejected" ? "For Revision" : requestedStatus;
  const pageSize = Number(params.get("pageSize"));
  const sort = params.get("sort") || "lastActivity,desc";
  const queue = params.get("queue") === "awaiting-my-review" ? "ready-for-me-to-post" : params.get("queue");
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
    unbalancedOnly: params.get("unbalancedOnly") === "true",
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
  const [accounts, setAccounts] = React.useState<AjeAccount[] | null>(null);
  const [departments, setDepartments] = React.useState<DepartmentLookup[] | null>(null);
  const [divisions, setDivisions] = React.useState<DivisionLookup[] | null>(null);
  const catalogsReady = accounts !== null && departments !== null && divisions !== null;
  const catalogs = React.useMemo(() => ({ accounts:accounts || [], departments:departments || [], divisions:divisions || [] }), [accounts,departments,divisions]);
  const [accessError, setAccessError] = React.useState("");
  const [accountsError, setAccountsError] = React.useState("");
  const [departmentsError, setDepartmentsError] = React.useState("");
  const [divisionsError, setDivisionsError] = React.useState("");
  const [periodError, setPeriodError] = React.useState("");
  const [accessRevision, setAccessRevision] = React.useState(0);
  const [accountsRevision, setAccountsRevision] = React.useState(0);
  const [departmentsRevision, setDepartmentsRevision] = React.useState(0);
  const [divisionsRevision, setDivisionsRevision] = React.useState(0);
  const [periodRevision, setPeriodRevision] = React.useState(0);
  const [period, setPeriod] = React.useState<AjePeriod | null>(null);
  const [accessLoading, setAccessLoading] = React.useState(initialView === "creation" || initialView === "posting");
  const [accountsLoading, setAccountsLoading] = React.useState(initialView !== "audit");
  const [departmentsLoading, setDepartmentsLoading] = React.useState(initialView !== "audit");
  const [divisionsLoading, setDivisionsLoading] = React.useState(initialView !== "audit");
  const [periodLoading, setPeriodLoading] = React.useState(initialView === "creation" || initialView === "posting");
  const [accessUpdatedAt, setAccessUpdatedAt] = React.useState<number | null>(null);
  const [accountsUpdatedAt, setAccountsUpdatedAt] = React.useState<number | null>(null);
  const [departmentsUpdatedAt, setDepartmentsUpdatedAt] = React.useState<number | null>(null);
  const [divisionsUpdatedAt, setDivisionsUpdatedAt] = React.useState<number | null>(null);
  const [periodUpdatedAt, setPeriodUpdatedAt] = React.useState<number | null>(null);
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [savedPostingQueue, setSavedPostingQueue] = React.useState<PostingQueue | null>(null);
  const [queuePreferenceLoaded, setQueuePreferenceLoaded] = React.useState(false);
  const [entries, setEntries] = React.useState<AdjustingEntry[]>([]);
  const [summary, setSummary] = React.useState(emptySummary);
  const [totalPages, setTotalPages] = React.useState(0);
  const [totalElements, setTotalElements] = React.useState(0);
  const [listLoading, setListLoading] = React.useState(initialView === "creation" || initialView === "posting" || initialView === "summary");
  const [summaryLoading, setSummaryLoading] = React.useState(initialView === "creation" || initialView === "posting" || initialView === "summary");
  const [listError, setListError] = React.useState("");
  const [summaryError, setSummaryError] = React.useState("");
  const [listUpdatedAt, setListUpdatedAt] = React.useState<number | null>(null);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = React.useState<number | null>(null);
  const [loadedListQueryKey, setLoadedListQueryKey] = React.useState("");
  const [loadedSummaryQueryKey, setLoadedSummaryQueryKey] = React.useState("");
  const [loadedExportScope, setLoadedExportScope] = React.useState("");
  const [exportingFormat, setExportingFormat] = React.useState<"csv" | "pdf" | null>(null);
  const [exportAnnouncement, setExportAnnouncement] = React.useState("");
  const [exportError, setExportError] = React.useState("");
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
  const [reviewPostingError, setReviewPostingError] = React.useState("");
  const [reviewSubmissionError, setReviewSubmissionError] = React.useState("");
  const [reviewSubmissionNotes, setReviewSubmissionNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reversal, setReversal] = React.useState<AjeReversalPreview | null>(null);
  const [reviewEntry, setReviewEntry] = React.useState<AdjustingEntry | null>(null);
  const [reviewDetails, setReviewDetails] = React.useState<AdjustingEntry | null>(null);
  const [reviewConfirmingPosting, setReviewConfirmingPosting] = React.useState(false);
  const [reviewConfirmingSubmission, setReviewConfirmingSubmission] = React.useState(false);
  const [reviewAttachments, setReviewAttachments] = React.useState<AjeAttachment[]>([]);
  const [reviewAuditEvents, setReviewAuditEvents] = React.useState<AjeAuditEvent[]>([]);
  const [reviewAuditLoading, setReviewAuditLoading] = React.useState(false);
  const [reviewAuditError, setReviewAuditError] = React.useState("");
  const [reviewAuditUpdatedAt, setReviewAuditUpdatedAt] = React.useState<number | null>(null);
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [reviewAttachmentsLoading, setReviewAttachmentsLoading] = React.useState(false);
  const [reviewError, setReviewError] = React.useState("");
  const [reviewAttachmentsError, setReviewAttachmentsError] = React.useState("");
  const [reviewDetailsUpdatedAt, setReviewDetailsUpdatedAt] = React.useState<number | null>(null);
  const [reviewAttachmentsUpdatedAt, setReviewAttachmentsUpdatedAt] = React.useState<number | null>(null);
  const commandLock = React.useRef(false);
  const reviewDetailsRequestGeneration = React.useRef(0);
  const reviewAttachmentsRequestGeneration = React.useRef(0);
  const reviewAuditRequestGeneration = React.useRef(0);
  const reviewInvokerRef = React.useRef<HTMLElement | null>(null);
  const pageHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  const editorDirtyRef = React.useRef(false);
  const handledIntent = React.useRef("");
  const searchCommitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = listFilters.search;
  const normalizedSearch = search.trim();
  const [searchDraft, setSearchDraft] = React.useState(search);
  const postingQueue = listFilters.queue || (initialView === "posting" && listFilters.status !== "All" ? "all" : savedPostingQueue || "ready-for-me-to-post");
  const statusOptions = initialView === "creation" ? ["All","Drafts and revisions","Draft","For Revision","Submitted","Cancelled","My drafts and revisions"] : initialView === "posting" ? ["All","Submitted","Failed","Posted"] : statuses;
  const status = initialView === "posting" && postingQueue !== "all" ? "All" : statusOptions.includes(listFilters.status) && listFilters.status !== "All" ? listFilters.status : initialView === "creation" && !searchParams.has("status") && listFilters.queue !== "my-drafts" ? "Draft" : "All";
  const selectedStatus = initialView === "creation" && listFilters.queue === "my-drafts" ? "My drafts and revisions" : status;
  const workspace = initialView === "creation" || initialView === "posting" ? initialView : undefined;
  const startDate = listFilters.startDate;
  const endDate = listFilters.endDate;
  const division = listFilters.division;
  const department = listFilters.department;
  const accountType = listFilters.accountType;
  const unbalancedOnly = listFilters.unbalancedOnly;
  const sort = listFilters.sort;
  const page = listFilters.page;
  const pageSize = listFilters.pageSize;
  const divisionId = division === "all" ? null : Number(division);
  const departmentId = department === "all" ? null : Number(department);
  const accountTypeId = accountType ? Number(accountType) : null;
  const query = React.useMemo<AdjustingEntryQuery>(() => ({ page,pageSize,search:normalizedSearch || undefined,status,startDate,endDate,divisionId,departmentId,accountTypeId,sort,workspace,unbalancedOnly:unbalancedOnly || undefined }), [page,pageSize,normalizedSearch,status,startDate,endDate,divisionId,departmentId,accountTypeId,sort,workspace,unbalancedOnly]);
  const summaryQuery = React.useMemo<AdjustingEntrySummaryQuery>(() => ({ search:normalizedSearch || undefined,startDate,endDate,divisionId,departmentId,accountTypeId,workspace }), [normalizedSearch,startDate,endDate,divisionId,departmentId,accountTypeId,workspace]);
  const listQuery = React.useMemo<AdjustingEntryQuery>(() => {
    if (initialView !== "posting") return { ...query, queue:initialView === "creation" ? listFilters.queue === "my-drafts" ? "my-drafts" : "all" : undefined };
    return { ...query, status:postingQueue === "all" ? status : undefined, queue:postingQueue };
  }, [initialView,postingQueue,query,status,listFilters.queue]);
  const listQueryKey = JSON.stringify(listQuery);
  const summaryQueryKey = JSON.stringify(summaryQuery);
  const listScopeStale = Boolean(loadedListQueryKey && loadedListQueryKey !== listQueryKey);
  const summaryScopeStale = Boolean(loadedSummaryQueryKey && loadedSummaryQueryKey !== summaryQueryKey);
  const hasEntryList = initialView === "creation" || initialView === "posting" || initialView === "summary";
  const listViewActive = hasEntryList && tab === initialView;

  React.useEffect(() => { latestSearchParams.current = searchParamText; }, [searchParamText]);

  const updateListQuery = React.useCallback((updates: Record<string, string | null>) => {
    setExportAnnouncement("");
    setExportError("");
    const params = new URLSearchParams(latestSearchParams.current);
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const queryString = params.toString();
    latestSearchParams.current = queryString;
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll:false });
  }, [pathname, router]);

  React.useEffect(() => {
    if (initialView !== "posting") return;
    if (listFilters.queue === "my-drafts" || ["Draft","For Revision","Drafts and revisions"].includes(listFilters.status)) {
      updateListQuery({ queue:"all",status:null,page:"0" });
    }
  }, [initialView,listFilters.queue,listFilters.status,updateListQuery]);

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
    if (initialView !== "creation" && initialView !== "posting") return;
    let active = true;
    setAccessLoading(true);
    api.access().then(value => {
      if (active) { setAccess(value); setAccessError(""); setAccessUpdatedAt(Date.now()); }
    }).catch(e => {
      if (active) { setAccessError(e instanceof Error ? e.message : "Unable to load AJE permissions"); if (initialView === "posting") setQueuePreferenceLoaded(true); }
    }).finally(() => { if (active) setAccessLoading(false); });
    return () => { active = false; };
  }, [initialView,accessRevision]);

  React.useEffect(() => {
    if (initialView === "audit") return;
    let active = true;
    setAccountsLoading(true);
    api.accounts().then(value => {
      if (active) { setAccounts(value); setAccountsError(""); setAccountsUpdatedAt(Date.now()); }
    }).catch(e => { if (active) setAccountsError(e instanceof Error ? e.message : "Unable to load chart-of-account options"); })
      .finally(() => { if (active) setAccountsLoading(false); });
    return () => { active = false; };
  }, [initialView,accountsRevision]);

  React.useEffect(() => {
    if (initialView === "audit") return;
    let active = true;
    setDepartmentsLoading(true);
    fetchDepartmentOptions().then(value => {
      if (active) { setDepartments(value); setDepartmentsError(""); setDepartmentsUpdatedAt(Date.now()); }
    }).catch(e => { if (active) setDepartmentsError(e instanceof Error ? e.message : "Unable to load department options"); })
      .finally(() => { if (active) setDepartmentsLoading(false); });
    return () => { active = false; };
  }, [initialView,departmentsRevision]);

  React.useEffect(() => {
    if (initialView === "audit") return;
    let active = true;
    setDivisionsLoading(true);
    fetchDivisionOptions().then(value => {
      if (active) { setDivisions(value); setDivisionsError(""); setDivisionsUpdatedAt(Date.now()); }
    }).catch(e => { if (active) setDivisionsError(e instanceof Error ? e.message : "Unable to load division options"); })
      .finally(() => { if (active) setDivisionsLoading(false); });
    return () => { active = false; };
  }, [initialView,divisionsRevision]);

  React.useEffect(() => {
    if (initialView !== "creation" && initialView !== "posting") return;
    let active = true;
    setPeriodLoading(true);
    api.period().then(value => {
      if (active) { setPeriod(value); setPeriodError(""); setPeriodUpdatedAt(Date.now()); }
    }).catch(e => { if (active) setPeriodError(e instanceof Error ? e.message : "Unable to load the accounting period cutoff"); })
      .finally(() => { if (active) setPeriodLoading(false); });
    return () => { active = false; };
  }, [initialView,periodRevision]);

  React.useEffect(() => {
    if (initialView !== "posting" || !access || queuePreferenceLoaded) return;
    let saved: PostingQueue | null = listFilters.queue;
    if (!saved) {
      try {
        const stored = window.localStorage.getItem(`aje-posting-queue:${access.userId}`);
        if (stored && queueValues.includes(stored as PostingQueue)) saved = stored as PostingQueue;
      } catch { /* Storage can be unavailable in private contexts. */ }
    }
    setSavedPostingQueue(saved === "my-drafts" || saved === "awaiting-my-review" ? "ready-for-me-to-post" : saved || "ready-for-me-to-post");
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
    const requestExportScope = exportScopeKey(listQuery);
    setListLoading(true);
    void api.list(listQuery, controller.signal)
      .then(list => {
        if (controller.signal.aborted) return;
        setEntries(list.content);
        setTotalPages(list.totalPages);
        setTotalElements(list.totalElements);
        setLoadedExportScope(requestExportScope);
        setLoadedListQueryKey(listQueryKey);
        setListUpdatedAt(Date.now());
        setListError("");
      })
      .catch(e => { if (!controller.signal.aborted) setListError(e instanceof Error ? e.message : "Unable to load adjusting entries"); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [initialView,listViewActive,queuePreferenceLoaded,listQuery,listQueryKey,listRevision]);

  React.useEffect(() => {
    if (!listViewActive) {
      setSummaryLoading(false);
      return;
    }
    const controller = new AbortController();
    setSummaryLoading(true);
    void api.summary(summaryQuery, controller.signal)
      .then(counts => {
        if (controller.signal.aborted) return;
        setSummary(counts);
        setLoadedSummaryQueryKey(summaryQueryKey);
        setSummaryUpdatedAt(Date.now());
        setSummaryError("");
      })
      .catch(e => { if (!controller.signal.aborted) setSummaryError(e instanceof Error ? e.message : "Unable to load adjusting entry summary"); })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [listViewActive,summaryQuery,summaryQueryKey,summaryRevision]);

  function retryList() {
    setListLoading(true);
    setListRevision(value => value + 1);
  }

  function retrySummary() {
    setSummaryLoading(true);
    setSummaryRevision(value => value + 1);
  }

  function retryLookup(resource: "access" | "accounts" | "departments" | "divisions" | "period") {
    if (resource === "access") { setQueuePreferenceLoaded(false); setAccessRevision(value => value + 1); }
    else if (resource === "accounts") setAccountsRevision(value => value + 1);
    else if (resource === "departments") setDepartmentsRevision(value => value + 1);
    else if (resource === "divisions") setDivisionsRevision(value => value + 1);
    else setPeriodRevision(value => value + 1);
  }

  function refreshEntriesAndSummary() {
    setListLoading(true);
    setSummaryLoading(true);
    setListRevision(value => value + 1);
    setSummaryRevision(value => value + 1);
  }

  async function generateSummaryExport(format: "csv" | "pdf") {
    if (summaryExportDisabled || exportingFormat) return;
    const scopeCount = totalElements;
    const reportUrl = ajeReportUrl(listQuery, format);
    const pdfWindow = format === "pdf" ? window.open("about:blank", "_blank") : null;
    if (pdfWindow) {
      pdfWindow.opener = null;
      pdfWindow.document.title = "Preparing adjusting entries report";
      pdfWindow.document.body.textContent = "Preparing your PDF report…";
    }
    setExportingFormat(format);
    setExportError("");
    setExportAnnouncement(`Preparing ${format.toUpperCase()} for ${scopeCount} filtered ${scopeCount === 1 ? "entry" : "entries"} across all pages.`);
    try {
      const response = await fetch(reportUrl, { cache: "no-store" });
      if (!response.ok) {
        let message = `Unable to generate the ${format.toUpperCase()} export.`;
        try {
          const body = await response.json() as { message?: string; detail?: string; error?: string };
          message = body.message || body.detail || body.error || message;
        } catch { /* Use the standard export error when the response is not JSON. */ }
        throw new Error(message);
      }
      const expectedType = format === "pdf" ? "application/pdf" : "text/csv";
      if (!response.headers.get("content-type")?.includes(expectedType)) {
        throw new Error(`The ${format.toUpperCase()} service returned an unexpected file type.`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i);
      const filename = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1].trim()) : `adjusting-entries-summary.${format}`;
      const objectUrl = URL.createObjectURL(blob);
      if (format === "pdf" && pdfWindow) {
        pdfWindow.location.replace(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
      } else {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      }
      setExportAnnouncement(`${format.toUpperCase()} ready for ${scopeCount} filtered ${scopeCount === 1 ? "entry" : "entries"}${format === "pdf" && pdfWindow ? "; opened in a new tab." : "; download started."}`);
    } catch (cause) {
      pdfWindow?.close();
      setExportAnnouncement("");
      setExportError(cause instanceof Error ? cause.message : `Unable to generate the ${format.toUpperCase()} export. Please try again.`);
    } finally {
      setExportingFormat(null);
    }
  }

  function finishEditing(saved: AdjustingEntry) {
    editorDirtyRef.current = false;
    setEditorEntry(null); setEditorSeed(null); setEditorReturnTab(null); setReadOnly(false);
    setEditorKey(key => key + 1);
    if (initialView === "posting") {
      cancelPendingSearchCommit();
      setSearchDraft("");
      setTab("posting");
      setSavedPostingQueue("all");
      latestSearchParams.current = "queue=all";
      router.replace(`${pathname}?queue=all`, { scroll:false });
    } else {
      setTab("creation");
      updateFilters({ status:saved.status, queue:"all" });
    }
  }

  function handleEditorSaved(saveCompleted: boolean, saved: AdjustingEntry, submitting: boolean) {
    refreshEntriesAndSummary();
    if (saveCompleted && !submitting) finishEditing(saved);
  }

  React.useEffect(() => {
    if (!access) return;
    const id = initialView === "posting" || initialView === "creation" ? searchParams.get("editAjeId") : null;
    const source = initialView === "creation" ? searchParams.get("sourceJeNo") : null;
    const intent = id || source || "";
    if (!intent || handledIntent.current === intent) return;
    handledIntent.current = intent;
    let active = true;
    const load = id ? api.get(Number(id)).then(entry => {
     if (active) { setEditorEntry(entry); setEditorSeed(null); setEditorReturnTab(initialView === "creation" || initialView === "posting" || initialView === "summary" ? initialView : null); setReadOnly(searchParams.get("mode") === "view" || !["Draft", "For Revision"].includes(entry.status) || entry.creatorId !== access.userId); setEditorKey(k => k + 1); setTab("new"); }
    }) : api.sourceJournalEntry(source!).then(original => {
      if (active) {
        setEditorEntry(null); setEditorReturnTab("creation"); setReadOnly(false); setEditorSeed({ reference:original.transactionRef || original.jeNo,transactionDate:todayManila(),description:`Adjustment for ${original.jeNo}: ${original.description || ""}`,divisionId:null,departmentId:null,sourceJeNo:original.jeNo,details:original.details.filter(d => d.coaId != null).map(d => ({ coaId:d.coaId!,debit:d.debit,credit:d.credit,departmentId:d.departmentId ?? null })) });
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
  function closeAction() {
    setAction(null);
    setReason("");
  }
  function requestAction(entry: AdjustingEntry, name: AjeAction, trigger?: HTMLElement) {
    if (commandLock.current) return;
    if (name === "submit") {
      setAction(null);
      setActionError("");
      openReview(entry,"submission",trigger);
      return;
    }
    if (name === "post" || name === "retry") {
      setReason("");
      openReview(entry,"posting",trigger);
      return;
    }
    setAction({ entry,action:name });
    setReason("");
    setActionError("");
  }
  async function refreshReviewAudit(entryId: number) {
    const generation = ++reviewAuditRequestGeneration.current;
    setReviewAuditLoading(true);
    try {
      const events = await loadEntryAuditEvents(entryId);
      if (generation === reviewAuditRequestGeneration.current) {
        setReviewAuditEvents(events);
        setReviewAuditUpdatedAt(Date.now());
        setReviewAuditError("");
      }
    } catch (e) {
      if (generation === reviewAuditRequestGeneration.current) setReviewAuditError(e instanceof Error ? e.message : "Unable to load the audit trail");
    } finally {
      if (generation === reviewAuditRequestGeneration.current) setReviewAuditLoading(false);
    }
  }
  async function view(entry: AdjustingEntry, edit: boolean) {
    try { const details = await api.get(entry.id); setEditorEntry(details); setEditorSeed(null); setEditorReturnTab(tab === "creation" || tab === "posting" || tab === "summary" ? tab : editorReturnTab); setReadOnly(!edit || !["Draft", "For Revision"].includes(details.status) || details.entryOrigin !== "MANUAL" || details.creatorId !== access?.userId); setEditorKey(k => k + 1); setTab("new"); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to open this entry"); }
  }
  function openReview(entry: AdjustingEntry, mode: "view" | "posting" | "submission" = "view", trigger?: HTMLElement) {
    if (trigger) reviewInvokerRef.current = trigger;
    const detailsGeneration = ++reviewDetailsRequestGeneration.current;
    const attachmentsGeneration = ++reviewAttachmentsRequestGeneration.current;
    setReviewConfirmingPosting(mode === "posting");
    setReviewConfirmingSubmission(mode === "submission");
    setReviewPostingError("");
    setReviewSubmissionError("");
    setReviewSubmissionNotes("");
    setReviewEntry(entry); setReviewDetails(null); setReviewAttachments([]); setReviewLoading(true); setReviewAttachmentsLoading(true); setReviewError(""); setReviewAttachmentsError("");
    setReviewDetailsUpdatedAt(null); setReviewAttachmentsUpdatedAt(null);
    setReviewAuditEvents([]); setReviewAuditUpdatedAt(null); setReviewAuditError("");
    void refreshReviewAudit(entry.id);
    void api.get(entry.id).then(details => {
      if (detailsGeneration === reviewDetailsRequestGeneration.current) { setReviewDetails(details); setReviewDetailsUpdatedAt(Date.now()); setReviewError(""); }
    }).catch(error => {
      if (detailsGeneration === reviewDetailsRequestGeneration.current) setReviewError(error instanceof Error ? error.message : "Unable to load journal details");
    }).finally(() => {
      if (detailsGeneration === reviewDetailsRequestGeneration.current) setReviewLoading(false);
    });
    void api.attachments(entry.id).then(attachments => {
      if (attachmentsGeneration === reviewAttachmentsRequestGeneration.current) { setReviewAttachments(attachments); setReviewAttachmentsUpdatedAt(Date.now()); setReviewAttachmentsError(""); }
    }).catch(error => {
      if (attachmentsGeneration === reviewAttachmentsRequestGeneration.current) setReviewAttachmentsError(error instanceof Error ? error.message : "Unable to load supporting documents");
    }).finally(() => {
      if (attachmentsGeneration === reviewAttachmentsRequestGeneration.current) setReviewAttachmentsLoading(false);
    });
  }
  function retryReviewDetails() {
    if (!reviewEntry) return;
    const generation = ++reviewDetailsRequestGeneration.current;
    setReviewLoading(true);
    void api.get(reviewEntry.id).then(details => {
      if (generation === reviewDetailsRequestGeneration.current) { setReviewDetails(details); setReviewDetailsUpdatedAt(Date.now()); setReviewError(""); }
    }).catch(error => {
      if (generation === reviewDetailsRequestGeneration.current) setReviewError(error instanceof Error ? error.message : "Unable to load journal details");
    }).finally(() => {
      if (generation === reviewDetailsRequestGeneration.current) setReviewLoading(false);
    });
  }
  function retryReviewAttachments() {
    if (!reviewEntry) return;
    const generation = ++reviewAttachmentsRequestGeneration.current;
    setReviewAttachmentsLoading(true);
    void api.attachments(reviewEntry.id).then(attachments => {
      if (generation === reviewAttachmentsRequestGeneration.current) { setReviewAttachments(attachments); setReviewAttachmentsUpdatedAt(Date.now()); setReviewAttachmentsError(""); }
    }).catch(error => {
      if (generation === reviewAttachmentsRequestGeneration.current) setReviewAttachmentsError(error instanceof Error ? error.message : "Unable to load supporting documents");
    }).finally(() => {
      if (generation === reviewAttachmentsRequestGeneration.current) setReviewAttachmentsLoading(false);
    });
  }
  function closeReview() {
    reviewDetailsRequestGeneration.current += 1;
    reviewAttachmentsRequestGeneration.current += 1;
    reviewAuditRequestGeneration.current += 1;
    setReviewConfirmingPosting(false);
    setReviewConfirmingSubmission(false);
    setReviewPostingError("");
    setReviewSubmissionError("");
    setReviewSubmissionNotes("");
    setReviewEntry(null); setReviewDetails(null); setReviewAttachments([]); setReviewLoading(false); setReviewAttachmentsLoading(false); setReviewError(""); setReviewAttachmentsError("");
    setReviewDetailsUpdatedAt(null); setReviewAttachmentsUpdatedAt(null);
    setReviewAuditEvents([]); setReviewAuditLoading(false); setReviewAuditError(""); setReviewAuditUpdatedAt(null);
  }
  function restoreReviewFocus(event: { preventDefault: () => void }) {
    event.preventDefault();
    const invoker = reviewInvokerRef.current;
    if (invoker?.isConnected) invoker.focus({ preventScroll:true });
    else pageHeadingRef.current?.focus({ preventScroll:true });
  }
  async function executeAction(entry: AdjustingEntry, name: AjeAction, reasonOverride?: string) {
    if (commandLock.current) return;
    const actionReason = reasonOverride ?? reason;
    const submissionPreview = name === "submit" && reviewConfirmingSubmission && reviewEntry?.id === entry.id;
    if (actionRequiresReason(entry,name) && !actionReason.trim()) {
      if (submissionPreview) setReviewSubmissionError("Revision notes are required before resubmitting.");
      else setActionError(name === "submit" ? "Revision notes are required before resubmitting." : "A reason is required.");
      return;
    }
    commandLock.current = true;
    setBusy(true);
    if (name === "post" || name === "retry") setReviewPostingError("");
    else if (submissionPreview) setReviewSubmissionError("");
    else setActionError("");
    try {
      const updated = await api.command(entry.id,name,entry.version,actionReason.trim() || undefined);
      if (name === "post" || name === "retry") { setReviewConfirmingPosting(false); setReviewPostingError(""); }
      else if (submissionPreview) closeReview();
      else closeAction();
      refreshEntriesAndSummary(); toast.success(name === "withdraw" ? `${updated.jeNo || `Entry #${updated.id}`} withdrawn to ${updated.status}` : `${actionLabelForEntry(entry, name)} completed - ${updated.jeNo || `Entry #${updated.id}`}`);
      if (name === "withdraw" && initialView === "creation") updateFilters({ status:updated.status,queue:"all" });
      if (!submissionPreview && reviewEntry?.id === updated.id) { setReviewEntry(updated); setReviewDetails(updated); setReviewDetailsUpdatedAt(Date.now()); void refreshReviewAudit(updated.id); }
      if (name === "submit" && (initialView === "creation" || tab === "new")) finishEditing(updated);
      else if (name === "revise") { closeReview(); await view(updated,true); }
      else if (editorEntry?.id === updated.id || (initialView === "posting" && tab === "new")) { setEditorEntry(updated); setEditorSeed(null); setReadOnly(!["Draft", "For Revision"].includes(updated.status)); setEditorKey(k => k + 1); }
    } catch (e) {
      const message = e instanceof Error ? e.message : "The action failed";
      if (name === "post" || name === "retry") setReviewPostingError(message);
      else if (submissionPreview) setReviewSubmissionError(message);
      else setActionError(message);
      refreshEntriesAndSummary();
      try {
        const latest = await api.get(entry.id);
        setAction(current => current && current.entry.id === latest.id ? { ...current, entry: latest,
          action: latest.status === "Failed" && ["post","retry"].includes(current.action) ? "retry" : current.action } : current);
        if (reviewEntry?.id === latest.id) { setReviewEntry(latest); setReviewDetails(latest); setReviewDetailsUpdatedAt(Date.now()); void refreshReviewAudit(latest.id); }
        if (editorEntry?.id === latest.id || (initialView === "posting" && tab === "new")) {
          setEditorEntry(latest); setReadOnly(!["Draft", "For Revision"].includes(latest.status)); setEditorKey(k => k + 1);
        }
      } catch { /* Keep the original error if the service is unavailable. */ }
    }
    finally { commandLock.current = false; setBusy(false); }
  }
  function runAction(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (action) void executeAction(action.entry,action.action);
  }
  function requestReviewPosting() {
    setReason("");
    setReviewPostingError("");
    setReviewConfirmingPosting(true);
  }
  function cancelReviewPosting() {
    setReviewPostingError("");
    setReviewConfirmingPosting(false);
  }
  function cancelReviewSubmission() {
    closeReview();
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
    updateListQuery({ search:null,status:null,startDate:null,endDate:null,divisionId:null,departmentId:null,accountTypeId:null,unbalancedOnly:null,sort:null,page:"0",pageSize:null,...(initialView === "posting" || initialView === "creation" ? { queue:"all" } : {}) });
  }
  const focusUnbalancedPosted = () => updateFilters({ status:"Posted",queue:"all",unbalancedOnly:"true" });
  const focusDrafts = () => updateFilters({ status:"Drafts and revisions",queue:"all",unbalancedOnly:"true" });
  const hasFilters = Boolean((initialView === "creation" && listFilters.queue === "my-drafts") || searchDraft.trim() || status !== "All" || startDate || endDate || division !== "all" || department !== "all" || accountType || unbalancedOnly || sort !== "lastActivity,desc" || page > 0 || pageSize !== 20 || (initialView === "posting" && postingQueue !== "all"));
  const summaryDateScope = startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : startDate ? `From ${formatDate(startDate)}` : endDate ? `Through ${formatDate(endDate)}` : "All dates";
  const summaryScopeFilterCount = Number(Boolean(unbalancedOnly)) + Number(Boolean(normalizedSearch)) + Number(divisionId != null) + Number(departmentId != null) + Number(accountTypeId != null);
  const postingQueueOptions = [
    { value:"all",label:"All posting entries",count:summary.totalRecords },
    { value:"ready-for-me-to-post",label:"Ready for me to post",count:summary.readyForMeToPost },
  ] as const;
  const accountTypes = React.useMemo(() => [...new Map((catalogs?.accounts || []).filter(a => a.accountTypeId).map(a => [a.accountTypeId,{ id:a.accountTypeId!,name:a.accountTypeName || "Other" }])).values()], [catalogs]);
  const lookupResources = [
    ...(initialView === "creation" || initialView === "posting" ? [{ key:"access" as const,label:"Permissions",error:accessError,loading:accessLoading,updatedAt:accessUpdatedAt }] : []),
    ...(initialView !== "audit" ? [
      { key:"accounts" as const,label:"Account options",error:accountsError,loading:accountsLoading,updatedAt:accountsUpdatedAt },
      { key:"departments" as const,label:"Department options",error:departmentsError,loading:departmentsLoading,updatedAt:departmentsUpdatedAt },
      { key:"divisions" as const,label:"Division options",error:divisionsError,loading:divisionsLoading,updatedAt:divisionsUpdatedAt },
    ] : []),
    ...(initialView === "creation" || initialView === "posting" ? [{ key:"period" as const,label:"Period controls",error:periodError,loading:periodLoading,updatedAt:periodUpdatedAt }] : []),
  ];
  const editorTitle = editorEntry ? (readOnly ? "View Adjusting Entry" : "Editing Adjusting Entry") : editorSeed?.entryKind === "REVERSAL" ? "New Reversal" : "New Adjusting Entry";
  const summaryPrintDisabled = listLoading || listScopeStale || Boolean(listError) || searchDraft.trim() !== normalizedSearch;
  const summaryExportDisabled = summaryPrintDisabled || summaryLoading || summaryScopeStale || Boolean(summaryError) || loadedExportScope !== exportScopeKey(listQuery) || exportingFormat !== null;
  const countActionsDisabled = summaryLoading || summaryScopeStale || Boolean(summaryError);
  const pageHeader = <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <h1 ref={pageHeadingRef} tabIndex={-1} className="text-xl font-semibold">{tab === "creation" ? "Creation" : tab === "posting" ? "Posting of Entries" : tab === "new" ? editorTitle : tab === "audit" ? "Audit Trail" : "Summary"}</h1>
    <p className="text-sm text-muted-foreground">{tab === "creation" ? "Prepare drafts, revise returned entries, and track submissions." : tab === "posting" ? "Review submitted entries, post to the General Ledger, and prepare reversals." : tab === "new" ? editorEntry ? (readOnly ? "Review this adjusting entry." : "Update this editable adjusting entry.") : "Prepare a balanced adjustment and submit it for posting." : tab === "audit" ? "Chronological journal actions, revisions, supporting files, and period controls." : "Review entry volume and posted debit and credit activity."}</p>
    {initialView !== "posting" && (tab === "creation" || tab === "posting" || tab === "new") && <p className="mt-1 text-xs text-muted-foreground">Closed through: {period?.closedThroughDate ? formatDate(period.closedThroughDate) : periodLoading ? "Loading cutoff…" : periodError ? "Unavailable" : "No cutoff set"}</p>}
  </div><div className="flex flex-wrap gap-2">
    {(tab === "creation" || tab === "posting") && <><Button variant="outline" onClick={refreshEntriesAndSummary}>Refresh</Button><Button variant="outline" disabled={!period || periodLoading || Boolean(periodError)} onClick={() => setPeriodOpen(true)}>Period controls</Button></>}
    {tab === "summary" && <>
      <Button type="button" disabled={summaryExportDisabled} onClick={() => void generateSummaryExport("csv")}>{exportingFormat === "csv" ? "Preparing CSV…" : "Export all filtered entries · CSV"}</Button>
      <Button type="button" variant="outline" disabled={summaryExportDisabled} onClick={() => void generateSummaryExport("pdf")}>{exportingFormat === "pdf" ? "Preparing PDF…" : "Print all filtered entries · PDF"}</Button>
    </>}
    {tab === "posting" && <Button variant="outline" disabled={summaryPrintDisabled} asChild><a href={ajeReportUrl(listQuery,"pdf")} target="_blank" rel="noopener noreferrer" aria-disabled={summaryPrintDisabled} onClick={event => { if (summaryPrintDisabled) event.preventDefault(); }}>Print summary</a></Button>}
    {(tab === "audit" || tab === "summary") && <Button variant="outline" onClick={() => tab === "audit" ? setAuditRevision(v => v + 1) : refreshEntriesAndSummary()}>Refresh</Button>}
    {tab === "summary" && (exportAnnouncement || exportError) && <span className="basis-full text-right text-xs" role={exportError ? "alert" : "status"} aria-live={exportError ? "assertive" : "polite"}>{exportError || exportAnnouncement}</span>}
    {tab === "creation" && <Button type="button" disabled={!access || accessLoading || Boolean(accessError)} onClick={() => { setEditorEntry(null); setEditorSeed(null); setReadOnly(false); setEditorReturnTab("creation"); setEditorKey(key => key + 1); setTab("new"); }}>Create adjusting entry</Button>}
  </div></div>;
  return <div className="space-y-5 p-4 sm:p-6">
    {pageHeader}
    {initialView !== "creation" && initialView !== "posting" && lookupResources.some(resource => resource.updatedAt !== null || resource.loading) && <div aria-label="Lookup freshness" className="flex flex-wrap gap-x-4 gap-y-1">{lookupResources.map(resource => <AjeDataFreshness key={resource.key} label={resource.label} updatedAt={resource.updatedAt} loading={resource.loading} stale={Boolean(resource.error)} />)}</div>}
    {lookupResources.filter(resource => resource.error).map(resource => <AjeRetryAlert key={resource.key} message={`${resource.label}: ${resource.error}`} retrying={resource.loading} retryLabel={`Retry ${resource.label.toLowerCase()}`} onRetry={() => retryLookup(resource.key)} />)}
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {listViewActive && tab !== "creation" && tab !== "posting" && <div className="flex flex-wrap gap-x-4 gap-y-1"><AjeDataFreshness label="Journals" updatedAt={listUpdatedAt} loading={listLoading} stale={Boolean(listError) || listScopeStale} />{tab === "summary" || tab === "posting" ? <AjeDataFreshness label="Counts" updatedAt={summaryUpdatedAt} loading={summaryLoading} stale={Boolean(summaryError) || summaryScopeStale} /> : null}</div>}
    {listViewActive && tab !== "creation" && listScopeStale && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900">Filters changed. Showing the previous journal results while the requested results load. Actions and exports are disabled until the current results arrive.</p>}
    {listViewActive && summaryScopeStale && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900">The filters changed. Summary counts below are from the previous report scope while updated counts load.</p>}
    {listViewActive && listError && <AjeRetryAlert message={listError} retrying={listLoading} retryLabel="Retry journals" onRetry={retryList} />}
    {listViewActive && summaryError && <AjeRetryAlert message={summaryError} retrying={summaryLoading} retryLabel="Retry counts" onRetry={retrySummary} />}
    {tab === "new" && <>
      {editorReturnTab && <div className="flex justify-start"><Button type="button" variant="outline" onClick={returnToEntryList}>{editorReturnTab === "creation" ? "Back to Creation" : editorReturnTab === "posting" ? "Back to postings" : "Back to summary"}</Button></div>}
      {(!access || !catalogsReady) ? (accessLoading || accountsLoading || departmentsLoading || divisionsLoading ? <AjeEntryEditorSkeleton /> : <p role="status" className="text-sm text-muted-foreground">The entry form is unavailable until its required lookup data loads.</p>) : <React.Suspense fallback={<AjeEntryEditorSkeleton />}><AjeEntryEditor key={editorKey} initialEntry={editorEntry} seed={editorSeed} readOnly={readOnly} hideTitle={tab === "new"} dirtyRef={editorDirtyRef} access={access} accounts={catalogs.accounts} departments={catalogs.departments} divisions={catalogs.divisions} onSaved={handleEditorSaved} onAction={requestAction} /></React.Suspense>}
    </>}
    {tab === "audit" && <React.Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading audit trail…</p>}><AjeAuditTrail revision={auditRevision} /></React.Suspense>}
    {(tab === "creation" || tab === "posting" || tab === "summary") && <>
      {tab === "summary" && <section aria-label="Applied report scope" className="space-y-2 rounded-md border bg-muted/20 px-3 py-2 sm:hidden">
        <p className="text-xs font-semibold text-muted-foreground">Report scope</p>
        <p className="text-sm">{summaryDateScope} <span className="text-muted-foreground">·</span> {status === "All" ? "All statuses" : status}</p>
        <details className="group border-t pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />Additional report details{summaryScopeFilterCount > 0 ? ` (${summaryScopeFilterCount} ${summaryScopeFilterCount === 1 ? "filter" : "filters"})` : ""}
          </summary>
          <div className="space-y-2 pt-2">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {unbalancedOnly && <span className="rounded-full border bg-background px-2 py-1">Unbalanced entries only</span>}
              {normalizedSearch && <span className="max-w-full break-words rounded-full border bg-background px-2 py-1">Search: “{normalizedSearch}”</span>}
              {divisionId != null && <span className="rounded-full border bg-background px-2 py-1">Division: {catalogs?.divisions.find(item => item.id === divisionId)?.name || `Division ${division}`}</span>}
              {departmentId != null && <span className="rounded-full border bg-background px-2 py-1">Department: {catalogs?.departments.find(item => item.id === departmentId)?.name || `Department ${department}`}</span>}
              {accountTypeId != null && <span className="rounded-full border bg-background px-2 py-1">Account type: {accountTypes.find(item => item.id === accountTypeId)?.name || `Account type ${accountType}`}</span>}
              {summaryScopeFilterCount === 0 && <span className="text-muted-foreground">No additional report filters.</span>}
            </div>
            <p className="text-xs text-muted-foreground">Summary cards reflect search, date, and organizational filters across all workflow statuses. They do not apply the register’s status or imbalance filters. The register and both exports apply all selected filters; exports include every matching entry across all pages.</p>
          </div>
        </details>
      </section>}
      {tab === "summary" && <section aria-label="Applied report scope" className="hidden space-y-1.5 rounded-md border bg-muted/20 px-3 py-2 sm:block">
        <p className="text-xs font-semibold text-muted-foreground">Report scope</p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full border bg-background px-2 py-1">Accounting dates: {summaryDateScope}</span>
          <span className="rounded-full border bg-background px-2 py-1">Status: {status === "All" ? "All statuses" : status}</span>
          {unbalancedOnly && <span className="rounded-full border bg-background px-2 py-1">Unbalanced entries only</span>}
          {normalizedSearch && <span className="max-w-full break-words rounded-full border bg-background px-2 py-1">Search: “{normalizedSearch}”</span>}
          {divisionId != null && <span className="rounded-full border bg-background px-2 py-1">Division: {catalogs?.divisions.find(item => item.id === divisionId)?.name || `Division ${division}`}</span>}
          {departmentId != null && <span className="rounded-full border bg-background px-2 py-1">Department: {catalogs?.departments.find(item => item.id === departmentId)?.name || `Department ${department}`}</span>}
          {accountTypeId != null && <span className="rounded-full border bg-background px-2 py-1">Account type: {accountTypes.find(item => item.id === accountTypeId)?.name || `Account type ${accountType}`}</span>}
        </div>
        <p className="text-xs text-muted-foreground">Summary cards reflect search, date, and organizational filters across all workflow statuses. They do not apply the register’s status or imbalance filters. The register and both exports apply all selected filters; exports include every matching entry across all pages.</p>
      </section>}
      {tab === "summary" && summaryError && summaryUpdatedAt === null && <p role="status" className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">Summary counts are unavailable until they load successfully.</p>}
      {tab === "summary" && !(summaryError && summaryUpdatedAt === null) && <AdjustingEntriesSummaryCards summary={summary} loading={summaryLoading} showPostedAmounts onInvestigatePosted={focusUnbalancedPosted} onShowUnbalancedDrafts={focusDrafts} />}
      {tab === "posting" && <>
        <div className="space-y-1 md:hidden" aria-label="Posting queue view">
          <Label htmlFor="aje-posting-queue-mobile" className="text-xs font-medium text-muted-foreground">Posting queue</Label>
          <select id="aje-posting-queue-mobile" aria-label="Posting queue" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={postingQueue} disabled={countActionsDisabled} onChange={event => selectPostingQueue(event.target.value as PostingQueue)}>
            {postingQueueOptions.map(option => <option key={option.value} value={option.value}>{option.label} ({summaryUpdatedAt === null ? "—" : option.count})</option>)}
          </select>
        </div>
        <div className="hidden flex-wrap items-center gap-2 md:flex" aria-label="Posting queue view">
          {postingQueueOptions.map(({ value, label, count }) => <Button key={value} type="button" size="sm" disabled={countActionsDisabled} aria-pressed={postingQueue === value && (value !== "all" || status === "All")} variant={postingQueue === value && (value !== "all" || status === "All") ? "default" : "outline"} onClick={() => selectPostingQueue(value)}>{label}<span className="ml-1 rounded-full bg-background/20 px-1.5 text-xs">{summaryUpdatedAt === null ? "—" : count}</span></Button>)}
        </div>
      </>}
      <AdjustingEntriesFilters search={searchDraft} startDate={startDate} endDate={endDate} status={selectedStatus} pageSize={pageSize} filterDivisionId={division} filterDepartmentId={department} statusOptions={statusOptions} pageSizes={[10,20,50,100]}
        filterDivisionOptions={[{ value:"all",label:"All divisions" },...(catalogs?.divisions || []).map(d => ({ value:String(d.id),label:d.name }))]}
        filterDepartmentOptions={[{ value:"all",label:"All departments" },...(catalogs?.departments || []).filter(d => division === "all" || !d.parentDivision || String(d.parentDivision) === division).map(d => ({ value:String(d.id),label:d.name }))]}
        hasActiveFilters={hasFilters} moreFiltersCount={Number(division !== "all") + Number(department !== "all") + Number(Boolean(accountType))} onSearchChange={handleSearchChange} onStartDateChange={v => updateFilters({ startDate:v || null })} onEndDateChange={v => updateFilters({ endDate:v || null })}
        onStatusChange={v => updateFilters({ status:initialView === "creation" ? v === "My drafts and revisions" ? "All" : v : v === "All" ? null : v,queue:initialView === "creation" && v === "My drafts and revisions" ? "my-drafts" : "all",unbalancedOnly:null })} onPageSizeChange={v => updateListQuery({ pageSize:String(v),page:"0" })} onDivisionChange={v => updateFilters({ divisionId:v === "all" ? null : v,departmentId:null })} onDepartmentChange={v => updateFilters({ departmentId:v === "all" ? null : v })} onClearFilters={clearFilters}>
        <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Account type</Label><AjeSearchableSelect ariaLabel="Account type" value={accountType || "all"} onValueChange={value => updateFilters({ accountTypeId:value === "all" ? null : value })} options={[{ value:"all",label:"All account types" },...accountTypes.map(accountType => ({ value:String(accountType.id),label:accountType.name }))]} placeholder="All account types" /></div>
        <div className="space-y-1.5"><Label htmlFor="aje-sort" className="text-xs font-medium text-muted-foreground">Sort</Label><select id="aje-sort" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={sort} onChange={e => updateFilters({ sort:e.target.value === "lastActivity,desc" ? null : e.target.value })}><option value="lastActivity,desc">Last activity: newest</option><option value="transactionDate,desc">Accounting date: newest</option><option value="transactionDate,asc">Accounting date: oldest</option><option value="id,desc">Newest created</option><option value="jeNo,asc">Journal number</option><option value="status,asc">Status</option></select></div>
      </AdjustingEntriesFilters>
      {unbalancedOnly && <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Applied filters"><span className="text-muted-foreground">Applied filter:</span><Button type="button" variant="outline" size="sm" onClick={() => updateFilters({ unbalancedOnly:null })} aria-label="Remove unbalanced entries filter">Unbalanced entries <span aria-hidden="true" className="ml-1">×</span></Button></div>}
      {tab === "creation" && <div aria-label="Journal register status" className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span role="status" aria-live="polite">{listLoading || listScopeStale && !listError ? <>Updating results...<span className="sr-only"> Previous results remain visible. Workflow actions are unavailable until current results arrive.</span></> : listError ? listUpdatedAt ? "Previous results - refresh failed" : "Journal results unavailable" : "Journal results current"}</span>
        {listUpdatedAt !== null && <span>Last updated <time dateTime={new Date(listUpdatedAt).toISOString()}>{new Date(listUpdatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT</time></span>}
      </div>}
      <AdjustingEntriesTable entries={entries} presentation={tab === "summary" ? "summary" : tab === "creation" ? "creation" : "posting"} loading={listLoading || busy} actionsDisabled={listScopeStale || Boolean(listError) || Boolean(accessError)} emptyMessage={tab === "creation" && !listError ? "No entries match this Creation scope." : listError && entries.length === 0 ? "Journal results are unavailable. Retry the journal request above." : listScopeStale && entries.length === 0 ? "Previous filter results were empty. Waiting for the current results." : postingQueue === "awaiting-my-review" ? "No entries are awaiting your review." : postingQueue === "ready-for-me-to-post" ? "No submitted or retryable entries are ready for you to post." : postingQueue === "my-drafts" ? "You have no draft entries." : undefined} userId={access?.userId} readOnly={tab === "summary" || !access || accessLoading || Boolean(accessError)} onView={(entry,edit,trigger) => { if ((initialView === "creation" || initialView === "posting" || initialView === "summary") && !edit) void openReview(entry,"view",trigger); else void view(entry,edit); }} onAction={requestAction} onReverse={entry => void previewReversal(entry)} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{totalElements > 0 ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalElements)} of ${totalElements} entries · Page ${page + 1} of ${Math.max(totalPages, 1)}` : "0 entries"}</span><div className="flex gap-2"><Button variant="outline" size="icon-sm" aria-label="Go to first page" disabled={page === 0 || listLoading} onClick={() => updateListQuery({ page:"0" })}><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" disabled={page === 0 || listLoading} onClick={() => updateListQuery({ page:String(page - 1) })}>Previous</Button><Button variant="outline" size="sm" disabled={listLoading || page + 1 >= totalPages} onClick={() => updateListQuery({ page:String(page + 1) })}>Next</Button><Button variant="outline" size="icon-sm" aria-label="Go to last page" disabled={listLoading || page + 1 >= totalPages} onClick={() => updateListQuery({ page:String(Math.max(0, totalPages - 1)) })}><ChevronsRight className="h-4 w-4" /></Button></div></div>
    </>}
    {periodOpen && period && <AjePeriodDialog period={period} onClose={() => setPeriodOpen(false)} onSaved={value => { setPeriod(value); setPeriodUpdatedAt(Date.now()); setPeriodError(""); }} />}
    <AlertDialog open={action !== null} onOpenChange={open => { if (!open && !busy) closeAction(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{action ? `${actionLabelForEntry(action.entry, action.action)} ${action.entry.jeNo}?` : "Confirm action"}</AlertDialogTitle><AlertDialogDescription>{action?.action === "reject-final" ? "This finally rejects the entry. It cannot be edited, resubmitted, or posted. A reason is required." : action?.action === "reject" ? "This returns the entry for correction and resubmission. A reason is required." : action?.action === "withdraw" ? "Withdrawal returns this entry to Draft so you can edit and resubmit it." : action?.action === "cancel" && action.entry.canCancelAfterReversalConflict ? "This cancels the failed full reversal and preserves the AJE and its audit history. It will not be permanently deleted." : action?.action === "post" || action?.action === "retry" ? "This commits the submitted entry to the General Ledger. Posted entries are read-only." : "This action updates the journal workflow and records an audit event."}</AlertDialogDescription></AlertDialogHeader>
      {action && ["post", "retry"].includes(action.action) ? <dl className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Reference</dt><dd className="break-words font-medium">{action.entry.reference || "No reference"}</dd></div>
        <div><dt className="text-muted-foreground">Accounting date</dt><dd className="font-medium">{formatDate(action.entry.transactionDate)}</dd></div>
        <div><dt className="text-muted-foreground">Debit total</dt><dd className="font-medium">{money(action.entry.totalDebit)}</dd></div>
        <div><dt className="text-muted-foreground">Credit total</dt><dd className="font-medium">{money(action.entry.totalCredit)}</dd></div>
      </dl> : action && <div className="text-sm">Debit {money(action.entry.totalDebit)} | Credit {money(action.entry.totalCredit)}</div>}
      {action && actionRequiresReason(action.entry,action.action) && <div className="space-y-1"><Label htmlFor="aje-action-reason">{action.action === "submit" ? "Revision notes *" : "Reason *"}</Label>{action.action === "submit" && <p id="aje-action-reason-hint" className="text-xs text-muted-foreground">Explain how you addressed the requested revisions. This note will appear in the audit trail.</p>}<Textarea id="aje-action-reason" aria-describedby={action.action === "submit" ? "aje-action-reason-hint" : undefined} maxLength={4000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div>}
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>{action?.action === "cancel" && action.entry.canCancelAfterReversalConflict ? "Keep AJE" : "Cancel"}</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => runAction(event)}>{busy ? "Working…" : action ? actionLabelForEntry(action.entry, action.action) : "Confirm"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
    <Dialog open={reversal !== null} onOpenChange={open => {if (!open) setReversal(null);}}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Reverse {reversal?.original.jeNo}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Posted reversals consume the eligible amounts of the original lines. Saving creates a new entry with its own journal number and For Revision status. Submit it for a different user to post. The original remains Posted.</p>
      <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Account</th><th className="p-2 text-right">Original</th><th className="p-2 text-right">Reversed</th><th className="p-2 text-right">Remaining</th></tr></thead><tbody>{reversal?.lines.map(d => <tr key={d.originalDetailId} className="border-t"><td className="p-2">{d.accountNumber} · {d.accountTitle}<p className="text-xs text-muted-foreground">{d.departmentName}</p></td><td className="p-2 text-right">{money(d.originalDebit + d.originalCredit)}</td><td className="p-2 text-right">{money(d.reversedAmount)}</td><td className="p-2 text-right">{money(d.remainingAmount)}</td></tr>)}</tbody></table></div>
      <DialogFooter><Button variant="outline" onClick={() => setReversal(null)}>Cancel</Button><Button variant="outline" disabled={!reversal?.lines.some(d => d.remainingAmount > 0)} onClick={() => createReversal("PARTIAL")}>Partial / remaining reversal</Button><Button disabled={!reversal?.canFullReverse} onClick={() => createReversal("FULL")}>Full reversal</Button></DialogFooter>
    </DialogContent></Dialog>
    {(initialView === "creation" || initialView === "posting" || initialView === "summary") && reviewEntry !== null && <React.Suspense fallback={<Dialog open onOpenChange={open => { if (!open) closeReview(); }}>
      <DialogContent className="sm:max-w-5xl" onCloseAutoFocus={restoreReviewFocus}><DialogHeader><DialogTitle>{reviewEntry.jeNo || "Review adjusting entry"}</DialogTitle></DialogHeader>
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading review dialog…</p>
        <DialogFooter><Button type="button" variant="outline" onClick={closeReview}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>}><AjeReviewDialog open journalNumber={reviewEntry.jeNo || null} entry={reviewDetails} attachments={reviewAttachments} loading={reviewLoading} error={reviewError} attachmentsLoading={reviewAttachmentsLoading} attachmentsError={reviewAttachmentsError} detailsUpdatedAt={reviewDetailsUpdatedAt} attachmentsUpdatedAt={reviewAttachmentsUpdatedAt} auditEvents={reviewAuditEvents} auditLoading={reviewAuditLoading} auditError={reviewAuditError} auditUpdatedAt={reviewAuditUpdatedAt} canReview={tab === "posting" && Boolean(access)} userId={access?.userId} confirmingPosting={reviewConfirmingPosting} postingBusy={busy} postingError={reviewPostingError} confirmingSubmission={reviewConfirmingSubmission} submissionBusy={busy} submissionError={reviewSubmissionError} submissionNotes={reviewSubmissionNotes} onSubmissionNotesChange={setReviewSubmissionNotes} onCancelSubmission={cancelReviewSubmission} onConfirmSubmission={(entry,notes) => void executeAction(entry,"submit",notes)} onAction={requestAction} onRequestPosting={requestReviewPosting} onCancelPosting={cancelReviewPosting} onConfirmPosting={entry => void executeAction(entry,entry.status === "Failed" ? "retry" : "post")} onRetryDetails={retryReviewDetails} onRetryAttachments={retryReviewAttachments} onRetryAudit={() => { if (reviewEntry) void refreshReviewAudit(reviewEntry.id); }} onClose={closeReview} onCloseAutoFocus={restoreReviewFocus} /></React.Suspense>}
  </div>;
}
