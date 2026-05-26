import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  asBoolean,
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  DirectusList,
  getTokenUserId,
  isFieldAccessError,
  jsonError,
  parseMoney,
} from "./_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankAccountRow = {
  bank_id?: unknown;
  bank_name?: unknown;
  account_number?: unknown;
  branch?: unknown;
  is_active?: unknown;
  opening_balance?: unknown;
};

type BankTransferRow = {
  transfer_id?: unknown;
  transfer_no?: unknown;
  reference_number?: unknown;
  transaction_type?: unknown;
  transfer_date?: unknown;
  source_bank_id?: unknown;
  destination_bank_id?: unknown;
  amount?: unknown;
  transfer_fee?: unknown;
  status?: unknown;
  prepared_by?: unknown;
  date_prepared?: unknown;
  remarks?: unknown;
};

type PaymentMethodRow = {
  method_id?: unknown;
  method_name?: unknown;
  isActive?: unknown;
};

type BankDepositRow = {
  total_cash?: unknown;
  total_checks?: unknown;
};

type DisbursementPaymentRow = {
  disbursement_id?: unknown;
  amount?: unknown;
};

type DisbursementRow = {
  id?: unknown;
  status?: unknown;
};

type BankTransferPayload = {
  transfer_no: string;
  reference_number: string;
  transaction_type: number;
  transfer_date: string;
  source_bank_id: number;
  destination_bank_id: number;
  amount: number;
  transfer_fee: number;
  status: "PREPARED";
  prepared_by: number;
  remarks: string | null;
};

const transferFields = [
  "transfer_id",
  "transfer_no",
  "reference_number",
  "transaction_type",
  "transfer_date",
  "source_bank_id",
  "destination_bank_id",
  "amount",
  "transfer_fee",
  "status",
  "prepared_by",
  "date_prepared",
  "remarks",
];

const bankFields = [
  "bank_id",
  "bank_name",
  "account_number",
  "branch",
  "is_active",
  "opening_balance",
];
const bankFieldsWithoutStatus = [
  "bank_id",
  "bank_name",
  "account_number",
  "branch",
  "opening_balance",
];
const paymentMethodFields = ["method_id", "method_name", "isActive"];
const paymentMethodFieldsWithoutStatus = ["method_id", "method_name"];

function normalizePage(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(100, Math.floor(parsed));
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
  };
}

function normalizePaymentMethod(row: PaymentMethodRow) {
  return {
    methodId: asNumber(row.method_id) ?? 0,
    methodName: asString(row.method_name),
    isActive: row.isActive === undefined ? true : asBoolean(row.isActive),
  };
}

function normalizeTransfer(
  row: BankTransferRow,
  bankMap: Map<number, ReturnType<typeof normalizeBank>>,
  paymentMethodMap: Map<number, ReturnType<typeof normalizePaymentMethod>>,
) {
  const amount = asNumber(row.amount) ?? 0;
  const transferFee = asNumber(row.transfer_fee) ?? 0;
  const sourceBankId = asNumber(row.source_bank_id) ?? 0;
  const destinationBankId = asNumber(row.destination_bank_id) ?? 0;
  const transactionTypeId = asNumber(row.transaction_type) ?? 0;
  const sourceBank = bankMap.get(sourceBankId);
  const destinationBank = bankMap.get(destinationBankId);
  const transactionType = paymentMethodMap.get(transactionTypeId);

  return {
    transferId: asNumber(row.transfer_id) ?? 0,
    transferNo: asString(row.transfer_no),
    referenceNumber: asString(row.reference_number),
    transactionTypeId,
    transactionTypeName: transactionTypeId
      ? transactionType?.methodName || `Method #${transactionTypeId}`
      : "",
    transferDate: asString(row.transfer_date),
    sourceBankId,
    sourceBankName: sourceBank?.bankName || `Bank #${sourceBankId}`,
    sourceBankAccountNumber: sourceBank?.accountNumber || "",
    sourceBankLabel: sourceBank?.label || `Bank #${sourceBankId}`,
    destinationBankId,
    destinationBankName: destinationBank?.bankName || `Bank #${destinationBankId}`,
    destinationBankLabel: destinationBank?.label || `Bank #${destinationBankId}`,
    amount,
    transferFee,
    totalOutflow: Math.round((amount + transferFee) * 100) / 100,
    status: asString(row.status) || "PREPARED",
    preparedBy: asNumber(row.prepared_by),
    datePrepared: asString(row.date_prepared),
    remarks: asString(row.remarks),
  };
}

function buildTransferNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `BT-${date}-${time}`;
}

function buildTransferParams(searchParams: URLSearchParams) {
  const page = normalizePage(searchParams.get("page"));
  const pageSize = normalizePageSize(
    searchParams.get("page_size") ?? searchParams.get("pageSize"),
  );
  const search = asString(searchParams.get("q") ?? searchParams.get("search"));
  const status = asString(searchParams.get("status"));
  const transactionTypeId = asNumber(
    searchParams.get("transaction_type") ?? searchParams.get("payment_method_id"),
  );
  const sourceBankId = asNumber(searchParams.get("source_bank_id"));
  const destinationBankId = asNumber(searchParams.get("destination_bank_id"));
  const startDate = asString(searchParams.get("start_date"));
  const endDate = asString(searchParams.get("end_date"));
  const params = new URLSearchParams();
  const offset = (page - 1) * pageSize;
  let filterIndex = 0;

  params.set("limit", String(pageSize));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  params.set("sort", "-date_prepared,-transfer_id");
  params.set("fields", transferFields.join(","));

  if (status && status !== "ALL") {
    params.set(`filter[_and][${filterIndex}][status][_eq]`, status);
    filterIndex += 1;
  }

  if (transactionTypeId) {
    params.set(
      `filter[_and][${filterIndex}][transaction_type][_eq]`,
      String(transactionTypeId),
    );
    filterIndex += 1;
  }

  if (sourceBankId) {
    params.set(
      `filter[_and][${filterIndex}][source_bank_id][_eq]`,
      String(sourceBankId),
    );
    filterIndex += 1;
  }

  if (destinationBankId) {
    params.set(
      `filter[_and][${filterIndex}][destination_bank_id][_eq]`,
      String(destinationBankId),
    );
    filterIndex += 1;
  }

  if (startDate) {
    params.set(`filter[_and][${filterIndex}][transfer_date][_gte]`, startDate);
    filterIndex += 1;
  }

  if (endDate) {
    params.set(`filter[_and][${filterIndex}][transfer_date][_lte]`, endDate);
    filterIndex += 1;
  }

  if (search) {
    params.set(
      `filter[_and][${filterIndex}][_or][0][transfer_no][_contains]`,
      search,
    );
    params.set(
      `filter[_and][${filterIndex}][_or][1][reference_number][_contains]`,
      search,
    );
    params.set(
      `filter[_and][${filterIndex}][_or][2][remarks][_contains]`,
      search,
    );
  }

  return { page, pageSize, search, status, transactionTypeId, params };
}

function bankParams(includeActiveFilter: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "bank_name");
  params.set("fields", (includeActiveFilter ? bankFields : bankFieldsWithoutStatus).join(","));
  if (includeActiveFilter) params.set("filter[is_active][_eq]", "1");
  return params;
}

function paymentMethodParams(includeActiveFilter: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "method_id");
  params.set(
    "fields",
    (includeActiveFilter ? paymentMethodFields : paymentMethodFieldsWithoutStatus).join(","),
  );
  if (includeActiveFilter) params.set("filter[isActive][_eq]", "1");
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

