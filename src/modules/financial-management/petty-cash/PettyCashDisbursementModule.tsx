"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useVoucherRead } from "./hooks/useVouchers";
import { ErrorBox, Paging } from "./components/OnboardingCommon";
import { VoucherEditor } from "./components/VoucherEditor";
import { VoucherReview, voucherMoney, voucherStatus } from "./components/VoucherReview";
import PettyCashVoucherDraftsModule from "./PettyCashVoucherDraftsModule";
import { VOUCHER_API } from "./providers/vouchers.api";
import type { Page } from "./onboarding-types";
import type { VoucherFund, VoucherOperations } from "./voucher-types";
export { voucherMoney } from "./components/VoucherReview";

export default function PettyCashDisbursementModule({ canEdit, operational = false, actorName = "" }: { canEdit: boolean; operational?: boolean; actorName?: string }) {
  return operational ? <Disbursement actorName={actorName} /> : <PettyCashVoucherDraftsModule canEdit={canEdit} />;
}
function Register({ data, approval, onOpen }: { data: Page<VoucherOperations>; approval: boolean; onOpen: (item: VoucherOperations) => void }) {
  const headers = approval ? ["Voucher", "Fund", "Payee / particulars", "Prepared by", "Date", "Gross", "Cash paid", "Status", ""] : ["Voucher", "Date", "Payee / particulars", "Receipts", "Gross", "Cash paid", "Status", ""];
  return <div className="overflow-x-auto"><table aria-label={approval ? "Vouchers awaiting approval" : "Fund vouchers"} className="w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:p-3 [&_th]:font-medium [&_td]:p-3"><thead className="border-y bg-muted/30"><tr>{headers.map((label, index) => <th key={index}>{label}</th>)}</tr></thead><tbody>{data.items.map(item => {
    const target = approval ? item.proposed || item.effective : item.effective;
    return <tr key={item.voucher.id} tabIndex={0} className="cursor-pointer border-b align-top hover:bg-muted/20" onClick={() => onOpen(item)} onKeyDown={event => { if (event.target === event.currentTarget && event.key === "Enter") onOpen(item); }}>
      <td className="whitespace-nowrap font-semibold">{item.voucher.docNo}</td><td className="whitespace-nowrap">{approval ? item.fundDocNo : target.saved.date}</td><td>{target.saved.payee.name}<small className="block text-muted-foreground">{target.saved.particulars}</small></td>
      <td>{approval ? target.preparedBy : <>{target.saved.lines.map(line => line.receiptNo).join(", ")}{target.attachments.length > 0 ? " · Attached" : ""}</>}</td>{approval && <td className="whitespace-nowrap">{target.saved.date}</td>}
      <td className="whitespace-nowrap">{voucherMoney(target.saved.totals.gross)}</td><td className="whitespace-nowrap">{voucherMoney(item.paidNetCash)}</td><td>{voucherStatus(item.voucher.state)}{item.proposed && <small className="block text-amber-700 dark:text-amber-300">{item.proposed.state === "DRAFT" ? "Correction draft" : "Needs re-approval"}</small>}{item.revisions.length > 1 && <small className="block text-muted-foreground">Revised {item.revisions.length - 1}×</small>}</td>
      <td><Button size="sm" variant="outline" aria-label={`${approval ? "Review" : "View"} ${item.voucher.docNo}`} onClick={event => { event.stopPropagation(); onOpen(item); }}>{approval ? "Review" : "View"}</Button></td>
    </tr>;
  })}</tbody></table>{data.items.length === 0 && <p className="p-5 text-sm text-muted-foreground">No vouchers yet. Select “+ New voucher” to pay an expense from this fund.</p>}</div>;
}
function Disbursement({ actorName }: { actorName: string }) {
  const funds = useVoucherRead<VoucherFund[]>("funds");
  const [fundId, setFundId] = useState<number | null>(null), [page, setPage] = useState(1), [approvalPage, setApprovalPage] = useState(1);
  const [modal, setModal] = useState<{ id: number; review: boolean } | null>(null), [editor, setEditor] = useState<"new" | VoucherOperations | null>(null), [message, setMessage] = useState("");
  const selected = funds.data?.find(fund => fund.id === fundId) || funds.data?.[0] || null;
  const editorFund = editor && editor !== "new" ? funds.data?.find(fund => fund.id === editor.voucher.fundId) : selected;
  const register = useVoucherRead<Page<VoucherOperations>>(selected ? `register?fundId=${selected.id}&page=${page}&pageSize=25` : null);
  const approvals = useVoucherRead<Page<VoucherOperations>>(`approvals?page=${approvalPage}&pageSize=25`);
  function refresh() { funds.refresh(); register.refresh(); approvals.refresh(); }
  function changed(value: VoucherOperations) { setMessage(`${value.voucher.docNo} · ${voucherStatus(value.voucher.state)}${value.proposed ? " · Changes awaiting approval" : ""}.`); setEditor(null); setModal(null); setPage(1); setApprovalPage(1); refresh(); }
  function open(item: VoucherOperations) { if (item.voucher.state === "DRAFT") setEditor(item); else setModal({ id: item.voucher.id, review: false }); }
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold tracking-tight">Disbursement</h1><p className="mt-2 text-sm text-muted-foreground">Pay small expenses from the fund, one voucher per payee with one line per receipt. Vouchers above the approval threshold wait for approval before cash goes out. No journal posts until replenishment.</p></div>
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}<ErrorBox error={funds.error} retry={funds.refresh} />{funds.loading && <p role="status">Loading funds...</p>}
    {selected && <div className="space-y-4"><label htmlFor="disbursement-fund" className="text-sm font-medium">Fund</label><select id="disbursement-fund" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.id} onChange={event => { setFundId(Number(event.target.value)); setPage(1); setModal(null); setEditor(null); }}>{funds.data?.map(fund => <option key={fund.id} value={fund.id}>{fund.docNo} · {fund.name} · {fund.custodianName}</option>)}</select>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Imprest amount", voucherMoney(selected.imprestAmount)], ["Open vouchers", voucherMoney(selected.openVouchers)], ["Cash on hand", voucherMoney(selected.expectedCash)], ["Fund used", `${Number(selected.usage).toFixed(0)}%`]].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
      {Number(selected.usage) >= Number(selected.usageWarning || 60) && <p role="status" className={`rounded-lg border p-3 text-sm ${Number(selected.usage) >= Number(selected.usageCritical || 85) ? "border-destructive/40 text-destructive" : "border-amber-500/40"}`}>This fund is {Number(selected.usage).toFixed(0)}% used. Request replenishment before cash runs low.</p>}
    </div>}
    <ErrorBox error={approvals.error} retry={approvals.refresh} />{approvals.loading && <p role="status">Loading approval queue...</p>}
    {approvals.data && approvals.data.total > 0 && <section className="overflow-hidden rounded-xl border bg-card"><h2 className="p-5 text-lg font-semibold">Waiting for approval, all funds ({approvals.data.total})</h2><Register data={approvals.data} approval onOpen={item => setModal({ id: item.voucher.id, review: true })} />{approvals.data.total > 25 && <div className="p-3"><Paging page={approvalPage} pageSize={25} total={approvals.data.total} onChange={setApprovalPage} /></div>}</section>}
    {!funds.loading && funds.data?.length === 0 && <p className="rounded-lg border p-5 text-sm">No Active funds available. Fund requests must be approved and funded before preparing vouchers.</p>}
    {selected && <section className="overflow-hidden rounded-xl border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-lg font-semibold">Vouchers for {selected.docNo}{register.data ? ` (${register.data.total})` : ""}</h2><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href={`${VOUCHER_API}/funds/${selected.id}/print`} target="_blank" rel="noreferrer">Print voucher list</a></Button><Button disabled={!selected.canPrepare} onClick={() => setEditor("new")}>+ New voucher</Button></div></div><ErrorBox error={register.error} retry={register.refresh} />
      {register.loading && <p role="status" className="px-5 pb-5 text-sm">Loading vouchers...</p>}{register.data && <><Register data={register.data} approval={false} onOpen={open} />{register.data.total > 25 && <div className="p-3"><Paging page={page} pageSize={25} total={register.data.total} onChange={setPage} /></div>}</>}
    </section>}
    {modal && <VoucherReview key={`${modal.id}:${modal.review}`} id={modal.id} review={modal.review} actorName={actorName} onClose={() => { setModal(null); refresh(); }} onReview={() => setModal({ ...modal, review: true })} onEdit={record => { setModal(null); setEditor(record); }} onChanged={changed} />}
    {editor && editorFund && <VoucherEditor key={editor === "new" ? "new" : editor.voucher.id} fund={editorFund} voucherId={editor === "new" ? null : editor.voucher.id} operational canEdit={editorFund.canPrepare} paidNetCash={editor === "new" ? "0.00" : editor.paidNetCash} onClose={() => { setEditor(null); refresh(); }} onFinalized={changed} />}
  </section>;
}
