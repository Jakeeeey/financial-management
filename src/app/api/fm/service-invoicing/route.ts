import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";

interface DirectusMapping {
    id: number;
    parent_invoice_id: number;
    child_invoice_id: number;
    amount_applied: number;
}

interface DirectusSalesInvoice {
    invoice_id: number;
    invoice_no: string;
    invoice_date?: string;
    total_amount?: number;
    due_date?: string;
    dispatch_date?: string | null;
    customer_code?: string;
    salesman_id?: number;
    invoice_type?: number;
    gross_amount?: number;
    discount_amount?: number;
    net_amount?: number;
    transaction_status?: string;
    remarks?: string | null;
}

interface ConsolidatedHistoryResponse {
    invoice_id: number;
    invoice_no: string;
    invoice_date?: string;
    due_date?: string;
    dispatch_date: string | null;
    customer_code?: string;
    salesman_id?: number;
    invoice_type?: number;
    total_amount: number;
    gross_amount: number;
    discount_amount: number;
    net_amount: number;
    transaction_status?: string;
    remarks: string | null;
    children: Array<{
        mapping_id: number;
        child_invoice_id: number;
        child_invoice_no: string;
        child_total_amount: number;
        child_date: string | null;
        amount_applied: number;
    }>;
}

export const runtime = "nodejs";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders() {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
    if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
    };
}

