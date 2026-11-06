"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OnboardingError } from "../providers/onboarding.api";
import { MasterError } from "./MasterCommon";
import { CsvSkeleton } from "./PettyCashSkeletons";

export function ReportCsv({ dataset, query, title, onClose }: { dataset: string; query: string; title: string; onClose: () => void }) {
  const [result, setResult] = useState<{ text?: string; error?: Error } | null>(null), [revision, setRevision] = useState(0), [message, setMessage] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/fm/petty-cash/reports/export/${dataset}?${query}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) { const body = await response.json().catch(() => null); throw new OnboardingError(body?.message || "Unable to export this report.", response.status, body?.fieldErrors || {}, body?.requestId); }
      return response.text();
    }).then(text => { if (!controller.signal.aborted) setResult({ text }); }).catch(error => { if (!controller.signal.aborted) setResult({ error: error instanceof Error ? error : new Error("Unable to export this report.") }); });
    return () => controller.abort();
  }, [dataset, query, revision]);
  function download() {
    if (result?.text == null) return; const url = URL.createObjectURL(new Blob(["\ufeff", result.text.replace(/^\ufeff/, "")], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = `petty-cash-${dataset}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast.success("CSV downloaded.");
  }
  async function copy() {
    try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(result?.text || ""); setMessage("CSV copied."); toast.success("CSV copied."); }
    catch { textarea.current?.focus(); textarea.current?.select(); const copied = document.execCommand("copy"); setMessage(copied ? "CSV copied." : "Select the CSV text and copy it."); if (copied) toast.success("CSV copied."); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Complete server-generated CSV for the applied report scope.</DialogDescription></DialogHeader>
    {!result && <CsvSkeleton />}<MasterError error={result?.error} retry={() => { setResult(null); setRevision(value => value + 1); }} title="Unable to prepare the CSV export" />
    {result?.text != null && <><textarea ref={textarea} aria-label="CSV preview" rows={12} readOnly className="w-full rounded border p-3 font-mono text-xs" value={result.text} /><div className="flex flex-wrap gap-2"><Button onClick={download}>Download CSV</Button><Button variant="outline" onClick={copy}>Copy</Button></div></>}{message && <p role="status">{message}</p>}
  </DialogContent></Dialog>;
}
