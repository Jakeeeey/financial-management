import type { CustomerDiscountingModuleData } from "@/modules/financial-management/accounting/discount-management/customer-discounting";
import {
  asNumber,
  asString,
  categoryParams,
  directusFetch,
  discountLabel,
  discountTypeParams,
  DirectusList,
  tradeSupplierParams,
} from "./_utils";

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

type ModuleDataQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
};

const defaultPageSize = 10;
const maxPageSize = 100;

function normalizePage(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultPageSize;
  return Math.min(maxPageSize, Math.floor(parsed));
}

function customerParams(query: Required<ModuleDataQuery>) {
  const params = new URLSearchParams();
  const offset = (query.page - 1) * query.pageSize;
  const search = query.search.trim();

  params.set("limit", String(query.pageSize));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  params.set("sort", "customer_name");
  params.set(
    "fields",
    [
      "id",
      "customer_code",
      "customer_name",
      "store_name",
      "isActive",
      "discount_type",
      "discount_type.id",
      "discount_type.discount_type",
      "discount_type.total_percent",
    ].join(","),
  );

  if (!search) {
    params.set("filter[isActive][_eq]", "1");
    return params;
  }

  params.set("filter[_and][0][isActive][_eq]", "1");
  params.set("filter[_and][1][_or][0][customer_name][_contains]", search);
  params.set("filter[_and][1][_or][1][customer_code][_contains]", search);
  params.set("filter[_and][1][_or][2][store_name][_contains]", search);
  return params;
}

export async function getCustomerDiscountingModuleData(query: ModuleDataQuery = {}): Promise<CustomerDiscountingModuleData> {
  const normalizedQuery = {
    page: normalizePage(query.page),
    pageSize: normalizePageSize(query.pageSize),
    search: asString(query.search),
  };

  const [customersRes, discountTypesRes, suppliersRes, categoriesRes] = await Promise.all([
    directusFetch<DirectusList<CustomerRow>>(`/items/customer?${customerParams(normalizedQuery).toString()}`),
    directusFetch<DirectusList<DiscountTypeRow>>(`/items/discount_type?${discountTypeParams().toString()}`),
    directusFetch<DirectusList<SupplierRow>>(`/items/suppliers?${tradeSupplierParams().toString()}`),
    directusFetch<DirectusList<CategoryRow>>(`/items/categories?${categoryParams().toString()}`),
  ]);

  const total = asNumber(customersRes.meta?.filter_count) ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / normalizedQuery.pageSize));

  if (total > 0 && normalizedQuery.page > totalPages) {
    return getCustomerDiscountingModuleData({ ...normalizedQuery, page: totalPages });
  }

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

  return {
    customers,
    discountTypes,
    suppliers,
    categories,
    pagination: {
      page: normalizedQuery.page,
      pageSize: normalizedQuery.pageSize,
      total,
      totalPages,
      search: normalizedQuery.search,
    },
  };
}