export async function GET(request: NextRequest) {
    try {
        const headers = getHeaders();
        const { searchParams } = new URL(request.url);
        
        // 1. Debounced invoice number uniqueness pre-check
        const invoiceNo = searchParams.get("invoice_no");
        if (invoiceNo) {
            const checkUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_no][_eq]=${encodeURIComponent(invoiceNo)}&fields=invoice_id`;
            const checkRes = await fetch(checkUrl, { headers, cache: "no-store" });
            if (!checkRes.ok) throw new Error(`Directus uniqueness query failed: ${checkRes.statusText}`);
            const checkData = await checkRes.json();
            const exists = Array.isArray(checkData.data) && checkData.data.length > 0;
            return NextResponse.json({ exists });
        }

        // 2. Fetch unlinked invoices for the selected customer
        const customerCode = searchParams.get("customer_code");
        if (customerCode) {
            // Fetch child_invoice_id values already linked in mappings
            const mappingUrl = `${DIRECTUS_URL}/items/service_invoice_mapping?limit=-1&fields=child_invoice_id`;
            const mappingRes = await fetch(mappingUrl, { headers, cache: "no-store" });
            if (!mappingRes.ok) throw new Error(`Directus mapping query failed: ${mappingRes.statusText}`);
            const mappingData = await mappingRes.json();
            
            const linkedChildIds = new Set<number>(
                (mappingData.data || []).map((m: DirectusMapping) => Number(m.child_invoice_id)).filter(Boolean)
            );

            // Fetch sales invoices matching this customer code
            const invoicesUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=-1&fields=invoice_id,invoice_no,total_amount,invoice_date,transaction_status,dispatch_date`;
            const invoicesRes = await fetch(invoicesUrl, { headers, cache: "no-store" });
            if (!invoicesRes.ok) throw new Error(`Directus invoices query failed: ${invoicesRes.statusText}`);
            const invoicesData = await invoicesRes.json();

            // Filter out invoices that are already linked
            const unlinkedInvoices = (invoicesData.data || []).filter((inv: DirectusSalesInvoice) => {
                return !linkedChildIds.has(Number(inv.invoice_id));
            });

            return NextResponse.json(unlinkedInvoices);
        }

        // 3. Fetch linked invoices history / report
        const history = searchParams.get("history");
        if (history === "true") {
            const mappingUrl = `${DIRECTUS_URL}/items/service_invoice_mapping?limit=-1&fields=id,parent_invoice_id,child_invoice_id,amount_applied`;
            const mappingRes = await fetch(mappingUrl, { headers, cache: "no-store" });
            if (!mappingRes.ok) throw new Error(`Directus mapping query failed: ${mappingRes.statusText}`);
            const mappingData = await mappingRes.json();
            const mappingsList = mappingData.data || [];

            if (mappingsList.length === 0) {
                return NextResponse.json([]);
            }

            const parentIds = Array.from(new Set(mappingsList.map((m: DirectusMapping) => Number(m.parent_invoice_id)).filter(Boolean)));
            const childIds = Array.from(new Set(mappingsList.map((m: DirectusMapping) => Number(m.child_invoice_id)).filter(Boolean)));
            const allInvoiceIds = Array.from(new Set([...parentIds, ...childIds])) as number[];

            if (allInvoiceIds.length === 0) {
                return NextResponse.json([]);
            }

            const chunkArray = (arr: number[], size: number) => {
                const chunks = [];
                for (let i = 0; i < arr.length; i += size) {
                    chunks.push(arr.slice(i, i + size));
                }
                return chunks;
            };

            const idChunks = chunkArray(allInvoiceIds, 80);
            let allInvoicesList: DirectusSalesInvoice[] = [];

            for (const chunk of idChunks) {
                const filterString = `filter[invoice_id][_in]=${chunk.join(",")}`;
                const invoicesUrl = `${DIRECTUS_URL}/items/sales_invoice?limit=-1&${filterString}&fields=invoice_id,invoice_no,customer_code,salesman_id,invoice_type,total_amount,due_date,dispatch_date,gross_amount,discount_amount,net_amount,transaction_status,remarks`;
                const res = await fetch(invoicesUrl, { headers, cache: "no-store" });
                if (!res.ok) throw new Error(`Invoices details query failed: ${res.statusText}`);
                const data = await res.json();
                allInvoicesList = allInvoicesList.concat(data.data || []);
            }

            const invoicesMap = new Map<number, DirectusSalesInvoice>();
            allInvoicesList.forEach((inv: DirectusSalesInvoice) => {
                invoicesMap.set(Number(inv.invoice_id), inv);
            });

            const parentGroups: Record<number, DirectusMapping[]> = {};
            mappingsList.forEach((m: DirectusMapping) => {
                const pId = Number(m.parent_invoice_id);
                if (!parentGroups[pId]) {
                    parentGroups[pId] = [];
                }
                parentGroups[pId].push(m);
            });

            const result: ConsolidatedHistoryResponse[] = [];
            Object.entries(parentGroups).forEach(([parentStrId, maps]) => {
                const parentId = Number(parentStrId);
                const parentInv = invoicesMap.get(parentId);
                if (!parentInv) return;

                const childMappings = maps.map((m: DirectusMapping) => {
                    const childId = Number(m.child_invoice_id);
                    const childInv = invoicesMap.get(childId);
                    return {
                        mapping_id: m.id,
                        child_invoice_id: childId,
                        child_invoice_no: childInv ? childInv.invoice_no : `ID: ${childId} (Deleted/Missing)`,
                        child_total_amount: childInv ? Number(childInv.total_amount) : 0,
                        child_date: childInv ? (childInv.invoice_date ?? null) : null,
                        amount_applied: Number(m.amount_applied || 0)
                    };
                });

                result.push({
                    invoice_id: parentId,
                    invoice_no: parentInv.invoice_no,
                    invoice_date: parentInv.invoice_date,
                    due_date: parentInv.due_date,
                    dispatch_date: parentInv.dispatch_date || null,
                    customer_code: parentInv.customer_code,
                    salesman_id: parentInv.salesman_id,
                    invoice_type: parentInv.invoice_type,
                    total_amount: Number(parentInv.total_amount || 0),
                    gross_amount: Number(parentInv.gross_amount || 0),
                    discount_amount: Number(parentInv.discount_amount || 0),
                    net_amount: Number(parentInv.net_amount || 0),
                    transaction_status: parentInv.transaction_status,
                    remarks: parentInv.remarks || null,
                    children: childMappings
                });
            });

            result.sort((a, b) => {
                const dateA = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
                const dateB = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
                return dateB - dateA;
            });

            return NextResponse.json(result);
        }

        return NextResponse.json({ error: "Missing customer_code, invoice_no, or history parameter" }, { status: 400 });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("GET service-invoicing error:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let parentInvoiceId: number | null = null;
    const headers = getHeaders();
    try {
        const payload = await request.json();
        const {
            invoice_no,
            customer_code,
            salesman_id,
            invoice_type,
            invoice_date,
            due_date,
            dispatch_date,
            gross_amount,
            discount_amount,
            net_amount,
            sales_type,
            price_type,
            payment_terms,
            remarks,
            mappings
        } = payload;

        if (!invoice_no || !customer_code || !salesman_id || !invoice_type || !Array.isArray(mappings) || mappings.length === 0) {
            return NextResponse.json({ error: "Missing required fields or empty mappings array." }, { status: 400 });
        }

        // Auth check for created_by
        const cookieStore = await cookies();
        const tokenVal = cookieStore.get(COOKIE_NAME)?.value;
        const decoded = tokenVal ? decodeJwtPayload(tokenVal) : null;
        const userIdVal = decoded ? (decoded.userId || decoded.id || decoded.sub) : null;
        const createdBy = userIdVal ? Number(userIdVal) : 1;

        // 1. Double check uniqueness at save time (Uniqueness Check)
        const checkUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_no][_eq]=${encodeURIComponent(invoice_no)}&fields=invoice_id`;
        const checkRes = await fetch(checkUrl, { headers, cache: "no-store" });
        if (!checkRes.ok) throw new Error(`Directus uniqueness query failed: ${checkRes.statusText}`);
        const checkData = await checkRes.json();
        if (Array.isArray(checkData.data) && checkData.data.length > 0) {
            return NextResponse.json({ error: "Invoice number already exists." }, { status: 409 });
        }

        // Fetch salesman code to construct order_id
        const salesmanDetailsUrl = `${DIRECTUS_URL}/items/salesman/${salesman_id}?fields=salesman_code`;
        const salesmanRes = await fetch(salesmanDetailsUrl, { headers, cache: "no-store" });
        let salesmanCode = "UNKNOWN";
        if (salesmanRes.ok) {
            const smData = await salesmanRes.json();
            if (smData.data && smData.data.salesman_code) {
                salesmanCode = smData.data.salesman_code;
            }
        }
        const orderId = `${salesmanCode}-${Date.now()}`;

        // Calculate total amount based on mappings if net_amount is not passed
        const calculatedTotal = mappings.reduce((sum: number, m: { child_invoice_id: number; amount_applied: number }) => sum + Number(m.amount_applied || 0), 0);
        const finalNetAmount = typeof net_amount === "number" ? net_amount : calculatedTotal;
        const finalGrossAmount = typeof gross_amount === "number" ? gross_amount : calculatedTotal;
        const finalDiscountAmount = typeof discount_amount === "number" ? discount_amount : 0;

        // 3. Create Parent Sales Invoice in Directus
        const parentInvoicePayload = {
            invoice_no,
            customer_code,
            salesman_id: Number(salesman_id),
            invoice_type: Number(invoice_type),
            total_amount: finalNetAmount,
            gross_amount: finalGrossAmount,
            discount_amount: finalDiscountAmount,
            net_amount: finalNetAmount,
            invoice_date: invoice_date || new Date().toISOString(),
            due_date: due_date || new Date().toISOString(),
            dispatch_date: dispatch_date || null,
            transaction_status: "Serviced",
            payment_status: "Unpaid",
            sales_type: sales_type ? Number(sales_type) : 0,
            price_type: price_type || "",
            payment_terms: payment_terms ? Number(payment_terms) : 0,
            remarks: remarks || null,
            order_id: orderId,
            created_by: createdBy,
            modified_by: createdBy
        };

        const createParentUrl = `${DIRECTUS_URL}/items/sales_invoice`;
        const createParentRes = await fetch(createParentUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(parentInvoicePayload)
        });

        if (!createParentRes.ok) {
            const errData = await createParentRes.json().catch(() => ({}));
            throw new Error(errData.errors?.[0]?.message || `Failed to create parent sales invoice: ${createParentRes.statusText}`);
        }

        const parentInvoiceData = await createParentRes.json();
        parentInvoiceId = Number(parentInvoiceData.data.invoice_id);

        if (!parentInvoiceId) {
            throw new Error("Parent invoice created but ID was not returned.");
        }

        // 4. Create Mappings in bulk in Directus
        const mappingsPayload = mappings.map((m: { child_invoice_id: number; amount_applied: number }) => ({
            parent_invoice_id: parentInvoiceId,
            child_invoice_id: Number(m.child_invoice_id),
            amount_applied: Number(m.amount_applied),
            created_by: createdBy
        }));

        const createMappingsUrl = `${DIRECTUS_URL}/items/service_invoice_mapping`;
        const createMappingsRes = await fetch(createMappingsUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(mappingsPayload)
        });

        if (!createMappingsRes.ok) {
            const errData = await createMappingsRes.json().catch(() => ({}));
            throw new Error(errData.errors?.[0]?.message || `Failed to create mappings: ${createMappingsRes.statusText}`);
        }

        const mappingsResult = await createMappingsRes.json();

        return NextResponse.json({
            success: true,
            parent_invoice_id: parentInvoiceId,
            mappings: mappingsResult.data
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("POST service-invoicing error:", err);

        // 5. Rollback: Delete the orphaned parent invoice if it was created but mappings failed
        if (parentInvoiceId) {
            try {
                console.log(`Rolling back parent invoice ID: ${parentInvoiceId}`);
                const deleteUrl = `${DIRECTUS_URL}/items/sales_invoice/${parentInvoiceId}`;
                await fetch(deleteUrl, {
                    method: "DELETE",
                    headers
                });
            } catch (rollbackError) {
                console.error("Rollback failed for parent invoice:", rollbackError);
            }
        }

        return NextResponse.json({ error: err.message || "Failed to process service invoice consolidation." }, { status: 500 });
    }
}
