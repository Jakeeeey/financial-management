import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";
import {randomUUID} from "node:crypto";
import {
    createSpringRequestContext,
    getSpringBaseUrl,
    isAbortError,
    readResponseBody,
    springErrorResponse,
} from "../collections/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();
const PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 120;
const SPRING_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;
type CPReference = {id: string; docNo: string};
type NumberReference = {id: string; number: string};
type CPTracerRow = {
    cpId: string;
    cpNumber: string;
    invoices: NumberReference[];
    memos: NumberReference[];
    salesReturns: NumberReference[];
};
type DirectusList<T> = {data?: T[]};

class SpringResponseError extends Error {
    constructor(readonly status: number, readonly payload: unknown, readonly requestId: string) {
        super(`Spring returned ${status}.`);
    }
}

const recordOf = (value: unknown): JsonRecord =>
    value !== null && typeof value === "object" ? value as JsonRecord : {};

const textOf = (value: unknown) => value == null ? "" : String(value).trim();

const relationId = (value: unknown, keys: string[] = ["id", "invoice_id", "return_id"]) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        const record = recordOf(value);
        for (const key of keys) {
            const candidate = record[key];
            if (candidate !== null && candidate !== undefined && typeof candidate !== "object") {
                return String(candidate).trim();
            }
        }
        return "";
    }
    return String(value).trim();
};

const cpReference = (value: unknown): CPReference | null => {
    const row = recordOf(value);
    const id = relationId(value, ["id"]);
    const docNo = textOf(row.docNo ?? row.doc_no);
    return id && docNo ? {id, docNo} : null;
};

const addCPReferences = (target: Map<string, CPReference>, rows: unknown[]) => {
    for (const item of rows) {
        const cp = cpReference(recordOf(item).collection_id);
        if (cp) target.set(cp.id, cp);
    }
};

const uniqueIds = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

