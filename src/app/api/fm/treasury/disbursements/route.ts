import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload } from "@/lib/auth-utils";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export function cleanSupportingDocsUrl(urlOrUuid: string | null | undefined): string | null {
    if (!urlOrUuid) return null;
    const trimmed = urlOrUuid.trim();
    if (trimmed.includes("/")) {
        const lastPart = trimmed.split("/").pop();
        if (lastPart) {
            return lastPart.split("?")[0];
        }
    }
    return trimmed;
}

type DirectusList<T> = {
    data?: T[];
    meta?: {
        filter_count?: number;
    };
};

type RelationValue = number | string | null | {
    id?: unknown;
    division_id?: unknown;
    department_id?: unknown;
    coa_id?: unknown;
    supplier_name?: unknown;
    division_name?: unknown;
    department_name?: unknown;
    account_title?: unknown;
};

export type DisbursementRow = {
    id?: unknown;
    doc_no?: unknown;
    transaction_type?: unknown;
    payee?: RelationValue;
    remarks?: unknown;
    total_amount?: unknown;
    paid_amount?: unknown;
    encoder_id?: unknown;
    approver_id?: unknown;
    posted_by?: unknown;
    isPosted?: unknown;
    transaction_date?: unknown;
    date_created?: unknown;
    date_approved?: unknown;
    date_posted?: unknown;
    division_id?: RelationValue;
    department_id?: RelationValue;
    status?: unknown;
    supporting_documents_url?: unknown;
};

export type PayableRow = {
    id?: unknown;
    disbursement_id?: unknown;
    division_id?: RelationValue;
    reference_no?: unknown;
    date?: unknown;
    coa_id?: RelationValue;
    amount?: unknown;
    remarks?: unknown;
};

export type PaymentRow = {
    id?: unknown;
    disbursement_id?: unknown;
    coa_id?: RelationValue;
    bank_id?: unknown;
    check_no?: unknown;
    date?: unknown;
    amount?: unknown;
    remarks?: unknown;
};

type SupplierRow = {
    id?: unknown;
};

interface DirectusSupplierResponse {
    data?: {
        supplier_type?: string;
    };
}

interface DirectusDisbursementNo {
    id: number;
    trade_no?: number;
    "non-trade_no"?: number;
    [key: string]: unknown;
}

export interface PayableInput {
    referenceNo?: string;
    date?: string;
    coaId?: number;
    amount?: number;
    remarks?: string;
}

export interface PaymentInput {
    coaId?: number;
    bankId?: number;
    checkNo?: string;
    date?: string;
    amount?: number;
    remarks?: string;
}

function asString(value: unknown) {
    return value == null ? "" : String(value);
}

