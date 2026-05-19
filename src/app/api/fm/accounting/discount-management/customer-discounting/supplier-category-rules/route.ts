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
 * Finds an existing active rule for the given customer and supplier.
 * When categoryId is null, matches any rule for that supplier (category-agnostic).
 * When categoryId is set, matches the exact supplier + category combination.
 * Returns the found record's id, or null if not found.
 */
async function findExistingBySupplier(customerCode: string, supplierId: number, categoryId: number | null) {
  const params = new URLSearchParams();
  params.set("limit", "1");
  params.set("fields", "id");
  params.set("filter[customer_code][_eq]", customerCode);
  params.set("filter[supplier_id][_eq]", String(supplierId));
  if (categoryId !== null) {
    params.set("filter[category_id][_eq]", String(categoryId));
  } else {
    params.set("filter[category_id][_null]", "true");
  }
  addSoftDeleteFilters(params);

  const res = await directusFetch<DirectusList<RuleRow>>(
    `/items/supplier_category_discount_per_customer?${params.toString()}`,
  );
  const rows = res.data ?? [];
  if (rows.length === 0) return null;
  return asNumber(rows[0].id) ?? null;
}

/**
 * Creates or overrides a customer supplier/category discount rule.
 * When category is null, it acts as a supplier-level default and will
 * override any existing rule for that supplier regardless of category.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerCode = asString(body.customerCode ?? body.customer_code);
    const supplierId = asNumber(body.supplierId ?? body.supplier_id);
    const categoryId = asNumber(body.categoryId ?? body.category_id);
    const discountTypeId = asNumber(body.discountTypeId ?? body.discount_type);
    const createdBy = asNumber(body.createdBy ?? body.created_by);

    if (!customerCode || !supplierId || !discountTypeId) {
      return NextResponse.json(
        { error: "customerCode, supplierId, and discountTypeId are required" },
        { status: 400 },
      );
    }

    // When category is null, override any existing rule for this supplier
    if (categoryId === null) {
      // Find any rule for this supplier (regardless of category)
      const params = new URLSearchParams();
      params.set("limit", "1");
      params.set("fields", "id");
      params.set("filter[customer_code][_eq]", customerCode);
      params.set("filter[supplier_id][_eq]", String(supplierId));
      addSoftDeleteFilters(params);

      const res = await directusFetch<DirectusList<RuleRow>>(
        `/items/supplier_category_discount_per_customer?${params.toString()}`,
      );
      const rows = res.data ?? [];

      if (rows.length > 0) {
        const existingId = asNumber(rows[0].id);
        if (existingId) {
          // Override: update the existing rule with null category and new discount
          const payload: Record<string, unknown> = {
            category_id: null,
            discount_type: discountTypeId,
          };
          if (createdBy) payload.updated_by = createdBy;

          await directusFetch<DirectusItem<RuleRow>>(
            `/items/supplier_category_discount_per_customer/${existingId}`,
            { method: "PATCH", body: JSON.stringify(payload) },
          );

          return NextResponse.json({ success: true, overridden: true, id: existingId });
        }
      }

      // No existing rule found, create new one with null category
      const payload: Record<string, unknown> = {
        customer_code: customerCode,
        supplier_id: supplierId,
        category_id: null,
        discount_type: discountTypeId,
      };
      if (createdBy) payload.created_by = createdBy;

      const createRes = await directusFetch<DirectusItem<RuleRow>>("/items/supplier_category_discount_per_customer", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return NextResponse.json(createRes.data ?? { success: true }, { status: 201 });
    }

    // Category has a value — check for an existing null-category rule to override
    const nullCategoryId = await findExistingBySupplier(customerCode, supplierId, null);
    if (nullCategoryId) {
      const payload: Record<string, unknown> = {
        category_id: categoryId,
        discount_type: discountTypeId,
      };
      if (createdBy) payload.updated_by = createdBy;

      await directusFetch<DirectusItem<RuleRow>>(
        `/items/supplier_category_discount_per_customer/${nullCategoryId}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );

      return NextResponse.json({ success: true, overridden: true, id: nullCategoryId });
    }

    // Check exact duplicate
    const existingId = await findExistingBySupplier(customerCode, supplierId, categoryId);
    if (existingId) {
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

    const createRes = await directusFetch<DirectusItem<RuleRow>>("/items/supplier_category_discount_per_customer", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json(createRes.data ?? { success: true }, { status: 201 });
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
