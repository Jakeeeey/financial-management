// src/app/api/fm/treasury/bank-management/account-management/account-types/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  asBoolean,
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  DirectusList,
  isDirectusAccessError,
  isFieldAccessError,
  jsonError,
} from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccountTypeRow = {
  id?: unknown;
  account_type?: unknown;
  is_active?: unknown;
};

type CreateAccountTypePayload = {
  account_type: string;
  is_active?: number;
};

const defaultAccountTypes = ["Savings", "Checking", "Current", "Other"];
const optionalCreateFields = ["is_active"] as const;

function normalizeAccountType(row: AccountTypeRow) {
  return {
    id: asNumber(row.id) ?? 0,
    accountType: asString(row.account_type),
    isActive: row.is_active === undefined ? true : asBoolean(row.is_active),
  };
}

function defaultAccountTypeRows() {
  return defaultAccountTypes.map((accountType, index) => ({
    id: index + 1,
    accountType,
    isActive: true,
  }));
}

function normalizeName(value: unknown) {
  return asString(value).replace(/\s+/g, " ");
}

function uniqueAccountTypes(rows: ReturnType<typeof normalizeAccountType>[]) {
  const uniqueByName = new Map<string, ReturnType<typeof normalizeAccountType>>();

  for (const row of rows) {
    const accountType = normalizeName(row.accountType);
    if (!accountType) continue;

    const key = accountType.toLowerCase();
    if (!uniqueByName.has(key)) {
      uniqueByName.set(key, { ...row, accountType });
    }
  }

  return Array.from(uniqueByName.values());
}

function accountTypeLookupParams(includeActiveFilter: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "account_type");
  params.set(
    "fields",
    includeActiveFilter ? "id,account_type,is_active" : "id,account_type",
  );
  if (includeActiveFilter) params.set("filter[is_active][_eq]", "1");
  return params;
}

async function getAccountTypes() {
  try {
    const res = await directusFetch<DirectusList<AccountTypeRow>>(
      `/items/bank_account_types?${accountTypeLookupParams(true).toString()}`,
    );
    return uniqueAccountTypes([
      ...defaultAccountTypeRows(),
      ...(res.data ?? []).map(normalizeAccountType),
    ]);
  } catch (error) {
    if (!isFieldAccessError(error, "is_active")) {
      if (isDirectusAccessError(error)) return defaultAccountTypeRows();
      throw error;
    }

    try {
      const res = await directusFetch<DirectusList<AccountTypeRow>>(
        `/items/bank_account_types?${accountTypeLookupParams(false).toString()}`,
      );
      return uniqueAccountTypes([
        ...defaultAccountTypeRows(),
        ...(res.data ?? []).map(normalizeAccountType),
      ]);
    } catch (fallbackError) {
      if (isDirectusAccessError(fallbackError)) return defaultAccountTypeRows();
      throw fallbackError;
    }
  }
}

function isDuplicateAccountType(
  accountType: string,
  accountTypes: Array<{ accountType: string }>,
) {
  const key = normalizeName(accountType).toLowerCase();
  return accountTypes.some(
    (type) => normalizeName(type.accountType).toLowerCase() === key,
  );
}

function removeInaccessibleCreateField(
  payload: Partial<CreateAccountTypePayload>,
  error: unknown,
) {
  for (const field of optionalCreateFields) {
    if (field in payload && isFieldAccessError(error, field)) {
      delete payload[field];
      return true;
    }
  }

  return false;
}

async function createAccountType(payload: CreateAccountTypePayload) {
  const nextPayload: Partial<CreateAccountTypePayload> = { ...payload };

  for (let attempt = 0; attempt <= optionalCreateFields.length; attempt += 1) {
    try {
      return await directusFetch<DirectusItem<AccountTypeRow>>(
        "/items/bank_account_types",
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
    "Unable to create account type with the permitted Directus fields",
  );
}

export async function GET() {
  try {
    const accountTypes = await getAccountTypes();
    return NextResponse.json({ accountTypes });
  } catch (error) {
    return jsonError(error, "Unable to load account types");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const accountType = normalizeName(body.accountType ?? body.account_type);
    const allowDuplicate = asBoolean(body.allowDuplicate);

    if (!accountType) {
      return NextResponse.json(
        { error: "Account type is required" },
        { status: 400 },
      );
    }

    const accountTypes = await getAccountTypes();
    if (!allowDuplicate && isDuplicateAccountType(accountType, accountTypes)) {
      return NextResponse.json(
        {
          error: "Account type already exists",
          duplicate: true,
          accountType,
          message: "An account type with this value already exists",
        },
        { status: 409 },
      );
    }

    const res = await createAccountType({
      account_type: accountType,
      is_active: 1,
    });
    return NextResponse.json(
      {
        accountType: normalizeAccountType(
          res.data ?? { account_type: accountType },
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error, "Unable to create account type");
  }
}
