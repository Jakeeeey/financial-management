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
const MAX_PAGE = 10_000;
const SORT_FIELDS = new Set([
    "docNo",
    "date",
    "encodedDate",
    "collectedBy",
    "salesmanName",
    "amount",
    "appliedAmount",
    "status",
]);

interface RawCollectionItem {
    id?: number;
    docNo?: string;
    collectionDate?: string;
    date?: string;
    encodedDate?: string;
    dateEncoded?: string;
    collectedByName?: string;
    salesmanCode?: string;
    salesmanName?: string;
    totalAmount?: number;
    appliedAmount?: number;
}

interface PaginatedCollectionResponse {
    content?: RawCollectionItem[];
    totalElements?: number;
    totalPages?: number;
    currentPage?: number;
    size?: number;
}

const asPositiveInteger = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const addTextParam = (
    target: URLSearchParams,
    source: URLSearchParams,
    key: string,
    maxLength: number,
) => {
    const value = source.get(key)?.trim();
    if (value) target.set(key, value.slice(0, maxLength));
};

const addDateParam = (target: URLSearchParams, source: URLSearchParams, key: string) => {
    const value = source.get(key)?.trim();
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) target.set(key, value);
};

const buildSpringQuery = (request: NextRequest) => {
    const source = request.nextUrl.searchParams;
    const query = new URLSearchParams();
    const requestedPage = asPositiveInteger(source.get("page"), 1);
    const requestedSize = asPositiveInteger(source.get("size"), DEFAULT_PAGE_SIZE);

    query.set("page", String(Math.min(requestedPage, MAX_PAGE)));
    query.set("size", String(Math.min(requestedSize, MAX_PAGE_SIZE)));
    addTextParam(query, source, "search", 120);
    addTextParam(query, source, "salesmanCode", 50);
    addDateParam(query, source, "dateFrom");
    addDateParam(query, source, "dateTo");

    const sortField = source.get("sortField") || "encodedDate";
    query.set("sortField", SORT_FIELDS.has(sortField) ? sortField : "encodedDate");
    query.set("sortDir", source.get("sortDir")?.toLowerCase() === "asc" ? "asc" : "desc");

    return query;
};

const mapCollection = (collection: RawCollectionItem) => ({
    id: collection.id || 0,
    docNo: collection.docNo || "",
    date: collection.collectionDate || collection.date || "",
    encodedDate: collection.encodedDate || collection.dateEncoded || "",
    collectedBy: collection.collectedByName || "N/A",
    salesmanCode: collection.salesmanCode || "N/A",
    salesmanName: collection.salesmanName || "Unknown",
    amount: collection.totalAmount || 0,
    appliedAmount: collection.appliedAmount || 0,
    status: "Draft",
});

export async function GET(request: NextRequest) {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();

    try {
        const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/unposted/paged?${buildSpringQuery(request).toString()}`;
        const {response, requestId: upstreamRequestId} = await fetchSpringGetWithRetry(
            targetUrl,
            token,
            requestId,
            SPRING_TIMEOUT_MS,
            request.signal,
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

        const data = (payload || {}) as PaginatedCollectionResponse;
        return NextResponse.json({
            content: (data.content || []).map(mapCollection),
            totalElements: data.totalElements || 0,
            totalPages: data.totalPages || 0,
            currentPage: data.currentPage || 1,
            size: data.size || DEFAULT_PAGE_SIZE,
        }, {headers: {"X-Request-Id": upstreamRequestId}});
    } catch (error: unknown) {
        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "SPRING_TIMEOUT",
                "The unposted collection list took too long to respond. Please retry.",
                requestId,
            );
        }

        console.error("[BFF GET Unposted Collections Exception]", {requestId, error});
        return dependencyErrorResponse(
            503,
            "SPRING_UNAVAILABLE",
            "The unposted collection list is temporarily unavailable. Please retry.",
            requestId,
        );
    }
}
