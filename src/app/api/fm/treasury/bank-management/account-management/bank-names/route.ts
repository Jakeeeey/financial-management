// src/app/api/fm/treasury/bank-management/account-management/bank-names/route.ts
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

type BankNameRow = {
  id?: unknown;
  bank_name?: unknown;
  is_active?: unknown;
};

type CreateBankNamePayload = {
  bank_name: string;
  is_active?: number;
};

const optionalCreateFields = ["is_active"] as const;

function normalizeBankName(row: BankNameRow) {
  return {
    id: asNumber(row.id) ?? 0,
    bankName: asString(row.bank_name),
    isActive: row.is_active === undefined ? true : asBoolean(row.is_active),
  };
}

function normalizeName(value: unknown) {
  return asString(value).replace(/\s+/g, " ");
}

function bankNameLookupParams(includeId: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "bank_name");
  params.set("fields", includeId ? "id,bank_name" : "bank_name");
  return params;
}

async function getBankNamesForDuplicateCheck() {
  try {
    const res = await directusFetch<DirectusList<BankNameRow>>(
      `/items/bank_names?${bankNameLookupParams(true).toString()}`,
    );
    return (res.data ?? []).map(normalizeBankName);
  } catch (error) {
    if (!isDirectusAccessError(error)) throw error;

    const res = await directusFetch<DirectusList<BankNameRow>>(
      `/items/bank_names?${bankNameLookupParams(false).toString()}`,
    );
    return (res.data ?? []).map(normalizeBankName);
  }
}

function isDuplicateBankName(
  bankName: string,
  bankNames: Array<{ bankName: string }>,
) {
  const key = normalizeName(bankName).toLowerCase();
  return bankNames.some(
    (bank) => normalizeName(bank.bankName).toLowerCase() === key,
  );
}

function removeInaccessibleCreateField(
  payload: Partial<CreateBankNamePayload>,
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

async function createBankName(payload: CreateBankNamePayload) {
  const nextPayload: Partial<CreateBankNamePayload> = { ...payload };

  for (let attempt = 0; attempt <= optionalCreateFields.length; attempt += 1) {
    try {
      return await directusFetch<DirectusItem<BankNameRow>>(
        "/items/bank_names",
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
    "Unable to create bank name with the permitted Directus fields",
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const bankName = normalizeName(body.bankName ?? body.bank_name);
    const allowDuplicate = asBoolean(body.allowDuplicate);

    if (!bankName) {
      return NextResponse.json(
        { error: "Bank name is required" },
        { status: 400 },
      );
    }

    const bankNames = await getBankNamesForDuplicateCheck();
    if (!allowDuplicate && isDuplicateBankName(bankName, bankNames)) {
      return NextResponse.json(
        {
          error: "Bank name already exists",
          duplicate: true,
          bankName,
          message: "A bank name with this value already exists",
        },
        { status: 409 },
      );
    }

    const res = await createBankName({ bank_name: bankName, is_active: 1 });
    return NextResponse.json(
      { bankName: normalizeBankName(res.data ?? { bank_name: bankName }) },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