async function getActivePaymentMethods() {
  try {
    const res = await directusFetch<DirectusList<PaymentMethodRow>>(
      `/items/payment_methods?${paymentMethodParams(true).toString()}`,
    );
    return (res.data ?? [])
      .map(normalizePaymentMethod)
      .filter((method) => method.methodId > 0 && method.isActive);
  } catch (error) {
    if (!isFieldAccessError(error, "isActive")) throw error;

    const res = await directusFetch<DirectusList<PaymentMethodRow>>(
      `/items/payment_methods?${paymentMethodParams(false).toString()}`,
    );
    return (res.data ?? [])
      .map(normalizePaymentMethod)
      .filter((method) => method.methodId > 0);
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function getDepositRows(bankId: number) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "total_cash,total_checks");
  params.set("filter[target_bank_id][_eq]", String(bankId));

  const res = await directusFetch<DirectusList<BankDepositRow>>(
    `/items/bank_deposit?${params.toString()}`,
  );
  return res.data ?? [];
}

async function getCompletedTransferRows(bankId: number) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set(
    "fields",
    "source_bank_id,destination_bank_id,amount,transfer_fee",
  );
  params.set("filter[_and][0][status][_eq]", "COMPLETED");
  params.set("filter[_and][1][_or][0][source_bank_id][_eq]", String(bankId));
  params.set(
    "filter[_and][1][_or][1][destination_bank_id][_eq]",
    String(bankId),
  );

  const res = await directusFetch<DirectusList<BankTransferRow>>(
    `/items/bank_transfers?${params.toString()}`,
  );
  return res.data ?? [];
}

async function getDisbursementRows(bankId: number) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "amount,disbursement_id");
  params.set("filter[bank_id][_eq]", String(bankId));

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

async function getCurrentBankBalance(
  bank: ReturnType<typeof normalizeBank>,
) {
  const [deposits, transfers, disbursements] = await Promise.all([
    getDepositRows(bank.bankId),
    getCompletedTransferRows(bank.bankId),
    getDisbursementRows(bank.bankId),
  ]);
  const depositCredits = deposits.reduce(
    (total, row) =>
      total + (asNumber(row.total_cash) ?? 0) + (asNumber(row.total_checks) ?? 0),
    0,
  );
  const transferNet = transfers.reduce((total, row) => {
    const amount = asNumber(row.amount) ?? 0;
    const transferFee = asNumber(row.transfer_fee) ?? 0;
    const sourceBankId = asNumber(row.source_bank_id) ?? 0;
    const destinationBankId = asNumber(row.destination_bank_id) ?? 0;

    if (sourceBankId === bank.bankId) return total - amount - transferFee;
    if (destinationBankId === bank.bankId) return total + amount;
    return total;
  }, 0);
  const disbursementDebits = disbursements.reduce(
    (total, row) => total + (asNumber(row.amount) ?? 0),
    0,
  );

  return roundMoney(
    bank.openingBalance + depositCredits + transferNet - disbursementDebits,
  );
}

async function addCurrentBalances(
  banks: Array<ReturnType<typeof normalizeBank>>,
) {
  return Promise.all(
    banks.map(async (bank) => ({
      ...bank,
      currentBalance: await getCurrentBankBalance(bank),
    })),
  );
}

