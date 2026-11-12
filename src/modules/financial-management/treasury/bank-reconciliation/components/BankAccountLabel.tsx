import type { BankAccountReference } from "../reference-types";

type BankIdentity = Pick<BankAccountReference, "bankName" | "branch" | "maskedAccountNumber">;
function parts(bank: BankIdentity) {
  return {
    name: [bank.bankName.trim(), bank.branch.trim()].filter(Boolean).join(" · ") || "Bank and branch unavailable",
    number: bank.maskedAccountNumber?.trim() || "Account number unavailable",
  };
}
export function bankAccountLabel(bank: BankIdentity) {
  const value = parts(bank);
  return `${value.name} · ${value.number}`;
}
export function BankAccountLabel({ bank, truncate = false }: { bank: BankIdentity; truncate?: boolean }) {
  const value = parts(bank);
  return <span className={`min-w-0 ${truncate ? "flex flex-1 items-center" : "flex flex-wrap items-baseline gap-y-1"}`}>
    <span className={truncate ? "min-w-0 flex-1 truncate text-left" : "min-w-0 max-w-full whitespace-normal break-words"}>{value.name}</span>
    <span className={bank.maskedAccountNumber ? "shrink-0 whitespace-nowrap tabular-nums" : truncate ? "min-w-0 truncate" : "max-w-full whitespace-normal break-words"}>{` · ${value.number}`}</span>
  </span>;
}
