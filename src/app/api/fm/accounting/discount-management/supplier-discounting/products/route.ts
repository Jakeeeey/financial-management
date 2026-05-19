// src/app/api/fm/accounting/discount-management/supplier-discounting/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  addParentProductFilter,
  asNumber,
  asString,
  directusFetch,
  DirectusList,
  jsonError,
  relationId,
  relationName,
} from "../_utils";

type ProductRow = {
  product_id?: unknown;
  product_code?: unknown;
  barcode?: unknown;
  product_name?: unknown;
  parent_id?: unknown;
  product_category?: unknown;
  product_brand?: unknown;
  cost_per_unit?: unknown;
  price_per_unit?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePage(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(100, Math.floor(parsed));
}

function buildProductParams(searchParams: URLSearchParams) {
  const page = normalizePage(searchParams.get("page"));
  const pageSize = normalizePageSize(searchParams.get("page_size") ?? searchParams.get("pageSize"));
  const search = asString(searchParams.get("q") ?? searchParams.get("search"));
  const categoryId = asNumber(searchParams.get("category_id") ?? searchParams.get("categoryId"));
  const brandId = asNumber(searchParams.get("brand_id") ?? searchParams.get("brandId"));
  const params = new URLSearchParams();
  const offset = (page - 1) * pageSize;
  let filterIndex = 0;

  params.set("limit", String(pageSize));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  params.set("sort", "product_name,product_id");
  params.set(
    "fields",
    [
      "product_id",
      "product_code",
      "barcode",
      "product_name",
      "parent_id",
      "product_category",
      "product_category.category_id",
      "product_category.category_name",
      "product_brand",
      "product_brand.brand_id",
      "product_brand.brand_name",
      "cost_per_unit",
      "price_per_unit",
    ].join(","),
  );

  addParentProductFilter(params, filterIndex);
  filterIndex += 1;
  params.set(`filter[_and][${filterIndex}][isActive][_eq]`, "1");
  filterIndex += 1;

  if (categoryId) {
    params.set(`filter[_and][${filterIndex}][product_category][_eq]`, String(categoryId));
    filterIndex += 1;
  }

  if (brandId) {
    params.set(`filter[_and][${filterIndex}][product_brand][_eq]`, String(brandId));
    filterIndex += 1;
  }

  if (search) {
    params.set(`filter[_and][${filterIndex}][_or][0][product_name][_contains]`, search);
    params.set(`filter[_and][${filterIndex}][_or][1][product_code][_contains]`, search);
    params.set(`filter[_and][${filterIndex}][_or][2][barcode][_contains]`, search);
  }

  return { params, page, pageSize, search };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { params, page, pageSize, search } = buildProductParams(searchParams);
    const res = await directusFetch<DirectusList<ProductRow>>(`/items/products?${params.toString()}`);
    const total = asNumber(res.meta?.filter_count) ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const products = (res.data ?? [])
      .map((row) => {
        const productId = asNumber(row.product_id) ?? 0;
        return {
          productId,
          productCode: asString(row.product_code),
          barcode: asString(row.barcode),
          productName: asString(row.product_name) || `Product #${productId}`,
          parentId: relationId(row.parent_id, "product_id"),
          categoryId: relationId(row.product_category, "category_id"),
          categoryName: relationName(row.product_category, "category_name"),
          brandId: relationId(row.product_brand, "brand_id"),
          brandName: relationName(row.product_brand, "brand_name"),
          costPerUnit: asNumber(row.cost_per_unit),
          pricePerUnit: asNumber(row.price_per_unit),
        };
      })
      .filter((row) => row.productId > 0);

    const emptyStateMessage =
      products.length === 0 && search
        ? "No results found. Please select the parent product to apply discounts."
        : null;

    return NextResponse.json({
      products,
      pagination: {
        page: Math.min(page, totalPages),
        pageSize,
        total,
        totalPages,
        search,
      },
      emptyStateMessage,
    });
  } catch (error) {
    return jsonError(error);
  }
}