async function directusList<T>(
    collection: string,
    params: URLSearchParams,
    signal?: AbortSignal,
): Promise<T[]> {
    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) throw new Error("Directus is not configured for CP Tracer.");
    const url = `${DIRECTUS_URL}/items/${collection}?${params.toString()}`;
    const response = await fetch(url, {
        cache: "no-store",
        signal,
        headers: {Authorization: `Bearer ${DIRECTUS_TOKEN}`},
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Directus ${collection} request failed (${response.status}).`);
    const parsed = body ? JSON.parse(body) as DirectusList<T> : {};
    return Array.isArray(parsed.data) ? parsed.data : [];
}

const listParams = (fields: string, filter?: [string, string]) => {
    const params = new URLSearchParams({fields, limit: "-1"});
    if (filter) params.set(filter[0], filter[1]);
    return params;
};

const inFilter = (field: string, ids: string[]): [string, string] => [
    `filter[${field}][_in]`, ids.join(","),
];

async function collectionReferencesForInvoices(invoiceIds: string[], signal?: AbortSignal) {
    if (!invoiceIds.length) return [] as JsonRecord[];
    return directusList<JsonRecord>(
        "collection_invoices",
        listParams("collection_id.id,collection_id.docNo", inFilter("invoice_id", invoiceIds)),
        signal,
    );
}

async function searchInvoiceCPs(search: string, signal?: AbortSignal) {
    const params = listParams("invoice_id,invoice_no", ["filter[invoice_no][_icontains]", search]);
    const invoices = await directusList<JsonRecord>("sales_invoice", params, signal);
    const invoiceIds = uniqueIds(invoices.map((invoice) => relationId(invoice.invoice_id, ["invoice_id", "id"])));
    const references = await collectionReferencesForInvoices(invoiceIds, signal);
    const matches = new Map<string, CPReference>();
    addCPReferences(matches, references);
    return matches;
}

async function searchMemoCPs(search: string, signal?: AbortSignal) {
    const memos = await directusList<JsonRecord>(
        "customers_memo",
        listParams("id,memo_number", ["filter[memo_number][_icontains]", search]),
        signal,
    );
    const memoIds = uniqueIds(memos.map((memo) => relationId(memo.id)));
    if (!memoIds.length) return new Map<string, CPReference>();

    const [collectionMemos, memoInvoices] = await Promise.all([
        directusList<JsonRecord>(
            "collection_memos",
            listParams("collection_id.id,collection_id.docNo", inFilter("memo_id", memoIds)),
            signal,
        ),
        directusList<JsonRecord>(
            "customer_memo_invoices",
            listParams("invoice_id.invoice_id", inFilter("memo_id", memoIds)),
            signal,
        ),
    ]);
    const invoiceIds = uniqueIds(memoInvoices.map((row) => relationId(row.invoice_id, ["invoice_id", "id"])));
    const invoiceCPs = await collectionReferencesForInvoices(invoiceIds, signal);
    const matches = new Map<string, CPReference>();
    addCPReferences(matches, collectionMemos);
    addCPReferences(matches, invoiceCPs);
    return matches;
}

async function searchSalesReturnCPs(search: string, signal?: AbortSignal) {
    const returns = await directusList<JsonRecord>(
        "sales_invoice_sales_return",
        listParams("invoice_no,return_no.return_number", ["filter[return_no][return_number][_icontains]", search]),
        signal,
    );
    const invoiceIds = uniqueIds(returns.map((row) => relationId(row.invoice_no, ["invoice_id", "id"])));
    const references = await collectionReferencesForInvoices(invoiceIds, signal);
    const matches = new Map<string, CPReference>();
    addCPReferences(matches, references);
    return matches;
}

async function fetchSpringCPPage(
    cpNo: string,
    collectionIds: string[] | null,
    page: number,
    token: string,
    requestId: string,
    request: NextRequest,
) {
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/tracer/search`;
    const context = createSpringRequestContext(requestId, SPRING_TIMEOUT_MS, request.signal);
    try {
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Request-Id": context.requestId,
            },
            body: JSON.stringify({
                cpNo: cpNo || undefined,
                collectionIds: collectionIds?.map(Number),
                page,
                size: PAGE_SIZE,
            }),
            cache: "no-store",
            signal: context.controller.signal,
        });
        const payload = await readResponseBody(response);
        if (!response.ok) throw new SpringResponseError(response.status, payload, context.requestId);

        const body = recordOf(payload);
        const content: CPReference[] = [];
        for (const item of Array.isArray(body.content) ? body.content : []) {
            const row = recordOf(item);
            const id = relationId(row.id);
            const docNo = textOf(row.docNo);
            if (id && docNo) content.push({id, docNo});
        }
        return {
            content,
            totalElements: Number(body.totalElements) || 0,
            totalPages: Number(body.totalPages) || 0,
            currentPage: Number(body.currentPage) || page,
        };
    } finally {
        context.cleanup();
    }
}

const addNumberReference = (target: Map<string, NumberReference>, id: string, number: unknown) => {
    const normalizedId = id || textOf(number);
    const normalizedNumber = textOf(number) || (normalizedId ? `#${normalizedId}` : "");
    if (normalizedId && normalizedNumber) target.set(normalizedId, {id: normalizedId, number: normalizedNumber});
};