function asNumber(value: unknown) {
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function relationId(
    value: RelationValue | undefined,
    key: "id" | "division_id" | "department_id" | "coa_id" = "id",
) {
    if (value == null || typeof value !== "object") return asNumber(value);
    return asNumber(value[key] ?? value.id);
}

function relationLabel(
    value: RelationValue | undefined,
    key: "supplier_name" | "division_name" | "department_name" | "account_title",
) {
    if (value == null || typeof value !== "object") return "";
    return asString(value[key]);
}

function roundMoney(value: number) {
    return Math.round(value * 100) / 100;
}

async function directusFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
    if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

    const res = await fetch(`${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<T>;
}

function transactionTypeName(type: unknown) {
    return asNumber(type) === 2 ? "Non-Trade" : "Trade";
}

function normalizePage(value: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeSize(value: string | null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 20;
    return Math.min(100, Math.floor(parsed));
}

function appendFilter(
    params: URLSearchParams,
    index: number,
    field: string,
    operator: string,
    value: string,
) {
    params.set(`filter[_and][${index}][${field}][${operator}]`, value);
    return index + 1;
}

async function getSupplierIds(search: string) {
    if (!search) return [];

    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("fields", "id");
    params.set("filter[supplier_name][_contains]", search);

    const res = await directusFetch<DirectusList<SupplierRow>>(
        `/items/suppliers?${params.toString()}`,
    );

    return (res.data ?? [])
        .map((supplier) => asNumber(supplier.id))
        .filter((id): id is number => Boolean(id));
}

function buildDisbursementParams(
    searchParams: URLSearchParams,
    supplierIds: number[],
) {
    const page = normalizePage(searchParams.get("page"));
    const size = normalizeSize(searchParams.get("size"));
    const type = searchParams.get("type") || "All";
    const status = searchParams.get("status") || "All";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const divisionId = searchParams.get("divisionId") || "";
    const departmentId = searchParams.get("departmentId") || "";
    const docNo = searchParams.get("docNo") || "";
    const params = new URLSearchParams();
    let filterIndex = 0;

    params.set("limit", String(size));
    params.set("offset", String(page * size));
    params.set("meta", "filter_count");
    params.set("sort", "-date_updated,-date_created,-id");
    params.set(
        "fields",
        [
            "id",
            "doc_no",
            "transaction_type",
            "payee.id",
            "payee.supplier_name",
            "remarks",
            "total_amount",
            "paid_amount",
            "encoder_id",
            "approver_id",
            "posted_by",
            "isPosted",
            "transaction_date",
            "date_created",
            "date_approved",
            "date_posted",
            "division_id.division_id",
            "division_id.division_name",
            "department_id.department_id",
            "department_id.department_name",
            "supporting_documents_url",
            "status",
        ].join(","),
    );

    if (type === "Trade") {
        filterIndex = appendFilter(params, filterIndex, "transaction_type", "_eq", "1");
    } else if (type === "Non-Trade") {
        filterIndex = appendFilter(params, filterIndex, "transaction_type", "_eq", "2");
    }
    if (status && status !== "All") {
        filterIndex = appendFilter(params, filterIndex, "status", "_eq", status);
    }
    if (supplierIds.length > 0) {
        filterIndex = appendFilter(params, filterIndex, "payee", "_in", supplierIds.join(","));
    }
    if (startDate) {
        filterIndex = appendFilter(params, filterIndex, "transaction_date", "_gte", startDate);
    }
    if (endDate) {
        filterIndex = appendFilter(params, filterIndex, "transaction_date", "_lte", endDate);
    }
    if (divisionId) {
        filterIndex = appendFilter(params, filterIndex, "division_id", "_eq", divisionId);
    }
    if (departmentId) {
        filterIndex = appendFilter(params, filterIndex, "department_id", "_eq", departmentId);
    }
    if (docNo) {
        appendFilter(params, filterIndex, "doc_no", "_contains", docNo);
    }

    return { page, size, params };
}

function groupByDisbursementId<T extends { disbursement_id?: unknown }>(rows: T[]) {
    const map = new Map<number, T[]>();
    rows.forEach((row) => {
        const id = asNumber(row.disbursement_id);
        if (!id) return;
        map.set(id, [...(map.get(id) ?? []), row]);
    });
    return map;
}

export async function getLineItems(disbursementIds: number[]) {
    const ids = disbursementIds.filter(Boolean);
    if (ids.length === 0) {
        return {
            payables: new Map<number, PayableRow[]>(),
            payments: new Map<number, PaymentRow[]>(),
        };
    }

    const payableParams = new URLSearchParams();
    payableParams.set("limit", "-1");
    payableParams.set(
        "fields",
        "id,disbursement_id,division_id.division_id,division_id.division_name,reference_no,date,coa_id,coa_id.coa_id,coa_id.account_title,amount,remarks",
    );
    payableParams.set("filter[disbursement_id][_in]", ids.join(","));

    const paymentParams = new URLSearchParams();
    paymentParams.set("limit", "-1");
    paymentParams.set(
        "fields",
        "id,disbursement_id,coa_id,coa_id.coa_id,coa_id.account_title,bank_id,check_no,date,amount,remarks",
    );
    paymentParams.set("filter[disbursement_id][_in]", ids.join(","));

    const [payablesRes, paymentsRes] = await Promise.all([
        directusFetch<DirectusList<PayableRow>>(`/items/disbursement_payables?${payableParams.toString()}`),
        directusFetch<DirectusList<PaymentRow>>(`/items/disbursement_payments?${paymentParams.toString()}`),
    ]);

    return {
        payables: groupByDisbursementId(payablesRes.data ?? []),
        payments: groupByDisbursementId(paymentsRes.data ?? []),
    };
}

function normalizePayable(row: PayableRow, coaMap?: Map<number, string>) {
    const rawCoaId = relationId(row.coa_id, "coa_id");
    let accountTitle = relationLabel(row.coa_id, "account_title");
    if (!accountTitle && rawCoaId && coaMap) {
        accountTitle = coaMap.get(rawCoaId) || `Account #${rawCoaId}`;
    }

    return {
        id: asNumber(row.id),
        divisionId: relationId(row.division_id, "division_id"),
        divisionName: relationLabel(row.division_id, "division_name"),
        referenceNo: asString(row.reference_no),
        date: asString(row.date),
        coaId: rawCoaId,
        accountTitle,
        amount: asNumber(row.amount) ?? 0,
        remarks: asString(row.remarks),
    };
}

