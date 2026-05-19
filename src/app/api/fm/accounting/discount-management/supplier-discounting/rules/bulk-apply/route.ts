// src/app/api/fm/accounting/discount-management/supplier-discounting/rules/bulk-apply/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  addParentProductFilter,
  asNumber,
  asString,
  directusFetch,
  DirectusItem,
  DirectusList,
  jsonError,
} from "../../_utils";

type RuleRow = {
  id?: unknown;
  supplier_id?: unknown;
  product_id?: unknown;
};

type ProductRow = {
  product_id?: unknown;
  product_name?: unknown;
};

type ExistingLink = {
  id: number;
  productId: number;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => asNumber(item)).filter((item): item is number => !!item)))
    : [];
}

function existingLinks(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            id: asNumber(record.id) ?? 0,
            productId: asNumber(record.productId ?? record.product_id) ?? 0,
          };
        })
        .filter((item): item is ExistingLink => item.id > 0 && item.productId > 0)
    : [];
}

async function productNameMap(productIds: number[]) {
  if (productIds.length === 0) return new Map<number, string>();

  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "product_id,product_name");
  params.set("filter[product_id][_in]", productIds.join(","));
  const res = await directusFetch<DirectusList<ProductRow>>(`/items/products?${params.toString()}`);
  return new Map(
    (res.data ?? []).map((row) => [
      asNumber(row.product_id) ?? 0,
      asString(row.product_name) || `Product #${asNumber(row.product_id) ?? 0}`,
    ]),
  );
}

async function validateParentProducts(productIds: number[]) {
  if (productIds.length === 0) return [];

  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("fields", "product_id");
  params.set("filter[_and][0][product_id][_in]", productIds.join(","));
  addParentProductFilter(params, 1);

  const res = await directusFetch<DirectusList<ProductRow>>(`/items/products?${params.toString()}`);
  const validIds = new Set((res.data ?? []).map((row) => asNumber(row.product_id)).filter(Boolean));
  return productIds.filter((productId) => !validIds.has(productId));
}

async function createItems(
  supplierId: number,
  discountTypeId: number,
  productIds: number[],
  names: Map<number, string>,
) {
  if (productIds.length === 0) return { count: 0, failed: [] as Array<{ productId: number; productName: string; reason: string }> };

  const payload = productIds.map((productId) => ({
    supplier_id: supplierId,
    product_id: productId,
    discount_type: discountTypeId,
  }));

  try {
    await directusFetch<DirectusList<RuleRow> | DirectusItem<RuleRow[]>>("/items/product_per_supplier", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { count: payload.length, failed: [] };
  } catch {
    let count = 0;
    const failed: Array<{ productId: number; productName: string; reason: string }> = [];

    for (const item of payload) {
      try {
        await directusFetch<DirectusItem<RuleRow>>("/items/product_per_supplier", {
          method: "POST",
          body: JSON.stringify(item),
        });
        count += 1;
      } catch (error) {
        failed.push({
          productId: item.product_id,
          productName: names.get(item.product_id) ?? `Product #${item.product_id}`,
          reason: error instanceof Error ? error.message : "Create failed",
        });
      }
    }

    return { count, failed };
  }
}

async function updateItems(
  discountTypeId: number,
  links: ExistingLink[],
  names: Map<number, string>,
) {
  if (links.length === 0) return { count: 0, failed: [] as Array<{ productId: number; productName: string; reason: string }> };

  const payload = links.map((link) => ({
    id: link.id,
    discount_type: discountTypeId,
  }));

  try {
    await directusFetch<DirectusList<RuleRow> | DirectusItem<RuleRow[]>>("/items/product_per_supplier", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return { count: payload.length, failed: [] };
  } catch {
    let count = 0;
    const failed: Array<{ productId: number; productName: string; reason: string }> = [];

    for (const link of links) {
      try {
        await directusFetch<DirectusItem<RuleRow>>(`/items/product_per_supplier/${link.id}`, {
          method: "PATCH",
          body: JSON.stringify({ discount_type: discountTypeId }),
        });
        count += 1;
      } catch (error) {
        failed.push({
          productId: link.productId,
          productName: names.get(link.productId) ?? `Product #${link.productId}`,
          reason: error instanceof Error ? error.message : "Update failed",
        });
      }
    }

    return { count, failed };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const supplierId = asNumber(body.supplierId ?? body.supplier_id);
    const discountTypeId = asNumber(body.discountTypeId ?? body.discount_type);
    const newLinks = numberArray(body.newLinks ?? body.new_links);
    const existing = existingLinks(body.existingLinks ?? body.existing_links);

    if (!supplierId || !discountTypeId || (newLinks.length === 0 && existing.length === 0)) {
      return NextResponse.json(
        { error: "supplierId, discountTypeId, and at least one link are required" },
        { status: 400 },
      );
    }

    const productIds = Array.from(new Set([...newLinks, ...existing.map((link) => link.productId)]));
    const names = await productNameMap(productIds);
    const invalidProductIds = await validateParentProducts(productIds);

    if (invalidProductIds.length > 0) {
      return NextResponse.json(
        {
          error: "Discounts can only be assigned to parent products.",
          invalidProductIds,
        },
        { status: 400 },
      );
    }

    const created = await createItems(supplierId, discountTypeId, newLinks, names);
    const updated = await updateItems(discountTypeId, existing, names);

    return NextResponse.json({
      created: created.count,
      updated: updated.count,
      failed: [...created.failed, ...updated.failed],
    });
  } catch (error) {
    return jsonError(error);
  }
}
