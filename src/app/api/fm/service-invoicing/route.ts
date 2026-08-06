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
    invoice_date?: string | null;
    created_date?: string;
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
    branch_id?: number | string | { id?: number | string | null } | null;
}

interface ConsolidatedHistoryResponse {
    invoice_id: number;
    invoice_no: string;
    invoice_date: string | null;
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

class DirectusRequestError extends Error {
    constructor(
        public readonly operation: string,
        public readonly upstreamStatus: number,
        statusText: string,
        public readonly details = "",
    ) {
        super(`${operation}: ${details || statusText || `HTTP ${upstreamStatus}`}`);
        this.name = "DirectusRequestError";
    }
}

function getHeaders() {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
    if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
    };
}

function sanitizeDirectusErrorBody(body: string): string {
    const compact = body.replace(/[\r\n]+/g, " ").trim();
    if (!compact) return "";

    try {
        const parsed = JSON.parse(compact) as { errors?: unknown };
        if (Array.isArray(parsed.errors)) {
            return JSON.stringify({
                errors: parsed.errors.map((error) => {
                    if (typeof error === "string") return error;
                    if (typeof error !== "object" || error === null) return "Unknown Directus error";

                    const record = error as Record<string, unknown>;
                    return {
                        code: typeof record.code === "string" ? record.code : undefined,
                        message: typeof record.message === "string" ? record.message : undefined,
                    };
                }),
            });
        }
    } catch {
        // Keep a bounded text fallback for non-JSON Directus responses.
    }

    return compact.slice(0, 500);
}

function normalizeRelationId(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "object") {
        if (value === null || !("id" in value)) return null;
        return normalizeRelationId((value as { id?: unknown }).id);
    }

    if (typeof value !== "number" && typeof value !== "string") return null;

    const numericValue = Number(value);
    return Number.isSafeInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

async function assertDirectusOk(response: Response, operation: string): Promise<void> {
    if (response.ok) return;

    const body = await response.text().catch(() => "");
    const details = sanitizeDirectusErrorBody(body);
    console.error("Service invoicing Directus request failed", {
        operation,
        status: response.status,
        statusText: response.statusText,
        body: details,
    });

    throw new DirectusRequestError(operation, response.status, response.statusText, details);
}

