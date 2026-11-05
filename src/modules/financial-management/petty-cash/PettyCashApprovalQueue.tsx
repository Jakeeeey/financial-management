"use client";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFundRead } from "./hooks/useFunds";
import type { ApprovalRow } from "./master-types";
import type { Page } from "./onboarding-types";
import { MasterError, MasterTable } from "./components/MasterCommon";
import { FundChangeReview } from "./components/FundChangeReview";

export default function PettyCashApprovalQueue({ actorName, canDecide, renderFund }: { actorName: string; canDecide: boolean; renderFund: (id: string, close: () => void, changed: (message?: string) => void) => ReactNode }) {
  const [selected, setSelected] = useState<ApprovalRow | null>(null), [pendingPage, setPendingPage] = useState(1), [decidedPage, setDecidedPage] = useState(1);
  const pending = useFundRead<Page<ApprovalRow>>(`onboarding-approval/requests?queue=pending&page=${pendingPage}&pageSize=25`), decided = useFundRead<Page<ApprovalRow>>(`onboarding-approval/requests?queue=decided&page=${decidedPage}&pageSize=25`);
  function changed(message?: string) {
    toast.success(message || (selected ? `${selected.docNo} decided. The request was moved to Decided.` : "Decision saved."));
    setSelected(null);
    if (pendingPage > 1 && pending.data?.items.length === 1) setPendingPage(page => page - 1);
    setDecidedPage(1); pending.refresh(); decided.refresh();
  }
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold">Onboarding Approval</h1><p className="mt-2 text-sm text-muted-foreground">Approve or reject new funds and changes to existing funds. Select a request to review its details and posting.</p></div>
    {([{ name: "Awaiting approval", read: pending, page: pendingPage, setPage: setPendingPage, isPending: true }, { name: "Decided requests", read: decided, page: decidedPage, setPage: setDecidedPage, isPending: false }]).map(({ name, read, page, setPage, isPending }) => <section key={name} className="space-y-3 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{isPending ? `Awaiting approval${read.data ? ` (${read.data.total})` : ""}` : "Decided"}</h2><MasterError error={read.error} retry={read.refresh} title={isPending ? "Could not load approval queue" : "Could not load decided requests"} />{read.loading && <p role="status">Loading requests...</p>}{read.data && <><MasterTable label={name} headers={isPending ? ["Request", "Type", "Fund", "Detail", "Requested by", "Date", "Status", ""] : ["Request", "Type", "Fund", "Requested by", "Decided by", "Status", "Entry"]}>{read.data.items.map(r => <tr key={`${r.kind}:${r.id}`} className="cursor-pointer align-top hover:bg-muted/30" tabIndex={0} onClick={() => setSelected(r)} onKeyDown={e => { if (e.target === e.currentTarget && e.key === "Enter") setSelected(r); }}><td><button className="font-semibold" aria-label={`Review ${r.docNo}`} onClick={e => { e.stopPropagation(); setSelected(r); }}>{r.docNo}</button></td><td>{r.type}</td><td>{r.fund}</td>{isPending && <td>{r.detail}</td>}<td>{r.requestedBy}</td><td>{isPending ? r.requestedAt.slice(0, 10) : <>{r.decidedBy}<small className="block text-muted-foreground">{r.decidedAt.replace("T", " ").slice(0, 16)}</small></>}</td><td>{r.state}{r.state === "REJECTED" && <small className="block">{r.remarks}</small>}</td><td>{isPending ? <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setSelected(r); }}>Review</Button> : r.journal || "—"}</td></tr>)}{!read.data.items.length && <tr><td colSpan={isPending ? 8 : 7}>{isPending ? "Nothing waiting. New fund requests and Master List changes appear here." : "None yet."}</td></tr>}</MasterTable>{read.data.total > 25 && <div className="flex items-center justify-end gap-3"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page => page - 1)}>Previous</Button><span className="text-sm">Page {page}</span><Button variant="outline" size="sm" disabled={page * 25 >= read.data.total} onClick={() => setPage(page => page + 1)}>Next</Button></div>}</>}</section>)}
    <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Entries posted on approval</h2><MasterTable label="Entries posted on approval" headers={["Event", "Debit", "Credit"]}>{[["New fund / Increase imprest", "Fund account (GL)", "Selected cash / bank"], ["Decrease imprest", "Selected cash / bank", "Fund account (GL)"], ["Close fund", "Cash / bank (counted), Cash Over/Short if short", "Fund account (GL), Cash Over/Short if over"], ["Change custodian", "No entry", "No entry"]].map(([event, dr, cr]) => <tr key={event}><td>{event}</td><td>{dr}</td><td>{cr}</td></tr>)}</MasterTable></section>
    {selected && (selected.kind === "FUND" ? renderFund(selected.id, () => setSelected(null), changed) : <FundChangeReview key={selected.id} id={selected.id} actorName={actorName} canDecide={canDecide} onClose={() => setSelected(null)} onChanged={changed} />)}
  </section>;
}
