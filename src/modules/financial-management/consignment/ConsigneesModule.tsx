"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsigneeViewDialog, manilaTime } from "./components/ConsigneeViewDialog";
import { ConsignmentStatusBadge } from "./components/ConsignmentStatusBadge";
import { ConsigneeStatusTabs } from "./components/ConsigneeStatusTabs";
import { useConsignees } from "./hooks/useConsignees";
import { ConsigneeDraftDialog } from "./components/ConsigneeDraftDialog";
import { consigneeActionLabel, consigneeStatusLabel, formatRelativeTime, formatVatTreatment, isOlderThanDays } from "./utils/consignment-format";
import type { ConsigneeDetail, ConsigneeSummary, ConsignmentWorkspace } from "./types";

function emptyStateMessage(workspace: ConsignmentWorkspace, status: string, searching: boolean) {
  if (searching) return "No consignees match this search.";
  const label = consigneeStatusLabel(status).toLowerCase();
  if (workspace === "approvals") return status === "ALL" ? "No consignees in the approval history." : `No ${label} approvals.`;
  if (workspace === "my-submissions") return status === "DRAFT" ? "No drafts yet." : status === "ALL" ? "You have no consignment submissions yet." : `No ${label} submissions.`;
  return status === "DRAFT" ? "No draft consignees." : status === "ALL" ? "No consignee records are available." : `No ${label} consignees.`;
}

