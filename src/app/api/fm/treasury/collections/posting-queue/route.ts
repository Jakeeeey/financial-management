import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";
import {randomUUID} from "node:crypto";
import {
    dependencyErrorResponse,
    fetchSpringGetWithRetry,
    getSpringBaseUrl,
    isAbortError,
    readResponseBody,
    springErrorResponse,
} from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_TIMEOUT_MS = 15_000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SORT_FIELDS = new Set([
    "docNo",
    "salesmanName",
    "operationName",
    "encoderName",
    "collectionDate",
    "pouchAmount",
    "totalAppliedAmount",
    "creditAppliedAmount",
    "adjustmentDebit",
    "adjustmentCredit",
]);

interface RawQueueItem {
    id?: number;
    docNo?: string;
    salesmanName?: string;
    operationName?: string;
    encoderName?: string;
    collectionDate?: string;
    pouchAmount?: number;
    totalAppliedAmount?: number;
    creditAppliedAmount?: number;
    adjustmentDebit?: number;
    adjustmentCredit?: number;
}

interface PaginatedRawQueueResponse {
    content?: RawQueueItem[];
    totalElements?: number;
    totalPages?: number;
    currentPage?: number;
    size?: number;
}

const asPositiveInteger = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const addTextParam = (target: URLSearchParams, source: URLSearchParams, key: string, maxLength = 120) => {
    const value = source.get(key)?.trim();
    if (value) target.set(key, value.slice(0, maxLength));
};

const buildSpringQuery = (request: NextRequest) => {
    const source = request.nextUrl.searchParams;
    const query = new URLSearchParams();

    const page = asPositiveInteger(source.get("page"), 1);
    const requestedSize = asPositiveInteger(source.get("size"), DEFAULT_PAGE_SIZE);
    const size = Math.min(requestedSize, MAX_PAGE_SIZE);

    query.set("page", String(page));
    query.set("size", String(size));

    addTextParam(query, source, "search");
    addTextParam(query, source, "operation");
    addTextParam(query, source, "salesman");
    addTextParam(query, source, "cashier");

    for (const key of ["dateFrom", "dateTo"]) {
        const value = source.get(key)?.trim();
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) query.set(key, value);
    }

    const sortField = source.get("sortField") || "docNo";
    query.set("sortField", SORT_FIELDS.has(sortField) ? sortField : "docNo");
    query.set("sortDir", source.get("sortDir")?.toLowerCase() === "asc" ? "asc" : "desc");

    return query;
};

const mapQueueItem = (item: RawQueueItem) => ({
    id: item.id || 0,
    docNo: item.docNo || "UNKNOWN",
    salesmanName: item.salesmanName || "Unknown Route",
    operationName: item.operationName || "Unassigned Operation",
    encoderName: item.encoderName || "Cashier",
    collectionDate: item.collectionDate?.split("T")[0] || "N/A",
    pouchAmount: item.pouchAmount || 0,
    totalAppliedAmount: item.totalAppliedAmount || 0,
    creditAppliedAmount: item.creditAppliedAmount || 0,
    adjustmentDebit: item.adjustmentDebit || 0,
    adjustmentCredit: item.adjustmentCredit || 0,
});

export async function GET(request: NextRequest) {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/posting-queue/page?${buildSpringQuery(request).toString()}`;

    try {
        const {response, requestId: upstreamRequestId} = await fetchSpringGetWithRetry(
            targetUrl,
            token,
            requestId,
            SPRING_TIMEOUT_MS,
        );
        const payload = await readResponseBody(response);

        if (!response.ok) {
            return springErrorResponse(
                response.status,
                payload,
                `Spring GET Error: ${response.status}`,
                upstreamRequestId,
            );
        }

        const data = (payload || {}) as PaginatedRawQueueResponse;
        return NextResponse.json({
            content: (data.content || []).map(mapQueueItem),
            totalElements: data.totalElements || 0,
            totalPages: data.totalPages || 0,
            currentPage: data.currentPage || 1,
            size: data.size || DEFAULT_PAGE_SIZE,
        }, {headers: {"X-Request-Id": upstreamRequestId}});
    } catch (error: unknown) {
        console.error("[BFF GET Posting Queue Exception]", {requestId, error});

        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "SPRING_TIMEOUT",
                "The posting queue took too long to respond. Please retry.",
                requestId,
            );
        }

        return dependencyErrorResponse(
            503,
            "SPRING_UNAVAILABLE",
            "The posting queue is temporarily unavailable. Please retry.",
            requestId,
        );
    }
}
