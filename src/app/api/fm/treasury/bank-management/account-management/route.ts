// src/app/api/fm/treasury/bank-management/account-management/route.ts
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
  isDirectusAccessError,
  isFieldAccessError,
  jsonError,
  parseMoney,
  sanitizeAccountNumber,
  sanitizeMobileNumber,
} from "./_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankAccountRow = {
  bank_id?: unknown;
  bank_name?: unknown;
  account_type?: unknown;
  account_name?: unknown;
  account_number?: unknown;
  bank_description?: unknown;
  branch?: unknown;
  ifsc_code?: unknown;
  opening_balance?: unknown;
  province?: unknown;
  city?: unknown;
  baranggay?: unknown;
  email?: unknown;
  mobile_no?: unknown;
  contact_person?: unknown;
  is_active?: unknown;
  created_at?: unknown;
};

type BankNameRow = {
  id?: unknown;
  bank_name?: unknown;
  is_active?: unknown;
};

type NormalizedPayload = {
  bank_name: string;
  account_type: string;
  account_name: string;
  account_number: string;
  bank_description: string;
  branch: string;
  ifsc_code: string;
  opening_balance?: number;
  province: string;
  city: string;
  baranggay: string;
  email: string;
  mobile_no: string;
  contact_person: string;
  is_active?: number;
  created_by?: number;
};

type AccountQueryConfig = {
  fields: string[];
  includeStatus: boolean;
  includeContactSearch: boolean;
  includeSearch: boolean;
  sort: string | null;
};

const fullAccountFields = [
  "bank_id",
  "bank_name",
  "account_type",
  "account_name",
  "account_number",
  "bank_description",
  "branch",
  "ifsc_code",
  "opening_balance",
  "province",
  "city",
  "baranggay",
  "email",
  "mobile_no",
  "contact_person",
  "is_active",
  "created_at",
];

const baseAccountFields = [
  "bank_id",
  "bank_name",
  "account_type",
  "account_name",
  "account_number",
  "branch",
  "ifsc_code",
  "opening_balance",
  "is_active",
  "created_at",
];

const minimalAccountFields = [
  "bank_id",
  "bank_name",
  "account_number",
  "branch",
];

const createOptionalFields = [
  "created_by",
  "is_active",
] as const;

const bankIdNewestSort = "-created_at,-bank_id";
const accountTypeOptions = new Set(["Savings", "Checking", "Current", "Other"]);
const accountFieldMap = {
  bank_name: "bankName",
  account_type: "accountType",
  account_name: "accountName",
  account_number: "accountNumber",
  bank_description: "bankDescription",
  branch: "branch",
  ifsc_code: "ifscCode",
  opening_balance: "openingBalance",
  province: "province",
  city: "city",
  baranggay: "baranggay",
  email: "email",
  mobile_no: "mobileNo",
  contact_person: "contactPerson",
} as const;

function normalizePage(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(100, Math.floor(parsed));
}

function normalizeAccount(row: BankAccountRow) {
  return {
    bankId: asNumber(row.bank_id) ?? 0,
    bankName: asString(row.bank_name),
    accountType: asString(row.account_type),
    accountName: asString(row.account_name),
    accountNumber: asString(row.account_number),
    bankDescription: asString(row.bank_description),
    branch: asString(row.branch),
    ifscCode: asString(row.ifsc_code),
    openingBalance: asNumber(row.opening_balance) ?? 0,
    province: asString(row.province),
    city: asString(row.city),
    baranggay: asString(row.baranggay),
    email: asString(row.email),
    mobileNo: asString(row.mobile_no),
    contactPerson: asString(row.contact_person),
    isActive: row.is_active === undefined ? true : asBoolean(row.is_active),
    createdAt: asString(row.created_at),
  };
}

function normalizeBankName(row: BankNameRow) {
  return {
    id: asNumber(row.id) ?? 0,
    bankName: asString(row.bank_name),
    isActive: row.is_active === undefined ? true : asBoolean(row.is_active),
  };
}

function uniqueBankNames(rows: ReturnType<typeof normalizeBankName>[]) {
  const uniqueByName = new Map<string, ReturnType<typeof normalizeBankName>>();

  for (const row of rows) {
    const normalizedName = row.bankName.trim();
    if (!normalizedName) continue;

    const key = normalizedName.toLowerCase();
    if (!uniqueByName.has(key)) {
      uniqueByName.set(key, { ...row, bankName: normalizedName });
    }
  }

  return Array.from(uniqueByName.values());
}