async function hydrateCPRows(cps: CPReference[], signal?: AbortSignal): Promise<CPTracerRow[]> {
    if (!cps.length) return [];
    const cpIds = cps.map((cp) => cp.id);
    const [collectionInvoices, collectionMemos] = await Promise.all([
        directusList<JsonRecord>(
            "collection_invoices",
            listParams("collection_id.id,invoice_id.invoice_id,invoice_id.invoice_no", inFilter("collection_id", cpIds)),
            signal,
        ),
        directusList<JsonRecord>(
            "collection_memos",
            listParams("collection_id.id,memo_id.id,memo_id.memo_number", inFilter("collection_id", cpIds)),
            signal,
        ),
    ]);

    const invoiceCPs = new Map<string, Set<string>>();
    const memoCPs = new Map<string, Set<string>>();
    const invoiceNumbersByCP = new Map<string, Map<string, NumberReference>>();
    const memoNumbersByCP = new Map<string, Map<string, NumberReference>>();

    for (const row of collectionInvoices) {
        const cpId = relationId(row.collection_id, ["id"]);
        const invoice = recordOf(row.invoice_id);
        const invoiceId = relationId(row.invoice_id, ["invoice_id", "id"]);
        if (!cpId || !invoiceId) continue;
        const linkedCPs = invoiceCPs.get(invoiceId) ?? new Set<string>();
        linkedCPs.add(cpId);
        invoiceCPs.set(invoiceId, linkedCPs);
        const references = invoiceNumbersByCP.get(cpId) ?? new Map<string, NumberReference>();
        addNumberReference(references, invoiceId, invoice.invoice_no);
        invoiceNumbersByCP.set(cpId, references);
    }

    for (const row of collectionMemos) {
        const cpId = relationId(row.collection_id, ["id"]);
        const memo = recordOf(row.memo_id);
        const memoId = relationId(row.memo_id, ["id"]);
        if (!cpId || !memoId) continue;
        const linkedCPs = memoCPs.get(memoId) ?? new Set<string>();
        linkedCPs.add(cpId);
        memoCPs.set(memoId, linkedCPs);
        const references = memoNumbersByCP.get(cpId) ?? new Map<string, NumberReference>();
        addNumberReference(references, memoId, memo.memo_number);
        memoNumbersByCP.set(cpId, references);
    }

    const directInvoiceIds = Array.from(invoiceCPs.keys());
    const directMemoIds = Array.from(memoCPs.keys());
    const [memoInvoiceRows, invoiceMemoRows] = await Promise.all([
        directMemoIds.length
            ? directusList<JsonRecord>(
                "customer_memo_invoices",
                listParams("memo_id.id,memo_id.memo_number,invoice_id.invoice_id,invoice_id.invoice_no", inFilter("memo_id", directMemoIds)),
                signal,
            )
            : Promise.resolve([]),
        directInvoiceIds.length
            ? directusList<JsonRecord>(
                "customer_memo_invoices",
                listParams("memo_id.id,memo_id.memo_number,invoice_id.invoice_id,invoice_id.invoice_no", inFilter("invoice_id", directInvoiceIds)),
                signal,
            )
            : Promise.resolve([]),
    ]);

    const allMemoRows = [...memoInvoiceRows, ...invoiceMemoRows];
    const allMemoIds = uniqueIds(allMemoRows.map((row) => relationId(row.memo_id, ["id"])));
    const expandedMemoRows = allMemoIds.length
        ? await directusList<JsonRecord>(
            "customer_memo_invoices",
            listParams("memo_id.id,memo_id.memo_number,invoice_id.invoice_id,invoice_id.invoice_no", inFilter("memo_id", allMemoIds)),
            signal,
        )
        : [];
    const allInvoiceMemoRows = [...allMemoRows, ...expandedMemoRows];

    for (const row of allInvoiceMemoRows) {
        const memo = recordOf(row.memo_id);
        const invoice = recordOf(row.invoice_id);
        const memoId = relationId(row.memo_id, ["id"]);
        const invoiceId = relationId(row.invoice_id, ["invoice_id", "id"]);
        if (!memoId || !invoiceId) continue;
        const linkedCPs = new Set([...(memoCPs.get(memoId) ?? []), ...(invoiceCPs.get(invoiceId) ?? [])]);
        for (const cpId of linkedCPs) {
            const invoiceLinkedCPs = invoiceCPs.get(invoiceId) ?? new Set<string>();
            invoiceLinkedCPs.add(cpId);
            invoiceCPs.set(invoiceId, invoiceLinkedCPs);
            const memoReferences = memoNumbersByCP.get(cpId) ?? new Map<string, NumberReference>();
            addNumberReference(memoReferences, memoId, memo.memo_number);
            memoNumbersByCP.set(cpId, memoReferences);
            const invoiceReferences = invoiceNumbersByCP.get(cpId) ?? new Map<string, NumberReference>();
            addNumberReference(invoiceReferences, invoiceId, invoice.invoice_no);
            invoiceNumbersByCP.set(cpId, invoiceReferences);
        }
    }

    const allInvoiceIds = uniqueIds(Array.from(invoiceNumbersByCP.values()).flatMap((items) => Array.from(items.keys())));
    const returns = allInvoiceIds.length
        ? await directusList<JsonRecord>(
            "sales_invoice_sales_return",
            listParams("invoice_no,return_no.return_number", inFilter("invoice_no", allInvoiceIds)),
            signal,
        )
        : [];
    const returnsByCP = new Map<string, Map<string, NumberReference>>();

    for (const row of returns) {
        const invoiceId = relationId(row.invoice_no, ["invoice_id", "id"]);
        const returnValue = recordOf(row.return_no);
        const returnNumber = textOf(returnValue.return_number);
        if (!invoiceId || !returnNumber) continue;
        for (const cpId of invoiceCPs.get(invoiceId) ?? []) {
            const references = returnsByCP.get(cpId) ?? new Map<string, NumberReference>();
            addNumberReference(references, relationId(row.return_no, ["id", "return_id"]) || returnNumber, returnNumber);
            returnsByCP.set(cpId, references);
        }
    }

    return cps.map((cp) => ({
        cpId: cp.id,
        cpNumber: cp.docNo,
        invoices: Array.from(invoiceNumbersByCP.get(cp.id)?.values() ?? []),
        memos: Array.from(memoNumbersByCP.get(cp.id)?.values() ?? []),
        salesReturns: Array.from(returnsByCP.get(cp.id)?.values() ?? []),
    }));
}

