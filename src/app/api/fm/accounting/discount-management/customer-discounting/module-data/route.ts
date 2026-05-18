import { NextResponse } from "next/server";
import {
  activeCustomerParams,
  asNumber,
  asString,
  categoryParams,
  directusFetch,
  discountLabel,
  discountTypeParams,
  DirectusList,
  jsonError,
  tradeSupplierParams,
} from "../_utils";

type CustomerRow = {
  id?: unknown;
  customer_code?: unknown;
  customer_name?: unknown;
  store_name?: unknown;
  discount_type?: unknown;
};

type DiscountTypeRow = {
  id?: unknown;
  discount_type?: unknown;
  total_percent?: unknown;
};

type SupplierRow = {
  id?: unknown;
  supplier_name?: unknown;
  supplier_shortcut?: unknown;
};

type CategoryRow = {
  category_id?: unknown;
  category_name?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [customersRes, discountTypesRes, suppliersRes, categoriesRes] = await Promise.all([
      directusFetch<DirectusList<CustomerRow>>(`/items/customer?${activeCustomerParams().toString()}`),
      directusFetch<DirectusList<DiscountTypeRow>>(`/items/discount_type?${discountTypeParams().toString()}`),
      directusFetch<DirectusList<SupplierRow>>(`/items/suppliers?${tradeSupplierParams().toString()}`),
      directusFetch<DirectusList<CategoryRow>>(`/items/categories?${categoryParams().toString()}`),
    ]);

    const customers = (customersRes.data ?? [])
      .map((row) => ({
        id: asNumber(row.id) ?? 0,
        customerCode: asString(row.customer_code),
        customerName: asString(row.customer_name),
        storeName: asString(row.store_name),
        globalDiscount: discountLabel(row.discount_type),
      }))
      .filter((row) => row.id > 0 && row.customerCode && row.customerName);

    const discountTypes = (discountTypesRes.data ?? [])
      .map((row) => ({
        id: asNumber(row.id) ?? 0,
        discountType: asString(row.discount_type),
        totalPercent: asNumber(row.total_percent) ?? 0,
      }))
      .filter((row) => row.id > 0 && row.discountType);

    const suppliers = (suppliersRes.data ?? [])
      .map((row) => ({
        id: asNumber(row.id) ?? 0,
        supplierName: asString(row.supplier_name),
        supplierShortcut: asString(row.supplier_shortcut),
      }))
      .filter((row) => row.id > 0 && row.supplierName);

    const categories = (categoriesRes.data ?? [])
      .map((row) => ({
        categoryId: asNumber(row.category_id) ?? 0,
        categoryName: asString(row.category_name),
      }))
      .filter((row) => row.categoryId > 0 && row.categoryName);

    return NextResponse.json({ customers, discountTypes, suppliers, categories });
  } catch (error) {
    return jsonError(error);
  }
}
