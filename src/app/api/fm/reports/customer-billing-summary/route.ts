import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const SPRING_API_BASE_URL = (process.env.SPRING_API_BASE_URL || "").replace(/\/+$/, "");

function getDirectusHeaders() {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") || searchParams.get("search") || "";
    const idQuery = searchParams.get("id");
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const offset = (page - 1) * limit;
    const sortBy = searchParams.get("sortBy") || "payment_term_name";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const storeTypeFilter = searchParams.get("storeType") || "";
    const classificationFilter = searchParams.get("classification") || "";

    // Scenario 1: Fetch paginated list of customers (searchable, configurations-first)
    if (!idQuery) {
      // 1. Fetch payment terms, supplier category overrides, product overrides, active customers, store types, and customer classifications in parallel
      const [paymentTermsRes, supplierRulesRes, productRulesRes, customersRes, storeTypesRes, classificationsRes] = await Promise.all([
        fetch(`${DIRECTUS_URL}/items/payment_terms?limit=-1`, {
          headers: getDirectusHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { data: [] })),
        fetch(`${DIRECTUS_URL}/items/supplier_category_discount_per_customer?limit=-1&fields=id,customer_code`, {
          headers: getDirectusHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { data: [] })),
        fetch(`${DIRECTUS_URL}/items/product_per_customer?limit=-1&fields=id,customer_code`, {
          headers: getDirectusHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { data: [] })),
        fetch(`${DIRECTUS_URL}/items/customer?limit=-1&fields=id,customer_code,customer_name,payment_term,discount_type,store_type,classification`, {
          headers: getDirectusHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { data: [] })),
        fetch(`${DIRECTUS_URL}/items/store_type?limit=-1&fields=id,store_type`, {
          headers: getDirectusHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { data: [] })),
        fetch(`${DIRECTUS_URL}/items/customer_classification?limit=-1&fields=id,classification_name`, {
          headers: getDirectusHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { data: [] })),
      ]);

      const paymentTerms = paymentTermsRes.data || [];
      const supplierRules = supplierRulesRes.data || [];
      const productRules = productRulesRes.data || [];
      const rawCustomers = customersRes.data || [];
      const storeTypes = storeTypesRes.data || [];
      const classifications = classificationsRes.data || [];

      // Map helper for quick lookup of rules
      const supplierRulesCountMap: Record<string, number> = {};
      for (const rule of supplierRules) {
        if (rule.customer_code) {
          supplierRulesCountMap[rule.customer_code] = (supplierRulesCountMap[rule.customer_code] || 0) + 1;
        }
      }

      const productRulesCountMap: Record<string, number> = {};
      for (const rule of productRules) {
        if (rule.customer_code) {
          productRulesCountMap[rule.customer_code] = (productRulesCountMap[rule.customer_code] || 0) + 1;
        }
      }

      const paymentTermsMap: Record<number, { payment_name: string; payment_days: number }> = {};
      for (const term of paymentTerms) {
        paymentTermsMap[Number(term.id)] = {
          payment_name: term.payment_name || "",
          payment_days: term.payment_days != null ? Number(term.payment_days) : 0,
        };
      }

      const mappedCustomers = rawCustomers.map((cust: any) => {
        const customerCode = cust.customer_code || "";
        const defaultDiscountCount = cust.discount_type ? 1 : 0;
        const supplierCount = supplierRulesCountMap[customerCode] || 0;
        const productCount = productRulesCountMap[customerCode] || 0;
        const totalDiscountConfigs = defaultDiscountCount + supplierCount + productCount;

        let termId = null;
        if (cust.payment_term) {
          if (typeof cust.payment_term === "object") {
            termId = Number(cust.payment_term.id);
          } else {
            termId = Number(cust.payment_term);
          }
        }

        const termDetail = termId !== null ? paymentTermsMap[termId] : null;
        const paymentTermName = termDetail ? termDetail.payment_name : "No Terms";
        const paymentDays = termDetail ? termDetail.payment_days : -1;

        const storeTypeVal = cust.store_type;
        const classificationVal = cust.classification;
        let storeTypeId = null;
        if (storeTypeVal) {
          storeTypeId = typeof storeTypeVal === "object" ? Number(storeTypeVal.id) : Number(storeTypeVal);
        }
        let classificationId = null;
        if (classificationVal) {
          classificationId = typeof classificationVal === "object" ? Number(classificationVal.id) : Number(classificationVal);
        }

        return {
          id: cust.id,
          customer_code: customerCode,
          customer_name: cust.customer_name || "",
          payment_term_name: paymentTermName,
          payment_days: paymentDays,
          discount_config_count: totalDiscountConfigs,
          store_type: storeTypeId,
          classification: classificationId,
        };
      });

      // Filter: Show only customers with configurations (payment term OR at least one discount config)
      let filteredCustomers = mappedCustomers.filter((c: any) => {
        const hasTerm = c.payment_term_name !== "No Terms";
        const hasDiscount = c.discount_config_count > 0;
        return hasTerm || hasDiscount;
      });

      // Filter by store type if present
      if (storeTypeFilter) {
        const targetStoreType = Number(storeTypeFilter);
        filteredCustomers = filteredCustomers.filter((c: any) => c.store_type === targetStoreType);
      }

      // Filter by classification if present
      if (classificationFilter) {
        const targetClassification = Number(classificationFilter);
        filteredCustomers = filteredCustomers.filter((c: any) => c.classification === targetClassification);
      }

      // Filter by search query if present
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredCustomers = filteredCustomers.filter((c: any) =>
          c.customer_name.toLowerCase().includes(q)
        );
      }

      // Sort: Sort by specified key dynamically
      filteredCustomers.sort((a: any, b: any) => {
        let key = sortBy;
        if (key === "code") key = "customer_code";
        if (key === "name") key = "customer_name";
        if (key === "term") key = "payment_term_name";
        if (key === "configs") key = "discount_config_count";

        let valA = a[key];
        let valB = b[key];

        // Special case: sort terms by payment_days instead of alphabetical name
        if (key === "payment_term_name") {
          valA = a.payment_days;
          valB = b.payment_days;
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          const numA = valA != null ? Number(valA) : -999999;
          const numB = valB != null ? Number(valB) : -999999;
          return sortOrder === "asc" ? numA - numB : numB - numA;
        }
      });

      const total = filteredCustomers.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const paginatedCustomers = filteredCustomers.slice(offset, offset + limit);

      return NextResponse.json({
        customers: paginatedCustomers,
        storeTypes,
        classifications,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    }

    // Scenario 2: Fetch details & history for a specific customer ID
    const customerId = Number(idQuery);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
    }

    // 1. Fetch customer details
    const customerRes = await fetch(
      `${DIRECTUS_URL}/items/customer/${customerId}?fields=*,discount_type.*,payment_term.*`,
      { headers: getDirectusHeaders(), cache: "no-store" }
    );
    if (!customerRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch customer: ${customerRes.statusText}` },
        { status: customerRes.status }
      );
    }
    const customerData = (await customerRes.json()).data;
    if (!customerData) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const customerCode = customerData.customer_code;

    // 2. Fetch related profile/configuration items in parallel
    const bankParams = new URLSearchParams({
      "filter[customer_id][_eq]": String(customerId),
    });
    const salesmenParams = new URLSearchParams({
      "filter[customer_id][_eq]": String(customerId),
      fields: "*,salesman_id.*",
    });
    const supplierRulesParams = new URLSearchParams({
      "filter[customer_code][_eq]": String(customerCode),
      fields: "*,supplier_id.supplier_name,supplier_id.supplier_shortcut,category_id.category_name,discount_type.discount_type,discount_type.total_percent",
    });
    const productRulesParams = new URLSearchParams({
      "filter[customer_code][_eq]": String(customerCode),
      fields: "*,product_id.product_name,product_id.sku_code,discount_type.discount_type,discount_type.total_percent",
    });

    const [bankAccountsRes, salesmenRes, supplierRulesRes, productRulesRes, paymentTermsRes] = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/customer_bank_account?${bankParams.toString()}`, {
        headers: getDirectusHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`${DIRECTUS_URL}/items/customer_salesmen?${salesmenParams.toString()}`, {
        headers: getDirectusHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`${DIRECTUS_URL}/items/supplier_category_discount_per_customer?${supplierRulesParams.toString()}`, {
        headers: getDirectusHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`${DIRECTUS_URL}/items/product_per_customer?${productRulesParams.toString()}`, {
        headers: getDirectusHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`${DIRECTUS_URL}/items/payment_terms?limit=-1`, {
        headers: getDirectusHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { data: [] })),
    ]);

    // Resolve payment term details defensively
    let paymentTermObj = null;
    if (customerData.payment_term) {
      if (typeof customerData.payment_term === "object" && customerData.payment_term !== null) {
        paymentTermObj = customerData.payment_term;
      } else {
        const termId = Number(customerData.payment_term);
        const terms = paymentTermsRes.data || [];
        paymentTermObj = terms.find((t: any) => Number(t.id) === termId) || null;
      }
    }
    customerData.payment_term_detail = paymentTermObj;

    // 3. Fetch transaction history in parallel (Invoices, Returns, Memos, Unfulfilled transactions, payments, monitoring)
    const [salesInvoicesRes, salesReturnsRes, memosRes, unfulfilledRes, paymentsRes] = await Promise.all([
      fetch(
        `${DIRECTUS_URL}/items/sales_invoice?filter[customer_code][_eq]=${customerCode}&fields=*,salesman_id.salesman_name&limit=-1`,
        { headers: getDirectusHeaders(), cache: "no-store" }
      ).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      
      fetch(
        `${DIRECTUS_URL}/items/sales_return?filter[customer_code][_eq]=${customerCode}&fields=*,salesman_id.salesman_name&limit=-1`,
        { headers: getDirectusHeaders(), cache: "no-store" }
      ).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),

      fetch(
        `${DIRECTUS_URL}/items/customers_memo?filter[customer_id][_eq]=${customerId}&fields=*,supplier_id.supplier_name,salesman_id.salesman_name,chart_of_account.account_title&limit=-1`,
        { headers: getDirectusHeaders(), cache: "no-store" }
      ).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),

      fetch(
        `${DIRECTUS_URL}/items/unfulfilled_sales_transaction?filter[sales_invoice_id][customer_code][_eq]=${customerCode}&fields=*,sales_invoice_id.*,sales_invoice_id.salesman_id.salesman_name&limit=-1`,
        { headers: getDirectusHeaders(), cache: "no-store" }
      ).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),

      fetch(
        `${DIRECTUS_URL}/items/sales_invoice_payments?filter[invoice_id][customer_code][_eq]=${customerCode}&fields=*,invoice_id.invoice_no,collection_id.collection_receipt_no&limit=-1`,
        { headers: getDirectusHeaders(), cache: "no-store" }
      ).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]);

    // 4. Fetch accounts receivable invoices from Spring Boot for invoice overdue/days lapses details
    let arTransactions = [];
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (token && SPRING_API_BASE_URL) {
      const todayStr = new Date().toISOString().split("T")[0];
      const targetUrl = `${SPRING_API_BASE_URL}/api/view-account-receivable/all?startDate=2020-01-01&endDate=${todayStr}`;
      try {
        const springRes = await fetch(targetUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (springRes.ok) {
          const rawData = await springRes.json();
          const allInvoices = Array.isArray(rawData)
            ? rawData
            : (rawData.data ?? rawData.content ?? rawData.transactions ?? []);
          arTransactions = allInvoices.filter(
            (inv: { customerCode?: string; customer_code?: string }) =>
              (inv.customerCode || inv.customer_code) === customerCode
          );
        }
      } catch (err) {
        console.error("[Customer Billing BFF] Error fetching invoices from Spring Boot:", err);
      }
    }

    // Process lists
    const salesInvoices = salesInvoicesRes.data || [];
    const salesReturns = salesReturnsRes.data || [];
    const customerMemos = memosRes.data || [];
    const unfulfilledSales = unfulfilledRes.data || [];
    const payments = paymentsRes.data || [];

    return NextResponse.json({
      customer: customerData,
      bankAccounts: bankAccountsRes.data || [],
      salesmen: salesmenRes.data || [],
      supplierCategoryDiscounts: supplierRulesRes.data || [],
      productDiscounts: productRulesRes.data || [],
      salesInvoices,
      salesReturns,
      unfulfilledSales,
      customerMemos,
      payments,
      transactions: arTransactions, // aging info
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Customer Billing Summary BFF] Error:", msg);
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
