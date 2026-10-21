"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi } from "../providers/consignmentApi";
import { formatManilaDateTime } from "./control-utils";

type AuditPage = Awaited<ReturnType<typeof consignmentApi.listAuditTrail>>;

function formatAuditDetails(detailsJson: string | null): Array<{ label: string; value: string }> {
  if (!detailsJson) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(detailsJson);
  } catch {
    return [{ label: "Details", value: "Details could not be read." }];
  }

  const rows: Array<{ label: string; value: string }> = [];
  const visit = (value: unknown, path: string[]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        rows.push({ label: path.join(" · ") || "Details", value: "None" });
      } else if (value.every((item) => item == null || ["string", "number", "boolean"].includes(typeof item))) {
        rows.push({ label: path.join(" · ") || "Details", value: value.map((item) => String(item ?? "—")).join(", ") });
      } else {
        value.forEach((item, index) => visit(item, [...path, `Item ${index + 1}`]));
      }
      return;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) rows.push({ label: path.join(" · ") || "Details", value: "None" });
      else entries.forEach(([key, nested]) => {
        const label = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
        visit(nested, [...path, label.charAt(0).toUpperCase() + label.slice(1)]);
      });
      return;
    }

    const label = path.join(" · ") || "Details";
    rows.push({ label, value: value == null ? "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value) });
  };

  visit(parsed, []);
  return rows;
}

export default function ConsignmentAuditTrailModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await consignmentApi.listAuditTrail(targetPage);
      setResult(response);
      setPage(response.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the Consignment audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(0); }, [load]);

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("MANAGE_CONTROLS")) {
    return <main className="p-6 text-sm text-muted-foreground">Controller access is required to view the Consignment audit trail.</main>;
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Consignment Audit Trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">Append-only record of Consignment submissions, approvals, policy changes, period controls, and voids.</p>
      </div>
      {error && <Alert variant="destructive"><AlertTitle>Audit trail unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="overflow-hidden rounded-lg border">
        {loading && !result ? <p className="p-6 text-sm text-muted-foreground">Loading audit events…</p> : result?.items.length ? (
          <div className="divide-y">
            {result.items.map((event) => {
              const details = formatAuditDetails(event.detailsJson);
              const referenceName = event.referenceType === "USER"
                ? event.referenceName ?? "Name unavailable"
                : event.referenceId;
              return (
                <article key={event.auditEventId} className="grid gap-2 p-4 md:grid-cols-[12rem_minmax(12rem,1fr)_minmax(14rem,1fr)]">
                  <div>
                    <div className="font-medium">{event.action}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatManilaDateTime(event.occurredAt)}</div>
                  </div>
                  <div className="text-sm">
                    <div>{event.referenceType === "USER" ? "User" : event.referenceType}{referenceName ? ` · ${referenceName}` : ""}</div>
                    <div className="text-xs text-muted-foreground">Actor: {event.actorName ?? "Name unavailable"}</div>
                  </div>
                  {details.length > 0 && (
                    <dl className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm">
                      {details.map((item, index) => (
                        <div key={`${item.label}-${index}`} className="grid gap-1 sm:grid-cols-[minmax(8rem,auto)_1fr] sm:gap-3">
                          <dt className="font-medium text-muted-foreground">{item.label}</dt>
                          <dd className="break-words">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </article>
              );
            })}
          </div>
        ) : <p className="p-6 text-sm text-muted-foreground">No Consignment audit events have been recorded.</p>}
        {(page > 0 || result?.hasNext) && (
          <div className="flex justify-end gap-2 border-t p-3">
            <Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={loading || page === 0}>Previous</Button>
            <span className="self-center text-sm text-muted-foreground">Page {page + 1}</span>
            <Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={loading || !result?.hasNext}>Next</Button>
          </div>
        )}
      </section>
    </main>
  );
}
