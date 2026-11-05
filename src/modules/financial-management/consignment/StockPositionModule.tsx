"use client";

import { useMemo, useState } from "react";
import { Boxes, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsignmentStatusBadge } from "./components/ConsignmentStatusBadge";
import { useStockMovements, useStockPosition, type StockMovementFilters, type StockPositionFilters } from "./hooks/useStockPosition";
import type { PendingCommitment, StockPositionRow } from "./stock-position-types";
import { formatDateTime, formatPeso, formatQuantity } from "./utils/shipment-ui";

type Tab = "position" | "pending" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "position", label: "Posted Position" },
  { id: "pending", label: "Pending Commitments" },
  { id: "history", label: "Movement History" },
];

export default function StockPositionModule() {
  const [searchInput, setSearchInput] = useState("");
  const [agreementId, setAgreementId] = useState("");
  const [search, setSearch] = useState("");
  const [includeZero, setIncludeZero] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [tab, setTab] = useState<Tab>("position");
  const [historyScope, setHistoryScope] = useState({ agreementId: "", productId: "", search: "", inventoryClass: "" });
  const [historyPage, setHistoryPage] = useState(1);
  const filters = useMemo<StockPositionFilters>(() => ({ agreementId, search, includeZero, page, pageSize }),
    [agreementId, search, includeZero, page, pageSize]);
  const position = useStockPosition(filters);
  const movementFilters = useMemo<StockMovementFilters>(() => ({
    agreementId: historyScope.agreementId,
    productId: historyScope.productId,
    inventoryClass: historyScope.inventoryClass,
    search: historyScope.search,
    page: historyPage,
    pageSize,
  }), [historyScope, historyPage, pageSize]);
  const movements = useStockMovements(movementFilters, tab === "history");
  const data = position.data;
  const denied = position.error?.status === 401 || position.error?.status === 403;

  const applyFilters = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setAgreementId("");
    setIncludeZero(false);
    setPage(1);
  };

  const showMovements = (agreement: number, product: number) => {
    setHistoryScope({ agreementId: String(agreement), productId: String(product), search: "", inventoryClass: "" });
    setHistoryPage(1);
    setTab("history");
  };

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <main className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Stock Position</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Posted consignment stock, retained costs, pending shipment commitments, and movement history.</p></div>
        <Button variant="outline" disabled={position.loading || denied} onClick={() => void position.refresh()}><RefreshCw className={position.loading ? "animate-spin" : ""} aria-hidden="true" />Refresh</Button>
      </div>

      {denied ? <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">You do not have access to Stock Position.</div> : <>
        {data && <SummaryCards summary={data.summary} />}

        <form className="flex flex-wrap items-end gap-3 rounded-lg border p-3" onSubmit={event => { event.preventDefault(); applyFilters(); }}>
          <div className="min-w-0 flex-1 basis-52"><label htmlFor="stock-agreement" className="mb-1 block text-sm font-medium">Agreement</label>
            <select id="stock-agreement" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={agreementId} disabled={position.loading || position.optionsLoading} onChange={event => { setAgreementId(event.target.value); setPage(1); }}>
              <option value="">All agreements</option>
              {position.agreements.map(choice => <option key={choice.id} value={choice.id}>{choice.code ?? `Agreement #${choice.id}`} | {choice.name}</option>)}
            </select>
          </div>
          <div className="min-w-0 flex-1 basis-56"><label htmlFor="stock-search" className="mb-1 block text-sm font-medium">Search</label><Input id="stock-search" maxLength={100} value={searchInput} placeholder="Product, agreement, or consignee" onChange={event => setSearchInput(event.target.value)} /></div>
          <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={includeZero} onChange={event => { setIncludeZero(event.target.checked); setPage(1); }} />Show zero balances</label>
          <Button type="submit" disabled={position.loading}><Search aria-hidden="true" />Apply</Button>
          <Button type="button" variant="outline" disabled={position.loading} onClick={resetFilters}>Reset</Button>
        </form>

        <div role="tablist" aria-label="Stock position views" className="flex flex-wrap items-center gap-2">
          {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${tab === item.id ? "border-primary/40 bg-primary/5 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}>
            {item.label}
            <span className="ml-2 text-xs tabular-nums text-muted-foreground">{item.id === "position" ? data?.positions.total ?? 0 : item.id === "pending" ? data?.pending.length ?? 0 : movements.data?.total ?? 0}</span>
          </button>)}
        </div>

        {position.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 p-4 text-sm"><p>{position.error.message}</p><Button variant="outline" onClick={() => void position.refresh()}>Retry stock position</Button></div>}
        {position.loading && !data && <div className="space-y-3 rounded-lg border p-4">{[0, 1, 2].map(row => <div key={row} className="h-16 animate-pulse rounded bg-muted" />)}</div>}
        {data && tab === "position" && <>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <PositionTable positions={data.positions.items} onShowMovements={showMovements} />
          </div>
          <div className="space-y-3 md:hidden">{data.positions.items.map(row => <PositionCard key={`${row.agreementId}-${row.productId}-${row.uomId}`} row={row} onShowMovements={() => showMovements(row.agreementId, row.productId)} />)}{!data.positions.items.length && <Empty text="No posted consignment stock matches the current filters." />}</div>
          <Pagination page={data.positions.page} pageSize={data.positions.pageSize} total={data.positions.total} disabled={position.loading} onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }} />
        </>}
        {data && tab === "pending" && <PendingTable rows={data.pending} />}
        {tab === "history" && <MovementHistory movements={movements.data} loading={movements.loading} error={movements.error?.message} scope={historyScope} onClearScope={() => { setHistoryScope({ agreementId: "", productId: "", search: "", inventoryClass: "" }); setHistoryPage(1); }} onClassChange={value => { setHistoryScope(current => ({ ...current, inventoryClass: value })); setHistoryPage(1); }} onRetry={() => void movements.refresh()} page={historyPage} setPage={setHistoryPage} onPageSize={size => { setPageSize(size); setHistoryPage(1); }} />}
      </>}
    </main>
  </div>;
}

