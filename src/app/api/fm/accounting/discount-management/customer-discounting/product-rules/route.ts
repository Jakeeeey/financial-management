// src/app/api/fm/accounting/discount-management/customer-discounting/product-rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  addSoftDeleteFilters,
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  DirectusList,
  isDeletedAtAccessError,
  jsonError,
} from "../_utils";

type RuleRow = {
  id?: unknown;
  customer_code?: unknown;
};

type ReferenceRow = {
  id?: unknown;
  product_id?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks for an existing active product-specific rule before insert.
 */
async function hasDuplicate(customerCode: string, productId: number) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "id");
  params.set("filter[customer_code][_eq]", customerCode);
  params.set("filter[product_id][_eq]", String(productId));

  const paramsWithSoftDelete = new URLSearchParams(params);
  addSoftDeleteFilters(paramsWithSoftDelete);

  try {
    const res = await directusFetch<DirectusList<RuleRow>>(
      `/items/product_per_customer?${paramsWithSoftDelete.toString()}`,
    );
    return (res.data ?? []).length > 0;
  } catch (error) {
    if (!isDeletedAtAccessError(error)) throw error;
    const res = await directusFetch<DirectusList<RuleRow>>(`/items/product_per_customer?${params.toString()}`);
    return (res.data ?? []).length > 0;
  }
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
 * Verifies product selections still point to an active product.
 */
async function hasActiveProduct(productId: number) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "product_id");
  params.set("filter[product_id][_eq]", String(productId));
  params.set("filter[isActive][_eq]", "1");

  const res = await directusFetch<DirectusList<ReferenceRow>>(`/items/products?${params.toString()}`);
  return (res.data ?? []).length > 0;
}

/**
 * Verifies optional product discounts reference an existing discount type.
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
 * Creates a customer/product rule with either a discount type or explicit unit price.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerCode = asString(body.customerCode ?? body.customer_code);
    const productId = asNumber(body.productId ?? body.product_id);
    const discountTypeId = asNumber(body.discountTypeId ?? body.discount_type);
    const unitPrice = asNumber(body.unitPrice ?? body.unit_price);
    const createdBy = asNumber(body.createdBy ?? body.created_by);

    if (!customerCode || !productId) {
      return NextResponse.json({ error: "customerCode and productId are required" }, { status: 400 });
    }

    if (!discountTypeId && unitPrice === null) {
      return NextResponse.json({ error: "Select a discount type or enter a unit price" }, { status: 400 });
    }

    if (discountTypeId !== null && discountTypeId <= 0) {
      return NextResponse.json({ error: "Discount type was not found" }, { status: 404 });
    }

    if (unitPrice !== null && unitPrice < 0) {
      return NextResponse.json({ error: "Unit price must be zero or greater" }, { status: 400 });
    }

    if (!(await hasActiveCustomer(customerCode))) {
      return NextResponse.json({ error: "Customer was not found or is inactive" }, { status: 404 });
    }

    if (!(await hasActiveProduct(productId))) {
      return NextResponse.json({ error: "Product was not found or is inactive" }, { status: 404 });
    }

    if (discountTypeId !== null && !(await hasDiscountType(discountTypeId))) {
      return NextResponse.json({ error: "Discount type was not found" }, { status: 404 });
    }

    if (await hasDuplicate(customerCode, productId)) {
      return NextResponse.json(
        { error: "A product discount already exists for this customer and product." },
        { status: 409 },
      );
    }

    const payload: Record<string, unknown> = {
      customer_code: customerCode,
      product_id: productId,
      discount_type: discountTypeId,
    };
    if (unitPrice !== null) payload.unit_price = unitPrice;
    if (createdBy) payload.created_by = createdBy;

    const res = await directusFetch<DirectusItem<RuleRow>>("/items/product_per_customer", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json(res.data ?? { success: true }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Soft-deletes a product-specific rule by setting deleted_at/deleted_by.
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
      `/items/product_per_customer/${id}?fields=id,customer_code`,
    );
    const existingRule = existing.data;
    if (!existingRule?.id) {
      return NextResponse.json({ error: "Product discount rule was not found" }, { status: 404 });
    }

    if (asString(existingRule.customer_code) !== customerCode) {
      return NextResponse.json({ error: "Product discount rule does not belong to this customer" }, { status: 403 });
    }

    const payload: Record<string, unknown> = {
      deleted_at: new Date().toISOString(),
    };
    if (userId) payload.deleted_by = userId;

    await directusFetch<DirectusItem<RuleRow>>(`/items/product_per_customer/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
