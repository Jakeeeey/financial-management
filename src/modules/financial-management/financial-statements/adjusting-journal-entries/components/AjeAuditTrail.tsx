"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustingJournalEntriesApi as api, ajeAttachmentPreviewUrl, ajeAttachmentThumbnailUrl, ajeAttachmentUrl, ajeAuditReportUrl } from "../services/adjusting-journal-entries.api";
import type { AjeAttachment, AjeAuditEvent, AjeAuditPage, AdjustingEntry } from "../types";
import { AjeAttachmentPreview, isPreviewableAjeImage } from "./AjeAttachmentPreview";
import { formatDate, formatDateTime, formatRelativeDateTime, money, statusBadgeClass, todayManila } from "./formatters";

const actions = ["Created","Edited","Submitted","Approved","Rejected","Withdrawn","Revision Started","Cancelled","Posted","Posting Failed","Period Closed","Period Reopened","Supporting Document Added","Supporting Document Removed"];
const statuses = ["Draft","Submitted","Approved","Rejected","Posted","Cancelled","Failed","Voided"];
const emptyFilters = { search:"", userId:"", action:"", status:"", fromDate:"", toDate:"" };
type AuditFilters = typeof emptyFilters;
type AuditAttachmentLookup = { requestKey: string; attachmentsByEntry: Record<number, AjeAttachment[]>; failedEntryIds: Set<number> };

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
  const [filters, setFilters] = React.useState<AuditFilters>(emptyFilters);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [data, setData] = React.useState<AjeAuditPage | null>(null);
  const [attachmentLookup, setAttachmentLookup] = React.useState<AuditAttachmentLookup>({ requestKey:"", attachmentsByEntry:{}, failedEntryIds:new Set() });
  const [users, setUsers] = React.useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [selectedEvent, setSelectedEvent] = React.useState<AjeAuditEvent | null>(null);
  const [selectedEntry, setSelectedEntry] = React.useState<AdjustingEntry | null>(null);
  const [entryLoading, setEntryLoading] = React.useState(false);
  const [entryError, setEntryError] = React.useState("");
  const requestId = React.useRef(0);

  React.useEffect(() => {
    let active = true;
    api.auditUsers().then(rows => { if (active) setUsers(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, [revision]);

  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page:String(page), size:String(pageSize) });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      if (entryId) params.set("entryId", String(entryId));
      api.audit(params).then(result => { if (active) { setData(result); setError(""); } })
        .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load the audit trail"); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [entryId, filters, page, pageSize, revision]);

  const attachmentEvents = React.useMemo(() => (data?.content || []).filter(event =>
    event.action === "Supporting Document Added" && event.entryId != null
      && event.changes.some(change => change.field === "Supporting document" && Boolean(change.after))), [data]);
  const attachmentEntryIds = React.useMemo(() => [...new Set(attachmentEvents.map(event => event.entryId!))].sort((a, b) => a - b), [attachmentEvents]);
  const attachmentRequestKey = `${revision}:${(data?.content || []).map(event => event.id).join(",")}`;

  React.useEffect(() => {
    if (attachmentEntryIds.length === 0) return;
    let active = true;
    void Promise.all(attachmentEntryIds.map(async entryId => {
      try {
        return { entryId, attachments: await api.attachments(entryId) };
      } catch {
        return { entryId, attachments: null };
      }
    })).then(results => {
      if (!active) return;
      const attachmentsByEntry: Record<number, AjeAttachment[]> = {};
      const failedEntryIds = new Set<number>();
      for (const result of results) {
        if (result.attachments) attachmentsByEntry[result.entryId] = result.attachments;
        else failedEntryIds.add(result.entryId);
      }
      setAttachmentLookup({ requestKey:attachmentRequestKey, attachmentsByEntry, failedEntryIds });
    });
    return () => { active = false; };
  }, [attachmentEntryIds, attachmentRequestKey]);

  function change(field: keyof AuditFilters, value: string) {
    setFilters(current => ({ ...current, [field]:value }));
    setPage(0);
  }

  function applyDateRange(fromDate: string, toDate: string) {
    setFilters(current => ({ ...current, fromDate, toDate }));
    setPage(0);
  }

  function applyPreset(preset: "7days" | "30days" | "month" | "all") {
    const today = todayManila();
    if (preset === "7days") applyDateRange(shiftDate(today, -6), today);
    else if (preset === "30days") applyDateRange(shiftDate(today, -29), today);
    else if (preset === "month") applyDateRange(`${today.slice(0, 7)}-01`, today);
    else applyDateRange("", "");
  }

  async function openEntry(event: AjeAuditEvent) {
    if (!event.entryId) return;
    const request = ++requestId.current;
    setSelectedEvent(event);
    setSelectedEntry(null);
    setEntryError("");
    setEntryLoading(true);
    try {
      const result = await api.get(event.entryId);
      if (request === requestId.current) setSelectedEntry(result);
    } catch (e) {
      if (request === requestId.current) setEntryError(e instanceof Error ? e.message : "Unable to load journal details");
    } finally {
      if (request === requestId.current) setEntryLoading(false);
    }
  }

  function closeEntry(open: boolean) {
    if (open) return;
    requestId.current += 1;
    setSelectedEvent(null);
    setSelectedEntry(null);
    setEntryError("");
    setEntryLoading(false);
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

  return <div className="space-y-4">
    <div className="space-y-3 rounded-md border bg-background p-3" aria-label="Audit filters">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1"><Label htmlFor="audit-search">Search</Label><Input id="audit-search" value={filters.search} onChange={e => change("search",e.target.value)} placeholder="Journal, reference, reason, or user" /></div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick date ranges">
          <Button type="button" size="sm" variant={selectedPreset === "7days" ? "default" : "outline"} onClick={() => applyPreset("7days")}>Last 7 days</Button>
          <Button type="button" size="sm" variant={selectedPreset === "30days" ? "default" : "outline"} onClick={() => applyPreset("30days")}>Last 30 days</Button>
          <Button type="button" size="sm" variant={selectedPreset === "month" ? "default" : "outline"} onClick={() => applyPreset("month")}>This month</Button>
          <Button type="button" size="sm" variant={selectedPreset === "all" ? "default" : "outline"} onClick={() => applyPreset("all")}>All dates</Button>
        </div>
        <div className="ml-auto flex gap-2">
          <a className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent" href={ajeAuditReportUrl({ ...filters, entryId }, "csv")}>Export CSV</a>
          <a className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent" href={ajeAuditReportUrl({ ...filters, entryId }, "html")} target="_blank" rel="noreferrer">Print audit trail</a>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <details className="group min-w-48 flex-1">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-sm font-medium hover:text-primary [&::-webkit-details-marker]:hidden">
            More filters
            {activeFilters.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{activeFilters.length}</span>}
          </summary>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="audit-user">User</Label><select id="audit-user" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.userId} onChange={e => change("userId",e.target.value)}><option value="">All users</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="audit-action">Action</Label><select id="audit-action" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.action} onChange={e => change("action",e.target.value)}><option value="">All actions</option>{actions.map(action => <option key={action}>{action}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="audit-status">Current journal status</Label><select id="audit-status" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.status} onChange={e => change("status",e.target.value)}><option value="">All current statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="audit-from">From date</Label><Input id="audit-from" type="date" value={filters.fromDate} onChange={e => change("fromDate",e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="audit-to">To date</Label><Input id="audit-to" type="date" value={filters.toDate} onChange={e => change("toDate",e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="audit-page-size">Rows per page</Label><select id="audit-page-size" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}><option value={20}>20 events</option><option value={50}>50 events</option><option value={100}>100 events</option></select></div>
          </div>
        </details>
        <Button type="button" variant="outline" size="sm" disabled={activeFilters.length === 0} onClick={() => { setFilters(emptyFilters); setPage(0); }}>Clear filters</Button>
      </div>
      {activeFilters.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t pt-3" aria-label="Active audit filters">
        <span className="text-xs text-muted-foreground">Active:</span>
        {activeFilters.map(filter => <span key={filter.key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
          {filter.label}<button type="button" className="rounded-full px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Remove ${filter.label} filter`} onClick={() => change(filter.key,"")}>×</button>
        </span>)}
      </div>}
    </div>

    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && !data?.content.length && <div className="space-y-3" aria-hidden="true">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="space-y-3 rounded-md border bg-background p-3 sm:p-4"><div className="flex items-center gap-2"><div className="h-5 w-20 animate-pulse rounded bg-muted" /><div className="h-5 w-16 animate-pulse rounded bg-muted" /></div><div className="h-4 w-64 animate-pulse rounded bg-muted" /><div className="h-4 w-40 animate-pulse rounded bg-muted" /></div>)}</div>}
    {loading && data?.content.length ? <p role="status" aria-live="polite" className="text-xs font-medium text-muted-foreground">Updating…</p> : null}
    {!loading && !error && !data?.content.length && <div className="rounded-md border p-6 text-center text-muted-foreground"><p>No audit events match these filters.</p>{activeFilters.length > 0 && <Button type="button" variant="link" size="sm" onClick={() => { setFilters(emptyFilters); setPage(0); }}>Clear filters and show all events</Button>}</div>}

    {groups.length > 0 && <div aria-busy={loading} className={loading ? "pointer-events-none space-y-3 opacity-60 transition-opacity" : "space-y-3"}>
    {groups.map(([date, events, count]) => <section key={date} aria-label={`Audit events ${date}`} className="space-y-3">
      <h2 className="sticky top-0 z-[1] flex items-center justify-between gap-2 rounded-md bg-background/95 py-1 text-sm font-semibold text-muted-foreground backdrop-blur"><span>{date === "unknown" ? "Date unavailable" : auditDay(date)}</span><span className="text-xs font-normal">{count} {count === 1 ? "event" : "events"}</span></h2>
      <ol className="ml-2 space-y-3 border-l pl-4">
        {events.map(event => {
          const statusChange = event.changes.find(change => change.field === "Status");
          const otherChanges = event.changes.filter(change => change.field !== "Status");
          return <li key={event.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[1.32rem] top-4 size-2.5 rounded-full border-2 border-background bg-primary" />
          <article className="space-y-3 rounded-md border bg-background p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span>Event</span><Badge variant="outline" className={actionBadgeClass(event.action)}>{event.action}</Badge></span>
                  {event.entryId != null && event.status && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span>Current journal status</span><Badge variant="outline" className={statusBadgeClass(event.status)}>{event.status}</Badge></span>}
                </div>
                <p className="text-sm text-muted-foreground">{event.actorName || "Name unavailable"} · <time dateTime={event.occurredAt} title={formatDateTime(event.occurredAt)}>{formatRelativeDateTime(event.occurredAt)} · {formatDateTime(event.occurredAt)}</time></p>
              </div>
              {event.entryId ? <Button type="button" variant="link" className="h-auto p-0" onClick={() => void openEntry(event)}>{event.journalNumber || `Open entry #${event.entryId}`}</Button>
                : <span className="text-sm font-medium">{event.journalNumber || "Period controls"}</span>}
            </div>
            {statusChange && <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm" aria-label={statusChange.before ? `Status changed from ${statusChange.before} to ${statusChange.after || "unavailable"}` : `Initial status ${statusChange.after || "unavailable"}`}>
              <span className="text-xs font-semibold text-muted-foreground">{statusChange.before ? "Status changed" : "Initial status"}</span>
              <span className="inline-flex items-center gap-2">
                {statusChange.before && <><Badge variant="outline" className={statusBadgeClass(statusChange.before)}>{statusChange.before}</Badge><span aria-label="changed to">→</span></>}
                <Badge variant="outline" className={statusBadgeClass(statusChange.after || "")}>{statusChange.after || "Unavailable"}</Badge>
              </span>
            </div>}
            {event.currentTotalDebit != null && event.currentTotalCredit != null && <p className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">Current journal totals <span className="font-medium text-foreground">· Debit {money(event.currentTotalDebit)} · Credit {money(event.currentTotalCredit)}</span></p>}
            {event.reason && <p className="rounded-md bg-muted/40 p-3 text-sm"><span className="font-medium">Reason:</span> {event.reason}</p>}
            {otherChanges.length === 1 && <div className="rounded-md border bg-muted/20 p-3 text-sm" aria-label={`Change to ${otherChanges[0].field}`}>
              <span className="font-medium">{otherChanges[0].field}:</span>{" "}
              <span className="whitespace-pre-wrap break-words text-muted-foreground">{otherChanges[0].before || "—"}</span>{" "}
              <span aria-label="changed to">→</span>{" "}
              <span className="whitespace-pre-wrap break-words">{otherChanges[0].after || "—"}</span>
            </div>}
            {event.action === "Supporting Document Added" && event.entryId != null && (() => {
              const fileName = event.changes.find(change => change.field === "Supporting document")?.after;
              if (!fileName) return null;
              const lookupReady = attachmentLookup.requestKey === attachmentRequestKey;
              const file = lookupReady ? attachmentLookup.attachmentsByEntry[event.entryId]?.find(attachment => attachment.filename === fileName) : undefined;
              const lookupFailed = lookupReady && attachmentLookup.failedEntryIds.has(event.entryId);
              if (!file) {
                const statusText = !lookupReady ? "Loading attachment…" : lookupFailed ? "Preview unavailable" : "Attachment no longer available";
                return <div className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-sm" aria-label={`Attachment ${fileName}`}>
                  <span className="break-all">{fileName}</span>
                  <span className="text-xs text-muted-foreground">{statusText}</span>
                </div>;
              }
              const ready = file.state === "READY";
              const previewable = ready && isPreviewableAjeImage(file.mimeType, file.filename);
              return <AjeAttachmentPreview key={`${event.id}-${file.id}`} fileName={file.filename}
                downloadUrl={ready ? ajeAttachmentUrl(file.entryId, file.id) : undefined}
                openDownloadInNewTab
                thumbnailUrl={previewable ? ajeAttachmentThumbnailUrl(file.entryId, file.id) : undefined}
                previewUrl={previewable ? ajeAttachmentPreviewUrl(file.entryId, file.id) : undefined}
                statusText={ready ? undefined : "Upload incomplete"}
                metadata={`${file.uploadedByName} · ${formatDateTime(file.uploadedAt)}`} />;
            })()}
            {otherChanges.length > 1 && <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">View {otherChanges.length} changes</summary>
              <div className="mt-2 space-y-2">
                {otherChanges.map((change, index) => <div key={index} className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[minmax(8rem,0.7fr)_1fr_1fr]">
                  <p className="font-medium sm:row-span-2">{change.field}</p>
                  <div><p className="text-xs text-muted-foreground">Before</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{change.before || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">After</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{change.after || "—"}</p></div>
                </div>)}
              </div>
            </details>}
          </article>
        </li>;
        })}
      </ol>
    </section>)}
    </div>}

    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Showing {firstResult}–{lastResult} of {data?.totalElements ?? 0} events · Page {page + 1} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="icon-sm" aria-label="Go to first page" disabled={page === 0 || loading} onClick={() => setPage(0)}><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button><Button variant="outline" size="icon-sm" aria-label="Go to last page" disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => setPage(totalPages - 1)}><ChevronsRight className="h-4 w-4" /></Button></div></div>

    <Dialog open={selectedEvent !== null} onOpenChange={closeEntry}>
      <DialogContent className="grid-cols-1 min-w-0 max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{selectedEntry?.jeNo || selectedEvent?.journalNumber || "Journal entry details"}</DialogTitle>
          <DialogDescription>Read-only journal details opened from its audit event.</DialogDescription>
        </DialogHeader>
        {entryLoading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading journal details…</p>}
        {entryError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{entryError}</p>}
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
