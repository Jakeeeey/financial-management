import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import {
    dependencyErrorResponse,
    fetchSpringGetWithRetry,
    getSpringBaseUrl,
    isAbortError,
    readResponseBody,
    springErrorResponse,
} from "../../collections/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_TIMEOUT_MS = 15_000;
const MAX_CUSTOMER_CODES = 50;
const MAX_CUSTOMER_CODE_LENGTH = 50;
const MAX_CUSTOMER_NAMES = 50;
const MAX_CUSTOMER_NAME_LENGTH = 120;

const addDelimitedFilter = (
    query: URLSearchParams,
    source: URLSearchParams,
    parameter: "customerCodes" | "customerNames",
    maxItems: number,
    maxItemLength: number,
) => {
    const rawValue = source.get(parameter)?.trim();
    if (!rawValue) return;

    const values = rawValue
        .split(/[|,]/)
        .map(value => parameter === "customerCodes" ? value.trim().toUpperCase() : value.trim())
        .filter(Boolean);

    if (values.length > maxItems || values.some(value => value.length > maxItemLength)) {
        throw new Error(`Too many ${parameter === "customerCodes" ? "customer codes" : "customer names"} were supplied.`);
    }

    query.set(parameter, values.join("|"));
};

const buildSpringQuery = (request: NextRequest) => {
    const source = request.nextUrl.searchParams;
    const query = new URLSearchParams();
    const rawSalesmanId = source.get("salesmanId")?.trim();

    if (rawSalesmanId && /^\d+$/.test(rawSalesmanId) && Number(rawSalesmanId) > 0) {
        query.set("salesmanId", rawSalesmanId);
    }

    addDelimitedFilter(query, source, "customerCodes", MAX_CUSTOMER_CODES, MAX_CUSTOMER_CODE_LENGTH);
    addDelimitedFilter(query, source, "customerNames", MAX_CUSTOMER_NAMES, MAX_CUSTOMER_NAME_LENGTH);
    return query;
};

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({message: "Unauthorized"}, {status: 401});

    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
    const source = request.nextUrl.searchParams;
    const salesmanId = source.get("salesmanId")?.trim();
    const customerCodes = source.get("customerCodes")?.trim();
    const customerNames = source.get("customerNames")?.trim();

    if (!salesmanId && !customerCodes && !customerNames) {
        return NextResponse.json(
            {message: "Missing salesmanId, customerCodes, or customerNames"},
            {status: 400},
        );
    }

    try {
        const query = buildSpringQuery(request);
        const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/memos/available?${query.toString()}`;
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

        return NextResponse.json(payload || [], {headers: {"X-Request-Id": upstreamRequestId}});
    } catch (error: unknown) {
        if (isAbortError(error)) {
            return dependencyErrorResponse(
                504,
                "SPRING_TIMEOUT",
                "Available memos took too long to respond. Please retry.",
                requestId,
            );
        }

        if (error instanceof Error && (
            error.message === "Too many customer codes were supplied."
            || error.message === "Too many customer names were supplied."
        )) {
            return NextResponse.json({message: error.message}, {status: 400});
        }

        console.error("[BFF GET Available Memos Exception]", {requestId, error});
        return dependencyErrorResponse(
            503,
            "SPRING_UNAVAILABLE",
            "Available memos are temporarily unavailable. Please retry.",
            requestId,
        );
    }
}
