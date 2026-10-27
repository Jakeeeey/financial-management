"use client";

import { useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConsigneeViewDialog, manilaTime } from "./components/ConsigneeViewDialog";
import { useConsignees } from "./hooks/useConsignees";
import type { ConsigneeSummary } from "./types";

export default function ConsigneesModule() {
  const { query, setQuery, snapshot, loading, error, pending, refresh } = useConsignees();
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

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4"><SidebarTrigger /><span className="truncate text-sm text-muted-foreground">Consignment / Consignees</span></header>
    <main className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div>
        <h1 className="text-2xl font-semibold">Consignees</h1>
        <p className="mt-1 text-sm text-muted-foreground">Inspect consignee records and their default terms.</p>
      </div><Button variant="outline" disabled={pending || denied} onClick={refresh}><RefreshCw className={pending ? "animate-spin" : ""} />Refresh</Button></div>
      {!denied && <form className="flex flex-wrap items-end gap-2 rounded-lg border p-3" onSubmit={event => { event.preventDefault(); setQuery({ ...query, search: search.trim(), page: 1 }); }}>
        <div className="min-w-0 flex-1 basis-56"><label htmlFor="consignee-search" className="mb-2 block text-sm font-medium">Search consignees</label>
          <Input id="consignee-search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Code or consignee name" /></div>
        <Button type="submit"><Search />Search</Button>
        <Button type="button" variant="outline" onClick={() => { setSearch(""); setQuery({ ...query, search: "", page: 1 }); }}>Clear search</Button>
      </form>}
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
          {applied?.search && <p className="break-words text-muted-foreground">Applied search: {applied.search}</p>}
          {pending && <p className="text-muted-foreground">Updating the requested page. The scope above describes the displayed results.</p>}
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Consignee records. Open View to inspect available details.</caption>
          <thead className="border-b bg-muted/50"><tr>{["Code / Name", "VAT treatment", "Contact", "Status", "Actions"].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id} className="border-b last:border-0">
            <td className="px-4 py-3"><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.code}</p></td>
            <td className="px-4 py-3">{item.vatTreatment || "Not provided"}</td>
            <td className="px-4 py-3"><p>{item.contactPerson || "Not provided"}</p>{item.email && <p className="text-muted-foreground">{item.email}</p>}{item.phone && <p className="text-muted-foreground">{item.phone}</p>}</td>
            <td className="px-4 py-3"><span className="rounded-full border px-2 py-1 text-xs">{item.status}</span></td>
            <td className="px-4 py-3"><Button variant="outline" aria-label={`View ${item.name}`} onClick={event => { invoker.current = event.currentTarget; setInspection(value => value + 1); setSelected(item); }}>View</Button></td>
          </tr>)}</tbody>
        </table></div>
        {data.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{data.total > 0 ? "No records on this page. Select Previous to return to earlier results." : applied?.search ? "No consignees match this search." : "No consignee records are available."}</p>}
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
    <ConsigneeViewDialog selected={denied ? null : selected} inspection={inspection} onClose={() => setSelected(null)} returnFocus={() => invoker.current?.focus()} />
  </div>;
}
