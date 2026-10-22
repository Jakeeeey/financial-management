"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { auditEventSummary, formatDateTime } from "../../adjusting-journal-entries/components/formatters";
import type { AjeAuditEvent } from "../../adjusting-journal-entries/types";
import { getJournalAuditEvents } from "../services/journal-entry-audit";

export function JournalEntryAuditTrail({ journalNumber, open }: { journalNumber: string | null; open: boolean }) {
  const [events, setEvents] = React.useState<AjeAuditEvent[]>([]);
  const [loading, setLoading] = React.useState(Boolean(journalNumber && open));
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    if (!journalNumber || !open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getJournalAuditEvents(journalNumber, controller.signal)
      .then(result => { if (!controller.signal.aborted) setEvents(result); })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load this journal's audit history."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [journalNumber, open, revision]);

  return <section aria-label="Audit trail" className="rounded-lg border border-border bg-background p-4">
    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground"><Clock className="h-3.5 w-3.5 text-muted-foreground" />Audit trail</h3>
    {!journalNumber ? <div className="rounded-lg border border-dashed border-muted bg-muted/20 px-4 py-6 text-center">
      <p className="text-xs font-semibold text-foreground">Audit history unavailable</p>
      <p className="mt-1 text-xs text-muted-foreground">Audit events are not connected for this source.</p>
    </div> : <>
      {loading && <div role="status" className="space-y-3"><span className="sr-only">Loading audit trail…</span>{[1, 2, 3].map(index => <Skeleton key={index} className="h-12 w-full" />)}</div>}
      {!loading && error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><p>{error}</p><Button type="button" variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>Retry audit history</Button></div>}
      {!loading && !error && events.length === 0 && <p role="status" className="text-sm text-muted-foreground">No audit events recorded.</p>}
      {!loading && !error && events.length > 0 && <ol className="divide-y rounded-md border px-3">
        {events.map(event => <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
          <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt)}</time>
          <div className="min-w-0 space-y-1"><p className="break-words text-sm font-semibold">{event.action} by {event.actorName || "Name unavailable"}</p><p className="break-words text-sm text-muted-foreground">{auditEventSummary(event)}</p></div>
        </li>)}
      </ol>}
    </>}
  </section>;
}
