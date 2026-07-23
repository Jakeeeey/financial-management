import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload } from "@/lib/auth-utils";
import { findUnpostedPurchaseOrderReferences } from "./_purchase-order-eligibility";
import { findMissingVatPrincipalDivisionError, normalizeVatSplitDivisions } from "./_payable-split-integrity";
import { validateSupplierMemoCaps } from "./_memo-cap-integrity";
import { isPettyCashAccount, validatePaymentLine } from "@/lib/financial-management/payment-method";

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
    user_id?: unknown;
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
    encoder_id?: RelationValue;
    submitted_by?: RelationValue;
    approver_id?: RelationValue;
    released_by?: RelationValue;
    posted_by?: RelationValue;
    isPosted?: unknown;
    transaction_date?: unknown;
    date_created?: unknown;
    date_submitted?: unknown;
    date_approved?: unknown;
    date_released?: unknown;
    date_posted?: unknown;
    division_id?: RelationValue;
    department_id?: RelationValue;
    fund_source_id?: unknown;
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
    released_by?: RelationValue;
    released_date?: unknown;
};

type SupplierRow = {
    id?: unknown;
};

interface DirectusDisbursementNo {
    id: number;
    trade_no?: number;
    "non-trade_no"?: number;
    [key: string]: unknown;
}

export interface PayableInput {
    id?: number;
    divisionId?: number;
    referenceNo?: string;
    date?: string;
    coaId?: number;
    amount?: number;
    remarks?: string;
}

export interface PaymentInput {
    id?: number;
    coaId?: number;
    bankId?: number;
    checkNo?: string;
    date?: string;
    amount?: number;
    remarks?: string;
    releasedDate?: string;
    releasedBy?: string;
}

type ComparableLine = {
    divisionId: number | null;
    referenceNo?: string | null;
    date?: string | null;
    coaId: number | null;
    bankId?: number | null;
    checkNo?: string | null;
    amount: number;
    remarks?: string | null;
};

type ComparableDisbursement = {
    transactionTypeId: number | null;
    payeeId: number | null;
    remarks: string | null;
    totalAmount: number;
    transactionDate: string | null;
    divisionId: number | null;
    departmentId: number | null;
    fundSourceId: number | null;
    supportingDocumentsUrl: string | null;
    payables: ComparableLine[];
    payments: ComparableLine[];
};

function asString(value: unknown) {
    return value == null ? "" : String(value);
}