export default function ConsigneesModule({ workspace = "consignees" }: { workspace?: ConsignmentWorkspace }) {
  const title = workspace === "consignees" ? "Consignees" : workspace === "my-submissions" ? "My Submissions" : "Approvals";
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { query, setQuery, snapshot, loading, error, pending, refresh } = useConsignees(workspace);
  const [editor, setEditor] = useState<{ detail: ConsigneeDetail | null } | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ConsigneeSummary | null>(null);
  const [inspection, setInspection] = useState(0);
  const invoker = useRef<HTMLButtonElement | null>(null);
  const data = snapshot?.data;
  const applied = snapshot?.query;
  const denied = error?.status === 401 || error?.status === 403;
  const first = data && data.items.length ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data?.items.length ? first + data.items.length - 1 : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const status = query.status ?? "ALL";
  const resetFilters = () => {
    setSearch("");
    setQuery({ ...query, search: "", status: workspace === "approvals" ? "PENDING" : "ALL", page: 1 });
  };

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <main className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div>
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workspace === "consignees" ? "Create drafts and inspect consignee records and their default terms." : "Consignee records only. Review full details without leaving this workspace."}</p>
      </div><div className="flex flex-wrap gap-2">{!denied && workspace === "consignees" && <Button onClick={event => { invoker.current = event.currentTarget; setEditor({ detail: null }); }}>New consignee</Button>}<Button variant="outline" disabled={pending || denied} onClick={refresh}><RefreshCw className={pending ? "animate-spin" : ""} />Refresh</Button></div></div>
      {!denied && <form className="flex flex-wrap items-end gap-2 rounded-lg border p-3" onSubmit={event => { event.preventDefault(); setQuery({ ...query, search: search.trim(), page: 1 }); }}>
        <div className="min-w-0 flex-1 basis-56"><label htmlFor="consignee-search" className="mb-2 block text-sm font-medium">Search consignees</label>
          <Input id="consignee-search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Code or consignee name" /></div>
        <Button type="submit"><Search />Search</Button>
        <Button type="button" variant="outline" onClick={() => { setSearch(""); setQuery({ ...query, search: "", page: 1 }); }}>Clear search</Button>
        <Button type="button" variant="outline" onClick={resetFilters}>Reset filters</Button>
      </form>}
      <ConsigneeStatusTabs workspace={workspace} status={status} counts={data?.statusCounts} onChange={nextStatus => setQuery({ ...query, search: search.trim(), status: nextStatus, page: 1 })} disabled={pending || denied} />
      <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {loading ? snapshot ? "Refreshing consignees. Previous results remain visible." : "Loading consignees…"
          : error ? snapshot ? "Refresh failed. Earlier results remain visible." : "Consignees could not be loaded."
          : data ? `${data.total} matching consignee${data.total === 1 ? "" : "s"}.` : ""}
        {snapshot && <span className="mt-1 block">Last updated {manilaTime(snapshot.updated)}</span>}
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4">
        <p className="text-sm">{error.message}{snapshot ? " Displayed results may be stale." : ""}</p>
        {!denied && <Button variant="outline" onClick={refresh} disabled={loading}>Retry consignees</Button>}
      </div>}
      {!snapshot && loading && <div aria-hidden="true" className="space-y-3 rounded-lg border p-4">{[0, 1, 2, 3].map(row => <div key={row} className="h-12 animate-pulse rounded bg-muted" />)}</div>}
      {data && <section className="overflow-hidden rounded-lg border" aria-label="Consignee register" aria-busy={pending}>
        <div className="space-y-1 border-b p-3 text-sm"><p>Showing {first}–{last} of {data.total} consignees</p>
          <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground"><span>Applied status:</span><ConsignmentStatusBadge status={applied?.status ?? status} />{workspace !== "consignees" && <span>{workspace === "my-submissions" ? "Your consignee records, including draft corrections." : "Pending and reviewed consignees. Self-review is blocked."}</span>}</p>
          {applied?.search && <p className="break-words text-muted-foreground">Applied search: {applied.search}</p>}
          {pending && <p className="text-muted-foreground">Updating the requested page. The scope above describes the displayed results.</p>}
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">Consignee records. Open View to inspect available details.</caption>
          <thead className="border-b bg-muted/50"><tr>{["Code / Name", "VAT treatment", "Contact", "Status", workspace === "approvals" ? "Requester / Waiting" : workspace === "my-submissions" ? "Submitted" : "Updated", "Actions"].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{data.items.map(item => {
            const overdue = workspace === "approvals" && item.status === "PENDING" && isOlderThanDays(item.submittedAt);
            const actionLabel = consigneeActionLabel(workspace, item.status, item.createdByMe);
            return <tr key={item.id} className="border-b last:border-0">
              <td className="px-4 py-3"><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.code}</p></td>
              <td className="px-4 py-3">{formatVatTreatment(item.vatTreatment)}</td>
              <td className="px-4 py-3"><p>{item.contactPerson || "Not provided"}</p>{item.email && <p className="text-muted-foreground">{item.email}</p>}{item.phone && <p className="text-muted-foreground">{item.phone}</p>}</td>
              <td className="px-4 py-3">
                <ConsignmentStatusBadge status={item.status} />
                {item.status === "REJECTED" && item.rejectionReason && <p className="mt-1 max-w-56 truncate text-xs text-rose-700" title={item.rejectionReason}>Rejection: {item.rejectionReason}</p>}
                {workspace === "approvals" && item.status === "PENDING" && item.createdByMe && <p className="mt-1 text-xs text-amber-700">Awaiting another reviewer</p>}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {workspace === "approvals" ? <>
                  <p className="text-foreground">{item.createdBy || "Unknown"}{item.createdByMe ? " (you)" : ""}</p>
                  {item.status === "PENDING" && item.submittedAt ? <p className={overdue ? "font-medium text-amber-700" : ""} title={manilaTime(item.submittedAt)}>{formatRelativeTime(item.submittedAt)}{overdue ? " · over 2 days" : ""}</p> : <p>Not submitted</p>}
                </> : workspace === "my-submissions" ? <>
                  <p title={item.submittedAt ? manilaTime(item.submittedAt) : undefined}>{item.submittedAt ? formatRelativeTime(item.submittedAt) : "Not submitted"}</p>
                </> : <>
                  <p title={item.updatedAt ? manilaTime(item.updatedAt) : undefined}>{formatRelativeTime(item.updatedAt)}</p>
                </>}
              </td>
              <td className="px-4 py-3"><Button variant="outline" aria-label={`${actionLabel} ${item.name}`} onClick={event => { invoker.current = event.currentTarget; setInspection(value => value + 1); setSelected(item); }}>{actionLabel}</Button></td>
            </tr>;
          })}</tbody>
        </table></div>
        {data.items.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">
          <p>{emptyStateMessage(workspace, applied?.status ?? status, Boolean(applied?.search))}</p>
          {!applied?.search && workspace === "consignees" && <Button className="mt-3" onClick={event => { invoker.current = event.currentTarget; setEditor({ detail: null }); }}>Create consignee</Button>}
          {!applied?.search && workspace === "my-submissions" && <Link className="mt-3 inline-block font-medium text-primary hover:underline" href="/fm/consignment/consignees">Create a consignee</Link>}
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <label className="flex items-center gap-2 text-sm" htmlFor="consignee-page-size">Rows per page
            <select id="consignee-page-size" className="h-10 rounded-md border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" value={query.pageSize} disabled={pending} onChange={event => setQuery({ ...query, page: 1, pageSize: Number(event.target.value) })}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select>
          </label>
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm">Page {data.page} of {pages}</span>
            <Button variant="outline" disabled={pending || data.page <= 1} onClick={() => setQuery({ ...query, page: data.page - 1 })}>Previous</Button>
            <Button variant="outline" disabled={pending || data.page >= pages} onClick={() => setQuery({ ...query, page: data.page + 1 })}>Next</Button>
          </div>
        </div>
      </section>}
    </main>
    <ConsigneeViewDialog selected={denied ? null : selected} inspection={inspection} onClose={() => setSelected(null)} returnFocus={() => invoker.current?.isConnected ? invoker.current.focus() : titleRef.current?.focus()} workspace={workspace} onChanged={detail => { refresh(); setSelected(detail.summary); setInspection(value => value + 1); }} onEdit={detail => { setSelected(null); setEditor({ detail }); }} />
    {editor && !denied && <ConsigneeDraftDialog workspace={workspace} detail={editor.detail} onClose={() => setEditor(null)} returnFocus={() => invoker.current?.isConnected ? invoker.current.focus() : titleRef.current?.focus()} onSaved={detail => { setEditor(null); toast.success(`${detail.summary.code} saved as Draft.`); refresh(); setInspection(value => value + 1); setSelected(detail.summary); }} />}
  </div>;
}
