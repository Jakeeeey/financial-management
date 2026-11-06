"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVoucherRead } from "./hooks/useVouchers";
import { ErrorBox, Paging } from "./components/OnboardingCommon";
import { VoucherEditor } from "./components/VoucherEditor";
import { VoucherReview, voucherMoney, voucherStatus } from "./components/VoucherReview";
import PettyCashVoucherDraftsModule from "./PettyCashVoucherDraftsModule";
import { VOUCHER_API } from "./providers/vouchers.api";
import type { Page } from "./onboarding-types";
import type { VoucherFund, VoucherOperations } from "./voucher-types";
export { voucherMoney } from "./components/VoucherReview";

const statusOptions = ["ALL", "DRAFT", "FOR_APPROVAL", "UNREPLENISHED", "SUBMITTED", "REPLENISHED", "REJECTED", "VOID"] as const;
const statusTone: Record<string, string> = {
  DRAFT: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  FOR_APPROVAL: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  UNREPLENISHED: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  SUBMITTED: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  REPLENISHED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  REJECTED: "border-destructive/30 bg-destructive/10 text-destructive",
  VOID: "border-muted-foreground/30 bg-muted text-muted-foreground",
};
function StatusBadge({ state }: { state: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone[state] || "border-border bg-muted"}`}>{voucherStatus(state)}</span>;
}

export default function PettyCashDisbursementModule({ canEdit, operational = false, actorName = "" }: { canEdit: boolean; operational?: boolean; actorName?: string }) {
  return operational ? <Disbursement actorName={actorName} /> : <PettyCashVoucherDraftsModule canEdit={canEdit} />;
}

function Register({ data, approval, filtered = false, onOpen }: { data: Page<VoucherOperations>; approval: boolean; filtered?: boolean; onOpen: (item: VoucherOperations) => void }) {
  const headers = approval ? ["Voucher", "Fund", "Payee / particulars", "Prepared by", "Date", "Gross", "Cash paid", "Status", ""] : ["Voucher", "Date", "Payee / particulars", "Receipts", "Gross", "Cash paid", "Status", ""];
  return <div><div className="hidden overflow-x-auto md:block"><table aria-label={approval ? "Vouchers awaiting approval" : "Fund vouchers"} className="w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:p-3 [&_th]:font-medium [&_td]:p-3"><thead className="border-y bg-muted/30"><tr>{headers.map((label, index) => <th key={index}>{label}</th>)}</tr></thead><tbody>{data.items.map(item => {
    const target = approval ? item.proposed || item.effective : item.effective;
    return <tr key={item.voucher.id} tabIndex={0} className="cursor-pointer border-b align-top hover:bg-muted/20" onClick={() => onOpen(item)} onKeyDown={event => { if (event.target === event.currentTarget && event.key === "Enter") onOpen(item); }}>
      <td className="whitespace-nowrap font-semibold">{item.voucher.docNo}</td><td className="whitespace-nowrap">{approval ? item.fundDocNo : target.saved.date}</td><td>{target.saved.payee.name}<small className="block text-muted-foreground">{target.saved.particulars}</small></td>
      <td>{approval ? target.preparedBy : <>{target.saved.lines.map(line => line.receiptNo).join(", ")}{target.attachments.length > 0 ? " · Attached" : ""}</>}</td>{approval && <td className="whitespace-nowrap">{target.saved.date}</td>}
      <td className="whitespace-nowrap">{voucherMoney(target.saved.totals.gross)}</td><td className="whitespace-nowrap">{voucherMoney(item.paidNetCash)}</td><td><StatusBadge state={item.voucher.state} />{item.proposed && <small className="block text-amber-700 dark:text-amber-300">{item.proposed.state === "DRAFT" ? "Correction draft" : "Needs re-approval"}</small>}{item.revisions.length > 1 && <small className="block text-muted-foreground">Revised {item.revisions.length - 1}×</small>}</td>
      <td><Button size="sm" variant="outline" aria-label={`${approval ? "Review" : "View"} ${item.voucher.docNo}`} onClick={event => { event.stopPropagation(); onOpen(item); }}>{approval ? "Review" : "View"}</Button></td>
    </tr>;
  })}</tbody></table></div>
    <div className="space-y-2 p-3 md:hidden">{data.items.map(item => {
      const target = approval ? item.proposed || item.effective : item.effective;
      return <div key={item.voucher.id} role="button" tabIndex={0} className="w-full rounded-lg border bg-background p-3 text-left" onClick={() => onOpen(item)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(item); } }}>
        <div className="flex items-start justify-between gap-2"><span className="font-mono font-semibold">{item.voucher.docNo}</span><StatusBadge state={item.voucher.state} /></div>
        <p className="mt-1 font-medium">{target.saved.payee.name}</p><p className="text-xs text-muted-foreground">{target.saved.particulars}</p>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs"><span>Date: {target.saved.date}</span><span className="text-right">Gross: {voucherMoney(target.saved.totals.gross)}</span><span>Cash paid: {voucherMoney(item.paidNetCash)}</span><span className="text-right">{approval ? `Fund: ${item.fundDocNo}` : `${target.saved.lines.length} line(s)`}</span></div>
        {item.proposed && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{item.proposed.state === "DRAFT" ? "Correction draft" : "Needs re-approval"}</p>}
      </div>;
    })}</div>
    {data.items.length === 0 && <p className="p-5 text-sm text-muted-foreground">{filtered ? "No vouchers match these filters." : approval ? "No vouchers are waiting for approval." : "No vouchers yet. Select “+ New voucher” to pay an expense from this fund."}</p>}
  </div>;
}
function Disbursement({ actorName }: { actorName: string }) {
  const funds = useVoucherRead<VoucherFund[]>("funds");
  const [fundId, setFundId] = useState<number | null>(null), [page, setPage] = useState(1), [approvalPage, setApprovalPage] = useState(1);
  const [modal, setModal] = useState<{ id: number; review: boolean } | null>(null), [editor, setEditor] = useState<"new" | VoucherOperations | null>(null);
  const [search, setSearch] = useState(""), [status, setStatus] = useState("ALL"), [dateFrom, setDateFrom] = useState(""), [dateTo, setDateTo] = useState("");
  const selected = funds.data?.find(fund => fund.id === fundId) || funds.data?.[0] || null;
  const editorFund = editor && editor !== "new" ? funds.data?.find(fund => fund.id === editor.voucher.fundId) : selected;
  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const filtered = Boolean(search.trim() || status !== "ALL" || dateFrom || dateTo);
  const registerParams = new URLSearchParams({ fundId: String(selected?.id || ""), page: String(page), pageSize: "25", status });
  if (search.trim()) registerParams.set("search", search.trim());
  if (dateFrom) registerParams.set("dateFrom", dateFrom);
  if (dateTo) registerParams.set("dateTo", dateTo);
  const register = useVoucherRead<Page<VoucherOperations>>(selected && !invalidRange ? `register?${registerParams}` : null, 250);
  const approvals = useVoucherRead<Page<VoucherOperations>>(`approvals?page=${approvalPage}&pageSize=25`);
  function refresh() { funds.refresh(); register.refresh(); approvals.refresh(); }
  function changed() { setEditor(null); setModal(null); setPage(1); setApprovalPage(1); refresh(); }
  function open(item: VoucherOperations) { if (item.voucher.state === "DRAFT") setEditor(item); else setModal({ id: item.voucher.id, review: false }); }
  function changeFilter(action: () => void) { action(); setPage(1); }
  function clearFilters() { setSearch(""); setStatus("ALL"); setDateFrom(""); setDateTo(""); setPage(1); }
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold tracking-tight">Disbursement</h1><p className="mt-2 text-sm text-muted-foreground">Pay small expenses from the fund, one voucher per payee with one line per receipt. Vouchers above the approval threshold wait for approval before cash goes out. No journal posts until replenishment.</p></div>
    <ErrorBox error={funds.error} retry={funds.refresh} title="Could not load Active funds" />{funds.loading && !funds.data && <p role="status">Loading funds...</p>}
    {selected && <div className="space-y-4"><label htmlFor="disbursement-fund" className="text-sm font-medium">Fund</label><select id="disbursement-fund" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.id} onChange={event => { setFundId(Number(event.target.value)); setPage(1); setModal(null); setEditor(null); }}>{funds.data?.map(fund => <option key={fund.id} value={fund.id}>{fund.docNo} · {fund.name} · {fund.custodianName}</option>)}</select>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Imprest amount", voucherMoney(selected.imprestAmount)], ["Open vouchers", voucherMoney(selected.openVouchers)], ["Cash on hand", voucherMoney(selected.expectedCash)], ["Fund used", `${Number(selected.usage).toFixed(0)}%`]].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded-full border px-3 py-1">Per-voucher limit <strong className="text-foreground">{voucherMoney(selected.perVoucherLimit)}</strong></span><span className="rounded-full border px-3 py-1">Approval above <strong className="text-foreground">{voucherMoney(selected.approvalThreshold)}</strong></span><span className="rounded-full border px-3 py-1">Fund used = open vouchers ÷ imprest</span></div>
      {Number(selected.usage) >= Number(selected.usageWarning || 60) && <p role="status" className={`rounded-lg border p-3 text-sm ${Number(selected.usage) >= Number(selected.usageCritical || 85) ? "border-destructive/40 text-destructive" : "border-amber-500/40"}`}>This fund is {Number(selected.usage).toFixed(0)}% used. Request replenishment before cash runs low.</p>}
    </div>}
    {approvals.loading && !approvals.data && <p role="status">Loading approval queue...</p>}<ErrorBox error={approvals.error} retry={approvals.refresh} title="Could not load the approval queue" />
    <section className="overflow-hidden rounded-xl border bg-card"><h2 className="p-5 text-lg font-semibold">Waiting for approval, all funds{approvals.data ? ` (${approvals.data.total})` : ""}</h2>{approvals.data && approvals.data.total > 0 ? <><Register data={approvals.data} approval onOpen={item => setModal({ id: item.voucher.id, review: true })} />{approvals.data.total > 25 && <div className="p-3"><Paging page={approvalPage} pageSize={25} total={approvals.data.total} onChange={setApprovalPage} /></div>}</> : approvals.data ? <p className="px-5 pb-5 text-sm text-muted-foreground">No vouchers are waiting for approval.</p> : null}</section>
    {!funds.loading && funds.data?.length === 0 && <p className="rounded-lg border p-5 text-sm">No Active funds available. Fund requests must be approved and funded before preparing vouchers.</p>}
    {selected && <section className="overflow-hidden rounded-xl border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-lg font-semibold">Vouchers for {selected.docNo}{register.data ? ` (${register.data.total})` : ""}</h2><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href={`${VOUCHER_API}/funds/${selected.id}/print`} target="_blank" rel="noreferrer">Print voucher list</a></Button><Button disabled={!selected.canPrepare} title={selected.canPrepare ? undefined : "Only the current fund custodian can prepare vouchers."} onClick={() => setEditor("new")}>+ New voucher</Button></div></div>
      <div className="flex flex-col gap-3 border-y bg-muted/10 p-3"><div className="flex flex-wrap items-center gap-2"><Input aria-label="Search vouchers" placeholder="Search voucher, payee, receipt, or particulars..." value={search} onChange={event => changeFilter(() => setSearch(event.target.value))} className="h-9 w-full bg-background sm:max-w-sm" /><select aria-label="Voucher status filter" value={status} onChange={event => changeFilter(() => setStatus(event.target.value))} className="h-9 rounded-md border bg-background px-3 text-sm">{statusOptions.map(value => <option key={value} value={value}>{value === "ALL" ? "All statuses" : voucherStatus(value)}</option>)}</select><Input aria-label="Voucher date from" type="date" value={dateFrom} onChange={event => changeFilter(() => setDateFrom(event.target.value))} className="h-9 w-auto bg-background" /><Input aria-label="Voucher date to" type="date" value={dateTo} onChange={event => changeFilter(() => setDateTo(event.target.value))} className="h-9 w-auto bg-background" />{filtered && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}</div>{invalidRange && <p role="alert" className="text-sm text-destructive">From must be on or before To.</p>}</div>
      <ErrorBox error={register.error} retry={register.refresh} title="Could not load vouchers" />{register.loading && !register.data && <p role="status" className="px-5 pb-5 text-sm">Loading vouchers...</p>}{register.data && <><Register data={register.data} approval={false} filtered={filtered} onOpen={open} />{register.data.total > 25 && <div className="p-3"><Paging page={page} pageSize={25} total={register.data.total} onChange={setPage} /></div>}</>}
    </section>}
    {modal && <VoucherReview key={`${modal.id}:${modal.review}`} id={modal.id} review={modal.review} actorName={actorName} onClose={() => setModal(null)} onReview={() => setModal({ ...modal, review: true })} onEdit={record => { setModal(null); setEditor(record); }} onChanged={changed} />}
    {editor && editorFund && <VoucherEditor key={editor === "new" ? "new" : editor.voucher.id} fund={editorFund} voucherId={editor === "new" ? null : editor.voucher.id} operational canEdit={editorFund.canPrepare} onClose={() => setEditor(null)} onDataChanged={register.refresh} onFinalized={changed} />}
  </section>;
}
