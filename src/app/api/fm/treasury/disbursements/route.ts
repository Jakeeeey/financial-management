import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

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

type DisbursementRow = {
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
};

type PayableRow = {
    id?: unknown;
    disbursement_id?: unknown;
    division_id?: RelationValue;
    reference_no?: unknown;
    date?: unknown;
    coa_id?: RelationValue;
    amount?: unknown;
    remarks?: unknown;
};

type PaymentRow = {
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

async function directusFetch<T>(path: string): Promise<T> {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
    if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

    const res = await fetch(`${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`, {
        headers: {
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json",
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

async function getLineItems(disbursementIds: number[]) {
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

function normalizePayable(row: PayableRow) {
    return {
        id: asNumber(row.id),
        divisionId: relationId(row.division_id, "division_id"),
        divisionName: relationLabel(row.division_id, "division_name"),
        referenceNo: asString(row.reference_no),
        date: asString(row.date),
        coaId: relationId(row.coa_id, "coa_id"),
        accountTitle: relationLabel(row.coa_id, "account_title"),
        amount: asNumber(row.amount) ?? 0,
        remarks: asString(row.remarks),
    };
}

function normalizePayment(row: PaymentRow) {
    return {
        id: asNumber(row.id),
        coaId: relationId(row.coa_id, "coa_id"),
        accountTitle: relationLabel(row.coa_id, "account_title"),
        bankId: asNumber(row.bank_id),
        checkNo: asString(row.check_no),
        date: asString(row.date),
        amount: asNumber(row.amount) ?? 0,
        remarks: asString(row.remarks),
    };
}

function normalizeDisbursement(
    row: DisbursementRow,
    payablesMap: Map<number, PayableRow[]>,
    paymentsMap: Map<number, PaymentRow[]>,
    userMap?: Map<string, string>,
) {
    const id = asNumber(row.id) ?? 0;
    const payables = (payablesMap.get(id) ?? []).map(normalizePayable);
    const payments = (paymentsMap.get(id) ?? []).map(normalizePayment);
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
        payables,
        payments,
    };
}

async function getUserMap(token: string) {
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

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
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

        return NextResponse.json({
            content: rows.map((row) => normalizeDisbursement(row, lineItems.payables, lineItems.payments, userMap)),
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

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/disbursements`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json(await springRes.json());
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error occurred";
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}
