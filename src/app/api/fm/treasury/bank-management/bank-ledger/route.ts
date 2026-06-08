import { NextRequest, NextResponse } from "next/server";
import {
  asBoolean,
  asNumber,
  asString,
  directusFetch,
  DirectusList,
  isFieldAccessError,
  jsonError,
  roundMoney,
} from "./_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LedgerEntryType =
  | "OPENING_BALANCE"
  | "DEPOSIT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "DISBURSEMENT";

type BankAccountRow = {
  bank_id?: unknown;
  bank_name?: unknown;
  account_number?: unknown;
  branch?: unknown;
  is_active?: unknown;
  opening_balance?: unknown;
  created_at?: unknown;
};

type BankDepositRow = {
  id?: unknown;
  deposit_no?: unknown;
  deposit_date?: unknown;
  target_bank_id?: unknown;
  total_cash?: unknown;
  total_checks?: unknown;
  status?: unknown;
};

type BankTransferRow = {
  transfer_id?: unknown;
  transfer_no?: unknown;
  transfer_date?: unknown;
  source_bank_id?: unknown;
  destination_bank_id?: unknown;
  amount?: unknown;
  transfer_fee?: unknown;
};

type DisbursementPaymentRow = {
  id?: unknown;
  bank_id?: unknown;
  check_no?: unknown;
  date?: unknown;
  amount?: unknown;
  remarks?: unknown;
  disbursement_id?: unknown;
};

type DisbursementRow = {
  id?: unknown;
  status?: unknown;
};

type LedgerBank = ReturnType<typeof normalizeBank>;

type LedgerEntry = {
  id: string;
  bankId: number;
  transactionDate: string;
  transactionType: LedgerEntryType;
  referenceTable: string;
  referenceId: number;
  referenceNo: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  sortOrder: number;
};

const bankFields = [
  "bank_id",
  "bank_name",
  "account_number",
  "branch",
  "is_active",
  "opening_balance",
  "created_at",
];
const bankFieldsWithoutStatus = [
  "bank_id",
  "bank_name",
  "account_number",
  "branch",
  "opening_balance",
  "created_at",
];

function normalizePage(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(100, Math.floor(parsed));
}

function dateOnly(value: unknown) {
  return asString(value).slice(0, 10);
}

function isValidDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function normalizeBank(row: BankAccountRow) {
  const accountNumber = asString(row.account_number);
  const branch = asString(row.branch);
  const bankName = asString(row.bank_name);

  return {
    bankId: asNumber(row.bank_id) ?? 0,
    bankName,
    accountNumber,
    branch,
    label: [bankName, accountNumber, branch].filter(Boolean).join(" - "),
    isActive: row.is_active === undefined ? true : asBoolean(row.is_active),
    openingBalance: asNumber(row.opening_balance) ?? 0,
    createdAt: asString(row.created_at),
  };
}

function bankParams(includeActiveFilter: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "bank_name");
  params.set(
    "fields",
    (includeActiveFilter ? bankFields : bankFieldsWithoutStatus).join(","),
  );
  if (includeActiveFilter) params.set("filter[is_active][_eq]", "1");
  return params;
}

async function getActiveBanks() {
  try {
    const res = await directusFetch<DirectusList<BankAccountRow>>(
      `/items/bank_accounts?${bankParams(true).toString()}`,
    );
    return (res.data ?? [])
      .map(normalizeBank)
      .filter((bank) => bank.bankId > 0 && bank.isActive);
  } catch (error) {
    if (!isFieldAccessError(error, "is_active")) throw error;

    const res = await directusFetch<DirectusList<BankAccountRow>>(
      `/items/bank_accounts?${bankParams(false).toString()}`,
    );
    return (res.data ?? []).map(normalizeBank).filter((bank) => bank.bankId > 0);
  }
}

function addEndDateFilter(
  params: URLSearchParams,
  field: string,
  endDate: string,
  filterIndex = 1,
) {
  if (endDate) params.set(`filter[_and][${filterIndex}][${field}][_lte]`, endDate);
}

