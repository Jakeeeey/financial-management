"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Page } from "./onboarding-types";
import type { Voucher, VoucherFund } from "./voucher-types";
import { useVoucherRead } from "./hooks/useVouchers";
import { ErrorBox, Paging } from "./components/OnboardingCommon";
import { VoucherEditor } from "./components/VoucherEditor";

export const voucherMoney = (value: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
export default function PettyCashVoucherDraftsModule({ canEdit }: { canEdit: boolean }) {
  const funds = useVoucherRead<VoucherFund[]>("funds");
  const [fundId, setFundId] = useState<number | null>(null), [search, setSearch] = useState(""), [page, setPage] = useState(1), [editor, setEditor] = useState<number | "new" | null>(null);
  const selected = funds.data?.find(fund => fund.id === fundId) || funds.data?.[0] || null;
  const register = useVoucherRead<Page<Voucher>>(selected ? `vouchers?${new URLSearchParams({ fundId: String(selected.id), search, page: String(page), pageSize: "25" })}` : null, 250);
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold tracking-tight">Disbursement</h1><p className="mt-2 text-sm text-muted-foreground">Prepare complete unpaid voucher drafts. Saving a draft reserves its receipts; cash and the ledger remain unchanged.</p></div>
    <ErrorBox error={funds.error} retry={funds.refresh} />{funds.loading && <p role="status">Loading Active funds...</p>}
    {funds.data?.length === 0 && <div className="rounded-xl border bg-card p-5"><h2 className="font-medium">No Active funds available</h2><p className="mt-2 text-sm text-muted-foreground">Fund approval and activation are required before voucher preparation. Pending fund requests cannot pay vouchers.</p></div>}
    {selected && <><div className="space-y-3 rounded-xl border bg-card p-5"><label htmlFor="voucher-fund" className="text-sm font-medium">Active fund</label><select id="voucher-fund" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.id} onChange={event => { setFundId(Number(event.target.value)); setPage(1); setSearch(""); }}>
      {funds.data?.map(fund => <option key={fund.id} value={fund.id}>{fund.docNo} · {fund.name}</option>)}
    </select><div className="grid gap-3 text-sm sm:grid-cols-3"><p>Per-voucher hard limit<br /><strong>{voucherMoney(selected.perVoucherLimit)}</strong></p><p>Approval required above<br /><strong>{voucherMoney(selected.approvalThreshold)}</strong></p><p>Expected cash<br /><strong>{voucherMoney(selected.expectedCash)}</strong></p></div><p className="text-xs text-muted-foreground">The gross voucher total controls the hard limit. Cash availability and payment approval are checked when finalization is implemented.</p></div>
      <div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Voucher drafts</h2>{canEdit && <Button onClick={() => setEditor("new")}>New voucher draft</Button>}</div>
        <Input aria-label="Search voucher drafts" placeholder="Search PCV number" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><ErrorBox error={register.error} retry={register.refresh} />
        {register.loading && <p role="status">Loading voucher drafts...</p>}{register.data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Voucher", "Date", "Payee / Particulars", "Gross", "Net cash payable", "Status", "Details"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
          {register.data.items.map(voucher => <tr key={voucher.id} className="border-t"><td className="p-3 font-medium">{voucher.docNo}</td><td className="whitespace-nowrap p-3">{voucher.saved.date}</td><td className="p-3">{voucher.saved.payee.name}<span className="block break-words text-xs text-muted-foreground">{voucher.saved.particulars}</span></td><td className="whitespace-nowrap p-3">{voucherMoney(voucher.saved.totals.gross)}</td><td className="whitespace-nowrap p-3">{voucherMoney(voucher.saved.totals.netCash)}</td><td className="p-3">Draft · Unpaid</td><td className="p-3"><Button size="sm" variant="outline" aria-label={`Open ${voucher.docNo}`} onClick={() => setEditor(voucher.id)}>Open draft</Button></td></tr>)}
          {!register.data.items.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No voucher drafts yet.</td></tr>}
        </tbody></table></div><Paging page={page} total={register.data.total} pageSize={register.data.pageSize} onChange={setPage} /></>}
      </div>{editor !== null && <VoucherEditor key={editor} fund={selected} voucherId={editor === "new" ? null : editor} canEdit={canEdit} onClose={() => { setEditor(null); register.refresh(); }} />}
    </>}
  </section>;
}
