"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentPolicy } from "../providers/consignmentApi";
import { todayInManila } from "./control-utils";

type Readiness = Awaited<ReturnType<typeof consignmentApi.getPeriodReadiness>>;

function previousMonthEnd() {
  const today = todayInManila();
  const date = new Date(`${today}T12:00:00+08:00`);
  date.setDate(0);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default function ConsignmentPeriodCloseModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [policy, setPolicy] = useState<ConsignmentPolicy | null>(null);
  const [through, setThrough] = useState(previousMonthEnd());
  const [reason, setReason] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const checkReadiness = useCallback(async () => {
    if (!through) return;
    setLoading(true);
    setError("");
    try {
      const result = await consignmentApi.getPeriodReadiness(through);
      setReadiness(result);
      setPolicy((current) => current ? { ...current, closedThroughDate: result.currentClosedThroughDate } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check period-close readiness.");
      setReadiness(null);
    } finally {
      setLoading(false);
    }
  }, [through]);

  useEffect(() => {
    void consignmentApi.getPolicy().then(setPolicy).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not load the closed-through date.");
    });
  }, []);
  useEffect(() => { void checkReadiness(); }, [checkReadiness]);

  async function closePeriod() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const latest = await consignmentApi.getPeriodReadiness(through);
      setReadiness(latest);
      if (!latest.canClose) return;
      const saved = await consignmentApi.closePeriod(through, reason);
      setPolicy(saved);
      setMessage(`Consignment is closed through ${saved.closedThroughDate}.`);
      setReadiness({ ...latest, currentClosedThroughDate: saved.closedThroughDate, canClose: false, blockers: ["This period has already been closed."] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not close this period.");
    } finally {
      setLoading(false);
    }
  }

  async function reopenPeriod() {
    if (!policy?.closedThroughDate) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const saved = await consignmentApi.reopenLatestPeriod(policy.closedThroughDate, reason);
      setPolicy(saved);
      setMessage(`The latest closed period was reopened. Closed through: ${saved.closedThroughDate ?? "none"}.`);
      setReadiness(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reopen the latest period.");
    } finally {
      setLoading(false);
    }
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("CLOSE_PERIOD")) {
    return <main className="p-6 text-sm text-muted-foreground">Controller access is required to close or reopen a Consignment period.</main>;
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Consignment Period Close</h1>
        <p className="mt-1 text-sm text-muted-foreground">Closing is allowed only when pending work, due amortization, and reconciliation blockers are resolved.</p>
      </div>
      {error && <Alert variant="destructive"><AlertTitle>Period control failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Period updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div><div className="text-sm text-muted-foreground">Currently closed through</div><div className="mt-1 font-medium">{policy?.closedThroughDate ?? "No closed period"}</div></div>
        <label className="space-y-1 text-sm"><span className="block">Close through (month end)</span><input className="h-10 w-full rounded-md border bg-background px-3" type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="block">Reason (required for close or reopen)</span><textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label>
      </section>
      {readiness && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold">Close readiness for {readiness.requestedThroughDate}</h2>
          {readiness.canClose ? <p className="text-sm text-emerald-700">All period-close checks passed.</p> : (
            <ul className="list-inside list-disc space-y-1 text-sm text-destructive">{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
          )}
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void checkReadiness()} disabled={!through || loading}>{loading ? "Checking…" : "Check readiness"}</Button>
        <Button onClick={() => void closePeriod()} disabled={!reason.trim() || !readiness?.canClose || loading}>Close period</Button>
        <Button variant="destructive" onClick={() => void reopenPeriod()} disabled={!policy?.closedThroughDate || !reason.trim() || loading}>Reopen latest closed period</Button>
      </div>
    </main>
  );
}