async function getDepositRows(bankId: number, endDate: string) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set(
    "fields",
    "id,deposit_no,deposit_date,target_bank_id,total_cash,total_checks,status",
  );
  params.set("filter[_and][0][target_bank_id][_eq]", String(bankId));
  params.set("filter[_and][1][status][_eq]", "CLEARED");
  addEndDateFilter(params, "deposit_date", endDate, 2);

  const res = await directusFetch<DirectusList<BankDepositRow>>(
    `/items/bank_deposit?${params.toString()}`,
  );
  return res.data ?? [];
}

async function getCompletedTransferRows(bankId: number, endDate: string) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set(
    "fields",
    [
      "transfer_id",
      "transfer_no",
      "transfer_date",
      "source_bank_id",
      "destination_bank_id",
      "amount",
      "transfer_fee",
    ].join(","),
  );
  params.set("filter[_and][0][status][_eq]", "COMPLETED");
  if (endDate) {
    params.set("filter[_and][1][transfer_date][_lte]", endDate);
    params.set("filter[_and][2][_or][0][source_bank_id][_eq]", String(bankId));
    params.set(
      "filter[_and][2][_or][1][destination_bank_id][_eq]",
      String(bankId),
    );
  } else {
    params.set("filter[_and][1][_or][0][source_bank_id][_eq]", String(bankId));
    params.set(
      "filter[_and][1][_or][1][destination_bank_id][_eq]",
      String(bankId),
    );
  }

  const res = await directusFetch<DirectusList<BankTransferRow>>(
    `/items/bank_transfers?${params.toString()}`,
  );
  return res.data ?? [];
}

async function getDisbursementRows(bankId: number, endDate: string) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "id,bank_id,check_no,date,amount,remarks,disbursement_id");
  params.set("filter[_and][0][bank_id][_eq]", String(bankId));
  addEndDateFilter(params, "date", endDate);

  const res = await directusFetch<DirectusList<DisbursementPaymentRow>>(
    `/items/disbursement_payments?${params.toString()}`,
  );
  return filterReleasedDisbursementPayments(res.data ?? []);
}

function isReleasedDisbursement(row: DisbursementRow) {
  return asString(row.status).toUpperCase() === "RELEASED";
}

async function getReleasedDisbursementIds(disbursementIds: number[]) {
  const uniqueIds = Array.from(new Set(disbursementIds)).filter(Boolean);
  if (uniqueIds.length === 0) return new Set<number>();

  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "id,status");
  params.set("filter[id][_in]", uniqueIds.join(","));

  const res = await directusFetch<DirectusList<DisbursementRow>>(
    `/items/disbursement?${params.toString()}`,
  );

  return new Set(
    (res.data ?? [])
      .filter(isReleasedDisbursement)
      .map((row) => asNumber(row.id) ?? 0)
      .filter(Boolean),
  );
}

async function filterReleasedDisbursementPayments(
  payments: DisbursementPaymentRow[],
) {
  const releasedIds = await getReleasedDisbursementIds(
    payments.map((payment) => asNumber(payment.disbursement_id) ?? 0),
  );

  return payments.filter((payment) =>
    releasedIds.has(asNumber(payment.disbursement_id) ?? 0),
  );
}

function buildOpeningEntry(bank: LedgerBank): LedgerEntry | null {
  const transactionDate = dateOnly(bank.createdAt);
  if (!transactionDate) return null;

  return {
    id: `bank_accounts:${bank.bankId}`,
    bankId: bank.bankId,
    transactionDate,
    transactionType: "OPENING_BALANCE",
    referenceTable: "bank_accounts",
    referenceId: bank.bankId,
    referenceNo: `Bank #${bank.bankId}`,
    description: "Opening balance",
    debitAmount: roundMoney(bank.openingBalance),
    creditAmount: 0,
    runningBalance: 0,
    sortOrder: 0,
  };
}