function asNumber(value: unknown) {
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function relationId(
    value: RelationValue | undefined,
    key: "id" | "division_id" | "department_id" | "coa_id" | "user_id" = "id",
) {
    if (value == null || typeof value !== "object") return asNumber(value);
    return asNumber((value as Record<string, unknown>)[key] ?? value.id);
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

function comparableNumber(value: unknown): number | null {
    const parsed = asNumber(value);
    return parsed == null ? null : parsed;
}

function comparableText(value: unknown): string | null {
    const text = asString(value).trim();
    return text || null;
}

function comparableDate(value: unknown): string | null {
    const text = comparableText(value);
    return text ? text.split("T")[0] : null;
}

function comparableLine(line: {
    divisionId?: unknown;
    referenceNo?: unknown;
    date?: unknown;
    coaId?: unknown;
    bankId?: unknown;
    checkNo?: unknown;
    amount?: unknown;
    remarks?: unknown;
}): ComparableLine {
    return {
        divisionId: comparableNumber(line.divisionId),
        referenceNo: comparableText(line.referenceNo),
        date: comparableDate(line.date),
        coaId: comparableNumber(line.coaId),
        bankId: comparableNumber(line.bankId),
        checkNo: comparableText(line.checkNo),
        amount: roundMoney(Number(line.amount) || 0),
        remarks: comparableText(line.remarks),
    };
}

export function canonicalizeDisbursementPayload(input: {
    transactionTypeId?: unknown;
    payeeId?: unknown;
    remarks?: unknown;
    totalAmount?: unknown;
    transactionDate?: unknown;
    divisionId?: unknown;
    departmentId?: unknown;
    fundSourceId?: unknown;
    supportingDocumentsUrl?: unknown;
    payables?: Array<{
        divisionId?: unknown;
        referenceNo?: unknown;
        date?: unknown;
        coaId?: unknown;
        amount?: unknown;
        remarks?: unknown;
    }>;
    payments?: Array<{
        coaId?: unknown;
        bankId?: unknown;
        checkNo?: unknown;
        date?: unknown;
        amount?: unknown;
        remarks?: unknown;
    }>;
}): string {
    const comparable: ComparableDisbursement = {
        transactionTypeId: comparableNumber(input.transactionTypeId),
        payeeId: comparableNumber(input.payeeId),
        remarks: comparableText(input.remarks),
        totalAmount: roundMoney(Number(input.totalAmount) || 0),
        transactionDate: comparableDate(input.transactionDate),
        divisionId: comparableNumber(input.divisionId),
        departmentId: comparableNumber(input.departmentId),
        fundSourceId: comparableNumber(input.fundSourceId),
        supportingDocumentsUrl: cleanSupportingDocsUrl(asString(input.supportingDocumentsUrl)),
        payables: (input.payables || []).map((line) => comparableLine(line)),
        payments: (input.payments || []).map((line) => comparableLine(line)),
    };

    return JSON.stringify(comparable);
}

export function canonicalizePersistedDisbursement(row: DisbursementRow, payables: PayableRow[], payments: PaymentRow[]) {
    return canonicalizeDisbursementPayload({
        transactionTypeId: row.transaction_type,
        payeeId: relationId(row.payee),
        remarks: row.remarks,
        totalAmount: row.total_amount,
        transactionDate: row.transaction_date,
        divisionId: relationId(row.division_id, "division_id"),
        departmentId: relationId(row.department_id, "department_id"),
        fundSourceId: relationId(row.fund_source_id as RelationValue),
        supportingDocumentsUrl: row.supporting_documents_url,
        payables: payables.map((line) => ({
            divisionId: relationId(line.division_id, "division_id"),
            referenceNo: line.reference_no,
            date: line.date,
            coaId: relationId(line.coa_id, "coa_id"),
            amount: line.amount,
            remarks: line.remarks,
        })),
        payments: payments.map((line) => ({
            coaId: relationId(line.coa_id, "coa_id"),
            bankId: relationId(line.bank_id as RelationValue),
            checkNo: line.check_no,
            date: line.date,
            amount: line.amount,
            remarks: line.remarks,
        })),
    });
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
    const isPosted = searchParams.get("isPosted") || "";
    const params = new URLSearchParams();
    let filterIndex = 0;

    params.set("limit", String(size));
    params.set("offset", String(page * size));
    params.set("meta", "filter_count");
    params.set("sort", "-date_created,-id");
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
            "submitted_by",
            "approver_id",
            "released_by",
            "posted_by",
            "isPosted",
            "transaction_date",
            "date_created",
            "date_submitted",
            "date_approved",
            "date_released",
            "date_posted",
            "division_id.division_id",
            "division_id.division_name",
            "department_id.department_id",
            "department_id.department_name",
            "fund_source_id",
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
        const op = status.includes(",") ? "_in" : "_eq";
        filterIndex = appendFilter(params, filterIndex, "status", op, status);
    } else {
        filterIndex = appendFilter(params, filterIndex, "status", "_neq", "Deleted");
    }
    if (isPosted !== "") {
        filterIndex = appendFilter(params, filterIndex, "isPosted", "_eq", isPosted);
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
        "id,disbursement_id,division_id,division_id.division_id,division_id.division_name,reference_no,date,coa_id,coa_id.coa_id,coa_id.account_title,amount,remarks",
    );
    payableParams.set("filter[disbursement_id][_in]", ids.join(","));

    const paymentParams = new URLSearchParams();
    paymentParams.set("limit", "-1");
    paymentParams.set(
        "fields",
        "id,disbursement_id,coa_id,coa_id.coa_id,coa_id.account_title,bank_id,check_no,date,amount,remarks,released_by,released_date",
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

type DisbursementSnapshot = {
    header: DisbursementRow;
    payables: PayableRow[];
    payments: PaymentRow[];
};

async function findDisbursementSnapshotByDocNo(docNo: string): Promise<DisbursementSnapshot | null> {
    const params = new URLSearchParams();
    params.set("filter[doc_no][_eq]", docNo);
    params.set("limit", "1");
    params.set(
        "fields",
        [
            "id",
            "doc_no",
            "transaction_type",
            "payee",
            "remarks",
            "total_amount",
            "paid_amount",
            "encoder_id",
            "submitted_by",
            "approver_id",
            "released_by",
            "posted_by",
            "isPosted",
            "transaction_date",
            "date_created",
            "date_submitted",
            "date_approved",
            "date_released",
            "date_posted",
            "division_id",
            "department_id",
            "fund_source_id",
            "supporting_documents_url",
            "status",
        ].join(","),
    );

    const response = await directusFetch<DirectusList<DisbursementRow>>(`/items/disbursement?${params.toString()}`);
    const header = response.data?.[0];
    const id = header ? asNumber(header.id) : undefined;
    if (!header || !id) return null;

    const lineItems = await getLineItems([id]);
    return {
        header,
        payables: lineItems.payables.get(id) || [],
        payments: lineItems.payments.get(id) || [],
    };
}

export async function loadNormalizedDisbursement(row: DisbursementRow, token: string) {
    const id = asNumber(row.id) || 0;
    const lineItems = await getLineItems([id]);
    const payments = lineItems.payments.get(id) || [];
    const userIdsToFetch: number[] = [];
    const addId = (value: number | undefined) => {
        if (typeof value === "number" && Number.isFinite(value)) userIdsToFetch.push(value);
    };

    addId(relationId(row.encoder_id, "user_id"));
    addId(relationId(row.submitted_by, "user_id"));
    addId(relationId(row.approver_id, "user_id"));
    addId(relationId(row.released_by, "user_id"));
    addId(relationId(row.posted_by, "user_id"));
    payments.forEach((payment) => addId(relationId(payment.released_by, "user_id")));

    const [userMap, coaMap, divisionMap, bankMap] = await Promise.all([
        getUserMap(token, userIdsToFetch),
        getCoaMap(),
        getDivisionMap(),
        getBankMap(),
    ]);

    return normalizeDisbursement(row, lineItems.payables, lineItems.payments, userMap, coaMap, divisionMap, bankMap);
}

async function compensateCreatedDisbursement(id: number) {
    const lineItems = await getLineItems([id]);
    const payableIds = (lineItems.payables.get(id) || [])
        .map((line) => asNumber(line.id))
        .filter((value): value is number => Boolean(value));
    const paymentIds = (lineItems.payments.get(id) || [])
        .map((line) => asNumber(line.id))
        .filter((value): value is number => Boolean(value));

    if (payableIds.length > 0) {
        await directusFetch(`/items/disbursement_payables`, {
            method: "DELETE",
            body: JSON.stringify(payableIds),
        });
    }
    if (paymentIds.length > 0) {
        await directusFetch(`/items/disbursement_payments`, {
            method: "DELETE",
            body: JSON.stringify(paymentIds),
        });
    }
    await directusFetch(`/items/disbursement/${id}`, { method: "DELETE" });
}

function normalizePayable(row: PayableRow, coaMap?: Map<number, string>, divisionMap?: Map<number, string>) {
    const rawCoaId = relationId(row.coa_id, "coa_id");
    let accountTitle = relationLabel(row.coa_id, "account_title");
    if (!accountTitle && rawCoaId && coaMap) {
        accountTitle = coaMap.get(rawCoaId) || `Account #${rawCoaId}`;
    }

    const rawDivisionId = relationId(row.division_id, "division_id");
    let divisionName = relationLabel(row.division_id, "division_name");
    if (!divisionName && rawDivisionId && divisionMap) {
        divisionName = divisionMap.get(rawDivisionId) || `Division #${rawDivisionId}`;
    }

    return {
        id: asNumber(row.id),
        divisionId: rawDivisionId,
        divisionName,
        referenceNo: asString(row.reference_no),
        date: asString(row.date),
        coaId: rawCoaId,
        accountTitle,
        amount: asNumber(row.amount) ?? 0,
        remarks: asString(row.remarks),
    };
}

function normalizePayment(
    row: PaymentRow,
    coaMap?: Map<number, string>,
    userMap?: Map<string, string>,
    bankMap?: Map<number, { bankName: string; accountNumber: string }>
) {
    const rawCoaId = relationId(row.coa_id, "coa_id");
    let accountTitle = relationLabel(row.coa_id, "account_title");
    if (!accountTitle && rawCoaId && coaMap) {
        accountTitle = coaMap.get(rawCoaId) || `Account #${rawCoaId}`;
    }

    const releasedByVal = relationId(row.released_by, "user_id");
    const releasedByName = releasedByVal ? (userMap?.get(String(releasedByVal)) || `User #${releasedByVal}`) : "";

    const rawBankId = asNumber(row.bank_id);
    let bankName = "";
    let bankAccountNumber = "";
    if (rawBankId && bankMap) {
        const bankInfo = bankMap.get(rawBankId);
        if (bankInfo) {
            bankName = bankInfo.bankName;
            bankAccountNumber = bankInfo.accountNumber;
        }
    }

    return {
        id: asNumber(row.id),
        coaId: rawCoaId,
        accountTitle,
        bankId: rawBankId,
        bankName: bankName || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        checkNo: asString(row.check_no),
        date: asString(row.date),
        amount: asNumber(row.amount) ?? 0,
        remarks: asString(row.remarks),
        releasedDate: asString(row.released_date),
        releasedBy: releasedByName || releasedByVal || undefined,
    };
}

export function normalizeDisbursement(
    row: DisbursementRow,
    payablesMap: Map<number, PayableRow[]>,
    paymentsMap: Map<number, PaymentRow[]>,
    userMap?: Map<string, string>,
    coaMap?: Map<number, string>,
    divisionMap?: Map<number, string>,
    bankMap?: Map<number, { bankName: string; accountNumber: string }>,
) {
    const id = asNumber(row.id) ?? 0;

    const payables = (payablesMap.get(id) || []).map((p) => normalizePayable(p, coaMap, divisionMap));
    const payments = (paymentsMap.get(id) || []).map((p) => normalizePayment(p, coaMap, userMap, bankMap));
    const totalDebit = roundMoney(payables.reduce((sum, line) => sum + line.amount, 0));
    const totalCredit = roundMoney(payments.reduce((sum, line) => sum + line.amount, 0));

    const encoderIdVal = relationId(row.encoder_id, "user_id");
    const submittedByVal = relationId(row.submitted_by, "user_id");
    const approverIdVal = relationId(row.approver_id, "user_id");
    const releasedByVal = relationId(row.released_by, "user_id");
    const postedByVal = relationId(row.posted_by, "user_id");

    const encoderName = encoderIdVal ? (userMap?.get(String(encoderIdVal)) || `User #${encoderIdVal}`) : "";
    const submittedByName = submittedByVal ? (userMap?.get(String(submittedByVal)) || `User #${submittedByVal}`) : "";
    const approverName = approverIdVal ? (userMap?.get(String(approverIdVal)) || `User #${approverIdVal}`) : "";
    const releasedByName = releasedByVal ? (userMap?.get(String(releasedByVal)) || `User #${releasedByVal}`) : "";
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
        submittedByName,
        approverName,
        releasedByName,
        postedByName,
        encoderId: encoderIdVal,
        submittedById: submittedByVal,
        approverId: approverIdVal,
        releasedById: releasedByVal,
        postedById: postedByVal,
        isPosted: asNumber(row.isPosted) ?? 0,
        transactionDate: asString(row.transaction_date),
        dateCreated: asString(row.date_created),
        dateSubmitted: asString(row.date_submitted),
        dateApproved: asString(row.date_approved),
        dateReleased: asString(row.date_released),
        datePosted: asString(row.date_posted),
        divisionId: relationId(row.division_id, "division_id"),
        departmentId: relationId(row.department_id, "department_id"),
        divisionName: relationLabel(row.division_id, "division_name"),
        departmentName: relationLabel(row.department_id, "department_name"),
        fundSourceId: asNumber(row.fund_source_id),
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

export async function getDivisionMap() {
    const map = new Map<number, string>();
    try {
        const divRes = await directusFetch<DirectusList<{ division_id?: number; division_name?: string }>>("/items/division?limit=-1&fields=division_id,division_name");
        if (divRes.data && Array.isArray(divRes.data)) {
            divRes.data.forEach((d) => {
                const id = Number(d.division_id);
                const name = String(d.division_name);
                if (id && name) {
                    map.set(id, name);
                }
            });
        }
    } catch (e) {
        console.warn("Failed to fetch divisions map:", e);
    }
    return map;
}

export async function getBankMap() {
    const map = new Map<number, { bankName: string; accountNumber: string }>();
    try {
        const bankRes = await directusFetch<DirectusList<{ bank_id?: number; bank_name?: string; account_number?: string }>>("/items/bank_accounts?limit=-1&fields=bank_id,bank_name,account_number");
        if (bankRes.data && Array.isArray(bankRes.data)) {
            bankRes.data.forEach((b) => {
                const id = Number(b.bank_id);
                const bankName = String(b.bank_name || "");
                const accountNumber = String(b.account_number || "");
                if (id) {
                    map.set(id, { bankName, accountNumber });
                }
            });
        }
    } catch (e) {
        console.warn("Failed to fetch bank accounts map:", e);
    }
    return map;
}

export async function getUserMap(token: string, userIds?: number[]) {
    const map = new Map<string, string>();
    try {
        let path = "/items/user?limit=-1&fields=user_id,user_fname,user_lname";
        if (userIds && userIds.length > 0) {
            const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
            if (uniqueIds.length > 0) {
                path = `/items/user?limit=-1&fields=user_id,user_fname,user_lname&filter[user_id][_in]=${uniqueIds.join(",")}`;
            }
        }
        const res = await directusFetch<DirectusList<{ user_id?: number; user_fname?: string; user_lname?: string }>>(path);
        if (res.data && Array.isArray(res.data)) {
            res.data.forEach((u) => {
                const id = String(u.user_id);
                const name = `${u.user_fname || ""} ${u.user_lname || ""}`.trim();
                if (id && name) {
                    map.set(id, name);
                }
            });
        }
    } catch (e) {
        console.warn("Failed to fetch users map from Directus:", e);
    }
    return map;
}

/** Resolve the custom user table user_id from the JWT email or numeric sub claim. Returns null if not found. */
export async function resolveEncoderId(emailOrSub: string | null): Promise<number | null> {
    if (!emailOrSub) return null;
    
    // If it's already a numeric ID from Spring Boot, parse it directly
    const parsedId = Number(emailOrSub);
    if (Number.isInteger(parsedId) && parsedId > 0) {
        return parsedId;
    }
    
    try {
        const params = new URLSearchParams();
        params.set("filter[user_email][_eq]", emailOrSub);
        params.set("fields", "user_id");
        params.set("limit", "1");
        const res = await directusFetch<DirectusList<{ user_id?: number }>>(`/items/user?${params.toString()}`);
        const userId = res.data?.[0]?.user_id;
        if (userId) return Number(userId);

        // Fallback: If not found by email, try matching username format (e.g. dev_vertex or clyde_pm)
        // by splitting by _, -, or . and matching first/last name
        const clean = emailOrSub.toLowerCase();
        const parts = clean.split(/[._-]/);
        if (parts.length >= 2) {
            const fname = parts[0];
            const lname = parts[1];
            const fallbackParams = new URLSearchParams();
            fallbackParams.set("filter[user_fname][_icontains]", fname);
            fallbackParams.set("filter[user_lname][_icontains]", lname);
            fallbackParams.set("fields", "user_id");
            fallbackParams.set("limit", "1");
            const fallbackRes = await directusFetch<DirectusList<{ user_id?: number }>>(`/items/user?${fallbackParams.toString()}`);
            const fbUserId = fallbackRes.data?.[0]?.user_id;
            if (fbUserId) return Number(fbUserId);
        }
        return null;
    } catch {
        return null;
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

        const userIdsToFetch: number[] = [];
        const addId = (val: number | undefined) => {
            if (typeof val === "number" && Number.isFinite(val)) {
                userIdsToFetch.push(val);
            }
        };
        rows.forEach(row => {
            addId(relationId(row.encoder_id, "user_id"));
            addId(relationId(row.submitted_by, "user_id"));
            addId(relationId(row.approver_id, "user_id"));
            addId(relationId(row.released_by, "user_id"));
            addId(relationId(row.posted_by, "user_id"));
            const payments = lineItems.payments.get(Number(row.id)) || [];
            payments.forEach(p => {
                addId(relationId(p.released_by, "user_id"));
            });
        });

        const userMap = await getUserMap(token, userIdsToFetch);
        const coaMap = await getCoaMap();
        const divisionMap = await getDivisionMap();
        const bankMap = await getBankMap();

        return NextResponse.json({
            content: rows.map((row) => normalizeDisbursement(row, lineItems.payables, lineItems.payments, userMap, coaMap, divisionMap, bankMap)),
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

    if (!currentUserId) {
        return NextResponse.json({
            message: "User Profile Not Found",
            detail: "Your account is not registered in the system user directory. Voucher creation is blocked."
        }, { status: 403 });
    }

    let createdId: number | undefined;
    let createdDocNo = "";
    let creationFinalized = false;

    try {
        const body = await request.json();
        const requestedPayables = (body.payables || []) as PayableInput[];
        const requestedPayments = (body.payments || []) as PaymentInput[];
        const missingPrincipalDivisionError = findMissingVatPrincipalDivisionError(requestedPayables);
        if (missingPrincipalDivisionError) {
            return NextResponse.json({ message: missingPrincipalDivisionError }, { status: 400 });
        }
        const normalizedPayables = normalizeVatSplitDivisions(requestedPayables);
        const payableLinesInput = normalizedPayables.filter((line: PayableInput) =>
            !!line.coaId || (line.amount != null && Number(line.amount) !== 0) || (line.referenceNo && line.referenceNo.trim() !== "")
        );
        const paymentLinesInput = requestedPayments.filter((line: PaymentInput) =>
            !!line.coaId || (line.amount != null && Number(line.amount) !== 0) || (line.checkNo != null && String(line.checkNo).trim() !== "")
        );
        const coaMap = await getCoaMap();
        for (let index = 0; index < paymentLinesInput.length; index++) {
            const line = paymentLinesInput[index];
            const validationError = validatePaymentLine(line, coaMap.get(Number(line.coaId)));
            if (validationError) {
                return NextResponse.json({
                    message: validationError,
                    detail: `Payment row ${index + 1} is invalid.`,
                }, { status: 400 });
            }
        }
        const normalizedPaymentLines = paymentLinesInput.map((line) =>
            isPettyCashAccount(coaMap.get(Number(line.coaId)))
                ? { ...line, bankId: undefined, checkNo: "" }
                : line
        );

        // 1. Fetch payee supplier type to determine prefix (Trade / Non-Trade)
        if (!body.payeeId) {
            return NextResponse.json({ message: "Payee (Supplier ID) is required." }, { status: 400 });
        }

        const docNo = typeof body.docNo === "string" ? body.docNo.trim() : "";
        if (!docNo) {
            return NextResponse.json({
                message: "Document Number is required for safe submission retries.",
                detail: "Refresh the voucher form to obtain a document number before submitting."
            }, { status: 400 });
        }

        const incomingCanonical = canonicalizeDisbursementPayload({
            transactionTypeId: body.transactionTypeId,
            payeeId: body.payeeId,
            remarks: body.remarks,
            totalAmount: body.totalAmount,
            transactionDate: body.transactionDate,
            divisionId: body.divisionId,
            departmentId: body.departmentId,
            fundSourceId: body.fundSourceId,
            supportingDocumentsUrl: body.supportingDocumentsUrl,
            payables: payableLinesInput,
            payments: normalizedPaymentLines,
        });

        const existingSnapshot = await findDisbursementSnapshotByDocNo(docNo);
        if (existingSnapshot) {
            const persistedCanonical = canonicalizePersistedDisbursement(
                existingSnapshot.header,
                existingSnapshot.payables,
                existingSnapshot.payments,
            );
            if (persistedCanonical !== incomingCanonical) {
                return NextResponse.json({
                    message: `Document Number already exists with different transaction data: ${docNo}`,
                    detail: "Use the existing voucher or refresh the form to obtain a new document number."
                }, { status: 409 });
            }

            return NextResponse.json(await loadNormalizedDisbursement(existingSnapshot.header, token));
        }

        const memoCapError = await validateSupplierMemoCaps(Number(body.payeeId), requestedPayables);
        if (memoCapError) {
            return NextResponse.json({
                message: "Supplier memo amount exceeds its authorized cap.",
                detail: memoCapError.message,
                memoNumber: memoCapError.memoNumber,
                authorizedAmount: memoCapError.authorizedAmount,
                appliedAmount: memoCapError.appliedAmount,
                requestedAmount: memoCapError.requestedAmount,
                remainingAmount: memoCapError.remainingAmount,
            }, { status: 409 });
        }

        const unpostedPoReferences = await findUnpostedPurchaseOrderReferences(
            requestedPayables.map((line) => line.referenceNo),
            Number(body.payeeId),
        );
        if (unpostedPoReferences.length > 0) {
            return NextResponse.json({
                message: "Disbursement cannot include purchase-order amounts that have not been posted.",
                detail: `Unposted or ineligible references: ${unpostedPoReferences.join(", ")}`,
                references: unpostedPoReferences,
            }, { status: 409 });
        }

        createdDocNo = docNo;

        // 3. Threshold check
        const APPROVAL_THRESHOLD = 1000.00;
        const isAutoApprove = Number(body.totalAmount) < APPROVAL_THRESHOLD;

        // 4. Calculate paid amount (sum of payments)
        const calculatedPaidAmount = normalizedPaymentLines.reduce(
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
            fund_source_id: body.fundSourceId ? Number(body.fundSourceId) : null,
            supporting_documents_url: cleanSupportingDocsUrl(body.supportingDocumentsUrl),
            status: "Draft",
            approver_id: null,
            date_approved: null,
        };

        const createRes = await directusFetch<{ data: DisbursementRow }>("/items/disbursement", {
            method: "POST",
            body: JSON.stringify(headerPayload)
        });

        const createdDisbursement = createRes.data;
        const persistedId = asNumber(createdDisbursement.id);
        if (!persistedId) throw new Error("Disbursement created but returned no ID.");
        createdId = persistedId;

        // 6. Batch-create payable lines and payment lines in parallel
        const payableLines = payableLinesInput
            .map((line: PayableInput) => ({
                disbursement_id: persistedId,
                division_id: line.divisionId ? Number(line.divisionId) : null,
                reference_no: line.referenceNo || "",
                date: line.date,
                coa_id: line.coaId ? Number(line.coaId) : null,
                amount: Number(line.amount) || 0,
                remarks: line.remarks || ""
            }));

        const paymentLines = normalizedPaymentLines
            .map((line: PaymentInput) => {
                const payload: {
                    disbursement_id: number;
                    coa_id: number | null;
                    bank_id: number | null;
                    check_no: string;
                    date: string | undefined;
                    amount: number;
                    remarks: string;
                    released_by?: number;
                    released_date?: string;
                } = {
                    disbursement_id: persistedId,
                    coa_id: line.coaId ? Number(line.coaId) : null,
                    bank_id: line.bankId ? Number(line.bankId) : null,
                    check_no: line.checkNo || "",
                    date: line.date,
                    amount: Number(line.amount) || 0,
                    remarks: line.remarks || ""
                };
                if (line.releasedBy != null && line.releasedBy !== "") {
                    payload.released_by = Number(line.releasedBy);
                }
                if (line.releasedDate != null && line.releasedDate !== "") {
                    payload.released_date = line.releasedDate;
                }
                return payload;
            });

        await Promise.all([
            payableLines.length > 0
                ? directusFetch("/items/disbursement_payables", { method: "POST", body: JSON.stringify(payableLines) })
                : Promise.resolve(),
            paymentLines.length > 0
                ? directusFetch("/items/disbursement_payments", { method: "POST", body: JSON.stringify(paymentLines) })
                : Promise.resolve(),
        ]);

        const verifiedLineItems = await getLineItems([persistedId]);
        const verifiedPayables = verifiedLineItems.payables.get(persistedId) || [];
        const verifiedPayments = verifiedLineItems.payments.get(persistedId) || [];
        const verifiedCanonical = canonicalizePersistedDisbursement(createdDisbursement, verifiedPayables, verifiedPayments);
        if (verifiedCanonical !== incomingCanonical) {
            throw new Error("Created disbursement lines failed integrity verification.");
        }

        if (isAutoApprove) {
            const approvedRes = await directusFetch<{ data: DisbursementRow }>(`/items/disbursement/${persistedId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: "Approved",
                    approver_id: currentUserId,
                    date_approved: new Date().toISOString(),
                }),
            });
            if (!approvedRes.data) throw new Error("Disbursement was created but automatic approval could not be confirmed.");
        }
        creationFinalized = true;

        // Return the full normalized record
        const freshHeaderRes = await fetch(`${DIRECTUS_URL}/items/disbursement/${persistedId}?fields=id,doc_no,transaction_type,payee.id,payee.supplier_name,remarks,total_amount,paid_amount,encoder_id,submitted_by,approver_id,released_by,posted_by,isPosted,transaction_date,date_created,date_submitted,date_approved,date_released,date_posted,division_id.division_id,division_id.division_name,department_id.department_id,department_id.department_name,fund_source_id,supporting_documents_url,status`, {
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            cache: "no-store",
        });
        if (!freshHeaderRes.ok) throw new Error("Failed to fetch fresh disbursement header");
        const freshDis = (await freshHeaderRes.json()).data;

        return NextResponse.json(await loadNormalizedDisbursement(freshDis, token));

    } catch (err: unknown) {
        if (createdId && !creationFinalized) {
            try {
                await compensateCreatedDisbursement(createdId);
            } catch (cleanupError: unknown) {
                const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup failure";
                return NextResponse.json({
                    message: "Disbursement creation requires reconciliation.",
                    detail: `The transaction ${createdDocNo || createdId} could not be completed or rolled back: ${cleanupMessage}`,
                    disbursementId: createdId,
                    docNo: createdDocNo || undefined,
                }, { status: 502 });
            }
        }
        const message = err instanceof Error ? err.message : "An unknown error occurred";
        return NextResponse.json({ message: "BFF Error", detail: message }, { status: 502 });
    }
}
