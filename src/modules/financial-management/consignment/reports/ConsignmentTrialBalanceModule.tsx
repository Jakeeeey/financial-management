"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi } from "../providers/consignmentApi";
import { formatPeso, todayInManila } from "../controls/control-utils";

type TrialBalance = Awaited<ReturnType<typeof consignmentApi.getTrialBalance>>;

export default function ConsignmentTrialBalanceModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [asOfDate, setAsOfDate] = useState(todayInManila());
  const [result, setResult] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await consignmentApi.getTrialBalance(asOfDate));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the Consignment trial balance.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => { void load(); }, [load]);

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("VIEW_LEDGER")) {
    return <main className="p-6 text-sm text-muted-foreground">Consignment ledger access is required to view this report.</main>;
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Consignment Trial Balance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Posted Consignment journals in the shared ERP general ledger, with source-document drill-down.</p>
      </div>
      <section className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <label className="space-y-1 text-sm">
          <span className="block">As of date</span>
          <input className="h-10 rounded-md border bg-background px-3" type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
        </label>
        <Button onClick={() => void load()} disabled={!asOfDate || loading}>{loading ? "Loading…" : "Refresh report"}</Button>
      </section>
      {error && <Alert variant="destructive"><AlertTitle>Trial balance unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {result && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">As of</div><div className="mt-1 font-medium">{result.asOfDate}</div></div>
            <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Total debits</div><div className="mt-1 font-mono font-medium">{formatPeso(result.totalDebits)}</div></div>
            <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Total credits</div><div className="mt-1 font-mono font-medium">{formatPeso(result.totalCredits)}</div></div>
          </section>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Net balance</th><th className="px-4 py-3">Source entries</th></tr>
              </thead>
              <tbody>
                {result.lines.map((line) => (
                  <tr key={line.accountId} className="border-t align-top">
                    <td className="px-4 py-3"><div className="font-medium">{line.accountName}</div><div className="text-xs text-muted-foreground">{line.accountCode}</div></td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatPeso(line.debit)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatPeso(line.credit)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatPeso(line.netBalance)}</td>
                    <td className="px-4 py-3">
                      {line.sourceEntries.length === 0 ? "—" : (
                        <details>
                          <summary className="cursor-pointer text-primary">{line.sourceEntries.length} journal line(s)</summary>
                          <div className="mt-3 space-y-2">
                            {line.sourceEntries.map((source) => (
                              <div key={`${source.journalEntryId}-${source.documentId}`} className="rounded-md border p-3 text-xs">
                                <div className="font-medium">{source.journalEntryNumber} · {source.documentType}{source.reversal ? " reversal" : ""}</div>
                                <div className="text-muted-foreground">{source.journalDate} · {source.externalReference || `Document #${source.documentId}`}</div>
                                <div className="mt-1">{source.journalDescription}</div>
                                <div className="mt-1 font-mono">Dr {formatPeso(source.debit)} · Cr {formatPeso(source.credit)}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
                {result.lines.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No posted Consignment journal lines exist on or before this date.</td></tr>}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-semibold">
                <tr><td className="px-4 py-3">Total</td><td className="px-4 py-3 text-right font-mono">{formatPeso(result.totalDebits)}</td><td className="px-4 py-3 text-right font-mono">{formatPeso(result.totalCredits)}</td><td colSpan={2} /></tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
