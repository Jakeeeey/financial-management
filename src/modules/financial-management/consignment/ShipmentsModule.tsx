"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShipmentEditor } from "./components/ShipmentEditor";
import { ShipmentRegisterCards } from "./components/ShipmentRegisterCards";
import { ShipmentReviewDialog } from "./components/ShipmentReviewDialog";
import { ShipmentStatusTabs } from "./components/ShipmentStatusTabs";
import { ConsignmentStatusBadge } from "./components/ConsignmentStatusBadge";
import { getShipment, listShipments, ShipmentError } from "./providers/shipments.api";
import type { ShipmentDetail, ShipmentPage } from "./shipment-types";
import { formatDateTime } from "./utils/shipment-ui";
import { consignmentRequestId } from "./utils/request-id";

type Snapshot = { data: ShipmentPage; search: string; status: string };

export default function ShipmentsModule() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ShipmentError | null>(null);
  const [editor, setEditor] = useState<{ detail: ShipmentDetail | null; editing: boolean; key: string } | null>(null);
  const [review, setReview] = useState<{ detail: ShipmentDetail; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const invoker = useRef<HTMLButtonElement | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listShipments(query, status, page, pageSize);
      if (current === request.current) setSnapshot({ data, search: query, status });
    } catch (cause) {
      if (current === request.current) setError(cause instanceof ShipmentError ? cause : new ShipmentError("Unable to load shipments.", 503));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [query, status, page, pageSize]);

  useEffect(() => { void refresh(); }, [refresh]);

  const open = async (id: number, editing: boolean, button: HTMLButtonElement) => {
    if (loading) return;
    invoker.current = button;
    setLoading(true);
    try {
      const detail = await getShipment(id);
      setEditor({ detail, editing: editing && detail.summary.editable, key: consignmentRequestId() });
    } catch (cause) {
      setError(cause instanceof ShipmentError ? cause : new ShipmentError("Unable to open shipment.", 503));
    } finally {
      setLoading(false);
    }
  };

  const openReview = async (id: number, button: HTMLButtonElement) => {
    if (loading) return;
    invoker.current = button;
    setLoading(true);
    try {
      const detail = await getShipment(id);
      setReview({ detail, key: consignmentRequestId() });
    } catch (cause) {
      setError(cause instanceof ShipmentError ? cause : new ShipmentError("Unable to open shipment review.", 503));
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setStatus("ALL");
    setPage(1);
  };

  const denied = error?.status === 401 || error?.status === 403;
  const data = snapshot?.data;
  const first = data?.items.length ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data?.items.length ? first + data.items.length - 1 : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtersActive = Boolean(query || status !== "ALL");

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <main className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">Shipments</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Prepare shipment drafts, submit them for independent review, and track posted warehouse-to-consignment reclassifications.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!denied && <Button disabled={loading} onClick={event => { invoker.current = event.currentTarget; setEditor({ detail: null, editing: true, key: consignmentRequestId() }); }}>Create shipment draft</Button>}
          <Button variant="outline" disabled={loading || denied} onClick={() => void refresh()}><RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />Refresh</Button>
        </div>
      </div>

      {!denied && <>
        <ShipmentStatusTabs status={status} counts={data?.statusCounts} disabled={loading} onChange={value => { setStatus(value); setPage(1); }} />
        <form className="flex flex-wrap items-end gap-3 rounded-lg border p-3" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor="shipment-search" className="mb-1 block text-sm font-medium">Search shipments</label>
            <Input id="shipment-search" maxLength={200} placeholder="Shipment number or delivery reference" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <Button disabled={loading} type="submit"><Search aria-hidden="true" />Search</Button>
          {filtersActive && <Button type="button" variant="outline" disabled={loading} onClick={clearFilters}>Clear filters</Button>}
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
          <p>{loading ? (snapshot ? "Refreshing shipments; previous results remain visible." : "Loading shipments...") : error ? (snapshot ? "Refresh failed; earlier results may be stale." : "Shipments could not be loaded.") : `${data?.total ?? 0} matching shipment${data?.total === 1 ? "" : "s"}.`}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {snapshot?.search && <span className="rounded-full border bg-muted/40 px-2 py-1">Search: {snapshot.search}</span>}
            {snapshot?.status && snapshot.status !== "ALL" && <span className="rounded-full border bg-muted/40 px-2 py-1">Status: {snapshot.status.toLowerCase()}</span>}
          </div>
        </div>
      </>}

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
        <p>{denied ? "You do not have access to Shipments." : error.message}</p>
        {!denied && <Button variant="outline" disabled={loading} onClick={() => void refresh()}>Retry shipments</Button>}
      </div>}

      {!denied && !snapshot && loading && <div aria-hidden="true" className="space-y-3 rounded-lg border p-4">{[0, 1, 2, 3].map(row => <div key={row} className="h-12 animate-pulse rounded bg-muted" />)}</div>}

      {!denied && data && <section className="overflow-hidden rounded-lg border" aria-label="Shipment register" aria-busy={loading}>
        <div className="space-y-1 border-b p-3 text-sm">
          <p>Showing {first}-{last} of {data.total} shipments</p>
          {filtersActive && <p className="text-muted-foreground">Use Clear filters to return to all shipments.</p>}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <caption className="sr-only">Saved shipment records. View opens shipment details within this workspace.</caption>
            <thead className="border-b bg-muted/50"><tr>{["Shipment", "Date", "Agreement / consignee", "Delivery reference", "Submitted", "Status", "Actions"].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{data.items.map(item => <tr key={item.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{item.number}</td>
              <td className="whitespace-nowrap px-4 py-3">{item.documentDate ?? "Not set"}</td>
              <td className="px-4 py-3">{item.agreementReference ?? (item.agreementId ? `#${item.agreementId}` : "Not set")}{item.consigneeName ? <span className="block text-xs text-muted-foreground">{item.consigneeName}</span> : null}</td>
              <td className="max-w-64 break-words px-4 py-3">{item.deliveryReference || "Not set"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(item.submittedAt)}</td>
              <td className="px-4 py-3"><ConsignmentStatusBadge status={item.status} /></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                <Button variant="outline" aria-label={`View ${item.number}`} disabled={loading} onClick={event => void open(item.id, false, event.currentTarget)}>View</Button>
                {item.editable && <Button variant="outline" aria-label={`Edit ${item.number}`} disabled={loading} onClick={event => void open(item.id, true, event.currentTarget)}>Edit</Button>}
                {item.status !== "DRAFT" && <Button aria-label={`${item.status === "PENDING" ? "Review" : "Details"} ${item.number}`} disabled={loading} onClick={event => void openReview(item.id, event.currentTarget)}>{item.status === "PENDING" ? "Review" : "Details"}</Button>}
              </div></td>
            </tr>)}
              {!data.items.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No shipments match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="lg:hidden">
          <ShipmentRegisterCards items={data.items} loading={loading}
            onView={(item, button) => void open(item.id, false, button)}
            onEdit={(item, button) => void open(item.id, true, button)}
            onDetails={(item, button) => void openReview(item.id, button)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm">
          <label htmlFor="shipment-page-size" className="flex items-center gap-2">Rows per page<select id="shipment-page-size" className="h-10 rounded-md border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" disabled={loading} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
          <div className="flex flex-wrap items-center gap-2"><span>Page {data.page} of {pages}</span><Button disabled={loading || page <= 1} variant="outline" onClick={() => setPage(current => current - 1)}>Previous</Button><Button disabled={loading || page * data.pageSize >= data.total} variant="outline" onClick={() => setPage(current => current + 1)}>Next</Button></div>
        </div>
      </section>}

      {editor && !denied && <ShipmentEditor key={editor.key} initial={editor.detail} editing={editor.editing} onClose={() => setEditor(null)} returnFocus={() => { if (invoker.current?.isConnected) invoker.current.focus(); else heading.current?.focus(); }} onSaved={() => void refresh()} />}
      {review && !denied && <ShipmentReviewDialog key={review.key} initial={review.detail} onClose={() => setReview(null)} returnFocus={() => { if (invoker.current?.isConnected) invoker.current.focus(); else heading.current?.focus(); }} onChanged={() => void refresh()} />}
    </main>
  </div>;
}
