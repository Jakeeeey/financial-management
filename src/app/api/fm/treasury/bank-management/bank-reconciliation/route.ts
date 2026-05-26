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
  roundMoney,
} from "./_utils";
import { calculateSystemBalance, validateStatementDate } from "./balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankAccountRow = {
  bank_id?: unknown;
  bank_name?: unknown;
  account_number?: unknown;
  branch?: unknown;
  is_active?: unknown;
};

type BankReconciliationRow = {
  id?: unknown;
  bank_id?: unknown;
  statement_date?: unknown;
  statement_balance?: unknown;
  system_balance?: unknown;
  variance?: unknown;
  status?: unknown;
  prepared_by?: unknown;
  approved_by?: unknown;
  created_at?: unknown;
};

type BankReconciliationPayload = {
  bank_id: number;
  statement_date: string;
  statement_balance: number;
  system_balance: number;
  variance: number;
  status: "DRAFT";
  prepared_by: number;
};

const reconciliationFields = [
  "id",
  "bank_id",
  "statement_date",
  "statement_balance",
  "system_balance",
  "variance",
  "status",
  "prepared_by",
  "approved_by",
  "created_at",
];
const bankFields = [
  "bank_id",
  "bank_name",
  "account_number",
  "branch",
  "is_active",
];
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

function normalizeReconciliation(
  row: BankReconciliationRow,
  bankMap: Map<number, ReturnType<typeof normalizeBank>>,
) {
  const bankId = asNumber(row.bank_id) ?? 0;
  const bank = bankMap.get(bankId);

  return {
    id: asNumber(row.id) ?? 0,
    bankId,
    bankName: bank?.bankName || `Bank #${bankId}`,
    bankLabel: bank?.label || `Bank #${bankId}`,
    statementDate: asString(row.statement_date),
    statementBalance: asNumber(row.statement_balance) ?? 0,
    systemBalance: asNumber(row.system_balance) ?? 0,
    variance: asNumber(row.variance) ?? 0,
    status: asString(row.status).toUpperCase() || "DRAFT",
    preparedBy: asNumber(row.prepared_by),
    approvedBy: asNumber(row.approved_by),
    createdAt: asString(row.created_at),
  };
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

function buildReconciliationParams(
  searchParams: URLSearchParams,
  matchingBankIds: number[],
) {
  const page = normalizePage(searchParams.get("page"));
  const pageSize = normalizePageSize(
    searchParams.get("page_size") ?? searchParams.get("pageSize"),
  );
  const search = asString(searchParams.get("q") ?? searchParams.get("search"));
  const status = asString(searchParams.get("status"));
  const bankId = asNumber(searchParams.get("bank_id"));
  const startDate = asString(searchParams.get("start_date"));
  const endDate = asString(searchParams.get("end_date"));
  const params = new URLSearchParams();
  const offset = (page - 1) * pageSize;
  let filterIndex = 0;

  params.set("limit", String(pageSize));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  params.set("sort", "-created_at,-id");
  params.set("fields", reconciliationFields.join(","));

  if (status && status !== "ALL") {
    params.set(`filter[_and][${filterIndex}][status][_eq]`, status);
    filterIndex += 1;
  }

  if (bankId) {
    params.set(`filter[_and][${filterIndex}][bank_id][_eq]`, String(bankId));
    filterIndex += 1;
  }

  if (startDate) {
    params.set(`filter[_and][${filterIndex}][statement_date][_gte]`, startDate);
    filterIndex += 1;
  }

  if (endDate) {
    params.set(`filter[_and][${filterIndex}][statement_date][_lte]`, endDate);
    filterIndex += 1;
  }

  if (search) {
    let searchIndex = 0;
    const numericSearch = asNumber(search);
    if (numericSearch) {
      params.set(
        `filter[_and][${filterIndex}][_or][${searchIndex}][id][_eq]`,
        String(numericSearch),
      );
      searchIndex += 1;
    }

    if (matchingBankIds.length > 0) {
      for (const matchingBankId of matchingBankIds.slice(0, 50)) {
        params.set(
          `filter[_and][${filterIndex}][_or][${searchIndex}][bank_id][_eq]`,
          String(matchingBankId),
        );
        searchIndex += 1;
      }
    }

    params.set(
      `filter[_and][${filterIndex}][_or][${searchIndex}][status][_contains]`,
      search,
    );
  }

  return { page, pageSize, search, status, params };
}

function normalizeCreatePayload(
  body: Record<string, unknown>,
  banks: Array<ReturnType<typeof normalizeBank>>,
  systemBalance: number,
  userId: number | null,
): BankReconciliationPayload {
  const bankId = asNumber(body.bankId ?? body.bank_id);
  const statementDate = asString(body.statementDate ?? body.statement_date);
  const statementBalance = parseMoney(
    body.statementBalance ?? body.statement_balance,
  );
  const bankIds = new Set(banks.map((bank) => bank.bankId));

  if (!userId) throw new Error("Unable to identify the current user");
  if (!bankId) throw new Error("Bank account is required");
  if (!bankIds.has(bankId)) throw new Error("Select a valid bank account");
  if (!statementDate) throw new Error("Statement date is required");
  if (!validateStatementDate(statementDate)) {
    throw new Error("Statement date must use YYYY-MM-DD format");
  }
  if (statementBalance === null) {
    throw new Error("Statement balance is required");
  }

  return {
    bank_id: bankId,
    statement_date: statementDate,
    statement_balance: statementBalance,
    system_balance: systemBalance,
    variance: roundMoney(statementBalance - systemBalance),
    status: "DRAFT",
    prepared_by: userId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const banks = await getActiveBanks();
    const search = asString(searchParams.get("q") ?? searchParams.get("search"));
    const matchingBankIds = search
      ? banks
          .filter((bank) =>
            bank.label.toLowerCase().includes(search.toLowerCase()),
          )
          .map((bank) => bank.bankId)
      : [];
    const query = buildReconciliationParams(searchParams, matchingBankIds);
    const reconciliationsRes = await directusFetch<
      DirectusList<BankReconciliationRow>
    >(`/items/bank_reconciliation?${query.params.toString()}`);
    const bankMap = new Map(banks.map((bank) => [bank.bankId, bank]));
    const total = asNumber(reconciliationsRes.meta?.filter_count) ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

    return NextResponse.json({
      reconciliations: (reconciliationsRes.data ?? [])
        .map((row) => normalizeReconciliation(row, bankMap))
        .filter((reconciliation) => reconciliation.id > 0),
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
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const cookieStore = await cookies();
    const userId = getTokenUserId(cookieStore.get("vos_access_token")?.value);
    const banks = await getActiveBanks();
    const bankId = asNumber(body.bankId ?? body.bank_id);
    const statementDate = asString(body.statementDate ?? body.statement_date);
    const systemBalance =
      bankId && validateStatementDate(statementDate)
        ? await calculateSystemBalance(bankId, statementDate)
        : 0;
    const payload = normalizeCreatePayload(body, banks, systemBalance, userId);
    const res = await directusFetch<DirectusItem<BankReconciliationRow>>(
      "/items/bank_reconciliation",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    const bankMap = new Map(banks.map((bank) => [bank.bankId, bank]));

    return NextResponse.json(
      {
        reconciliation: normalizeReconciliation(res.data ?? payload, bankMap),
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
