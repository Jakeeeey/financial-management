"use client";
import { voucherCents, voucherMoney } from "../utils/voucherMoney";
import type { ReplenishmentLine } from "../replenishment-types";

const th = "px-3 py-2 text-left text-sm font-medium whitespace-nowrap";
const td = "px-3 py-2 text-sm align-top";

export function ReplenishmentJournal({ lines }: { lines: ReplenishmentLine[] }) {
  const dr = lines.reduce((sum, line) => sum + voucherCents(line.debit), 0n);
  const cr = lines.reduce((sum, line) => sum + voucherCents(line.credit), 0n);
  const amount = (cents: bigint) => `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
  if (!lines.length) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No journal lines to show yet.</p>;
  return <div className="overflow-x-auto rounded-lg border"><table className="w-full" aria-label="Journal entry preview"><thead className="bg-muted/40"><tr><th className={th}>Account</th><th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Credit</th></tr></thead><tbody>{lines.map((line, index) => <tr className="border-t" key={index}><td className={td}>{line.account.code} · {line.account.name}</td><td className={`${td} whitespace-nowrap text-right`}>{voucherMoney(line.debit)}</td><td className={`${td} whitespace-nowrap text-right`}>{voucherMoney(line.credit)}</td></tr>)}</tbody><tfoot className="border-t font-medium"><tr><td className={td}>Total</td><td className={`${td} whitespace-nowrap text-right`}>{voucherMoney(amount(dr))}</td><td className={`${td} whitespace-nowrap text-right`}>{voucherMoney(amount(cr))}</td></tr></tfoot></table></div>;
}