function SummaryCards({ summary }: { summary: NonNullable<ReturnType<typeof useStockPosition>["data"]>["summary"] }) {
  return <section aria-label="Stock position summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <Metric label="Posted base quantity" value={formatQuantity(summary.postedBaseQuantity)} />
    <Metric label="Posted inventory at cost" value={formatPeso(summary.postedCost)} />
    <Metric label="Pending commitments" value={formatPeso(summary.pendingCost)} />
    <Metric label="Projected exposure" value={formatPeso(summary.projectedExposure)} />
    <Metric label="Agreements over 90% / limit" value={`${summary.agreementsAboveNinety} / ${summary.agreementsOverLimit}`} />
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</p></div>;
}

function PositionTable({ positions, onShowMovements }: { positions: StockPositionRow[]; onShowMovements: (agreement: number, product: number) => void }) {
  return <table className="w-full min-w-[940px] text-left text-sm"><caption className="sr-only">Posted consignment stock by agreement, product, and actual UOM</caption><thead className="border-b bg-muted/50"><tr>{["Agreement / consignee", "Product", "Actual UOM", "Posted quantity", "Base quantity", "Unit cost", "Posted cost", "Pending", "Exposure", "Actions"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>
    {positions.map(row => <tr key={`${row.agreementId}-${row.productId}-${row.uomId}`} className="border-b last:border-0">
      <td className="px-3 py-3"><p>{row.agreementReference}</p><p className="text-xs text-muted-foreground">{row.consigneeName}</p></td>
      <td className="px-3 py-3"><p>{row.productName ?? "-"}</p><p className="text-xs text-muted-foreground">{row.productCode ?? `#${row.productId}`}</p></td>
      <td className="px-3 py-3">{row.uomName ?? "Unavailable"}{row.uomMultiplier ? ` x${row.uomMultiplier}` : ""}</td>
      <td className="px-3 py-3 tabular-nums">{formatQuantity(row.postedQuantity)}</td>
      <td className="px-3 py-3 tabular-nums">{formatQuantity(row.postedBaseQuantity)}</td>
      <td className="px-3 py-3 tabular-nums">{formatPeso(row.unitCost)}</td>
      <td className="px-3 py-3 tabular-nums">{formatPeso(row.postedCost)}</td>
      <td className="px-3 py-3 tabular-nums">{formatQuantity(row.pendingQuantity)}<span className="block text-xs text-muted-foreground">{formatPeso(row.pendingCost)}</span></td>
      <td className="px-3 py-3 tabular-nums">{formatPeso(row.projectedExposure)}<span className="block text-xs text-muted-foreground">{row.utilization == null ? "No limit" : `${row.utilization}%`}</span></td>
      <td className="px-3 py-3"><Button size="sm" variant="outline" onClick={() => onShowMovements(row.agreementId, row.productId)}>Movements</Button></td>
    </tr>)}
    {!positions.length && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No posted consignment stock matches the current filters.</td></tr>}
  </tbody></table>;
}

function PositionCard({ row, onShowMovements }: { row: StockPositionRow; onShowMovements: () => void }) {
  return <article className="rounded-lg border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{row.productName ?? `Product #${row.productId}`}</p><p className="text-xs text-muted-foreground">{row.productCode ?? "-"} | {row.agreementReference} | {row.consigneeName}</p></div><span className="rounded-full border bg-muted/40 px-2 py-1 text-xs">{row.uomName ?? "UOM unavailable"}</span></div>
    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Posted quantity</dt><dd className="tabular-nums">{formatQuantity(row.postedQuantity)}</dd></div><div><dt className="text-xs text-muted-foreground">Base quantity</dt><dd className="tabular-nums">{formatQuantity(row.postedBaseQuantity)}</dd></div><div><dt className="text-xs text-muted-foreground">Posted cost</dt><dd className="tabular-nums">{formatPeso(row.postedCost)}</dd></div><div><dt className="text-xs text-muted-foreground">Pending cost</dt><dd className="tabular-nums">{formatPeso(row.pendingCost)}</dd></div><div><dt className="text-xs text-muted-foreground">Projected exposure</dt><dd className="tabular-nums">{formatPeso(row.projectedExposure)}</dd></div><div><dt className="text-xs text-muted-foreground">Utilization</dt><dd className="tabular-nums">{row.utilization == null ? "No limit" : `${row.utilization}%`}</dd></div></dl>
    <Button size="sm" variant="outline" className="mt-3" onClick={onShowMovements}>View movements</Button>
  </article>;
}

function PendingTable({ rows }: { rows: PendingCommitment[] }) {
  if (!rows.length) return <Empty text="No Pending shipment commitments." />;
  return <div className="space-y-2"><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Pending commitments reserve warehouse stock but are not included in posted consignment stock.</p><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[940px] text-left text-sm"><caption className="sr-only">Pending shipment commitments</caption><thead className="border-b bg-muted/50"><tr>{["Shipment", "Agreement / consignee", "Date", "Product", "UOM", "Quantity", "Base", "Unit cost", "Line amount"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={`${row.documentId}-${row.lineId}`} className="border-b last:border-0"><td className="px-3 py-2"><p>{row.documentNumber}</p><ConsignmentStatusBadge status="PENDING" /></td><td className="px-3 py-2">{row.agreementReference}<span className="block text-xs text-muted-foreground">{row.consigneeName}</span></td><td className="px-3 py-2">{row.documentDate}</td><td className="px-3 py-2">{row.productName ?? "-"}<span className="block text-xs text-muted-foreground">{row.productCode ?? `#${row.productId}`}</span></td><td className="px-3 py-2">{row.uomName ?? "Unavailable"}</td><td className="px-3 py-2 tabular-nums">{formatQuantity(row.quantity)}</td><td className="px-3 py-2 tabular-nums">{formatQuantity(row.baseQuantity)}</td><td className="px-3 py-2 tabular-nums">{formatPeso(row.unitCost)}</td><td className="px-3 py-2 tabular-nums">{formatPeso(row.lineAmount)}</td></tr>)}</tbody></table></div></div>;
}

function MovementHistory({ movements, loading, error, scope, onClearScope, onClassChange, onRetry, page, setPage, onPageSize }: {
  movements: ReturnType<typeof useStockMovements>["data"];
  loading: boolean;
  error?: string;
  scope: { agreementId: string; productId: string; search: string; inventoryClass: string };
  onClearScope: () => void;
  onClassChange: (value: string) => void;
  onRetry: () => void;
  page: number;
  setPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  return <section className="space-y-3" aria-label="Posted movement history">
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Inventory class<select className="ml-2 h-9 rounded-md border bg-background px-2" value={scope.inventoryClass} onChange={event => onClassChange(event.target.value)}><option value="">All classes</option><option value="WAREHOUSE">Warehouse</option><option value="CONSIGNMENT">Consignment</option></select></label>{(scope.agreementId || scope.productId) && <Button size="sm" variant="outline" onClick={onClearScope}>Clear product scope</Button>}</div><p className="text-xs text-muted-foreground">{movements?.total ?? 0} posted movement rows</p></div>
    {error && <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 p-3 text-sm"><span>{error}</span><Button size="sm" variant="outline" onClick={onRetry}>Retry</Button></div>}
    {loading && !movements && <div className="h-32 animate-pulse rounded-lg bg-muted" />}
    {movements && <><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[1100px] text-left text-sm"><caption className="sr-only">Posted movement history including warehouse and consignment effects</caption><thead className="border-b bg-muted/50"><tr>{["Posted", "Shipment", "Class", "Direction", "Product", "UOM", "Quantity", "Base", "Unit cost", "Total cost", "Journal", "Actor"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>{movements.items.map(row => <tr key={row.movementId} className="border-b last:border-0"><td className="px-3 py-2">{formatDateTime(row.postedAt)}</td><td className="px-3 py-2">{row.documentNumber}<span className="block text-xs text-muted-foreground">{row.agreementReference} | {row.consigneeName}</span></td><td className="px-3 py-2">{row.inventoryClass}</td><td className="px-3 py-2">{row.direction}</td><td className="px-3 py-2">{row.productName ?? "-"}<span className="block text-xs text-muted-foreground">{row.productCode ?? `#${row.productId}`}</span></td><td className="px-3 py-2">{row.uomName ?? "Unavailable"}{row.uomMultiplier ? ` x${row.uomMultiplier}` : ""}</td><td className="px-3 py-2 tabular-nums">{formatQuantity(row.quantity)}</td><td className="px-3 py-2 tabular-nums">{formatQuantity(row.baseQuantity)}</td><td className="px-3 py-2 tabular-nums">{formatPeso(row.unitCost)}</td><td className="px-3 py-2 tabular-nums">{formatPeso(row.totalCost)}</td><td className="px-3 py-2">{row.journalEntryId ?? "-"}</td><td className="px-3 py-2">{row.postedBy ?? "-"}</td></tr>)}</tbody></table></div>
      <Pagination page={page} pageSize={movements.pageSize} total={movements.total} disabled={loading} onPage={setPage} onPageSize={onPageSize} />
    </>}
  </section>;
}

function Pagination({ page, pageSize, total, disabled, onPage, onPageSize }: { page: number; pageSize: number; total: number; disabled: boolean; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><label>Rows per page<select className="ml-2 h-8 rounded border bg-background px-2" disabled={disabled} value={pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button size="sm" variant="outline" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>Next</Button></div></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><Boxes className="mx-auto mb-2 size-6" aria-hidden="true" />{text}</div>;
}