function buildDepositEntry(row: BankDepositRow, bankId: number): LedgerEntry {
  const referenceId = asNumber(row.id) ?? 0;
  const amount = roundMoney(
    (asNumber(row.total_cash) ?? 0) + (asNumber(row.total_checks) ?? 0),
  );

  return {
    id: `bank_deposit:${referenceId}`,
    bankId,
    transactionDate: dateOnly(row.deposit_date),
    transactionType: "DEPOSIT",
    referenceTable: "bank_deposit",
    referenceId,
    referenceNo: asString(row.deposit_no) || `Deposit #${referenceId}`,
    description: "Bank deposit",
    debitAmount: amount,
    creditAmount: 0,
    runningBalance: 0,
    sortOrder: 1,
  };
}

function buildTransferEntries(
  row: BankTransferRow,
  bankId: number,
  bankMap: Map<number, LedgerBank>,
) {
  const referenceId = asNumber(row.transfer_id) ?? 0;
  const sourceBankId = asNumber(row.source_bank_id) ?? 0;
  const destinationBankId = asNumber(row.destination_bank_id) ?? 0;
  const amount = asNumber(row.amount) ?? 0;
  const transferFee = asNumber(row.transfer_fee) ?? 0;
  const referenceNo = asString(row.transfer_no) || `Transfer #${referenceId}`;
  const transactionDate = dateOnly(row.transfer_date);
  const entries: LedgerEntry[] = [];

  if (sourceBankId === bankId) {
    const destination = bankMap.get(destinationBankId);
    entries.push({
      id: `bank_transfers:${referenceId}:out`,
      bankId,
      transactionDate,
      transactionType: "TRANSFER_OUT",
      referenceTable: "bank_transfers",
      referenceId,
      referenceNo,
      description: `Transfer to ${destination?.bankName || `Bank #${destinationBankId}`}`,
      debitAmount: 0,
      creditAmount: roundMoney(amount + transferFee),
      runningBalance: 0,
      sortOrder: 2,
    });
  }

  if (destinationBankId === bankId) {
    const source = bankMap.get(sourceBankId);
    entries.push({
      id: `bank_transfers:${referenceId}:in`,
      bankId,
      transactionDate,
      transactionType: "TRANSFER_IN",
      referenceTable: "bank_transfers",
      referenceId,
      referenceNo,
      description: `Transfer from ${source?.bankName || `Bank #${sourceBankId}`}`,
      debitAmount: roundMoney(amount),
      creditAmount: 0,
      runningBalance: 0,
      sortOrder: 3,
    });
  }

  return entries;
}

function buildDisbursementEntry(
  row: DisbursementPaymentRow,
  bankId: number,
): LedgerEntry {
  const referenceId = asNumber(row.id) ?? 0;
  const checkNo = asString(row.check_no);
  const remarks = asString(row.remarks);

  return {
    id: `disbursement_payments:${referenceId}`,
    bankId,
    transactionDate: dateOnly(row.date),
    transactionType: "DISBURSEMENT",
    referenceTable: "disbursement_payments",
    referenceId,
    referenceNo: checkNo || `Payment #${referenceId}`,
    description: remarks || "Disbursement payment",
    debitAmount: 0,
    creditAmount: roundMoney(asNumber(row.amount) ?? 0),
    runningBalance: 0,
    sortOrder: 4,
  };
}

function compareEntriesAsc(a: LedgerEntry, b: LedgerEntry) {
  return (
    a.transactionDate.localeCompare(b.transactionDate) ||
    a.sortOrder - b.sortOrder ||
    a.referenceTable.localeCompare(b.referenceTable) ||
    a.referenceId - b.referenceId
  );
}

function compareEntriesDesc(a: LedgerEntry, b: LedgerEntry) {
  return (
    b.transactionDate.localeCompare(a.transactionDate) ||
    b.referenceId - a.referenceId ||
    b.sortOrder - a.sortOrder ||
    b.referenceTable.localeCompare(a.referenceTable)
  );
}

function isWithinRange(entry: LedgerEntry, startDate: string, endDate: string) {
  if (startDate && entry.transactionDate < startDate) return false;
  if (endDate && entry.transactionDate > endDate) return false;
  return true;
}

