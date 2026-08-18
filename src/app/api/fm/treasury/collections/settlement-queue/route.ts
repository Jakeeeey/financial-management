import {NextResponse, NextRequest} from "next/server";
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
const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;
const SORT_FIELDS = new Set(["collectionDate", "docNo", "salesmanName", "pouchAmount", "encodedDate", "discrepancy"]);

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

    query.set("page", String(page));
    query.set("size", String(Math.min(requestedSize, MAX_PAGE_SIZE)));
    addTextParam(query, source, "search");
    addTextParam(query, source, "status");
    addTextParam(query, source, "collector");

    const sortField = source.get("sortField") || "collectionDate";
    query.set("sortField", SORT_FIELDS.has(sortField) ? sortField : "collectionDate");
    query.set("sortDir", source.get("sortDir")?.toLowerCase() === "asc" ? "asc" : "desc");
    return query;
};

export async function GET(request: NextRequest) {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();

    try {
        const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/settlement-queue?${buildSpringQuery(request).toString()}`;
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

        return NextResponse.json(payload, {headers: {"X-Request-Id": upstreamRequestId}});
    } catch (error: unknown) {
        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "SPRING_TIMEOUT",
                "The settlement queue took too long to respond. Please retry.",
                requestId,
            );
        }

        console.error("[BFF GET Settlement Queue Exception]", {requestId, error});
        return dependencyErrorResponse(
            503,
            "SPRING_UNAVAILABLE",
            "The settlement queue is temporarily unavailable. Please retry.",
            requestId,
        );
    }
}