function directusErrorResponse(error: unknown, fallbackMessage: string) {
    if (error instanceof DirectusRequestError) {
        if (error.upstreamStatus === 401 || error.upstreamStatus === 403) {
            return NextResponse.json(
                {
                    error: "Service invoicing data is unavailable because the configured Directus role lacks the required permissions. Verify access to the service invoice mapping and related collections, then retry.",
                },
                { status: 502 },
            );
        }

        if (error.upstreamStatus >= 500) {
            return NextResponse.json(
                { error: "The Directus service is temporarily unavailable. Please retry the service invoicing request." },
                { status: 502 },
            );
        }

        if (error.upstreamStatus >= 400 && error.upstreamStatus < 500) {
            return NextResponse.json(
                {
                    error: error.message,
                    upstream_status: error.upstreamStatus,
                },
                { status: error.upstreamStatus },
            );
        }
    }

    const message = error instanceof Error ? error.message : fallbackMessage;
    return NextResponse.json({ error: message || fallbackMessage }, { status: 500 });
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
            await assertDirectusOk(checkRes, "Directus uniqueness query failed");
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
            await assertDirectusOk(mappingRes, "Directus mapping query failed");
            const mappingData = await mappingRes.json();
            
            const linkedChildIds = new Set<number>(
                (mappingData.data || []).map((m: DirectusMapping) => Number(m.child_invoice_id)).filter(Boolean)
            );

            // Fetch sales invoices matching this customer code
            const invoicesUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=-1&fields=invoice_id,invoice_no,total_amount,invoice_date,transaction_status,dispatch_date`;
            const invoicesRes = await fetch(invoicesUrl, { headers, cache: "no-store" });
            await assertDirectusOk(invoicesRes, "Directus invoices query failed");
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
            await assertDirectusOk(mappingRes, "Directus mapping query failed");
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
                const invoicesUrl = `${DIRECTUS_URL}/items/sales_invoice?limit=-1&${filterString}&fields=invoice_id,invoice_no,customer_code,salesman_id,invoice_type,total_amount,invoice_date,created_date,due_date,dispatch_date,gross_amount,discount_amount,net_amount,transaction_status,remarks`;
                const res = await fetch(invoicesUrl, { headers, cache: "no-store" });
                await assertDirectusOk(res, "Invoices details query failed");
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
            const parentCreatedDates = new Map<number, string | undefined>();
            Object.entries(parentGroups).forEach(([parentStrId, maps]) => {
                const parentId = Number(parentStrId);
                const parentInv = invoicesMap.get(parentId);
                if (!parentInv) return;

                parentCreatedDates.set(parentId, parentInv.created_date);

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
                    invoice_date: parentInv.invoice_date ?? null,
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
                const dateAValue = parentCreatedDates.get(a.invoice_id) || a.invoice_date;
                const dateBValue = parentCreatedDates.get(b.invoice_id) || b.invoice_date;
                const dateA = dateAValue ? new Date(dateAValue).getTime() : 0;
                const dateB = dateBValue ? new Date(dateBValue).getTime() : 0;
                return dateB - dateA || b.invoice_id - a.invoice_id;
            });

            return NextResponse.json(result);
        }

        return NextResponse.json({ error: "Missing customer_code, invoice_no, or history parameter" }, { status: 400 });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("GET service-invoicing error:", err);
        return directusErrorResponse(err, "Failed to load service invoicing data.");
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

        const normalizedInvoiceNo = String(invoice_no).trim();
        const normalizedCustomerCode = String(customer_code).trim();
        const mappingsAreValid = (mappings as unknown[]).every((mapping) => {
            if (!mapping || typeof mapping !== "object") return false;

            const record = mapping as Record<string, unknown>;
            const childInvoiceId = Number(record.child_invoice_id);
            const amountApplied = Number(record.amount_applied);
            return Number.isSafeInteger(childInvoiceId)
                && childInvoiceId > 0
                && Number.isFinite(amountApplied)
                && amountApplied >= 0;
        });

        if (!mappingsAreValid) {
            return NextResponse.json({ error: "Mappings contain an invalid child invoice or amount." }, { status: 400 });
        }

        const normalizedMappings = (mappings as Array<Record<string, unknown>>).map((mapping) => ({
            child_invoice_id: Number(mapping.child_invoice_id),
            amount_applied: Number(mapping.amount_applied),
        }));

        // Auth check for created_by
        const cookieStore = await cookies();
        const tokenVal = cookieStore.get(COOKIE_NAME)?.value;
        const decoded = tokenVal ? decodeJwtPayload(tokenVal) : null;
        const userIdVal = decoded ? (decoded.userId || decoded.id || decoded.sub) : null;
        const createdBy = userIdVal ? Number(userIdVal) : 1;

        // 1. Double check uniqueness at save time (Uniqueness Check)
        const checkUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_no][_eq]=${encodeURIComponent(normalizedInvoiceNo)}&fields=invoice_id`;
        const checkRes = await fetch(checkUrl, { headers, cache: "no-store" });
        await assertDirectusOk(checkRes, "Directus uniqueness query failed");
        const checkData = await checkRes.json();
        if (Array.isArray(checkData.data) && checkData.data.length > 0) {
            return NextResponse.json({ error: "Invoice number already exists." }, { status: 409 });
        }

        // Resolve the customer payment-term relation from the authoritative customer record.
        const customerUrl = `${DIRECTUS_URL}/items/customer?limit=1&filter[customer_code][_eq]=${encodeURIComponent(normalizedCustomerCode)}&fields=customer_code,payment_term`;
        const customerRes = await fetch(customerUrl, { headers, cache: "no-store" });
        await assertDirectusOk(customerRes, "Failed to resolve customer payment term");
        const customerData = await customerRes.json();
        const customerRecord = Array.isArray(customerData.data) ? customerData.data[0] : null;

        if (!customerRecord) {
            return NextResponse.json({ error: `Customer ${normalizedCustomerCode} was not found.` }, { status: 400 });
        }

        const rawPaymentTerm = (customerRecord as { payment_term?: unknown }).payment_term;
        const paymentTermId = normalizeRelationId(rawPaymentTerm);
        if (rawPaymentTerm !== null && rawPaymentTerm !== undefined && rawPaymentTerm !== "" && paymentTermId === null) {
            return NextResponse.json({ error: `Customer ${normalizedCustomerCode} has an invalid payment term.` }, { status: 400 });
        }

        // Verify that the selected child invoices still exist, belong to the selected customer,
        // and have a compatible branch before creating the parent invoice.
        const childInvoiceIds = Array.from(new Set(normalizedMappings.map((mapping) => mapping.child_invoice_id)));
        const childInvoicesUrl = `${DIRECTUS_URL}/items/sales_invoice?limit=-1&filter[invoice_id][_in]=${encodeURIComponent(childInvoiceIds.join(","))}&fields=invoice_id,customer_code,branch_id`;
        const childInvoicesRes = await fetch(childInvoicesUrl, { headers, cache: "no-store" });
        await assertDirectusOk(childInvoicesRes, "Failed to validate selected child invoices");
        const childInvoicesData = await childInvoicesRes.json();
        const childInvoicesById = new Map<number, { customer_code?: unknown; branch_id?: unknown }>();

        for (const childInvoice of Array.isArray(childInvoicesData.data) ? childInvoicesData.data : []) {
            const record = childInvoice as {
                invoice_id?: unknown;
                customer_code?: unknown;
                branch_id?: unknown;
            };
            const childInvoiceId = normalizeRelationId(record.invoice_id);
            if (childInvoiceId !== null) {
                childInvoicesById.set(childInvoiceId, record);
            }
        }

        if (childInvoicesById.size !== childInvoiceIds.length) {
            return NextResponse.json({ error: "One or more selected child invoices no longer exist." }, { status: 400 });
        }

        const hasCustomerMismatch = childInvoiceIds.some((childInvoiceId) => {
            const childInvoice = childInvoicesById.get(childInvoiceId);
            return String(childInvoice?.customer_code ?? "").trim() !== normalizedCustomerCode;
        });
        if (hasCustomerMismatch) {
            return NextResponse.json({ error: "All selected child invoices must belong to the selected customer." }, { status: 400 });
        }

        const branchIds = childInvoiceIds.map((childInvoiceId) =>
            normalizeRelationId(childInvoicesById.get(childInvoiceId)?.branch_id)
        );
        const distinctBranchIds = Array.from(new Set(branchIds.filter((branchId): branchId is number => branchId !== null)));
        const hasMixedBranchValues = branchIds.some((branchId) => branchId === null) && distinctBranchIds.length > 0;
        if (distinctBranchIds.length > 1 || hasMixedBranchValues) {
            return NextResponse.json({ error: "All selected child invoices must belong to the same branch." }, { status: 400 });
        }
        const branchId = distinctBranchIds[0] ?? null;

        // Fetch salesman details to construct order_id and preserve relational values.
        const salesmanDetailsUrl = `${DIRECTUS_URL}/items/salesman/${salesman_id}?fields=salesman_code,operation,price_type`;
        const salesmanRes = await fetch(salesmanDetailsUrl, { headers, cache: "no-store" });
        await assertDirectusOk(salesmanRes, "Failed to resolve salesman");
        const smData = await salesmanRes.json();
        if (!smData.data) {
            return NextResponse.json({ error: `Salesman ${salesman_id} was not found.` }, { status: 400 });
        }

        const salesmanCode = smData.data.salesman_code || "UNKNOWN";
        const salesmanOperationId = normalizeRelationId(smData.data.operation);
        const salesmanPriceType = typeof smData.data.price_type === "string" && smData.data.price_type.trim()
            ? smData.data.price_type.trim()
            : null;
        const orderId = `${salesmanCode}${Date.now()}`;

        // Calculate total amount based on mappings if net_amount is not passed
        const calculatedTotal = normalizedMappings.reduce((sum, mapping) => sum + mapping.amount_applied, 0);
        const finalNetAmount = typeof net_amount === "number" ? net_amount : calculatedTotal;
        const finalGrossAmount = typeof gross_amount === "number" ? gross_amount : calculatedTotal;
        const finalDiscountAmount = typeof discount_amount === "number" ? discount_amount : 0;
        const now = new Date().toISOString();

        // Resolve payment_terms FK ID
        const resolvedPaymentTerms: number | null = (payment_terms && Number(payment_terms) !== 0 ? Number(payment_terms) : null) ?? paymentTermId;

        // 3. Create Parent Sales Invoice in Directus
        const parentInvoicePayload = {
            invoice_no: normalizedInvoiceNo,
            customer_code: normalizedCustomerCode,
            created_date: now,
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
            sales_type: sales_type && Number(sales_type) !== 0 ? Number(sales_type) : (salesmanOperationId ?? null),
            price_type: price_type || salesmanPriceType || "",
            payment_terms: resolvedPaymentTerms,
            remarks: remarks || null,
            order_id: orderId,
            created_by: createdBy,
            modified_by: createdBy,
            modified_date: now,
            ...(branchId !== null ? { branch_id: branchId } : {}),
        };

        const createParentUrl = `${DIRECTUS_URL}/items/sales_invoice`;
        const createParentRes = await fetch(createParentUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(parentInvoicePayload)
        });

        await assertDirectusOk(createParentRes, "Failed to create parent sales invoice");

        const parentInvoiceData = await createParentRes.json();
        parentInvoiceId = Number(parentInvoiceData.data.invoice_id);

        if (!parentInvoiceId) {
            throw new Error("Parent invoice created but ID was not returned.");
        }

        // 4. Create Mappings in bulk in Directus
        const mappingsPayload = normalizedMappings.map((mapping) => ({
            parent_invoice_id: parentInvoiceId,
            child_invoice_id: mapping.child_invoice_id,
            amount_applied: mapping.amount_applied,
            created_by: createdBy
        }));

        const createMappingsUrl = `${DIRECTUS_URL}/items/service_invoice_mapping`;
        const createMappingsRes = await fetch(createMappingsUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(mappingsPayload)
        });

        await assertDirectusOk(createMappingsRes, "Failed to create mappings");

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

        return directusErrorResponse(err, "Failed to process service invoice consolidation.");
    }
}
