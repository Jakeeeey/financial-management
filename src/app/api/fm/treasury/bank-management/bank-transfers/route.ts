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
};

type BankTransferRow = {
  transfer_id?: unknown;
  transfer_no?: unknown;
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

type BankTransferPayload = {
  transfer_no: string;
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

const bankFields = ["bank_id", "bank_name", "account_number", "branch", "is_active"];
const bankFieldsWithoutStatus = ["bank_id", "bank_name", "account_number", "branch"];

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
  };
}

function normalizeTransfer(
  row: BankTransferRow,
  bankMap: Map<number, ReturnType<typeof normalizeBank>>,
) {
  const amount = asNumber(row.amount) ?? 0;
  const transferFee = asNumber(row.transfer_fee) ?? 0;
  const sourceBankId = asNumber(row.source_bank_id) ?? 0;
  const destinationBankId = asNumber(row.destination_bank_id) ?? 0;
  const sourceBank = bankMap.get(sourceBankId);
  const destinationBank = bankMap.get(destinationBankId);

  return {
    transferId: asNumber(row.transfer_id) ?? 0,
    transferNo: asString(row.transfer_no),
    transferDate: asString(row.transfer_date),
    sourceBankId,
    sourceBankName: sourceBank?.bankName || `Bank #${sourceBankId}`,
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
      `filter[_and][${filterIndex}][_or][1][remarks][_contains]`,
      search,
    );
  }

  return { page, pageSize, search, status, params };
}

function bankParams(includeActiveFilter: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "bank_name");
  params.set("fields", (includeActiveFilter ? bankFields : bankFieldsWithoutStatus).join(","));
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

function normalizeCreatePayload(
  body: Record<string, unknown>,
  banks: Array<ReturnType<typeof normalizeBank>>,
  userId: number | null,
): BankTransferPayload {
  const sourceBankId = asNumber(body.sourceBankId ?? body.source_bank_id);
  const destinationBankId = asNumber(
    body.destinationBankId ?? body.destination_bank_id,
  );
  const amount = parseMoney(body.amount);
  const transferFee = parseMoney(body.transferFee ?? body.transfer_fee) ?? 0;
  const transferDate = asString(body.transferDate ?? body.transfer_date);
  const bankIds = new Set(banks.map((bank) => bank.bankId));

  if (!userId) throw new Error("Unable to identify the current user");
  if (!transferDate) throw new Error("Transfer date is required");
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
    const [banks, transfersRes] = await Promise.all([
      getActiveBanks(),
      directusFetch<DirectusList<BankTransferRow>>(
        `/items/bank_transfers?${query.params.toString()}`,
      ),
    ]);
    const bankMap = new Map(banks.map((bank) => [bank.bankId, bank]));
    const total = asNumber(transfersRes.meta?.filter_count) ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

    return NextResponse.json({
      transfers: (transfersRes.data ?? [])
        .map((row) => normalizeTransfer(row, bankMap))
        .filter((transfer) => transfer.transferId > 0),
      banks,
      pagination: {
        page: Math.min(query.page, totalPages),
        pageSize: query.pageSize,
        total,
        totalPages,
        search: query.search,
        status: query.status || "ALL",
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
    const banks = await getActiveBanks();
    const payload = normalizeCreatePayload(body, banks, userId);
    const res = await directusFetch<DirectusItem<BankTransferRow>>(
      "/items/bank_transfers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    const bankMap = new Map(banks.map((bank) => [bank.bankId, bank]));

    return NextResponse.json(
      { transfer: normalizeTransfer(res.data ?? payload, bankMap) },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
