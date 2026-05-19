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
  customer_code?: unknown;
};

type ReferenceRow = {
  id?: unknown;
  category_id?: unknown;
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
 * Verifies the customer code is assignable before creating a rule.
 */
async function hasActiveCustomer(customerCode: string) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "id");
  params.set("filter[customer_code][_eq]", customerCode);
  params.set("filter[isActive][_eq]", "1");

  const res = await directusFetch<DirectusList<ReferenceRow>>(`/items/customer?${params.toString()}`);
  return (res.data ?? []).length > 0;
}

/**
 * Verifies supplier/category rules only use active trade suppliers.
 */
async function hasActiveTradeSupplier(supplierId: number) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "id");
  params.set("filter[id][_eq]", String(supplierId));
  params.set("filter[isActive][_eq]", "1");
  params.set("filter[supplier_type][_eq]", "TRADE");

  const res = await directusFetch<DirectusList<ReferenceRow>>(`/items/suppliers?${params.toString()}`);
  return (res.data ?? []).length > 0;
}

/**
 * Verifies category selections reference an existing category.
 */
async function hasCategory(categoryId: number) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "category_id");
  params.set("filter[category_id][_eq]", String(categoryId));

  const res = await directusFetch<DirectusList<ReferenceRow>>(`/items/categories?${params.toString()}`);
  return (res.data ?? []).length > 0;
}

/**
 * Verifies selected discounts reference an existing discount type.
 */
async function hasDiscountType(discountTypeId: number) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "id");
  params.set("filter[id][_eq]", String(discountTypeId));

  const res = await directusFetch<DirectusList<ReferenceRow>>(`/items/discount_type?${params.toString()}`);
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

    if (!(await hasActiveCustomer(customerCode))) {
      return NextResponse.json({ error: "Customer was not found or is inactive" }, { status: 404 });
    }

    if (!(await hasActiveTradeSupplier(supplierId))) {
      return NextResponse.json({ error: "Supplier was not found, inactive, or not a trade supplier" }, { status: 404 });
    }

    if (!(await hasCategory(categoryId))) {
      return NextResponse.json({ error: "Category was not found" }, { status: 404 });
    }

    if (!(await hasDiscountType(discountTypeId))) {
      return NextResponse.json({ error: "Discount type was not found" }, { status: 404 });
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
    const customerCode = asString(searchParams.get("customer_code") ?? searchParams.get("customerCode"));
    const userId = asNumber(searchParams.get("userId"));

    if (!id || !customerCode) {
      return NextResponse.json({ error: "id and customer_code are required" }, { status: 400 });
    }

    const existing = await directusFetch<DirectusItem<RuleRow>>(
      `/items/supplier_category_discount_per_customer/${id}?fields=id,customer_code`,
    );
    const existingRule = existing.data;
    if (!existingRule?.id) {
      return NextResponse.json({ error: "Supplier/category discount rule was not found" }, { status: 404 });
    }

    if (asString(existingRule.customer_code) !== customerCode) {
      return NextResponse.json(
        { error: "Supplier/category discount rule does not belong to this customer" },
        { status: 403 },
      );
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
