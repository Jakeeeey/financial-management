"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi } from "../providers/consignmentApi";
import { formatPeso, todayInManila } from "./control-utils";

type Reconciliation = Awaited<ReturnType<typeof consignmentApi.getReconciliation>>;

export default function ConsignmentReconciliationModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [asOfDate, setAsOfDate] = useState(todayInManila());
  const [report, setReport] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await consignmentApi.getReconciliation(asOfDate));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run Consignment reconciliation.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => { void run(); }, [run]);

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_LEDGER")) {
    return <main className="p-6 text-sm text-muted-foreground">Consignment ledger access is required to view reconciliation.</main>;
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Consignment Reconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Compare Consignment subledger controls with the shared ERP general ledger as of a date.</p>
      </div>
      <section className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <label className="space-y-1 text-sm">
          <span className="block">As of date</span>
          <input className="h-10 rounded-md border bg-background px-3" type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
        </label>
        <Button onClick={() => void run()} disabled={!asOfDate || loading}>{loading ? "Running…" : "Run reconciliation"}</Button>
      </section>
      {error && <Alert variant="destructive"><AlertTitle>Reconciliation unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {report && (
        <>
          <Alert variant={report.balanced ? "default" : "destructive"}>
            <AlertTitle>{report.balanced ? "All controls passed" : "Reconciliation has unresolved differences"}</AlertTitle>
            <AlertDescription>As of {report.asOfDate}. Period close remains blocked until every check passes.</AlertDescription>
          </Alert>
          <section className="overflow-x-auto rounded-lg border">
            <div className="min-w-[56rem]">
            <div className="grid grid-cols-[minmax(15rem,2fr)_repeat(3,minmax(9rem,1fr))_7rem] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
              <span>Control</span><span>Ledger</span><span>Operational</span><span>Variance</span><span>Status</span>
            </div>
            {report.checks.map((check) => (
              <div key={check.key} className="grid grid-cols-[minmax(15rem,2fr)_repeat(3,minmax(9rem,1fr))_7rem] gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                <span className="font-medium">{check.label}</span>
                <span className="tabular-nums">{formatPeso(check.ledgerBalance)}</span>
                <span className="tabular-nums">{formatPeso(check.operationalBalance)}</span>
                <span className={check.passed ? "tabular-nums" : "tabular-nums font-medium text-destructive"}>{formatPeso(check.variance)}</span>
                <span className={check.passed ? "font-medium text-emerald-700" : "font-medium text-destructive"}>{check.passed ? "Passed" : "Failed"}</span>
              </div>
            ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
