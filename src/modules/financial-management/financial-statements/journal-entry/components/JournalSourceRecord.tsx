"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function useJournalSourceRecord<T>(type: string) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.get("sourceId");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; record?: T; error?: string } | null>(null);
  const key = JSON.stringify([type, id, revision]);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      try {
        if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) throw new Error("Invalid source record ID.");
        const response = await fetch(`/api/fm/financial-statements/journal-entry/drill-down/source-record?${new URLSearchParams({ type, id })}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? "You do not have access to this source record." : response.status === 401 ? "Please sign in to inspect this record." : response.status === 404 ? "Source record no longer exists." : "Unable to load the source record. Please retry.");
        const record = await response.json() as T;
        if (active) setResult({ key, record });
        clearTimeout(timer);
      } catch (error) {
        if (active) setResult({ key, error: controller.signal.aborted ? "The source request timed out. Please retry." : error instanceof Error ? error.message : "Unable to load source record." });
      }
    };
    void load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [id, type, key]);
  return {
    id,
    record: id && result?.key === key ? result.record ?? null : null,
    error: id && result?.key === key ? result.error ?? "" : "",
    loading: Boolean(id && result?.key !== key),
    retry: () => setRevision(value => value + 1),
    close: () => { const next = new URLSearchParams(params.toString()); next.delete("sourceId"); router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }); },
  };
}

export function JournalSourceFeedback({ source }: { source: { id: string | null; record: unknown; error: string; loading: boolean; close: () => void; retry: () => void } }) {
  if (!source.id || source.record) return null;
  return <Dialog open onOpenChange={open => { if (!open) source.close(); }}><DialogContent><DialogHeader><DialogTitle>Source record</DialogTitle><DialogDescription>Inspect the original document referenced by the journal.</DialogDescription></DialogHeader>{source.error ? <p role="alert" className="text-sm text-destructive">{source.error}</p> : <p role="status" className="text-sm text-muted-foreground">Loading source record...</p>}<div className="flex justify-end gap-2">{source.error && <Button variant="outline" onClick={source.retry}>Retry source record</Button>}<Button variant="outline" onClick={source.close}>Close</Button></div></DialogContent></Dialog>;
}
