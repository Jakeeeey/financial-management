// src/app/api/fm/accounting/discount-management/customer-discounting/supplier-category-rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  addSoftDeleteFilters,
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  DirectusList,
  jsonError,
} from "../_utils";

type RuleRow = {
  id?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks for an existing active supplier/category rule before insert.
 */
async function hasDuplicate(customerCode: string, supplierId: number, categoryId: number) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "id");
  params.set("filter[customer_code][_eq]", customerCode);
  params.set("filter[supplier_id][_eq]", String(supplierId));
  params.set("filter[category_id][_eq]", String(categoryId));
  addSoftDeleteFilters(params);

  const res = await directusFetch<DirectusList<RuleRow>>(
    `/items/supplier_category_discount_per_customer?${params.toString()}`,
  );
  return (res.data ?? []).length > 0;
}

/**
 * Creates a customer supplier/category discount rule.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerCode = asString(body.customerCode ?? body.customer_code);
    const supplierId = asNumber(body.supplierId ?? body.supplier_id);
    const categoryId = asNumber(body.categoryId ?? body.category_id);
    const discountTypeId = asNumber(body.discountTypeId ?? body.discount_type);
    const createdBy = asNumber(body.createdBy ?? body.created_by);

    if (!customerCode || !supplierId || !categoryId || !discountTypeId) {
      return NextResponse.json(
        { error: "customerCode, supplierId, categoryId, and discountTypeId are required" },
        { status: 400 },
      );
    }

    if (await hasDuplicate(customerCode, supplierId, categoryId)) {
      return NextResponse.json(
        { error: "A supplier/category discount already exists for this customer, supplier, and category." },
        { status: 409 },
      );
    }

    const payload: Record<string, unknown> = {
      customer_code: customerCode,
      supplier_id: supplierId,
      category_id: categoryId,
      discount_type: discountTypeId,
    };
    if (createdBy) payload.created_by = createdBy;

    const res = await directusFetch<DirectusItem<RuleRow>>("/items/supplier_category_discount_per_customer", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json(res.data ?? { success: true }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Soft-deletes a supplier/category rule by setting deleted_at/deleted_by.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = asNumber(searchParams.get("id"));
    const userId = asNumber(searchParams.get("userId"));

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      deleted_at: new Date().toISOString(),
    };
    if (userId) payload.deleted_by = userId;

    await directusFetch<DirectusItem<RuleRow>>(`/items/supplier_category_discount_per_customer/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
