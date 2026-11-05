"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustingJournalEntriesApi as api, ajeAttachmentPreviewUrl, ajeAttachmentThumbnailUrl, ajeAttachmentUrl, ajeAuditReportUrl } from "../services/adjusting-journal-entries.api";
import type { AjeAttachment, AjeAuditEvent, AjeAuditPage, AdjustingEntry } from "../types";
import { AjeAttachmentPreview, isPreviewableAjeImage } from "./AjeAttachmentPreview";
import { AjeDataFreshness, AjeRetryAlert } from "./AjeDataFreshness";
import { auditEventSummary, formatDate, formatDateTime, money, statusBadgeClass, todayManila } from "./formatters";

const actions = ["Created","Edited","Submitted","Approved","Rejected","Returned for Revision","Workflow Migrated","Withdrawn","Revision Started","Cancelled","Posted","Posting Failed","Period Closed","Period Reopened","Supporting Document Added","Supporting Document Removed"];
const statuses = ["Draft","For Revision","Submitted","Posted","Cancelled","Failed","Voided"];
type AuditFilters = { search: string; userId: string; action: string; status: string; fromDate: string; toDate: string };
const auditPageSizes = [20, 50, 100] as const;
type AuditFilterKey = keyof AuditFilters;
type AuditUrlState = { filters: AuditFilters; page: number; pageSize: number };
type AuditAttachmentLookup = { attachmentsByEntry: Record<number, AjeAttachment[]>; failedEntryIds: Set<number>; loadedEntryIds: Set<number>; loading: boolean; error: string; updatedAt: number | null };

function isAuditDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseAuditUrlState(params: URLSearchParams): AuditUrlState {
  const userId = params.get("userId") || "";
  const page = Number(params.get("page"));
  const size = Number(params.get("size"));
  let fromDate = params.get("fromDate") || "";
  let toDate = params.get("toDate") || "";
  if (!isAuditDate(fromDate)) fromDate = "";
  if (!isAuditDate(toDate)) toDate = "";
  if (fromDate && toDate && fromDate > toDate) {
    fromDate = "";
    toDate = "";
  }

  return {
    filters: {
      search:params.get("search") || "",
      userId:/^[1-9]\d*$/.test(userId) ? userId : "",
      action:actions.includes(params.get("action") || "") ? params.get("action") || "" : "",
      status:statuses.includes(params.get("status") || "") ? params.get("status") || "" : "",
      fromDate,
      toDate,
    },
    page:Number.isSafeInteger(page) && page >= 0 ? page : 0,
    pageSize:auditPageSizes.includes(size as typeof auditPageSizes[number]) ? size : 20,
  };
}

function shiftDate(day: string, offset: number) {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + offset));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function auditDay(value: string) {
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("en-PH", { timeZone:"Asia/Manila", weekday:"long", year:"numeric", month:"long", day:"numeric" }).format(parsed);
}

function groupEvents(events: AjeAuditEvent[], dayCounts: Record<string, number>) {
  const groups = new Map<string, AjeAuditEvent[]>();
  for (const event of events) {
    const date = event.occurredAt?.slice(0, 10) || "unknown";
    groups.set(date, [...(groups.get(date) || []), event]);
  }
  return [...groups.entries()].map(([date, rows]) => [date, rows, dayCounts[date] ?? rows.length] as const);
}

