"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi } from "../providers/consignmentApi";

type StockPosition = Awaited<ReturnType<typeof consignmentApi.getStockPosition>>[number];

function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }

export default function ConsignmentStockPositionModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [rows, setRows] = useState<StockPosition[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void consignmentApi.getStockPosition().then((result) => { if (active) setRows(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load Consignment stock."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => !query || `${row.productCode ?? ""} ${row.productName ?? ""}`.toLowerCase().includes(query));
  }, [rows, search]);
  const totalUnits = visible.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = visible.reduce((sum, row) => sum + row.valueAtCost, 0);

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_LEDGER")) return <main className="p-6 text-sm text-muted-foreground">Consignment ledger access is required to view the stock position.</main>;

  return (
    <main className="space-y-6 p-6">
      <div><h1 className="text-2xl font-semibold">Consignment Stock Position</h1><p className="mt-1 text-sm text-muted-foreground">Posted goods held by consignees remain inventory until sell-through.</p></div>
      {error && <Alert variant="destructive"><AlertTitle>Stock position unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Units in the filtered view</div><div className="mt-1 text-2xl font-semibold tabular-nums">{totalUnits.toLocaleString("en-PH", { maximumFractionDigits: 3 })}</div></div><div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Value at cost</div><div className="mt-1 text-2xl font-semibold tabular-nums">{peso(totalValue)}</div></div></section>
      <section className="space-y-3 rounded-lg border p-4"><input className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by product code or name" aria-label="Filter stock position" />
        <div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Product code</th><th className="px-3 py-3">Product</th><th className="px-3 py-3 text-right">Units held</th><th className="px-3 py-3 text-right">Value at cost</th></tr></thead><tbody>{visible.map((row) => <tr key={row.productId} className="border-t"><td className="px-3 py-3 font-medium">{row.productCode || `#${row.productId}`}</td><td className="px-3 py-3">{row.productName || "—"}</td><td className="px-3 py-3 text-right tabular-nums">{row.quantity.toLocaleString("en-PH", { maximumFractionDigits: 3 })}</td><td className="px-3 py-3 text-right tabular-nums">{peso(row.valueAtCost)}</td></tr>)}{(!loading && visible.length === 0) && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No posted Consignment stock found.</td></tr>}{loading && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Loading stock position…</td></tr>}</tbody></table></div>
      </section>
    </main>
  );
}