function normalizeCreatePayload(
  body: Record<string, unknown>,
  banks: Array<ReturnType<typeof normalizeBank>>,
  paymentMethods: Array<ReturnType<typeof normalizePaymentMethod>>,
  userId: number | null,
): BankTransferPayload {
  const sourceBankId = asNumber(body.sourceBankId ?? body.source_bank_id);
  const destinationBankId = asNumber(
    body.destinationBankId ?? body.destination_bank_id,
  );
  const amount = parseMoney(body.amount);
  const transferFee = parseMoney(body.transferFee ?? body.transfer_fee) ?? 0;
  const transferDate = asString(body.transferDate ?? body.transfer_date);
  const referenceNumber = asString(body.referenceNumber ?? body.reference_number);
  const transactionType = asNumber(
    body.transactionTypeId ?? body.transactionType ?? body.transaction_type,
  );
  const bankIds = new Set(banks.map((bank) => bank.bankId));
  const paymentMethodIds = new Set(
    paymentMethods.map((method) => method.methodId),
  );

  if (!userId) throw new Error("Unable to identify the current user");
  if (!transferDate) throw new Error("Transfer date is required");
  if (!referenceNumber) throw new Error("Reference number is required");
  if (!/^[A-Za-z0-9]+$/.test(referenceNumber)) {
    throw new Error("Reference number must contain letters and numbers only");
  }
  if (referenceNumber.length > 50) {
    throw new Error("Reference number must be 50 characters or fewer");
  }
  if (!transactionType) throw new Error("Transaction type is required");
  if (!paymentMethodIds.has(transactionType)) {
    throw new Error("Select a valid transaction type");
  }
  if (!sourceBankId) throw new Error("Source bank is required");
  if (!destinationBankId) throw new Error("Destination bank is required");
  if (sourceBankId === destinationBankId) {
    throw new Error("Source and destination banks must be different");
  }
  if (!bankIds.has(sourceBankId)) throw new Error("Select a valid source bank");
  if (!bankIds.has(destinationBankId)) {
    throw new Error("Select a valid destination bank");
  }
  if (amount === null || amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  if (transferFee < 0) throw new Error("Transfer fee cannot be negative");

  return {
    transfer_no: buildTransferNo(),
    reference_number: referenceNumber,
    transaction_type: transactionType,
    transfer_date: transferDate,
    source_bank_id: sourceBankId,
    destination_bank_id: destinationBankId,
    amount,
    transfer_fee: transferFee,
    status: "PREPARED",
    prepared_by: userId,
    remarks: asString(body.remarks) || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = buildTransferParams(searchParams);
    const [banksWithoutBalances, paymentMethods, transfersRes] = await Promise.all([
      getActiveBanks(),
      getActivePaymentMethods(),
      directusFetch<DirectusList<BankTransferRow>>(
        `/items/bank_transfers?${query.params.toString()}`,
      ),
    ]);
    const banks = await addCurrentBalances(banksWithoutBalances);
    const bankMap = new Map(banks.map((bank) => [bank.bankId, bank]));
    const paymentMethodMap = new Map(
      paymentMethods.map((method) => [method.methodId, method]),
    );
    const total = asNumber(transfersRes.meta?.filter_count) ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

    return NextResponse.json({
      transfers: (transfersRes.data ?? [])
        .map((row) => normalizeTransfer(row, bankMap, paymentMethodMap))
        .filter((transfer) => transfer.transferId > 0),
      banks,
      paymentMethods,
      pagination: {
        page: Math.min(query.page, totalPages),
        pageSize: query.pageSize,
        total,
        totalPages,
        search: query.search,
        status: query.status || "ALL",
        transactionTypeId: query.transactionTypeId,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const cookieStore = await cookies();
    const userId = getTokenUserId(cookieStore.get("vos_access_token")?.value);
    const [banks, paymentMethods] = await Promise.all([
      getActiveBanks(),
      getActivePaymentMethods(),
    ]);
    const payload = normalizeCreatePayload(body, banks, paymentMethods, userId);
    const sourceBank = banks.find((bank) => bank.bankId === payload.source_bank_id);
    const sourceBalance = sourceBank ? await getCurrentBankBalance(sourceBank) : 0;
    const totalOutflow = roundMoney(payload.amount + payload.transfer_fee);

    if (sourceBalance < 0) {
      return NextResponse.json(
        { error: "Source bank has a negative current balance" },
        { status: 400 },
      );
    }
    if (totalOutflow > sourceBalance) {
      return NextResponse.json(
        { error: "Total cash outflow cannot exceed source current balance" },
        { status: 400 },
      );
    }

    const res = await directusFetch<DirectusItem<BankTransferRow>>(
      "/items/bank_transfers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    const bankMap = new Map(banks.map((bank) => [bank.bankId, bank]));
    const paymentMethodMap = new Map(
      paymentMethods.map((method) => [method.methodId, method]),
    );

    return NextResponse.json(
      { transfer: normalizeTransfer(res.data ?? payload, bankMap, paymentMethodMap) },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
