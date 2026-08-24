import { NextRequest, NextResponse } from "next/server";
import {
  addSoftDeleteFilters,
  asNumber,
  asString,
  directusFetch,
  discountLabel,
  DirectusList,
  isDeletedAtAccessError,
  jsonError,
  relationId,
  relationName,
} from "../customer-discounting/_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuleRow = {
  id?: unknown;
  customer_code?: unknown;
  category_id?: unknown;
  discount_type?: unknown;
};

type CustomerRow = {
  customer_code?: unknown;
  customer_name?: unknown;
};

async function fetchSupplierRules(supplierId: number) {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set(
    "fields",
    [
      "id",
      "customer_code",
      "category_id",
      "category_id.category_name",
      "discount_type",
      "discount_type.id",
      "discount_type.discount_type",
      "discount_type.total_percent",
    ].join(","),
  );
  params.set("filter[supplier_id][_eq]", String(supplierId));

  const paramsWithSoftDelete = new URLSearchParams(params);
  addSoftDeleteFilters(paramsWithSoftDelete);

  try {
    return await directusFetch<DirectusList<RuleRow>>(
      `/items/supplier_category_discount_per_customer?${paramsWithSoftDelete.toString()}`,
    );
  } catch (error) {
    if (!isDeletedAtAccessError(error)) throw error;
    return directusFetch<DirectusList<RuleRow>>(
      `/items/supplier_category_discount_per_customer?${params.toString()}`,
    );
  }
}

async function fetchCustomersByCodes(customerCodes: string[]) {
  if (customerCodes.length === 0) return [];
  
  // Chunking to avoid URL too long if there are many customers
  const chunkSize = 100;
  let allCustomers: CustomerRow[] = [];
  
  for (let i = 0; i < customerCodes.length; i += chunkSize) {
    const chunk = customerCodes.slice(i, i + chunkSize);
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("fields", "customer_code,customer_name");
    params.set("filter[customer_code][_in]", chunk.join(","));
    
    const res = await directusFetch<DirectusList<CustomerRow>>(`/items/customer?${params.toString()}`);
    if (res.data) {
      allCustomers = allCustomers.concat(res.data);
    }
  }
  
  return allCustomers;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = asNumber(searchParams.get("supplierId"));
    const search = asString(searchParams.get("search")).toLowerCase();

    if (!supplierId) {
      return NextResponse.json({ data: [] });
    }

    const rulesRes = await fetchSupplierRules(supplierId);
    const rules = rulesRes.data ?? [];
    
    if (rules.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const uniqueCustomerCodes = Array.from(
      new Set(rules.map((r) => asString(r.customer_code)).filter(Boolean))
    );

    const customers = await fetchCustomersByCodes(uniqueCustomerCodes);
    const customerMap = new Map<string, string>();
    for (const c of customers) {
      const code = asString(c.customer_code);
      if (code) {
        customerMap.set(code, asString(c.customer_name));
      }
    }

    const data = rules.map((row) => {
      const customerCode = asString(row.customer_code);
      const customerName = customerMap.get(customerCode) || "Unknown Customer";
      
      return {
        id: asNumber(row.id) ?? 0,
        customerCode,
        customerName,
        categoryId: relationId(row.category_id, "category_id"),
        categoryName: relationName(row.category_id, "category_name"),
        discount: discountLabel(row.discount_type),
      };
    });

    let filteredData = data.filter(d => d.id > 0);

    if (search) {
      filteredData = filteredData.filter(d => 
        d.customerName.toLowerCase().includes(search) || 
        d.customerCode.toLowerCase().includes(search)
      );
    }
    
    // Sort by customer name
    filteredData.sort((a, b) => a.customerName.localeCompare(b.customerName));

    return NextResponse.json({ data: filteredData });
  } catch (error) {
    return jsonError(error);
  }
}
