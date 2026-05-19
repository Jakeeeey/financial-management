// src/app/api/fm/accounting/discount-management/supplier-discounting/rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  addRelatedParentProductFilter,
  asNumber,
  asString,
  directusFetch,
  discountLabel,
  DirectusItem,
  DirectusList,
  jsonError,
  relationId,
  relationName,
} from "../_utils";

type RuleRow = {
  id?: unknown;
  supplier_id?: unknown;
  product_id?: unknown;
  discount_type?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function productRelation(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = asNumber(searchParams.get("supplier_id") ?? searchParams.get("supplierId"));

    if (!supplierId) {
      return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("sort", "-id");
    params.set(
      "fields",
      [
        "id",
        "supplier_id",
        "supplier_id.id",
        "supplier_id.supplier_name",
        "product_id",
        "product_id.product_id",
        "product_id.product_code",
        "product_id.barcode",
        "product_id.product_name",
        "product_id.parent_id",
        "product_id.product_category",
        "product_id.product_category.category_id",
        "product_id.product_category.category_name",
        "product_id.product_brand",
        "product_id.product_brand.brand_id",
        "product_id.product_brand.brand_name",
        "discount_type",
        "discount_type.id",
        "discount_type.discount_type",
        "discount_type.total_percent",
      ].join(","),
    );
    params.set("filter[_and][0][supplier_id][_eq]", String(supplierId));
    const includeChildren = searchParams.get("include_children") === "true";
    if (!includeChildren) addRelatedParentProductFilter(params, 1);

    const res = await directusFetch<DirectusList<RuleRow>>(`/items/product_per_supplier?${params.toString()}`);
    const rules = (res.data ?? [])
      .map((row) => {
        const product = productRelation(row.product_id);
        return {
          id: asNumber(row.id) ?? 0,
          supplierId: relationId(row.supplier_id),
          supplierName: relationName(row.supplier_id, "supplier_name"),
          productId: relationId(row.product_id, "product_id"),
          productCode: asString(product.product_code),
          productName: asString(product.product_name),
          barcode: asString(product.barcode),
          categoryId: relationId(product.product_category, "category_id"),
          categoryName: relationName(product.product_category, "category_name"),
          brandId: relationId(product.product_brand, "brand_id"),
          brandName: relationName(product.product_brand, "brand_name"),
          discount: discountLabel(row.discount_type),
        };
      })
      .filter((row) => row.id > 0);

    return NextResponse.json({ rules });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = asNumber(searchParams.get("id"));
    const supplierId = asNumber(searchParams.get("supplier_id") ?? searchParams.get("supplierId"));

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!supplierId) {
      return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
    }

    const existing = await directusFetch<DirectusItem<RuleRow>>(`/items/product_per_supplier/${id}?fields=id,supplier_id`);
    if (!existing.data) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const existingSupplierId = relationId(existing.data.supplier_id);
    if (existingSupplierId !== supplierId) {
      return NextResponse.json({ error: "Rule does not belong to this supplier" }, { status: 403 });
    }

    await directusFetch<DirectusItem<RuleRow>>(`/items/product_per_supplier/${id}`, {
      method: "DELETE",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