function normalizePayment(row: PaymentRow, coaMap?: Map<number, string>) {
    const rawCoaId = relationId(row.coa_id, "coa_id");
    let accountTitle = relationLabel(row.coa_id, "account_title");
    if (!accountTitle && rawCoaId && coaMap) {
        accountTitle = coaMap.get(rawCoaId) || `Account #${rawCoaId}`;
    }

    return {
        id: asNumber(row.id),
        coaId: rawCoaId,
        accountTitle,
        bankId: asNumber(row.bank_id),
        checkNo: asString(row.check_no),
        date: asString(row.date),
        amount: asNumber(row.amount) ?? 0,
        remarks: asString(row.remarks),
    };
}

export function normalizeDisbursement(
    row: DisbursementRow,
    payablesMap: Map<number, PayableRow[]>,
    paymentsMap: Map<number, PaymentRow[]>,
    userMap?: Map<string, string>,
    coaMap?: Map<number, string>,
) {
    const id = asNumber(row.id) ?? 0;
    const payables = (payablesMap.get(id) ?? []).map((p) => normalizePayable(p, coaMap));
    const payments = (paymentsMap.get(id) ?? []).map((p) => normalizePayment(p, coaMap));
    const totalDebit = roundMoney(payables.reduce((sum, line) => sum + line.amount, 0));
    const totalCredit = roundMoney(payments.reduce((sum, line) => sum + line.amount, 0));

    const encoderIdVal = asNumber(row.encoder_id);
    const approverIdVal = asNumber(row.approver_id);
    const postedByVal = asNumber(row.posted_by);

    const encoderName = encoderIdVal ? (userMap?.get(String(encoderIdVal)) || `User #${encoderIdVal}`) : "";
    const approverName = approverIdVal ? (userMap?.get(String(approverIdVal)) || `User #${approverIdVal}`) : "";
    const postedByName = postedByVal ? (userMap?.get(String(postedByVal)) || `User #${postedByVal}`) : "";

    return {
        id,
        docNo: asString(row.doc_no),
        payeeId: relationId(row.payee),
        transactionTypeName: transactionTypeName(row.transaction_type),
        payeeName: relationLabel(row.payee, "supplier_name"),
        remarks: asString(row.remarks),
        totalAmount: asNumber(row.total_amount) ?? totalDebit,
        paidAmount: asNumber(row.paid_amount) ?? totalCredit,
        totalDebit,
        totalCredit,
        balance: roundMoney(totalDebit - totalCredit),
        encoderName,
        approverName,
        postedByName,
        encoderId: encoderIdVal,
        approverId: approverIdVal,
        postedById: postedByVal,
        isPosted: asNumber(row.isPosted) ?? 0,
        transactionDate: asString(row.transaction_date),
        dateCreated: asString(row.date_created),
        dateApproved: asString(row.date_approved),
        datePosted: asString(row.date_posted),
        divisionId: relationId(row.division_id, "division_id"),
        departmentId: relationId(row.department_id, "department_id"),
        divisionName: relationLabel(row.division_id, "division_name"),
        departmentName: relationLabel(row.department_id, "department_name"),
        status: asString(row.status) || "Draft",
        supportingDocumentsUrl: asString(row.supporting_documents_url),
        payables,
        payments,
    };
}