function buildAccountParams(
  searchParams: URLSearchParams,
  config: AccountQueryConfig,
) {
  const page = normalizePage(searchParams.get("page"));
  const pageSize = normalizePageSize(
    searchParams.get("page_size") ?? searchParams.get("pageSize"),
  );
  const search = asString(searchParams.get("q") ?? searchParams.get("search"));
  const status = asString(searchParams.get("status"));
  const bankName = asString(searchParams.get("bank_name"));
  const accountType = asString(searchParams.get("account_type"));
  const accountName = asString(searchParams.get("account_name"));
  const createdFrom = asString(searchParams.get("created_from"));
  const createdTo = asString(searchParams.get("created_to"));
  const params = new URLSearchParams();
  const offset = (page - 1) * pageSize;
  let filterIndex = 0;

  params.set("limit", String(pageSize));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  if (config.sort) params.set("sort", config.sort);
  params.set("fields", config.fields.join(","));

  if (config.includeStatus && (status === "active" || status === "inactive")) {
    params.set(
      `filter[_and][${filterIndex}][is_active][_eq]`,
      status === "active" ? "1" : "0",
    );
    filterIndex += 1;
  }

  if (config.includeSearch && search) {
    params.set(
      `filter[_and][${filterIndex}][_or][0][bank_name][_contains]`,
      search,
    );
    params.set(
      `filter[_and][${filterIndex}][_or][1][account_number][_contains]`,
      search,
    );
    params.set(
      `filter[_and][${filterIndex}][_or][2][branch][_contains]`,
      search,
    );
    params.set(
      `filter[_and][${filterIndex}][_or][3][account_name][_contains]`,
      search,
    );
    if (config.includeContactSearch) {
      params.set(
        `filter[_and][${filterIndex}][_or][4][contact_person][_contains]`,
        search,
      );
      params.set(
        `filter[_and][${filterIndex}][_or][5][email][_contains]`,
        search,
      );
    }
    filterIndex += 1;
  }

  if (bankName) {
    params.set(`filter[_and][${filterIndex}][bank_name][_eq]`, bankName);
    filterIndex += 1;
  }

  if (accountType) {
    params.set(`filter[_and][${filterIndex}][account_type][_eq]`, accountType);
    filterIndex += 1;
  }

  if (accountName) {
    params.set(`filter[_and][${filterIndex}][account_name][_contains]`, accountName);
    filterIndex += 1;
  }

  if (createdFrom) {
    params.set(`filter[_and][${filterIndex}][created_at][_gte]`, `${createdFrom}T00:00:00`);
    filterIndex += 1;
  }

  if (createdTo) {
    params.set(`filter[_and][${filterIndex}][created_at][_lte]`, `${createdTo}T23:59:59`);
  }

  return {
    page,
    pageSize,
    search,
    status,
    bankName,
    accountType,
    accountName,
    createdFrom,
    createdTo,
    params,
  };
}

function bankNameParams(includeActiveFilter: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "bank_name");
  params.set(
    "fields",
    includeActiveFilter ? "id,bank_name,is_active" : "id,bank_name",
  );
  if (includeActiveFilter) params.set("filter[is_active][_eq]", "1");
  return params;
}

function bankNameOnlyParams() {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "bank_name");
  params.set("fields", "bank_name");
  return params;
}

async function getBankNames() {
  try {
    const res = await directusFetch<DirectusList<BankNameRow>>(
      `/items/bank_names?${bankNameParams(true).toString()}`,
    );
    return uniqueBankNames(
      (res.data ?? []).map(normalizeBankName).filter((bank) => bank.id > 0),
    );
  } catch (error) {
    if (!isFieldAccessError(error, "is_active")) throw error;

    try {
      const res = await directusFetch<DirectusList<BankNameRow>>(
        `/items/bank_names?${bankNameParams(false).toString()}`,
      );
      return uniqueBankNames((res.data ?? []).map(normalizeBankName));
    } catch (fallbackError) {
      if (!isDirectusAccessError(fallbackError)) throw fallbackError;

      const res = await directusFetch<DirectusList<BankNameRow>>(
        `/items/bank_names?${bankNameOnlyParams().toString()}`,
      );
      return uniqueBankNames((res.data ?? []).map(normalizeBankName));
    }
  }
}

async function getOptionalBankNames() {
  try {
    return await getBankNames();
  } catch (error) {
    if (isDirectusAccessError(error)) return [];
    throw error;
  }
}

function assertBankName(
  bankName: string,
  bankNames: Array<{ bankName: string }>,
) {
  if (
    !bankNames.some(
      (bank) => bank.bankName.toLowerCase() === bankName.toLowerCase(),
    )
  ) {
    throw new Error("Select a valid bank name from the bank names list");
  }
}