function auditChangeValue(field: string, value: string | null | undefined) {
  if (!value) return "—";
  if (field !== "Journal lines") return value;
  return value.replace(/(\bDebit\s+)(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(,\s*Credit\s+)(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/g,
    (_match, debitLabel: string, debit: string, creditLabel: string, credit: string) => `${debitLabel}${money(Number(debit))}${creditLabel}${money(Number(credit))}`);
}

function actionBadgeClass(action: string) {
  switch (action) {
    case "Rejected":
    case "Cancelled":
    case "Failed":
    case "Posting Failed":
      return "border-red-500/30 bg-red-500/10 text-red-700";
    case "Approved":
    case "Posted":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    default:
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700";
  }
}

export function AjeAuditTrail({ entryId, revision }: { entryId?: number | null; revision: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamText = searchParams.toString();
  const { filters, page, pageSize } = React.useMemo(() => parseAuditUrlState(new URLSearchParams(searchParamText)), [searchParamText]);
  const [searchDraft, setSearchDraft] = React.useState(filters.search);
  const [data, setData] = React.useState<AjeAuditPage | null>(null);
  const [attachmentLookup, setAttachmentLookup] = React.useState<AuditAttachmentLookup>({ attachmentsByEntry:{}, failedEntryIds:new Set(), loadedEntryIds:new Set(), loading:false, error:"", updatedAt:null });
  const [users, setUsers] = React.useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadedQueryKey, setLoadedQueryKey] = React.useState("");
  const [dataRetryRevision, setDataRetryRevision] = React.useState(0);
  const [usersError, setUsersError] = React.useState("");
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [usersRetryRevision, setUsersRetryRevision] = React.useState(0);
  const [attachmentRetryRevision, setAttachmentRetryRevision] = React.useState(0);
  const [selectedEvent, setSelectedEvent] = React.useState<AjeAuditEvent | null>(null);
  const [selectedEntry, setSelectedEntry] = React.useState<AdjustingEntry | null>(null);
  const [entryUpdatedAt, setEntryUpdatedAt] = React.useState<number | null>(null);
  const [expandedEvents, setExpandedEvents] = React.useState<Set<number>>(() => new Set());
  const [entryLoading, setEntryLoading] = React.useState(false);
  const [entryError, setEntryError] = React.useState("");
  const requestId = React.useRef(0);
  const auditQueryKey = JSON.stringify({ entryId:entryId || null,filters,page,pageSize });
  const auditScopeStale = Boolean(data && loadedQueryKey !== auditQueryKey);

  React.useEffect(() => { setSearchDraft(filters.search); }, [filters.search]);

  function updateAuditQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const queryString = params.toString();
    window.history.replaceState(null, "", `${pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`);
  }

  React.useEffect(() => {
    let active = true;
    setUsersLoading(true);
    api.auditUsers().then(rows => {
      if (active) { setUsers(rows); setUsersError(""); }
    }).catch(e => { if (active) setUsersError(e instanceof Error ? e.message : "Unable to load audit user options"); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [revision,usersRetryRevision]);

  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page:String(page), size:String(pageSize) });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      if (entryId) params.set("entryId", String(entryId));
      api.audit(params).then(result => { if (active) { setData(result); setLoadedQueryKey(auditQueryKey); setError(""); } })
        .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load the audit trail"); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [entryId, filters, page, pageSize, revision, dataRetryRevision, auditQueryKey]);

  const attachmentEvents = React.useMemo(() => (data?.content || []).filter(event =>
    event.action === "Supporting Document Added" && event.entryId != null
      && event.changes.some(change => change.field === "Supporting document" && Boolean(change.after))), [data]);
  const attachmentEntryIds = React.useMemo(() => [...new Set(attachmentEvents.map(event => event.entryId!))].sort((a, b) => a - b), [attachmentEvents]);
  const attachmentRequestKey = `${(data?.content || []).map(event => event.id).join(",")}`;

  React.useEffect(() => {
    let active = true;
    setAttachmentLookup(current => ({ ...current, loading:true }));
    if (attachmentEntryIds.length === 0) {
      setAttachmentLookup(current => ({ ...current, failedEntryIds:new Set(), loadedEntryIds:new Set(), loading:false, error:"", updatedAt:Date.now() }));
      return () => { active = false; };
    }
    void api.attachmentsForEntries(attachmentEntryIds).then(attachments => {
      if (!active) return;
      setAttachmentLookup(current => {
        const attachmentsByEntry = { ...current.attachmentsByEntry };
        for (const entryId of attachmentEntryIds) attachmentsByEntry[entryId] = [];
        for (const attachment of attachments) (attachmentsByEntry[attachment.entryId] ||= []).push(attachment);
        return { ...current, attachmentsByEntry, failedEntryIds:new Set(), loadedEntryIds:new Set([...current.loadedEntryIds,...attachmentEntryIds]), loading:false, error:"", updatedAt:Date.now() };
      });
    }).catch(e => {
      if (!active) return;
      setAttachmentLookup(current => ({ ...current, failedEntryIds:new Set(attachmentEntryIds), loading:false, error:e instanceof Error ? e.message : "Unable to load document metadata" }));
    });
    return () => { active = false; };
  }, [attachmentEntryIds, attachmentRequestKey, attachmentRetryRevision]);

  function change(field: AuditFilterKey, value: string) {
    const updates: Record<string, string | null> = { [field]:value || null, page:"0" };
    if (field === "fromDate" && value && filters.toDate && value > filters.toDate) updates.toDate = null;
    if (field === "toDate" && value && filters.fromDate && value < filters.fromDate) updates.fromDate = null;
    updateAuditQuery(updates);
  }

  function applyDateRange(fromDate: string, toDate: string) {
    updateAuditQuery({ fromDate:fromDate || null, toDate:toDate || null, page:"0" });
  }

  function clearFilters() {
    updateAuditQuery({ search:null, userId:null, action:null, status:null, fromDate:null, toDate:null, page:"0", size:"20" });
  }

  function applyPreset(preset: "7days" | "30days" | "month" | "all") {
    const today = todayManila();
    if (preset === "7days") applyDateRange(shiftDate(today, -6), today);
    else if (preset === "30days") applyDateRange(shiftDate(today, -29), today);
    else if (preset === "month") applyDateRange(`${today.slice(0, 7)}-01`, today);
    else applyDateRange("", "");
  }

  async function loadSelectedEntry(entryId: number) {
    const request = ++requestId.current;
    setEntryLoading(true);
    try {
      const result = await api.get(entryId);
      if (request === requestId.current) { setSelectedEntry(result); setEntryUpdatedAt(Date.now()); setEntryError(""); }
    } catch (e) {
      if (request === requestId.current) setEntryError(e instanceof Error ? e.message : "Unable to load journal details");
    } finally {
      if (request === requestId.current) setEntryLoading(false);
    }
  }

  async function openEntry(event: AjeAuditEvent) {
    if (!event.entryId) return;
    setSelectedEvent(event);
    setSelectedEntry(null);
    setEntryUpdatedAt(null);
    setEntryError("");
    await loadSelectedEntry(event.entryId);
  }

  function closeEntry(open: boolean) {
    if (open) return;
    requestId.current += 1;
    setSelectedEvent(null);
    setSelectedEntry(null);
    setEntryUpdatedAt(null);
    setEntryError("");
    setEntryLoading(false);
  }

  function toggleEventDetails(eventId: number) {
    setExpandedEvents(current => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  const activeFilters = [
    filters.search && { key:"search" as const, label:`Search: ${filters.search}` },
    filters.userId && { key:"userId" as const, label:`User: ${users.find(user => String(user.id) === filters.userId)?.name || filters.userId}` },
    filters.action && { key:"action" as const, label:`Action: ${filters.action}` },
    filters.status && { key:"status" as const, label:`Current journal status: ${filters.status}` },
    filters.fromDate && { key:"fromDate" as const, label:`From: ${filters.fromDate}` },
    filters.toDate && { key:"toDate" as const, label:`To: ${filters.toDate}` },
  ].filter((filter): filter is { key: keyof AuditFilters; label: string } => Boolean(filter));
  const today = todayManila();
  const selectedPreset = filters.fromDate === shiftDate(today, -6) && filters.toDate === today ? "7days"
    : filters.fromDate === shiftDate(today, -29) && filters.toDate === today ? "30days"
      : filters.fromDate === `${today.slice(0, 7)}-01` && filters.toDate === today ? "month"
        : !filters.fromDate && !filters.toDate ? "all" : "custom";
  const groups = React.useMemo(() => groupEvents(data?.content || [], data?.dayCounts || {}), [data]);
  const totalPages = Math.max(1, data?.totalPages || 0);
  const firstResult = data?.content.length ? page * pageSize + 1 : 0;
  const lastResult = Math.min((page + 1) * pageSize, data?.totalElements || 0);
  const canClear = activeFilters.length > 0 || page > 0 || pageSize !== 20;
  const auditExportDisabled = loading || auditScopeStale || Boolean(error);
  function retryDocuments() {
    setAttachmentRetryRevision(value => value + 1);
  }

  return <div className="space-y-4">
    {usersError && <AjeRetryAlert message={`Audit user options: ${usersError}`} retrying={usersLoading} retryLabel="Retry user options" onRetry={() => setUsersRetryRevision(value => value + 1)} />}
    <div className="space-y-3 rounded-md border bg-background p-3" aria-label="Audit filters">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1"><Label htmlFor="audit-search">Search</Label><Input id="audit-search" value={searchDraft} onChange={e => { setSearchDraft(e.target.value); change("search",e.target.value); }} placeholder="Journal, reference, reason, or user" /></div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick date ranges">
          <Button type="button" size="sm" variant={selectedPreset === "7days" ? "default" : "outline"} onClick={() => applyPreset("7days")}>Last 7 days</Button>
          <Button type="button" size="sm" variant={selectedPreset === "30days" ? "default" : "outline"} onClick={() => applyPreset("30days")}>Last 30 days</Button>
          <Button type="button" size="sm" variant={selectedPreset === "month" ? "default" : "outline"} onClick={() => applyPreset("month")}>This month</Button>
          <Button type="button" size="sm" variant={selectedPreset === "all" ? "default" : "outline"} onClick={() => applyPreset("all")}>All dates</Button>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={auditExportDisabled} asChild><a href={ajeAuditReportUrl({ ...filters, entryId }, "csv")} aria-disabled={auditExportDisabled} onClick={event => { if (auditExportDisabled) event.preventDefault(); }}>Export CSV</a></Button>
          <Button type="button" variant="outline" size="sm" disabled={auditExportDisabled} asChild><a href={ajeAuditReportUrl({ ...filters, entryId }, "html")} target="_blank" rel="noreferrer" aria-disabled={auditExportDisabled} onClick={event => { if (auditExportDisabled) event.preventDefault(); }}>Print audit trail</a></Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <details className="group min-w-48 flex-1">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-sm font-medium hover:text-primary [&::-webkit-details-marker]:hidden">
            More filters
            {activeFilters.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{activeFilters.length}</span>}
          </summary>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="audit-user">User</Label><select id="audit-user" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.userId} onChange={e => change("userId",e.target.value)}><option value="">All users</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select>{usersLoading && <p role="status" className="text-xs text-muted-foreground">Loading user options…</p>}</div>
            <div className="space-y-1"><Label htmlFor="audit-action">Action</Label><select id="audit-action" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.action} onChange={e => change("action",e.target.value)}><option value="">All actions</option>{actions.map(action => <option key={action}>{action}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="audit-status">Current journal status</Label><select id="audit-status" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.status} onChange={e => change("status",e.target.value)}><option value="">All current statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="audit-from">From date</Label><Input id="audit-from" type="date" value={filters.fromDate} onChange={e => change("fromDate",e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="audit-to">To date</Label><Input id="audit-to" type="date" value={filters.toDate} onChange={e => change("toDate",e.target.value)} /></div>

          </div>
        </details>
        <Button type="button" variant="outline" size="sm" disabled={!canClear} onClick={clearFilters}>Clear filters</Button>
      </div>
      {activeFilters.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t pt-3" aria-label="Active audit filters">
        <span className="text-xs text-muted-foreground">Active:</span>
        {activeFilters.map(filter => <span key={filter.key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
          {filter.label}<button type="button" className="rounded-full px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Remove ${filter.label} filter`} onClick={() => change(filter.key,"")}>×</button>
        </span>)}
      </div>}
    </div>

    {auditScopeStale && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900">Filters changed. Showing audit events from the previous scope until the requested events load.</p>}
    {error && <AjeRetryAlert message={error} retrying={loading} retryLabel="Retry audit events" onRetry={() => setDataRetryRevision(value => value + 1)} />}
    {loading && !data?.content.length && <div aria-hidden="true" className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-muted/60"><tr>{["Timestamp","User","Action","Journal no.","Original / reference (current)","Detail / reason"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 5 }).map((_, index) => <tr key={index} className="border-t">
          {Array.from({ length: 6 }).map((__, column) => <td key={column} className="px-3 py-3"><div className="h-4 animate-pulse rounded bg-muted" style={{ width: `${55 + ((index + column) % 4) * 10}%` }} /></td>)}
        </tr>)}</tbody>
      </table>
    </div>}
    {loading && data?.content.length ? <p role="status" aria-live="polite" className="text-xs font-medium text-muted-foreground">Updating…</p> : null}
    {!loading && !error && !data?.content.length && <div className="rounded-md border p-6 text-center text-muted-foreground"><p>No audit events match these filters.</p>{canClear && <Button type="button" variant="link" size="sm" onClick={clearFilters}>Clear filters and show all events</Button>}</div>}

    {groups.length > 0 && <section aria-labelledby="audit-activity-heading" aria-busy={loading} className={loading || auditScopeStale ? "pointer-events-none space-y-2 opacity-60 transition-opacity" : "space-y-2"}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="audit-activity-heading" className="text-base font-semibold">Activity</h2><span className="text-xs text-muted-foreground">{data?.totalElements ?? 0} events</span></div>
      {attachmentLookup.error && <AjeRetryAlert message={`Supporting-document metadata: ${attachmentLookup.error}`} retrying={attachmentLookup.loading} retryLabel="Retry documents" onRetry={retryDocuments} />}
      <div className="space-y-3">
          {groups.map(([date, events, count]) => <section key={date} aria-label={`Audit events ${date}`} className="space-y-2">
            <h3 className="sticky top-0 z-[1] flex items-center justify-between gap-2 rounded-md bg-background/95 py-1 text-sm font-semibold text-muted-foreground backdrop-blur"><span>{date === "unknown" ? "Date unavailable" : auditDay(date)}</span><span className="text-xs font-normal">{count} {count === 1 ? "event" : "events"}</span></h3>
            <div className="overflow-x-auto rounded-md border">
              <table aria-label={`Audit activity for ${date}`} className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <caption className="sr-only">Audit activity with expandable event details for {date}</caption>
                <thead className="bg-muted/60"><tr>
                  <th scope="col" className="min-w-40 px-3 py-2 font-semibold">Timestamp</th>
                  <th scope="col" className="min-w-32 px-3 py-2 font-semibold">User</th>
                  <th scope="col" className="min-w-36 px-3 py-2 font-semibold">Action</th>
                  <th scope="col" className="min-w-36 px-3 py-2 font-semibold">Journal no.</th>
                  <th scope="col" className="min-w-52 px-3 py-2 font-semibold">Original / reference (current)</th>
                  <th scope="col" className="min-w-[20rem] px-3 py-2 font-semibold">Detail / reason</th>
                </tr></thead>
                <tbody className="divide-y">
            {events.map(event => {
              const expanded = expandedEvents.has(event.id);
              const detailsId = `audit-event-details-${event.id}`;
              const attachmentChange = event.changes.find(change => change.field === "Supporting document");
              const fileName = attachmentChange?.after;
              const isAttachmentEvent = event.action === "Supporting Document Added" && event.entryId != null && Boolean(fileName);
              let attachment: AjeAttachment | undefined;
              let attachmentStatus: string | undefined;
              if (isAttachmentEvent && event.entryId != null && fileName) {
                const lookupReady = attachmentLookup.loadedEntryIds.has(event.entryId) || attachmentLookup.failedEntryIds.has(event.entryId);
                const lookupFailed = attachmentLookup.failedEntryIds.has(event.entryId) && !attachmentLookup.loadedEntryIds.has(event.entryId);
                const candidates = lookupReady && !lookupFailed ? attachmentLookup.attachmentsByEntry[event.entryId] || [] : [];
                const matches = attachmentChange?.attachmentId != null
                  ? candidates.filter(item => item.id === attachmentChange.attachmentId)
                  : candidates.filter(item => item.filename === fileName);
                attachment = matches.length === 1 ? matches[0] : undefined;
                const ambiguousLegacyMatch = attachmentChange?.attachmentId == null && matches.length > 1;
                attachmentStatus = !lookupReady ? "Loading attachment…" : lookupFailed ? "Preview unavailable" : ambiguousLegacyMatch ? "Attachment identity is ambiguous" : "Attachment no longer available";
              }
              const referenceItems = event.originalJournalNumber
                ? [
                    { label: "Original", value: event.originalJournalNumber },
                    ...(event.originalReference ? [{ label: "Original ref", value: event.originalReference }] : []),
                    ...(event.currentReference && event.currentReference !== event.originalReference ? [{ label: "Entry ref", value: event.currentReference }] : []),
                  ]
                : event.currentReference ? [{ label: "Reference", value: event.currentReference }] : [];
              return <React.Fragment key={event.id}>
                <tr className="align-top hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground"><time dateTime={event.occurredAt} title={formatDateTime(event.occurredAt)}>{formatDateTime(event.occurredAt)}</time></td>
                  <td className="px-3 py-2.5">{event.actorName || "Name unavailable"}</td>
                  <td className="px-3 py-2.5"><Badge variant="outline" className={actionBadgeClass(event.action)}>{event.action}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-2.5">{event.entryId ? <Button type="button" variant="link" className="h-auto p-0 text-left" onClick={() => void openEntry(event)}>{event.journalNumber || `Open entry #${event.entryId}`}</Button> : <span>{event.journalNumber || "Period controls"}</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{event.entryId == null ? <span className="text-muted-foreground">Not applicable</span>
                    : !event.currentEntryAvailable ? <span className="text-muted-foreground">Information unavailable</span>
                      : <div className="space-y-0.5">{!event.originalJournalNumber && <p className="text-muted-foreground">No original journal</p>}{referenceItems.map(item => <p key={item.label} className="break-words"><span className="text-muted-foreground">{item.label}:</span> {item.value}</p>)}</div>}</td>
                  <td className="px-3 py-2.5"><div className="space-y-1"><p className="line-clamp-2 break-words" title={auditEventSummary(event)}>{auditEventSummary(event)}</p><Button type="button" variant="link" size="sm" className="h-auto px-0 py-0 text-xs" aria-expanded={expanded} aria-controls={expanded ? detailsId : undefined} aria-label={`${expanded ? "Hide" : "Show"} details for ${event.journalNumber || `event ${event.id}`}`} onClick={() => toggleEventDetails(event.id)}>{expanded ? "Hide details" : "Show details"}</Button></div></td>
                </tr>
                {expanded && <tr className="bg-muted/10"><td colSpan={6} className="px-3 py-3">
                  <div id={detailsId} className="space-y-3 rounded-md border bg-background p-3 sm:p-4">
                    {event.reason && <section aria-label="Event reason"><h3 className="text-xs font-semibold text-muted-foreground">Reason / detail</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{event.reason}</p></section>}
                    <section aria-label="Changes recorded at this event">
                      <h3 className="text-xs font-semibold">Changes recorded at this event</h3>
                      {event.changes.length ? <div className="mt-2 divide-y rounded-md border">
                        <div className="hidden grid-cols-[minmax(8rem,0.7fr)_1fr_1fr] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium sm:grid"><span>Field</span><span>Before</span><span>After</span></div>
                        {event.changes.map((change, index) => <div key={`${change.field}-${index}`} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(8rem,0.7fr)_1fr_1fr] sm:gap-3">
                          <p className="font-medium">{change.field}</p>
                          <div><p className="text-xs text-muted-foreground sm:sr-only">Before</p><p className="whitespace-pre-wrap break-words text-sm">{auditChangeValue(change.field, change.before)}</p></div>
                          <div><p className="text-xs text-muted-foreground sm:sr-only">After</p><p className="whitespace-pre-wrap break-words text-sm">{auditChangeValue(change.field, change.after)}</p></div>
                        </div>)}
                      </div> : <p className="mt-1 text-sm text-muted-foreground">No field changes recorded.</p>}
                    </section>
                    {isAttachmentEvent && fileName && <section aria-label={`Attachment ${fileName}`} className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground">Supporting document</h3>
                      {attachment ? (() => {
                        const ready = attachment.state === "READY";
                        const previewable = ready && isPreviewableAjeImage(attachment.mimeType, attachment.filename);
                        return <AjeAttachmentPreview key={`${event.id}-${attachment.id}`} fileName={attachment.filename}
                          downloadUrl={ready ? ajeAttachmentUrl(attachment.entryId, attachment.id) : undefined}
                          openDownloadInNewTab thumbnailUrl={previewable ? ajeAttachmentThumbnailUrl(attachment.entryId, attachment.id) : undefined}
                          previewUrl={previewable ? ajeAttachmentPreviewUrl(attachment.entryId, attachment.id) : undefined}
                          statusText={ready ? undefined : "Upload incomplete"}
                          metadata={`${attachment.uploadedByName} · ${formatDateTime(attachment.uploadedAt)}`} />;
                      })() : <div className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-sm"><span className="break-all">{fileName}</span><span className="text-xs text-muted-foreground">{attachmentStatus}</span></div>}
                    </section>}
                    {event.entryId != null && <section aria-label="Current journal context" className="rounded-md border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="text-sm font-semibold">Current journal context</h3>
                        <span className="text-xs text-muted-foreground">As of now, not at the event timestamp</span>
                      </div>
                      {event.currentEntryAvailable ? <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        <span><span className="text-muted-foreground">Current status:</span> {event.status || "Unavailable"}</span>
                        {event.currentTotalDebit != null && <span><span className="text-muted-foreground">Current debit total:</span> {money(event.currentTotalDebit)}</span>}
                        {event.currentTotalCredit != null && <span><span className="text-muted-foreground">Current credit total:</span> {money(event.currentTotalCredit)}</span>}
                      </div> : <p className="mt-2 text-sm text-muted-foreground">Information unavailable.</p>}
                    </section>}
                  </div>
                </td></tr>}
              </React.Fragment>;
            })}
                </tbody>
              </table>
            </div>
          </section>)}
      </div>
    </section>}

    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">            <div className="space-y-1"><Label htmlFor="audit-page-size">Rows per page</Label><select id="audit-page-size" className="h-9 w-full rounded-md border bg-background px-2 text-sm" disabled={loading} value={pageSize} onChange={e => updateAuditQuery({ size:e.target.value, page:"0" })}><option value={20}>20 events</option><option value={50}>50 events</option><option value={100}>100 events</option></select></div><span>Showing {firstResult}–{lastResult} of {data?.totalElements ?? 0} events · Page {page + 1} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="icon-sm" aria-label="Go to first page" disabled={page === 0 || loading} onClick={() => updateAuditQuery({ page:"0" })}><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => updateAuditQuery({ page:String(page - 1) })}>Previous</Button><Button variant="outline" size="sm" disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => updateAuditQuery({ page:String(page + 1) })}>Next</Button><Button variant="outline" size="icon-sm" aria-label="Go to last page" disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => updateAuditQuery({ page:String(totalPages - 1) })}><ChevronsRight className="h-4 w-4" /></Button></div></div>

    <Dialog open={selectedEvent !== null} onOpenChange={closeEntry}>
      <DialogContent className="grid-cols-1 min-w-0 max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{selectedEntry?.jeNo || selectedEvent?.journalNumber || "Journal entry details"}</DialogTitle>
          <DialogDescription>Read-only journal details opened from its audit event.</DialogDescription>
          <AjeDataFreshness label="Journal details" updatedAt={entryUpdatedAt} loading={entryLoading} stale={Boolean(entryError)} />
        </DialogHeader>
        {entryLoading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading journal details…</p>}
        {entryError && <AjeRetryAlert message={entryError} retrying={entryLoading} retryLabel="Retry details" onRetry={() => { if (selectedEvent?.entryId) void loadSelectedEntry(selectedEvent.entryId); }} />}
        {selectedEntry && <div className="space-y-4">
          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className={statusBadgeClass(selectedEntry.status)}>{selectedEntry.status}</Badge></div>
            <div><p className="text-xs text-muted-foreground">Accounting date</p><p className="text-sm">{formatDate(selectedEntry.transactionDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Reference</p><p className="break-words text-sm">{selectedEntry.reference || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Created by</p><p className="text-sm">{selectedEntry.creatorName || "—"}</p></div>
            {selectedEntry.sourceJeNo && <div><p className="text-xs text-muted-foreground">Original journal</p><p className="text-sm">{selectedEntry.sourceJeNo}</p></div>}
            <div className="sm:col-span-2 lg:col-span-4"><p className="text-xs text-muted-foreground">Description</p><p className="whitespace-pre-wrap break-words text-sm">{selectedEntry.description || "—"}</p></div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/30"><tr><th className="p-2 text-left">Account</th><th className="p-2 text-left">Department</th><th className="p-2 text-left">Line description</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead>
              <tbody>{selectedEntry.details.map((line, index) => <tr key={line.id ?? index} className="border-t"><td className="p-2">{[line.accountNumber, line.accountTitle].filter(Boolean).join(" · ") || "—"}</td><td className="p-2">{line.departmentName || "—"}</td><td className="p-2">{line.description || "—"}</td><td className="p-2 text-right font-mono">{money(line.debit)}</td><td className="p-2 text-right font-mono">{money(line.credit)}</td></tr>)}</tbody>
              <tfoot className="border-t bg-muted/20"><tr><td className="p-2 font-semibold" colSpan={3}>Totals</td><td className="p-2 text-right font-mono">{money(selectedEntry.totalDebit)}</td><td className="p-2 text-right font-mono">{money(selectedEntry.totalCredit)}</td></tr></tfoot>
            </table>
          </div>
        </div>}
        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