export async function GET(request: NextRequest) {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const params = request.nextUrl.searchParams;
    const search = {
        cp: params.get("cp")?.trim().slice(0, MAX_SEARCH_LENGTH) || "",
        invoice: params.get("invoice")?.trim().slice(0, MAX_SEARCH_LENGTH) || "",
        memo: params.get("memo")?.trim().slice(0, MAX_SEARCH_LENGTH) || "",
        sr: params.get("sr")?.trim().slice(0, MAX_SEARCH_LENGTH) || "",
    };
    const activeTerms = Object.entries(search).filter(([, value]) => value.length > 0);

    const requestedPage = Number(params.get("page"));
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();

    try {
        const linkedTerms = activeTerms.filter(([field]) => field !== "cp");
        let collectionIds: string[] | null = null;
        if (linkedTerms.length) {
            const matchPromises: Array<Promise<Map<string, CPReference>>> = [];
            for (const [field, value] of linkedTerms) {
                if (field === "invoice") matchPromises.push(searchInvoiceCPs(value, request.signal));
                if (field === "memo") matchPromises.push(searchMemoCPs(value, request.signal));
                if (field === "sr") matchPromises.push(searchSalesReturnCPs(value, request.signal));
            }

            const criteriaMatches = await Promise.all(matchPromises);
            const commonCPs = new Set(criteriaMatches[0].keys());
            for (const criterion of criteriaMatches.slice(1)) {
                for (const cpId of commonCPs) {
                    if (!criterion.has(cpId)) commonCPs.delete(cpId);
                }
            }
            collectionIds = Array.from(commonCPs);
            if (!collectionIds.length) {
                return NextResponse.json({content: [], totalElements: 0, totalPages: 0, currentPage: page, pageSize: PAGE_SIZE}, {
                    headers: {"X-Request-Id": requestId},
                });
            }
        }

        const springPage = await fetchSpringCPPage(search.cp, collectionIds, page, token, requestId, request);
        const content = await hydrateCPRows(springPage.content, request.signal);
        return NextResponse.json({
            content,
            totalElements: springPage.totalElements,
            totalPages: springPage.totalPages,
            currentPage: springPage.currentPage,
            pageSize: PAGE_SIZE,
        }, {headers: {"X-Request-Id": requestId}});
    } catch (error: unknown) {
        if (error instanceof SpringResponseError) {
            return springErrorResponse(error.status, error.payload, `Spring CP Tracer Error: ${error.status}`, error.requestId);
        }
        if (isAbortError(error)) {
            return NextResponse.json(
                {error: "CP_TRACER_TIMEOUT", message: "CP Tracer took too long to respond. Please retry.", requestId},
                {status: 504, headers: {"X-Request-Id": requestId}},
            );
        }
        console.error("[BFF GET CP Tracer Exception]", {requestId, error});
        return NextResponse.json(
            {error: "CP_TRACER_UNAVAILABLE", message: "CP Tracer could not load the related records. Please retry.", requestId},
            {status: 502, headers: {"X-Request-Id": requestId}},
        );
    }
}