async function buildLedgerEntries(
  bank: LedgerBank,
  banks: LedgerBank[],
  endDate: string,
) {
  const [deposits, transfers, disbursements] = await Promise.all([
    getDepositRows(bank.bankId, endDate),
    getCompletedTransferRows(bank.bankId, endDate),
    getDisbursementRows(bank.bankId, endDate),
  ]);
  const bankMap = new Map(banks.map((item) => [item.bankId, item]));
  const entries: LedgerEntry[] = [];
  const openingEntry = buildOpeningEntry(bank);

  if (openingEntry && (!endDate || openingEntry.transactionDate <= endDate)) {
    entries.push(openingEntry);
  }

  for (const deposit of deposits) {
    entries.push(buildDepositEntry(deposit, bank.bankId));
  }

  for (const transfer of transfers) {
    entries.push(...buildTransferEntries(transfer, bank.bankId, bankMap));
  }

  for (const disbursement of disbursements) {
    entries.push(buildDisbursementEntry(disbursement, bank.bankId));
  }

  let runningBalance = 0;
  const chronologicalEntries = entries
    .filter((entry) => entry.transactionDate)
    .sort(compareEntriesAsc);

  for (const entry of chronologicalEntries) {
    runningBalance = roundMoney(
      runningBalance + entry.debitAmount - entry.creditAmount,
    );
    entry.runningBalance = runningBalance;
  }

  return chronologicalEntries;
}

function buildSummary(entries: LedgerEntry[], currentBalance: number) {
  return {
    currentBalance,
    totalDebits: roundMoney(
      entries.reduce((total, entry) => total + entry.debitAmount, 0),
    ),
    totalCredits: roundMoney(
      entries.reduce((total, entry) => total + entry.creditAmount, 0),
    ),
    entryCount: entries.length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = normalizePage(searchParams.get("page"));
    const pageSize = normalizePageSize(
      searchParams.get("page_size") ?? searchParams.get("pageSize"),
    );
    const startDate = asString(searchParams.get("start_date"));
    const endDate = asString(searchParams.get("end_date"));
    const search = asString(searchParams.get("q"));
    const transactionType = asString(searchParams.get("transaction_type"));

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json(
        { error: "Dates must use YYYY-MM-DD format" },
        { status: 400 },
      );
    }
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: "Start date cannot be after end date" },
        { status: 400 },
      );
    }

    const banks = await getActiveBanks();
    if (banks.length === 0) {
      return NextResponse.json({
        banks: [],
        selectedBankId: null,
        entries: [],
        summary: buildSummary([], 0),
        pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
      });
    }

    const requestedBankId = asNumber(searchParams.get("bank_id"));
    const selectedBank = requestedBankId
      ? banks.find((bank) => bank.bankId === requestedBankId)
      : banks[0];

    if (!selectedBank) {
      return NextResponse.json(
        { error: "Select a valid bank account" },
        { status: 400 },
      );
    }

    const ledgerEntries = await buildLedgerEntries(selectedBank, banks, endDate);
    const currentBalance =
      ledgerEntries.length > 0
        ? ledgerEntries[ledgerEntries.length - 1].runningBalance
        : 0;
    let filteredEntries = ledgerEntries.filter((entry) =>
      isWithinRange(entry, startDate, endDate),
    );

    if (search) {
      const q = search.toLowerCase();
      filteredEntries = filteredEntries.filter(
        (entry) =>
          entry.referenceNo.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q),
      );
    }

    if (transactionType) {
      filteredEntries = filteredEntries.filter(
        (entry) => entry.transactionType === transactionType,
      );
    }

    const sortedEntries = [...filteredEntries].sort(compareEntriesDesc);
    const total = sortedEntries.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    return NextResponse.json({
      banks,
      selectedBankId: selectedBank.bankId,
      entries: sortedEntries.slice(offset, offset + pageSize),
      summary: buildSummary(filteredEntries, currentBalance),
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
