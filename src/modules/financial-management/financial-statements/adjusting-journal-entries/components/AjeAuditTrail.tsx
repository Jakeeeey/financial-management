"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustingJournalEntriesApi as api } from "../services/adjusting-journal-entries.api";
import type { AjeAuditPage } from "../types";
import { formatDateTime } from "./formatters";

const actions = ["Created","Edited","Submitted","Approved","Rejected","Withdrawn","Revision Started","Cancelled","Posted","Posting Failed","Period Closed","Period Reopened","Supporting Document Added","Supporting Document Removed"];
const statuses = ["Draft","Submitted","Approved","Rejected","Posted","Cancelled","Failed","Voided"];
export function AjeAuditTrail({ entryId, revision }: { entryId?: number | null; revision: number }) {
  const [filters, setFilters] = React.useState({ search:"", userId:"", action:"", status:"", fromDate:"", toDate:"" });
  const [page, setPage] = React.useState(0);
  const [data, setData] = React.useState<AjeAuditPage | null>(null);
  const [users, setUsers] = React.useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    api.auditUsers().then(rows => { if (active) setUsers(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, [revision]);
  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), size:"20" });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      if (entryId) params.set("entryId", String(entryId));
      api.audit(params).then(result => { if (active) { setData(result); setError(""); } })
        .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load the audit trail"); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [entryId, filters, page, revision]);
  function change(field: keyof typeof filters, value: string) { setFilters(current => ({ ...current, [field]: value })); setPage(0); }
  return <div className="space-y-4">
    <div className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-2 xl:grid-cols-6">
      <div className="space-y-1"><Label htmlFor="audit-search">Search</Label><Input id="audit-search" value={filters.search} onChange={e => change("search",e.target.value)} placeholder="Journal, reference, or user" /></div>
      <div className="space-y-1"><Label htmlFor="audit-user">User</Label><select id="audit-user" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.userId} onChange={e => change("userId",e.target.value)}><option value="">All users</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="audit-action">Action</Label><select id="audit-action" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.action} onChange={e => change("action",e.target.value)}><option value="">All actions</option>{actions.map(a => <option key={a}>{a}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="audit-status">Journal status</Label><select id="audit-status" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={filters.status} onChange={e => change("status",e.target.value)}><option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="audit-from">From date</Label><Input id="audit-from" type="date" value={filters.fromDate} onChange={e => change("fromDate",e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="audit-to">To date</Label><Input id="audit-to" type="date" value={filters.toDate} onChange={e => change("toDate",e.target.value)} /></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && <p className="text-sm text-muted-foreground">Loading audit history…</p>}
    {!loading && !error && !data?.content.length && <p className="rounded-md border p-6 text-center text-muted-foreground">No audit events match these filters.</p>}
    {data?.content.map(event => <article key={event.id} className="space-y-3 rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{event.action} · {event.journalNumber || "Period controls"}</p><p className="text-sm text-muted-foreground">{event.actorName} · {formatDateTime(event.occurredAt)}</p></div>{event.status && <span className="text-xs text-muted-foreground">Current status: {event.status}</span>}</div>
      {event.reason && <p className="text-sm"><span className="font-medium">Reason:</span> {event.reason}</p>}
      {event.changes.length > 0 && <details><summary className="cursor-pointer text-sm text-primary">View changes</summary><div className="mt-2 space-y-3">{event.changes.map((change,index) => <div key={index} className="rounded-md bg-muted/30 p-3 text-sm"><p className="mb-2 font-medium">{change.field}</p><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Before</p><p className="whitespace-pre-wrap break-words">{change.before || "—"}</p></div><div><p className="text-xs text-muted-foreground">After</p><p className="whitespace-pre-wrap break-words">{change.after || "—"}</p></div></div></div>)}</div></details>}
    </article>)}
    <div className="flex items-center justify-between text-sm"><span>{data?.totalElements ?? 0} events · Page {page + 1} of {Math.max(1,data?.totalPages || 0)}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></div>
  </div>;
}

