import { NextRequest, NextResponse } from "next/server";
import { asNumber, asString, directusFetch, DirectusList, jsonError } from "../../_utils";

type ProductRow = {
  product_id?: unknown;
  product_code?: unknown;
  barcode?: unknown;
  product_name?: unknown;
  product_category?: unknown;
  price_per_unit?: unknown;
  priceA?: unknown;
  priceB?: unknown;
  priceC?: unknown;
  priceD?: unknown;
  priceE?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function categoryId(value: unknown) {
  if (value && typeof value === "object") {
    return asNumber((value as Record<string, unknown>).category_id);
  }
  return asNumber(value);
}

function categoryName(value: unknown) {
  return value && typeof value === "object"
    ? asString((value as Record<string, unknown>).category_name)
    : "";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = asString(searchParams.get("q"));

    if (!q) return NextResponse.json({ data: [] });

    const params = new URLSearchParams();
    params.set("limit", "30");
    params.set("sort", "product_name");
    params.set("search", q);
    params.set(
      "fields",
      [
        "product_id",
        "product_code",
        "barcode",
        "product_name",
        "product_category",
        "product_category.category_id",
        "product_category.category_name",
        "price_per_unit",
        "priceA",
        "priceB",
        "priceC",
        "priceD",
        "priceE",
      ].join(","),
    );
    params.set("filter[isActive][_eq]", "1");

    const res = await directusFetch<DirectusList<ProductRow>>(`/items/products?${params.toString()}`);
    const data = (res.data ?? [])
      .map((row) => ({
        productId: asNumber(row.product_id) ?? 0,
        productCode: asString(row.product_code),
        barcode: asString(row.barcode),
        productName: asString(row.product_name),
        categoryId: categoryId(row.product_category),
        categoryName: categoryName(row.product_category),
        pricePerUnit: asNumber(row.price_per_unit),
        priceA: asNumber(row.priceA),
        priceB: asNumber(row.priceB),
        priceC: asNumber(row.priceC),
        priceD: asNumber(row.priceD),
        priceE: asNumber(row.priceE),
      }))
      .filter((row) => row.productId > 0 && row.productName);

    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error);
  }
}