function normalizeCreatePayload(
  body: Record<string, unknown>,
  bankNames: Array<{ bankName: string }>,
  userId: number | null,
) {
  const openingBalance = parseMoney(
    body.openingBalance ?? body.opening_balance,
  );
  const payload: NormalizedPayload = {
    bank_name: asString(body.bankName ?? body.bank_name),
    account_type: asString(body.accountType ?? body.account_type),
    account_name: asString(body.accountName ?? body.account_name),
    account_number: sanitizeAccountNumber(
      body.accountNumber ?? body.account_number,
    ),
    bank_description: asString(body.bankDescription ?? body.bank_description),
    branch: asString(body.branch),
    ifsc_code: asString(body.ifscCode ?? body.ifsc_code),
    opening_balance: openingBalance ?? 0,
    province: asString(body.province),
    city: asString(body.city),
    baranggay: asString(body.baranggay),
    email: asString(body.email),
    mobile_no: sanitizeMobileNumber(body.mobileNo ?? body.mobile_no),
    contact_person: asString(body.contactPerson ?? body.contact_person),
    is_active: 1,
  };

  if (userId) payload.created_by = userId;
  if (!payload.bank_name) throw new Error("Bank name is required");
  if (!payload.account_type) throw new Error("Account type is required");
  if (!accountTypeOptions.has(payload.account_type))
    throw new Error("Select a valid account type");
  if (!payload.account_name)
    throw new Error("Registered business name / account name is required");
  if (!payload.account_number) throw new Error("Account number is required");
  if (!payload.bank_description) throw new Error("Bank description is required");
  if (!payload.branch) throw new Error("Branch is required");
  if (!payload.ifsc_code) throw new Error("IFSC / routing code is required");
  if (openingBalance === null)
    throw new Error("Opening balance must be a valid amount");
  if (!payload.province) throw new Error("Province is required");
  if (!payload.city) throw new Error("City / municipality is required");
  if (!payload.baranggay) throw new Error("Barangay is required");
  if (!payload.email) throw new Error("Email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
    throw new Error("Email must be valid");
  if (!payload.mobile_no) throw new Error("Mobile No. is required");
  if (!payload.contact_person) throw new Error("Contact person is required");
  assertBankName(payload.bank_name, bankNames);
  return payload;
}

async function fetchAccounts(searchParams: URLSearchParams) {
  const configs: AccountQueryConfig[] = [
    {
      fields: fullAccountFields,
      includeStatus: true,
      includeContactSearch: true,
      includeSearch: true,
      sort: bankIdNewestSort,
    },
    {
      fields: baseAccountFields,
      includeStatus: true,
      includeContactSearch: false,
      includeSearch: true,
      sort: bankIdNewestSort,
    },
    {
      fields: minimalAccountFields,
      includeStatus: false,
      includeContactSearch: false,
      includeSearch: true,
      sort: bankIdNewestSort,
    },
    {
      fields: ["bank_id", "bank_name"],
      includeStatus: false,
      includeContactSearch: false,
      includeSearch: false,
      sort: "bank_name",
    },
    {
      fields: ["bank_id"],
      includeStatus: false,
      includeContactSearch: false,
      includeSearch: false,
      sort: null,
    },
  ];
  let lastError: unknown = null;

  for (const config of configs) {
    const query = buildAccountParams(searchParams, config);

    try {
      const res = await directusFetch<DirectusList<BankAccountRow>>(
        `/items/bank_accounts?${query.params.toString()}`,
      );
      return { res, query };
    } catch (error) {
      if (!isDirectusAccessError(error)) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load bank accounts");
}

function removeInaccessibleCreateField(
  payload: Partial<NormalizedPayload>,
  error: unknown,
) {
  for (const field of createOptionalFields) {
    if (field in payload && isFieldAccessError(error, field)) {
      delete payload[field];
      return true;
    }
  }

  return false;
}

async function createBankAccount(payload: NormalizedPayload) {
  const nextPayload: Partial<NormalizedPayload> = { ...payload };

  for (let attempt = 0; attempt <= createOptionalFields.length; attempt += 1) {
    try {
      return await directusFetch<DirectusItem<BankAccountRow>>(
        "/items/bank_accounts",
        {
          method: "POST",
          body: JSON.stringify(nextPayload),
        },
      );
    } catch (error) {
      if (!removeInaccessibleCreateField(nextPayload, error)) throw error;
    }
  }

  throw new Error(
    "Unable to create bank account with the permitted Directus fields",
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { res: accountsRes, query } = await fetchAccounts(searchParams);
    const bankNames = await getOptionalBankNames();
    const total = asNumber(accountsRes.meta?.filter_count) ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

    return NextResponse.json({
      accounts: (accountsRes.data ?? [])
        .map(normalizeAccount)
        .filter((account) => account.bankId > 0),
      bankNames,
      pagination: {
        page: Math.min(query.page, totalPages),
        pageSize: query.pageSize,
        total,
        totalPages,
        search: query.search,
        status: query.status || "all",
        bankName: query.bankName,
        accountType: query.accountType,
        accountName: query.accountName,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
      },
    });
  } catch (error) {
    return jsonError(error, "Unable to load bank accounts", accountFieldMap);
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
    const bankNames = await getBankNames();
    const payload = normalizeCreatePayload(body, bankNames, userId);
    const res = await createBankAccount(payload);
    return NextResponse.json(
      { account: normalizeAccount(res.data ?? {}) },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error, "Unable to create bank account", accountFieldMap);
  }
}
