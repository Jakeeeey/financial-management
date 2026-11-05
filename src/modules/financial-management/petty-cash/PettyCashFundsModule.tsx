"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFundRead } from "./hooks/useFunds";
import { OnboardingError } from "./providers/onboarding.api";
import type { FundDetails, FundRecord } from "./fund-types";

type Page = { items: FundRecord[]; page: number; pageSize: number; total: number };
const money = (value: string | null) => {
  if (value === null) return "—";
  const [whole, cents = "00"] = value.replace(/^-/, "").split(".");
  return `${value.startsWith("-") ? "-" : ""}₱${BigInt(whole).toLocaleString("en-PH")}.${cents.padEnd(2, "0")}`;
};
function Failure({ error }: { error?: Error | null }) {
  if (!error) return null;
  return <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"><p>{error.message}</p>{error instanceof OnboardingError && <>{Object.entries(error.fields).map(([key, value]) => <p key={key}>{value}</p>)}{error.requestId && <p className="mt-1 text-xs">Reference: {error.requestId}</p>}</>}</div>;
}
export default function PettyCashFundsModule() {
  const params = useSearchParams(), pathname = usePathname(), router = useRouter();
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("ALL"), [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const query = new URLSearchParams({ search, page: String(page), pageSize: "25", status: filter });
  const register = useFundRead<Page>(`master-list/funds?${query}`, 250), sourceId = params.get("fundId"), id = selected ?? sourceId;
  function close() { setSelected(null); if (sourceId) { const next = new URLSearchParams(params.toString()); next.delete("fundId"); router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }); } }
  return <section className="space-y-4"><div><h1 className="text-2xl font-semibold tracking-tight">Master List</h1><p className="mt-2 text-sm text-muted-foreground">Fund positions, custodians, establishment entries, and approval history.</p></div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"><Input aria-label="Search funds" placeholder="Search fund number or name" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="w-full sm:max-w-sm" />
      <select aria-label="Fund status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm">{["ALL", "PENDING", "ACTIVE", "REJECTED", "CLOSED"].map(value => <option key={value} value={value}>{value === "ALL" ? "All statuses" : value}</option>)}</select><Button variant="outline" onClick={register.refresh}>Refresh</Button></div>
    <Failure error={register.error} />
    {register.loading ? <p role="status">Loading funds...</p> : register.data && <><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Fund", "Branch / Department", "Custodian", "Requested", "Approved", "Voucher limit", "Approval threshold", "Expected cash", "Status", ""].map((title, index) => <th key={index} className="whitespace-nowrap p-3 font-medium">{title}</th>)}</tr></thead><tbody>{register.data.items.map(fund => <tr key={fund.id} className="border-t align-top"><td className="p-3"><strong className="whitespace-nowrap">{fund.docNo}</strong><p>{fund.name}</p></td><td className="p-3">{fund.branch?.name || "—"}<p className="text-muted-foreground">{fund.department?.name || "—"}</p></td><td className="p-3">{fund.custodian?.name || "—"}</td>{[fund.imprestAmount, fund.approvedAmount, fund.perVoucherLimit, fund.approvalThreshold, fund.expectedCash].map((value, index) => <td key={index} className="whitespace-nowrap p-3 text-right tabular-nums">{money(value)}</td>)}<td className="p-3">{fund.status}</td><td className="p-3"><Button variant="outline" size="sm" aria-label={`View ${fund.docNo}`} onClick={() => setSelected(fund.id)}>Details</Button></td></tr>)}</tbody></table>{register.data.items.length === 0 && <p className="p-6 text-sm text-muted-foreground">No funds match this view.</p>}</div><div className="flex flex-wrap items-center justify-end gap-3 text-sm"><span>{register.data.total} fund(s) · Page {page}</span><Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><Button variant="outline" disabled={page * 25 >= register.data.total} onClick={() => setPage(value => value + 1)}>Next</Button></div></>}
    {id && <FundReview key={id} id={id} onClose={close} />}
  </section>;
}
function FundReview({ id, onClose }: { id: string; onClose: () => void }) {
  const valid = /^[1-9]\d{0,17}$/.test(id), read = useFundRead<FundDetails>(valid ? `master-list/funds/${id}` : null);
  const data = read.data, fund = data?.fund;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{fund ? `${fund.docNo} · ${fund.name}` : "Fund details"}</DialogTitle><DialogDescription>Read-only fund position and establishment history.</DialogDescription></DialogHeader>
    {!valid && <p role="alert">Invalid fund reference.</p>}{read.loading && <p role="status">Loading fund details...</p>}<Failure error={read.error} />
    {data && fund && <><div className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-3">{[["Status", fund.status], ["Requested by", fund.requestedBy?.name], ["Custodian", fund.custodian?.name], ["Branch", fund.branch?.name], ["Department", fund.department?.name], ["Division", fund.division?.name], ["Requested amount", money(fund.imprestAmount)], ["Approved amount", money(fund.approvedAmount)], ["Expected cash", money(fund.expectedCash)], ["Per-voucher limit", money(fund.perVoucherLimit)], ["Approval threshold", money(fund.approvalThreshold)], ["Approved on", fund.approvedAt], ["Approved by", fund.approvedBy?.name], ["Requested fund account", fund.fundAccount ? `${fund.fundAccount.code} · ${fund.fundAccount.name}` : "—"]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-medium">{value || "—"}</p></div>)}</div>
      {data.journal && <p className="text-sm">Establishment journal: {data.canViewJournal ? <Link className="font-medium text-primary underline" href={`/fm/financial-statements/journal-entry?search=${encodeURIComponent(data.journal.number)}`}>{data.journal.number}</Link> : <strong>{data.journal.number}</strong>} · {data.journal.accountingDate} · {money(data.journal.amount)}</p>}
      {data.movements.length > 0 && <section><h2 className="font-medium">Cash movements</h2>{data.movements.map((movement, index) => <p key={index} className="mt-2 text-sm">{movement.effectiveDate} · {movement.kind} · {money(movement.amount)} · Expected cash {money(movement.resultingBalance)}</p>)}</section>}
      <section><h2 className="font-medium">Request history</h2>{data.history.map((entry, index) => <div key={index} className="mt-2 rounded-lg border p-3 text-sm"><p>{entry.action.replaceAll("_", " ")} · {entry.actorName}</p><p className="text-xs text-muted-foreground">{entry.occurredAt}</p>{entry.reason && <p className="mt-1 whitespace-pre-wrap">{entry.reason}</p>}</div>)}</section>
    </>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button variant="outline" onClick={read.refresh}>Reload review</Button></div>
  </DialogContent></Dialog>;
}
