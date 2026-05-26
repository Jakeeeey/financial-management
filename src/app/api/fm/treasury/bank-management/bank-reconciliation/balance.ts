import {
  asNumber,
  asString,
  directusFetch,
  DirectusList,
  roundMoney,
} from "./_utils";

type BankAccountRow = {
  bank_id?: unknown;
  opening_balance?: unknown;
  created_at?: unknown;
};

type BankDepositRow = {
  target_bank_id?: unknown;
  deposit_date?: unknown;
  total_cash?: unknown;
  total_checks?: unknown;
};

type BankTransferRow = {
  source_bank_id?: unknown;
  destination_bank_id?: unknown;
  amount?: unknown;
  transfer_fee?: unknown;
};

type DisbursementPaymentRow = {
  bank_id?: unknown;
  amount?: unknown;
};

function dateOnly(value: unknown) {
  return asString(value).slice(0, 10);
}

export function validateStatementDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

async function getBankAccount(bankId: number) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "bank_id,opening_balance,created_at");
  params.set("filter[bank_id][_eq]", String(bankId));

  const res = await directusFetch<DirectusList<BankAccountRow>>(
    `/items/bank_accounts?${params.toString()}`,
  );

  return res.data?.[0] ?? null;
}

async function getDepositRows(bankId: number, statementDate: string) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "target_bank_id,deposit_date,total_cash,total_checks");
  params.set("filter[_and][0][target_bank_id][_eq]", String(bankId));
  params.set("filter[_and][1][deposit_date][_lte]", statementDate);

  const res = await directusFetch<DirectusList<BankDepositRow>>(
    `/items/bank_deposit?${params.toString()}`,
  );
  return res.data ?? [];
}

async function getCompletedTransferRows(bankId: number, statementDate: string) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set(
    "fields",
    "source_bank_id,destination_bank_id,amount,transfer_fee",
  );
  params.set("filter[_and][0][status][_eq]", "COMPLETED");
  params.set("filter[_and][1][transfer_date][_lte]", statementDate);
  params.set("filter[_and][2][_or][0][source_bank_id][_eq]", String(bankId));
  params.set(
    "filter[_and][2][_or][1][destination_bank_id][_eq]",
    String(bankId),
  );

  const res = await directusFetch<DirectusList<BankTransferRow>>(
    `/items/bank_transfers?${params.toString()}`,
  );
  return res.data ?? [];
}

async function getDisbursementRows(bankId: number, statementDate: string) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "bank_id,date,amount");
  params.set("filter[_and][0][bank_id][_eq]", String(bankId));
  params.set("filter[_and][1][date][_lte]", statementDate);

  const res = await directusFetch<DirectusList<DisbursementPaymentRow>>(
    `/items/disbursement_payments?${params.toString()}`,
  );
  return res.data ?? [];
}

export async function calculateSystemBalance(
  bankId: number,
  statementDate: string,
) {
  const [bank, deposits, transfers, disbursements] = await Promise.all([
    getBankAccount(bankId),
    getDepositRows(bankId, statementDate),
    getCompletedTransferRows(bankId, statementDate),
    getDisbursementRows(bankId, statementDate),
  ]);

  if (!bank) throw new Error("Selected bank account was not found");

  const openingDate = dateOnly(bank.created_at);
  let balance =
    !openingDate || openingDate <= statementDate
      ? asNumber(bank.opening_balance) ?? 0
      : 0;

  for (const deposit of deposits) {
    balance +=
      (asNumber(deposit.total_cash) ?? 0) + (asNumber(deposit.total_checks) ?? 0);
  }

  for (const transfer of transfers) {
    const amount = asNumber(transfer.amount) ?? 0;
    const transferFee = asNumber(transfer.transfer_fee) ?? 0;
    if (asNumber(transfer.source_bank_id) === bankId) {
      balance -= amount + transferFee;
    }
    if (asNumber(transfer.destination_bank_id) === bankId) {
      balance += amount;
    }
  }

  for (const payment of disbursements) {
    balance -= asNumber(payment.amount) ?? 0;
  }

  return roundMoney(balance);
}
