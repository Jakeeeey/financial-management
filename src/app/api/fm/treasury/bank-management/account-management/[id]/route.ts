// src/app/api/fm/treasury/bank-management/account-management/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  asBoolean,
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  DirectusList,
  isFieldAccessError,
  jsonError,
  sanitizeAccountNumber,
} from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankAccountRow = {
  id?: unknown;
  bank_name?: unknown;
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
};

type BankNameRow = {
  id?: unknown;
  bank_name?: unknown;
  is_active?: unknown;
};

const updateOptionalFields = [
  "bank_description",
  "ifsc_code",
  "province",
  "city",
  "baranggay",
  "email",
  "mobile_no",
  "contact_person",
] as const;

function nullableString(value: unknown) {
  const text = asString(value);
  return text ? text : null;
}

function normalizeAccount(row: BankAccountRow) {
  return {
    id: asNumber(row.id) ?? 0,
    bankName: asString(row.bank_name),
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
  };
}

function normalizeBankName(row: BankNameRow) {
  return {
    id: asNumber(row.id) ?? 0,
    bankName: asString(row.bank_name),
  };
}

function bankNameParams(includeActiveFilter: boolean) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "bank_name");
  params.set("fields", includeActiveFilter ? "id,bank_name,is_active" : "id,bank_name");
  if (includeActiveFilter) params.set("filter[is_active][_eq]", "1");
  return params;
}

async function getBankNames() {
  try {
    const res = await directusFetch<DirectusList<BankNameRow>>(
      `/items/bank_names?${bankNameParams(true).toString()}`,
    );
    return (res.data ?? []).map(normalizeBankName).filter((bank) => bank.id > 0 && bank.bankName);
  } catch (error) {
    if (!isFieldAccessError(error, "is_active")) throw error;

    const res = await directusFetch<DirectusList<BankNameRow>>(
      `/items/bank_names?${bankNameParams(false).toString()}`,
    );
    return (res.data ?? []).map(normalizeBankName).filter((bank) => bank.id > 0 && bank.bankName);
  }
}

function assertBankName(bankName: string, bankNames: Array<{ bankName: string }>) {
  if (!bankNames.some((bank) => bank.bankName.toLowerCase() === bankName.toLowerCase())) {
    throw new Error("Select a valid bank name from the bank names list");
  }
}

async function buildUpdatePayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if ("bankName" in body || "bank_name" in body) {
    const bankName = asString(body.bankName ?? body.bank_name);
    if (!bankName) throw new Error("Bank name is required");
    assertBankName(bankName, await getBankNames());
    payload.bank_name = bankName;
  }

  if ("accountNumber" in body || "account_number" in body) {
    const accountNumber = sanitizeAccountNumber(body.accountNumber ?? body.account_number);
    if (!accountNumber) throw new Error("Account number is required");
    payload.account_number = accountNumber;
  }

  if ("branch" in body) {
    const branch = asString(body.branch);
    if (!branch) throw new Error("Branch is required");
    payload.branch = branch;
  }

  if ("bankDescription" in body || "bank_description" in body) {
    payload.bank_description = nullableString(body.bankDescription ?? body.bank_description);
  }

  if ("ifscCode" in body || "ifsc_code" in body) {
    payload.ifsc_code = nullableString(body.ifscCode ?? body.ifsc_code);
  }

  if ("province" in body) payload.province = nullableString(body.province);
  if ("city" in body) payload.city = nullableString(body.city);
  if ("baranggay" in body) payload.baranggay = nullableString(body.baranggay);
  if ("email" in body) payload.email = nullableString(body.email);
  if ("mobileNo" in body || "mobile_no" in body) payload.mobile_no = nullableString(body.mobileNo ?? body.mobile_no);
  if ("contactPerson" in body || "contact_person" in body) {
    payload.contact_person = nullableString(body.contactPerson ?? body.contact_person);
  }
  if ("isActive" in body || "is_active" in body) payload.is_active = asBoolean(body.isActive ?? body.is_active) ? 1 : 0;

  if (Object.keys(payload).length === 0) throw new Error("No account changes were provided");
  return payload;
}

function removeInaccessibleUpdateField(payload: Record<string, unknown>, error: unknown) {
  for (const field of updateOptionalFields) {
    if (field in payload && isFieldAccessError(error, field)) {
      delete payload[field];
      return true;
    }
  }

  return false;
}

async function updateBankAccount(accountId: number, payload: Record<string, unknown>) {
  const nextPayload = { ...payload };

  for (let attempt = 0; attempt <= updateOptionalFields.length; attempt += 1) {
    try {
      return await directusFetch<DirectusItem<BankAccountRow>>(`/items/bank_accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify(nextPayload),
      });
    } catch (error) {
      if (!removeInaccessibleUpdateField(nextPayload, error)) throw error;
      if (Object.keys(nextPayload).length === 0) throw error;
    }
  }

  throw new Error("Unable to update bank account with the permitted Directus fields");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const accountId = asNumber(id);
    if (!accountId) {
      return NextResponse.json({ error: "Invalid bank account id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const payload = await buildUpdatePayload(body);
    const res = await updateBankAccount(accountId, payload);

    return NextResponse.json({ account: normalizeAccount(res.data ?? {}) });
  } catch (error) {
    return jsonError(error);
  }
}