export async function getCoaMap() {
    const map = new Map<number, string>();
    try {
        const coaRes = await directusFetch<DirectusList<{ coa_id?: number; account_title?: string }>>("/items/chart_of_accounts?limit=-1&fields=coa_id,account_title");
        if (coaRes.data && Array.isArray(coaRes.data)) {
            coaRes.data.forEach((c) => {
                const id = Number(c.coa_id);
                const title = String(c.account_title);
                if (id && title) {
                    map.set(id, title);
                }
            });
        }
    } catch (e) {
        console.warn("Failed to fetch COAs map:", e);
    }
    return map;
}

export async function getUserMap(token: string) {
    const map = new Map<string, string>();
    try {
        const url = process.env.SPRING_API_BASE_URL || "http://localhost:8080";
        const targetUrl = `${url.replace(/\/$/, "")}/users`;
        const usersRes = await fetch(targetUrl, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (usersRes.ok) {
            const list = await usersRes.json();
            if (Array.isArray(list)) {
                list.forEach((u: { id?: unknown; firstName?: unknown; lastName?: unknown }) => {
                    const id = String(u.id);
                    const name = `${u.firstName || ""} ${u.lastName || ""}`.trim();
                    if (id && name) {
                        map.set(id, name);
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Failed to fetch users map:", e);
    }
    return map;
}

/** Resolve the custom user table user_id from the JWT email (sub claim). Returns null if not found. */
export async function resolveEncoderId(email: string | null): Promise<number | null> {
    if (!email) return null;
    try {
        const params = new URLSearchParams();
        params.set("filter[user_email][_eq]", email);
        params.set("fields", "user_id");
        params.set("limit", "1");
        const res = await directusFetch<DirectusList<{ user_id?: number }>>(`/items/user?${params.toString()}`);
        const userId = res.data?.[0]?.user_id;
        return userId ? Number(userId) : null;
    } catch {
        return null;
    }
}

let docNoPromiseChain = Promise.resolve<unknown>(null);

async function generateDocumentNumber(supplierType: string): Promise<string> {
    return new Promise((resolve, reject) => {
        docNoPromiseChain = docNoPromiseChain.then(async () => {
            try {
                const res = await generateDocumentNumberInternal(supplierType);
                resolve(res);
            } catch (err) {
                reject(err);
            }
        });
    });
}

async function generateDocumentNumberInternal(supplierType: string): Promise<string> {
    const isTrade = supplierType.toLowerCase() === "trade";
    const prefix = isTrade ? "TR" : "NT";
    const field = isTrade ? "trade_no" : "non-trade_no";

    try {
        // 1. Get current sequence row
        const getRes = await directusFetch<DirectusList<DirectusDisbursementNo>>("/items/disbursement_no?limit=1");
        let seqRow = getRes.data?.[0];

        if (!seqRow) {
            // Create initial row
            const createRes = await directusFetch<{ data: DirectusDisbursementNo }>("/items/disbursement_no", {
                method: "POST",
                body: JSON.stringify({ trade_no: 0, "non-trade_no": 0 })
            });
            seqRow = createRes.data;
        }

        const rowId = seqRow.id;
        const currentSeq = (Number(seqRow[field]) || 0) + 1;

        // 2. Update sequence row
        await directusFetch<unknown>(`/items/disbursement_no/${rowId}`, {
            method: "PATCH",
            body: JSON.stringify({ [field]: currentSeq })
        });

        // Format e.g. TR-000001
        const seqStr = String(currentSeq).padStart(6, "0");
        return `${prefix}-${seqStr}`;
    } catch (e: unknown) {
        console.warn("Failed to generate doc_no via disbursement_no collection, using fallback. Reason:", e);
        
        // Fallback: Query max doc_no from disbursement table
        const params = new URLSearchParams();
        params.set("filter[doc_no][_starts_with]", `${prefix}-`);
        params.set("limit", "1");
        params.set("sort", "-id");
        params.set("fields", "doc_no");

        const fallbackRes = await directusFetch<DirectusList<{ doc_no: string }>>(`/items/disbursement?${params.toString()}`);
        const latestDocNo = fallbackRes.data?.[0]?.doc_no;

        let nextSeq = 1;
        if (latestDocNo) {
            const parts = latestDocNo.split("-");
            const numericPart = parts[parts.length - 1];
            const parsed = parseInt(numericPart, 10);
            if (!isNaN(parsed)) {
                nextSeq = parsed + 1;
            }
        }

        const seqStr = String(nextSeq).padStart(6, "0");
        return `${prefix}-${seqStr}`;
    }
}

async function getPreviewDocumentNumber(supplierType: string): Promise<string> {
    const isTrade = supplierType.toLowerCase() === "trade";
    const prefix = isTrade ? "TR" : "NT";
    const field = isTrade ? "trade_no" : "non-trade_no";

    try {
        // 1. Get current sequence row
        const getRes = await directusFetch<DirectusList<DirectusDisbursementNo>>("/items/disbursement_no?limit=1");
        const seqRow = getRes.data?.[0];
        if (seqRow) {
            const currentSeq = (Number(seqRow[field]) || 0) + 1;
            const seqStr = String(currentSeq).padStart(6, "0");
            return `${prefix}-${seqStr}`;
        }
    } catch {
        // Fallback if forbidden
    }

    // Fallback: Query max doc_no from disbursement table
    const params = new URLSearchParams();
    params.set("filter[doc_no][_starts_with]", `${prefix}-`);
    params.set("limit", "1");
    params.set("sort", "-id");
    params.set("fields", "doc_no");

    const fallbackRes = await directusFetch<DirectusList<{ doc_no: string }>>(`/items/disbursement?${params.toString()}`);
    const latestDocNo = fallbackRes.data?.[0]?.doc_no;

    let nextSeq = 1;
    if (latestDocNo) {
        const parts = latestDocNo.split("-");
        const numericPart = parts[parts.length - 1];
        const parsed = parseInt(numericPart, 10);
        if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
        }
    }

    const seqStr = String(nextSeq).padStart(6, "0");
    return `${prefix}-${seqStr}`;
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);

    if (searchParams.get("nextDocNo") === "true") {
        const supplierType = searchParams.get("supplierType") || "Trade";
        try {
            const nextNo = await getPreviewDocumentNumber(supplierType);
            return NextResponse.json({ nextDocNo: nextNo });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unknown error occurred";
            return NextResponse.json({ message }, { status: 500 });
        }
    }

    const supplier = searchParams.get("supplier") || "";

    try {
        const supplierIds = await getSupplierIds(supplier);
        if (supplier && supplierIds.length === 0) {
            return NextResponse.json({
                content: [],
                totalElements: 0,
                totalPages: 0,
                number: normalizePage(searchParams.get("page")),
                size: normalizeSize(searchParams.get("size")),
            });
        }

        const query = buildDisbursementParams(searchParams, supplierIds);
        const disbursementsRes = await directusFetch<DirectusList<DisbursementRow>>(
            `/items/disbursement?${query.params.toString()}`,
        );
        const rows = disbursementsRes.data ?? [];
        const ids = rows.map((row) => asNumber(row.id) ?? 0).filter(Boolean);
        const lineItems = await getLineItems(ids);
        const totalElements = asNumber(disbursementsRes.meta?.filter_count) ?? rows.length;
        const userMap = await getUserMap(token);
        const coaMap = await getCoaMap();

        return NextResponse.json({
            content: rows.map((row) => normalizeDisbursement(row, lineItems.payables, lineItems.payments, userMap, coaMap)),
            totalElements,
            totalPages: Math.ceil(totalElements / query.size),
            number: query.page,
            size: query.size,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        return NextResponse.json({ message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded = decodeJwtPayload(token);
    const encoderEmail = decoded?.email || decoded?.sub || null;
    const currentUserId = await resolveEncoderId(encoderEmail);

    try {
        const body = await request.json();

        // 1. Fetch payee supplier type to determine prefix (Trade / Non-Trade)
        if (!body.payeeId) {
            return NextResponse.json({ message: "Payee (Supplier ID) is required." }, { status: 400 });
        }

        const supplierRes = await directusFetch<DirectusSupplierResponse>(`/items/suppliers/${body.payeeId}?fields=supplier_type`);
        const supplierType = supplierRes?.data?.supplier_type || "Trade";

        // 2. Generate doc_no if not present
        let docNo = body.docNo;
        if (!docNo || !docNo.trim()) {
            docNo = await generateDocumentNumber(supplierType);
        } else {
            // Check if document number already exists
            const existsRes = await directusFetch<DirectusList<{ id: number }>>(
                `/items/disbursement?filter[doc_no][_eq]=${encodeURIComponent(docNo)}&fields=id`
            );
            if (existsRes.data && existsRes.data.length > 0) {
                return NextResponse.json({ message: `Document Number already exists: ${docNo}` }, { status: 400 });
            }
        }

        // 3. Threshold check
        const APPROVAL_THRESHOLD = 1000.00;
        const isAutoApprove = Number(body.totalAmount) < APPROVAL_THRESHOLD;

        // 4. Calculate paid amount (sum of payments)
        const calculatedPaidAmount = (body.payments || []).reduce(
            (sum: number, p: PaymentInput) => sum + (Number(p.amount) || 0),
            0
        );

        // 5. Create disbursement header (no nested O2M — Directus doesn't support it)
        const headerPayload = {
            doc_no: docNo,
            transaction_type: body.transactionTypeId ? Number(body.transactionTypeId) : null,
            payee: Number(body.payeeId),
            remarks: body.remarks || "",
            total_amount: Number(body.totalAmount) || 0,
            paid_amount: calculatedPaidAmount,
            encoder_id: currentUserId,
            transaction_date: body.transactionDate,
            division_id: body.divisionId ? Number(body.divisionId) : null,
            department_id: body.departmentId ? Number(body.departmentId) : null,
            fund_source_id: body.fundSourceId || null,
            supporting_documents_url: cleanSupportingDocsUrl(body.supportingDocumentsUrl),
            status: isAutoApprove ? "Approved" : "Draft",
            approver_id: isAutoApprove ? currentUserId : null,
            date_approved: isAutoApprove ? new Date().toISOString() : null,
        };

        const createRes = await directusFetch<{ data: DisbursementRow }>("/items/disbursement", {
            method: "POST",
            body: JSON.stringify(headerPayload)
        });

        const createdDisbursement = createRes.data;
        const createdId = asNumber(createdDisbursement.id);
        if (!createdId) throw new Error("Disbursement created but returned no ID.");

        // 6. Batch-create payable lines and payment lines in parallel
        const payableLines = (body.payables || [])
            .filter((line: PayableInput) => !!line.coaId || (line.amount != null && Number(line.amount) !== 0) || (line.referenceNo && line.referenceNo.trim() !== ""))
            .map((line: PayableInput) => ({
                disbursement_id: createdId,
                reference_no: line.referenceNo || "",
                date: line.date,
                coa_id: line.coaId ? Number(line.coaId) : null,
                amount: Number(line.amount) || 0,
                remarks: line.remarks || ""
            }));

        const paymentLines = (body.payments || [])
            .filter((line: PaymentInput) => !!line.coaId || (line.amount != null && Number(line.amount) !== 0) || (line.checkNo && line.checkNo.trim() !== ""))
            .map((line: PaymentInput) => ({
                disbursement_id: createdId,
                coa_id: line.coaId ? Number(line.coaId) : null,
                bank_id: line.bankId ? Number(line.bankId) : null,
                check_no: line.checkNo || "",
                date: line.date,
                amount: Number(line.amount) || 0,
                remarks: line.remarks || ""
            }));

        await Promise.all([
            payableLines.length > 0
                ? directusFetch("/items/disbursement_payables", { method: "POST", body: JSON.stringify(payableLines) })
                : Promise.resolve(),
            paymentLines.length > 0
                ? directusFetch("/items/disbursement_payments", { method: "POST", body: JSON.stringify(paymentLines) })
                : Promise.resolve(),
        ]);

        // 7. Return the full normalized record
        const lineItems = await getLineItems([createdId]);
        const userMap = await getUserMap(token);
        const coaMap = await getCoaMap();

        return NextResponse.json(
            normalizeDisbursement(createdDisbursement, lineItems.payables, lineItems.payments, userMap, coaMap)
        );

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        return NextResponse.json({ message: "BFF Error", detail: message }, { status: 502 });
    }
}
