"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgreementDraftDialog } from "./components/AgreementDraftDialog";
import { AgreementViewDialog } from "./components/AgreementViewDialog";
import { manilaTime } from "./components/ConsigneeViewDialog";
import { useAgreements } from "./hooks/useAgreements";
import { agreementDate } from "./utils/agreement-fields";
import type { AgreementDetail } from "./agreement-types";

export default function AgreementsModule() {
  const { query, setQuery, snapshot, loading, error, refresh } = useAgreements();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ detail: AgreementDetail | null } | null>(null);
  const invoker = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const denied = error?.status === 401 || error?.status === 403;
  const data = snapshot?.data;
  const first = data?.items.length ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data?.items.length ? first + data.items.length - 1 : 0;
  const returnFocus = () => { if (invoker.current?.isConnected) invoker.current.focus(); else heading.current?.focus(); };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"><main className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">Agreements</h1><p className="mt-1 text-sm text-muted-foreground">Prepare complete agreement drafts against Active consignees. Drafts are unavailable for transactions.</p></div>
      <div className="flex flex-wrap gap-2">{!denied && <Button onClick={event => { invoker.current = event.currentTarget; setEditor({ detail: null }); }}>New agreement</Button>}<Button variant="outline" disabled={loading || denied} onClick={refresh}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div></div>
    {!denied && <form className="flex flex-wrap items-end gap-3 rounded-lg border p-3" onSubmit={event => { event.preventDefault(); setQuery({ ...query, search: search.trim(), page: 1 }); }}>
      <div className="min-w-0 flex-1 basis-56"><label htmlFor="agreement-search" className="mb-1 block text-sm font-medium">Search agreements</label><Input id="agreement-search" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="Reference or consignee code/name" /></div>
      <div><label htmlFor="agreement-status" className="mb-1 block text-sm font-medium">Status</label><select id="agreement-status" value={query.status} onChange={event => setQuery({ ...query, status: event.target.value, page: 1 })} className="h-10 rounded-md border bg-background px-3 focus-visible:outline-2">
        {["ALL", "DRAFT", "PENDING", "ACTIVE", "CLOSED", "REJECTED"].map(status => <option key={status} value={status}>{status === "ALL" ? "All statuses" : status[0] + status.slice(1).toLowerCase()}</option>)}</select></div>
      <Button type="submit">Search</Button><Button type="button" variant="outline" onClick={() => { setSearch(""); setQuery({ search: "", status: "ALL", page: 1, pageSize: query.pageSize }); }}>Reset filters</Button>
    </form>}
    <div role="status" aria-live="polite" className="text-sm text-muted-foreground">{loading ? snapshot ? "Refreshing agreements; previous results remain visible." : "Loading agreements…" : error ? snapshot ? "Refresh failed; earlier results may be stale." : "Agreements could not be loaded." : `${data?.total ?? 0} matching agreements.`}{snapshot && <span className="mt-1 block">Last updated {manilaTime(snapshot.updated)}</span>}</div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4"><p>{error.message}</p>{!denied && <Button variant="outline" disabled={loading} onClick={refresh}>Retry agreements</Button>}</div>}
    {!snapshot && loading && <div aria-hidden="true" className="space-y-3 rounded-lg border p-4">{[0, 1, 2, 3].map(row => <div key={row} className="h-12 animate-pulse rounded bg-muted" />)}</div>}
    {data && <section aria-label="Agreement register" aria-busy={loading} className="overflow-hidden rounded-lg border">
      <div className="space-y-1 border-b p-3 text-sm"><p>Showing {first}–{last} of {data.total} agreements</p><p className="text-muted-foreground">Applied status: {snapshot.query.status === "ALL" ? "All statuses" : snapshot.query.status}{snapshot.query.search ? ` · Search: ${snapshot.query.search}` : ""}</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><caption className="sr-only">Saved agreement records; View opens details within Agreements.</caption><thead className="border-b bg-muted/50"><tr>{["Reference", "Consignee", "Dates", "Commission", "Status", "Creator / Updated", "Actions"].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{data.items.map(item => <tr key={item.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{item.reference || "Unnumbered legacy agreement"}</td><td className="px-4 py-3"><p>{item.consigneeName}</p><p className="text-xs text-muted-foreground">{item.consigneeCode}</p></td><td className="px-4 py-3">{agreementDate(item.startDate)}<br />to {agreementDate(item.endDate)}</td><td className="px-4 py-3 tabular-nums">{item.commissionRate}%</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3"><p>{item.createdBy || "Not recorded"}{item.createdByMe ? " (you)" : ""}</p><p className="text-xs text-muted-foreground">{manilaTime(item.updatedAt)}</p></td><td className="px-4 py-3"><Button variant="outline" aria-label={`View ${item.reference || `agreement ${item.id}`}`} onClick={event => { invoker.current = event.currentTarget; setSelected(item.id); }}>View</Button></td></tr>)}
          {!data.items.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{query.search || query.status !== "ALL" ? "No agreements match these filters." : "No agreements yet. Create a draft using an Active consignee."}</td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm"><label htmlFor="agreement-page-size">Rows per page <select id="agreement-page-size" value={query.pageSize} disabled={loading} onChange={event => setQuery({ ...query, pageSize: Number(event.target.value), page: 1 })} className="ml-2 rounded border bg-background px-2 py-1">{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><div className="flex items-center gap-2"><Button variant="outline" disabled={loading || query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Previous</Button><span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><Button variant="outline" disabled={loading || query.page * query.pageSize >= data.total} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next</Button></div></div>
    </section>}
  </main>
    {selected && <AgreementViewDialog key={selected} id={selected} onClose={() => setSelected(null)} returnFocus={returnFocus} onEdit={detail => { setSelected(null); setEditor({ detail }); }} />}
    {editor && <AgreementDraftDialog detail={editor.detail} onClose={() => setEditor(null)} returnFocus={returnFocus} onSaved={detail => { setEditor(null); setSelected(detail.summary.id); refresh(); }} />}
  </div>;
}
