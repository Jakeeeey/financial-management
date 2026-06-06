import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders()  {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
    if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
    };
}

export async function GET() {
    try {
        const headers = getHeaders();

        // 1. Fetch salesmen
        const salesmenUrl = `${DIRECTUS_URL}/items/salesman?limit=-1&sort=salesman_name&filter[isActive][_eq]=1&fields=id,salesman_code,salesman_name,operation.id,operation.operation_name,price_type`;
        // 2. Fetch customers (querying raw payment_term ID field)
        const customersUrl = `${DIRECTUS_URL}/items/customer?limit=-1&sort=customer_name&filter[isActive][_eq]=1&fields=id,customer_code,customer_name,payment_term`;
        // 3. Fetch invoice types
        const typesUrl = `${DIRECTUS_URL}/items/sales_invoice_type?limit=-1&sort=type&fields=id,type,isOfficial`;
        // 4. Fetch customer-salesmen mappings
        const customerSalesmenUrl = `${DIRECTUS_URL}/items/customer_salesmen?limit=-1&fields=customer_id,salesman_id`;
        // 5. Fetch payment terms
        const paymentTermsUrl = `${DIRECTUS_URL}/items/payment_terms?limit=-1&fields=id,payment_name,payment_days`;
 
        const [salesmenRes, customersRes, typesRes, customerSalesmenRes, paymentTermsRes] = await Promise.all([
            fetch(salesmenUrl, { headers, cache: "no-store" }),
            fetch(customersUrl, { headers, cache: "no-store" }),
            fetch(typesUrl, { headers, cache: "no-store" }),
            fetch(customerSalesmenUrl, { headers, cache: "no-store" }),
            fetch(paymentTermsUrl, { headers, cache: "no-store" })
        ]);
 
        if (!salesmenRes.ok) throw new Error(`Salesmen query failed: ${salesmenRes.statusText}`);
        if (!customersRes.ok) throw new Error(`Customers query failed: ${customersRes.statusText}`);
        if (!typesRes.ok) throw new Error(`Invoice types query failed: ${typesRes.statusText}`);
        if (!customerSalesmenRes.ok) throw new Error(`Customer-salesmen mapping query failed: ${customerSalesmenRes.statusText}`);
        if (!paymentTermsRes.ok) throw new Error(`Payment terms query failed: ${paymentTermsRes.statusText}`);
 
        const [salesmenData, customersData, typesData, customerSalesmenData, paymentTermsData] = await Promise.all([
            salesmenRes.json(),
            customersRes.json(),
            typesRes.json(),
            customerSalesmenRes.json(),
            paymentTermsRes.json()
        ]);
 
        interface RawPaymentTerm {
            id: number | string;
            payment_name?: string | null;
            payment_days?: number | string | null;
        }

        interface RawCustomer {
            id: number;
            customer_code: string;
            customer_name: string;
            payment_term?: number | string | null;
        }

        const termsMap = new Map<number, { id: number; payment_name: string; payment_days: number }>(
            (paymentTermsData.data || []).map((t: RawPaymentTerm) => [
                Number(t.id),
                {
                    id: Number(t.id),
                    payment_name: t.payment_name || "N/A",
                    payment_days: t.payment_days != null ? Number(t.payment_days) : 0
                }
            ])
        );
 
        const rawCustomers: RawCustomer[] = customersData.data || [];
        const mappedCustomers = rawCustomers.map((cust: RawCustomer) => {
            const termId = cust.payment_term != null ? Number(cust.payment_term) : null;
            const termObj = termId != null ? termsMap.get(termId) : null;
            return {
                ...cust,
                payment_term: termObj || null
            };
        });

        return NextResponse.json({
            salesmen: salesmenData.data || [],
            customers: mappedCustomers,
            invoiceTypes: typesData.data || [],
            customerSalesmen: customerSalesmenData.data || []
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("GET service-invoicing metadata error:", err);
        return NextResponse.json({ error: err.message || "Failed to fetch metadata" }, { status: 500 });
    }
}
