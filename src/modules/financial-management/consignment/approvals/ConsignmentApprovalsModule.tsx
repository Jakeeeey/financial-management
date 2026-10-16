"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConsignmentAccess } from "../hooks/useConsignmentAccess";
import { consignmentApi, type ConsignmentDocument } from "../providers/consignmentApi";
import { formatManilaDateTime, formatPeso, isOlderThanTwoDays } from "../controls/control-utils";

type ApprovalPage = Awaited<ReturnType<typeof consignmentApi.listApprovals>>;

export default function ConsignmentApprovalsModule() {
  const { access, loading: accessLoading } = useConsignmentAccess();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ApprovalPage | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (targetPage = 0) => {
    setLoading(true);
    setError("");
    try {
      const response = await consignmentApi.listApprovals(targetPage);
      setResult(response);
      setPage(response.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load pending approvals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(0); }, [load]);

  async function review(document: ConsignmentDocument, decision: "approve" | "reject") {
    setActiveDocumentId(document.documentId);
    setError("");
    setMessage("");
    try {
      if (decision === "approve") await consignmentApi.approveDocument(document.documentId);
      else await consignmentApi.rejectDocument(document.documentId, rejectReasons[document.documentId]?.trim() ?? "");
      setRejectReasons((current) => { const next = { ...current }; delete next[document.documentId]; return next; });
      setMessage(`Document #${document.documentId} was ${decision === "approve" ? "approved and posted" : "rejected"}.`);
      await load(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${decision} document #${document.documentId}.`);
    } finally {
      setActiveDocumentId(null);
    }
  }

  if (accessLoading) return <main className="p-6 text-sm text-muted-foreground">Checking Consignment access…</main>;
  if (!access?.capabilities.includes("REVIEW_DOCUMENT")) {
    return <main className="p-6 text-sm text-muted-foreground">Consignment Approver access is required to review submissions.</main>;
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Consignment Approvals</h1><p className="mt-1 text-sm text-muted-foreground">Review pending records. Approval reruns validation and posts through the shared ERP ledger transaction.</p></div>
        <Button variant="outline" onClick={() => void load(page)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</Button>
      </div>
      {error && <Alert variant="destructive"><AlertTitle>Review failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertTitle>Updated</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      <section className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[68rem] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Consignee / invoice</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3 text-right">Net amount</th><th className="px-4 py-3">Decision</th></tr>
          </thead>
          <tbody>
            {result?.items.map((document) => {
              const submittedAt = document.submittedAt ?? document.createdAt;
              const overdue = isOlderThanTwoDays(submittedAt);
              const working = activeDocumentId === document.documentId;
              return (
                <tr key={document.documentId} className="border-t align-top">
                  <td className="px-4 py-3"><div className="font-medium">{document.documentType} · #{document.documentId}</div><div className="text-xs text-muted-foreground">Date {document.documentDate} · {document.status}</div></td>
                  <td className="px-4 py-3"><div>Consignee #{document.consigneeId}</div><div className="text-xs text-muted-foreground">{document.externalReference || "No external reference"}</div></td>
                  <td className="px-4 py-3"><div>{formatManilaDateTime(submittedAt)}</div>{overdue && <div className="mt-1 text-xs font-medium text-amber-700">Pending over 2 days</div>}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPeso(document.netAmount)}</td>
                  <td className="min-w-72 space-y-2 px-4 py-3">
                    <Button size="sm" onClick={() => void review(document, "approve")} disabled={loading || activeDocumentId !== null}>{working ? "Posting…" : "Approve & post"}</Button>
                    <div className="flex gap-2">
                      <input className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" placeholder="Rejection reason" value={rejectReasons[document.documentId] ?? ""} onChange={(event) => setRejectReasons((current) => ({ ...current, [document.documentId]: event.target.value }))} maxLength={1000} aria-label={`Rejection reason for document ${document.documentId}`} />
                      <Button size="sm" variant="destructive" onClick={() => void review(document, "reject")} disabled={loading || activeDocumentId !== null || !(rejectReasons[document.documentId] ?? "").trim()}>{working ? "Saving…" : "Reject"}</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!result || result.items.length === 0) && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{loading ? "Loading approvals…" : "There are no pending Consignment approvals."}</td></tr>}
          </tbody>
        </table>
        {(page > 0 || result?.hasNext) && <div className="flex justify-end gap-2 border-t p-3"><Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={loading || page === 0}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={loading || !result?.hasNext}>Next</Button></div>}
      </section>
    </main>
  );
}
